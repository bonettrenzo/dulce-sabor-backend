const { HttpError } = require('../utils/http-error');

function crearAutenticar(authService) {
  return (req, res, next) => {
    const partes = req.get('authorization')?.split(' ');
    if (partes?.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) {
      throw new HttpError(401, 'Debes iniciar sesión.');
    }
    const sesion = authService.verificarSesion(partes[1]);
    req.user = sesion.user;
    req.sesionId = sesion.sesionId;
    next();
  };
}

function autorizarRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) throw new HttpError(401, 'Debes iniciar sesión.');
    if (!roles.includes(req.user.rol)) throw new HttpError(403, 'No tienes permiso para esta acción.');
    next();
  };
}

module.exports = { crearAutenticar, autorizarRoles };
