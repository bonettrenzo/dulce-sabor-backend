const { rateLimit } = require('express-rate-limit');

function crearLimiteAuth() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { ok: false, error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  });
}

module.exports = { crearLimiteAuth };
