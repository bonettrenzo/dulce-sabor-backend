const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const bcrypt = require('bcryptjs');
const { abrirDb } = require('../src/config/database');
const { crearApp } = require('../src/app');
const { cargarProductos } = require('../src/scripts/seed-productos');
const { crearMovimientoModel } = require('../src/models/movimiento.model');
let db, server, base, adminToken, cajeroToken;
async function request(path, { method = 'GET', body, token = adminToken } = {}) {
  const response = await fetch(`${base}/api/inventario${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
const entrada = (cantidad = 2, productoId = 'p13') => ({ productoId, tipo: 'entrada', cantidad, motivo: 'Proveedor' });
const ajuste = cantidad => ({ productoId: 'p13', tipo: 'ajuste', cantidad, motivo: 'Conteo físico' });
function stock(id = 'p13') { return db.prepare('SELECT stock FROM productos WHERE id = ?').get(id).stock; }
function totalMovimientos() { return db.prepare('SELECT COUNT(*) AS n FROM movimientos_inventario').get().n; }
before(async () => {
  db = abrirDb(':memory:');
  const hash = bcrypt.hashSync('ClavePrueba123', 4);
  const insertar = db.prepare('INSERT INTO usuarios (id, nombre, email, password_hash, rol, creado) VALUES (?, ?, ?, ?, ?, ?)');
  insertar.run('admin', 'Admin Prueba', 'admin@example.com', hash, 'administrador', new Date().toISOString());
  insertar.run('cajero', 'Cajero Prueba', 'cajero@example.com', hash, 'cajero', new Date().toISOString());
  server = crearApp({ db, secret: 'secreto-inventario-exclusivamente-para-pruebas' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  for (const rol of ['admin', 'cajero']) {
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${rol}@example.com`, password: 'ClavePrueba123' }) });
    assert.equal(response.status, 200);
    const { token } = await response.json();
    if (rol === 'admin') adminToken = token; else cajeroToken = token;
  }
});
beforeEach(() => {
  db.exec('DELETE FROM movimientos_inventario; DELETE FROM productos;');
  cargarProductos(db);
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });

