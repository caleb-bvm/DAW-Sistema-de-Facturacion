# Sistema de facturación

Aplicación académica con Node.js, JavaScript modular y SQL Server para administrar clientes, productos, vendedores y facturas de consumidor final (CF) y crédito fiscal (CCF). Genera comprobantes PDF y gestiona su envío mediante SMTP.

Los comprobantes muestran **Documento de prueba - sin validez fiscal**. El proyecto no implementa firma ni transmisión de documentos tributarios electrónicos a Hacienda.

## Funcionalidades

- Inicio de sesión, roles de administrador y facturador, contraseñas con scrypt y protección CSRF.
- Restricciones por horario semanal, festivos, vacaciones, bloqueos, redes de oficina y país para acceso remoto.
- Gestión de clientes y productos gravados, exentos y no sujetos.
- Emisión de CF y CCF, historial, descarga de PDF, reenvío y anulación académica por administrador.
- IVA incluido en el precio y comisiones calculadas por línea sobre la base sin IVA.
- Copias históricas de emisor, receptor y productos; correlativos permanentes e identificadores de solicitud para evitar emisiones duplicadas.
- Cola de correo con reintentos, registro de accesos rechazados y alertas al administrador.

## Requisitos

- Node.js 22 o posterior y pnpm.
- SQL Server 2019 o posterior, con una instancia accesible desde la aplicación.
- Para autenticación de Windows: Microsoft ODBC Driver 18 for SQL Server y permisos para la cuenta que ejecuta Node.js.
- Para enviar comprobantes: un servidor SMTP y sus datos de conexión.

El servidor Node.js sirve la interfaz y la API desde el mismo origen. La versión actual sustituye el puente PHP/MySQL; se inicia con `pnpm start`.

## Instalación local

Ejecutar los comandos desde la raíz del proyecto:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

`pnpm-workspace.yaml` permite compilar la dependencia nativa `msnodesqlv8`. Si pnpm solicita autorización para su compilación, permitirla.

Editar `.env` antes de instalar la base:

| Variable | Configuración local |
| --- | --- |
| `APP_ENV` | `development` |
| `APP_ORIGIN` | `http://localhost:3000` |
| `APP_BASE_PATH` | `/facturacion`, como en la plantilla; dejar vacío para servir desde `/` |
| `DB_AUTH` | `windows` para autenticación integrada o `sql` para usuario y contraseña |
| `DB_HOST` | Servidor SQL; la plantilla usa `localhost` |
| `DB_INSTANCE` | La plantilla usa `SQLEXPRESS`; dejar vacío si se usa un puerto fijo |
| `DB_PORT` | Puerto TCP cuando no se configura una instancia con nombre |
| `DB_NAME` | Nombre de la base; por defecto `facturacion_db` |
| `DB_USER`, `DB_PASS` | Credenciales cuando `DB_AUTH=sql` |
| `BOOTSTRAP_ADMIN_PASSWORD` | Contraseña propia de entre 12 y 200 caracteres |

La plantilla permite el certificado autofirmado de SQL Server para desarrollo con `DB_TRUST_CERTIFICATE=true`. En producción, usar un certificado válido y establecer esta variable en `false`.

Para una base nueva o vacía:

```powershell
pnpm db:install
pnpm setup
pnpm start
```

`db:install` crea la base si no existe y aplica el esquema y la migración inicial dentro de una transacción. Rechaza una base que ya tenga tablas. La cuenta de instalación necesita permisos para crear la base cuando corresponda y definir su estructura.

