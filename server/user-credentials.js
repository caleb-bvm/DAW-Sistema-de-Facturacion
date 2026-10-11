import { query, transaction } from './db.js';
import { hashPassword } from './passwords.js';
import { requireValue } from './validation.js';
import { audit } from './invoices.js';

// Sólo para la consola del servidor; no se expone como operación de la API.
export async function setUserCredentials(username, password, { reset = false, role = 'facturador' } = {}) {
  requireValue(typeof username === 'string' && /^[a-zA-Z0-9._-]{3,50}$/.test(username), 'Usuario inválido: usa de 3 a 50 letras, números, puntos o guiones.');
  requireValue(typeof password === 'string' && password.length >= 12 && password.length <= 200, 'La contraseña debe tener de 12 a 200 caracteres.');
  requireValue(['administrador', 'facturador'].includes(role), 'Rol inválido.');
  const hash = await hashPassword(password);
  return transaction(async (connection) => {
    const [existing] = await query('SELECT id,rol FROM vendedores WITH (UPDLOCK,HOLDLOCK) WHERE usuario=?', [username], connection);
    requireValue(!existing || reset, 'La cuenta ya existe. Confirma el restablecimiento para cambiar su contraseña.');
    let id;
    if (existing) {
      id = existing.id;
      await query('UPDATE vendedores SET clave=? WHERE id=?', [hash, id], connection);
      await query('DELETE FROM sesiones WHERE vendedor_id=?', [id], connection);
    } else {
      id = (await query("INSERT INTO vendedores (nombre,usuario,clave,fecha_nacimiento,rol) VALUES (?,?,?,'1990-01-01',?)", [username, username, hash, role], connection)).insertId;
      if (role === 'facturador') {
        for (let day = 1; day <= 5; day++) await query("INSERT INTO horarios_acceso (vendedor_id,dia,inicio,fin) VALUES (?,?,'08:00:00','17:00:00')", [id, day], connection);
      }
    }
    await audit(id, existing ? 'restablecer_clave_consola' : 'crear_usuario_consola', id, connection);
    return { id, created: !existing, role: existing?.rol || role };
  });
}
