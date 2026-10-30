function crearUsuarioModel(db) {
  return {
    buscarPorId(id) {
      return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    },
    buscarPorEmail(email) {
      return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    },
    crear({ id, nombre, email, passwordHash, rol, creado }) {
      const resultado = db.prepare(`
        INSERT INTO usuarios (id, nombre, email, password_hash, rol, creado)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING
      `).run(id, nombre, email, passwordHash, rol, creado);
      return resultado.changes ? this.buscarPorId(id) : null;
    },
    actualizarUltimoAcceso(id, fecha) {
      db.prepare('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?').run(fecha, id);
    },
  };
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id, nombre: usuario.nombre, email: usuario.email,
    rol: usuario.rol, estado: usuario.estado,
    creado: usuario.creado, ultimoAcceso: usuario.ultimo_acceso,
  };
}

module.exports = { crearUsuarioModel, usuarioPublico };
