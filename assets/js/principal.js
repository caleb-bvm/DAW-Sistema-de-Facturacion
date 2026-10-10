import { baseDatos } from './base-datos.js';
import { renderClients, renderAdministration } from './gestion.js';
import { renderInvoiceDetail } from './comprobantes.js';
import { formatoMoneda as currency, formatoFecha as dateFormat, escaparHtml as escapeHtml } from './utilidades/formatos.js';
import { crearFechaLocal as localDate, obtenerFechaActualIso as todayIso } from './utilidades/fechas.js';
import { CalculoValorMonetario } from './calculos/CalculoValorMonetario.js';
import { CalculoTotalLinea } from './calculos/CalculoTotalLinea.js';
import { CalculoSubtotal } from './calculos/CalculoSubtotal.js';
import { CalculoIVA } from './calculos/CalculoIVA.js';
import { CalculoTotalFactura } from './calculos/CalculoTotalFactura.js';
import { CalculoComision } from './calculos/CalculoComision.js';
import { CalculoFactura } from './calculos/CalculoFactura.js';
import { CalculoEdad } from './calculos/CalculoEdad.js';
import { CalculoCumpleanos } from './calculos/CalculoCumpleanos.js';

const calculoMoneda = new CalculoValorMonetario();
const calculoTotalLinea = new CalculoTotalLinea();
const calculoSubtotal = new CalculoSubtotal();
const calculoFactura = new CalculoFactura({
  totalLinea: calculoTotalLinea,
  subtotal: calculoSubtotal,
  iva: new CalculoIVA(13),
  totalFactura: new CalculoTotalFactura(),
  comision: new CalculoComision()
});
const calculoEdad = new CalculoEdad();
const calculoCumpleanos = new CalculoCumpleanos();
const state = { user: null, products: [], branches: [], clients: [], invoices: [], invoiceTotals: null };
const pageContent = document.querySelector('#page-content');

function notify(message, type = 'success') {
  const notice = document.querySelector('#notice');
  notice.textContent = message;
  notice.className = `snackbar ${type}`;
  notice.hidden = false;
  setTimeout(() => { notice.hidden = true; }, 4000);
}

async function refreshData() {
  const [catalogs, invoices] = await Promise.all([
    baseDatos.obtenerCatalogos(),
    baseDatos.obtenerFacturas(state.user.id)
  ]);
  state.products = catalogs.productos;
  state.branches = catalogs.sucursales;
  state.clients = catalogs.clientes;
  state.invoices = invoices;
}

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.querySelector('#login-error');
  error.hidden = true;
  try {
    const session = await baseDatos.iniciarSesion(
      document.querySelector('#login-user').value.trim(),
      document.querySelector('#login-password').value
    );
    state.user = session.usuario;
    await startApplication();
  } catch (problem) {
    error.textContent = problem.message;
    error.hidden = false;
  }
});

async function startApplication() {
  document.querySelector('#login-view').hidden = true;
  document.querySelector('#application').hidden = false;
  document.querySelector('#seller-name').textContent = state.user.nombre;
  document.querySelector('#admin-navigation').hidden = state.user.rol !== 'administrador';
  document.querySelector('.seller-mini small').textContent = state.user.rol === 'administrador' ? 'Administrador' : 'Facturador';
  document.querySelector('#seller-avatar').textContent = state.user.nombre.charAt(0).toUpperCase();
  document.querySelector('#current-date').textContent = dateFormat.format(new Date());
  try {
    await refreshData();
    route();
  } catch (problem) {
    notify(problem.message, 'error');
  }
}

function mostrarInicioSesion() {
  state.user = null;
  sessionStorage.removeItem('seller');
  document.querySelector('#application').hidden = true;
  document.querySelector('#login-view').hidden = false;
  document.querySelector('#login-form').reset();
  document.querySelector('#login-error').hidden = true;
  pageContent.replaceChildren();
}

document.querySelector('#logout-button').addEventListener('click', async () => {
  try { await baseDatos.cerrarSesion(); mostrarInicioSesion(); }
  catch (problem) { notify(problem.message, 'error'); }
});
window.addEventListener('sesion-requerida', (event) => {
  mostrarInicioSesion();
  if (event.detail) { document.querySelector('#login-error').textContent = event.detail; document.querySelector('#login-error').hidden = false; }
});

document.querySelector('#menu-button').addEventListener('click', () => {
  document.querySelector('#navigation').classList.toggle('open');
});

window.addEventListener('hashchange', route);

