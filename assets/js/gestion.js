import { logsView, bindLogs } from './logs.js';
import { scheduleView, bindScheduleEditor } from './horarios.js';
import { adminShell, adminSections, enhanceTables, bindAdminForms } from './ux.js';
import { baseDatos } from './base-datos.js';
import { escaparHtml as esc } from './utilidades/formatos.js';

const mailState = (value) => ({ pendiente: 'Pendiente', procesando: 'Procesando', aceptado: 'Aceptado por SMTP', fallido: 'Fallido' }[value] || 'Sin envío');
const field = (name, label, type = 'text', required = true, max = 160) => `<div class="field"><label for="edit-${name}">${label}</label><input id="edit-${name}" name="${name}" type="${type}" maxlength="${max}" ${required ? 'required' : ''}></div>`;
const select = (name, label, values) => `<div class="field"><label for="edit-${name}">${label}</label><select id="edit-${name}" name="${name}">${values.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></div>`;
const check = (name, label) => `<label class="check-field"><input type="checkbox" name="${name}">${label}</label>`;
function values(form) {
  const data = Object.fromEntries(new FormData(form));
  form.querySelectorAll('input[type=checkbox]').forEach((input) => { data[input.name] = input.checked; });
  return data;
}
function fill(form, data) {
  Object.entries(data).forEach(([name, value]) => {
    const input = form.elements.namedItem(name);
    if (input) { if (input.type === 'checkbox') input.checked = Number(value) === 1; else if (input.type !== 'password') input.value = value ?? ''; }
  });
}
function table(headers, rows) {
  if (!rows.length) return '<p class="hint">Sin registros.</p>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map((text) => `<th>${text}</th>`).join('')}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function renderClients(context) {
  const { state, pageContent, notify, refreshData } = context;
  pageContent.innerHTML = `<div class="section-head"><div><h2>Clientes registrados</h2><p>${state.clients.length} clientes · Busca por nombre, correo o tipo.</p></div><button class="button" id="client-new" type="button">Nuevo cliente</button></div><p class="hint">Para una venta a consumidor final no necesitas registrar un cliente. <a href="#invoice">Ir a nueva factura</a></p>
  <form class="card catalog-editor" id="client-form" hidden><h2 id="client-title">Registrar cliente</h2><input type="hidden" name="id" value="0"><div class="form-grid">${field('nombre', 'Nombre o razón social')}${field('correo', 'Correo para recibir el PDF', 'email', true, 254)}${field('telefono', 'Teléfono (opcional)', 'tel', false, 30)}</div><div class="client-tax-choice">${check('contribuyente', 'Necesita comprobantes de crédito fiscal')}</div><details id="client-fiscal"><summary>Datos fiscales (opcionales para consumidor final)</summary><p class="hint">Para crédito fiscal, completa los cuatro campos. NIT: 8 o 14 dígitos, o formato 0000-000000-000-0. NRC: hasta 8 dígitos y dígito verificador opcional.</p><div class="form-grid">${field('nit', 'NIT', 'text', false, 20)}${field('nrc', 'NRC', 'text', false, 20)}${field('actividad', 'Actividad económica', 'text', false)}${field('direccion', 'Dirección fiscal', 'text', false, 250)}</div></details><p class="form-error" role="alert" hidden></p><div class="actions"><button class="button secondary" id="client-clear" type="button">Cancelar</button><button class="button" type="submit">Guardar cliente</button></div></form>
  <div id="clients-list">${state.clients.length ? table(['Cliente', 'Correo', 'Tipo', ''], state.clients.map((client) => [esc(client.nombre), esc(client.correo), Number(client.contribuyente) ? 'Contribuyente' : 'Consumidor final', `<button type="button" class="button text" data-client="${client.id}" aria-label="Editar ${esc(client.nombre)}">Editar</button>`])) : '<div class="card empty"><h3>Aún no hay clientes registrados</h3><p>Registra uno para enviarle facturas por correo o emitir crédito fiscal.</p></div>'}</div>`;
  enhanceTables(pageContent);
  const form = pageContent.querySelector('#client-form'), fiscal=form.querySelector('#client-fiscal');
  const updateFiscal=()=>{const required=form.elements.contribuyente.checked;fiscal.open=required;fiscal.querySelector('summary').textContent=required?'Datos fiscales obligatorios':'Datos fiscales (opcionales para consumidor final)';fiscal.querySelectorAll('input').forEach(input=>input.required=required);};
  form.elements.contribuyente.addEventListener('change',updateFiscal);
  form.elements.nit.pattern='(?:[0-9]{8}|[0-9]{14}|[0-9]{4}-[0-9]{6}-[0-9]{3}-[0-9])';
  form.elements.nrc.pattern='[0-9]{1,8}(?:-[0-9])?';
  form.addEventListener('invalid',event=>{if(fiscal.contains(event.target))fiscal.open=true;},true);
  const open=client=>{form.reset();if(client)fill(form,client);form.hidden=false;form.querySelector('[role=alert]').hidden=true;updateFiscal();form.querySelector('#client-title').textContent=client?'Editar cliente':'Registrar cliente';form.scrollIntoView({behavior:'smooth',block:'start'});form.elements.nombre.focus({preventScroll:true});};
  pageContent.querySelector('#client-new').addEventListener('click',()=>open());
  pageContent.querySelector('#client-clear').addEventListener('click',()=>{form.hidden=true;form.reset();pageContent.querySelector('#client-new').focus();});
  pageContent.querySelectorAll('[data-client]').forEach(button=>button.addEventListener('click',()=>open(state.clients.find(client=>String(client.id)===button.dataset.client))));
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=event.submitter,error=form.querySelector('[role=alert]');button.disabled=true;button.textContent='Guardando…';error.hidden=true;
    try {const data=values(form);data.id=Number(data.id);await baseDatos.guardarCliente(data);await refreshData();if(form.isConnected)renderClients(context);notify('Cliente guardado. Ya puedes seleccionarlo al facturar.');}
    catch(problem){error.textContent=problem.message;error.hidden=false;}finally{button.disabled=false;button.textContent='Guardar cliente';}
  });
}

