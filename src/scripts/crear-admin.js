const { abrirDb } = require('../config/database');
const { crearUsuarioModel } = require('../models/usuario.model');
const { crearUsuarioService } = require('../services/usuario.service');
const { validarCredenciales } = require('../validators/auth.validator');

async function main() {
  const datos = { nombre: process.env.ADMIN_NOMBRE, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
  const error = validarCredenciales(datos, true);
  if (error) throw new Error(`Revisa ADMIN_NOMBRE, ADMIN_EMAIL y ADMIN_PASSWORD en .env: ${error}`);
  const db = abrirDb(process.env.DB_PATH || './data/dulcesabor.sqlite');
  try {
    const usuarios = crearUsuarioModel(db);
    const usuarioService = crearUsuarioService({ usuarios });
    await usuarioService.crearAdministrador(datos);
    console.log('Administrador creado correctamente.');
  } finally { db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