test('todas las rutas de inventario requieren sesión de administrador', async () => {
  for (const path of ['', '/resumen', '/alertas', '/opciones', '/movimientos', '/p13']) {
    assert.equal((await request(path, { token: null })).status, 401);
    assert.equal((await request(path, { token: cajeroToken })).status, 403);
  }
  assert.equal((await request('/movimientos', { method: 'POST', body: entrada(), token: cajeroToken })).status, 403);
  assert.equal(totalMovimientos(), 0); assert.equal(stock(), 3);
});
test('lista las existencias con los campos que consume el frontend y paginación', async () => {
  const response = await request('');
  assert.equal(response.status, 200);
  assert.equal(response.body.productos.length, 6);
  assert.deepEqual(response.body.paginacion, { pagina: 1, porPagina: 6, total: 18, paginas: 3, desde: 1, hasta: 6 });
  const producto = (await request('/p13')).body.producto;
  assert.equal(producto.minimo, 5); assert.equal(producto.enPos, true); assert.equal(producto.estado, 'bajo');
  assert.equal((await request('/p24')).body.producto.estado, 'agotado');
  assert.equal((await request('/p3')).body.producto.estado, 'disponible');
  const ultima = await request('?pagina=999');
  assert.equal(ultima.body.paginacion.pagina, 3);
  assert.equal((await request('/no-existe')).status, 404);
});
test('filtra por nombre, SKU, categoría y estado sin interpretar SQL o comodines', async () => {
  assert.equal((await request('?busqueda=CAPUCHINO')).body.productos[0].id, 'p25');
  assert.equal((await request('?busqueda=PAN-003')).body.productos[0].id, 'p13');
  assert.equal((await request('?busqueda=AR%C3%81NDANOS')).body.productos[0].id, 'p23');
  assert.equal((await request('?categoria=Bebidas')).body.paginacion.total, 4);
  assert.equal((await request('?estado=bajo')).body.paginacion.total, 2);
  assert.equal((await request('?estado=agotado')).body.productos[0].id, 'p24');
  assert.equal((await request('?categoria=todas&estado=todos')).body.paginacion.total, 18);
  for (const busqueda of ["' OR 1=1 --", '%']) {
    const response = await request(`?busqueda=${encodeURIComponent(busqueda)}`);
    assert.equal(response.body.paginacion.total, 0); assert.equal(response.body.paginacion.desde, 0);
  }
});
test('resumen, alertas y opciones reflejan todo el inventario', async () => {
  const { resumen } = (await request('/resumen')).body;
  assert.equal(resumen.totalProductos, 18); assert.equal(resumen.enAlerta, 3);
  assert.equal(resumen.bajos, 2); assert.equal(resumen.agotados, 1); assert.equal(resumen.disponibles, 15);
  const alertas = (await request('/alertas')).body.alertas;
  assert.equal(alertas.length, 3); assert.equal(alertas[0].id, 'p24');
  const opciones = (await request('/opciones')).body;
  assert.equal(opciones.categorias.length, 4);
  assert.ok(opciones.motivosEntrada.includes('Proveedor')); assert.ok(opciones.motivosAjuste.includes('Conteo físico'));
});
test('valida filtros, paginación y fechas sin producir errores internos', async () => {
  for (const query of ['pagina=0', 'pagina=1.2', 'porPagina=101', 'porPagina=-1', 'pagina=1&pagina=2', 'estado=Activo', 'busqueda=a&busqueda=b']) {
    assert.equal((await request(`?${query}`)).status, 400, query);
  }
  for (const query of ['desde=2026-02-30', 'desde=abc', 'desde=2026-10-30&hasta=2026-10-01', 'tipo=otro']) {
    assert.equal((await request(`/movimientos?${query}`)).status, 400, query);
  }
});
test('una entrada suma stock y registra al usuario autenticado con una referencia única', async () => {
  const response = await request('/movimientos', { method: 'POST', body: { ...entrada(12), responsable: 'Nombre falsificado', responsableId: 'cajero' } });
  assert.equal(response.status, 201);
  assert.equal(stock(), 15); assert.equal(response.body.producto.stock, 15);
  const m = response.body.movimiento;
  assert.equal(m.cambio, 12); assert.equal(m.saldo, 15); assert.equal(m.stockAnterior, 3);
  assert.equal(m.responsableId, 'admin'); assert.equal(m.responsable, 'Admin Prueba');
  assert.match(m.referencia, /^MOV-\d+$/); assert.match(m.hora, /^\d{2}:\d{2}$/);
  assert.equal(m.productoId, 'p13'); assert.equal(m.producto, 'Rol de canela'); assert.equal(m.sku, 'PAN-003');
  const history = (await request('/movimientos?productoId=p13&tipo=entrada')).body;
  assert.equal(history.movimientos[0].id, m.id); assert.equal(history.paginacion.total, 1);
  assert.equal((await request('/resumen')).body.resumen.bajos, 1);
});
test('un ajuste fija el conteo físico, incluso cero, y recalcula las alertas', async () => {
  let response = await request('/movimientos', { method: 'POST', body: ajuste(1) });
  assert.equal(response.status, 201); assert.equal(stock(), 1); assert.equal(response.body.movimiento.cambio, -2);
  response = await request('/movimientos', { method: 'POST', body: ajuste(0) });
  assert.equal(stock(), 0); assert.equal(response.body.movimiento.cambio, -1);
  assert.equal(response.body.producto.estado, 'agotado');
  assert.equal((await request('/resumen')).body.resumen.agotados, 2);
});
test('rechaza cantidades y motivos inválidos antes de cambiar existencias', async () => {
  const invalidos = [null, [], {}, ...[-1, 0, 1.5, '2', null, 2147483648].map(cantidad => entrada(cantidad)),
    { ...entrada(), tipo: 'venta' }, { ...entrada(), tipo: 'merma' }, { ...entrada(), motivo: 'Conteo físico' },
    { ...ajuste(2), motivo: 'Proveedor' }, { ...entrada(), productoId: '' }];
  for (const body of invalidos) {
    assert.equal((await request('/movimientos', { method: 'POST', body })).status, 400, JSON.stringify(body));
  }
  assert.equal(stock(), 3); assert.equal(totalMovimientos(), 0);
  assert.equal((await request('/movimientos', { method: 'POST', body: entrada(1, 'inexistente') })).status, 404);
});
test('rechaza el desbordamiento de stock sin generar un movimiento', async () => {
  db.prepare('UPDATE productos SET stock = 2147483646 WHERE id = ?').run('p13');
  assert.equal((await request('/movimientos', { method: 'POST', body: entrada(2) })).status, 400);
  assert.equal(stock(), 2147483646); assert.equal(totalMovimientos(), 0);
});
test('revierte el stock si falla la escritura del historial y permite continuar', async () => {
  db.exec("CREATE TRIGGER fallo_historial BEFORE INSERT ON movimientos_inventario BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END;");
  try {
    assert.equal((await request('/movimientos', { method: 'POST', body: entrada() })).status, 500);
    assert.equal(stock(), 3); assert.equal(totalMovimientos(), 0);
  } finally { db.exec('DROP TRIGGER fallo_historial'); }
  assert.equal((await request('/movimientos', { method: 'POST', body: entrada() })).status, 201);
  assert.equal(stock(), 5);
});
test('entradas simultáneas conservan todas las unidades y referencias distintas', async () => {
  const respuestas = await Promise.all(Array.from({ length: 8 }, () => request('/movimientos', { method: 'POST', body: entrada(1) })));
  assert.ok(respuestas.every(r => r.status === 201));
  assert.equal(stock(), 11); assert.equal(totalMovimientos(), 8);
  assert.equal(new Set(respuestas.map(r => r.body.movimiento.referencia)).size, 8);
  assert.deepEqual(respuestas.map(r => r.body.movimiento.stockAnterior).sort((a,b)=>a-b), [3,4,5,6,7,8,9,10]);
});
test('el historial filtra días según Colombia y excluye ambos días adyacentes', async () => {
  const modelo = crearMovimientoModel(db);
  for (const fecha of ['2026-01-15T04:59:59.999Z', '2026-01-15T05:00:00.000Z', '2026-01-16T04:59:59.999Z', '2026-01-16T05:00:00.000Z']) {
    modelo.crear({ productoId: 'p13', producto: 'Rol de canela', sku: 'PAN-003', tipo: 'entrada', cambio: 1, saldo: 4,
      stockAnterior: 3, motivo: 'Proveedor', responsableId: 'admin', responsable: 'Admin Prueba', fecha });
  }
  const response = await request('/movimientos?desde=2026-01-15&hasta=2026-01-15&porPagina=1');
  assert.equal(response.body.paginacion.total, 2);
  assert.equal(response.body.movimientos.length, 1); assert.equal(response.body.movimientos[0].hora, '23:59');
  const segunda = await request('/movimientos?desde=2026-01-15&hasta=2026-01-15&porPagina=1&pagina=2');
  assert.equal(segunda.body.movimientos[0].hora, '00:00');
  assert.equal((await request('/movimientos?desde=2026-01-15&tipo=ajuste')).body.paginacion.total, 0);
});
test('la semilla es idempotente y no sobrescribe stock ni precios editados', () => {
  db.prepare('UPDATE productos SET stock = 123, precio = 9900 WHERE id = ?').run('p13');
  assert.equal(cargarProductos(db), 0);
  assert.equal(stock(), 123); assert.equal(db.prepare('SELECT precio FROM productos WHERE id = ?').get('p13').precio, 9900);
});
test('stock e historial persisten al reabrir SQLite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dulcesabor-inventario-'));
  const filename = join(dir, 'test.sqlite');
  let disco;
  try {
    disco = abrirDb(filename); cargarProductos(disco);
    disco.prepare("INSERT INTO usuarios (id, nombre, email, password_hash, rol, creado) VALUES ('admin', 'Admin', 'a@example.com', 'hash', 'administrador', '2026-01-01')").run();
    const { crearInventarioModel } = require('../src/models/inventario.model');
    const { crearInventarioService } = require('../src/services/inventario.service');
    const servicio = crearInventarioService({ inventario: crearInventarioModel(disco), movimientos: crearMovimientoModel(disco) });
    servicio.registrarMovimiento(entrada(4), { id: 'admin', nombre: 'Admin' });
    disco.close(); disco = abrirDb(filename);
    assert.equal(disco.prepare('SELECT stock FROM productos WHERE id = ?').get('p13').stock, 7);
    assert.equal(disco.prepare('SELECT COUNT(*) AS n FROM movimientos_inventario').get().n, 1);
  } finally { disco?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('un inventario vacío responde sin alertas ni errores de paginación', async () => {
  db.exec('DELETE FROM productos');
  const listado = (await request('')).body;
  assert.deepEqual(listado.productos, []);
  assert.equal(listado.paginacion.total, 0); assert.equal(listado.paginacion.desde, 0);
  assert.equal(listado.paginacion.hasta, 0);
  assert.deepEqual((await request('/alertas')).body.alertas, []);
  assert.deepEqual((await request('/resumen')).body.resumen, {
    totalProductos: 0, unidades: 0, enAlerta: 0, bajos: 0, agotados: 0, disponibles: 0,
  });
});
test('los productos inactivos permanecen en inventario con enPos falso', async () => {
  db.prepare("UPDATE productos SET estado = 'Inactivo' WHERE id = ?").run('p13');
  const response = await request('/p13');
  assert.equal(response.body.producto.enPos, false);
  assert.equal(response.body.producto.estado, 'bajo');
});
test('el historial no ofrece edición ni eliminación de movimientos', async () => {
  const response = await request('/movimientos', { method: 'POST', body: entrada() });
  const path = `/movimientos/${response.body.movimiento.id}`;
  assert.equal((await request(path, { method: 'PATCH', body: { cantidad: 99 } })).status, 404);
  assert.equal((await request(path, { method: 'DELETE' })).status, 404);
  assert.equal(stock(), 5); assert.equal(totalMovimientos(), 1);
});
test('agrega las tablas de inventario a una base de auth existente sin perder usuarios o sesiones', () => {
  const { DatabaseSync } = require('node:sqlite');
  const dir = mkdtempSync(join(tmpdir(), 'dulcesabor-upgrade-'));
  const filename = join(dir, 'test.sqlite');
  let disco;
  try {
    disco = new DatabaseSync(filename);
    disco.exec(`
      CREATE TABLE usuarios (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL, rol TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'Activo', creado TEXT NOT NULL, ultimo_acceso TEXT);
      CREATE TABLE sesiones (id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id), expira INTEGER NOT NULL);
      INSERT INTO usuarios (id, nombre, email, password_hash, rol, creado) VALUES ('u', 'Admin', 'a@example.com', 'hash', 'administrador', '2026-01-01');
      INSERT INTO sesiones VALUES ('s', 'u', 9999999999);
    `);
    disco.close(); disco = abrirDb(filename);
    assert.equal(disco.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
    assert.equal(disco.prepare('SELECT COUNT(*) AS n FROM sesiones').get().n, 1);
    assert.equal(cargarProductos(disco), 18);
    assert.equal(disco.prepare('SELECT COUNT(*) AS n FROM movimientos_inventario').get().n, 0);
  } finally { disco?.close(); rmSync(dir, { recursive: true, force: true }); }
});
