export const formatoMoneda = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });
export const formatoFecha = new Intl.DateTimeFormat('es-SV');

export function escaparHtml(valor) {
  const elemento = document.createElement('div');
  elemento.textContent = String(valor ?? '');
  return elemento.innerHTML;
}
