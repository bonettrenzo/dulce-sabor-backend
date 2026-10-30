const { HttpError } = require('../utils/http-error');
const { fechaColombia } = require('../utils/fecha');
const { MOTIVOS_ENTRADA, MOTIVOS_AJUSTE, MAX_STOCK } = require('../constants/inventario');

function texto(valor, campo, maximo = 100) {
  if (valor === undefined) return '';
  if (typeof valor !== 'string' || valor.trim().length > maximo) {
    throw new HttpError(400, `${campo} debe ser un texto de máximo ${maximo} caracteres.`);
  }
  return valor.trim();
}
function enteroQuery(valor, campo, defecto, maximo) {
  if (valor === undefined) return defecto;
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) ||
      !Number.isSafeInteger(Number(valor)) || Number(valor) > maximo) {
    throw new HttpError(400, `${campo} debe ser un entero entre 1 y ${maximo}.`);
  }
  return Number(valor);
}
function validarPaginacion(query, defecto = 6) {
  return {
    pagina: enteroQuery(query.pagina, 'pagina', 1, 1000000),
    porPagina: enteroQuery(query.porPagina, 'porPagina', defecto, 100),
  };
}
function validarFiltrosInventario(query) {
  const categoria = texto(query.categoria, 'categoria');
  const estado = texto(query.estado, 'estado');
  if (!['', 'todos', 'disponible', 'bajo', 'agotado'].includes(estado)) {
    throw new HttpError(400, 'Estado de inventario inválido.');
  }
  return {
    ...validarPaginacion(query), busqueda: texto(query.busqueda, 'busqueda').toLowerCase(),
    categoria: categoria === 'todas' ? '' : categoria,
    estado: estado === 'todos' ? '' : estado,
  };
}
function validarFecha(valor, campo) {
  const fecha = texto(valor, campo, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      !Number.isFinite(Date.parse(`${fecha}T00:00:00Z`)) ||
      new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) !== fecha) {
    throw new HttpError(400, `${campo} debe ser una fecha válida YYYY-MM-DD.`);
  }
  return fecha;
}
function validarFiltrosMovimientos(query) {
  const tipo = texto(query.tipo, 'tipo');
  if (!['', 'todos', 'entrada', 'ajuste', 'venta', 'merma'].includes(tipo)) {
    throw new HttpError(400, 'Tipo de movimiento inválido.');
  }
  const desde = validarFecha(query.desde ?? query.hasta ?? fechaColombia(), 'desde');
  const hasta = validarFecha(query.hasta ?? query.desde ?? desde, 'hasta');
  if (desde > hasta) throw new HttpError(400, 'desde no puede ser posterior a hasta.');
  const inicio = new Date(`${desde}T00:00:00-05:00`);
  const fin = new Date(`${hasta}T00:00:00-05:00`);
  fin.setUTCDate(fin.getUTCDate() + 1);
  return {
    ...validarPaginacion(query, 10), productoId: texto(query.productoId, 'productoId'),
    tipo: tipo === 'todos' ? '' : tipo, desde, hasta,
    inicio: inicio.toISOString(), fin: fin.toISOString(),
  };
}
function validarMovimiento(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Envía un objeto JSON.');
  const productoId = texto(body.productoId, 'productoId');
  if (!productoId) throw new HttpError(400, 'Selecciona un producto.');
  if (!['entrada', 'ajuste'].includes(body.tipo)) throw new HttpError(400, 'Solo se permiten entradas y ajustes manuales.');
  const minimo = body.tipo === 'entrada' ? 1 : 0;
  if (!Number.isSafeInteger(body.cantidad) || body.cantidad < minimo || body.cantidad > MAX_STOCK) {
    throw new HttpError(400, `cantidad debe ser un entero entre ${minimo} y ${MAX_STOCK}.`);
  }
  const motivo = texto(body.motivo, 'motivo');
  const motivos = body.tipo === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_AJUSTE;
  if (!motivos.includes(motivo)) throw new HttpError(400, 'El motivo no corresponde al tipo de movimiento.');
  return { productoId, tipo: body.tipo, cantidad: body.cantidad, motivo };
}
module.exports = { validarFiltrosInventario, validarFiltrosMovimientos, validarMovimiento };
