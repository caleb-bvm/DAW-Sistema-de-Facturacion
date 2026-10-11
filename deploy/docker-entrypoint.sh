#!/usr/bin/env bash
# Entry point del contenedor de la aplicación.
# 1. Espera a SQL Server y crea/ajusta el login de la aplicación (DB_USER) con
#    la cuenta sa cuando MSSQL_SA_PASSWORD está definido.
# 2. Crea la base y aplica el esquema si no existen (idempotente; equivale a
#    pnpm db:install).
# 3. Ejecuta setup para crear el admin si BOOTSTRAP_ADMIN_PASSWORD está definido
#    (equivale a pnpm setup).
# 4. Inicia el servidor.
# Si se pasa una orden (por ejemplo `docker compose exec app pnpm test`),
# se ejecuta directamente sin realizar los pasos anteriores.
set -euo pipefail

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

MAX_ATTEMPTS=${DB_WAIT_ATTEMPTS:-30}
DELAY=${DB_WAIT_DELAY:-5}

# retry <orden...>: reintenta la orden mientras SQL Server arranca. Si la orden
# falla pero su salida coincide con ACCEPT_PATTERN, se toma por éxito.
retry() {
  local attempt output
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    if output=$("$@" 2>&1); then
      printf '%s\n' "$output"
      return 0
    fi
    if [ -n "${ACCEPT_PATTERN:-}" ] && printf '%s' "$output" | grep -q "$ACCEPT_PATTERN"; then
      echo "La base ya existe con su esquema; se omite la instalación."
      return 0
    fi
    if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
      printf '%s\n' "$output" >&2
      echo "Se agotaron los $MAX_ATTEMPTS intentos de: $*" >&2
      return 1
    fi
    echo "SQL Server aún no disponible (intento $attempt/$MAX_ATTEMPTS); reintento en ${DELAY}s..."
    sleep "$DELAY"
  done
}

echo "Esperando a SQL Server en ${DB_HOST:-db}:${DB_PORT:-1433} (base ${DB_NAME:-facturacion_db})..."

# Con autenticación SQL, la app usa un login propio. El contenedor lo crea con
# sa para que el usuario no tenga que hacerlo a mano.
if [ -n "${MSSQL_SA_PASSWORD:-}" ] && [ -n "${DB_USER:-}" ] && [ "${DB_USER,,}" != "sa" ]; then
  if [ -z "${DB_PASS:-}" ]; then
    echo "Define DB_PASS en .env: el contenedor creará el login ${DB_USER} con esa contraseña." >&2
    exit 1
  fi
  retry node deploy/create-sql-login.js
fi

ACCEPT_PATTERN='ya tiene tablas' retry node scripts/install.js

if [ -n "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
  node scripts/setup.js
else
  echo "BOOTSTRAP_ADMIN_PASSWORD no definido; se omite la creación del admin inicial."
fi

exec node --env-file-if-exists=.env server/index.js
