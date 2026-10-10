import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createApplication } from '../server/index.js';
import { pool,query,transaction } from '../server/db.js';
import { processMail } from '../server/mail.js';
import { config } from '../server/config.js';
import { localClock } from '../server/access.js';

test('SQL Server: autenticación, CCF/CF, aislamiento, bloqueos y transacciones',{skip:process.env.SQL_INTEGRATION!=='true'},async(t)=>{
 assert.ok(process.env.DB_NAME?.endsWith('_test'),'Usar exclusivamente una base terminada en _test.');
 assert.equal(config.environment,'development');
 const received=[];
 const smtp=net.createServer((socket)=>{
  socket.write('220 localhost ESMTP prueba\r\n');let buffer='',inData=false,message='';
  socket.on('data',(chunk)=>{buffer+=chunk.toString();let at;while((at=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+2);if(inData){if(line==='.') {received.push(message);message='';inData=false;socket.write('250 Message accepted\r\n');}else message+=line+'\r\n';}else if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 SIZE 10000000\r\n');else if(/^DATA/.test(line)){inData=true;socket.write('354 End with dot\r\n');}else if(/^QUIT/.test(line))socket.end('221 Bye\r\n');else socket.write('250 OK\r\n');}});
 });smtp.listen(0,'127.0.0.1');await once(smtp,'listening');config.smtp.host='127.0.0.1';config.smtp.port=smtp.address().port;config.smtp.secure=false;config.smtp.requireTLS=false;config.smtp.user='';config.mailFrom='facturas@example.com';config.adminEmail='';
 const server=createApplication();server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;config.origin=base;config.port=server.address().port;let cookie='';let csrf='';
 async function request(action,payload,credentials={cookie,csrf}){
  const response=await fetch(base+config.basePath+'/api?action='+action,{method:payload?'POST':'GET',headers:{Origin:base,...(payload?{'Content-Type':'application/json','X-CSRF-Token':credentials.csrf}:{}),...(credentials.cookie?{Cookie:credentials.cookie}:{})},body:payload?JSON.stringify(payload):undefined});
  const content=response.headers.get('content-type')||'';
  const data=content.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer());
  return {response,data};
 }
 try{
  await t.test('login y sesión persistida en SQL Server',async()=>{
   const result=await request('login',{usuario:'admin',clave:process.env.BOOTSTRAP_ADMIN_PASSWORD});
   assert.equal(result.response.status,200,JSON.stringify(result.data));
   cookie=result.response.headers.get('set-cookie').split(';')[0];csrf=result.data.csrf;
   assert.equal(result.data.usuario.rol,'administrador');
   assert.equal((await request('session')).response.status,200);
  });
  let product,client,invoice,requestId=randomUUID();
  await t.test('datos fiscales Unicode, precio final y emisión CCF',async()=>{
   let result=await request('client',{nombre:'Cliente fiscal de prueba Álvarez',correo:'prueba@example.com',nit:'0614-010100-101-0',nrc:'123456-7',actividad:'Comercio',direccion:'San Salvador',telefono:'',contribuyente:true});
   assert.equal(result.response.status,200,JSON.stringify(result.data));client=result.data.id;
   result=await request('product',{descripcion:'Producto de prueba con IVA',precio:'113.00',clasificacion:'gravada'});
   assert.equal(result.response.status,200,JSON.stringify(result.data));product=result.data.id;
   const payload={tipo:'CCF',fecha:localClock().date,cliente_id:client,sucursal_id:1,condicion:'contado',forma_pago:'efectivo',solicitud_id:requestId,detalles:[{producto_id:product,cantidad:2,descuento:'0.00'}]};
   result=await request('invoice',payload);assert.equal(result.response.status,200,JSON.stringify(result.data));invoice=result.data;
   const detail=await request('invoice&id='+invoice.id);assert.equal(detail.response.status,200,JSON.stringify(detail.data));
   assert.equal(detail.data.factura.total,'226.00');assert.equal(detail.data.factura.subtotal,'200.00');assert.equal(detail.data.factura.iva,'26.00');assert.equal(detail.data.factura.comision,'4.00');
   assert.equal(detail.data.cliente.nombre,'Cliente fiscal de prueba Álvarez');assert.ok(detail.data.correos.length);
   const again=await request('invoice',payload);assert.equal(Number(again.data.id),Number(invoice.id));
   const counts=await query('SELECT COUNT(*) cantidad FROM facturas WHERE solicitud_id=?',[requestId]);assert.equal(Number(counts[0].cantidad),1);
  });
  await t.test('PDF e historial con estado del correo',async()=>{
   const pdf=await request('pdf&id='+invoice.id);assert.equal(pdf.response.status,200,JSON.stringify(pdf.data));assert.equal(pdf.data.subarray(0,5).toString(),'%PDF-');
   const history=await request('invoices');assert.equal(history.response.status,200,JSON.stringify(history.data));assert.ok(history.data.some((row)=>Number(row.id)===Number(invoice.id)));
   const admin=await request('admin-data');assert.equal(admin.response.status,200,JSON.stringify(admin.data));assert.ok(admin.data.usuarios.length);
  });
  await t.test('SMTP local recibe el PDF adjunto y conserva estado aceptado',async()=>{
   let accepted=false;for(let n=0;n<100;n++){await processMail(100);const rows=await query('SELECT estado FROM correos WHERE factura_id=?',[invoice.id]);if(rows.some((row)=>row.estado==='aceptado')){accepted=true;break;}await delay(50);}
   assert.ok(accepted);assert.ok(received.some((message)=>message.includes('application/pdf')&&message.includes(invoice.numero+'.pdf')));
  });
  await t.test('emite consumidor final mixto y conserva datos históricos del cliente',async()=>{
   const created=await request('product',{descripcion:'Producto exento de prueba',precio:'50.00',clasificacion:'exenta'});assert.equal(created.response.status,200,JSON.stringify(created.data));
   const emitted=await request('invoice',{tipo:'CF',fecha:localClock().date,cliente_id:client,sucursal_id:1,condicion:'credito',forma_pago:'transferencia',solicitud_id:randomUUID(),detalles:[{producto_id:product,cantidad:1,descuento:'0.00'},{producto_id:created.data.id,cantidad:1,descuento:'0.00'}]});assert.equal(emitted.response.status,200,JSON.stringify(emitted.data));
   const mixed=await request('invoice&id='+emitted.data.id);assert.equal(mixed.data.factura.total,'163.00');assert.equal(mixed.data.factura.iva,'13.00');assert.equal(mixed.data.factura.ventas_exentas,'50.00');assert.equal(mixed.data.factura.comision,'1.50');
   await request('client',{id:client,nombre:'Cliente actualizado',correo:'actualizado@example.com',nit:'0614-010100-101-0',nrc:'123456-7',actividad:'Comercio',direccion:'San Salvador',telefono:'',contribuyente:true});
   assert.equal((await request('invoice&id='+invoice.id)).data.cliente.nombre,'Cliente fiscal de prueba Álvarez');
  });
  await t.test('rollback no deja un cliente parcial',async()=>{
   const email=randomUUID()+'@example.com';
   await assert.rejects(transaction(async(connection)=>{await query("INSERT INTO clientes(nombre,correo) VALUES (?,?)",['Rollback',email],connection);throw new Error('Rollback de prueba');}),/Rollback/);
   assert.equal((await query('SELECT id FROM clientes WHERE correo=?',[email])).length,0);
  });
  await t.test('facturador no administra ni consulta facturas de otros y bloqueo revoca sesión',async()=>{
   const username='prueba.'+randomUUID().slice(0,8);const password='ClaveDePrueba-'+randomUUID();
   let result=await request('admin-user',{nombre:'Empleado de prueba',usuario:username,clave:password,fecha_nacimiento:'1990-01-01',rol:'facturador',activo:true,bloqueado_permanente:false,remoto:false,motivo_bloqueo:''});
   assert.equal(result.response.status,200,JSON.stringify(result.data));const id=result.data.id;
   result=await request('admin-schedule',{vendedor_id:id,horarios:Array.from({length:7},(_,i)=>({dia:i+1,inicio:'00:00',fin:'23:59'}))});
   assert.equal(result.response.status,200,JSON.stringify(result.data));
   const employee=await request('login',{usuario:username,clave:password},{cookie:'',csrf:''});assert.equal(employee.response.status,200,JSON.stringify(employee.data));
   const employeeCredentials={cookie:employee.response.headers.get('set-cookie').split(';')[0],csrf:employee.data.csrf};
   assert.equal((await request('admin-data',undefined,employeeCredentials)).response.status,403);
   assert.equal((await request('invoice&id='+invoice.id,undefined,employeeCredentials)).response.status,404);
   assert.equal((await request('product',{descripcion:'Sin CSRF',precio:'1.00',clasificacion:'gravada'},{cookie:employeeCredentials.cookie,csrf:''})).response.status,403);
   const date=localClock().date;result=await request('admin-block',{vendedor_id:id,tipo:'vacaciones',inicio:date,fin:date,motivo:'Prueba de vacaciones'});
   assert.equal(result.response.status,200,JSON.stringify(result.data));
   assert.equal((await request('session',undefined,employeeCredentials)).response.status,401);
   const denied=await request('login',{usuario:username,clave:password},{cookie:'',csrf:''});
   assert.equal(denied.response.status,403,JSON.stringify(denied.data));
  });
  await t.test('anulación académica y reenvío rechazado',async()=>{
   const result=await request('void',{id:invoice.id,motivo:'Comprobante generado por prueba automatizada'});
   assert.equal(result.response.status,200,JSON.stringify(result.data));
   assert.equal((await request('resend',{id:invoice.id})).response.status,422);
  });
 }finally{await new Promise((resolve)=>server.close(resolve));await new Promise((resolve)=>smtp.close(resolve));await pool.end();}
});
