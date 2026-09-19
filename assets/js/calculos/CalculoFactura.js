import { Calculo } from './Calculo.js';

/** Coordina objetos distintos mediante el método polimórfico calcular(). */
export class CalculoFactura extends Calculo {
  constructor({ totalLinea, subtotal, iva, totalFactura, comision }) {
    super();
    this.calculadores = { totalLinea, subtotal, iva, totalFactura, comision };
  }

  calcular(lineas) {
    const totalesLinea = lineas.map((linea) => this.calculadores.totalLinea.calcular(linea));
    const subtotal = this.calculadores.subtotal.calcular(totalesLinea);
    const iva = this.calculadores.iva.calcular(subtotal);
    const total = this.calculadores.totalFactura.calcular({ subtotal, iva });
    const comision = this.calculadores.comision.calcular(subtotal);
    return { totalesLinea, subtotal, iva, total, porcentajeComision: comision.porcentaje, comision: comision.monto };
  }
}
