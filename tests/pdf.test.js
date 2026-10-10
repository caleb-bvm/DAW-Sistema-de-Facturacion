import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { invoicePdf } from '../server/documents.js';
import { calculateLine, calculateInvoice } from '../server/calculations.js';

export function sample(count = 3) {
  const lines = Array.from({ length: count }, (_, i) => calculateLine({ id: i + 1, codigo: `PROD-${String(i + 1).padStart(6, '0')}`, descripcion: `Artículo ${i + 1}: teclado inalámbrico con garantía y accesorios incluidos`, precio: '113.00', clasificacion: 'gravada' }, 1, 0));
  return { factura: { tipo: 'CCF', numero: 'CCF-00000001', fecha: '2026-10-19', estado: 'emitida', condicion: 'contado', forma_pago: 'efectivo', ...calculateInvoice(lines) }, detalles: lines, emisor: { nombre: 'Empresa de demostración', nit: '0614-010100-101-0', nrc: '123456-7', actividad: 'Venta de equipos informáticos', direccion: 'San Salvador, El Salvador', correo: 'facturas@example.com' }, cliente: { nombre: 'Cliente de prueba', nit: '0614-010100-102-0', nrc: '123457-8', actividad: 'Servicios de informática', direccion: 'Santa Ana, El Salvador', correo: 'cliente@example.com' } };
}
test('genera PDF de CCF y consumidor final, con paginación para 100 productos', async () => {
  await mkdir('test-output', { recursive: true });
  for (const [name, count, type] of [['ccf', 3, 'CCF'], ['consumidor-final', 3, 'CF'], ['ccf-multipagina', 100, 'CCF']]) {
    const data = sample(count); data.factura.tipo = type; const pdf = await invoicePdf(data);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); assert.match(pdf.toString('latin1'), /%%EOF/);
    const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    if (count === 100) assert.ok(pages >= 3); else assert.equal(pages, 1, 'Un documento breve no debe generar páginas vacías.');
    await writeFile(`test-output/${name}.pdf`, pdf);
  }
});
