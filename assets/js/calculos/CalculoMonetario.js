import { Calculo } from './Calculo.js';

export class CalculoMonetario extends Calculo {
  redondear(valor) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  }
}
