import { CalculoMonetario } from './CalculoMonetario.js';

export class CalculoTotalFactura extends CalculoMonetario {
  calcular({ subtotal, iva }) {
    return this.redondear(Number(subtotal) + Number(iva));
  }
}
