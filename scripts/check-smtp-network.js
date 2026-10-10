import dns from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { config } from '../server/config.js';

function probe(port, secure = false) {
  return new Promise((resolve) => {
    let connected = false; let done = false;
    const options = { host: config.smtp.host, port };
    const socket = secure ? tls.connect({ ...options, servername: config.smtp.host, rejectUnauthorized: true }) : net.connect(options);
    const finish = (result) => { if (done) return; done = true; socket.destroy(); resolve({ port, ...result }); };
    socket.setTimeout(5000, () => finish({ tcp: connected, resultado: connected ? 'Conecta, pero no responde con saludo SMTP' : 'Tiempo de espera al conectar' }));
    socket.on('connect', () => { connected = true; });
    socket.on('error', (error) => finish({ tcp: connected, resultado: error.code || 'Error de conexión' }));
    socket.on('data', (chunk) => finish({ tcp: connected, tls: secure, resultado: chunk.toString().split('\r\n')[0].slice(0, 200) }));
  });
}
try {
  const addresses = await dns.lookup(config.smtp.host, { all: true });
  console.log(JSON.stringify({ servidor: config.smtp.host, dns: addresses }));
  const ports = [...new Set([config.smtp.port, 587, 465])];
  console.log(JSON.stringify(await Promise.all(ports.map((port) => probe(port, port === 465)))));
  console.log('Comprobación sin autenticación y sin envío de correo.');
} catch (error) { console.error(`Diagnóstico: ${error.code || error.name}.`); process.exitCode = 1; }
