const { HttpError } = require('../utils/http-error');
const { paginacion } = require('../utils/paginacion');
const { MOTIVOS_ENTRADA, MOTIVOS_AJUSTE, MAX_STOCK } = require('../constants/inventario');
const { validarFiltrosInventario, validarFiltrosMovimientos, validarMovimiento } = require('../validators/inventario.validator');

function crearInventarioService({ inventario, movimientos }) {
  return {
    listar(query) {
      const filtros = validarFiltrosInventario(query);
      const pagina = paginacion(inventario.contar(filtros), filtros.pagina, filtros.porPagina);
      const productos = inventario.listar(filtros, pagina.porPagina, (pagina.pagina - 1) * pagina.porPagina);
      return { productos, paginacion: pagina };
    },
    obtener(id) {
      const producto = inventario.buscarPorId(id);
      if (!producto) throw new HttpError(404, 'Producto no encontrado.');
      return producto;
    },
    resumen() { return inventario.resumen(); },
    alertas() { return inventario.alertas(); },
    opciones() {
      return { categorias: inventario.categorias(), motivosEntrada: MOTIVOS_ENTRADA, motivosAjuste: MOTIVOS_AJUSTE };
    },
    listarMovimientos(query) {
      const filtros = validarFiltrosMovimientos(query);
      const pagina = paginacion(movimientos.contar(filtros), filtros.pagina, filtros.porPagina);
      return {
        movimientos: movimientos.listar(filtros, pagina.porPagina, (pagina.pagina - 1) * pagina.porPagina),
        paginacion: pagina, desde: filtros.desde, hasta: filtros.hasta,
      };
    },
    registrarMovimiento(body, responsable) {
      const datos = validarMovimiento(body);
      return inventario.transaccion(() => {
        const producto = inventario.buscarPorId(datos.productoId);
        if (!producto) throw new HttpError(404, 'Producto no encontrado.');
        const stock = datos.tipo === 'entrada' ? producto.stock + datos.cantidad : datos.cantidad;
        if (stock > MAX_STOCK) throw new HttpError(400, 'La entrada supera el stock máximo permitido.');
        inventario.actualizarStock(producto.id, stock);
        const movimiento = movimientos.crear({
          productoId: producto.id, producto: producto.nombre, sku: producto.sku,
          tipo: datos.tipo, cambio: stock - producto.stock, saldo: stock, stockAnterior: producto.stock,
          motivo: datos.motivo, responsableId: responsable.id, responsable: responsable.nombre,
          fecha: new Date().toISOString(),
        });
        return { movimiento, producto: inventario.buscarPorId(producto.id) };
      });
    },
  };
}
module.exports = { crearInventarioService };
