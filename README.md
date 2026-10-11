<div align="center">

<img src="assets/img/favicon.svg" alt="Sistema de facturación" width="72">

# Sistema de facturación

**Gestión de clientes, productos y comprobantes con IVA incluido y comisiones por vendedor.**

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?logo=javascript&logoColor=black)
![SQL Server](https://img.shields.io/badge/SQL_Server-2019%2B-CC2927)
![Proyecto académico](https://img.shields.io/badge/Proyecto-Acad%C3%A9mico-2563EB)

[Características](#características) · [Instalación](#instalación) · [Pruebas](#pruebas) · [Documentación](#documentación)

</div>

Aplicación desarrollada para la asignatura de Desarrollo de Aplicaciones Web (DAW). La interfaz utiliza HTML, CSS y JavaScript modular; Node.js sirve la aplicación y la API, y SQL Server almacena los datos. Incluye comprobantes de consumidor final (CF), crédito fiscal (CCF), descarga de PDF y envío por SMTP.

> **Uso académico:** los comprobantes muestran «Documento de prueba - sin validez fiscal». La aplicación no implementa firma ni transmisión de documentos tributarios electrónicos a Hacienda.

## Características

| Área | Funcionalidades |
| --- | --- |
| Facturación | CF y CCF, historial, PDF, reenvío y anulación por administrador |
| Catálogos | Clientes, sucursales y productos gravados, exentos y no sujetos |
| Cálculos | IVA incluido, descuentos y comisiones por línea sin IVA |
| Usuarios | Roles de administrador y facturador, correos editables, horarios y permiso remoto |
| Acceso | Festivos, vacaciones, bloqueos, redes de oficina y país permitido |
| Seguridad | Contraseñas con scrypt, sesiones en servidor, protección CSRF y auditoría |
| Correo | PDF adjunto, cola persistente, reintentos y alertas de acceso |

Los comprobantes conservan copias históricas de emisor, receptor y productos. El servidor genera los correlativos y reconoce solicitudes de emisión repetidas para evitar facturas duplicadas. Cada facturador consulta sus documentos; el administrador puede consultar todos.

## Tecnologías y arquitectura

```mermaid
flowchart LR
    A["Interfaz HTML, CSS y JavaScript"] --> B["Servidor Node.js / API"]
    B --> C["SQL Server"]
    B --> D["Comprobantes PDF"]
    B --> E["Cola de correo / SMTP"]
```

| Componente | Tecnología |
| --- | --- |
| Interfaz y vista previa | HTML, CSS y JavaScript con módulos ES |
| Servidor HTTP y pruebas | Módulos nativos de Node.js |
| Base de datos | SQL Server, `mssql` y `msnodesqlv8` |
| PDF | `pdfkit` |
| Correo | `nodemailer` |
| Ubicación por país | `maxmind` y base local `.mmdb` |

Las clases de cálculo de la interfaz demuestran herencia y polimorfismo mediante el contrato `calcular()`. El servidor valida los importes usando los precios del catálogo antes de guardar.

## Instalación

### Despliegue en servidor con Docker

Se incluyen `Dockerfile`, `compose.yaml` y un proxy Caddy con HTTPS automático. La aplicación corre sin privilegios y se conecta a un **SQL Server externo mediante autenticación SQL**.

Copia `.env.docker.example` a `.env.docker`, completa dominio, conexión SQL, correo y redes de oficina, y sigue la [guía de despliegue Docker](deploy/DOCKER.md) para construir la imagen, preparar la base y arrancar los servicios. La guía incluye comprobaciones, migraciones, respaldos y actualizaciones.

### Acceso rápido desde PowerShell o Visual Studio Code

En una instalación que ya tiene dependencias, `.env` y base de datos configurados, abre la terminal en la carpeta del proyecto:

```powershell
npm.cmd run acceso
npm.cmd start
```

`acceso` muestra todos los usuarios existentes con su rol y estado. Escribe el usuario que quieres usar (Enter selecciona `admin`). Si existe, escribe `CAMBIAR` para restablecer su contraseña; si no existe, el asistente permite elegir entre administrador y facturador. Al restablecer una cuenta existente se conserva su rol. Puedes escribir una contraseña de 12 a 200 caracteres —no se muestra mientras la escribes— o pulsar Enter para generar una, que se muestra una sola vez. Cancelar no cambia las credenciales. El comando no requiere buscar ni editar la contraseña en `.env`.

Abre la dirección que muestra el servidor y conserva la terminal abierta. **Ctrl + C** detiene el servidor. Estos comandos funcionan sin instalar pnpm si las dependencias ya están instaladas. `npm.cmd` evita el bloqueo de scripts de PowerShell que puede afectar a `npm.ps1`.

El restablecimiento cierra las sesiones de esa cuenta y conserva sus permisos y bloqueos. También puedes gestionar las contraseñas desde **Administración → Usuarios → Usuarios y permisos → Editar** y asigna una nueva contraseña. Las claves se guardan como hashes y no se pueden recuperar como texto; el comando local permite reemplazarlas.

En un servidor nuevo, configura la conexión SQL en `.env`, instala las dependencias y ejecuta `npm.cmd run db:install`, luego `npm.cmd run acceso` y `npm.cmd start`. Si la base ya existe, utiliza `npm.cmd run db:migrate` en lugar de `db:install`. El asistente se ejecuta en la consola del servidor; no es una página pública para restablecer contraseñas.

### Requisitos

- Node.js 22 o posterior y pnpm.
- SQL Server 2019 o posterior.
- Para autenticación de Windows: Microsoft ODBC Driver 18 for SQL Server y acceso a la instancia para la cuenta que ejecuta Node.js.
- Un servidor SMTP para enviar correos.

### 1. Clonar e instalar

```powershell
git clone https://github.com/caleb-bvm/DAW-Sistema-de-Facturaci-n.git
cd DAW-Sistema-de-Facturaci-n
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Los ejemplos de instalación utilizan PowerShell. En otra terminal, copiar `.env.example` a `.env` con el comando correspondiente. `pnpm-workspace.yaml` permite compilar la dependencia nativa `msnodesqlv8`; autorizar su compilación si pnpm lo solicita.

### 2. Configurar el entorno

Editar `.env` con los datos de la instalación:

| Variable | Valor o uso |
| --- | --- |
| `APP_ENV` | `development` para desarrollo local |
| `APP_ORIGIN` | `http://localhost:3000` para desarrollo local |
| `APP_BASE_PATH` | `/facturacion`; dejar vacío para servir desde `/` |
| `DB_AUTH` | `windows` o `sql` |
| `DB_HOST` | Dirección de SQL Server; la plantilla usa `localhost` |
| `DB_INSTANCE` | `SQLEXPRESS` en la plantilla; vacío si se usa un puerto fijo |
| `DB_PORT` | Puerto TCP cuando no se configura una instancia con nombre |
| `DB_NAME` | `facturacion_db` o el nombre elegido |
| `DB_USER`, `DB_PASS` | Credenciales para `DB_AUTH=sql` |
| `BOOTSTRAP_ADMIN_PASSWORD` | Contraseña propia de entre 12 y 200 caracteres |

La plantilla usa `DB_TRUST_CERTIFICATE=true` para certificados autofirmados en desarrollo. En producción, utilizar un certificado válido y configurar `false`.

### 3. Preparar la base e iniciar

Para una base nueva o vacía:

```powershell
pnpm db:install
pnpm setup
pnpm start
```

Abrir **[http://localhost:3000/facturacion/](http://localhost:3000/facturacion/)** e ingresar con el usuario `admin` y la contraseña configurada en `BOOTSTRAP_ADMIN_PASSWORD`. Si `APP_BASE_PATH` está vacío, abrir [http://localhost:3000/](http://localhost:3000/).

`db:install` crea la base si hace falta y aplica el esquema y todas las migraciones. Requiere permisos para crear la base y su estructura, y rechaza bases que ya tengan tablas. `setup` crea `admin` sólo si no existe; repetir el comando no restablece su contraseña.

Los vendedores de demostración empiezan inactivos y sin contraseña utilizable. Desde la administración se les asigna contraseña, se activan y se configuran sus horarios. Se incluyen productos y sucursales de demostración.

<details>
<summary><strong>Migrar una base SQL Server existente</strong></summary>

Realizar un respaldo y configurar la conexión a una base con la estructura inicial del proyecto:

```powershell
pnpm db:migrate
pnpm setup
```

La migración es transaccional y se registra en `schema_migrations` para evitar repeticiones. `setup` protege contraseñas iniciales con scrypt y rechaza hashes PHP existentes que requieren restablecimiento. Los archivos de `database/` usan T-SQL; los datos de una base MySQL deben exportarse y trasladarse explícitamente.

</details>

## Cambiar correos desde Administración

En **Administración → Usuarios → Usuarios y permisos**, pulsa **Editar** en cualquier cuenta, incluida la del administrador, cambia **Correo electrónico** y pulsa **Guardar usuario**. Deja la contraseña vacía para conservarla. El correo es opcional para permitir cuentas existentes sin dirección registrada; si se completa, se valida su formato.

En **Correo de alertas del administrador**, cambia el destinatario y pulsa **Guardar correo de alertas**. Este correo se configura por separado del correo personal de cada cuenta. El cambio queda guardado en SQL Server y se aplica a nuevas alertas sin reiniciar; los mensajes ya en cola conservan su destinatario. Sólo los administradores pueden realizar estos cambios y las operaciones quedan auditadas.

Para actualizar una instalación existente, ejecuta `pnpm db:migrate` antes de usar la nueva versión. La migración `002_correos_administrables` agrega los campos necesarios sin modificar los correos de clientes ni los datos históricos.

## Navegación y uso de Administración

Administración se divide en ocho vistas con enlaces propios: Resumen, Usuarios, Horarios, Bloqueos, Festivos, Correos, Actividad y Configuración. El resumen ofrece accesos directos y contadores; los registros de actividad y correo muestran hasta los últimos 200 resultados disponibles.

En Usuarios, consulta el listado o pulsa **Crear usuario** / **Editar** para abrir el formulario. Usa **Cancelar** para cerrarlo. Los errores aparecen junto al formulario y conservan lo escrito. Los listados de administración, clientes, productos e historial incluyen búsqueda por texto y páginas de diez registros; la búsqueda ignora mayúsculas y acentos.

Horarios muestra sólo facturadores y conserva la selección después de guardar. Bloqueos excluye la cuenta administradora en uso. Los enlaces permiten volver con los botones del navegador y recargar una sección directamente. En móvil, el menú se cierra al elegir una vista, tocar fuera o pulsar Escape.

### Editor semanal de horarios

En **Administración → Horarios**, busca un facturador y selecciónalo. Cada día permite activar o desactivar el acceso, agregar varias sesiones y ajustar sus horas. Las plantillas de lunes a viernes ofrecen jornada continua (08:00–17:00) o con almuerzo (08:00–12:00 y 13:00–17:00). También puedes copiar las sesiones del lunes a martes–viernes.

El resumen muestra las horas efectivas y los días con acceso. Las horas inválidas o superpuestas se señalan en el día correspondiente e impiden guardar. Los cambios sólo se aplican al pulsar **Guardar horario**; **Descartar cambios** recupera la última versión guardada. Cambiar de usuario o seguir un enlace con cambios pendientes solicita confirmación. Quitar todas las sesiones requiere confirmar que el usuario quedará sin acceso.

El horario usa la zona indicada en pantalla. Una cuenta inactiva o bloqueada continúa sin acceso aunque tenga un horario válido.

### Bloqueo permanente

En **Administración → Bloqueos**, selecciona el usuario, elige **Bloqueo permanente**, indica el motivo y pulsa **Crear bloqueo**. Se aplica inmediatamente, cierra sus sesiones y no requiere fechas. Aparece en el listado de bloqueos permanentes, desde donde puedes quitarlo. Al quitarlo se conservan los demás permisos y restricciones. El sistema impide bloquear tu propia cuenta o dejar sin administradores activos la instalación.

## Facturar sin registrar un cliente

Para consumidor final, deja **Cliente (opcional)** en **Sin cliente · Consumidor final**. El comprobante se guarda con ese nombre y permite descargar o imprimir el PDF, sin crear un cliente en el catálogo ni enviar correos. Si seleccionas un cliente registrado, se mantiene el envío a su correo.

El crédito fiscal sigue requiriendo un cliente contribuyente con sus datos completos.

## IVA y comisiones

Los precios gravados incluyen el IVA del 13 %. Por línea, el sistema calcula `precio × cantidad − descuento`, divide el resultado entre `1.13` para obtener la base y determina el IVA por diferencia. Los productos exentos y no sujetos conservan su clasificación y no extraen IVA.

| Base por línea sin IVA | Comisión |
| ---: | ---: |
| $0.00 | 0 % |
| $0.01 a $100.00 | 1 % |
| $100.01 a $1,000.00 | 2 % |
| $1,000.01 a $2,000.00 | 3 % |
| Desde $2,000.01 | 4 % |

**Ejemplo:** dos unidades a $113.00 en una línea suman $226.00: base de $200.00, IVA de $26.00 y comisión de $4.00. Dos líneas distintas con base de $100.00 cada una generan $2.00 de comisión total.

Los cálculos usan centavos enteros y redondean por línea antes de sumar. El PDF del cliente omite las comisiones. Un CCF requiere un cliente contribuyente con NIT, NRC, actividad económica, dirección y correo.

## Comandos

| Comando | Descripción |
| --- | --- |
| `pnpm start` | Inicia el servidor y el procesamiento periódico de correo |
| `pnpm db:install` | Prepara una base nueva o vacía |
| `pnpm db:migrate` | Migra una base SQL Server con la estructura inicial |
| `pnpm setup` | Protege contraseñas iniciales y crea el administrador si falta |
| `npm.cmd run acceso` | Asistente para crear usuarios y restablecer contraseñas de administradores y facturadores |
| `pnpm mail` | Procesa un lote de correos pendientes |
| `pnpm test` | Ejecuta las pruebas locales |
| `pnpm test:integration` | Ejecuta la prueba integral de SQL Server |
| `node scripts/check-js.js` | Comprueba la sintaxis de los módulos JavaScript |

## Pruebas

```powershell
pnpm test
node scripts/check-js.js
```

Las pruebas cubren cálculos, restricciones de acceso, contraseñas, parámetros SQL, sesiones HTTP, archivos privados, subrutas y PDF con paginación. Los PDF de ejemplo se generan en `test-output/`. La prueba de integración se omite si `SQL_INTEGRATION` no está habilitada.

<details>
<summary><strong>Preparar y ejecutar la prueba integral</strong></summary>

Utilizar una base exclusiva cuyo nombre termine en `_test`. La prueba crea registros y los conserva al finalizar.

```powershell
Copy-Item .env.test.example .env.test
node --env-file=.env --env-file=.env.test scripts/install.js
node --env-file=.env --env-file=.env.test scripts/setup.js
pnpm test:integration
```

Comprobar que `.env` usa `APP_ENV=development` y que `.env.test` contiene `DB_NAME=facturacion_test` y `SQL_INTEGRATION=true`. El segundo archivo reemplaza el nombre de la base. Los pasos de instalación y setup se ejecutan sólo al preparar la base de pruebas por primera vez.

La prueba comprueba autenticación, emisión CF/CCF, PDF, datos históricos, transacciones, autorización, bloqueos y anulación. Utiliza un SMTP simulado en localhost para los comprobantes generados durante la prueba.

</details>

## Configuración adicional

<details>
<summary><strong>Horarios, ubicación y acceso remoto</strong></summary>

Las restricciones se revisan en cada solicitud. Los facturadores deben respetar horarios, festivos, vacaciones y bloqueos. Los administradores están exentos de horarios y festivos; siguen sujetos a ubicación, estado de cuenta y bloqueos.

| Variable | Uso |
| --- | --- |
| `OFFICE_NETWORKS` | IP o redes CIDR de oficina, separadas por comas |
| `COUNTRY` | País permitido; la plantilla usa `SV` |
| `GEOIP_DATABASE` | Ruta a una base local MaxMind de países `.mmdb` |
| `TIMEZONE` | Zona para fechas y horarios; `America/El_Salvador` en la plantilla |
| `SESSION_MINUTES` | Duración máxima de inactividad de la sesión |

Fuera de las redes autorizadas, el acceso requiere permiso remoto por usuario y un país permitido determinado por GeoIP. Se rechazan ubicaciones desconocidas. En desarrollo, localhost permite probar sin GeoIP. Los rechazos se registran y las alertas repetidas se agrupan en ventanas de cinco minutos.

</details>

<details>
<summary><strong>Correo SMTP y diagnósticos</strong></summary>

Configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM`. `ADMIN_EMAIL` define el destinatario inicial de alertas de acceso, hasta que se guarde uno desde Administración. Las plantillas contienen un servidor de ejemplo que debe ajustarse a la instalación. Para TLS implícito en el puerto 465, usar `SMTP_SECURE=true` y `SMTP_REQUIRE_TLS=false`.

La factura y su correo pendiente se guardan en una misma transacción. La cola se procesa cada minuto y después de emitir o reenviar. Cada correo dispone de hasta cinco intentos automáticos con espera creciente y reintento manual de fallidos. La aceptación por SMTP no confirma entrega en la bandeja del destinatario.

```powershell
# Consultar el protocolo sin autenticar ni enviar mensajes
node --env-file=.env scripts/check-smtp.js

# Verificar conexión y autenticación sin enviar mensajes
node --env-file=.env scripts/verify-smtp.js
```

Configurar SPF, DKIM y DMARC del dominio para favorecer la entrega.

</details>

<details>
<summary><strong>Despliegue con HTTPS y Nginx</strong></summary>

Para Docker con HTTPS incluido, seguir la [guía Docker](deploy/DOCKER.md) y usar [.env.docker.example](.env.docker.example). Para una instalación directa de Node detrás de Nginx, partir de [.env.example](.env.example), completar credenciales, datos `COMPANY_*`, redes autorizadas y GeoIP. Configurar `APP_ENV=production`, `APP_ORIGIN=https://tu-dominio.com` y `DB_TRUST_CERTIFICATE=false`.

`APP_ORIGIN` contiene sólo el origen; la subruta se define mediante `APP_BASE_PATH`. La plantilla utiliza `/facturacion`. El servidor redirige `/facturacion` a `/facturacion/` y limita la cookie de sesión a esa ruta.

Añadir [deploy/nginx-facturacion.conf](deploy/nginx-facturacion.conf) al bloque HTTPS de Nginx. El proxy conserva la ruta y reenvía `Host`, `X-Forwarded-For` y `X-Forwarded-Proto` a Node.js, que escucha por defecto en `127.0.0.1:3000`. Configurar la supervisión y el arranque del proceso en el servidor.

Incluir en `TRUSTED_PROXIES` sólo proxies controlados. La API de producción exige HTTPS y acepta las cabeceras reenviadas únicamente desde proxies confiables. La cuenta SQL de ejecución necesita los permisos de lectura y escritura de la aplicación; la instalación y migración requieren permisos adicionales.

</details>

## Estructura del proyecto

```text
DAW-Sistema-de-Facturaci-n/
├── assets/                   Interfaz, estilos y calculadoras
├── database/
│   ├── schema.sql            Esquema T-SQL inicial
│   └── migrations/           Migraciones de SQL Server
├── deploy/                   Configuración de Nginx
├── scripts/                  Instalación, migración y diagnósticos
├── server/                   API, acceso, cálculos, PDF y correo
├── storage/                  Archivos locales generados
├── tests/                    Pruebas locales e integración
├── .env.example              Plantilla de desarrollo
├── .env.docker.example       Plantilla de producción con Docker
├── Dockerfile               Imagen de la aplicación
├── compose.yaml             Aplicación y proxy HTTPS
├── .env.test.example         Plantilla de integración
├── index.html                Entrada de la interfaz
└── package.json              Dependencias y comandos
```

## Documentación

- [Guía de arquitectura y decisiones](Sistema%20de%20Facturacion.md).
- [Reglas de IVA incluido y comisiones](REQUISITOS-IVA-Y-COMISIONES.md).
- [Plantilla de configuración local](.env.example).
- [Configuración del proxy Nginx](deploy/nginx-facturacion.conf).


### Mejoras de captura y actividad

- Productos y clientes muestran el catálogo y abren el formulario con **Nuevo** o **Editar**. Los datos fiscales del cliente se despliegan al activar crédito fiscal.
- Nueva factura conserva el borrador al navegar a otras vistas, durante la sesión de la pestaña. Recargar o cerrar sesión lo descarta. **Vaciar borrador** permite empezar de nuevo.
- Las líneas permiten buscar productos por código o descripción, detectan duplicados y limitan el descuento al importe de la línea. En pantallas pequeñas se muestran como tarjetas.
- Administración → Actividad ofrece búsqueda, categoría, estado, fechas UTC, paginación y detalle del evento. Las horas del listado se presentan en la zona configurada. Los correos muestran su último estado, no cada intento histórico.
- La migración `003_detalle_auditoria.sql` añade contexto a las nuevas operaciones (IP, origen y datos relevantes, sin contraseñas ni tokens). Los eventos antiguos conservan sus datos originales.
