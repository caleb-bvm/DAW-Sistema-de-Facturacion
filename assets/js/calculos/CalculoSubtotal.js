import { CalculoMonetario } from './CalculoMonetario.js';

/** Suma los importes de todas las líneas de una factura. */
export class CalculoSubtotal extends CalculoMonetario {
  /**
   * @param {Array<number|string>} totalesLinea - Importes individuales ya calculados.
   * @returns {number} Suma monetaria de las líneas.
   */
  calcular(totalesLinea) {
    // Redondea cada acumulación para evitar que se propaguen fracciones de centavo.
    return totalesLinea.reduce((total, valor) => this.redondear(total + Number(valor)), 0);
  }
}
