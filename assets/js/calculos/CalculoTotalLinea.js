import { CalculoMonetario } from './CalculoMonetario.js';

/** Calcula el importe de una línea a partir del precio y la cantidad. */
export class CalculoTotalLinea extends CalculoMonetario {
  /**
   * @param {{precio: number|string, cantidad: number|string}} linea - Datos del producto facturado.
   * @returns {number} Importe de la línea redondeado a dos decimales.
   */
  calcular({ precio, cantidad, descuento = 0 }) {
    return (Math.round(Number(precio) * 100) * Number(cantidad) - Math.round(Number(descuento) * 100)) / 100;
  }
}
