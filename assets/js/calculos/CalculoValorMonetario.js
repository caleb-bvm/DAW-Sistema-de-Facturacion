import { CalculoMonetario } from './CalculoMonetario.js';

export class CalculoValorMonetario extends CalculoMonetario {
  calcular(valor) {
    return this.redondear(valor);
  }
}
