const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

function abrirDb(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('administrador', 'cajero')),
      estado TEXT NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
      creado TEXT NOT NULL,
      ultimo_acceso TEXT
    );
    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      precio INTEGER NOT NULL CHECK (precio >= 0),
      coste INTEGER NOT NULL CHECK (coste >= 0),
      stock INTEGER NOT NULL CHECK (typeof(stock) = 'integer' AND stock BETWEEN 0 AND 2147483647),
      stockMinimo INTEGER NOT NULL CHECK (typeof(stockMinimo) = 'integer' AND stockMinimo BETWEEN 0 AND 2147483647),
      estado TEXT NOT NULL CHECK (estado IN ('Activo', 'Inactivo')),
      imagen TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id TEXT NOT NULL REFERENCES productos(id),
      producto TEXT NOT NULL,
      sku TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'ajuste', 'venta', 'merma')),
      cambio INTEGER NOT NULL CHECK (typeof(cambio) = 'integer'),
      saldo INTEGER NOT NULL CHECK (typeof(saldo) = 'integer' AND saldo BETWEEN 0 AND 2147483647),
      stock_anterior INTEGER NOT NULL CHECK (typeof(stock_anterior) = 'integer' AND stock_anterior BETWEEN 0 AND 2147483647),
      motivo TEXT NOT NULL,
      responsable_id TEXT NOT NULL REFERENCES usuarios(id),
      responsable TEXT NOT NULL,
      fecha TEXT NOT NULL,
      CHECK (stock_anterior + cambio = saldo)
    );
    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(fecha, id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_producto_fecha ON movimientos_inventario(producto_id, fecha);
    CREATE TABLE IF NOT EXISTS sesiones (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira INTEGER NOT NULL
    );
  `);
  return db;
}

module.exports = { abrirDb };
