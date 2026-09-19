import { baseDatos } from './base-datos.js';
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
import { CalculoCorrelativo } from './calculos/CalculoCorrelativo.js';

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
const calculoCodigoProducto = new CalculoCorrelativo('PROD', 6);
const calculoNumeroFactura = new CalculoCorrelativo('FAC', 8);
const state = { user: null, products: [], branches: [], invoices: [], invoiceTotals: null };
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
  state.invoices = invoices;
}

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.querySelector('#login-error');
  error.hidden = true;
  try {
    state.user = await baseDatos.iniciarSesion(
      document.querySelector('#login-user').value.trim(),
      document.querySelector('#login-password').value
    );
    sessionStorage.setItem('seller', JSON.stringify(state.user));
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

document.querySelector('#logout-button').addEventListener('click', mostrarInicioSesion);

document.querySelector('#menu-button').addEventListener('click', () => {
  document.querySelector('#navigation').classList.toggle('open');
});

window.addEventListener('hashchange', route);

function route() {
  const page = location.hash.slice(1).split('/')[0] || 'dashboard';
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  document.querySelector('#navigation').classList.remove('open');
  const routes = {
    dashboard: ['Resumen', renderDashboard],
    products: ['Productos', renderProducts],
    invoice: ['Nueva factura', renderInvoice],
    history: ['Facturas', renderHistory]
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
  const sales = calculoSubtotal.calcular(state.invoices.map((invoice) => invoice.total));
  const commissions = calculoSubtotal.calcular(state.invoices.map((invoice) => invoice.comision));
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
  document.querySelector('#product-count').textContent = `${state.products.length} productos activos`;
  document.querySelector('#product-list').innerHTML = state.products.length ? `<div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th class="amount">Precio</th></tr></thead><tbody>${state.products.map((product) => `<tr><td><strong>${escapeHtml(product.codigo)}</strong></td><td>${escapeHtml(product.descripcion)}</td><td class="amount">${currency.format(product.precio)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('inventory_2', 'No hay productos activos');
  document.querySelector('#product-form').addEventListener('submit', saveProduct);
}

async function saveProduct(event) {
  event.preventDefault();
  const description = document.querySelector('#product-description').value.trim();
  const price = calculoMoneda.calcular(document.querySelector('#product-price').value);
  if (!description || description.length > 160 || price <= 0) return notify('Revisa la descripción y el precio.', 'error');
  const code = calculoCodigoProducto.calcular(state.products.map((product) => product.codigo));
  try {
    await baseDatos.guardarProducto({ codigo: code, descripcion: description, precio: price });
    await refreshData();
    renderProducts();
    notify(`Producto ${code} guardado correctamente.`);
  } catch (problem) { notify(problem.message, 'error'); }
}

function renderInvoice() {
  cloneTemplate('#invoice-template');
  const date = document.querySelector('#invoice-date');
  date.value = todayIso();
  date.max = todayIso();
  document.querySelector('#invoice-seller').value = state.user.nombre;
  document.querySelector('#invoice-branch').innerHTML = `<option value="">Selecciona una sucursal</option>${state.branches.map((branch) => `<option value="${branch.id}">${escapeHtml(branch.nombre)}</option>`).join('')}`;
  document.querySelector('#add-line').addEventListener('click', addInvoiceLine);
  document.querySelector('#invoice-form').addEventListener('submit', saveInvoice);
  addInvoiceLine();
}

function addInvoiceLine() {
  const row = document.createElement('tr');
  row.className = 'invoice-line';
  row.innerHTML = `<td><select class="line-product" required><option value="">Selecciona un producto</option>${state.products.map((product) => `<option value="${product.id}">${escapeHtml(product.codigo)} · ${escapeHtml(product.descripcion)}</option>`).join('')}</select></td><td><input class="line-input line-quantity" type="number" min="1" max="9999" value="1" required></td><td class="amount line-price">$0.00</td><td class="amount line-total">$0.00</td><td><button class="line-remove" type="button" aria-label="Quitar producto"><span class="material-symbols-rounded">delete</span></button></td>`;
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
    return { precio: Number(product?.precio || 0), cantidad };
  });
  const result = calculoFactura.calcular(lines);
  rows.forEach((row, index) => {
    row.querySelector('.line-price').textContent = currency.format(lines[index].precio);
    row.querySelector('.line-total').textContent = currency.format(result.totalesLinea[index]);
  });
  state.invoiceTotals = result;
  document.querySelector('#subtotal').textContent = currency.format(result.subtotal);
  document.querySelector('#tax').textContent = currency.format(result.iva);
  document.querySelector('#grand-total').textContent = currency.format(result.total);
  document.querySelector('#commission-rate').textContent = `${result.porcentajeComision}%`;
  document.querySelector('#commission').textContent = currency.format(result.commission);
  document.querySelectorAll('[data-commission-rate]').forEach((row) => {
    row.classList.toggle('active-rate', Number(row.dataset.commissionRate) === result.porcentajeComision);
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
    details.push({ producto_id: product.id, codigo_producto: product.codigo, descripcion: product.descripcion, cantidad: quantity, precio_unitario: Number(product.precio), total_linea: calculoTotalLinea.calcular({ precio: product.precio, cantidad: quantity }) });
  }
  if (!details.length || state.invoiceTotals.subtotal <= 0) return notify('Agrega al menos un producto.', 'error');
  const payload = {
    numero: calculoNumeroFactura.calcular(state.invoices.map((invoice) => invoice.numero)), fecha: date,
    vendedor_id: state.user.id, sucursal_id: branch, subtotal: state.invoiceTotals.subtotal,
    iva_porcentaje: 13, iva: state.invoiceTotals.iva, total: state.invoiceTotals.total,
    comision_porcentaje: state.invoiceTotals.porcentajeComision, comision: state.invoiceTotals.comision, detalles: details
  };
  try {
    const saved = await baseDatos.guardarFactura(payload);
    await refreshData();
    notify(`Factura ${payload.numero} procesada correctamente.`);
    await showInvoice(saved.id);
  } catch (problem) { notify(problem.message, 'error'); }
}

function renderHistory() {
  cloneTemplate('#history-template');
  document.querySelector('#invoice-count').textContent = `${state.invoices.length} documentos procesados`;
  document.querySelector('#invoice-list').innerHTML = invoiceTable(state.invoices);
  bindInvoiceLinks();
}

function invoiceTable(invoices) {
  if (!invoices.length) return emptyState('receipt_long', 'Aún no hay facturas');
  return `<div class="table-wrap"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Sucursal</th><th class="amount">Total</th><th class="amount">Comisión</th><th></th></tr></thead><tbody>${invoices.map((invoice) => `<tr><td><strong>${escapeHtml(invoice.numero)}</strong></td><td>${dateFormat.format(localDate(invoice.fecha))}</td><td>${escapeHtml(invoice.sucursal)}</td><td class="amount">${currency.format(invoice.total)}</td><td class="amount">${invoice.comision_porcentaje}% · ${currency.format(invoice.comision)}</td><td><button class="button text invoice-link" data-id="${invoice.id}">Ver</button></td></tr>`).join('')}</tbody></table></div>`;
}

function bindInvoiceLinks() {
  document.querySelectorAll('.invoice-link').forEach((button) => button.addEventListener('click', () => showInvoice(button.dataset.id)));
}

async function showInvoice(id) {
  try {
    const data = await baseDatos.obtenerFactura(id);
    const invoice = data.factura;
    document.querySelector('#page-title').textContent = invoice.numero;
    pageContent.innerHTML = `<div class="section-head no-print"><span class="badge">Procesada</span><div class="actions" style="margin:0"><a class="button secondary" href="#history">Volver</a><button class="button" id="print-button"><span class="material-symbols-rounded">picture_as_pdf</span>Imprimir o guardar PDF</button></div></div><section class="card printable-invoice"><div class="invoice-print-head"><div><div class="print-brand">Facturacion</div><p>Sistema de facturación</p></div><div class="amount"><span class="stat-label">FACTURA</span><h2>${escapeHtml(invoice.numero)}</h2><p>${dateFormat.format(localDate(invoice.fecha))}</p></div></div><div class="form-grid print-meta"><div><span class="stat-label">VENDEDOR</span><p><strong>${escapeHtml(invoice.vendedor)}</strong></p></div><div><span class="stat-label">SUCURSAL</span><p><strong>${escapeHtml(invoice.sucursal)}</strong><br>${escapeHtml(invoice.direccion)}</p></div></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Descripción</th><th class="amount">Cantidad</th><th class="amount">Precio</th><th class="amount">Total</th></tr></thead><tbody>${data.detalles.map((line) => `<tr><td>${escapeHtml(line.codigo_producto)}</td><td>${escapeHtml(line.descripcion)}</td><td class="amount">${line.cantidad}</td><td class="amount">${currency.format(line.precio_unitario)}</td><td class="amount">${currency.format(line.total_linea)}</td></tr>`).join('')}</tbody></table></div><div class="invoice-final"><div class="summary-row"><span>Subtotal sin IVA</span><strong>${currency.format(invoice.subtotal)}</strong></div><div class="summary-row"><span>IVA (${invoice.iva_porcentaje}%)</span><strong>${currency.format(invoice.iva)}</strong></div><div class="summary-row total"><span>Total</span><span>${currency.format(invoice.total)}</span></div><div class="commission-box"><span>Comisión del vendedor (${invoice.comision_porcentaje}%)</span><strong>${currency.format(invoice.comision)}</strong><small>Calculada sobre el subtotal sin IVA</small></div></div></section>`;
    document.querySelector('#print-button').addEventListener('click', () => window.print());
  } catch (problem) { notify(problem.message, 'error'); }
}

function emptyState(icon, title) {
  return `<div class="card empty"><span class="material-symbols-rounded">${icon}</span><h3>${title}</h3></div>`;
}

const savedUser = sessionStorage.getItem('seller');
if (savedUser) {
  state.user = JSON.parse(savedUser);
  startApplication();
} else {
  mostrarInicioSesion();
}
