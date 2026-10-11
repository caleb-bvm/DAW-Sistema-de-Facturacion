import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/docker-healthcheck.js', import.meta.url));
function check(port, basePath = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, PORT: String(port), APP_BASE_PATH: basePath },
      stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('exit', resolve);
  });
}

test('Docker healthcheck: raíz, subruta, errores y servidor detenido', async () => {
  let status = 200;
  let contentType = 'text/html; charset=utf-8';
  let requested;
  const server = http.createServer((request, response) => {
    requested = request.url;
    response.writeHead(status, { 'Content-Type': contentType, Location: '/' });
    response.end('<html>Facturación</html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    assert.equal(await check(port), 0);
    assert.equal(requested, '/');
    assert.equal(await check(port, '/facturacion/'), 0);
    assert.equal(requested, '/facturacion/');
    status = 503;
    assert.equal(await check(port), 1);
    status = 308;
    assert.equal(await check(port), 1);
    status = 200;
    contentType = 'application/json';
    assert.equal(await check(port), 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(await check(port), 1);
});
