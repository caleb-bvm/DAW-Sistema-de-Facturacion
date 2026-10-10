import test from 'node:test';
import assert from 'node:assert/strict';
import { accessDecision, inNetwork, requestIp, localClock } from '../server/access.js';
import { validateSchedules } from '../server/admin.js';
import { hashPassword, verifyPassword } from '../server/passwords.js';
import { config } from '../server/config.js';

const user = { activo: 1, bloqueado_permanente: 0, rol: 'facturador', remoto: 0 };
const clock = { date: '2026-10-19', time: '08:00:00', weekday: 1 };
const location = { country: 'SV', office: true };
const schedule = [{ dia: 1, inicio: '08:00:00', fin: '17:00:00' }];
const decide = (u = user, c = clock, l = location, s = schedule, b = [], h = []) => accessDecision(u, c, l, s, b, h);
test('incluye el inicio y excluye el final del horario', () => {
  assert.equal(decide(), null); assert.equal(decide(user, { ...clock, time: '07:59:59' }), 'horario'); assert.equal(decide(user, { ...clock, time: '17:00:00' }), 'horario'); assert.equal(decide(user, clock, location, []), 'horario');
});
test('vacaciones incluyen los dos extremos y los festivos bloquean', () => {
  assert.equal(decide(user, clock, location, schedule, [{ inicio: '2026-10-19', fin: '2026-10-19', tipo: 'vacaciones' }]), 'vacaciones');
  assert.equal(decide(user, clock, location, schedule, [], ['2026-10-19']), 'festivo');
});
test('bloqueo permanente prevalece y el remoto exige país permitido', () => {
  assert.equal(decide({ ...user, bloqueado_permanente: 1 }), 'permanente'); assert.equal(decide({ ...user, activo: 0 }), 'inactivo');
  assert.equal(decide(user, clock, { country: 'SV', office: false }), 'red'); assert.equal(decide({ ...user, remoto: 1 }, clock, { country: 'SV', office: false }), null);
  assert.equal(decide({ ...user, remoto: 1 }, clock, { country: 'GT', office: false }), 'pais'); assert.equal(decide(user, clock, { country: null, office: true }), 'ubicacion_desconocida');
});
test('administrador omite horarios y festivos, pero respeta ubicación y bloqueos', () => {
  const admin = { ...user, rol: 'administrador' }; assert.equal(decide(admin, clock, location, [], [], [clock.date]), null);
  assert.equal(decide(admin, clock, { country: 'GT', office: true }, []), 'pais'); assert.equal(decide({ ...admin, bloqueado_permanente: 1 }), 'permanente');
});
test('CIDR IPv4, IPv6 y direcciones IPv4 representadas en IPv6', () => {
  assert.equal(inNetwork('192.0.2.5', '192.0.2.0/24'), true); assert.equal(inNetwork('192.0.3.5', '192.0.2.0/24'), false);
  assert.equal(inNetwork('2001:db8::5', '2001:db8::/32'), true); assert.equal(inNetwork('2001:db9::5', '2001:db8::/32'), false);
  assert.equal(inNetwork('::ffff:127.0.0.1', '127.0.0.1/32'), true); assert.equal(inNetwork('127.0.0.1', '127.0.0.1/99'), false);
});
test('ignora IP reenviada por un cliente y recorre sólo proxies confiables', () => {
  const old = config.trustedProxies; config.trustedProxies = ['192.0.2.0/24'];
  try { assert.equal(requestIp({ socket: { remoteAddress: '198.51.100.8' }, headers: { 'x-forwarded-for': '127.0.0.1' } }), '198.51.100.8'); assert.equal(requestIp({ socket: { remoteAddress: '192.0.2.9' }, headers: { 'x-forwarded-for': '127.0.0.1, 198.51.100.8' } }), '198.51.100.8'); }
  finally { config.trustedProxies = old; }
});
test('la zona horaria de El Salvador decide la fecha, independientemente de UTC', () => {
  assert.deepEqual(localClock(new Date('2026-10-20T00:30:00Z')), { date: '2026-10-19', time: '18:30:00', weekday: 1 });
});
test('horarios partidos válidos y rechazo de solapamientos o horas imposibles', () => {
  assert.equal(validateSchedules([{ dia: 1, inicio: '08:00', fin: '12:00' }, { dia: 1, inicio: '13:00', fin: '17:00' }]).length, 2);
  assert.throws(() => validateSchedules([{ dia: 1, inicio: '08:00', fin: '12:00' }, { dia: 1, inicio: '11:00', fin: '17:00' }])); assert.throws(() => validateSchedules([{ dia: 1, inicio: '25:00', fin: '26:00' }]));
});
test('scrypt usa sal distinta, comprueba claves y rechaza contraseñas antiguas en texto plano', async () => {
  const one = await hashPassword('contraseña-de-prueba'); const two = await hashPassword('contraseña-de-prueba'); assert.notEqual(one, two);
  assert.equal(await verifyPassword('contraseña-de-prueba', one), true); assert.equal(await verifyPassword('incorrecta', one), false); assert.equal(await verifyPassword('password', 'password'), false);
});
