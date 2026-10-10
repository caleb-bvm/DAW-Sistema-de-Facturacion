import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLine, calculateInvoice, cents, commissionRate } from '../server/calculations.js';
import { CalculoFactura } from '../assets/js/calculos/CalculoFactura.js';
import { CalculoTotalLinea } from '../assets/js/calculos/CalculoTotalLinea.js';
import { CalculoSubtotal } from '../assets/js/calculos/CalculoSubtotal.js';
import { CalculoIVA } from '../assets/js/calculos/CalculoIVA.js';
import { CalculoTotalFactura } from '../assets/js/calculos/CalculoTotalFactura.js';
import { CalculoComision } from '../assets/js/calculos/CalculoComision.js';

const product = (price, classification = 'gravada') => ({ id: 1, codigo: 'PROD-000001', descripcion: 'Producto', precio: price, clasificacion: classification });
const calculator = new CalculoFactura({ totalLinea: new CalculoTotalLinea(), subtotal: new CalculoSubtotal(), iva: new CalculoIVA(), totalFactura: new CalculoTotalFactura(), comision: new CalculoComision() });
test('113 con IVA incluido corresponde a 100 de base, 13 de IVA y 1 de comisión', () => {
  const line = calculateLine(product('113.00'), 1, 0);
  assert.equal(line.subtotal, '100.00'); assert.equal(line.iva, '13.00'); assert.equal(line.total_linea, '113.00'); assert.equal(line.comision, '1.00');
});
test('cantidad y descuento se aplican antes de extraer IVA', () => {
  const line = calculateLine(product('113.00'), 2, cents('11.30'));
  assert.equal(line.subtotal, '190.00'); assert.equal(line.iva, '24.70'); assert.equal(line.total_linea, '214.70'); assert.equal(line.comision, '3.80');
});
test('comisiones por producto: dos líneas de 100 no heredan el 2 % del subtotal de la factura', () => {
  const lines = [calculateLine(product('113.00'), 1, 0), calculateLine({ ...product('113.00'), id: 2 }, 1, 0)];
  const totals = calculateInvoice(lines); assert.equal(totals.subtotal, '200.00'); assert.equal(totals.comision, '2.00'); assert.equal(totals.total, '226.00');
});
test('líneas exentas y no sujetas mantienen bases y categorías sin IVA', () => {
  const lines = [calculateLine(product('113.00'), 1, 0), calculateLine(product('50.00', 'exenta'), 1, 0), calculateLine(product('20.00', 'no_sujeta'), 1, 0)];
  const totals = calculateInvoice(lines); assert.equal(totals.iva, '13.00'); assert.equal(totals.ventas_gravadas, '100.00'); assert.equal(totals.ventas_exentas, '50.00'); assert.equal(totals.ventas_no_sujetas, '20.00'); assert.equal(totals.total, '183.00');
});
test('límites exactos de la escala de comisiones', () => {
  for (const [base, percentage] of [[0, 0], [10000, 1], [10001, 2], [100000, 2], [100001, 3], [200000, 3], [200001, 4]]) assert.equal(commissionRate(base), percentage);
});
test('rechaza importes negativos, NaN, más de dos decimales y descuentos excesivos', () => {
  for (const bad of ['-1', 'NaN', '1.001', {}, Infinity]) assert.throws(() => cents(bad));
  assert.throws(() => calculateLine(product('113.00'), 1, cents('113.01')));
});
test('redondeo por línea y paridad entre la previsualización y el servidor', () => {
  for (let i = 1; i <= 1000; i++) {
    const price = ((i * 7919 % 400000) / 100).toFixed(2); const quantity = i % 7 + 1; const discount = (i % 100 / 100).toFixed(2);
    const category = ['gravada', 'exenta', 'no_sujeta'][i % 3];
    const line = calculateLine(product(price, category), quantity, cents(discount));
    const preview = calculator.calcular([{ precio: price, cantidad: quantity, descuento: discount, clasificacion: category }]);
    assert.equal(preview.subtotal.toFixed(2), line.subtotal, `Base, caso ${i}`); assert.equal(preview.iva.toFixed(2), line.iva, `IVA, caso ${i}`); assert.equal(preview.comision.toFixed(2), line.comision, `Comisión, caso ${i}`); assert.equal(preview.total.toFixed(2), line.total_linea, `Total, caso ${i}`);
  }
});
