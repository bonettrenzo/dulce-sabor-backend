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
    CREATE TABLE IF NOT EXISTS sesiones (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira INTEGER NOT NULL
    );
  `);
  return db;
}

module.exports = { abrirDb };
