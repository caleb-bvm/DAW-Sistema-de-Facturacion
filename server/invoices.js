import { query, transaction, sqlNow, isUniqueViolation } from './db.js';
import { config } from './config.js';
import { integer, requireValue, textValue, validDate, validEmail, object } from './validation.js';
import { cents, money, calculateLine, calculateInvoice } from './calculations.js';
import { localClock } from './access.js';

export async function audit(userId, action, reference, connection) { await query('INSERT INTO auditoria (vendedor_id,accion,referencia,fecha) VALUES (?,?,?,?)', [userId, action, String(reference), sqlNow()], connection); }
export async function invoiceData(id, user = null, connection) {
  const [invoice] = await query('SELECT f.*,s.nombre sucursal,s.direccion,v.nombre vendedor FROM facturas f JOIN sucursales s ON s.id=f.sucursal_id JOIN vendedores v ON v.id=f.vendedor_id WHERE f.id=?', [id], connection);
  requireValue(invoice && (!user || user.rol === 'administrador' || String(invoice.vendedor_id) === String(user.id)), 'Documento no encontrado.', 404);
  // Una transacción SQL Server usa una conexión; las solicitudes se ejecutan en orden.
  const lines = await query('SELECT * FROM factura_detalles WHERE factura_id=? ORDER BY id', [id], connection);
  const emails = await query('SELECT id,estado,intentos,error,updated_at FROM correos WHERE factura_id=? ORDER BY id DESC', [id], connection);
  return { factura: invoice, detalles: lines, cliente: invoice.cliente_snapshot ? JSON.parse(invoice.cliente_snapshot) : null, emisor: invoice.emisor_snapshot ? JSON.parse(invoice.emisor_snapshot) : null, correos: emails };
}
export async function queueInvoice(invoice, connection) {
  const client = JSON.parse(invoice.cliente_snapshot || 'null'); requireValue(client && validEmail(client.correo), 'El cliente no tiene correo válido.');
  await query("INSERT INTO correos (factura_id,tipo,destinatario,asunto,cuerpo) VALUES (?,'factura',?,?,?)", [invoice.id, client.correo, `Comprobante ${invoice.numero}`, `Adjuntamos el documento de prueba ${invoice.numero}. Sin validez fiscal.`], connection);
}
export async function createInvoice(data, user) {
  const date = textValue(data, 'fecha', 10); requireValue(validDate(date) && date <= localClock().date, 'Selecciona una fecha válida, sin fechas futuras.');
  const type = data.tipo; requireValue(['CF', 'CCF'].includes(type), 'Selecciona el tipo de comprobante.');
  requireValue(['contado', 'credito'].includes(data.condicion) && ['efectivo', 'tarjeta', 'transferencia'].includes(data.forma_pago), 'Condición o forma de pago inválida.');
  const clientId = integer(data.cliente_id); const branchId = integer(data.sucursal_id);
  const requestId = textValue(data, 'solicitud_id', 36); requireValue(/^[a-f0-9-]{36}$/.test(requestId), 'Identificador de solicitud inválido.');
  requireValue(Array.isArray(data.detalles) && data.detalles.length >= 1 && data.detalles.length <= 100, 'Agrega entre uno y cien productos.');
  const existing = await query('SELECT id,numero,vendedor_id FROM facturas WHERE solicitud_id=?', [requestId]);
  if (existing.length) { requireValue(String(existing[0].vendedor_id) === String(user.id), 'Solicitud inválida.', 409); return { id: existing[0].id, numero: existing[0].numero, correo: 'pendiente' }; }
  try {
    return await transaction(async (connection) => {
      const [client] = await query('SELECT * FROM clientes WHERE id=?', [clientId], connection); requireValue(client && validEmail(client.correo), 'Selecciona un cliente con correo válido.');
      if (type === 'CCF') requireValue(Number(client.contribuyente) && client.nit && client.nrc && client.actividad && client.direccion, 'El CCF requiere cliente contribuyente, NIT, NRC, actividad y dirección.');
      const [branch] = await query('SELECT id FROM sucursales WHERE id=? AND activo=1', [branchId], connection); requireValue(branch, 'Sucursal inválida.');
      const details = []; const seen = new Set();
      for (const line of data.detalles) {
        requireValue(object(line), 'Detalle inválido.'); const id = integer(line.producto_id); requireValue(!seen.has(id), 'No repitas productos; aumenta su cantidad.'); seen.add(id);
        const [product] = await query('SELECT * FROM productos WHERE id=? AND activo=1', [id], connection); requireValue(product, 'Producto inválido o inactivo.');
        details.push(calculateLine(product, integer(line.cantidad, 1, 9999), cents(line.descuento ?? '0')));
      }
      const totals = calculateInvoice(details);
      const columns = ['numero', 'fecha', 'vendedor_id', 'sucursal_id', 'subtotal', 'iva_porcentaje', 'iva', 'total', 'comision_porcentaje', 'comision', 'tipo', 'cliente_id', 'cliente_snapshot', 'emisor_snapshot', 'condicion', 'forma_pago', 'ventas_gravadas', 'ventas_exentas', 'ventas_no_sujetas', 'solicitud_id'];
      const values = [null, date, user.id, branchId, totals.subtotal, 13, totals.iva, totals.total, 0, totals.comision, type, clientId, JSON.stringify(client), JSON.stringify(config.company), data.condicion, data.forma_pago, totals.ventas_gravadas, totals.ventas_exentas, totals.ventas_no_sujetas, requestId];
      const result = await query(`INSERT INTO facturas (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values, connection);
      const id = Number(result.insertId); const number = `${type}-${String(id).padStart(8, '0')}`;
      await query('UPDATE facturas SET numero=? WHERE id=?', [number, id], connection);
      const keys = ['producto_id', 'codigo_producto', 'descripcion', 'cantidad', 'precio_unitario', 'total_linea', 'descuento', 'clasificacion', 'iva_porcentaje', 'subtotal', 'iva', 'comision_porcentaje', 'comision'];
      for (const line of details) await query(`INSERT INTO factura_detalles (factura_id,${keys.join(',')}) VALUES (${Array(keys.length + 1).fill('?').join(',')})`, [id, ...keys.map((key) => line[key])], connection);
      await queueInvoice({ id, numero: number, cliente_snapshot: JSON.stringify(client) }, connection); await audit(user.id, `emitir_${type}`, number, connection);
      return { id, numero: number, correo: 'pendiente' };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const [previous] = await query('SELECT id,numero,vendedor_id FROM facturas WHERE solicitud_id=?', [requestId]);
      if (previous && String(previous.vendedor_id) === String(user.id)) return { id: previous.id, numero: previous.numero, correo: 'pendiente' };
    }
    throw error;
  }
}
export async function saveProduct(data, user) {
  const description = textValue(data, 'descripcion'); const price = cents(data.precio); requireValue(price > 0 && price <= 999999999999, 'Precio inválido.');
  const category = data.clasificacion; requireValue(['gravada', 'exenta', 'no_sujeta'].includes(category), 'Clasificación inválida.');
  return transaction(async (connection) => {
    const result = await query('INSERT INTO productos (codigo,descripcion,precio,clasificacion) VALUES (NULL,?,?,?)', [description, money(price), category], connection);
    const id = Number(result.insertId); const code = `PROD-${String(id).padStart(6, '0')}`;
    await query('UPDATE productos SET codigo=? WHERE id=?', [code, id], connection); await audit(user.id, 'guardar_producto', code, connection); return { id, codigo: code };
  });
}
