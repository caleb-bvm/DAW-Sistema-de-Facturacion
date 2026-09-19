import { CalculoMonetario } from './CalculoMonetario.js';

export class CalculoTotalLinea extends CalculoMonetario {
  calcular({ precio, cantidad }) {
    return this.redondear(Number(precio) * Number(cantidad));
  }
}
