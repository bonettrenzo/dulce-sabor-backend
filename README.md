# Dulce Sabor — Backend

API con autenticación e inventario usando Node.js, Express, SQLite, bcrypt y JWT.
El frontend se conectará en una entrega posterior.

## Preparación

Requiere Node.js 22.13 o superior. SQLite utiliza `node:sqlite`, incluido en Node;
no necesitas instalar un servidor de base de datos. Según la versión de Node,
puede mostrarse una advertencia de API experimental.

```bash
npm install
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado en `JWT_SECRET` dentro de `.env`. No subas ese archivo.
Configura `ADMIN_NOMBRE`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` si deseas crear un administrador.

```bash
npm run crear-admin
npm run dev
```

El comando de administrador no cambia cuentas existentes. Una vez creado,
puedes quitar sus credenciales de `.env`. No hay usuarios ni contraseñas predeterminados.

La API escucha en `http://localhost:3000/api`. Los datos persisten en
`data/dulcesabor.sqlite`, excluido de Git. `DB_PATH`, `PORT` y `FRONTEND_URL`
se pueden configurar en `.env`. `npm start` ejecuta sin modo observación.

## Rutas

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Comprobar que la API responde. |
| POST | `/api/auth/register` | Crear un cajero. |
| POST | `/api/auth/login` | Obtener token y usuario. |
| GET | `/api/auth/me` | Consultar el usuario autenticado. |
| POST | `/api/auth/logout` | Invalidar la sesión actual. |

### Registro

```bash
curl -i http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Ana López","email":"ana@example.com","password":"MiClaveSegura123"}'
```

El registro público solo crea cajeros activos y no admite asignar el rol de administrador.
Correo único sin distinción entre mayúsculas y minúsculas. Nombre: 2–100 caracteres.
Contraseña: al menos 8 caracteres y máximo 72 bytes, sin recortarla ni modificarla.

### Inicio de sesión

```bash
curl -i http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"MiClaveSegura123"}'
```

Respuesta:

```json
{
  "ok": true,
  "token": "<JWT>",
  "expiresIn": 3600,
  "user": {
    "id": "<UUID>",
    "nombre": "Ana López",
    "email": "ana@example.com",
    "rol": "cajero",
    "estado": "Activo",
    "creado": "<fecha ISO>",
    "ultimoAcceso": "<fecha ISO>"
  }
}
```

Usa el token devuelto en las rutas protegidas:

```bash
curl http://localhost:3000/api/auth/me -H 'Authorization: Bearer <TOKEN>'
curl -X POST http://localhost:3000/api/auth/logout -H 'Authorization: Bearer <TOKEN>'
```

El token dura una hora; después es necesario iniciar sesión nuevamente.
Logout revoca ese token en el servidor. Cada petición protegida consulta la sesión
y el estado y rol actuales del usuario. Las contraseñas y hashes nunca se devuelven.
Los intentos de login y registro comparten un límite de 20 peticiones por IP cada 15 minutos.
Este límite se guarda en memoria para esta primera versión de un solo proceso.

Errores JSON: `{ "ok": false, "error": "mensaje" }`.
Códigos: 400 datos inválidos, 401 sesión o credenciales inválidas, 403 permisos
insuficientes, 404 ruta inexistente, 409 correo duplicado, 413 cuerpo demasiado
grande y 429 demasiados intentos.

## Inventario

Todas las rutas de inventario requieren un token de un **administrador activo**.
Los cajeros reciben 403. El frontend aún usa sus datos locales; la conexión se hará
por separado.

### Cargar el catálogo inicial

```bash
npm run seed:productos
```

Carga los 18 productos de `src/data/productos.seed.json`, tomados del catálogo del
frontend, conservando IDs, SKU, precios COP, mínimos y existencias. No sobrescribe
productos existentes: se puede ejecutar de nuevo sin reiniciar el stock ni precios.
Se ejecuta en una transacción. Las tablas se agregan al abrir la base, conservando
usuarios y sesiones de la entrega de autenticación.

