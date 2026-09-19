import { CalculoMonetario } from './CalculoMonetario.js';

export class CalculoSubtotal extends CalculoMonetario {
  calcular(totalesLinea) {
    return totalesLinea.reduce((total, valor) => this.redondear(total + Number(valor)), 0);
  }
}
