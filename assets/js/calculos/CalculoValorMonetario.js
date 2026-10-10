import { CalculoMonetario } from './CalculoMonetario.js';

/** Convierte un valor en un importe normalizado a dos decimales. */
export class CalculoValorMonetario extends CalculoMonetario {
  /**
   * @param {number|string} valor - Valor que se desea normalizar.
   * @returns {number} Valor monetario redondeado.
   */
  calcular(valor) {
    return this.redondear(valor);
  }
}
