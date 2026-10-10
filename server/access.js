import { isIP } from 'node:net';
import { existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { open } from 'maxmind';
import { config } from './config.js';
import { isUniqueViolation, query, sqlNow } from './db.js';
import { RequestError } from './validation.js';

export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export const normalizeIp = (ip) => /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip) ? ip.slice(7) : ip;
function ipBytes(value) {
  value = normalizeIp(value);
  const version = isIP(value); if (!version) return null;
  if (version === 4) return Buffer.from(value.split('.').map(Number));
  if (value.includes('.')) {
    const index = value.lastIndexOf(':'); const bytes = value.slice(index + 1).split('.').map(Number);
    value = value.slice(0, index + 1) + ((bytes[0] << 8) | bytes[1]).toString(16) + ':' + ((bytes[2] << 8) | bytes[3]).toString(16);
  }
  const halves = value.split('::'); const left = halves[0] ? halves[0].split(':') : []; const right = halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  const result = Buffer.alloc(16); groups.forEach((group, i) => result.writeUInt16BE(parseInt(group, 16), i * 2)); return result;
}
export function inNetwork(ip, network) {
  if (typeof network !== 'string') return false;
  const [address, rawPrefix, extra] = network.split('/'); const actual = ipBytes(ip); const expected = ipBytes(address);
  if (extra !== undefined || !actual || !expected || actual.length !== expected.length || (rawPrefix !== undefined && !/^\d+$/.test(rawPrefix))) return false;
  const prefix = rawPrefix === undefined ? actual.length * 8 : Number(rawPrefix);
  if (prefix < 0 || prefix > actual.length * 8) return false;
  for (let i = 0; i < actual.length; i++) {
    const bits = Math.min(8, Math.max(0, prefix - i * 8)); const mask = bits ? (255 << (8 - bits)) & 255 : 0;
    if ((actual[i] & mask) !== (expected[i] & mask)) return false;
  }
  return true;
}
export const matchesNetworks = (ip, networks) => networks.some((network) => inNetwork(ip, network));
export function requestIp(request) {
  const remote = normalizeIp(request.socket.remoteAddress || '0.0.0.0');
  if (!matchesNetworks(remote, config.trustedProxies)) return remote;
  const chain = String(request.headers['x-forwarded-for'] || '').split(',').map((ip) => normalizeIp(ip.trim())); chain.push(remote);
  while (chain.length > 1 && matchesNetworks(chain.at(-1), config.trustedProxies)) chain.pop();
  return isIP(chain.at(-1)) ? chain.at(-1) : remote;
}
let geoipReader;
export async function locationFor(ip) {
  const office = matchesNetworks(ip, config.officeNetworks);
  const local = config.environment === 'development' && ['127.0.0.1', '::1'].includes(ip);
  if (office || local) return { ip, country: config.country, office: true, source: local ? 'desarrollo local' : 'red autorizada' };
  let country = null;
  if (config.geoipDatabase && existsSync(config.geoipDatabase)) {
    try { geoipReader ??= open(config.geoipDatabase); country = (await geoipReader).get(ip)?.country?.iso_code || null; }
    catch { geoipReader = undefined; console.error('No se pudo consultar la base GeoIP.'); }
  }
  return { ip, country, office: false, source: 'GeoIP (aproximada)' };
}
export function localClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = `${p.year}-${p.month}-${p.day}`;
  return { date: day, time: `${p.hour}:${p.minute}:${p.second}`, weekday: new Date(`${day}T00:00:00Z`).getUTCDay() || 7 };
}
export function accessDecision(user, clock, location, schedules, blocks, holidays) {
  if (Number(user.bloqueado_permanente)) return 'permanente'; if (!Number(user.activo)) return 'inactivo';
  for (const block of blocks) if (clock.date >= block.inicio && clock.date <= block.fin) return block.tipo;
  if (user.rol !== 'administrador') {
    if (holidays.includes(clock.date)) return 'festivo';
    if (!schedules.some((schedule) => Number(schedule.dia) === clock.weekday && clock.time >= schedule.inicio && clock.time < schedule.fin)) return 'horario';
  }
  if (!location.country) return 'ubicacion_desconocida'; if (location.country !== config.country) return 'pais';
  if (!location.office && !Number(user.remoto)) return 'red'; return null;
}
export async function restriction(user, location) {
  const [schedules, blocks, holidays] = await Promise.all([
    query('SELECT dia,inicio,fin FROM horarios_acceso WHERE vendedor_id=?', [user.id]),
    query('SELECT inicio,fin,tipo FROM bloqueos_acceso WHERE vendedor_id=?', [user.id]), query('SELECT fecha FROM festivos'),
  ]);
  return accessDecision(user, localClock(), location, schedules, blocks, holidays.map((row) => row.fecha));
}
export async function recordAttempt(username, userId, reason, location) {
  const result = await query('INSERT INTO intentos_acceso (vendedor_id,usuario,ip,pais,fuente,motivo,fecha) VALUES (?,?,?,?,?,?,?)', [userId, username.slice(0, 50), location.ip, location.country, location.source, reason, sqlNow()]);
  if (!config.adminEmail) return;
  const key = tokenHash(`${username}|${location.ip}|${reason}|${Math.floor(Date.now() / 300000)}`);
  const clock = localClock(); const body = `Intento rechazado.\nUsuario: ${username}\nFecha: ${clock.date} ${clock.time} (${config.timezone})\nIP: ${location.ip}\nPaís: ${location.country || 'Desconocido'}\nFuente: ${location.source}\nMotivo: ${reason}`;
  try { await query("INSERT INTO correos (tipo,destinatario,asunto,cuerpo,clave_unica,intento_id) VALUES ('alerta',?,?,?,?,?)", [config.adminEmail, 'Alerta de acceso al sistema', body, key, result.insertId]); } catch (error) { if (!isUniqueViolation(error)) throw error; }
}
export function publicUser(user) { return Object.fromEntries(['id', 'nombre', 'usuario', 'fecha_nacimiento', 'rol'].map((key) => [key, user[key]])); }
export async function revokeSessions(id, connection) { await query('DELETE FROM sesiones WHERE vendedor_id=?', [id], connection); }
export function readToken(request) {
  const cookie = String(request.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('facturacion_session='));
  const token = cookie?.slice('facturacion_session='.length) || ''; return /^[a-f0-9]{64}$/.test(token) ? token : '';
}
export function sessionCookie(token, clear = false) {
  return `facturacion_session=${token}; Path=${config.basePath || '/' }; HttpOnly; SameSite=Lax${config.environment === 'production' ? '; Secure' : ''}${clear ? '; Max-Age=0' : ''}`;
}
export async function createSession(userId, oldToken) {
  if (oldToken) await query('DELETE FROM sesiones WHERE token_hash=?', [tokenHash(oldToken)]);
  const token = randomBytes(32).toString('hex'); const csrf = randomBytes(32).toString('hex');
  await query('INSERT INTO sesiones (vendedor_id,token_hash,csrf,ultima_actividad) VALUES (?,?,?,?)', [userId, tokenHash(token), csrf, sqlNow()]); return { token, csrf };
}
export async function requireSession(request) {
  const token = readToken(request); if (!token) throw new RequestError('Inicia sesión para continuar.', 401);
  const [user] = await query('SELECT v.*,s.id sesion_id,s.csrf,s.ultima_actividad FROM sesiones s JOIN vendedores v ON v.id=s.vendedor_id WHERE s.token_hash=?', [tokenHash(token)]);
  if (!user || Date.parse(user.ultima_actividad.replace(' ', 'T') + 'Z') < Date.now() - config.sessionMinutes * 60000) {
    await query('DELETE FROM sesiones WHERE token_hash=?', [tokenHash(token)]); throw new RequestError('La sesión venció. Ingresa nuevamente.', 401);
  }
  const location = await locationFor(requestIp(request)); const reason = await restriction(user, location);
  if (reason) { await revokeSessions(user.id); await recordAttempt(user.usuario, user.id, reason, location); throw new RequestError(reason === 'permanente' ? 'Tu cuenta está bloqueada permanentemente. Contacta al administrador.' : 'Tu acceso no está permitido en este momento.', 401); }
  await query('UPDATE sesiones SET ultima_actividad=? WHERE id=?', [sqlNow(), user.sesion_id]); return user;
}
