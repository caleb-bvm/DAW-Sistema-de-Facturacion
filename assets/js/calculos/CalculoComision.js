import { CalculoMonetario } from './CalculoMonetario.js';

/** Aplica la escala existente al importe sin IVA de cada línea de producto. */
export class CalculoComision extends CalculoMonetario {
  /**
   * Obtiene el porcentaje de comisión correspondiente al subtotal.
   * @param {number} subtotal - Importe de la factura antes de impuestos.
   * @returns {number} Porcentaje de comisión, expresado como un número entero.
   */
  obtenerPorcentaje(subtotal) {
    if (subtotal <= 0) return 0;
    if (subtotal <= 100) return 1;
    if (subtotal <= 1000) return 2;
    if (subtotal <= 2000) return 3;
    return 4;
  }

  /**
   * Calcula el porcentaje y el importe monetario de la comisión.
   * @param {number|string} subtotal - Importe sobre el cual se aplica la comisión.
   * @returns {{porcentaje: number, monto: number}} Detalle de la comisión calculada.
   */
  calcular(subtotal) {
    const porcentaje = this.obtenerPorcentaje(Number(subtotal));
    const monto = this.redondear(Number(subtotal) * porcentaje / 100);
    return { porcentaje, monto };
  }
}
