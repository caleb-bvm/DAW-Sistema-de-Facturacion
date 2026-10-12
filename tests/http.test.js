import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../server/index.js';
import { config } from '../server/config.js';

test('HTTP: sirve sólo la interfaz y protege la API, los archivos privados y los orígenes', async (t) => {
  config.environment = 'development'; const server = createApplication(); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`; config.origin = origin;
  try {
    await t.test('interfaz y módulos disponibles', async () => { const home = await fetch(origin); assert.equal(home.status, 200); assert.match(await home.text(), /Clientes/); const script = await fetch(`${origin}/assets/js/comprobantes.js`); assert.equal(script.status, 200); assert.match(script.headers.get('content-type'), /javascript/); });
    await t.test('archivos privados no expuestos', async () => { for (const file of ['.env', 'package.json', 'server/config.js', 'database/schema.sql', 'deploy/Caddyfile', 'assets/../server/config.js']) assert.equal((await fetch(`${origin}/${file}`)).status, 404, file); });
    await t.test('sin sesión: lectura y escritura bloqueadas', async () => { assert.equal((await fetch(`${origin}/api?action=catalogs`)).status, 401); const post = await fetch(`${origin}/api?action=invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(post.status, 401); });
    await t.test('origen externo y JSON inválido rechazados', async () => { assert.equal((await fetch(`${origin}/api?action=login`, { method: 'POST', headers: { Origin: 'https://externo.invalid', 'Content-Type': 'application/json' }, body: '{}' })).status, 403); assert.equal((await fetch(`${origin}/api?action=login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 422); });
    await t.test('la cookie es HttpOnly y no permite JavaScript leerla', async () => { const logout = await fetch(`${origin}/api?action=logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(logout.status, 200); assert.match(logout.headers.get('set-cookie'), /HttpOnly/); assert.match(logout.headers.get('set-cookie'), /SameSite=Lax/); });
    await t.test('producción rechaza HTTPS fingido desde un proxy no autorizado', async () => { config.environment = 'production'; assert.equal((await fetch(`${origin}/api?action=session`, { headers: { 'X-Forwarded-Proto': 'https' } })).status, 403); config.environment = 'development'; });
    await t.test('subruta facturacion: redirección, archivos, API y cookie aislada', async () => {
      config.basePath = '/facturacion';
      try {
        const redirect = await fetch(`${origin}/facturacion?x=1`, { redirect: 'manual' });
        assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/facturacion/?x=1');
        assert.equal((await fetch(`${origin}/facturacion/`)).status, 200);
        assert.equal((await fetch(`${origin}/facturacion/assets/js/principal.js`)).status, 200);
        assert.equal((await fetch(`${origin}/facturacion/api?action=session`)).status, 401);
        assert.equal((await fetch(`${origin}/api?action=session`)).status, 404);
        assert.equal((await fetch(`${origin}/facturacion/.env`)).status, 404);
        assert.equal((await fetch(`${origin}/facturacion2/assets/js/principal.js`)).status, 404);
        const logout = await fetch(`${origin}/facturacion/api?action=logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(logout.status, 200); assert.match(logout.headers.get('set-cookie'), /Path=\/facturacion;/);
      } finally { config.basePath = ''; }
    });
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
