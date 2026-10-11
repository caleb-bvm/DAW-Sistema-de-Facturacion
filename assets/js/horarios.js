import { escaparHtml as esc } from './utilidades/formatos.js';

export const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function scheduleSummary(rows) {
  let total = 0;
  const errors = {};
  for (let day = 1; day <= 7; day++) {
    const intervals = rows.filter(row => row.dia === day).sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (let index = 0; index < intervals.length; index++) {
      const row = intervals[index];
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.inicio) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.fin) || row.inicio >= row.fin) {
        errors[day] = 'Indica una hora de inicio anterior a la de fin, dentro del mismo día.';
      } else {
        total += minutes(row.fin) - minutes(row.inicio);
        if (index && row.inicio < intervals[index - 1].fin) errors[day] = 'Estas sesiones se superponen. Ajusta las horas.';
      }
    }
  }
  return { errors, total, days: new Set(rows.map(row => row.dia)).size };
}

export function scheduleView(users) {
  if (!users.length) return '<section class="card"><h2>No hay facturadores</h2><p>Crea una cuenta de facturador para asignarle un horario. Los administradores no tienen restricciones de horario.</p><a class="button" href="#admin/users">Ir a Usuarios</a></section>';
  return `<form id="schedule-form" class="schedule-editor">
    <fieldset class="schedule-controls"><legend class="sr-only">Configuración del horario semanal</legend>
      <section class="card schedule-person"><div class="field"><label for="schedule-search">Buscar facturador</label><input id="schedule-search" type="search" placeholder="Nombre o usuario" autocomplete="off"></div><div class="field"><label for="schedule-user">Horario de</label><select id="schedule-user">${users.map(user => `<option value="${user.id}">${esc(user.nombre)} · ${esc(user.usuario)}</option>`).join('')}</select></div><p id="schedule-user-status" class="hint full"></p><p class="hint full">La búsqueda filtra la lista; el usuario seleccionado se mantiene hasta que elijas otro.</p><p id="schedule-search-empty" class="hint" hidden>No se encontraron usuarios. Prueba otro nombre.</p></section>
      <div class="schedule-workspace"><div>
        <section class="card schedule-presets"><h2>Organiza la semana</h2><p class="hint">Las plantillas reemplazan la semana. Revisa el resultado antes de guardar.</p><div class="schedule-template-actions"><button class="button secondary" type="button" data-template="continuous">Lun–vie · 08:00–17:00</button><button class="button secondary" type="button" data-template="split">Lun–vie · con almuerzo</button></div><button class="button text" id="schedule-copy" type="button">Copiar lunes a martes–viernes</button><p class="hint">Con almuerzo: 08:00–12:00 y 13:00–17:00.</p></section>
        <div id="schedule-week" class="schedule-week"></div>
      </div><aside class="card schedule-summary"><h2>Resumen semanal</h2><p id="schedule-total" class="stat-value"></p><p id="schedule-days" class="hint"></p><p id="schedule-no-access" class="schedule-warning" hidden>Sin sesiones: este usuario no podrá ingresar ningún día.</p><p class="hint">Horas expresadas en <strong id="schedule-timezone"></strong>. El acceso termina exactamente a la hora de fin. Para jornadas nocturnas, divide el horario entre los días correspondientes.</p><p class="hint">Los festivos, vacaciones y bloqueos siguen aplicándose.</p><p id="schedule-dirty" role="status" aria-live="polite"></p><p id="schedule-feedback" class="form-error" role="alert" tabindex="-1" hidden></p><div class="schedule-save-actions"><button class="button" id="schedule-save" type="submit" disabled>Guardar horario</button><button class="button secondary" id="schedule-discard" type="button" disabled>Descartar cambios</button></div></aside></div>
    </fieldset>
  </form>`;
}