Esta semilla establece el saldo inicial; no importa los movimientos ficticios del
frontend ni crea ventas históricas. El historial comienza con las operaciones reales
registradas por esta API. No hay una segunda copia del stock: inventario consulta
la tabla `productos`, que compartirán los siguientes módulos.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/inventario` | Existencias filtradas y paginadas. |
| GET | `/api/inventario/resumen` | Indicadores globales. |
| GET | `/api/inventario/alertas` | Productos agotados o con stock bajo. |
| GET | `/api/inventario/opciones` | Categorías y motivos para los formularios. |
| GET | `/api/inventario/movimientos` | Historial filtrado y paginado. |
| POST | `/api/inventario/movimientos` | Registrar una entrada o ajuste. |
| GET | `/api/inventario/:id` | Existencia de un producto. |

### Consultar existencias

```bash
curl 'http://localhost:3000/api/inventario?categoria=Pan%20dulce&estado=bajo&pagina=1&porPagina=6' \
  -H 'Authorization: Bearer <TOKEN_ADMIN>'
```

Filtros opcionales: `busqueda` (nombre o SKU), `categoria`, `estado`
(`disponible`, `bajo`, `agotado` o `todos`), `pagina` y `porPagina`.
`categoria=todas` no restringe la categoría. `porPagina` vale 6 por defecto y admite
hasta 100. Una página mayor que el total se recorta a la última página.

Respuesta de ejemplo:

```json
{
  "ok": true,
  "productos": [{
    "id": "p13", "nombre": "Rol de canela", "sku": "PAN-003",
    "categoria": "Pan dulce", "stock": 3, "minimo": 5,
    "enPos": true, "estado": "bajo"
  }],
  "paginacion": {"pagina": 1, "porPagina": 6, "total": 1, "paginas": 1, "desde": 1, "hasta": 1}
}
```

- `agotado`: stock igual a cero.
- `bajo`: stock mayor que cero e igual o menor al mínimo.
- `disponible`: stock mayor al mínimo.
- `enPos`: el producto está activo en el catálogo; es independiente del estado de stock.

`/resumen` devuelve `{ ok, resumen: { totalProductos, unidades, enAlerta, bajos,
 agotados, disponibles } }`. Los indicadores son globales, sin depender de la página
ni filtros del listado. `/alertas` devuelve `{ ok, alertas: [...] }` con los mismos
campos de las existencias, ordenados por stock. `/opciones` devuelve `{ ok, categorias,
 motivosEntrada, motivosAjuste }`.

### Registrar entrada o ajuste

```bash
curl -X POST http://localhost:3000/api/inventario/movimientos \
  -H 'Authorization: Bearer <TOKEN_ADMIN>' \
  -H 'Content-Type: application/json' \
  -d '{"productoId":"p13","tipo":"entrada","cantidad":12,"motivo":"Proveedor"}'
```

```bash
curl -X POST http://localhost:3000/api/inventario/movimientos \
  -H 'Authorization: Bearer <TOKEN_ADMIN>' \
  -H 'Content-Type: application/json' \
  -d '{"productoId":"p13","tipo":"ajuste","cantidad":2,"motivo":"Conteo físico"}'
