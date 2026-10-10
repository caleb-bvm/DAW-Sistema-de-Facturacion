/**
 * Define el contrato común que deben cumplir todos los cálculos del sistema.
 * Las clases derivadas sobrescriben calcular() con su lógica específica.
 */
export class Calculo {
  /**
   * Ejecuta el cálculo correspondiente.
   * @throws {Error} Si una clase derivada no implementa este método.
   */
  calcular() {
    throw new Error('Cada cálculo debe implementar su propio método calcular().');
  }
}
