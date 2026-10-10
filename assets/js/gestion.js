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
  pageContent.innerHTML = `<div class="grid two"><form class="card" id="client-form"><h2 id="client-title">Registrar cliente</h2><input type="hidden" name="id" value="0"><div class="form-grid">${field('nombre', 'Nombre o razón social')}${field('correo', 'Correo para recibir el PDF', 'email', true, 254)}${field('nit', 'NIT', 'text', false, 20)}${field('nrc', 'NRC', 'text', false, 20)}${field('actividad', 'Actividad económica', 'text', false)}${field('direccion', 'Dirección fiscal', 'text', false, 250)}${field('telefono', 'Teléfono', 'tel', false, 30)}${check('contribuyente', 'Contribuyente del IVA')}</div><p class="hint">Para crédito fiscal: NIT, NRC, actividad y dirección son obligatorios.</p><div class="actions"><button class="button secondary" id="client-clear" type="button">Nuevo cliente</button><button class="button" type="submit">Guardar cliente</button></div></form><article class="card tonal"><h2>Entrega de comprobantes</h2><p>El correo registrado recibe el PDF de cada documento emitido. Los cambios del cliente se aplican a los próximos documentos; los anteriores conservan sus datos originales.</p></article></div><div class="section-head"><h2>Clientes registrados</h2></div><div id="clients-list">${table(['Cliente', 'Correo', 'Tipo', ''], state.clients.map((client) => [esc(client.nombre), esc(client.correo), Number(client.contribuyente) ? 'Contribuyente' : 'Consumidor final', `<button type="button" class="button text" data-client="${client.id}">Editar</button>`]))}</div>`;
  const form = document.querySelector('#client-form');
  document.querySelector('#client-clear').addEventListener('click', () => renderClients(context));
  document.querySelectorAll('[data-client]').forEach((button) => button.addEventListener('click', () => {
    fill(form, state.clients.find((client) => String(client.id) === button.dataset.client));
    document.querySelector('#client-title').textContent = 'Editar cliente'; form.scrollIntoView({ behavior: 'smooth' });
  }));
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { const data = values(form); data.id = Number(data.id); await baseDatos.guardarCliente(data); await refreshData(); if (location.hash === '#clients') renderClients(context); notify('Cliente guardado.'); }
    catch (error) { notify(error.message, 'error'); } finally { button.disabled = false; }
  });
}

