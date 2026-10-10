import { createTransport } from '../server/mail.js';
import { config } from '../server/config.js';

const transport = createTransport();
try {
  if (!config.smtp.user || !config.smtp.password) throw new Error('Faltan credenciales SMTP.');
  await transport.verify();
  console.log('Conexión y autenticación SMTP verificadas. No se envió ningún correo.');
} catch (error) {
  console.error(`No se pudo verificar el SMTP: ${error.code || 'configuración incompleta'}.`);
  process.exitCode = 1;
} finally { transport.close(); }
