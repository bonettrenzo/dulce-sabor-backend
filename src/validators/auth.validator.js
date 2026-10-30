function validarCredenciales(body, registro = false) {

  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Envía un objeto JSON.';

  if (typeof body.email !== 'string' || body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return 'Escribe un correo válido.';

  if (typeof body.password !== 'string' || body.password.length < 8 || Buffer.byteLength(body.password, 'utf8') > 72) {

    return 'La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes.';

  }

  if (registro && (typeof body.nombre !== 'string' || body.nombre.trim().length < 2 || body.nombre.trim().length > 100)) return 'El nombre debe tener entre 2 y 100 caracteres.';
 
 
  return null;
}

module.exports = { validarCredenciales };
