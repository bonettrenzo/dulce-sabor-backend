const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { crearUsuarioModel } = require('./models/usuario.model');
const { crearSesionModel } = require('./models/sesion.model');
const { crearUsuarioService } = require('./services/usuario.service');
const { crearAuthService } = require('./services/auth.service');
const { crearAuthController } = require('./controllers/auth.controller');
const { crearAutenticar } = require('./middlewares/auth.middleware');
const { crearAuthRoutes } = require('./routes/auth.routes');
const { crearInventarioModel } = require('./models/inventario.model');
const { crearMovimientoModel } = require('./models/movimiento.model');
const { crearInventarioService } = require('./services/inventario.service');
const { crearInventarioController } = require('./controllers/inventario.controller');
const { crearInventarioRoutes } = require('./routes/inventario.routes');
const { rutaNoEncontrada, manejarError } = require('./middlewares/error.middleware');

function crearApp({ db, secret, frontendUrl = 'http://localhost:5173' }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: frontendUrl }));
  app.use(express.json({ limit: '16kb' }));

  // Las dependencias se conectan aquí; los modelos comparten la misma base.
  const usuarios = crearUsuarioModel(db);
  const sesiones = crearSesionModel(db);
  const usuarioService = crearUsuarioService({ usuarios });
  const authService = crearAuthService({ usuarios, sesiones, secret });
  const controller = crearAuthController({ authService, usuarioService });
  const autenticar = crearAutenticar(authService);

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', crearAuthRoutes({ controller, autenticar }));
  const inventario = crearInventarioModel(db);
  const movimientos = crearMovimientoModel(db);
  const inventarioService = crearInventarioService({ inventario, movimientos });
  const inventarioController = crearInventarioController(inventarioService);
  app.use('/api/inventario', crearInventarioRoutes({ controller: inventarioController, autenticar }));
  app.use(rutaNoEncontrada);
  app.use(manejarError);
  return app;
}

module.exports = { crearApp };
