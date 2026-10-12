# Despliegue con Docker

La imagen contiene Node.js 22 y la aplicación. Compose añade Caddy como proxy HTTPS. **SQL Server y SMTP son externos**: este despliegue no crea un servidor SQL ni traslada los datos de tu computadora. Usa un servidor Linux con Docker Engine y Docker Compose v2, un dominio apuntando a su IP y los puertos TCP 80 y 443 disponibles. No ejecutes otro Nginx/Caddy en esos mismos puertos.

## 1. Configuración

Desde la raíz del repositorio, en el servidor:

```sh
cp .env.docker.example .env.docker
chmod 600 .env.docker
```

Completa `.env.docker` antes de continuar:

- `APP_DOMAIN`: dominio sin protocolo ni ruta; `APP_ORIGIN`: ese mismo dominio con `https://`. `ACME_EMAIL`: correo para los certificados.
- `APP_BASE_PATH`: `/facturacion`, o vacío para servir en la raíz.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`: conexión TCP a SQL Server con autenticación SQL. La autenticación integrada de Windows no se utiliza en esta imagen Linux. Habilita TCP y el acceso desde el servidor Docker en el firewall de SQL Server. `localhost` dentro del contenedor es el propio contenedor.
- `DB_ENCRYPT=true` y `DB_TRUST_CERTIFICATE=false`: SQL Server debe presentar un certificado válido para `DB_HOST`. Para una CA privada, monta su certificado PEM y configura `NODE_EXTRA_CA_CERTS` con su ruta dentro del contenedor. No desactives la validación como configuración de producción.
- `OFFICE_NETWORKS`: IP pública o CIDR de la oficina desde la que iniciarás sesión. Es necesario incluso para el administrador. No uses la subred de Docker ni `0.0.0.0/0` como red de oficina.
- `SMTP_*`, `MAIL_FROM`, `ADMIN_EMAIL` y `COMPANY_*`: datos reales de correo y emisor.

Usa comillas simples para contraseñas que contienen `$` o `#`. Conserva `.env.docker` fuera de Git. Compose fija el entorno de producción, el puerto interno y el controlador SQL, y confía únicamente en la IP del proxy. Si `172.30.80.0/24` se solapa con tu red o VPN, cambia `DOCKER_SUBNET`, `DOCKER_DYNAMIC_RANGE` y `DOCKER_PROXY_IP` juntos. La IP del proxy debe pertenecer a la subred y quedar fuera del rango dinámico para evitar conflictos con la aplicación y los contenedores de mantenimiento.

El acceso remoto fuera de la oficina necesita una base MaxMind de países: coloca el archivo en `deploy/geoip/GeoLite2-Country.mmdb`, establece `GEOIP_DATABASE=/app/geoip/GeoLite2-Country.mmdb` y autoriza acceso remoto al usuario desde Administración. Se conserva la restricción `COUNTRY`; sin GeoIP las ubicaciones fuera de la oficina se rechazan.

## 2. Construir y preparar la base

Todos los comandos se ejecutan desde la raíz del proyecto. Usa siempre `--env-file .env.docker` para no tomar la configuración local de Windows.

```sh
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build --pull app
```

Si la base es nueva o está vacía:

```sh
docker compose --env-file .env.docker run --rm app npm run db:install
docker compose --env-file .env.docker run --rm app npm run acceso
docker compose --env-file .env.docker run --rm app npm run setup
```

En el asistente `acceso`, crea `admin` con rol `administrador` y una contraseña propia. `setup` protege las credenciales de demostración; no reemplaza la contraseña del administrador existente. No hace falta guardar la contraseña del administrador en el archivo de entorno.

Si la base ya contiene la estructura del proyecto, realiza primero un respaldo y usa:

```sh
docker compose --env-file .env.docker run --rm app npm run db:migrate
```

