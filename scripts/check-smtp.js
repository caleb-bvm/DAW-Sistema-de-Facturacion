import net from 'node:net';
import tls from 'node:tls';
import { config } from '../server/config.js';

// Sólo negocia la conexión y EHLO: no autentica ni envía mensajes.
function inspect(secure) {
  return new Promise((resolve, reject) => {
    const options = { host: config.smtp.host, port: config.smtp.port };
    const socket = secure ? tls.connect({ ...options, servername: config.smtp.host, rejectUnauthorized: true }) : net.connect(options);
    let greeting = false; let received = '';
    const fail = (error) => { socket.destroy(); reject(error); };
    socket.setTimeout(5000, () => fail(new Error('Sin respuesta en cinco segundos.')));
    socket.on('error', fail);
    socket.on('data', (chunk) => {
      received += chunk.toString();
      if (!greeting && /^220 /m.test(received)) { greeting = true; received = ''; socket.write('EHLO ourpxi.dev\r\n'); }
      else if (greeting && /^250 /m.test(received)) {
        const auth = received.match(/^250[ -]AUTH[ =]([^\r\n]+)/im)?.[1] || 'No anunciado';
        const starttls = /^250[ -]STARTTLS\b/im.test(received);
        socket.end('QUIT\r\n'); resolve({ host: config.smtp.host, port: config.smtp.port, tlsImplicito: secure, starttls, auth });
      } else if (/^[45]\d\d /m.test(received)) fail(new Error('El servidor rechazó la negociación SMTP.'));
    });
  });
}
try { console.log(JSON.stringify(await inspect(false))); }
catch {
  try { console.log(JSON.stringify(await inspect(true))); }
  catch (error) { console.error(`No se pudo verificar ${config.smtp.host}:${config.smtp.port}: ${error.code || error.message}`); process.exitCode = 1; }
}
