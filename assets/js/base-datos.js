// Node sirve la interfaz y la API desde el mismo origen; SQL Server conserva los datos.
const URL_API = new URL('api', document.baseURI).href;
let csrf = '';

async function request(action, options = {}) {
  const response = await fetch(`${URL_API}?action=${action}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    ...options
  });
  const contenido = await response.text();
  let datos;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error('El servidor no devolvió una respuesta válida. Verifica que el sistema esté iniciado.');
  }
  if (!response.ok) {
    if (response.status === 401 && !action.startsWith('login')) {
      csrf = '';
      window.dispatchEvent(new CustomEvent('sesion-requerida', { detail: datos.error }));
    }
    throw new Error(datos.error || 'No se pudo completar la operación.');
  }
  if (datos.csrf) csrf = datos.csrf;
  return datos;
}

export const baseDatos = {
  iniciarSesion(usuario, clave) {
    return request('login', { method: 'POST', body: JSON.stringify({ usuario, clave }) });
  },
  obtenerSesion() { return request('session'); },
  cerrarSesion() { return request('logout', { method: 'POST', body: '{}' }); },
  guardarCliente(cliente) { return request('client', { method: 'POST', body: JSON.stringify(cliente) }); },
  obtenerLogs(filtros = {}) { return request('admin-logs&' + new URLSearchParams(filtros)); },
  obtenerAdministracion() { return request('admin-data'); },
  administrar(accion, datos) { return request(`admin-${accion}`, { method: 'POST', body: JSON.stringify(datos) }); },
  reenviarFactura(id) { return request('resend', { method: 'POST', body: JSON.stringify({ id: Number(id) }) }); },
  anularFactura(id, motivo) { return request('void', { method: 'POST', body: JSON.stringify({ id: Number(id), motivo }) }); },
  async descargarPDF(id, numero) {
    const response = await fetch(`${URL_API}?action=pdf&id=${Number(id)}`, { credentials: 'include' });
    if (!response.ok) {
      const data = await response.json();
      if (response.status === 401) window.dispatchEvent(new CustomEvent('sesion-requerida', { detail: data.error }));
      throw new Error(data.error || 'No se pudo generar el PDF.');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = url; link.download = `${numero}.pdf`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  obtenerCatalogos() {
    return request('catalogs');
  },
  obtenerFacturas() {
    return request('invoices');
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
