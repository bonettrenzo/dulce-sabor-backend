const { HttpError } = require('../utils/http-error');

function rutaNoEncontrada(req, res) {
  return res.status(404).json({ ok: false, error: 'Ruta no encontrada.' });
}

function manejarError(error, req, res, next) {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'JSON inválido.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'El cuerpo de la petición es demasiado grande.' });
  if (error instanceof HttpError) return res.status(error.status).json({ ok: false, error: error.message });
  console.error('Error al procesar la petición:', error.message);
  return res.status(500).json({ ok: false, error: 'Ocurrió un error interno.' });
}

module.exports = { rutaNoEncontrada, manejarError };
