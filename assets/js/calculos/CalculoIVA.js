import { CalculoMonetario } from './CalculoMonetario.js';

export class CalculoIVA extends CalculoMonetario {
  constructor(porcentaje = 13) {
    super();
    this.porcentaje = porcentaje;
  }

  calcular(subtotal) {
    return this.redondear(Number(subtotal) * this.porcentaje / 100);
  }
}