Abrir [http://localhost:3000/facturacion/](http://localhost:3000/facturacion/) e ingresar como `admin` con la contraseña definida en `BOOTSTRAP_ADMIN_PASSWORD`. Si se dejó `APP_BASE_PATH` vacío, abrir [http://localhost:3000/](http://localhost:3000/).

`setup` crea el administrador sólo si no existe; cambiar la variable y repetir el comando no restablece una cuenta existente. Los vendedores de demostración empiezan inactivos y sin contraseña utilizable. El administrador debe asignarles una contraseña, activarlos y configurar sus horarios. Se incluyen sucursales y productos de demostración.

## Migración de una base existente

Para una base SQL Server con la estructura inicial del proyecto, realizar un respaldo, configurar su conexión en `.env` y ejecutar:

```powershell
pnpm db:migrate
pnpm setup
```

La migración se ejecuta en una transacción y se registra en `schema_migrations` para evitar repeticiones. `setup` protege las contraseñas iniciales con scrypt y rechaza hashes PHP existentes que requieren restablecimiento.

Los archivos de `database/` usan T-SQL. Una base anterior de MySQL requiere exportar y trasladar sus datos explícitamente.

## Reglas de cálculo

El precio del catálogo incluye el IVA del 13 % para productos gravados. Por línea se multiplica precio por cantidad, se resta el descuento y se divide el importe resultante entre 1.13 para obtener la base sin IVA. El IVA es la diferencia entre el importe final y la base redondeada. Los productos exentos y no sujetos conservan su clasificación y no extraen IVA.

La comisión se calcula sobre la base sin IVA de cada línea:

| Base por línea sin IVA | Comisión |
| ---: | ---: |
| $0.00 | 0 % |
| $0.01 a $100.00 | 1 % |
| $100.01 a $1,000.00 | 2 % |
| $1,000.01 a $2,000.00 | 3 % |
| Desde $2,000.01 | 4 % |

Por ejemplo, dos unidades a $113.00 en una línea suman $226.00: base de $200.00, IVA de $26.00 y comisión de $4.00. Dos líneas distintas con base de $100.00 cada una generan $2.00 de comisión total.

Los cálculos usan centavos enteros y redondean por línea antes de sumar. El navegador muestra una vista previa; el servidor obtiene los precios del catálogo y valida el cálculo definitivo. El PDF del cliente no incluye las comisiones.

Un CCF requiere un cliente contribuyente con NIT, NRC, actividad económica, dirección y correo. La anulación exige motivo y rol de administrador.

## Acceso y configuración de ubicación

Las restricciones se revisan en cada solicitud. Los facturadores deben tener un horario válido y respetar festivos, vacaciones y bloqueos. Los administradores están exentos de horarios y festivos, pero siguen sujetos a ubicación, estado de cuenta y bloqueos.

- `OFFICE_NETWORKS`: IP o redes CIDR de oficina separadas por comas.
- `COUNTRY`: país permitido; la plantilla usa `SV`.
- `GEOIP_DATABASE`: ruta a una base local MaxMind de países en formato `.mmdb`, necesaria para comprobar ubicaciones fuera de las redes autorizadas.
- `TIMEZONE`: zona utilizada para horarios y fechas; la plantilla usa `America/El_Salvador`.
- `SESSION_MINUTES`: tiempo máximo de inactividad de la sesión.

El acceso remoto requiere habilitar el permiso por usuario y que GeoIP determine el país permitido. Una ubicación desconocida se rechaza. En desarrollo, localhost permite probar sin GeoIP. Cada rechazo se registra y las alertas de correo repetidas se agrupan en ventanas de cinco minutos.

## Correo SMTP

Configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM`. `ADMIN_EMAIL` recibe las alertas de acceso. Las plantillas usan `mail.ourpxi.dev:465` con TLS implícito (`SMTP_SECURE=true`, `SMTP_REQUIRE_TLS=false`); ajustar estos valores al servidor utilizado.

La factura y su correo pendiente se guardan en la misma transacción. La aplicación revisa la cola cada minuto y después de emitir o reenviar un documento. También se puede procesar manualmente:

```powershell
pnpm mail
```

Cada correo tiene hasta cinco intentos automáticos con espera creciente y permite reintento manual de fallidos. El estado «aceptado» indica aceptación por SMTP; la entrega final depende del servidor y del destinatario. Configurar SPF, DKIM y DMARC del dominio para favorecer la entrega.

Para consultar el protocolo SMTP sin autenticar ni enviar mensajes:

```powershell
node --env-file=.env scripts/check-smtp.js
```

Para comprobar conexión y autenticación sin enviar mensajes:

```powershell
node --env-file=.env scripts/verify-smtp.js
```

## Despliegue con HTTPS

Copiar `.env.production.example` a `.env` en el servidor y completar credenciales, datos de empresa (`COMPANY_*`), redes autorizadas y GeoIP. Usar `APP_ENV=production`, un `APP_ORIGIN` HTTPS y `DB_TRUST_CERTIFICATE=false`.

La plantilla está preparada para el origen `https://ourpxi.dev` y la subruta `/facturacion`. `APP_ORIGIN` contiene sólo el origen; la ruta se define en `APP_BASE_PATH`. El servidor redirige `/facturacion` a `/facturacion/` y limita la cookie de sesión a la subruta configurada.

El fragmento [deploy/nginx-facturacion.conf](deploy/nginx-facturacion.conf) se añade al bloque HTTPS existente de Nginx y reenvía la ruta completa a Node.js. El proceso escucha por defecto en `127.0.0.1:3000`. Configurar el arranque y la supervisión del proceso en el servidor.

El proxy debe reenviar `Host`, `X-Forwarded-For` y `X-Forwarded-Proto`. Incluir en `TRUSTED_PROXIES` sólo las IP o redes de proxies controlados; la plantilla asume un proxy local. La API de producción exige HTTPS y sólo acepta las cabeceras de IP y protocolo desde proxies confiables.

La cuenta SQL de ejecución necesita los permisos de lectura y escritura de la aplicación. Usar una cuenta con permisos adicionales para instalar o migrar la estructura.

## Comandos y pruebas

| Comando | Propósito |
| --- | --- |
| `pnpm start` | Iniciar el servidor y el procesamiento periódico de correo |
| `pnpm db:install` | Crear una base nueva y aplicar esquema y migración |
| `pnpm db:migrate` | Migrar una base SQL Server con la estructura inicial |
| `pnpm setup` | Proteger contraseñas iniciales y crear `admin` si falta |
| `pnpm mail` | Procesar un lote de correos pendientes |
| `pnpm test` | Ejecutar pruebas locales; omite la integración si no está habilitada |
| `pnpm test:integration` | Ejecutar la prueba integral sobre SQL Server |
| `node scripts/check-js.js` | Comprobar la sintaxis de los módulos JavaScript |

Las pruebas locales cubren cálculos, acceso, contraseñas, parámetros SQL, sesiones HTTP, archivos privados, subrutas y PDF con paginación. Los PDF de ejemplo se generan en `test-output/`.

### Prueba integral de SQL Server

Usar una base exclusiva para pruebas cuyo nombre termine en `_test`. La prueba crea registros y no los elimina al finalizar.

```powershell
Copy-Item .env.test.example .env.test
node --env-file=.env --env-file=.env.test scripts/install.js
node --env-file=.env --env-file=.env.test scripts/setup.js
pnpm test:integration
```

Antes de ejecutar, comprobar que `.env` usa `APP_ENV=development` y que `.env.test` contiene `DB_NAME=facturacion_test` y `SQL_INTEGRATION=true`. El segundo archivo reemplaza el nombre de la base de desarrollo. Ejecutar instalación y setup sólo cuando se prepare la base de pruebas por primera vez.

La prueba integral comprueba autenticación, emisión CF/CCF, PDF, datos históricos, transacciones, autorización, bloqueos y anulación. Utiliza un SMTP simulado en localhost para los comprobantes generados durante la prueba.

## Estructura del proyecto

```text
assets/                       Interfaz, estilos y calculadoras de vista previa
server/                       HTTP, API, acceso, SQL Server, cálculos, PDF y correo
scripts/                      Instalación, migración, setup y diagnósticos
database/schema.sql          Esquema T-SQL inicial
database/migrations/         Migración de acceso y comprobantes
deploy/                      Configuración de proxy Nginx
tests/                       Pruebas locales e integración SQL Server
storage/                     Archivos locales; contenido ignorado en Git
test-output/                 PDF generados por las pruebas; ignorados en Git
```

Las dependencias directas son `mssql`, `msnodesqlv8`, `pdfkit`, `nodemailer` y `maxmind`. HTTP, contraseñas y pruebas utilizan módulos de Node.js.

Consultar [Sistema de Facturacion.md](Sistema%20de%20Facturacion.md) para la arquitectura y [REQUISITOS-IVA-Y-COMISIONES.md](REQUISITOS-IVA-Y-COMISIONES.md) para las reglas acordadas de cálculo.

## Archivos privados y Git

`.gitignore` excluye `.env` y sus variantes privadas, dependencias, cachés, registros, cobertura, resultados de pruebas y archivos generados de `storage/`. Las plantillas `.env*.example`, `pnpm-lock.yaml`, `storage/.gitkeep` y `storage/.htaccess` se conservan en el repositorio.

Completar contraseñas, remitentes y datos de instalación únicamente en los archivos privados. Compartir las plantillas sin credenciales para documentar la configuración.
