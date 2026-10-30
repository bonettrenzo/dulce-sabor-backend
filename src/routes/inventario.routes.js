const { Router } = require('express');
const { autorizarRoles } = require('../middlewares/auth.middleware');
function crearInventarioRoutes({ controller, autenticar }) {
  const router = Router();
  router.use(autenticar, autorizarRoles('administrador'));
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/', controller.listar);
  router.get('/resumen', controller.resumen);
  router.get('/alertas', controller.alertas);
  router.get('/opciones', controller.opciones);
  router.get('/movimientos', controller.movimientos);
  router.post('/movimientos', controller.registrarMovimiento);
  router.get('/:id', controller.obtener);
  return router;
}
module.exports = { crearInventarioRoutes };