export function bindScheduleEditor(root, users, data, context, saveSchedule) {
  const form = root.querySelector('#schedule-form'); if (!form) return () => {};
  const select = form.querySelector('#schedule-user');
  const search = form.querySelector('#schedule-search');
  const week = form.querySelector('#schedule-week');
  const feedback = form.querySelector('#schedule-feedback');
  const controls = form.querySelector('fieldset');
  let selected = users.some(user => String(user.id) === context.scheduleUserId) ? context.scheduleUserId : String(users[0].id);
  let saved = [], draft = [], dirty = false, saving = false, disposed = false;
  const clone = rows => rows.map(row => ({ ...row }));
  const normalized = rows => JSON.stringify(clone(rows).sort((a,b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio)));
  const confirmDiscard = () => !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?');
  const announce = (message, success = false) => {
    feedback.textContent = message; feedback.hidden = false;
    feedback.className = success ? 'schedule-success' : 'form-error';
    feedback.setAttribute('role', success ? 'status' : 'alert');
    if (!success) feedback.focus();
  };
  function update() {
    dirty = normalized(draft) !== normalized(saved);
    const summary = scheduleSummary(draft);
    for (let day = 1; day <= 7; day++) {
      const panel = week.querySelector(`[data-day="${day}"]`);
      panel.classList.toggle('schedule-day-invalid', Boolean(summary.errors[day]));
      const error = panel.querySelector('.schedule-day-error'); error.textContent = summary.errors[day] || ''; error.hidden = !summary.errors[day];
      panel.querySelectorAll('input[type=time]').forEach(input => input.setAttribute('aria-invalid', String(Boolean(summary.errors[day]))));
    }
    const valid = !Object.keys(summary.errors).length;
    form.querySelector('#schedule-total').textContent = valid ? `${Math.floor(summary.total / 60)} h${summary.total % 60 ? ` ${summary.total % 60} min` : ''}` : 'Revisa las sesiones';
    form.querySelector('#schedule-days').textContent = `${summary.days} de 7 días con acceso`;
    form.querySelector('#schedule-no-access').hidden = draft.length > 0;
    form.querySelector('#schedule-dirty').textContent = dirty ? 'Cambios sin guardar' : 'Horario guardado';
    form.querySelector('#schedule-save').disabled = !dirty || !valid || saving;
    form.querySelector('#schedule-discard').disabled = !dirty || saving;
  }
  function renderWeek() {
    feedback.hidden = true;
    week.innerHTML = weekDays.map((name,index) => {
      const day = index + 1; const rows = draft.filter(row => row.dia === day);
      return `<section class="card schedule-day" data-day="${day}" aria-labelledby="schedule-day-${day}"><div class="schedule-day-head"><h3 id="schedule-day-${day}">${name}</h3><label class="check-field"><input type="checkbox" data-enabled="${day}" ${rows.length ? 'checked' : ''} aria-label="Permitir acceso el ${name.toLowerCase()}">Con acceso</label></div><div class="schedule-intervals">${rows.map((row,i) => `<div class="schedule-interval" data-index="${draft.indexOf(row)}"><div class="field"><label for="schedule-${day}-${i}-start">Desde</label><input id="schedule-${day}-${i}-start" type="time" value="${esc(row.inicio)}" data-part="inicio" aria-label="${name}, sesión ${i+1}, desde" aria-describedby="schedule-error-${day}" required></div><span class="schedule-time-separator" aria-hidden="true">→</span><div class="field"><label for="schedule-${day}-${i}-end">Hasta</label><input id="schedule-${day}-${i}-end" type="time" value="${esc(row.fin)}" data-part="fin" aria-label="${name}, sesión ${i+1}, hasta" aria-describedby="schedule-error-${day}" required></div><button class="button text" type="button" data-remove="${draft.indexOf(row)}" aria-label="Quitar sesión ${i+1} del ${name.toLowerCase()}">Quitar</button></div>`).join('') || '<p class="hint">Sin acceso este día.</p>'}</div><p class="schedule-day-error" id="schedule-error-${day}" role="alert" hidden></p><button class="button text" type="button" data-add="${day}" ${draft.length >= 35 ? 'disabled' : ''}>Agregar sesión <span class="sr-only">el ${name.toLowerCase()}</span></button></section>`;
    }).join('');
    update();
  }
  function load() {
    context.scheduleUserId = selected; select.value = selected;
    saved = data.horarios.filter(row => String(row.vendedor_id) === selected).map(row => ({dia:Number(row.dia),inicio:row.inicio.slice(0,5),fin:row.fin.slice(0,5)}));
    draft = clone(saved); feedback.hidden = true;
    const user = users.find(user => String(user.id) === selected);
    form.querySelector('#schedule-user-status').textContent = Number(user.bloqueado_permanente) ? 'Cuenta bloqueada permanentemente: guardar un horario no la desbloquea.' : !Number(user.activo) ? 'Cuenta inactiva: activa el usuario desde Usuarios para permitirle ingresar.' : 'Cuenta activa. Configura sus horas de acceso para cada día.';
    renderWeek();
  }
  form.querySelector('#schedule-timezone').textContent = data.configuracion.zona_horaria;
  search.addEventListener('input', () => {
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const matches = users.filter(user => normalize(`${user.nombre} ${user.usuario}`).includes(normalize(search.value.trim())));
    // Mantener visible la selección evita cambiar de cuenta al escribir una búsqueda.
    const visible = users.filter(user => String(user.id) === selected || matches.includes(user));
    select.innerHTML = visible.map(user => `<option value="${user.id}">${esc(user.nombre)} · ${esc(user.usuario)}</option>`).join(''); select.value = selected;
    form.querySelector('#schedule-search-empty').hidden = matches.length > 0;
  });
  select.addEventListener('change', () => { if (!confirmDiscard()) {select.value = selected;return;} selected = select.value; load(); });
  week.addEventListener('input', event => {
    if (!event.target.matches('input[type=time]')) return;
    const index = Number(event.target.closest('[data-index]').dataset.index);
    draft[index][event.target.dataset.part] = event.target.value; feedback.hidden = true; update();
  });
  const add = day => {
    if (draft.length >= 35) { renderWeek(); announce('Máximo 35 sesiones por semana.'); return; }
    const last = draft.filter(row => row.dia === day && row.fin).sort((a,b)=>b.fin.localeCompare(a.fin))[0];
    const start = last && minutes(last.fin) < 1439 ? last.fin : '08:00';
    const endMinutes = last && minutes(last.fin) < 1439 ? Math.min(minutes(start)+60,1439) : 1020;
    const end = `${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`;
    draft.push({dia:day,inicio:start,fin:end}); renderWeek();
    week.querySelector(`[data-day="${day}"] .schedule-interval:last-child input`).focus();
  };
  week.addEventListener('change', event => {
    if (!event.target.matches('[data-enabled]')) return;
    const day = Number(event.target.dataset.enabled);
    if (event.target.checked) add(day);
    else {draft = draft.filter(row => row.dia !== day); renderWeek(); week.querySelector(`[data-enabled="${day}"]`).focus();}
  });
  week.addEventListener('click', event => {
    const addButton = event.target.closest('[data-add]'); if (addButton) {add(Number(addButton.dataset.add));return;}
    const remove = event.target.closest('[data-remove]'); if (!remove) return;
    const index = Number(remove.dataset.remove), day = draft[index].dia;
    draft.splice(index,1); renderWeek(); week.querySelector(`[data-add="${day}"]`).focus();
  });
  form.querySelectorAll('[data-template]').forEach(button => button.addEventListener('click', () => {
    if (!window.confirm('¿Reemplazar la semana con esta plantilla? Después podrás ajustarla antes de guardar.')) return;
    draft = Array.from({length:5},(_,i) => button.dataset.template === 'split' ? [{dia:i+1,inicio:'08:00',fin:'12:00'},{dia:i+1,inicio:'13:00',fin:'17:00'}] : [{dia:i+1,inicio:'08:00',fin:'17:00'}]).flat(); feedback.hidden=true;renderWeek();
  }));
  form.querySelector('#schedule-copy').addEventListener('click', () => {
    if (!window.confirm('¿Reemplazar las sesiones de martes a viernes por las del lunes?')) return;
    const monday = draft.filter(row => row.dia === 1);
    const copied = [...draft.filter(row => row.dia === 1 || row.dia >= 6), ...[2,3,4,5].flatMap(dia => monday.map(row => ({...row,dia})))];
    if (copied.length > 35) {announce('La copia superaría el máximo de 35 sesiones.');return;}
    draft=copied;feedback.hidden=true;renderWeek();
  });
  form.querySelector('#schedule-discard').addEventListener('click', () => {if(confirmDiscard()) load();});
  form.addEventListener('submit', async event => {
    event.preventDefault(); if(saving || !dirty || Object.keys(scheduleSummary(draft).errors).length) return;
    if (!draft.length && !window.confirm('El usuario quedará sin acceso todos los días. ¿Guardar así?')) return;
    saving=true;controls.disabled=true;form.querySelector('#schedule-save').textContent='Guardando…';
    try {
      await saveSchedule({vendedor_id:Number(selected),horarios:clone(draft)});
      saved=clone(draft); data.horarios=[...data.horarios.filter(row=>String(row.vendedor_id)!==selected),...saved.map(row=>({...row,vendedor_id:selected}))];
      if(!disposed) announce('Horario guardado. Los cambios ya se aplican al acceso de este usuario.',true);
    } catch(error) {if(!disposed) announce(error.message);}
    finally {saving=false;controls.disabled=false;form.querySelector('#schedule-save').textContent='Guardar horario';if(!disposed)update();}
  });
  const leaving = event => {
    const link = event.target.closest('a[href]');
    if (!link || !form.isConnected || !dirty) return;
    if(saving || !confirmDiscard()) event.preventDefault();
  };
  const unloading = event => {if(dirty && form.isConnected){event.preventDefault();event.returnValue='';}};
  document.addEventListener('click',leaving);window.addEventListener('beforeunload',unloading);
  load();
  return () => {disposed=true;document.removeEventListener('click',leaving);window.removeEventListener('beforeunload',unloading);};
}
