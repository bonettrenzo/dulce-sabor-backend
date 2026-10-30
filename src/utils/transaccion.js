// La operación debe ser síncrona: el bloqueo cubre lectura, stock e historial.
function transaccion(db, operacion) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = operacion();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
module.exports = { transaccion };