No ejecutes `db:install` sobre una base existente. Para trasladar una instalación local, restaura su respaldo de SQL Server en el servidor de destino antes de migrar. Los comandos de instalación necesitan permisos de creación de base/esquema; los de migración, permisos de modificación del esquema. Usa credenciales de mantenimiento durante estos pasos y después configura `DB_USER`/`DB_PASS` con una cuenta de ejecución limitada a lectura y escritura en la base de la aplicación. No ejecutes la aplicación con `sa`.

## 3. Iniciar y comprobar

```sh
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail=100 app proxy
```

Abre `https://TU_DOMINIO/facturacion/` (o `/` si dejaste vacía la subruta), inicia sesión y comprueba catálogos y generación de PDF. La cola de correo se procesa dentro del servidor; no necesitas otro contenedor de correo ni varias réplicas de la aplicación.

Caddy obtiene y renueva los certificados automáticamente y redirige HTTP a HTTPS. Esto requiere DNS correcto y acceso público a 80/443. Conserva los volúmenes `caddy_data` y `caddy_config` entre despliegues. Consulta la [documentación oficial de HTTPS automático](https://caddyserver.com/docs/automatic-https).

El estado `healthy` comprueba que la interfaz HTTP responde en la subruta configurada. **No certifica la conexión a SQL Server ni la entrega de correo.** Para comprobar SQL sin modificar datos:

```sh
docker compose --env-file .env.docker run --rm app node --input-type=module -e 'const { query, pool } = await import("./server/db.js"); try { await query("SELECT TOP (1) id FROM vendedores"); console.log("SQL OK"); } finally { await pool.end(); }'
docker compose --env-file .env.docker run --rm app node scripts/verify-smtp.js
```

Una aplicación `unhealthy` requiere revisar los registros: Docker Compose reinicia procesos que terminan, pero no reinicia automáticamente por el estado de salud. No publiques el puerto 3000. La configuración está pensada para Caddy conectado directamente a Internet; otro proxy/CDN delante requiere revisar qué proxies son confiables y cómo se conserva la IP real.

## 4. Actualizar y recuperar

Antes de actualizar, respalda SQL Server y conserva la imagen anterior con una etiqueta propia (`IMAGE_TAG`). Obtén la nueva versión del código y cambia la etiqueta para no sobrescribir la imagen anterior:

```sh
docker compose --env-file .env.docker build --pull app
docker compose --env-file .env.docker stop app
docker compose --env-file .env.docker run --rm app npm run db:migrate
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
```

Ejecuta cada paso sólo si el anterior terminó correctamente. Durante las migraciones habrá una ventana de mantenimiento. Si falla la migración, revisa el error antes de levantar la nueva versión. Volver a una imagen anterior exige comprobar su compatibilidad con el esquema; para cambios incompatibles, restaura también el respaldo de SQL Server.

La base externa conserva facturas, usuarios, sesiones, auditoría y cola de correo. Los PDF se generan en memoria. Respalda también `.env.docker`, certificados y archivos GeoIP por un canal privado. No uses `docker compose down -v` para actualizar: elimina los volúmenes.

Para detener manteniendo los datos:

```sh
docker compose --env-file .env.docker down
```

## Detalles de la imagen

La instalación usa el lockfile de pnpm y sólo dependencias de producción. Se omiten scripts de instalación porque `msnodesqlv8` es el controlador nativo de Windows y la imagen utiliza el controlador JavaScript de `mssql` con autenticación SQL. El contexto de construcción excluye secretos, dependencias locales y archivos de pruebas. La aplicación corre con el usuario `node`, sistema de archivos de sólo lectura y directorio temporal. Recibe SIGTERM para el cierre del servidor y sus conexiones.

Las imágenes base siguen las etiquetas `node:22-bookworm-slim` y `caddy:2-alpine` para recibir correcciones al reconstruir/descargar. En un proceso de versiones estricto, fija sus digests después de validar cada actualización.
