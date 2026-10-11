import { baseDatos } from './base-datos.js';
import { formatoMoneda as currency, formatoFecha as dateFormat, escaparHtml as esc } from './utilidades/formatos.js';
import { crearFechaLocal as localDate } from './utilidades/fechas.js';

export async function renderInvoiceDetail(context) {
  const { id, state, pageContent, notify, refreshData } = context;
  try {
    const data = await baseDatos.obtenerFactura(id); const invoice = data.factura;
    const client = data.cliente || {}; const company = data.emisor || {}; const email = data.correos[0];
    const mailLabel = email?.estado === 'aceptado' ? 'Aceptado por el servidor SMTP' : email?.estado || 'Sin envío';
    document.querySelector('#page-title').textContent = invoice.numero;
    pageContent.innerHTML = `<div class="section-head no-print"><span class="badge">${esc(invoice.estado)}</span><div class="actions" style="margin:0"><a class="button secondary" href="#history">Volver</a><button class="button secondary" id="resend-button" ${invoice.estado === 'anulada' || !client.correo ? 'disabled' : ''}>Reenviar PDF</button><button class="button" id="pdf-button">Descargar PDF</button><button class="button secondary" id="print-button">Imprimir</button></div></div>
      <p class="hint no-print">Correo: ${esc(mailLabel)}. ${esc(email?.error || (!client.correo ? 'Sin correo de cliente; puedes descargar o imprimir el PDF.' : ''))} <button class="button text" id="invoice-refresh">Actualizar</button></p>
      <section class="card printable-invoice"><div class="invoice-print-head"><div><div class="print-brand">${esc(company.nombre || 'Facturación')}</div><p>Documento de prueba — sin validez fiscal</p></div><div class="amount"><span class="stat-label">${invoice.tipo === 'CCF' ? 'CRÉDITO FISCAL' : 'CONSUMIDOR FINAL'}</span><h2>${esc(invoice.numero)}</h2><p>${dateFormat.format(localDate(invoice.fecha))}</p></div></div>
      <div class="form-grid print-meta"><div><span class="stat-label">EMISOR</span><p>NIT: ${esc(company.nit || '—')} · NRC: ${esc(company.nrc || '—')}<br>${esc(company.actividad || '')}<br>${esc(company.direccion || '')}</p></div><div><span class="stat-label">CLIENTE</span><p><strong>${esc(client.nombre || 'Documento histórico sin cliente')}</strong><br>NIT: ${esc(client.nit || '—')} · NRC: ${esc(client.nrc || '—')}<br>${esc(client.actividad || '')}<br>${esc(client.direccion || '')}<br>${esc(client.correo || '')}</p></div><div><span class="stat-label">VENDEDOR / SUCURSAL</span><p>${esc(invoice.vendedor)} · ${esc(invoice.sucursal)}</p></div><div><span class="stat-label">PAGO</span><p>${esc(invoice.condicion)} · ${esc(invoice.forma_pago)}</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Producto</th><th class="amount">Cant.</th><th class="amount">${data.cliente ? 'Precio final' : 'Precio histórico'}</th><th class="amount">Descuento</th><th class="amount">Sin IVA</th><th class="amount">IVA</th><th class="amount">Total</th><th class="amount no-print">Comisión</th></tr></thead><tbody>${data.detalles.map((line) => `<tr><td>${esc(line.codigo_producto)}<br>${esc(line.descripcion)}<br><small>${esc(line.clasificacion)}</small></td><td class="amount">${line.cantidad}</td><td class="amount">${currency.format(line.precio_unitario)}</td><td class="amount">${currency.format(line.descuento)}</td><td class="amount">${line.subtotal == null ? '—' : currency.format(line.subtotal)}</td><td class="amount">${line.iva == null ? '—' : currency.format(line.iva)}</td><td class="amount">${currency.format(line.total_linea)}</td><td class="amount no-print">${line.comision == null ? 'Histórica' : line.comision_porcentaje + '% · ' + currency.format(line.comision)}</td></tr>`).join('')}</tbody></table></div>
      <div class="invoice-final">${[['Ventas gravadas sin IVA', invoice.ventas_gravadas], ['Ventas exentas', invoice.ventas_exentas], ['Ventas no sujetas', invoice.ventas_no_sujetas], ['Subtotal sin IVA', invoice.subtotal], ['IVA incluido', invoice.iva]].map(([label, value]) => `<div class="summary-row"><span>${label}</span><strong>${currency.format(value)}</strong></div>`).join('')}<div class="summary-row total"><span>Total</span><span>${currency.format(invoice.total)}</span></div><div class="commission-box no-print"><span>Comisión del vendedor</span><strong>${currency.format(invoice.comision)}</strong><small>Calculada por producto sin IVA</small></div></div></section>
      ${state.user.rol === 'administrador' && invoice.estado === 'emitida' ? '<form class="card no-print" id="void-form" style="margin-top:1rem"><h3>Anulación académica</h3><div class="field"><label for="void-reason">Motivo</label><input id="void-reason" maxlength="250" required></div><div class="actions"><button class="button danger" type="submit">Anular documento</button></div></form>' : ''}`;
    document.querySelector('#print-button').addEventListener('click', () => window.print());
    document.querySelector('#invoice-refresh').addEventListener('click', () => renderInvoiceDetail(context));
    document.querySelector('#pdf-button').addEventListener('click', async () => {
      try { await baseDatos.descargarPDF(id, invoice.numero); } catch (error) { notify(error.message, 'error'); }
    });
    document.querySelector('#resend-button').addEventListener('click', async (event) => {
      const button = event.currentTarget; button.disabled = true;
      try { await baseDatos.reenviarFactura(id); await renderInvoiceDetail(context); notify('PDF en cola para envío.'); } catch (error) { notify(error.message, 'error'); button.disabled = false; }
    });
    document.querySelector('#void-form')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const button = event.submitter; button.disabled = true;
      try { await baseDatos.anularFactura(id, document.querySelector('#void-reason').value.trim()); await refreshData(); await renderInvoiceDetail(context); notify('Documento anulado.'); } catch (error) { notify(error.message, 'error'); button.disabled = false; }
    });
  } catch (problem) { notify(problem.message, 'error'); }
}
