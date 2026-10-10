import PDFDocument from 'pdfkit';

/** PDF de cliente: no contiene comisiones ni información de acceso. */
export function invoicePdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `${data.factura.tipo} ${data.factura.numero}`, Author: data.emisor?.nombre || 'Facturación' } });
    const chunks = []; doc.on('data', (chunk) => chunks.push(chunk)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(chunks)));
    try {
      const f = data.factura; const title = f.tipo === 'CCF' ? 'Comprobante de crédito fiscal' : 'Factura de consumidor final';
      doc.fillColor('#6750a4').font('Helvetica-Bold').fontSize(19).text(title); doc.moveDown(.4);
      doc.fillColor('#8a5100').fontSize(10).text('Documento de prueba - sin validez fiscal');
      doc.fillColor('#222').font('Helvetica').text(`${f.numero} | Fecha: ${f.fecha} | Estado: ${f.estado}`); doc.moveDown();
      function pageSpace(height) { if (doc.y + height > doc.page.height - 65) doc.addPage(); }
      function party(label, person = {}) {
        const lines = [`${label}: ${person.nombre || 'Sin datos históricos'}`, `NIT: ${person.nit || '-'} | NRC: ${person.nrc || '-'}`, `Actividad: ${person.actividad || '-'}`, `Dirección: ${person.direccion || '-'}`, `Teléfono: ${person.telefono || '-'} | Correo: ${person.correo || '-'}`];
        const height = lines.reduce((sum, line) => sum + doc.heightOfString(line, { width: 515 }), 0) + 15; pageSpace(height);
        doc.font('Helvetica-Bold').fontSize(10).text(lines[0]); doc.font('Helvetica').fontSize(9); lines.slice(1).forEach((line) => doc.text(line)); doc.moveDown(.6);
      }
      party('Emisor', data.emisor || {}); party('Receptor', data.cliente || {});
      doc.fontSize(10).text(`Condición: ${f.condicion} | Pago: ${f.forma_pago} | Moneda: USD`); doc.moveDown();
      const xs = [40, 245, 280, 345, 410, 475]; const widths = [200, 30, 60, 60, 60, 80];
      function header() {
        const y = doc.y; doc.rect(40, y, 515, 24).fill('#f3edf7'); doc.fillColor('#222').font('Helvetica-Bold').fontSize(8);
        ['Producto / clasificación', 'Cant.', 'Precio final', 'Descuento', 'Sin IVA', 'Total USD'].forEach((text, i) => doc.text(text, xs[i] + 3, y + 7, { width: widths[i] - 6, lineBreak: false })); doc.y = y + 29; doc.x = 40;
      }
      pageSpace(70); header();
      for (const line of data.detalles) {
        doc.font('Helvetica').fontSize(9);
        const description = `${line.codigo_producto} · ${line.descripcion}\n${line.clasificacion || 'Histórico'}`;
        const height = Math.max(34, doc.heightOfString(description, { width: widths[0] - 6 }) + 10);
        if (doc.y + height > doc.page.height - 65) { doc.addPage(); header(); doc.font('Helvetica').fontSize(9); }
        const y = doc.y;
        const values = [description, String(line.cantidad), line.precio_unitario, line.descuento || '0.00', line.subtotal ?? '-', line.total_linea];
        values.forEach((text, i) => doc.text(text, xs[i] + 3, y + 5, { width: widths[i] - 6, align: i ? 'right' : 'left' }));
        doc.moveTo(40, y + height).lineTo(555, y + height).strokeColor('#ddd').stroke(); doc.y = y + height + 2; doc.x = 40;
      }
      const totals = [['Ventas gravadas sin IVA', f.ventas_gravadas], ['Ventas exentas', f.ventas_exentas], ['Ventas no sujetas', f.ventas_no_sujetas], ['Subtotal sin IVA', f.subtotal], ['IVA incluido', f.iva], ['Total a pagar', f.total]];
      pageSpace(155); doc.moveDown();
      for (const [label, amount] of totals) {
        const y = doc.y; doc.font(label === 'Total a pagar' ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).text(label, 290, y, { width: 170 }); doc.text(`$${amount || '0.00'}`, 460, y, { width: 95, align: 'right' }); doc.y = y + 20; doc.x = 40;
      }
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i); doc.font('Helvetica').fontSize(8).fillColor('#666').text(`Página ${i + 1} de ${pages.count} · Documento académico`, 40, doc.page.height - 60, { width: 515, align: 'center', lineBreak: false });
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
