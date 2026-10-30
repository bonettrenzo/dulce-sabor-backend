const { horaColombia } = require('../utils/fecha');
function movimientoPublico(fila) {
  return {
    id: `mov-${fila.id}`, referencia: `MOV-${String(fila.id).padStart(4, '0')}`,
    productoId: fila.producto_id, producto: fila.producto, sku: fila.sku,
    tipo: fila.tipo, cambio: fila.cambio, saldo: fila.saldo, stockAnterior: fila.stock_anterior,
    motivo: fila.motivo, responsableId: fila.responsable_id, responsable: fila.responsable,
    fecha: fila.fecha, hora: horaColombia(fila.fecha),
  };
}
function filtrosMovimientos(filtros) {
  const condiciones = ['fecha >= ?', 'fecha < ?'];
  const valores = [filtros.inicio, filtros.fin];
  if (filtros.productoId) { condiciones.push('producto_id = ?'); valores.push(filtros.productoId); }
  if (filtros.tipo) { condiciones.push('tipo = ?'); valores.push(filtros.tipo); }
  return { where: condiciones.join(' AND '), valores };
}
function crearMovimientoModel(db) {
  return {
    crear(movimiento) {
      const resultado = db.prepare(`
        INSERT INTO movimientos_inventario
          (producto_id, producto, sku, tipo, cambio, saldo, stock_anterior, motivo, responsable_id, responsable, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(movimiento.productoId, movimiento.producto, movimiento.sku, movimiento.tipo,
        movimiento.cambio, movimiento.saldo, movimiento.stockAnterior, movimiento.motivo,
        movimiento.responsableId, movimiento.responsable, movimiento.fecha);
      return movimientoPublico(db.prepare('SELECT * FROM movimientos_inventario WHERE id = ?').get(resultado.lastInsertRowid));
    },
    contar(filtros) {
      const { where, valores } = filtrosMovimientos(filtros);
      return db.prepare(`SELECT COUNT(*) AS total FROM movimientos_inventario WHERE ${where}`).get(...valores).total;
    },
    listar(filtros, limite, offset) {
      const { where, valores } = filtrosMovimientos(filtros);
      return db.prepare(`SELECT * FROM movimientos_inventario WHERE ${where} ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?`)
        .all(...valores, limite, offset).map(movimientoPublico);
    },
  };
}
module.exports = { crearMovimientoModel };