function route() {
  if (!state.user) return;
  const page = location.hash.slice(1).split('/')[0] || 'dashboard';
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  document.querySelector('#navigation').classList.remove('open');
  const routes = {
    dashboard: ['Resumen', renderDashboard],
    products: ['Productos', renderProducts],
    invoice: ['Nueva factura', renderInvoice],
    history: ['Facturas', renderHistory],
    clients: ['Clientes', () => renderClients({ state, pageContent, notify, refreshData })],
    admin: ['Administración', () => state.user.rol === 'administrador' ? renderAdministration({ state, pageContent, notify }) : renderDashboard()]
  };
  const [title, renderer] = routes[page] || routes.dashboard;
  document.querySelector('#page-title').textContent = title;
  renderer();
}

function cloneTemplate(id) {
  pageContent.replaceChildren(document.querySelector(id).content.cloneNode(true));
}

function renderDashboard() {
  cloneTemplate('#dashboard-template');
  const issued = state.invoices.filter((invoice) => invoice.estado !== 'anulada');
  const sales = calculoSubtotal.calcular(issued.map((invoice) => invoice.total));
  const commissions = calculoSubtotal.calcular(issued.map((invoice) => invoice.comision));
  document.querySelector('#dashboard-stats').innerHTML = `
    <article class="card"><span class="stat-icon material-symbols-rounded">receipt_long</span><div class="stat-value">${state.invoices.length}</div><div class="stat-label">Facturas registradas</div></article>
    <article class="card"><span class="stat-icon material-symbols-rounded">payments</span><div class="stat-value">${currency.format(sales)}</div><div class="stat-label">Ventas acumuladas</div></article>
    <article class="card tonal"><span class="material-symbols-rounded">workspace_premium</span><div class="stat-value">${currency.format(commissions)}</div><div class="stat-label">Comisiones ganadas</div></article>
    <article class="card"><span class="stat-icon material-symbols-rounded">inventory_2</span><div class="stat-value">${state.products.length}</div><div class="stat-label">Productos disponibles</div></article>`;
  const birth = localDate(state.user.fecha_nacimiento);
  const today = localDate(todayIso());
  const age = calculoEdad.calcular({ fechaNacimiento: birth, fechaActual: today });
  document.querySelector('#birth-date').textContent = dateFormat.format(birth);
  document.querySelector('#seller-age').textContent = `Nació hace ${age.anios} años, ${age.meses} meses, ${age.semanas} semanas y ${age.dias} días.`;
  const message = calculoCumpleanos.calcular({ fechaNacimiento: birth, fechaActual: today });
  if (message) {
    document.querySelector('#birthday-message').textContent = message;
    document.querySelector('#birthday-name').textContent = state.user.nombre;
    document.querySelector('#birthday-banner').hidden = false;
  }
  document.querySelector('#recent-invoices').innerHTML = invoiceTable(state.invoices.slice(0, 5));
  bindInvoiceLinks();
}

