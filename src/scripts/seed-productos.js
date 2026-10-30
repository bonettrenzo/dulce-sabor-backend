const { abrirDb } = require('../config/database');
const { crearProductoModel } = require('../models/producto.model');
const { transaccion } = require('../utils/transaccion');
const productos = require('../data/productos.seed.json');

// Catálogo inicial del frontend: no sobrescribe fichas ni existencias existentes.
function cargarProductos(db) {
  const modelo = crearProductoModel(db);
  return transaccion(db, () => productos.reduce((total, producto) => total + modelo.insertarSiNoExiste(producto), 0));
}
if (require.main === module) {
  const db = abrirDb(process.env.DB_PATH || './data/dulcesabor.sqlite');
  try { console.log(`Productos insertados: ${cargarProductos(db)}.`); }
  finally { db.close(); }
}
module.exports = { cargarProductos };