let adminRender = 0;
let disposeSchedule = () => {};
export function disposeAdministration() {disposeSchedule();disposeSchedule=()=>{};}
export async function renderAdministration(context) {
  disposeAdministration();
  const { pageContent, notify } = context;
  const version = ++adminRender, routeHash = location.hash;
  const section = Object.hasOwn(adminSections,routeHash.split('/')[1]) ? routeHash.split('/')[1] : 'overview';
  const current = () => location.hash === routeHash && version === adminRender && context.state.user;
  pageContent.innerHTML='<p role="status">Cargando administración…</p>';
  let data;
  try { data=await baseDatos.obtenerAdministracion(); } catch(error) {
    if(!current()) return;
    pageContent.innerHTML='<div class="card"><h2>No se pudo cargar Administración</h2><p role="alert" id="admin-load-error"></p><button class="button" id="admin-load-retry">Reintentar</button></div>';
    pageContent.querySelector('#admin-load-error').textContent=error.message;
    pageContent.querySelector('#admin-load-retry').addEventListener('click',()=>renderAdministration(context));return;
  }
  if(!current()) return;
  document.querySelector('#page-title').textContent='Administración · '+adminSections[section].label;
  const selectableUsers=data.usuarios.filter(user=>section==='schedules' ? user.rol==='facturador' : section==='blocks' ? String(user.id)!==String(context.state.user.id) : true);
  const userOptions=selectableUsers.map(user=>`<option value="${user.id}">${esc(user.nombre)} · ${esc(user.usuario)}</option>`).join('');
  const cfg=data.configuracion;
  const views = {
    settings: () => `    <section class="card"><h2>Servicios y reglas de acceso</h2><p>País permitido: <b>${esc(cfg.pais)}</b> · Zona horaria: <b>${esc(cfg.zona_horaria)}</b></p><div class="service-grid"><span>PDF: ${cfg.pdf_disponible ? 'Disponible' : 'Faltan dependencias'}</span><span>Remitente SMTP: ${cfg.smtp_configurado ? 'Configurado' : 'Pendiente'}</span><span>Correo de alertas: ${cfg.alertas_configuradas ? 'Configurado' : 'Pendiente'}</span><span>Base GeoIP: ${cfg.geoip_disponible ? 'Disponible' : 'Pendiente para acceso remoto'}</span></div><p class="hint">Redes de oficina: ${esc(cfg.redes.join(', ') || 'Sin configurar')}. Empresa: ${esc(cfg.emisor.nombre)}. La configuración SMTP se establece en el servidor. Los administradores no tienen restricción de horario ni festivos; sí se aplican ubicación, vacaciones y bloqueos.</p></section>
`,
    mail: () => `    <form class="card" id="mail-settings-form"><h2>Correo de alertas del administrador</h2><div class="form-grid">${field('correo_alertas','Destinatario de alertas de acceso','email',true,254)}</div><p class="hint">El cambio se aplica a las nuevas alertas de acceso. Los mensajes ya en cola conservan su destinatario.</p><div class="actions"><button type="submit" class="button">Guardar correo de alertas</button></div></form>
    <div class="section-head"><h2>Envíos de correo</h2><button id="admin-refresh" class="button secondary" type="button">Actualizar</button></div><p class="hint">Aceptado por SMTP indica que el servidor de correo aceptó el mensaje. No garantiza llegada a la bandeja del destinatario.</p>
    ${table(['Destino','Tipo','Estado','Intentos','Resultado',''],data.correos.map((mail)=>[esc(mail.destinatario),esc(mail.tipo),mailState(mail.estado),esc(mail.intentos),esc(mail.error||mail.updated_at),mail.estado==='fallido'?`<button type="button" class="button text" data-retry="${mail.id}">Reintentar</button>`:'']))}
`,
    users: () => `    <div class="section-head"><h2>Usuarios y permisos</h2><button class="button" id="user-new" type="button">Crear usuario</button></div>
    <form class="card" id="user-form" hidden><h3 id="user-title">Crear usuario</h3><input name="id" type="hidden" value="0"><div class="form-grid">${field('nombre','Nombre', 'text',true,120)}${field('usuario','Usuario','text',true,50)}${field('correo','Correo electrónico','email',false,254)}${field('fecha_nacimiento','Fecha de nacimiento','date')}${field('clave','Contraseña (mínimo 12 caracteres)','password',true,200)}${select('rol','Rol',[['facturador','Facturador'],['administrador','Administrador']])}${field('motivo_bloqueo','Motivo del bloqueo','text',false,180)}${check('activo','Cuenta activa')}${check('bloqueado_permanente','Bloqueo permanente')}${check('remoto','Permitir trabajo remoto dentro del país')}</div><div class="actions"><button id="user-clear" type="button" class="button secondary">Cancelar</button><button type="submit" class="button">Guardar usuario</button></div></form>
    <div style="margin-top:1rem">${table(['Usuario','Correo','Rol','Acceso','Remoto',''],data.usuarios.map((user)=>[`${esc(user.nombre)}<br><small>${esc(user.usuario)}</small>`,esc(user.correo || 'Sin registrar'),esc(user.rol),Number(user.bloqueado_permanente)?'Bloqueado permanentemente':Number(user.activo)?'Activo':'Inactivo',Number(user.remoto)?'Sí':'No',`<button type="button" class="button text" data-user="${user.id}">Editar</button>`]))}</div>
`,
    schedules: () => scheduleView(selectableUsers),
    blocks: () => `    <div class="section-head"><h2>Bloquear acceso</h2></div>
    <form class="card" id="block-form"><div class="form-grid"><div class="field"><label for="block-user">Empleado</label><select id="block-user" name="vendedor_id">${userOptions}</select></div>${select('tipo','Tipo',[['vacaciones','Vacaciones'],['temporal','Bloqueo temporal'],['permanente','Bloqueo permanente']])}${field('inicio','Desde','date')}${field('fin','Hasta (incluido)','date')}${field('motivo','Motivo','text',true,180)}</div><p class="hint" id="block-help">Las fechas de inicio y fin están incluidas en el bloqueo.</p><div class="actions"><button class="button" type="submit">Crear bloqueo</button></div></form>
    <div class="section-head"><h2>Bloqueos permanentes</h2></div><p class="hint">Impiden el acceso hasta que un administrador los quite. Al quitarlos siguen vigentes el estado de la cuenta, los horarios y los demás bloqueos.</p>
    ${table(['Usuario','Motivo',''],data.usuarios.filter(user=>Number(user.bloqueado_permanente)).map(user=>[esc(user.nombre)+' · '+esc(user.usuario),esc(user.motivo_bloqueo||'Sin motivo registrado'),`<button type="button" class="button secondary" data-unblock-permanent="${user.id}">Quitar bloqueo permanente</button>`]))}
    <div class="section-head"><h2>Vacaciones y bloqueos temporales</h2></div>
    <div style="margin-top:1rem">${table(['Empleado','Tipo','Desde','Hasta','Motivo',''],data.bloqueos.map((block)=>[esc(block.nombre),esc(block.tipo),esc(block.inicio),esc(block.fin),esc(block.motivo),`<button type="button" class="button text" data-unblock="${block.id}">Quitar</button>`]))}</div>
`,
    holidays: () => `    <div class="section-head"><h2>Días festivos</h2></div>
    <form class="card" id="holiday-form"><div class="form-grid">${field('fecha','Fecha del festivo','date')}${field('nombre','Nombre del festivo','text',true,120)}</div><div class="actions"><button class="button" type="submit">Guardar festivo</button></div></form>
    <div style="margin-top:1rem">${table(['Fecha','Festivo',''],data.festivos.map((holiday)=>[esc(holiday.fecha),esc(holiday.nombre),`<button type="button" class="button text" data-holiday="${holiday.fecha}">Quitar</button>`]))}</div>
`,
    activity: () => logsView()
  };

  pageContent.innerHTML=adminShell(section,data,views[section]?.());
  const reload=()=>current() ? renderAdministration(context) : undefined;
  const action=async(name,payload)=>{await baseDatos.administrar(name,payload);await reload();notify('Cambio guardado.');};
  const bindForm=bindAdminForms(pageContent,action);
  if(section==='mail') {fill(pageContent.querySelector('#mail-settings-form'),{correo_alertas:cfg.correo_alertas});bindForm('#mail-settings-form','mail-settings');}
  if(section==='users') {
    const form=pageContent.querySelector('#user-form');
    const open=(user)=>{
      form.reset();form.hidden=false;form.elements.activo.checked=true;form.elements.clave.required=!user;form.elements.clave.minLength=12;form.elements.clave.autocomplete='new-password';
      if(user) fill(form,user);
      pageContent.querySelector('#user-title').textContent=user?'Editar usuario · deja la contraseña vacía para conservarla':'Crear usuario';
      form.scrollIntoView({behavior:'smooth',block:'start'});form.elements.nombre.focus({preventScroll:true});
    };
    pageContent.querySelector('#user-new').addEventListener('click',()=>open());
    pageContent.querySelector('#user-clear').addEventListener('click',()=>{form.hidden=true;form.reset();pageContent.querySelector('#user-new').focus();});
    pageContent.querySelectorAll('[data-user]').forEach(button=>button.addEventListener('click',()=>open(data.usuarios.find(user=>String(user.id)===button.dataset.user))));
    bindForm('#user-form','user',payload=>({...payload,id:Number(payload.id)}));
  }
  if(section==='schedules') disposeSchedule=bindScheduleEditor(pageContent,selectableUsers,data,context,payload=>baseDatos.administrar('schedule',payload));
  if(section==='blocks') {
    const form=pageContent.querySelector('#block-form');
    const updateType=()=>{
      const permanent=form.elements.tipo.value==='permanente';
      for(const name of ['inicio','fin']) {const input=form.elements[name];input.required=!permanent;input.disabled=permanent;input.closest('.field').hidden=permanent;}
      pageContent.querySelector('#block-help').textContent=permanent?'El bloqueo se aplica inmediatamente, cierra las sesiones abiertas y no vence. Un administrador debe quitarlo.':'Las fechas de inicio y fin están incluidas en el bloqueo.';
    };
    form.elements.tipo.addEventListener('change',updateType);updateType();
  }
  bindForm('#block-form','block',payload=>({...payload,vendedor_id:Number(payload.vendedor_id)}));bindForm('#holiday-form','holiday');
  const bindAction=(selector,name,payload,confirmation)=>pageContent.querySelectorAll(selector).forEach(button=>button.addEventListener('click',async()=>{
    if(confirmation && !window.confirm(confirmation))return;button.disabled=true;
    try {await action(name,payload(button));}catch(error){notify(error.message,'error');}finally{button.disabled=false;}
  }));
  bindAction('[data-unblock-permanent]','unblock-permanent',b=>({vendedor_id:Number(b.dataset.unblockPermanent)}),'¿Quitar el bloqueo permanente de esta cuenta? Se mantendrán sus demás restricciones.');
  bindAction('[data-unblock]','unblock',b=>({id:Number(b.dataset.unblock)}),'¿Quitar este bloqueo? Se aplicarán los demás permisos de acceso.');
  bindAction('[data-holiday]','holiday',b=>({fecha:b.dataset.holiday,eliminar:true}),'¿Quitar este festivo? Se volverá a aplicar el horario habitual.');
  bindAction('[data-retry]','mail-retry',b=>({id:Number(b.dataset.retry)}));
  pageContent.querySelector('#admin-refresh')?.addEventListener('click',reload);
  if (section==='blocks' && !selectableUsers.length) {
    const form=pageContent.querySelector('form'); form.querySelectorAll('button,select').forEach(input=>{input.disabled=true;});
    form.insertAdjacentHTML('afterbegin','<p class="hint">No hay usuarios disponibles para esta operación. Puedes crear uno desde Usuarios.</p>');
  }
  if(section==='activity') bindLogs(pageContent,filters=>baseDatos.obtenerLogs(filters));
  enhanceTables(pageContent);
}