function renderProducts() {
  cloneTemplate('#products-template');
  document.querySelector('#product-price').previousElementSibling.textContent = 'Precio final, IVA incluido (USD)';
  document.querySelector('#product-form .hint').textContent = 'El servidor asigna el código permanente. Los precios gravados ya incluyen IVA.';
  document.querySelector('#product-form .actions').insertAdjacentHTML('beforebegin', '<div class="field" style="margin-top:1rem"><label for="product-classification">Clasificación tributaria</label><select id="product-classification"><option value="gravada">Gravada · IVA 13 % incluido</option><option value="exenta">Exenta</option><option value="no_sujeta">No sujeta</option></select></div>');
  document.querySelector('#product-count').textContent = `${state.products.length} productos activos`;
  document.querySelector('#product-list').innerHTML = state.products.length ? `<div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th class="amount">Precio</th></tr></thead><tbody>${state.products.map((product) => `<tr><td><strong>${escapeHtml(product.codigo)}</strong></td><td>${escapeHtml(product.descripcion)}</td><td class="amount">${currency.format(product.precio)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('inventory_2', 'No hay productos activos');
  document.querySelector('#product-form').addEventListener('submit', saveProduct);
}

async function saveProduct(event) {
  event.preventDefault();
  const description = document.querySelector('#product-description').value.trim();
  const price = calculoMoneda.calcular(document.querySelector('#product-price').value);
  if (!description || description.length > 160 || price <= 0) return notify('Revisa la descripción y el precio.', 'error');
  try {
    const saved = await baseDatos.guardarProducto({ descripcion: description, precio: price.toFixed(2), clasificacion: document.querySelector('#product-classification').value });
    await refreshData();
    renderProducts();
    notify(`Producto ${saved.codigo} guardado correctamente.`);
  } catch (problem) { notify(problem.message, 'error'); }
}

function renderInvoice() {
  state.invoiceRequestId = crypto.randomUUID();
  cloneTemplate('#invoice-template');
  const date = document.querySelector('#invoice-date');
  date.value = todayIso();
  date.max = todayIso();
  document.querySelector('#invoice-seller').value = state.user.nombre;
  document.querySelector('#invoice-form .form-grid').insertAdjacentHTML('beforeend', `
    <div class="field"><label for="invoice-type">Comprobante</label><select id="invoice-type"><option value="CF">Consumidor final</option><option value="CCF">Crédito fiscal</option></select></div>
    <div class="field"><label for="invoice-client">Cliente</label><select id="invoice-client" required><option value="">Selecciona un cliente</option>${state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.nombre)}${Number(client.contribuyente) ? ' · contribuyente' : ''}</option>`).join('')}</select><a class="hint" href="#clients">Registrar o editar cliente</a></div>
    <div class="field"><label for="invoice-condition">Condición</label><select id="invoice-condition"><option value="contado">Contado</option><option value="credito">Crédito</option></select></div>
    <div class="field"><label for="invoice-payment">Forma de pago</label><select id="invoice-payment"><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option></select></div>
    <p class="hint full">Documento de prueba, sin validez fiscal. El PDF se enviará al correo registrado del cliente.</p>`);
  document.querySelector('#invoice-lines').closest('table').querySelector('thead').innerHTML = '<tr><th>Producto</th><th>Cantidad</th><th class="amount">Precio final</th><th>Descuento de línea</th><th class="amount">Sin IVA</th><th class="amount">Comisión</th><th class="amount">Total</th><th></th></tr>';
  document.querySelector('#invoice-form .commission-rates th').textContent = 'Importe de la línea sin IVA';
  document.querySelector('#invoice-branch').innerHTML = `<option value="">Selecciona una sucursal</option>${state.branches.map((branch) => `<option value="${branch.id}">${escapeHtml(branch.nombre)}</option>`).join('')}`;
  document.querySelector('#add-line').addEventListener('click', addInvoiceLine);
  document.querySelector('#invoice-form').addEventListener('submit', saveInvoice);
  addInvoiceLine();
}

function addInvoiceLine() {
  const row = document.createElement('tr');
  row.className = 'invoice-line';
  row.innerHTML = `<td><select class="line-product" aria-label="Producto" required><option value="">Selecciona un producto</option>${state.products.map((product) => `<option value="${product.id}">${escapeHtml(product.codigo)} · ${escapeHtml(product.descripcion)}</option>`).join('')}</select></td><td><input class="line-input line-quantity" aria-label="Cantidad" type="number" min="1" max="9999" step="1" value="1" required></td><td class="amount line-price">$0.00</td><td><input class="line-input line-discount" aria-label="Descuento de la línea" type="number" min="0" step="0.01" value="0" required></td><td class="amount line-base">$0.00</td><td class="amount line-commission">$0.00</td><td class="amount line-total">$0.00</td><td><button class="line-remove" type="button" aria-label="Quitar producto"><span class="material-symbols-rounded">delete</span></button></td>`;
  row.addEventListener('input', calculateInvoice);
  row.addEventListener('change', calculateInvoice);
  row.querySelector('.line-remove').addEventListener('click', () => { row.remove(); if (!document.querySelector('.invoice-line')) addInvoiceLine(); calculateInvoice(); });
  document.querySelector('#invoice-lines').append(row);
  calculateInvoice();
}

function calculateInvoice() {
  const rows = [...document.querySelectorAll('.invoice-line')];
  const lines = rows.map((row) => {
    const product = state.products.find((item) => String(item.id) === row.querySelector('.line-product').value);
    const cantidad = Number(row.querySelector('.line-quantity').value) || 0;
    const descuento = Number(row.querySelector('.line-discount').value) || 0;
    return { precio: Number(product?.precio || 0), cantidad, descuento: Math.min(Math.max(0, descuento), Number(product?.precio || 0) * cantidad), clasificacion: product?.clasificacion || 'gravada' };
  });
  const result = calculoFactura.calcular(lines);
  rows.forEach((row, index) => {
    row.querySelector('.line-price').textContent = currency.format(lines[index].precio);
    row.querySelector('.line-total').textContent = currency.format(result.totalesLinea[index]);
    row.querySelector('.line-base').textContent = currency.format(result.basesLinea[index]);
    row.querySelector('.line-commission').textContent = `${result.comisionesLinea[index].porcentaje}% · ${currency.format(result.comisionesLinea[index].monto)}`;
  });
  state.invoiceTotals = result;
  document.querySelector('#subtotal').textContent = currency.format(result.subtotal);
  document.querySelector('#tax').textContent = currency.format(result.iva);
  document.querySelector('#grand-total').textContent = currency.format(result.total);
  document.querySelector('#commission-rate').textContent = 'por producto';
  document.querySelector('#commission').textContent = currency.format(result.comision);
  document.querySelectorAll('[data-commission-rate]').forEach((row) => {
    row.classList.toggle('active-rate', result.comisionesLinea.some((item) => item.porcentaje === Number(row.dataset.commissionRate)));
  });
}

async function saveInvoice(event) {
  event.preventDefault();
  const date = document.querySelector('#invoice-date').value;
  const branch = Number(document.querySelector('#invoice-branch').value);
  if (!date || date > todayIso() || !branch) return notify('Selecciona una fecha y sucursal válidas.', 'error');
  const details = [];
  const usedProducts = new Set();
  for (const row of document.querySelectorAll('.invoice-line')) {
    const product = state.products.find((item) => String(item.id) === row.querySelector('.line-product').value);
    const quantity = Number(row.querySelector('.line-quantity').value);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) return notify('Revisa los productos y sus cantidades.', 'error');
    if (usedProducts.has(product.id)) return notify('No repitas productos; modifica la cantidad de la línea existente.', 'error');
    usedProducts.add(product.id);
    const discount = Number(row.querySelector('.line-discount').value);
    if (!Number.isFinite(discount) || discount < 0 || discount > Number(product.precio) * quantity) return notify('El descuento no puede superar el importe de la línea.', 'error');
    details.push({ producto_id: Number(product.id), cantidad: quantity, descuento: discount.toFixed(2) });
  }
  if (!details.length || state.invoiceTotals.subtotal <= 0) return notify('Agrega al menos un producto.', 'error');
  const payload = {
    fecha: date, solicitud_id: state.invoiceRequestId, sucursal_id: branch, cliente_id: Number(document.querySelector('#invoice-client').value),
    tipo: document.querySelector('#invoice-type').value, condicion: document.querySelector('#invoice-condition').value,
    forma_pago: document.querySelector('#invoice-payment').value, detalles: details
  };
  const submit = event.submitter;
  if (submit) submit.disabled = true;
  try {
    const saved = await baseDatos.guardarFactura(payload);
    await refreshData();
    notify(`Comprobante ${saved.numero} guardado. Correo pendiente de envío automático.`);
    await showInvoice(saved.id);
  } catch (problem) { notify(problem.message, 'error'); }
  finally { if (submit) submit.disabled = false; }
}

function renderHistory() {
  cloneTemplate('#history-template');
  document.querySelector('#invoice-count').textContent = `${state.invoices.length} documentos procesados`;
  document.querySelector('#invoice-list').innerHTML = invoiceTable(state.invoices);
  bindInvoiceLinks();
}

function invoiceTable(invoices) {
  if (!invoices.length) return emptyState('receipt_long', 'Aún no hay facturas');
  return `<div class="table-wrap"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Sucursal</th><th>Estado</th><th>Correo</th><th class="amount">Total</th><th class="amount">Comisión</th><th></th></tr></thead><tbody>${invoices.map((invoice) => `<tr><td><strong>${escapeHtml(invoice.numero)}</strong></td><td>${dateFormat.format(localDate(invoice.fecha))}</td><td>${escapeHtml(invoice.sucursal)}</td><td>${invoice.estado === 'anulada' ? 'Anulada' : 'Emitida'}</td><td>${({pendiente:'Pendiente',procesando:'Procesando',aceptado:'Aceptado por SMTP',fallido:'Fallido'})[invoice.correo_estado] || 'Sin envío'}</td><td class="amount">${currency.format(invoice.total)}</td><td class="amount">${currency.format(invoice.comision)}</td><td><button class="button text invoice-link" data-id="${invoice.id}">Ver</button></td></tr>`).join('')}</tbody></table></div>`;
}

function bindInvoiceLinks() {
  document.querySelectorAll('.invoice-link').forEach((button) => button.addEventListener('click', () => showInvoice(button.dataset.id)));
}

async function showInvoice(id) {
  await renderInvoiceDetail({ id, state, pageContent, notify, refreshData });
}

function emptyState(icon, title) {
  return `<div class="card empty"><span class="material-symbols-rounded">${icon}</span><h3>${title}</h3></div>`;
}

// La identidad se recupera desde el servidor; sessionStorage no concede permisos.
try {
  const session = await baseDatos.obtenerSesion();
  state.user = session.usuario;
  await startApplication();
} catch { mostrarInicioSesion(); }
