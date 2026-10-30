const ZONA_HORARIA = 'America/Bogota';
function fechaColombia(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha);
  const valor = tipo => partes.find(parte => parte.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
function horaColombia(fecha) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA_HORARIA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(fecha));
}
module.exports = { fechaColombia, horaColombia };
