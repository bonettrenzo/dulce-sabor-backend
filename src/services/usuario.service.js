const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { usuarioPublico } = require('../models/usuario.model');
const { validarCredenciales } = require('../validators/auth.validator');
const { HttpError } = require('../utils/http-error');

function crearUsuarioService({ usuarios }) {
  async function crearCuenta(datos, rol) {
    const error = validarCredenciales(datos, true);
    if (error) throw new HttpError(400, error);
    const passwordHash = await bcrypt.hash(datos.password, 12);
    const usuario = usuarios.crear({
      id: randomUUID(), nombre: datos.nombre.trim(), email: datos.email.trim().toLowerCase(),
      passwordHash, rol, creado: new Date().toISOString(),
    });
    if (!usuario) throw new HttpError(409, 'El correo ya está registrado.');
    return usuarioPublico(usuario);
  }

  return {
    registrarCajero(datos) {
      // El registro público nunca concede privilegios administrativos.
      if (datos?.rol !== undefined && datos.rol !== 'cajero') {
        throw new HttpError(400, 'El registro solo permite crear cajeros.');
      }
      return crearCuenta(datos, 'cajero');
    },
    crearAdministrador(datos) {
      return crearCuenta(datos, 'administrador');
    },
  };
}

module.exports = { crearUsuarioService };
