import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
for(const directory of ['server','scripts','assets/js','tests']){
 async function walk(folder){for(const item of await readdir(folder,{withFileTypes:true})){const file=path.join(folder,item.name);if(item.isDirectory())await walk(file);else if(file.endsWith('.js'))execFileSync(process.execPath,['--check',file],{stdio:'pipe'});}}
 await walk(directory);
}
console.log('Sintaxis de todos los módulos JavaScript válida.');
