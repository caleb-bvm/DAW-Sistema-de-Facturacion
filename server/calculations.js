import { requireValue } from './validation.js';

export function cents(value) {
  requireValue(['number', 'string'].includes(typeof value) && /^\d{1,10}(?:\.\d{1,2})?$/.test(String(value)), 'Usa importes positivos con hasta dos decimales.');
  const [whole, fraction = ''] = String(value).split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function money(value) { return `${Math.trunc(value / 100)}.${String(value % 100).padStart(2, '0')}`; }
export function commissionRate(base) { return base <= 0 ? 0 : base <= 10000 ? 1 : base <= 100000 ? 2 : base <= 200000 ? 3 : 4; }
export function calculateLine(product, quantity, discount) {
  const price = cents(product.precio); const beforeDiscount = price * quantity;
  requireValue(Number.isSafeInteger(beforeDiscount) && beforeDiscount <= 999999999999, 'El importe del producto supera el máximo permitido.');
  requireValue(discount <= beforeDiscount, 'El descuento supera el importe del producto.');
  const gross = beforeDiscount - discount; const rate = product.clasificacion === 'gravada' ? 13 : 0;
  const base = Math.floor((gross * 100 + Math.floor((100 + rate) / 2)) / (100 + rate));
  const percentage = commissionRate(base); const commission = Math.floor((base * percentage + 50) / 100);
  return { producto_id: Number(product.id), codigo_producto: product.codigo, descripcion: product.descripcion, cantidad: quantity, precio_unitario: money(price), descuento: money(discount), clasificacion: product.clasificacion, iva_porcentaje: rate, subtotal: money(base), iva: money(gross - base), total_linea: money(gross), comision_porcentaje: percentage, comision: money(commission) };
}
export function calculateInvoice(lines) {
  const totals = { subtotal: 0, iva: 0, total: 0, comision: 0, ventas_gravadas: 0, ventas_exentas: 0, ventas_no_sujetas: 0 };
  for (const line of lines) {
    totals.subtotal += cents(line.subtotal); totals.iva += cents(line.iva); totals.total += cents(line.total_linea); totals.comision += cents(line.comision);
    const category = { gravada: 'ventas_gravadas', exenta: 'ventas_exentas', no_sujeta: 'ventas_no_sujetas' }[line.clasificacion];
    totals[category] += cents(line.subtotal);
  }
  requireValue(totals.total > 0 && totals.total <= 999999999999, 'El total debe ser positivo y estar dentro del rango permitido.');
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, money(value)]));
}
