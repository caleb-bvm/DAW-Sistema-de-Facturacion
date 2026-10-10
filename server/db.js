const windowsAuthentication = process.env.DB_AUTH === 'windows';
const { default: sql } = await import(windowsAuthentication ? 'mssql/msnodesqlv8.js' : 'mssql');

export { sql };
const odbcValue = (value) => `{${String(value).replaceAll('}', '}}')}}`;
export function databaseOptions(database = process.env.DB_NAME || 'facturacion_db') {
  const server = (process.env.DB_HOST || '127.0.0.1') + (process.env.DB_INSTANCE ? '\\' + process.env.DB_INSTANCE : ',' + (process.env.DB_PORT || 1433));
  return {
    ...(windowsAuthentication ? { connectionString: `Driver=${odbcValue(process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server')};Server=${odbcValue(server)};Database=${odbcValue(database)};Trusted_Connection=Yes;Encrypt=${process.env.DB_ENCRYPT !== 'false' ? 'Yes' : 'No'};TrustServerCertificate=${process.env.DB_TRUST_CERTIFICATE === 'true' ? 'Yes' : 'No'};` } : {}),
    server: (process.env.DB_HOST || '127.0.0.1') + (windowsAuthentication && process.env.DB_INSTANCE ? '\\' + process.env.DB_INSTANCE : ''), database,
    ...(windowsAuthentication ? { driver: process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server' } : {}),
    ...(process.env.DB_INSTANCE ? {} : { port: Number(process.env.DB_PORT || 1433) }),
    ...(windowsAuthentication ? {} : { user: process.env.DB_USER || 'facturacion_app', password: process.env.DB_PASS || '' }),
    options: { instanceName: !windowsAuthentication ? process.env.DB_INSTANCE || undefined : undefined, trustedConnection: windowsAuthentication, encrypt: process.env.DB_ENCRYPT !== 'false', trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true', useUTC: true, abortTransactionOnError: true },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }, connectionTimeout: 5000, requestTimeout: 15000,
  };
}
const nativePool = new sql.ConnectionPool(databaseOptions());
nativePool.on('error', (error) => console.error(`SQL Server: ${error.code || error.name}.`));
let connecting;
export async function connect() {
  if (!connecting) connecting = nativePool.connect().catch((error) => { connecting = undefined; throw error; });
  return connecting;
}
export const pool = { end: async () => { if (connecting) { await connecting.catch(() => {}); await nativePool.close(); connecting = undefined; } } };

// Los valores se enlazan como parámetros; nunca se interpolan en el texto SQL.
export function parameterize(statement, count) {
  let index = 0; let quoted = false; let output = '';
  for (let i = 0; i < statement.length; i++) {
    const ch = statement[i];
    if (ch === "'") {
      output += ch;
      if (quoted && statement[i + 1] === "'") output += statement[++i];
      else quoted = !quoted;
    } else output += ch === '?' && !quoted ? `@arg${index++}` : ch;
  }
  if (index !== count) throw new Error('Cantidad de parámetros SQL incorrecta.');
  return output;
}
export function normalizeRecordset(rows = []) {
  const columns = rows.columns || {};
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const column = columns[key];
    if (value instanceof Date) value = column?.type === sql.Date ? value.toISOString().slice(0, 10) : column?.type === sql.Time ? value.toISOString().slice(11, 19) : sqlNow(value);
    // msnodesqlv8 omite scale; todas las columnas DECIMAL del esquema usan dos decimales.
    else if (value !== null && (typeof value === 'number' || typeof value === 'string') && (column?.type === sql.Decimal || column?.type === sql.Numeric)) value = Number(value).toFixed(column.scale ?? 2);
    return [key, value];
  })));
}
export function isUniqueViolation(error) { return [2601, 2627].includes(error.number ?? error.originalError?.info?.number); }
const identities = new Set(['auditoria', 'clientes', 'vendedores', 'productos', 'facturas', 'factura_detalles', 'horarios_acceso', 'bloqueos_acceso', 'sesiones', 'intentos_acceso', 'correos']);
export async function query(statement, params = [], connection) {
  const target = connection || await connect(); const request = new sql.Request(target);
  params.forEach((value, i) => {
    if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw new Error('Parámetro numérico SQL inválido.'); request.input(`arg${i}`, sql.BigInt, value); }
    else if (typeof value === 'boolean') request.input(`arg${i}`, sql.Bit, value);
    else request.input(`arg${i}`, sql.NVarChar(sql.MAX), value ?? null);
  });
  let statementText = parameterize(statement, params.length);
  const insert = statementText.match(/^INSERT INTO (\w+)\s*\([^)]+\)\s*VALUES/i);
  if (insert && identities.has(insert[1])) statementText = statementText.replace(/\)\s*VALUES/i, ') OUTPUT INSERTED.id VALUES');
  const result = await request.query(statementText);
  if (insert) return { insertId: result.recordset?.[0]?.id, affectedRows: result.rowsAffected.reduce((sum, n) => sum + n, 0) };
  return result.recordset ? normalizeRecordset(result.recordset) : { affectedRows: result.rowsAffected.reduce((sum, n) => sum + n, 0) };
}
export async function transaction(work) {
  const connection = new sql.Transaction(await connect()); let rolledBack = false;
  connection.on('rollback', () => { rolledBack = true; });
  await connection.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try { const result = await work(connection); await connection.commit(); return result; }
  catch (error) { if (!rolledBack) await connection.rollback(); throw error; }
}
export function sqlNow(date = new Date()) { return date.toISOString().slice(0, 19).replace('T', ' '); }

export async function executeSqlBatches(source, connection) {
  for (const batch of source.split(/^\s*GO\s*$/gmi).map((part)=>part.trim()).filter(Boolean)) await new sql.Request(connection).batch(batch);
}
