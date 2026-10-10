import { CalculoMonetario } from './CalculoMonetario.js';

/** Extrae el IVA que ya está incluido en el precio facturado. */
export class CalculoIVA extends CalculoMonetario {
  /** @param {number} [porcentaje=13] - Tasa de IVA expresada como porcentaje. */
  constructor(porcentaje = 13) {
    super();
    this.porcentaje = porcentaje;
  }

  /**
   * @param {number|string} total - Importe con IVA incluido.
   * @returns {number} IVA redondeado a dos decimales.
   */
  calcular(total, clasificacion = 'gravada') {
    const bruto = Math.round(Number(total) * 100);
    const tasa = clasificacion === 'gravada' ? this.porcentaje : 0;
    const base = Math.round(bruto * 100 / (100 + tasa));
    return (bruto - base) / 100;
  }
}
