const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { abrirDb } = require('../src/config/database');
const { crearApp } = require('../src/app');
const { cargarConfig } = require('../src/config/env');
const secret = 'secreto-exclusivamente-para-las-pruebas-123456';
let db, server, base, token, userId;
const password = 'ClavePrueba123';
async function request(path, { method = 'GET', body, token: bearer } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
before(async () => {
  db = abrirDb(':memory:');
  server = crearApp({ db, secret }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });

test('rechaza un secreto ausente o demasiado corto', () => {
  assert.throws(() => cargarConfig({}), /JWT_SECRET/);
  assert.throws(() => cargarConfig({ JWT_SECRET: 'corto' }), /JWT_SECRET/);
});
test('registra un cajero, normaliza el correo y guarda un hash', async () => {
  const response = await request('/api/auth/register', { method: 'POST', body: { nombre: ' Ana López ', email: ' ANA@EXAMPLE.COM ', password } });
  assert.equal(response.status, 201);
  assert.equal(response.body.user.rol, 'cajero');
  assert.equal(response.body.user.email, 'ana@example.com');
  assert.equal(response.body.user.nombre, 'Ana López');
  assert.equal(response.body.user.password_hash, undefined);
  assert.equal(response.body.user.password, undefined);
  userId = response.body.user.id;
  const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
  assert.notEqual(row.password_hash, password);
  assert.equal(await bcrypt.compare(password, row.password_hash), true);
});
test('rechaza correos duplicados y privilegios administrativos desde registro', async () => {
  assert.equal((await request('/api/auth/register', { method: 'POST', body: { nombre: 'Otra Ana', email: 'ANA@example.com', password } })).status, 409);
  assert.equal((await request('/api/auth/register', { method: 'POST', body: { nombre: 'Admin', email: 'admin@example.com', password, rol: 'administrador' } })).status, 400);
});
test('valida datos y JSON mal formado', async () => {
  for (const body of [null, [], {}, { nombre: 'Ana', email: 'incorrecto', password }, { nombre: 'Ana', email: 'a@b.co', password: 'corta' }, { nombre: 'Ana', email: 'a@b.co', password: 'á'.repeat(37) }]) {
    assert.equal((await request('/api/auth/register', { method: 'POST', body })).status, 400);
  }
  assert.equal((await request('/api/auth/login', { method: 'POST', body: '{mal json' })).status, 400);
});
test('login rechaza credenciales incorrectas sin revelar si existe el correo', async () => {
  const a = await request('/api/auth/login', { method: 'POST', body: { email: 'ana@example.com', password: 'incorrecta123' } });
  const b = await request('/api/auth/login', { method: 'POST', body: { email: 'nadie@example.com', password } });
  assert.equal(a.status, 401); assert.deepEqual(a.body, b.body);
});
test('inicia sesión y permite consultar el usuario autenticado', async () => {
  const response = await request('/api/auth/login', { method: 'POST', body: { email: 'ANA@example.com', password } });
  assert.equal(response.status, 200); token = response.body.token;
  assert.equal(response.body.expiresIn, 3600);
  assert.ok(response.body.user.ultimoAcceso);
  const me = await request('/api/auth/me', { token });
  assert.equal(me.status, 200); assert.equal(me.body.user.id, userId);
  assert.equal(me.headers.get('cache-control'), 'no-store');
});
test('rechaza tokens ausentes, adulterados y expirados', async () => {
  assert.equal((await request('/api/auth/me')).status, 401);
  assert.equal((await request('/api/auth/me', { token: 'invalido' })).status, 401);
  const expired = jwt.sign({}, secret, { subject: userId, jwtid: 'expired', issuer: 'dulce-sabor-api', audience: 'dulce-sabor-front', expiresIn: -1 });
  assert.equal((await request('/api/auth/me', { token: expired })).status, 401);
});
test('consulta el rol actual y bloquea cuentas desactivadas con token vigente', async () => {
  db.prepare("UPDATE usuarios SET rol = 'administrador' WHERE id = ?").run(userId);
  assert.equal((await request('/api/auth/me', { token })).body.user.rol, 'administrador');
  db.prepare("UPDATE usuarios SET estado = 'Inactivo' WHERE id = ?").run(userId);
  assert.equal((await request('/api/auth/me', { token })).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'ana@example.com', password } })).status, 401);
  db.prepare("UPDATE usuarios SET estado = 'Activo' WHERE id = ?").run(userId);
});
test('logout invalida el token en el servidor', async () => {
  assert.equal((await request('/api/auth/logout', { method: 'POST', token })).status, 200);
  assert.equal((await request('/api/auth/me', { token })).status, 401);
});
test('persiste usuarios al reabrir la base de datos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dulcesabor-db-'));
  const filename = join(dir, 'test.sqlite');
  let disk;
  try {
    disk = abrirDb(filename);
    disk.prepare("INSERT INTO usuarios (id, nombre, email, password_hash, rol, creado) VALUES ('test', 'Prueba', 'test@example.com', 'hash', 'cajero', '2026-01-01')").run();
    disk.close(); disk = abrirDb(filename);
    assert.equal(disk.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
  } finally { disk?.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('limita intentos repetidos de autenticación', async () => {
  let result;
  for (let i = 0; i < 21; i++) result = await request('/api/auth/login', { method: 'POST', body: {} });
  assert.equal(result.status, 429);
});
