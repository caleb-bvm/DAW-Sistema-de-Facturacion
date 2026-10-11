import { withLogContext } from './log-context.js';
import { isUniqueViolation } from './db.js';
import http from 'node:http';
import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { config, root } from './config.js';
import { RequestError, requireValue, object } from './validation.js';
import { dispatch } from './api.js';
import { matchesNetworks, sessionCookie, requestIp } from './access.js';
import { pool } from './db.js';
import { processMail } from './mail.js';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
async function body(request) {
  requireValue(String(request.headers['content-type'] || '').split(';')[0] === 'application/json', 'Envía datos JSON.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; requireValue(size <= 250000, 'Solicitud demasiado grande.', 413); chunks.push(chunk); }
  try { const data = JSON.parse(Buffer.concat(chunks).toString('utf8')); requireValue(object(data), 'Datos inválidos.'); return data; }
  catch (error) { if (error instanceof RequestError) throw error; throw new RequestError('JSON inválido.'); }
}
function json(response, data, status = 200) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data)); }
export function createApplication() {
  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'same-origin'); response.setHeader('X-Frame-Options', 'DENY');
    try {
      const url = new URL(request.url, config.origin);
      if (config.basePath) {
        if (url.pathname === config.basePath || url.pathname === '/') {
          response.writeHead(308, { Location: `${config.basePath}/${url.search}` }); response.end(); return;
        }
        requireValue(url.pathname.startsWith(config.basePath + '/'), 'Recurso no encontrado.', 404);
        url.pathname = url.pathname.slice(config.basePath.length);
      }
      if (url.pathname === '/api') {
        response.setHeader('Cache-Control', 'no-store');
        const trusted = matchesNetworks(request.socket.remoteAddress || '', config.trustedProxies);
        const https = Boolean(request.socket.encrypted) || (trusted && request.headers['x-forwarded-proto'] === 'https');
        requireValue(config.environment !== 'production' || https, 'El servidor requiere HTTPS. Configura el proxy confiable o el entorno local de desarrollo.', 403);
        const origin = request.headers.origin;
        const allowed = config.environment === 'development' ? [config.origin, `http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`] : [config.origin];
        requireValue(!origin || allowed.includes(origin), 'Origen no autorizado.', 403);
        requireValue(['GET', 'POST'].includes(request.method), 'Método no permitido.', 405);
        const data = request.method === 'POST' ? await body(request) : {};
        const result = await withLogContext({origen:'web',ip:requestIp(request),metodo:request.method,operacion:(url.searchParams.get('action')||'').slice(0,80)},()=>dispatch(request, response, url, data)); if (result !== undefined) json(response, result); return;
      }
      requireValue(['GET', 'HEAD'].includes(request.method), 'Método no permitido.', 405);
      const pathname = decodeURIComponent(url.pathname); const relative = pathname === '/' || pathname === '/index.html' ? 'index.html' : pathname.slice(1);
      requireValue(relative === 'index.html' || /^assets\/[a-zA-Z0-9/_\-.]+$/.test(relative), 'Recurso no encontrado.', 404);
      const file = path.resolve(root, relative); const allowedRoot = relative === 'index.html' ? root : path.join(root, 'assets');
      requireValue(file.startsWith(allowedRoot + path.sep), 'Recurso no encontrado.', 404);
      const resolved = await realpath(file); requireValue(resolved.startsWith(allowedRoot + path.sep), 'Recurso no encontrado.', 404);
      const type = types[path.extname(file)]; requireValue(type, 'Recurso no encontrado.', 404);
      const content = await readFile(file); response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }); response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      if (error instanceof RequestError) { if (error.status === 401) response.setHeader('Set-Cookie', sessionCookie('', true)); json(response, { error: error.message }, error.status); }
      else if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code) || error instanceof URIError) json(response, { error: 'Recurso no encontrado.' }, 404);
      else { console.error(`Fallo interno: ${error.code || error.name}.`); json(response, { error: isUniqueViolation(error) ? 'El registro ya existe.' : 'No se pudo completar la operación. Verifica SQL Server y la configuración del servidor.' }, 503); }
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = createApplication(); server.requestTimeout = 30000;
  server.listen(config.port, config.host, () => console.log(`Facturación: http://${config.host}:${config.port}${config.basePath}/`));
  const timer = setInterval(() => processMail().catch((error) => console.error(`Cola de correo: ${error.code || error.name}.`)), 60000); timer.unref();
  const close = () => { clearInterval(timer); server.close(async () => { await pool.end(); }); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
}
