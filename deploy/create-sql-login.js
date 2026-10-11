// Aprovisiona el login de la aplicación en SQL Server usando la cuenta sa del
// contenedor. Lo ejecuta deploy/docker-entrypoint.sh antes de install: si el
// login (DB_USER) no existe, se crea con DB_PASS; si existe, la contraseña se
// ajusta a DB_PASS para que .env sea la fuente de verdad. Se añade a sysadmin
// porque db:install necesita crear la base y aplicar el esquema; en un SQL
// Server administrado externamente esta creación no aplica (ya la hace el DBA).
import { sql, databaseOptions } from '../server/db.js';

const user = process.env.DB_USER || 'facturacion_app';
const password = process.env.DB_PASS || '';
const adminPassword = process.env.MSSQL_SA_PASSWORD || '';
if (!adminPassword) throw new Error('Define MSSQL_SA_PASSWORD para aprovisionar el login de la aplicación.');
if (!password) throw new Error('Define DB_PASS: será la contraseña del login de la aplicación.');

// Escapados para literales N'...' y para identificadores entre corchetes.
const literal = (value) => `N'${String(value).replaceAll("'", "''")}'`;
const bracket = (value) => String(value).replaceAll(']', ']]');

const pool = await new sql.ConnectionPool({ ...databaseOptions('master'), user: 'sa', password: adminPassword }).connect();
try {
  const exists = await pool.request().query(`SELECT 1 FROM sys.server_principals WHERE name = ${literal(user)}`);
  if (exists.recordset.length) await pool.request().query(`ALTER LOGIN [${bracket(user)}] WITH PASSWORD = ${literal(password)}, CHECK_POLICY = OFF`);
  else { await pool.request().query(`CREATE LOGIN [${bracket(user)}] WITH PASSWORD = ${literal(password)}, CHECK_POLICY = OFF`); console.log(`Login ${user} creado.`); }
  const admin = await pool.request().query(`SELECT 1 FROM sys.server_role_members rm INNER JOIN sys.server_principals r ON rm.role_principal_id = r.principal_id INNER JOIN sys.server_principals m ON rm.member_principal_id = m.principal_id WHERE r.name = 'sysadmin' AND m.name = ${literal(user)}`);
  if (!admin.recordset.length) { await pool.request().query(`ALTER SERVER ROLE sysadmin ADD MEMBER [${bracket(user)}]`); console.log(`${user} añadido a sysadmin para install y migrate.`); }
} finally { await pool.close(); }
