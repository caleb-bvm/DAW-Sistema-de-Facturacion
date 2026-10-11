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
import { localClock, recordAttempt, createSession } from '../server/access.js';
import { setUserCredentials } from '../server/user-credentials.js';
import { verifyPassword } from '../server/passwords.js';

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
  // La suite usa su propia cuenta para no depender de la contraseña del administrador local.
  const testAdmin='qa.admin.'+randomUUID().slice(0,8);const testPassword='Prueba-'+randomUUID();
  await setUserCredentials(testAdmin,testPassword,{role:'administrador'});
  await t.test('login y sesión persistida en SQL Server',async()=>{
   const result=await request('login',{usuario:testAdmin,clave:testPassword});
   assert.equal(result.response.status,200,JSON.stringify(result.data));
   cookie=result.response.headers.get('set-cookie').split(';')[0];csrf=result.data.csrf;
   assert.equal(result.data.usuario.rol,'administrador');
   assert.equal((await request('session')).response.status,200);
  });
  await t.test('logs: filtros, contexto de acceso, paginación y ausencia de secretos',async()=>{
   const result=await request('admin-logs&categoria=operacion&buscar='+encodeURIComponent(testAdmin)+'&limite=1');
   assert.equal(result.response.status,200,JSON.stringify(result.data));
   assert.equal(result.data.eventos.length,1);assert.ok(result.data.total>=1);
   const event=result.data.eventos[0];assert.equal(event.accion,'iniciar_sesion');assert.equal(event.detalles.origen,'web');assert.ok(event.ip);
   assert.ok(!JSON.stringify(result.data).includes(testPassword));assert.ok(!JSON.stringify(result.data).includes(csrf));
   assert.equal((await request('admin-logs&desde=2026-12-31&hasta=2026-01-01')).response.status,422);
   assert.equal((await request('admin-logs&categoria=incorrecta')).response.status,422);
   assert.equal((await request('admin-logs&buscar=sin-coincidencia-'+randomUUID())).data.total,0);
   for(const category of ['acceso','correo'])assert.equal((await request('admin-logs&categoria='+category)).response.status,200);
   assert.equal((await request('admin-logs',undefined,{cookie:'',csrf:''})).response.status,401);
  });
  await t.test('correo propio editable, validado y sin perder la sesión ni la contraseña',async()=>{
   const admin=(await request('admin-data')).data.usuarios.find((user)=>user.usuario===testAdmin);
   const payload={...admin,clave:'',correo:'  administrador.nuevo@example.com  '};
   const [before]=await query('SELECT clave FROM vendedores WHERE id=?',[admin.id]);
   assert.equal((await request('admin-user',payload,{cookie,csrf:''})).response.status,403);
   assert.equal((await request('admin-user',{...payload,correo:'no-es-correo'})).response.status,422);
   assert.equal((await request('admin-user',payload)).response.status,200);
   assert.equal((await request('session')).response.status,200);
   assert.equal((await request('admin-data')).data.usuarios.find((user)=>user.id===admin.id).correo,'administrador.nuevo@example.com');
   const [after]=await query('SELECT clave FROM vendedores WHERE id=?',[admin.id]);assert.equal(after.clave,before.clave);
   assert.equal((await request('admin-user',{...payload,correo:admin.correo || ''})).response.status,200);
  });
  await t.test('correo de alertas persistente y aplicado al siguiente intento sin reinicio',async()=>{
   const previous=await query('SELECT valor FROM configuracion WHERE clave=?',['correo_alertas']);
   try {
    for(const correo_alertas of ['alertas.uno@example.com','alertas.dos@example.com']) {
     assert.equal((await request('admin-mail-settings',{correo_alertas})).response.status,200);
     assert.equal((await request('admin-data')).data.configuracion.correo_alertas,correo_alertas);
     const username='alerta.'+randomUUID().slice(0,8);
     await recordAttempt(username,null,'horario',{ip:'127.0.0.1',country:'SV',source:'prueba'});
     const [mail]=await query('SELECT c.destinatario FROM correos c JOIN intentos_acceso i ON i.id=c.intento_id WHERE i.usuario=?',[username]);
     assert.equal(mail.destinatario,correo_alertas);
    }
    assert.equal((await request('admin-mail-settings',{correo_alertas:'inválido'})).response.status,422);
    assert.equal((await request('admin-data')).data.configuracion.correo_alertas,'alertas.dos@example.com');
   } finally {
    if(previous.length) await query('UPDATE configuracion SET valor=? WHERE clave=?',[previous[0].valor,'correo_alertas']);
    else await query('DELETE FROM configuracion WHERE clave=?',['correo_alertas']);
   }
  });
  await t.test('asistente local crea facturadores con horario y valida el rol',async()=>{
   const username='asistente.'+randomUUID().slice(0,8);const password='Prueba-'+randomUUID();
   await assert.rejects(setUserCredentials(username,password,{role:'invalido'}),/Rol inválido/);
   assert.equal((await query('SELECT id FROM vendedores WHERE usuario=?',[username])).length,0);
   const created=await setUserCredentials(username,password);
   assert.equal(created.role,'facturador');
   const [user]=await query('SELECT rol,clave FROM vendedores WHERE id=?',[created.id]);
   assert.equal(user.rol,'facturador');assert.equal(await verifyPassword(password,user.clave),true);
   assert.equal((await query('SELECT dia FROM horarios_acceso WHERE vendedor_id=?',[created.id])).length,5);
  });
  let product,client,invoice,requestId=randomUUID();
  await t.test('asistente local crea y restablece administradores sin dejar sesiones antiguas',async()=>{
   const username='admin.'+randomUUID().slice(0,8);
   const oldPassword='Anterior-'+randomUUID();const newPassword='Nueva-'+randomUUID();
   const created=await setUserCredentials(username,oldPassword,{role:'administrador'});
   assert.equal(created.created,true);
   const [original]=await query('SELECT * FROM vendedores WHERE id=?',[created.id]);
   assert.equal(original.rol,'administrador');
   assert.equal(await verifyPassword(oldPassword,original.clave),true);
   await createSession(created.id);
   await assert.rejects(setUserCredentials(username,newPassword),/Confirma/);
   await assert.rejects(setUserCredentials(username,'corta',{reset:true}),/12 a 200/);
   assert.equal((await query('SELECT id FROM sesiones WHERE vendedor_id=?',[created.id])).length,1);
   const changed=await setUserCredentials(username,newPassword,{reset:true});
   assert.equal(changed.created,false);
   const [updated]=await query('SELECT * FROM vendedores WHERE id=?',[created.id]);
   assert.equal(await verifyPassword(newPassword,updated.clave),true);
   assert.equal(await verifyPassword(oldPassword,updated.clave),false);
   assert.equal((await query('SELECT id FROM sesiones WHERE vendedor_id=?',[created.id])).length,0);
   assert.equal(updated.activo,original.activo);assert.equal(updated.bloqueado_permanente,original.bloqueado_permanente);
  });
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
  await t.test('consumidor final sin cliente: PDF, historial y reintento sin correo ni registro automático',async()=>{
   const [before]=await query('SELECT COUNT(*) cantidad FROM clientes');
   for (const cliente_id of [null, undefined, '', 0]) {
    const payload={tipo:'CF',fecha:localClock().date,cliente_id,sucursal_id:1,condicion:'contado',forma_pago:'efectivo',solicitud_id:randomUUID(),detalles:[{producto_id:product,cantidad:1,descuento:'0.00'}]};
    const emitted=await request('invoice',payload);
    assert.equal(emitted.response.status,200,JSON.stringify(emitted.data));assert.equal(emitted.data.correo,'sin_envio');
    const detail=await request('invoice&id='+emitted.data.id);
    assert.equal(detail.data.factura.cliente_id,null);assert.equal(detail.data.cliente.nombre,'Consumidor final');
    assert.equal(detail.data.factura.total,'113.00');assert.equal(detail.data.factura.iva,'13.00');assert.equal(detail.data.factura.comision,'1.00');
    assert.equal(detail.data.correos.length,0);
    const repeated=await request('invoice',payload);assert.equal(Number(repeated.data.id),Number(emitted.data.id));assert.equal(repeated.data.correo,'sin_envio');
    const [count]=await query('SELECT COUNT(*) cantidad FROM facturas WHERE solicitud_id=?',[payload.solicitud_id]);assert.equal(Number(count.cantidad),1);
    const pdf=await request('pdf&id='+emitted.data.id);assert.equal(pdf.response.status,200);assert.equal(pdf.data.subarray(0,5).toString(),'%PDF-');
    assert.equal((await request('resend',{id:emitted.data.id})).response.status,422);
    assert.equal((await request('invoice&id='+emitted.data.id)).data.correos.length,0);
    const history=(await request('invoices')).data.find((row)=>Number(row.id)===Number(emitted.data.id));assert.equal(history.correo_estado,null);
   }
   const [after]=await query('SELECT COUNT(*) cantidad FROM clientes');assert.equal(after.cantidad,before.cantidad);
  });
  await t.test('consumidor final con correo opcional: validación, envío y reintento sin crear cliente',async()=>{
   const [before]=await query('SELECT COUNT(*) cantidad FROM clientes');
   const payload={tipo:'CF',fecha:localClock().date,cliente_id:null,correo:'  invitado@example.com  ',sucursal_id:1,condicion:'contado',forma_pago:'efectivo',solicitud_id:randomUUID(),detalles:[{producto_id:product,cantidad:1,descuento:'0.00'}]};
   assert.equal((await request('invoice',{...payload,correo:'invalido'})).response.status,422);
   assert.equal((await query('SELECT id FROM facturas WHERE solicitud_id=?',[payload.solicitud_id])).length,0);
   const emitted=await request('invoice',payload);assert.equal(emitted.response.status,200,JSON.stringify(emitted.data));assert.equal(emitted.data.correo,'pendiente');
   const detail=(await request('invoice&id='+emitted.data.id)).data;
   assert.equal(detail.factura.cliente_id,null);assert.equal(detail.cliente.correo,'invitado@example.com');assert.equal(detail.correos.length,1);
   const repeated=await request('invoice',payload);assert.equal(Number(repeated.data.id),Number(emitted.data.id));
   assert.equal((await request('invoice&id='+emitted.data.id)).data.correos.length,1);
   const [mail]=await query('SELECT destinatario FROM correos WHERE factura_id=?',[emitted.data.id]);assert.equal(mail.destinatario,'invitado@example.com');
   await processMail();assert.equal((await request('invoice&id='+emitted.data.id)).data.correos[0].estado,'aceptado');
   assert.equal((await request('resend',{id:emitted.data.id})).response.status,200);
   const [after]=await query('SELECT COUNT(*) cantidad FROM clientes');assert.equal(after.cantidad,before.cantidad);
   const registered=await request('invoice',{...payload,cliente_id:client,correo:'otro@example.com',solicitud_id:randomUUID()});assert.equal(registered.response.status,200);
   assert.equal((await request('invoice&id='+registered.data.id)).data.cliente.correo,'actualizado@example.com');
  });
  await t.test('crédito fiscal exige cliente y un cliente inexistente no se convierte en anónimo',async()=>{
   const payload={tipo:'CCF',fecha:localClock().date,cliente_id:null,sucursal_id:1,condicion:'contado',forma_pago:'efectivo',solicitud_id:randomUUID(),detalles:[{producto_id:product,cantidad:1,descuento:'0.00'}]};
   assert.equal((await request('invoice',payload)).response.status,422);
   assert.equal((await query('SELECT id FROM facturas WHERE solicitud_id=?',[payload.solicitud_id])).length,0);
   assert.equal((await request('invoice',{...payload,tipo:'CF',cliente_id:2147483647})).response.status,422);
  });
  await t.test('rollback no deja un cliente parcial',async()=>{
   const email=randomUUID()+'@example.com';
   await assert.rejects(transaction(async(connection)=>{await query("INSERT INTO clientes(nombre,correo) VALUES (?,?)",['Rollback',email],connection);throw new Error('Rollback de prueba');}),/Rollback/);
   assert.equal((await query('SELECT id FROM clientes WHERE correo=?',[email])).length,0);
  });
  await t.test('facturador no administra ni consulta facturas de otros y bloqueo revoca sesión',async()=>{
   const username='prueba.'+randomUUID().slice(0,8);const password='ClaveDePrueba-'+randomUUID();
   const userPayload={nombre:'Empleado de prueba',usuario:username,correo:'empleado@example.com',clave:password,fecha_nacimiento:'1990-01-01',rol:'facturador',activo:true,bloqueado_permanente:false,remoto:false,motivo_bloqueo:''};
   let result=await request('admin-user',userPayload);
   assert.equal(result.response.status,200,JSON.stringify(result.data));const id=result.data.id;
   const [beforeReset]=await query('SELECT * FROM vendedores WHERE id=?',[id]);
   await createSession(id);
   await assert.rejects(setUserCredentials(username,'Otra-'+randomUUID()),/Confirma/);
   const reset=await setUserCredentials(username,password,{reset:true,role:'administrador'});
   assert.equal(reset.role,'facturador');
   const [afterReset]=await query('SELECT * FROM vendedores WHERE id=?',[id]);
   for(const field of ['rol','activo','bloqueado_permanente','remoto','correo','fecha_nacimiento']) assert.equal(afterReset[field],beforeReset[field]);
   assert.equal(await verifyPassword(password,afterReset.clave),true);
   assert.equal((await query('SELECT id FROM sesiones WHERE vendedor_id=?',[id])).length,0);
   assert.equal((await request('admin-data')).data.usuarios.find((user)=>Number(user.id)===Number(id)).correo,'empleado@example.com');
   assert.equal((await request('admin-user',{...userPayload,id,clave:'',correo:'empleado.nuevo@example.com'})).response.status,200);
   assert.equal((await request('admin-data')).data.usuarios.find((user)=>Number(user.id)===Number(id)).correo,'empleado.nuevo@example.com');
   result=await request('admin-schedule',{vendedor_id:id,horarios:Array.from({length:7},(_,i)=>({dia:i+1,inicio:'00:00',fin:'23:59'}))});
   assert.equal(result.response.status,200,JSON.stringify(result.data));
   const employee=await request('login',{usuario:username,clave:password},{cookie:'',csrf:''});assert.equal(employee.response.status,200,JSON.stringify(employee.data));
   const employeeCredentials={cookie:employee.response.headers.get('set-cookie').split(';')[0],csrf:employee.data.csrf};
   assert.equal((await request('admin-logs',undefined,employeeCredentials)).response.status,403);
   assert.equal((await request('admin-data',undefined,employeeCredentials)).response.status,403);
   assert.equal((await request('admin-user',{...userPayload,id,clave:'',correo:'no.autorizado@example.com'},employeeCredentials)).response.status,403);
   assert.equal((await request('admin-mail-settings',{correo_alertas:'no.autorizado@example.com'},employeeCredentials)).response.status,403);
   assert.equal((await request('admin-block',{vendedor_id:id,tipo:'permanente',motivo:'Sin permiso'},employeeCredentials)).response.status,403);
   assert.equal((await request('admin-unblock-permanent',{vendedor_id:id},employeeCredentials)).response.status,403);
   const adminId=(await request('session')).data.usuario.id;
   assert.equal((await request('admin-block',{vendedor_id:Number(adminId),tipo:'permanente',motivo:'Propia cuenta'})).response.status,422);
   assert.equal((await request('admin-block',{vendedor_id:2147483647,tipo:'permanente',motivo:'No existe'})).response.status,404);
   assert.equal((await request('admin-block',{vendedor_id:id,tipo:'permanente',motivo:''})).response.status,422);
   assert.equal((await request('admin-block',{vendedor_id:id,tipo:'permanente',motivo:'Bloqueo permanente de prueba'})).response.status,200);
   const [blocked]=await query('SELECT bloqueado_permanente,motivo_bloqueo,activo,rol FROM vendedores WHERE id=?',[id]);
   assert.equal(Number(blocked.bloqueado_permanente),1);assert.equal(blocked.motivo_bloqueo,'Bloqueo permanente de prueba');
   assert.equal(Number(blocked.activo),1);assert.equal(blocked.rol,'facturador');
   assert.equal((await request('session',undefined,employeeCredentials)).response.status,401);
   const permanentlyDenied=await request('login',{usuario:username,clave:password},{cookie:'',csrf:''});
   assert.equal(permanentlyDenied.response.status,403);assert.match(permanentlyDenied.data.error,/permanentemente/);
   assert.equal((await request('admin-unblock-permanent',{vendedor_id:id})).response.status,200);
   const restored=await request('login',{usuario:username,clave:password},{cookie:'',csrf:''});
   assert.equal(restored.response.status,200,JSON.stringify(restored.data));
   employeeCredentials.cookie=restored.response.headers.get('set-cookie').split(';')[0];employeeCredentials.csrf=restored.data.csrf;
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
