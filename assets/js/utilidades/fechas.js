/**
 * Convierte una fecha ISO (AAAA-MM-DD) en una fecha del calendario local.
 * Evita que la interpretación UTC desplace el día según la zona horaria.
 * @param {string} fechaIso - Fecha con formato AAAA-MM-DD.
 * @returns {Date} Fecha creada en la zona horaria local.
 */
export function crearFechaLocal(fechaIso) {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  // Date utiliza meses con índice cero: enero es 0 y diciembre es 11.
  return new Date(anio, mes - 1, dia);
}

/**
 * Obtiene la fecha local actual en el formato usado por los controles HTML de fecha.
 * @returns {string} Fecha local con formato AAAA-MM-DD.
 */
export function obtenerFechaActualIso() {
  const hoy = new Date();
  // Compensa el desfase local antes de convertir la fecha a su representación ISO en UTC.
  const diferencia = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy - diferencia).toISOString().slice(0, 10);
}

/**
 * Obtiene la cantidad de días de un mes, incluidos los casos de año bisiesto.
 * @param {number} anio - Año completo.
 * @param {number} mes - Mes con índice cero.
 * @returns {number} Número de días del mes indicado.
 */
export function obtenerDiasDelMes(anio, mes) {
  // El día cero del mes siguiente corresponde al último día del mes solicitado.
  return new Date(anio, mes + 1, 0).getDate();
}

/**
 * Traslada una fecha de nacimiento al aniversario válido de un año determinado.
 * Si el día no existe en ese año, usa el último día disponible del mismo mes.
 * @param {Date} fechaNacimiento - Fecha original que define el mes y el día.
 * @param {number} anio - Año en el que se desea obtener el aniversario.
 * @returns {Date} Fecha local del aniversario.
 */
export function obtenerAniversario(fechaNacimiento, anio) {
  const dia = Math.min(fechaNacimiento.getDate(), obtenerDiasDelMes(anio, fechaNacimiento.getMonth()));
  return new Date(anio, fechaNacimiento.getMonth(), dia);
}
