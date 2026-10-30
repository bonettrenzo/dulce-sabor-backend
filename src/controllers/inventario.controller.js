function crearInventarioController(inventarioService) {
  return {
    listar(req, res) { return res.json({ ok: true, ...inventarioService.listar(req.query) }); },
    obtener(req, res) { return res.json({ ok: true, producto: inventarioService.obtener(req.params.id) }); },
    resumen(req, res) { return res.json({ ok: true, resumen: inventarioService.resumen() }); },
    alertas(req, res) { return res.json({ ok: true, alertas: inventarioService.alertas() }); },
    opciones(req, res) { return res.json({ ok: true, ...inventarioService.opciones() }); },
    movimientos(req, res) { return res.json({ ok: true, ...inventarioService.listarMovimientos(req.query) }); },
    registrarMovimiento(req, res) {
      const resultado = inventarioService.registrarMovimiento(req.body, req.user);
      return res.status(201).json({ ok: true, ...resultado });
    },
  };
}
module.exports = { crearInventarioController };
