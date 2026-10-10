import { createTransport } from '../server/mail.js';
import { config } from '../server/config.js';
import { validEmail } from '../server/validation.js';

const recipient = process.argv[2];
if (!validEmail(recipient) || !validEmail(config.mailFrom)) throw new Error('Destinatario o remitente inválido.');
const transport = createTransport();
try {
  const result = await transport.sendMail({
    from: { name: 'Sistema de facturación', address: config.mailFrom },
    to: recipient,
    subject: 'Prueba de correo — Sistema de facturación',
    text: 'Hola Caleb:\n\nEste es un correo de prueba del sistema de facturación de ourpxi.dev. Se envió desde facturacion@ourpxi.dev mediante una conexión SMTP autenticada con TLS.\n\nSi recibes este mensaje, la entrega de correo de prueba funcionó correctamente.\n\nSistema de facturación',
  });
  if (!result.accepted?.length || result.rejected?.length) throw new Error('El SMTP no aceptó el destinatario.');
  console.log(`Correo de prueba aceptado por SMTP para ${recipient}.`);
} catch (error) {
  console.error(`No se pudo enviar el correo de prueba: ${error.code || error.name}.`);
  process.exitCode = 1;
} finally { transport.close(); }
