import { Calculo } from './Calculo.js';
import { obtenerAniversario } from '../utilidades/fechas.js';

export class CalculoCumpleanos extends Calculo {
  calcular({ fechaNacimiento, fechaActual }) {
    const distancias = [-1, 0, 1].map((desplazamiento) => {
      const cumpleanos = obtenerAniversario(fechaNacimiento, fechaActual.getFullYear() + desplazamiento);
      return Math.round((cumpleanos - fechaActual) / 86400000);
    }).sort((a, b) => Math.abs(a) - Math.abs(b));
    const mensajes = {
      0: '¡Feliz cumpleaños! Que tengas un excelente día.',
      1: 'Solo falta un día para tu celebración.',
      '-1': 'Esperamos que la celebración de ayer haya sido fantástica.'
    };
    return mensajes[distancias[0]] ?? null;
  }
}
