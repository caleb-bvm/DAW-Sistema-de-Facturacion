import { Calculo } from './Calculo.js';

/** Genera el siguiente código correlativo para un prefijo y longitud definidos. */
export class CalculoCorrelativo extends Calculo {
  /**
   * @param {string} prefijo - Texto que antecede a la parte numérica del código.
   * @param {number} cantidadDigitos - Longitud mínima de la parte numérica.
   */
  constructor(prefijo, cantidadDigitos) {
    super();
    this.prefijo = prefijo;
    this.cantidadDigitos = cantidadDigitos;
  }

  /**
   * Busca el mayor correlativo válido y genera su sucesor.
   * @param {Array<string|number>} codigosExistentes - Códigos que ya están registrados.
   * @returns {string} Nuevo código con el formato "PREFIJO-000...".
   */
  calcular(codigosExistentes) {
    const mayor = codigosExistentes.reduce((maximo, codigo) => {
      // Quita únicamente el prefijo esperado para aislar la parte numérica.
      const numero = Number(String(codigo).replace(`${this.prefijo}-`, ''));
      // Los códigos no numéricos se ignoran para no alterar la secuencia.
      return Number.isInteger(numero) ? Math.max(maximo, numero) : maximo;
    }, 0);
    return `${this.prefijo}-${String(mayor + 1).padStart(this.cantidadDigitos, '0')}`;
  }
}
