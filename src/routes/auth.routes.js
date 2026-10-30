const { Router } = require('express');
const { crearLimiteAuth } = require('../middlewares/auth-limiter.middleware');

function crearAuthRoutes({ controller, autenticar }) {
  const router = Router();
  const limite = crearLimiteAuth();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/register', limite, controller.register);
  router.post('/login', limite, controller.login);
  router.get('/me', autenticar, controller.me);
  router.post('/logout', autenticar, controller.logout);
  return router;
}

module.exports = { crearAuthRoutes };
