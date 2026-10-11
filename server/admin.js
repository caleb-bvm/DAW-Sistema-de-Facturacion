import { existsSync } from 'node:fs';
import { config } from './config.js';
import { query, transaction } from './db.js';
import { integer, textValue, requireValue, validDate, flag, validEmail, object } from './validation.js';
import { hashPassword } from './passwords.js';
import { revokeSessions, localClock } from './access.js';
import { audit } from './invoices.js';
import { adminAlertEmail } from './settings.js';

export async function saveClient(data, user) {
  const name = textValue(data, 'nombre'); const email = textValue(data, 'correo', 254); requireValue(validEmail(email), 'Correo del cliente inválido.');
  const taxpayer = flag(data, 'contribuyente'); const nit = textValue(data, 'nit', 20, false); const nrc = textValue(data, 'nrc', 20, false);
  const activity = textValue(data, 'actividad', 160, false); const address = textValue(data, 'direccion', 250, false);
  requireValue(!nit || /^(?:\d{8}|\d{14}|\d{4}-\d{6}-\d{3}-\d)$/.test(nit), 'Revisa el formato del NIT.');
  requireValue(!nrc || /^\d{1,8}(?:-\d)?$/.test(nrc), 'Revisa el formato del NRC.');
  requireValue(!taxpayer || (nit && nrc && activity && address), 'El contribuyente requiere NIT, NRC, actividad y dirección.');
  const values = [name, email, nit, nrc, activity, address, textValue(data, 'telefono', 30, false), taxpayer]; let id = integer(data.id ?? 0, 0);
  if (id) { const [exists] = await query('SELECT id FROM clientes WHERE id=?', [id]); requireValue(exists, 'Cliente no encontrado.', 404); await query('UPDATE clientes SET nombre=?,correo=?,nit=?,nrc=?,actividad=?,direccion=?,telefono=?,contribuyente=? WHERE id=?', [...values, id]); }
  else id = Number((await query('INSERT INTO clientes (nombre,correo,nit,nrc,actividad,direccion,telefono,contribuyente) VALUES (?,?,?,?,?,?,?,?)', values)).insertId);
  await audit(user.id, 'guardar_cliente', id); return { id };
}
export async function adminData() {
  const [users, schedules, blocks, holidays, attempts, emails, events, alertEmail] = await Promise.all([
    query('SELECT id,nombre,usuario,correo,fecha_nacimiento,rol,activo,bloqueado_permanente,remoto,motivo_bloqueo FROM vendedores ORDER BY nombre'),
    query('SELECT * FROM horarios_acceso ORDER BY vendedor_id,dia,inicio'), query('SELECT b.*,v.nombre FROM bloqueos_acceso b JOIN vendedores v ON v.id=b.vendedor_id ORDER BY b.inicio DESC'),
    query('SELECT * FROM festivos ORDER BY fecha'), query('SELECT TOP (200) * FROM intentos_acceso ORDER BY id DESC'),
    query('SELECT TOP (200) id,factura_id,tipo,destinatario,estado,intentos,error,updated_at FROM correos ORDER BY id DESC'),
    query('SELECT TOP (200) a.*,v.nombre FROM auditoria a JOIN vendedores v ON v.id=a.vendedor_id ORDER BY a.id DESC'),
    adminAlertEmail(),
  ]);
  const displayTime = (value) => { const c = localClock(new Date(value.replace(' ', 'T') + 'Z')); return `${c.date} ${c.time}`; };
  return { usuarios: users, horarios: schedules, bloqueos: blocks, festivos: holidays, intentos: attempts.map((row) => ({ ...row, fecha: displayTime(row.fecha) })), correos: emails.map((row) => ({ ...row, updated_at: displayTime(row.updated_at) })), auditoria: events.map((row) => ({ ...row, fecha: displayTime(row.fecha) })), configuracion: { pais: config.country, zona_horaria: config.timezone, redes: config.officeNetworks, smtp_configurado: validEmail(config.mailFrom), alertas_configuradas: validEmail(alertEmail), correo_alertas: alertEmail, pdf_disponible: true, geoip_disponible: Boolean(config.geoipDatabase && existsSync(config.geoipDatabase)), emisor: config.company } };
}
export async function saveUser(data, actor) {
  let id = integer(data.id ?? 0, 0); const name = textValue(data, 'nombre', 120); const username = textValue(data, 'usuario', 50);
  requireValue(/^[a-zA-Z0-9._-]{3,50}$/.test(username), 'Usuario inválido: usa de 3 a 50 letras, números, puntos o guiones.');
  const email = data.correo === undefined ? undefined : textValue(data, 'correo', 254, false);
  requireValue(email === undefined || !email || validEmail(email), 'Correo del usuario inválido.');
  const birth = textValue(data, 'fecha_nacimiento', 10); requireValue(validDate(birth) && birth <= localClock().date, 'Fecha de nacimiento inválida.');
  const role = data.rol; requireValue(['administrador', 'facturador'].includes(role), 'Rol inválido.');
  const active = flag(data, 'activo'); const permanent = flag(data, 'bloqueado_permanente'); const remote = flag(data, 'remoto');
  const reason = textValue(data, 'motivo_bloqueo', 180, false); const password = data.clave ?? '';
  requireValue(typeof password === 'string' && password.length <= 200 && ((id && !password) || password.length >= 12), 'La contraseña debe tener de 12 a 200 caracteres.');
  requireValue(id !== Number(actor.id) || (active && !permanent && role === 'administrador'), 'No puedes desactivar ni quitar el rol a tu propia cuenta administradora.');
  const hash = password ? await hashPassword(password) : null;
  return transaction(async (connection) => {
    const admins = await query("SELECT id FROM vendedores WITH (UPDLOCK,HOLDLOCK) WHERE rol='administrador' AND activo=1 AND bloqueado_permanente=0", [], connection);
    requireValue(!admins.some((row) => Number(row.id) === id) || admins.length > 1 || (active && !permanent && role === 'administrador'), 'Debe quedar un administrador activo.');
    const values = [name, username, birth, role, active, permanent, remote, reason];
    if (id) {
      const [existing] = await query('SELECT id,correo FROM vendedores WHERE id=?', [id], connection); requireValue(existing, 'Usuario no encontrado.', 404);
      await query('UPDATE vendedores SET nombre=?,usuario=?,fecha_nacimiento=?,rol=?,activo=?,bloqueado_permanente=?,remoto=?,motivo_bloqueo=?,correo=? WHERE id=?', [...values, email === undefined ? existing.correo : email || null, id], connection);
      if (hash) await query('UPDATE vendedores SET clave=? WHERE id=?', [hash, id], connection); if (id !== Number(actor.id)) await revokeSessions(id, connection); else if (hash) await query('DELETE FROM sesiones WHERE vendedor_id=? AND id<>?', [id,actor.sesion_id], connection);
    } else {
      id = Number((await query('INSERT INTO vendedores (nombre,usuario,fecha_nacimiento,rol,activo,bloqueado_permanente,remoto,motivo_bloqueo,clave,correo) VALUES (?,?,?,?,?,?,?,?,?,?)', [...values, hash, email || null], connection)).insertId);
      for (let day = 1; day <= 5; day++) await query("INSERT INTO horarios_acceso (vendedor_id,dia,inicio,fin) VALUES (?,?,'08:00:00','17:00:00')", [id, day], connection);
    }
    await audit(actor.id, 'guardar_usuario', id, connection, {usuario:username,rol:role,activo:active,bloqueado_permanente:permanent,remoto:remote,clave_actualizada:Boolean(hash)}); return { id };
  });
}
export function validateSchedules(rows) {
  requireValue(Array.isArray(rows) && rows.length <= 35, 'Máximo 35 intervalos.'); const valid = [];
  for (const row of rows) {
    requireValue(object(row), 'Horario inválido.'); const day = integer(row.dia, 1, 7); const start = textValue(row, 'inicio', 5); const end = textValue(row, 'fin', 5);
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    requireValue(timePattern.test(start) && timePattern.test(end) && start < end, 'Revisa el horario: inicio anterior a fin, dentro del mismo día.');
    requireValue(!valid.some((old) => old.dia === day && end > old.inicio && start < old.fin), 'Hay intervalos superpuestos.'); valid.push({ dia: day, inicio: start, fin: end });
  }
  return valid;
}
export async function adminAction(action, data, actor) {
  if (action === 'user') return saveUser(data, actor);
  if ((action === 'block' && data.tipo === 'permanente') || action === 'unblock-permanent') {
    const id = integer(data.vendedor_id); const blocked = action === 'block';
    requireValue(!blocked || id !== Number(actor.id), 'No puedes bloquear permanentemente tu propia cuenta.');
    const reason = blocked ? textValue(data, 'motivo', 180) : '';
    await transaction(async (connection) => {
      const admins = await query("SELECT id FROM vendedores WITH (UPDLOCK,HOLDLOCK) WHERE rol='administrador' AND activo=1 AND bloqueado_permanente=0", [], connection);
      const [user] = await query('SELECT id FROM vendedores WITH (UPDLOCK,HOLDLOCK) WHERE id=?', [id], connection);
      requireValue(user, 'Usuario no encontrado.', 404);
      requireValue(!blocked || !admins.some(row => Number(row.id) === id) || admins.length > 1, 'Debe quedar un administrador activo.');
      await query('UPDATE vendedores SET bloqueado_permanente=?,motivo_bloqueo=? WHERE id=?', [Number(blocked), reason, id], connection);
      await revokeSessions(id, connection);
      await audit(actor.id, blocked ? 'bloquear_permanente' : 'quitar_bloqueo_permanente', id, connection, {motivo:reason});
    });
    return { ok: true };
  }
  if (action === 'mail-settings') {
    const email = textValue(data, 'correo_alertas', 254);
    requireValue(validEmail(email), 'Correo de alertas inválido.');
    await transaction(async (connection) => {
      const previous = await query('SELECT clave FROM configuracion WITH (UPDLOCK,HOLDLOCK) WHERE clave=?', ['correo_alertas'], connection);
      if (previous.length) await query('UPDATE configuracion SET valor=? WHERE clave=?', [email, 'correo_alertas'], connection);
      else await query('INSERT INTO configuracion (clave,valor) VALUES (?,?)', ['correo_alertas', email], connection);
      await audit(actor.id, 'guardar_correo_alertas', 'correo_alertas', connection);
    });
  } else if (action === 'schedule') {
    const id = integer(data.vendedor_id); const rows = validateSchedules(data.horarios);
    await transaction(async (connection) => {
      const [user] = await query('SELECT id FROM vendedores WITH (UPDLOCK,HOLDLOCK) WHERE id=?', [id], connection); requireValue(user, 'Usuario no encontrado.', 404);
      await query('DELETE FROM horarios_acceso WHERE vendedor_id=?', [id], connection);
      for (const row of rows) await query('INSERT INTO horarios_acceso (vendedor_id,dia,inicio,fin) VALUES (?,?,?,?)', [id, row.dia, row.inicio, row.fin], connection);
      if (id !== Number(actor.id)) await revokeSessions(id, connection); await audit(actor.id, 'guardar_horario', id, connection, {horarios:rows});
    });
  } else if (action === 'block') {
    const id = integer(data.vendedor_id); requireValue(id !== Number(actor.id), 'No puedes crear un bloqueo para tu propia cuenta.');
    const type = data.tipo; const start = textValue(data, 'inicio', 10); const end = textValue(data, 'fin', 10);
    requireValue(['vacaciones', 'temporal'].includes(type) && validDate(start) && validDate(end) && start <= end, 'Revisa el período del bloqueo.');
    await transaction(async (connection) => { await query('INSERT INTO bloqueos_acceso (vendedor_id,tipo,inicio,fin,motivo) VALUES (?,?,?,?,?)', [id, type, start, end, textValue(data, 'motivo', 180)], connection); await revokeSessions(id, connection); await audit(actor.id, 'crear_bloqueo', id, connection); });
  } else if (action === 'unblock') {
    const id = integer(data.id); await query('DELETE FROM bloqueos_acceso WHERE id=?', [id]); await audit(actor.id, 'quitar_bloqueo', id);
  } else if (action === 'holiday') {
    const date = textValue(data, 'fecha', 10); requireValue(validDate(date), 'Fecha inválida.');
    if (data.eliminar === true) await query('DELETE FROM festivos WHERE fecha=?', [date]);
    else await transaction(async (connection) => { const name = textValue(data, 'nombre', 120); const previous = await query('SELECT fecha FROM festivos WITH (UPDLOCK,HOLDLOCK) WHERE fecha=?', [date], connection); if (previous.length) await query('UPDATE festivos SET nombre=? WHERE fecha=?', [name,date], connection); else await query('INSERT INTO festivos (fecha,nombre) VALUES (?,?)', [date,name], connection); });
    await audit(actor.id, 'editar_festivo', date);
  } else if (action === 'mail-retry') {
    const id = integer(data.id); await query("UPDATE correos SET estado='pendiente',intentos=0,error=NULL,proximo_intento=SYSUTCDATETIME() WHERE id=? AND estado='fallido'", [id]); await audit(actor.id, 'reintentar_correo', id);
  } else requireValue(false, 'Operación no encontrada.', 404);
  return { ok: true };
}
