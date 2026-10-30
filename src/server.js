const { cargarConfig } = require('./config/env');
const { abrirDb } = require('./config/database');
const { crearApp } = require('./app');

const config = cargarConfig();
const db = abrirDb(config.dbPath);
const app = crearApp({ ...config, db });
const server = app.listen(config.port, () => console.log(`API disponible en http://localhost:${config.port}/api`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
