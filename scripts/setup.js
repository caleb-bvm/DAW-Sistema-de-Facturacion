import { query, transaction, pool } from '../server/db.js';
import { hashPassword } from '../server/passwords.js';

try {
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  await transaction(async (connection) => {
    const users = await query('SELECT id,clave FROM vendedores WITH (UPDLOCK,HOLDLOCK)', [], connection);
    for (const user of users) {
      if (user.clave.startsWith('scrypt$')) continue;
      if (user.clave.startsWith('$2') || user.clave.startsWith('$argon')) throw new Error('Hay hashes PHP existentes. Restablece esas contraseñas antes de migrar a scrypt; no se convertirán como texto.');
      await query('UPDATE vendedores SET clave=? WHERE id=?', [await hashPassword(user.clave), user.id], connection);
    }
    const [existing] = await query('SELECT id FROM vendedores WHERE usuario=?', ['admin'], connection);
    if (!existing) {
      if (password.length < 12 || password.length > 200) throw new Error('Para elegir tus credenciales ejecuta npm.cmd run acceso. Para instalación automática, define BOOTSTRAP_ADMIN_PASSWORD con entre 12 y 200 caracteres.');
      await query("INSERT INTO vendedores (nombre,usuario,clave,fecha_nacimiento,rol) VALUES ('Administrador','admin',?,'1990-01-01','administrador')", [await hashPassword(password)], connection);
    }
  });
  console.log('Contraseñas protegidas y cuenta admin inicializada. La cuenta existente no se sobrescribe.');
} finally { await pool.end(); }
