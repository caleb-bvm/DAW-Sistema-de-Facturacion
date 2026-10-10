import test from 'node:test';
import assert from 'node:assert/strict';
import { parameterize,normalizeRecordset,isUniqueViolation,sql,databaseOptions } from '../server/db.js';

test('enlaza parámetros sin sustituir interrogaciones dentro de literales',()=>{
 assert.equal(parameterize("SELECT ? id, '¿Qué?' mensaje, 'texto''?' literal WHERE usuario=?",2),"SELECT @arg0 id, '¿Qué?' mensaje, 'texto''?' literal WHERE usuario=@arg1");
 assert.throws(()=>parameterize('SELECT ?',0));
});
test('conserva fecha, hora UTC y escala monetaria de SQL Server',()=>{
 const rows=[{fecha:new Date('2026-10-10T00:00:00Z'),hora:new Date('1970-01-01T08:30:00Z'),momento:new Date('2026-10-10T14:00:00Z'),total:113,base:100}];
 rows.columns={fecha:{type:sql.Date},hora:{type:sql.Time},momento:{type:sql.DateTime2},total:{type:sql.Decimal,scale:2},base:{type:sql.Numeric,scale:2}};
 assert.deepEqual(normalizeRecordset(rows),[{fecha:'2026-10-10',hora:'08:30:00',momento:'2026-10-10 14:00:00',total:'113.00',base:'100.00'}]);
});
test('reconoce las dos infracciones de unicidad de SQL Server',()=>{
 assert.ok(isUniqueViolation({number:2601}));assert.ok(isUniqueViolation({originalError:{info:{number:2627}}}));assert.equal(isUniqueViolation({number:547}),false);
});
test('la conexión solicita cifrado y fechas UTC',()=>{
 const cfg=databaseOptions('facturacion_prueba');
 assert.equal(cfg.database,'facturacion_prueba');assert.equal(cfg.options.useUTC,true);assert.equal(cfg.options.encrypt,true);
});
