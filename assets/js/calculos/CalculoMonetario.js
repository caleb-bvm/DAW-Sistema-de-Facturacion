import { Calculo } from './Calculo.js';

/** Base para cálculos cuyos resultados deben conservar precisión monetaria. */
export class CalculoMonetario extends Calculo {
  /**
   * Normaliza un valor numérico a dos decimales.
   * @param {number|string} valor - Valor que se desea redondear.
   * @returns {number} Valor redondeado a centavos.
   */
  redondear(valor) {
    // EPSILON compensa errores binarios mínimos antes de aplicar el redondeo.
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  }
}
