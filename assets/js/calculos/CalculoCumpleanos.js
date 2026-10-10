import { Calculo } from './Calculo.js';
import { obtenerAniversario } from '../utilidades/fechas.js';

/** Determina si corresponde mostrar un mensaje cercano al cumpleaños de una persona. */
export class CalculoCumpleanos extends Calculo {
  /**
   * @param {{fechaNacimiento: Date, fechaActual: Date}} fechas - Fechas usadas en la comparación.
   * @returns {string|null} Mensaje para ayer, hoy o mañana; null en cualquier otro caso.
   */
  calcular({ fechaNacimiento, fechaActual }) {
    // Compara los cumpleaños de los años cercanos para encontrar el más próximo.
    const distancias = [-1, 0, 1].map((desplazamiento) => {
      const cumpleanos = obtenerAniversario(fechaNacimiento, fechaActual.getFullYear() + desplazamiento);
      return Math.round((cumpleanos - fechaActual) / 86400000);
    }).sort((a, b) => Math.abs(a) - Math.abs(b));

    // Cada clave representa la cantidad de días hasta o desde el cumpleaños.
    const mensajes = {
      0: '¡Feliz cumpleaños! Que tengas un excelente día.',
      1: 'Solo falta un día para tu celebración.',
      '-1': 'Esperamos que la celebración de ayer haya sido fantástica.'
    };
    return mensajes[distancias[0]] ?? null;
  }
}
