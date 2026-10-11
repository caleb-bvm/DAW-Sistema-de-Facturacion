import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from '../server/config.js';
import { pool, query, transaction, executeSqlBatches } from '../server/db.js';

try {
  await transaction(async(connection)=>{
    await query("IF OBJECT_ID(N'dbo.schema_migrations',N'U') IS NULL CREATE TABLE dbo.schema_migrations (nombre NVARCHAR(100) PRIMARY KEY,fecha DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());",[],connection);
    for (const name of ['001_acceso_y_comprobantes', '002_correos_administrables', '003_detalle_auditoria']) {
      const previous=await query('SELECT nombre FROM schema_migrations WITH (UPDLOCK,HOLDLOCK) WHERE nombre=?',[name],connection);
      if(previous.length) { console.log(`Migración ${name} ya aplicada.`); continue; }
      const source=await readFile(path.join(root,`database/migrations/${name}.sql`),'utf8');
      await executeSqlBatches(source,connection);
      await query('INSERT INTO schema_migrations (nombre) VALUES (?)',[name],connection);
      console.log(`Migración ${name} aplicada; datos históricos conservados.`);
    }
  });
} finally { await pool.end(); }
