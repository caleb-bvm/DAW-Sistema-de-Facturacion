import { timingSafeEqual } from 'node:crypto';
import { query, transaction, sqlNow } from './db.js';
import { config } from './config.js';
import { requireValue, textValue, integer, RequestError } from './validation.js';
import { verifyPassword } from './passwords.js';
import { requestIp, locationFor, recordAttempt, restriction, publicUser, readToken, tokenHash, sessionCookie, createSession, requireSession } from './access.js';
import { invoiceData, createInvoice, saveProduct, queueInvoice, audit } from './invoices.js';
import { invoicePdf } from './documents.js';
import { saveClient, adminData, adminAction } from './admin.js';
import { processMail } from './mail.js';

function validateCsrf(user, request) {
  const actual = request.headers['x-csrf-token'] || '';
  requireValue(typeof actual === 'string' && /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(user.csrf)), 'La sesión cambió. Recarga la página.', 403);
}
export async function dispatch(request, response, url, data) {
  const action = url.searchParams.get('action') || ''; const method = request.method;
  if (action === 'login' && method === 'POST') {
    const username = textValue(data, 'usuario', 50); const password = data.clave;
    requireValue(typeof password === 'string' && password.length > 0 && password.length <= 200, 'Revisa la contraseña.');
    const location = await locationFor(requestIp(request));
    const [attempts] = await query("SELECT COUNT(*) cantidad FROM intentos_acceso WHERE (ip=? OR usuario=?) AND motivo IN ('credenciales','limite') AND fecha>=?", [location.ip, username, sqlNow(new Date(Date.now() - 600000))]);
    if (Number(attempts.cantidad) >= 5) { await recordAttempt(username, null, 'limite', location); throw new RequestError('Demasiados intentos. Intenta nuevamente en diez minutos.', 429); }
    const [user] = await query('SELECT * FROM vendedores WHERE usuario=?', [username]);
    if (!await verifyPassword(password, user?.clave)) { await recordAttempt(username, user?.id ?? null, 'credenciales', location); throw new RequestError('Usuario o contraseña incorrectos.', 401); }
    const reason = await restriction(user, location);
    if (reason) { await recordAttempt(username, user.id, reason, location); throw new RequestError(reason === 'permanente' ? 'Tu cuenta está bloqueada permanentemente. Contacta al administrador.' : 'Tu acceso no está permitido en este momento.', 403); }
    const session = await createSession(user.id, readToken(request)); response.setHeader('Set-Cookie', sessionCookie(session.token)); return { usuario: publicUser(user), csrf: session.csrf };
  }
  if (action === 'logout' && method === 'POST') {
    const token = readToken(request);
    if (token) { const [session] = await query('SELECT csrf FROM sesiones WHERE token_hash=?', [tokenHash(token)]); if (session) { validateCsrf(session, request); await query('DELETE FROM sesiones WHERE token_hash=?', [tokenHash(token)]); } }
    response.setHeader('Set-Cookie', sessionCookie('', true)); return { ok: true };
  }
  const user = await requireSession(request); if (method === 'POST') validateCsrf(user, request);
  if (action.startsWith('admin-')) requireValue(user.rol === 'administrador', 'Esta operación requiere un administrador.', 403);
  if (action === 'session' && method === 'GET') return { usuario: publicUser(user), csrf: user.csrf };
  if (action === 'catalogs' && method === 'GET') {
    const [productos, sucursales, clientes] = await Promise.all([query('SELECT id,codigo,descripcion,precio,clasificacion FROM productos WHERE activo=1 ORDER BY id'), query('SELECT id,nombre,direccion FROM sucursales WHERE activo=1 ORDER BY nombre'), query('SELECT * FROM clientes ORDER BY nombre')]); return { productos, sucursales, clientes };
  }
  if (action === 'client' && method === 'POST') return saveClient(data, user);
  if (action === 'product' && method === 'POST') return saveProduct(data, user);
  if (action === 'invoices' && method === 'GET') return query(`SELECT f.*,s.nombre sucursal,(SELECT TOP (1) estado FROM correos c WHERE c.factura_id=f.id ORDER BY id DESC) correo_estado FROM facturas f JOIN sucursales s ON s.id=f.sucursal_id ${user.rol === 'administrador' ? '' : 'WHERE f.vendedor_id=? '}ORDER BY f.id DESC`, user.rol === 'administrador' ? [] : [user.id]);
  if (action === 'invoice' && method === 'GET') return invoiceData(integer(url.searchParams.get('id')), user);
  if (action === 'invoice' && method === 'POST') {
    const result = await createInvoice(data, user); setImmediate(() => processMail().catch((error) => console.error(`Cola de correo: ${error.code || error.name}.`))); return result;
  }
  if (action === 'pdf' && method === 'GET') {
    const document = await invoiceData(integer(url.searchParams.get('id')), user); const pdf = await invoicePdf(document);
    response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${document.factura.numero}.pdf"` }); response.end(pdf); return undefined;
  }
  if (action === 'resend' && method === 'POST') {
    const id = integer(data.id);
    await transaction(async (connection) => {
      await query('SELECT id FROM facturas WITH (UPDLOCK,HOLDLOCK) WHERE id=?', [id], connection); const invoice = (await invoiceData(id, user, connection)).factura;
      requireValue(invoice.estado === 'emitida', 'No se envían documentos anulados.');
      const pending = await query("SELECT id FROM correos WHERE factura_id=? AND estado IN ('pendiente','procesando')", [id], connection); requireValue(!pending.length, 'El documento ya tiene un envío pendiente.');
      await queueInvoice(invoice, connection); await audit(user.id, 'reenviar', invoice.numero, connection);
    });
    setImmediate(() => processMail().catch((error) => console.error(`Cola de correo: ${error.code || error.name}.`))); return { ok: true };
  }
  if (action === 'void' && method === 'POST') {
    requireValue(user.rol === 'administrador', 'Esta operación requiere un administrador.', 403); const id = integer(data.id);
    await invoiceData(id, user); const reason = textValue(data, 'motivo', 250);
    await transaction(async (connection) => { await query("UPDATE facturas SET estado='anulada',motivo_anulacion=? WHERE id=?", [reason, id], connection); await audit(user.id, 'anulacion_academica', id, connection); }); return { ok: true };
  }
  if (action === 'admin-data' && method === 'GET') return adminData();
  if (action.startsWith('admin-') && method === 'POST') return adminAction(action.slice(6), data, user);
  throw new RequestError('Operación no encontrada.', 404);
}
