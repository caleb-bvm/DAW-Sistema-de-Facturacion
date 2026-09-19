// Live Server muestra la interfaz; Apache ejecuta el puente PHP con MySQL.
const URL_API = 'http://localhost/facturacion/api/index.php';

async function request(action, options = {}) {
  const response = await fetch(`${URL_API}?action=${action}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const contenido = await response.text();
  let datos;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error('Apache no devolvió una respuesta válida. Verifica que Apache y MySQL estén iniciados.');
  }
  if (!response.ok) throw new Error(datos.error || 'No se pudo completar la operación.');
  return datos;
}

export const baseDatos = {
  iniciarSesion(usuario, clave) {
    return request('login', { method: 'POST', body: JSON.stringify({ usuario, clave }) });
  },
  obtenerCatalogos() {
    return request('catalogs');
  },
  obtenerFacturas(vendedorId) {
    return request(`invoices&seller_id=${vendedorId}`);
  },
  obtenerFactura(id) {
    return request(`invoice&id=${id}`);
  },
  guardarProducto(producto) {
    return request('product', { method: 'POST', body: JSON.stringify(producto) });
  },
  guardarFactura(factura) {
    return request('invoice', { method: 'POST', body: JSON.stringify(factura) });
  }
};
