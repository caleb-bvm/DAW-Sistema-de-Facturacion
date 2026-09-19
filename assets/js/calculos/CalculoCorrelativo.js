import { Calculo } from './Calculo.js';

export class CalculoCorrelativo extends Calculo {
  constructor(prefijo, cantidadDigitos) {
    super();
    this.prefijo = prefijo;
    this.cantidadDigitos = cantidadDigitos;
  }

  calcular(codigosExistentes) {
    const mayor = codigosExistentes.reduce((maximo, codigo) => {
      const numero = Number(String(codigo).replace(`${this.prefijo}-`, ''));
      return Number.isInteger(numero) ? Math.max(maximo, numero) : maximo;
    }, 0);
    return `${this.prefijo}-${String(mayor + 1).padStart(this.cantidadDigitos, '0')}`;
  }
}
