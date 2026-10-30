function cargarConfig(env = process.env) {
  const secret = env.JWT_SECRET;
  if (typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error('Configura JWT_SECRET con al menos 32 caracteres en .env.');
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un puerto válido.');
  }
  return {
    port,
    secret,
    frontendUrl: env.FRONTEND_URL || 'http://localhost:5173',
    dbPath: env.DB_PATH || './data/dulcesabor.sqlite',
  };
}

module.exports = { cargarConfig };
