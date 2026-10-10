import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from '../server/config.js';
import { pool, query, transaction, executeSqlBatches } from '../server/db.js';

try {
  await transaction(async(connection)=>{
    await query("IF OBJECT_ID(N'dbo.schema_migrations',N'U') IS NULL CREATE TABLE dbo.schema_migrations (nombre NVARCHAR(100) PRIMARY KEY,fecha DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());",[],connection);
    const previous=await query('SELECT nombre FROM schema_migrations WITH (UPDLOCK,HOLDLOCK) WHERE nombre=?',['001_acceso_y_comprobantes'],connection);
    if(previous.length) { console.log('La migración ya está aplicada.'); return; }
    const source=await readFile(path.join(root,'database/migrations/001_acceso_y_comprobantes.sql'),'utf8');
    await executeSqlBatches(source,connection);
    await query('INSERT INTO schema_migrations (nombre) VALUES (?)',['001_acceso_y_comprobantes'],connection);
    console.log('Migración SQL Server aplicada; datos históricos conservados.');
  });
} finally { await pool.end(); }
