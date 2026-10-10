export class RequestError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
export function requireValue(condition, message, status = 422) { if (!condition) throw new RequestError(message, status); }
export function textValue(data, name, max = 160, required = true) {
  const raw = data[name] ?? ''; requireValue(typeof raw === 'string', `Campo inválido: ${name}.`);
  const value = raw.trim(); requireValue((!required || value !== '') && [...value].length <= max, `Revisa el campo ${name}.`); return value;
}
export function integer(value, min = 1, max = Number.MAX_SAFE_INTEGER) {
  requireValue(typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)), 'Se requiere un número entero.');
  const result = Number(value); requireValue(Number.isSafeInteger(result) && result >= min && result <= max, 'Número fuera del rango permitido.'); return result;
}
export function flag(data, name) { const value = data[name] ?? false; requireValue([true, false, 0, 1].includes(value), `Opción inválida: ${name}.`); return Number(value); }
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function validEmail(value) { return typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value); }
export function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