```

La entrada **suma** unidades; el ajuste **fija el conteo físico final**, igual que
en `registrarMovimiento` del frontend. Con stock 3, una entrada de 12 deja 15;
un ajuste a 2 deja 2 y registra un cambio de -1 si el saldo anterior era 3.
La cantidad debe ser un número entero JSON: entrada mayor a cero, ajuste igual o
mayor a cero; el límite de stock es 2147483647. No se redondean cantidades inválidas.
Un ajuste al mismo saldo se registra con cambio cero.

El motivo debe corresponder al tipo y estar entre las opciones de `/opciones`.
Las mermas del formulario actual se registran como ajuste con motivo de caducidad
o daño. Las salidas por ventas se incorporarán con el módulo de ventas.

La respuesta 201 es `{ ok: true, movimiento, producto }`; `producto` contiene la
existencia actualizada y `movimiento` conserva:

```json
{
  "id": "mov-1", "referencia": "MOV-0001", "productoId": "p13",
  "producto": "Rol de canela", "sku": "PAN-003", "tipo": "entrada",
  "cambio": 12, "saldo": 15, "stockAnterior": 3, "motivo": "Proveedor",
  "responsableId": "<ID_ADMIN>", "responsable": "Administrador",
  "fecha": "2026-10-29T15:00:00.000Z", "hora": "10:00"
}
```

El responsable se toma de la sesión; los campos `responsable` o `responsableId`
enviados por el cliente no sustituyen al usuario autenticado. Al conectar el frontend,
ese campo del formulario debe mostrarse con el usuario actual.

Stock e historial se guardan juntos dentro de `BEGIN IMMEDIATE` y se revierten juntos
si falla la operación. Las referencias se generan con el ID autoincremental de SQLite.
Los nombres de producto, SKU y responsable quedan conservados en el movimiento.
No hay rutas para editar o eliminar movimientos; las correcciones se registran como
nuevos ajustes.

### Historial

```bash
curl 'http://localhost:3000/api/inventario/movimientos?productoId=p13&tipo=entrada&desde=2026-10-01&hasta=2026-10-29&pagina=1&porPagina=10' \
  -H 'Authorization: Bearer <TOKEN_ADMIN>'
```

Filtros opcionales: `productoId`, `tipo`, `desde`, `hasta`, `pagina`, `porPagina`.
Sin fechas devuelve los movimientos de hoy en **America/Bogota**; una sola fecha
consulta ese día. Con ambas fechas incluye el rango completo. Usa `YYYY-MM-DD`.
La respuesta incluye `{ ok, movimientos, paginacion, desde, hasta }` y se ordena del
más reciente al más antiguo. `porPagina` vale 10 por defecto y admite hasta 100.
Las fechas se guardan en UTC; `hora` y los límites de días se calculan para Colombia.

## Arquitectura

Se mantiene la separación por capas: **ruta → middleware → controlador → servicio → modelo → SQLite**.

```text
src/
  config/         Entorno, conexión y creación de tablas
  constants/      Motivos de inventario y límite de existencias
  controllers/    Respuestas JSON de autenticación e inventario
  services/       Reglas de autenticación, usuarios e inventario
  models/         SQL de usuarios, sesiones, productos, existencias y movimientos
  routes/         Endpoints de autenticación e inventario
  middlewares/    Autenticación, roles, límite de intentos y errores
  validators/     Validación de autenticación y operaciones de inventario
  utils/          Errores HTTP, transacciones, fechas y paginación
  data/           Catálogo inicial de productos para desarrollo
  scripts/        Creación de administrador y carga del catálogo
  app.js          Configura Express y conecta las capas
  server.js       Arranca y cierra el servidor
test/
  auth.test.js
  inventario.test.js
```

Los controladores construyen las respuestas HTTP; los servicios aplican las reglas
y coordinan las operaciones; los modelos concentran las consultas SQL. `app.js`
conecta las dependencias y permite usar bases temporales en las pruebas.
`autorizarRoles` está en `middlewares/auth.middleware.js`.

Quedan para próximas entregas el CRUD de productos, ventas, gestión de usuarios,
recuperación de contraseña, renovación de tokens y conexión del frontend.

## Verificación y commit

```bash
npm test
git add .
git commit -m "feat(inventario): agregar existencias, alertas y movimientos"
```

Las pruebas usan una base en memoria o temporal; no alteran los datos de desarrollo.

Referencias: [Express](https://expressjs.com/en/guide/routing/),
[SQLite de Node](https://nodejs.org/api/sqlite.html),
[jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) y
[bcryptjs](https://github.com/dcodeIO/bcrypt.js).
