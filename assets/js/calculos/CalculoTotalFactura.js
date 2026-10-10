import { CalculoMonetario } from './CalculoMonetario.js';

/** Obtiene el total final de la factura sumando el subtotal y el IVA. */
export class CalculoTotalFactura extends CalculoMonetario {
  /**
   * @param {{subtotal: number|string, iva: number|string}} importes - Componentes del total.
   * @returns {number} Total de la factura redondeado a dos decimales.
   */
  calcular({ subtotal, iva }) {
    return this.redondear(Number(subtotal) + Number(iva));
  }
}
