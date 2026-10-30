function crearProductoModel(db) {
  return {
    insertarSiNoExiste(producto) {
      return db.prepare(`
        INSERT INTO productos (id, sku, nombre, categoria, precio, coste, stock, stockMinimo, estado, imagen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING
      `).run(producto.id, producto.sku, producto.nombre, producto.categoria, producto.precio,
        producto.coste, producto.stock, producto.stockMinimo, producto.estado, producto.imagen).changes;
    },
  };
}
module.exports = { crearProductoModel };
