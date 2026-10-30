function crearSesionModel(db) {
  return {
    crear({ id, usuarioId, expira }) {
      db.prepare('INSERT INTO sesiones (id, usuario_id, expira) VALUES (?, ?, ?)')
        .run(id, usuarioId, expira);
    },
    buscarUsuarioActivo(usuarioId, sesionId, ahora) {
      return db.prepare(`
        SELECT u.* FROM usuarios u JOIN sesiones s ON s.usuario_id = u.id
        WHERE u.id = ? AND s.id = ? AND s.expira > ? AND u.estado = 'Activo'
      `).get(usuarioId, sesionId, ahora);
    },
    eliminarExpiradas(ahora) {
      db.prepare('DELETE FROM sesiones WHERE expira <= ?').run(ahora);
    },
    eliminar(id) {
      db.prepare('DELETE FROM sesiones WHERE id = ?').run(id);
    },
  };
}

module.exports = { crearSesionModel };
