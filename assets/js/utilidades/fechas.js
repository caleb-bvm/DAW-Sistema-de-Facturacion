export function crearFechaLocal(fechaIso) {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

export function obtenerFechaActualIso() {
  const hoy = new Date();
  const diferencia = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy - diferencia).toISOString().slice(0, 10);
}

export function obtenerDiasDelMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

export function obtenerAniversario(fechaNacimiento, anio) {
  const dia = Math.min(fechaNacimiento.getDate(), obtenerDiasDelMes(anio, fechaNacimiento.getMonth()));
  return new Date(anio, fechaNacimiento.getMonth(), dia);
}
