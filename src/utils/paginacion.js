function paginacion(total, pagina, porPagina) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, paginas);
  return {
    pagina: actual, porPagina, total, paginas,
    desde: total === 0 ? 0 : (actual - 1) * porPagina + 1,
    hasta: Math.min(actual * porPagina, total),
  };
}
module.exports = { paginacion };
