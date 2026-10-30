const { transaccion } = require('../utils/transaccion');
const ESTADO = "CASE WHEN stock = 0 THEN 'agotado' WHEN stock <= stockMinimo THEN 'bajo' ELSE 'disponible' END";
const CAMPOS = `id, nombre, sku, categoria, stock, stockMinimo AS minimo, estado = 'Activo' AS enPos, ${ESTADO} AS estado`;

function filtrosExistencias(filtros) {
  const condiciones = ['1 = 1'];
  const valores = [];
  if (filtros.busqueda) {
    condiciones.push('(instr(lower(nombre), lower(?)) > 0 OR instr(lower(sku), lower(?)) > 0)');
    valores.push(filtros.busqueda, filtros.busqueda);
  }
  if (filtros.categoria) { condiciones.push('categoria = ?'); valores.push(filtros.categoria); }
  if (filtros.estado) { condiciones.push(`(${ESTADO}) = ?`); valores.push(filtros.estado); }
  return { where: condiciones.join(' AND '), valores };
}
function existenciaPublica(fila) {
  return fila ? { ...fila, enPos: Boolean(fila.enPos) } : null;
}
function crearInventarioModel(db) {
  return {
    transaccion(operacion) { return transaccion(db, operacion); },
    contar(filtros) {
      const { where, valores } = filtrosExistencias(filtros);
      return db.prepare(`SELECT COUNT(*) AS total FROM productos WHERE ${where}`).get(...valores).total;
    },
    listar(filtros, limite, offset) {
      const { where, valores } = filtrosExistencias(filtros);
      return db.prepare(`SELECT ${CAMPOS} FROM productos WHERE ${where} ORDER BY sku LIMIT ? OFFSET ?`)
        .all(...valores, limite, offset).map(existenciaPublica);
    },
    buscarPorId(id) {
      return existenciaPublica(db.prepare(`SELECT ${CAMPOS} FROM productos WHERE id = ?`).get(id));
    },
    actualizarStock(id, stock) {
      db.prepare('UPDATE productos SET stock = ? WHERE id = ?').run(stock, id);
    },
    categorias() {
      return db.prepare('SELECT DISTINCT categoria FROM productos ORDER BY categoria').all().map(fila => fila.categoria);
    },
    alertas() {
      return db.prepare(`SELECT ${CAMPOS} FROM productos WHERE stock <= stockMinimo ORDER BY stock, sku`)
        .all().map(existenciaPublica);
    },
    resumen() {
      return db.prepare(`
        SELECT COUNT(*) AS totalProductos, COALESCE(SUM(stock), 0) AS unidades,
          COALESCE(SUM(stock <= stockMinimo), 0) AS enAlerta,
          COALESCE(SUM(stock > 0 AND stock <= stockMinimo), 0) AS bajos,
          COALESCE(SUM(stock = 0), 0) AS agotados,
          COALESCE(SUM(stock > stockMinimo), 0) AS disponibles FROM productos
      `).get();
    },
  };
}
module.exports = { crearInventarioModel };
