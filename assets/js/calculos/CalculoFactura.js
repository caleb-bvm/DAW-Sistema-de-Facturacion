import { Calculo } from './Calculo.js';

/** Coordina los cálculos que componen una factura mediante el método polimórfico calcular(). */
export class CalculoFactura extends Calculo {
  /**
   * @param {Object} calculadores - Dependencias encargadas de cada operación de la factura.
   */
  constructor({ totalLinea, subtotal, iva, totalFactura, comision }) {
    super();
    this.calculadores = { totalLinea, subtotal, iva, totalFactura, comision };
  }

  /**
   * Ejecuta los cálculos en el orden requerido para construir el resumen de la factura.
   * @param {Array<{precio: number|string, cantidad: number|string}>} lineas - Detalles facturados.
   * @returns {Object} Totales por línea, subtotal, IVA, total y comisión.
   */
  calcular(lineas) {
    const totalesLinea = lineas.map((linea) => this.calculadores.totalLinea.calcular(linea));
    const impuestosLinea = lineas.map((linea, i) => this.calculadores.iva.calcular(totalesLinea[i], linea.clasificacion));
    const basesLinea = totalesLinea.map((total, i) => (Math.round(total * 100) - Math.round(impuestosLinea[i] * 100)) / 100);
    const comisionesLinea = basesLinea.map((base) => this.calculadores.comision.calcular(base));
    const subtotal = this.calculadores.subtotal.calcular(basesLinea);
    const iva = this.calculadores.subtotal.calcular(impuestosLinea);
    const total = this.calculadores.totalFactura.calcular({ subtotal, iva });
    const comision = this.calculadores.subtotal.calcular(comisionesLinea.map((item) => item.monto));
    return { totalesLinea, basesLinea, impuestosLinea, comisionesLinea, subtotal, iva, total, comision };
  }
}
