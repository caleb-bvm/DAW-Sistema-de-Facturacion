import { Calculo } from './Calculo.js';
import { obtenerAniversario } from '../utilidades/fechas.js';

/** Descompone la edad transcurrida en años, meses, semanas y días. */
export class CalculoEdad extends Calculo {
  /**
   * Calcula la edad completa entre una fecha de nacimiento y una fecha de referencia.
   * @param {{fechaNacimiento: Date, fechaActual: Date}} fechas - Extremos del período a calcular.
   * @returns {{anios: number, meses: number, semanas: number, dias: number}} Edad desglosada.
   */
  calcular({ fechaNacimiento, fechaActual }) {
    // Primero determina los años completos y retrocede uno si el aniversario aún no ocurrió.
    let anios = fechaActual.getFullYear() - fechaNacimiento.getFullYear();
    let cursor = obtenerAniversario(fechaNacimiento, fechaNacimiento.getFullYear() + anios);
    if (cursor > fechaActual) {
      anios--;
      cursor = obtenerAniversario(fechaNacimiento, fechaNacimiento.getFullYear() + anios);
    }
    // Avanza desde el último aniversario para contar únicamente meses completos.
    let meses = 0;
    while (meses < 11) {
      const siguiente = new Date(cursor);
      siguiente.setMonth(siguiente.getMonth() + 1);
      if (siguiente > fechaActual) break;
      cursor = siguiente;
      meses++;
    }
    // El residuo final se expresa en semanas completas y días sobrantes.
    const diasRestantes = Math.floor((fechaActual - cursor) / 86400000);
    return { anios, meses, semanas: Math.floor(diasRestantes / 7), dias: diasRestantes % 7 };
  }
}
