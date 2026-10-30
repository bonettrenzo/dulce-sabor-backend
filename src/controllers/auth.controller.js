function crearAuthController({ authService, usuarioService }) {
  return {
    async register(req, res) {
      const user = await usuarioService.registrarCajero(req.body);
      return res.status(201).json({ ok: true, user });
    },
    async login(req, res) {
      const resultado = await authService.login(req.body);
      return res.json({ ok: true, ...resultado });
    },
    me(req, res) {
      return res.json({ ok: true, user: req.user });
    },
    logout(req, res) {
      authService.logout(req.sesionId);
      return res.json({ ok: true, message: 'Sesión cerrada.' });
    },
  };
}

module.exports = { crearAuthController };
