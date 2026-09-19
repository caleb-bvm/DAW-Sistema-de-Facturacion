import { CalculoMonetario } from './CalculoMonetario.js';

export class CalculoComision extends CalculoMonetario {
  obtenerPorcentaje(subtotal) {
    if (subtotal <= 100) return 1;
    if (subtotal <= 1000) return 2;
    if (subtotal <= 2000) return 3;
    return 4;
  }

  calcular(subtotal) {
    const porcentaje = this.obtenerPorcentaje(Number(subtotal));
    const monto = this.redondear(Number(subtotal) * porcentaje / 100);
    return { porcentaje, monto };
  }
}
