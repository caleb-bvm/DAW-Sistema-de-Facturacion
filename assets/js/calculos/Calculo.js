/** Contrato común para todos los cálculos del sistema. */
export class Calculo {
  calcular() {
    throw new Error('Cada cálculo debe implementar su propio método calcular().');
  }
}
