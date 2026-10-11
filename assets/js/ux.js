export const adminSections = {
  overview: { label: 'Resumen', icon: 'dashboard', description: 'Elige qué necesitas administrar.' },
  users: { label: 'Usuarios', icon: 'group', description: 'Cuentas, contraseñas, correos y permisos.' },
  schedules: { label: 'Horarios', icon: 'schedule', description: 'Define cuándo puede ingresar cada facturador.' },
  blocks: { label: 'Bloqueos', icon: 'event_busy', description: 'Gestiona vacaciones, bloqueos temporales y permanentes.' },
  holidays: { label: 'Festivos', icon: 'event', description: 'Días sin acceso para los facturadores.' },
  mail: { label: 'Correos', icon: 'mail', description: 'Destinatario de alertas, estado de envíos y reintentos.' },
  activity: { label: 'Actividad', icon: 'history', description: 'Consulta los accesos rechazados y las operaciones registradas.' },
  settings: { label: 'Configuración', icon: 'settings', description: 'Consulta los servicios y las reglas generales del sistema.' }
};

export function adminShell(section, data, content) {
  const navigation = Object.entries(adminSections).map(([key, item]) => `<a href="#admin/${key}" ${key === section ? 'aria-current="page"' : ''}><span class="material-symbols-rounded" aria-hidden="true">${item.icon}</span>${item.label}</a>`).join('');
  if (section === 'overview') {
    const active = data.usuarios.filter(user => Number(user.activo) && !Number(user.bloqueado_permanente)).length;
    const failed = data.correos.filter(mail => mail.estado === 'fallido').length;
    content = `<div class="admin-metrics"><a class="card" href="#admin/users"><span class="stat-value">${active} / ${data.usuarios.length}</span><span class="stat-label">Usuarios habilitados</span></a><a class="card" href="#admin/mail"><span class="stat-value">${failed}</span><span class="stat-label">Correos fallidos en los últimos 200 envíos</span></a><a class="card" href="#admin/activity"><span class="stat-value">${data.intentos.length}</span><span class="stat-label">Accesos rechazados recientes (máximo 200)</span></a></div><div class="admin-cards">${Object.entries(adminSections).filter(([key]) => key !== 'overview').map(([key,item]) => `<a class="card admin-shortcut" href="#admin/${key}"><span class="material-symbols-rounded" aria-hidden="true">${item.icon}</span><div><h2>${item.label}</h2><p>${item.description}</p></div><span aria-hidden="true">→</span></a>`).join('')}</div>`;
  }
  return `<div class="admin-shell"><nav class="admin-nav" aria-label="Secciones de administración">${navigation}</nav><p class="view-description">${adminSections[section].description}</p><div class="admin-content">${content}</div></div>`;
}

export function bindAdminForms(root, action) {
  return (selector, name, transform = value => value) => {
    const form = root.querySelector(selector); if (!form) return;
    // Cada formulario conserva etiquetas únicas, incluso si comparte campos con otro.
    form.querySelectorAll('[id^="edit-"]').forEach(input => {
      const old = input.id; input.id = `${form.getAttribute('id')}-${old}`;
      form.querySelector(`label[for="${old}"]`)?.setAttribute('for', input.id);
    });
    form.insertAdjacentHTML('beforeend', '<p class="form-error" role="alert" tabindex="-1" hidden></p>');
    form.addEventListener('submit', async event => {
      event.preventDefault(); const button = event.submitter; const label = button.textContent;
      const error = form.querySelector('.form-error'); error.hidden = true;
      button.disabled = true; button.textContent = 'Guardando…';
      try {
        const data = Object.fromEntries(new FormData(form));
        form.querySelectorAll('input[type=checkbox]').forEach(input => { data[input.name] = input.checked; });
        await action(name, transform(data));
      } catch (problem) { error.textContent = problem.message; error.hidden = false; error.focus(); }
      finally { button.disabled = false; button.textContent = label; }
    });
  };
}

let tableNumber = 0;
export function enhanceTables(root) {
  root.querySelectorAll('.table-wrap').forEach(wrapper => {
    if (wrapper.dataset.searchable || !wrapper.querySelector('tbody')) return;
    wrapper.dataset.searchable = 'true';
    const rows = [...wrapper.querySelectorAll('tbody tr')];
    if (!rows.length) return;
    const id = `table-search-${++tableNumber}`;
    const toolbar = document.createElement('div'); toolbar.className = 'table-tools';
    toolbar.innerHTML = `<div class="field"><label for="${id}">Buscar en este listado</label><input id="${id}" type="search" placeholder="Escribe un nombre, correo o dato…"></div><span class="hint" role="status" aria-live="polite"></span>`;
    const footer = document.createElement('div'); footer.className = 'table-pagination';
    footer.innerHTML = '<button class="button secondary" type="button">Anterior</button><span></span><button class="button secondary" type="button">Siguiente</button>';
    const empty = document.createElement('p'); empty.className = 'empty-search'; empty.textContent = 'No hay resultados. Prueba con otro término.'; empty.hidden = true;
    wrapper.before(toolbar); wrapper.after(empty, footer);
    let page = 0; const pageSize = 10;
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const text = rows.map(row => normalize(row.textContent));
    const [previous, next] = footer.querySelectorAll('button');
    const update = () => {
      const query = normalize(toolbar.querySelector('input').value.trim());
      const matching = rows.filter((row,index) => text[index].includes(query));
      const pages = Math.max(1, Math.ceil(matching.length / pageSize)); page = Math.min(page, pages - 1);
      rows.forEach(row => { row.hidden = true; }); matching.slice(page * pageSize, (page + 1) * pageSize).forEach(row => { row.hidden = false; });
      toolbar.querySelector('[role=status]').textContent = `${matching.length} de ${rows.length} registros`;
      empty.hidden = matching.length > 0; wrapper.hidden = matching.length === 0;
      footer.hidden = matching.length <= pageSize;
      previous.disabled = page === 0; next.disabled = page >= pages - 1;
      footer.querySelector('span').textContent = `Página ${page + 1} de ${pages}`;
    };
    toolbar.querySelector('input').addEventListener('input', () => { page = 0; update(); });
    previous.addEventListener('click', () => { page--; update(); }); next.addEventListener('click', () => { page++; update(); }); update();
  });
}
