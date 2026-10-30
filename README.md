# Dulce Sabor — Backend

Primera entrega: autenticación con Node.js, Express, SQLite, bcrypt y JWT.
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

## Arquitectura

API organizada por capas, siguiendo la separación de modelos y controladores de MVC.
Las respuestas se entregan en JSON. Los servicios contienen las reglas de negocio.

```text
src/
  config/
    env.js                       Variables de entorno y validación
    database.js                  Conexión SQLite y creación de tablas
  controllers/
    auth.controller.js           Lee peticiones y construye respuestas HTTP
  services/
    auth.service.js              Login, JWT y ciclo de vida de sesiones
    usuario.service.js           Creación de cajeros y administradores
  models/
    usuario.model.js             Consultas y persistencia de usuarios
    sesion.model.js              Consultas y persistencia de sesiones
  routes/
    auth.routes.js               Endpoints y sus middlewares
  middlewares/
    auth.middleware.js           Autenticación y autorización por rol
    auth-limiter.middleware.js   Límite de intentos de autenticación
    error.middleware.js          Respuestas de error y rutas inexistentes
  validators/
    auth.validator.js            Validación de los datos de autenticación
  utils/
    http-error.js                Errores con estado HTTP
  scripts/
    crear-admin.js               Alta del administrador por consola
  app.js                         Configura Express y conecta las capas
  server.js                      Arranca y cierra el servidor
test/
  auth.test.js                   Pruebas HTTP y persistencia
```

Flujo de una petición: **ruta → middleware → controlador → servicio → modelo → SQLite**.
El resultado regresa al controlador, que responde en JSON. Los errores llegan al
middleware central de errores.

- Las rutas declaran URLs, métodos HTTP y controles de acceso.
- Los controladores usan `req` y `res`; delegan las operaciones en los servicios.
- Los servicios aplican reglas de negocio y coordinan modelos, hashes y tokens.
- Los modelos concentran el SQL y reciben la conexión a la base de datos.
- Los middlewares validan la sesión, autorizan roles y unifican los errores.
- Los validadores se reutilizan en los servicios y en el comando de administrador.

`app.js` construye las dependencias por instancia. Las pruebas pueden usar su propia
base sin iniciar `server.js`. El comando de administrador reutiliza el servicio de
usuarios y su modelo, sin duplicar SQL ni lógica de contraseñas.

Para agregar productos, inventario u otros módulos, sigue la misma separación:
`routes`, `controllers`, `services` y `models`. `autorizarRoles` está disponible en
`middlewares/auth.middleware.js` para proteger los próximos módulos administrativos.

No se incluyen todavía productos, inventario, gestión de usuarios, recuperación
de contraseña, renovación de tokens ni conexión del frontend.

## Verificación y commit

```bash
npm test
git add .
git commit -m "feat(auth): agregar autenticación con Express, SQLite y JWT"
```

Las pruebas usan una base en memoria o temporal; no alteran los datos de desarrollo.

Referencias: [Express](https://expressjs.com/en/guide/routing/),
[SQLite de Node](https://nodejs.org/api/sqlite.html),
[jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) y
[bcryptjs](https://github.com/dcodeIO/bcrypt.js).
