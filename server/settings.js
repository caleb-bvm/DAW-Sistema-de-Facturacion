import { config } from './config.js';
import { query } from './db.js';

export async function adminAlertEmail() {
  const [setting] = await query('SELECT valor FROM configuracion WHERE clave=?', ['correo_alertas']);
  return setting ? setting.valor : config.adminEmail;
}
