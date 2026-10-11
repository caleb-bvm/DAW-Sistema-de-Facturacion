import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { query, pool } from '../server/db.js';
import { config } from '../server/config.js';
import { setUserCredentials } from '../server/user-credentials.js';

let rl;
let muted = false;
const cancellation = new AbortController();
const question = (prompt) => rl.question(prompt, { signal: cancellation.signal });
try {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Ejecuta npm.cmd run acceso desde una terminal interactiva.');
  console.log('\nAcceso al sistema de facturación');
  console.log(`Base de datos: ${process.env.DB_NAME || 'facturacion_db'}`);
  const users = await query('SELECT usuario,nombre,rol,activo,bloqueado_permanente FROM vendedores ORDER BY usuario');
  if (users.length) console.table(users);
  else console.log('Todavía no hay usuarios. Vamos a crear uno.');

  const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
  rl = createInterface({ input: process.stdin, output, terminal: true });
  rl.on('SIGINT', () => cancellation.abort());
  const username = (await question('Usuario que quieres crear o actualizar [admin]: ')).trim() || 'admin';
  const [existing] = await query('SELECT rol FROM vendedores WHERE usuario=?', [username]);
  if (existing) {
    console.log(`Rol actual: ${existing.rol}. Se conservará al cambiar la contraseña.`);
    console.log('La contraseña anterior dejará de funcionar y se cerrarán las sesiones de esta cuenta.');
    const confirmation = await question('Escribe CAMBIAR para restablecerla (Enter cancela): ');
    if (confirmation.trim() !== 'CAMBIAR') { console.log('Sin cambios.'); rl.close(); }
    else await save(username, true);
  } else {
    const defaultRole = users.some((user) => user.rol === 'administrador') ? 'facturador' : 'administrador';
    const role = (await question(`Rol de la cuenta nueva: administrador / facturador [${defaultRole}]: `)).trim() || defaultRole;
    if (!['administrador', 'facturador'].includes(role)) throw new Error('Elige administrador o facturador. No se creó la cuenta.');
    await save(username, false, role);
  }
} catch (error) {
  muted = false;
  if (error.name === 'AbortError') console.log('\nOperación cancelada. Sin cambios.');
  else {
    console.error(`\nNo se completó el acceso: ${error.message}`);
    process.exitCode = 1;
  }
} finally { rl?.close(); await pool.end(); }

async function secret(prompt) {
  process.stdout.write(prompt);
  muted = true;
  try { return await question(''); }
  finally { muted = false; process.stdout.write('\n'); }
}

async function save(username, reset, role) {
  let password = await secret('Nueva contraseña (mínimo 12 caracteres; Enter genera una): ');
  const generated = !password;
  if (generated) password = randomBytes(15).toString('base64url');
  else if (password !== await secret('Repite la contraseña: ')) throw new Error('Las contraseñas no coinciden. No se guardó ningún cambio.');
  const result = await setUserCredentials(username, password, { reset, role });
  console.log(`\nCuenta ${result.created ? 'creada' : 'actualizada'}.`);
  console.log(`Usuario: ${username}`);
  console.log(`Rol: ${result.role}`);
  if (generated) console.log(`Contraseña generada: ${password}\nGuárdala ahora; no se podrá consultar después.`);
  console.log(`Abrir: ${config.origin}${config.basePath}/`);
  console.log('Para iniciar el servidor: npm.cmd start');
  if (!result.created) console.log('Se conservan los permisos y bloqueos existentes de la cuenta.');
  else console.log('Completa los datos personales y revisa los horarios en Administración → Usuarios y permisos.');
}
