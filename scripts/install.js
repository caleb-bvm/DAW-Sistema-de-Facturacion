import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from '../server/config.js';
import { sql, databaseOptions, executeSqlBatches } from '../server/db.js';

const database = process.env.DB_NAME || 'facturacion_db';
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('DB_NAME inválido.');
const connection = await new sql.ConnectionPool(databaseOptions('master')).connect();
try {
  const existing = await connection.request().input('database',sql.NVarChar(128),database).query('SELECT name FROM sys.databases WHERE name=@database');
  if (!existing.recordset.length) await connection.request().query(`CREATE DATABASE [${database}]`);
} finally { await connection.close(); }
const target = await new sql.ConnectionPool(databaseOptions(database)).connect();
const tx = new sql.Transaction(target);
let rolledBack = false; tx.on('rollback',()=>{rolledBack=true;});
try {
  await tx.begin();
  const tables = await new sql.Request(tx).query('SELECT name FROM sys.tables');
  if (tables.recordset.length) throw new Error('La base ya tiene tablas. Usa db:migrate para una estructura base de SQL Server existente.');
  await executeSqlBatches(await readFile(path.join(root,'database/schema.sql'),'utf8'),tx);
  await executeSqlBatches(await readFile(path.join(root,'database/migrations/001_acceso_y_comprobantes.sql'),'utf8'),tx);
  await new sql.Request(tx).query("CREATE TABLE schema_migrations (nombre NVARCHAR(100) PRIMARY KEY,fecha DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()); INSERT INTO schema_migrations(nombre) VALUES (N'001_acceso_y_comprobantes');");
  await tx.commit();
  console.log('Base SQL Server creada. Ejecuta setup para crear admin. Usuarios de demostración inactivos.');
} catch(error) { if(!rolledBack) await tx.rollback(); throw error; }
finally { await target.close(); }