export async function renderAdministration(context) {
  const { pageContent, notify } = context;
  pageContent.innerHTML = '<p role="status">Cargando administración…</p>';
  let data;
  try { data = await baseDatos.obtenerAdministracion(); } catch (error) { notify(error.message, 'error'); return; }
  if (location.hash !== '#admin') return;
  const userOptions = data.usuarios.map((user) => `<option value="${user.id}">${esc(user.nombre)} · ${esc(user.usuario)}</option>`).join('');
  const cfg = data.configuracion;
  pageContent.innerHTML = `
    <section class="card"><h2>Servicios y reglas de acceso</h2><p>País permitido: <b>${esc(cfg.pais)}</b> · Zona horaria: <b>${esc(cfg.zona_horaria)}</b></p><div class="service-grid"><span>PDF: ${cfg.pdf_disponible ? 'Disponible' : 'Faltan dependencias'}</span><span>Remitente SMTP: ${cfg.smtp_configurado ? 'Configurado' : 'Pendiente'}</span><span>Correo de alertas: ${cfg.alertas_configuradas ? 'Configurado' : 'Pendiente'}</span><span>Base GeoIP: ${cfg.geoip_disponible ? 'Disponible' : 'Pendiente para acceso remoto'}</span></div><p class="hint">Redes de oficina: ${esc(cfg.redes.join(', ') || 'Sin configurar')}. Empresa: ${esc(cfg.emisor.nombre)}. La configuración privada se establece en el servidor. Los administradores no tienen restricción de horario ni festivos; sí se aplican ubicación, vacaciones y bloqueos.</p></section>
    <div class="section-head"><h2>Usuarios y permisos</h2></div>
    <form class="card" id="user-form"><h3 id="user-title">Crear usuario</h3><input name="id" type="hidden" value="0"><div class="form-grid">${field('nombre','Nombre', 'text',true,120)}${field('usuario','Usuario','text',true,50)}${field('fecha_nacimiento','Fecha de nacimiento','date')}${field('clave','Contraseña (mínimo 12 caracteres)','password',true,200)}${select('rol','Rol',[['facturador','Facturador'],['administrador','Administrador']])}${field('motivo_bloqueo','Motivo del bloqueo','text',false,180)}${check('activo','Cuenta activa')}${check('bloqueado_permanente','Bloqueo permanente')}${check('remoto','Permitir trabajo remoto dentro del país')}</div><div class="actions"><button id="user-clear" type="button" class="button secondary">Nuevo usuario</button><button type="submit" class="button">Guardar usuario</button></div></form>
    <div style="margin-top:1rem">${table(['Usuario','Rol','Acceso','Remoto',''],data.usuarios.map((user)=>[`${esc(user.nombre)}<br><small>${esc(user.usuario)}</small>`,esc(user.rol),Number(user.bloqueado_permanente)?'Bloqueado permanentemente':Number(user.activo)?'Activo':'Inactivo',Number(user.remoto)?'Sí':'No',`<button type="button" class="button text" data-user="${user.id}">Editar</button>`]))}</div>
    <div class="section-head"><h2>Horario semanal individual</h2></div>
    <form class="card" id="schedule-form"><div class="field"><label for="schedule-user">Empleado</label><select id="schedule-user">${userOptions}</select></div><p class="hint">Puedes agregar varios intervalos al mismo día. Sin intervalos, el facturador no tiene acceso. El final del intervalo queda excluido.</p><div id="schedule-rows"></div><div class="actions"><button id="schedule-add" type="button" class="button secondary">Agregar intervalo</button><button class="button" type="submit">Guardar horario</button></div></form>
    <div class="section-head"><h2>Vacaciones y bloqueos temporales</h2></div>
    <form class="card" id="block-form"><div class="form-grid"><div class="field"><label for="block-user">Empleado</label><select id="block-user" name="vendedor_id">${userOptions}</select></div>${select('tipo','Tipo',[['vacaciones','Vacaciones'],['temporal','Bloqueo temporal']])}${field('inicio','Desde','date')}${field('fin','Hasta (incluido)','date')}${field('motivo','Motivo','text',true,180)}</div><div class="actions"><button class="button" type="submit">Crear bloqueo</button></div></form>
    <div style="margin-top:1rem">${table(['Empleado','Tipo','Desde','Hasta','Motivo',''],data.bloqueos.map((block)=>[esc(block.nombre),esc(block.tipo),esc(block.inicio),esc(block.fin),esc(block.motivo),`<button type="button" class="button text" data-unblock="${block.id}">Quitar</button>`]))}</div>
    <div class="section-head"><h2>Días festivos</h2></div>
    <form class="card" id="holiday-form"><div class="form-grid">${field('fecha','Fecha del festivo','date')}${field('nombre','Nombre del festivo','text',true,120)}</div><div class="actions"><button class="button" type="submit">Guardar festivo</button></div></form>
    <div style="margin-top:1rem">${table(['Fecha','Festivo',''],data.festivos.map((holiday)=>[esc(holiday.fecha),esc(holiday.nombre),`<button type="button" class="button text" data-holiday="${holiday.fecha}">Quitar</button>`]))}</div>
    <div class="section-head"><h2>Intentos de acceso rechazados</h2><span class="hint">Últimos 200</span></div>
    ${table(['Fecha y hora','Usuario','IP','País / fuente','Motivo'],data.intentos.map((attempt)=>[esc(attempt.fecha),esc(attempt.usuario),esc(attempt.ip),`${esc(attempt.pais||'Desconocido')}<br>${esc(attempt.fuente)}`,esc(attempt.motivo)]))}
    <div class="section-head"><h2>Envíos de correo</h2><button id="admin-refresh" class="button secondary" type="button">Actualizar</button></div><p class="hint">Aceptado por SMTP indica que el servidor de correo aceptó el mensaje. No garantiza llegada a la bandeja del destinatario.</p>
    ${table(['Destino','Tipo','Estado','Intentos','Resultado',''],data.correos.map((mail)=>[esc(mail.destinatario),esc(mail.tipo),mailState(mail.estado),esc(mail.intentos),esc(mail.error||mail.updated_at),mail.estado==='fallido'?`<button type="button" class="button text" data-retry="${mail.id}">Reintentar</button>`:'']))}
    <div class="section-head"><h2>Auditoría de operaciones</h2><span class="hint">Últimas 200</span></div>
    ${table(['Fecha','Usuario','Acción','Referencia'],data.auditoria.map((entry)=>[esc(entry.fecha),esc(entry.nombre),esc(entry.accion),esc(entry.referencia)]))}`;

  pageContent.querySelectorAll('form').forEach((form) => {
    form.querySelectorAll('[id^="edit-"]').forEach((input) => { const old = input.id; input.id = form.id + '-' + old; form.querySelector(`label[for="${old}"]`)?.setAttribute('for',input.id); });
  });
  const reload = () => renderAdministration(context);
  const action = async (name,payload) => {
    try { await baseDatos.administrar(name,payload); await reload(); notify('Cambio guardado.'); }
    catch(error) { notify(error.message,'error'); }
  };
  const bindForm = (id,name,transform=(value)=>value) => {
    const form=document.querySelector(id);
    form.addEventListener('submit',async(event)=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await action(name,transform(values(form)));}finally{button.disabled=false;}});
  };
  const userForm=document.querySelector('#user-form');userForm.elements.activo.checked=true;
  document.querySelector('#user-clear').addEventListener('click',reload);
  document.querySelectorAll('[data-user]').forEach((button)=>button.addEventListener('click',()=>{
    userForm.reset();fill(userForm,data.usuarios.find((user)=>String(user.id)===button.dataset.user));userForm.elements.clave.required=false;document.querySelector('#user-title').textContent='Editar usuario · deja la contraseña vacía para conservarla';userForm.scrollIntoView({behavior:'smooth'});
  }));
  bindForm('#user-form','user',(payload)=>({...payload,id:Number(payload.id)}));
  const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  function addSchedule(row={dia:1,inicio:'08:00',fin:'17:00'}) {
    const element=document.createElement('div');element.className='schedule-row';
    element.innerHTML=`<select aria-label="Día">${days.map((day,i)=>`<option value="${i+1}" ${Number(row.dia)===i+1?'selected':''}>${day}</option>`).join('')}</select><input aria-label="Inicio" type="time" value="${esc(row.inicio.slice(0,5))}" required><input aria-label="Fin" type="time" value="${esc(row.fin.slice(0,5))}" required><button class="button danger" type="button">Quitar</button>`;
    element.querySelector('button').addEventListener('click',()=>element.remove());document.querySelector('#schedule-rows').append(element);
  }
  function loadSchedule(){const id=document.querySelector('#schedule-user').value;document.querySelector('#schedule-rows').replaceChildren();data.horarios.filter((row)=>String(row.vendedor_id)===id).forEach(addSchedule);}
  loadSchedule();document.querySelector('#schedule-user').addEventListener('change',loadSchedule);document.querySelector('#schedule-add').addEventListener('click',()=>addSchedule());
  document.querySelector('#schedule-form').addEventListener('submit',async(event)=>{
    event.preventDefault();const rows=[...document.querySelectorAll('.schedule-row')].map((row)=>({dia:Number(row.querySelector('select').value),inicio:row.querySelectorAll('input')[0].value,fin:row.querySelectorAll('input')[1].value}));
    event.submitter.disabled=true;await action('schedule',{vendedor_id:Number(document.querySelector('#schedule-user').value),horarios:rows});event.submitter.disabled=false;
  });
  bindForm('#block-form','block',(payload)=>({...payload,vendedor_id:Number(payload.vendedor_id)}));bindForm('#holiday-form','holiday');
  document.querySelectorAll('[data-unblock]').forEach((button)=>button.addEventListener('click',()=>action('unblock',{id:Number(button.dataset.unblock)})));
  document.querySelectorAll('[data-holiday]').forEach((button)=>button.addEventListener('click',()=>action('holiday',{fecha:button.dataset.holiday,eliminar:true})));
  document.querySelectorAll('[data-retry]').forEach((button)=>button.addEventListener('click',()=>action('mail-retry',{id:Number(button.dataset.retry)})));
  document.querySelector('#admin-refresh').addEventListener('click',reload);
}
