const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { usuarioPublico } = require('../models/usuario.model');
const { validarCredenciales } = require('../validators/auth.validator');
const { HttpError } = require('../utils/http-error');

const DURACION = 60 * 60;
const OPCIONES_JWT = { issuer: 'dulce-sabor-api', audience: 'dulce-sabor-front' };

function crearAuthService({ usuarios, sesiones, secret }) {
  // Compara contraseñas incluso cuando el correo no existe.
  const hashFicticio = bcrypt.hashSync(randomUUID(), 12);

  return {
    async login(datos) {

      const error = validarCredenciales(datos);

      if (error) throw new HttpError(400, error);

      const usuario = usuarios.buscarPorEmail(datos.email.trim().toLowerCase());
      
      const coincide = await bcrypt.compare(datos.password, usuario?.password_hash || hashFicticio);
      if (!usuario || !coincide || usuario.estado !== 'Activo') {
        throw new HttpError(401, 'Correo o contraseña incorrectos.');
      }
      const jti = randomUUID();
      const ahora = Math.floor(Date.now() / 1000);
      const token = jwt.sign({ iat: ahora }, secret, {
        ...OPCIONES_JWT, algorithm: 'HS256', subject: usuario.id, jwtid: jti, expiresIn: DURACION,
      });
      sesiones.eliminarExpiradas(ahora);
      sesiones.crear({ id: jti, usuarioId: usuario.id, expira: ahora + DURACION });
      usuario.ultimo_acceso = new Date().toISOString();
      usuarios.actualizarUltimoAcceso(usuario.id, usuario.ultimo_acceso);
      return { token, expiresIn: DURACION, user: usuarioPublico(usuario) };
    },
    
    verificarSesion(token) {
      let payload;
      try {
        payload = jwt.verify(token, secret, { ...OPCIONES_JWT, algorithms: ['HS256'] });
      } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
          throw new HttpError(401, 'Sesión inválida o expirada.');
        }
        throw error;
      }
      if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
        throw new HttpError(401, 'Sesión inválida o expirada.');
      }
      const usuario = sesiones.buscarUsuarioActivo(payload.sub, payload.jti, Math.floor(Date.now() / 1000));
      if (!usuario) throw new HttpError(401, 'Sesión inválida o expirada.');
      return { user: usuarioPublico(usuario), sesionId: payload.jti };
    },
    logout(sesionId) {
      sesiones.eliminar(sesionId);
    },
  };
}

module.exports = { crearAuthService };
