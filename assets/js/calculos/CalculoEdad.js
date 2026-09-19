import { Calculo } from './Calculo.js';
import { obtenerAniversario } from '../utilidades/fechas.js';

export class CalculoEdad extends Calculo {
  calcular({ fechaNacimiento, fechaActual }) {
    let anios = fechaActual.getFullYear() - fechaNacimiento.getFullYear();
    let cursor = obtenerAniversario(fechaNacimiento, fechaNacimiento.getFullYear() + anios);
    if (cursor > fechaActual) {
      anios--;
      cursor = obtenerAniversario(fechaNacimiento, fechaNacimiento.getFullYear() + anios);
    }
    let meses = 0;
    while (meses < 11) {
      const siguiente = new Date(cursor);
      siguiente.setMonth(siguiente.getMonth() + 1);
      if (siguiente > fechaActual) break;
      cursor = siguiente;
      meses++;
    }
    const diasRestantes = Math.floor((fechaActual - cursor) / 86400000);
    return { anios, meses, semanas: Math.floor(diasRestantes / 7), dias: diasRestantes % 7 };
  }
}
