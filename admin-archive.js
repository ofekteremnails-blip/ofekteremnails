// Separate from getAppointments(): historical records never feed booking slots
// or expose the active appointment editing controls.
let archiveViewRequest = 0;
let archivePageOffset = 0;
let archiveNextOffset = null;
let archiveAppliedFilters = { month: '', query: '' };

function fetchArchivePage(filters, offset) {
  return new Promise(resolve => {
    const cb = 'archive_' + Date.now() + '_' + (++archiveViewRequest);
    const script = document.createElement('script');
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.remove();
      window[cb] = () => {};
      setTimeout(() => { delete window[cb]; }, 60000);
      resolve(result);
    };
    window[cb] = data => finish(data && data.success === true &&
      Array.isArray(data.appointments) && data.appointments.every(a => a &&
        ['id', 'clientName', 'clientPhone', 'date', 'time', 'serviceName', 'status', 'notes'].every(key => typeof a[key] === 'string')) &&
      Number.isInteger(data.total) && data.total >= 0 &&
      data.offset === offset && (data.nextOffset === null || data.nextOffset === offset + 50)
      ? data : null);
    script.onerror = () => finish(null);
    const timer = setTimeout(() => finish(null), 25000);
    script.src = WEBAPP_URL + '?action=loadArchive&callback=' + cb + '&offset=' + offset +
      '&month=' + encodeURIComponent(filters.month) + '&query=' + encodeURIComponent(filters.query);
    document.body.appendChild(script);
  });
}

function archiveCard(appt) {
  const status = { pending: 'ממתין', confirmed: 'מאושר', completed: 'הושלם', cancelled: 'בוטל' }[appt.status] || appt.status;
  return `<article class="appt-card">
    <div class="appt-card-body">
      <div class="appt-client-name">${sanitize(appt.clientName)}</div>
      <div>${sanitize(appt.date)} · ${sanitize(appt.time)} · ${sanitize(status)}</div>
      <div>${sanitize(appt.serviceName)} · ${sanitize(String(appt.duration))} דקות</div>
      <div dir="ltr" style="text-align:right">${sanitize(appt.clientPhone)}</div>
      ${appt.notes ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${sanitize(appt.notes)}</p>` : ''}
      <small>מזהה תור: ${sanitize(appt.id)}</small>
    </div>
  </article>`;
}

async function showArchivePage(offset = 0, filters = archiveAppliedFilters) {
  const controls = ['archiveSearchButton', 'archiveQuery', 'archiveMonth', 'archivePrevious', 'archiveNext'];
  controls.forEach(id => { document.getElementById(id).disabled = true; });
  const status = document.getElementById('archiveStatus');
  const list = document.getElementById('archiveList');
  status.textContent = 'טוען היסטוריית תורים...';
  list.setAttribute('aria-busy', 'true');
  list.innerHTML = '';
  const data = await fetchArchivePage(filters, offset);
  list.setAttribute('aria-busy', 'false');
  ['archiveSearchButton', 'archiveQuery', 'archiveMonth'].forEach(id => { document.getElementById(id).disabled = false; });
  if (!data) {
    status.textContent = 'לא הצלחנו לטעון את הארכיון. לחצי על חיפוש כדי לנסות שוב.';
    return;
  }
  archiveAppliedFilters = { ...filters };
  archivePageOffset = offset;
  archiveNextOffset = data.nextOffset;
  status.textContent = data.total ? `מציגה ${offset + 1}–${offset + data.appointments.length} מתוך ${data.total} תורים` : 'לא נמצאו תורים בארכיון עבור החיפוש הזה.';
  list.innerHTML = data.appointments.map(archiveCard).join('');
  document.getElementById('archivePrevious').disabled = offset === 0;
  document.getElementById('archiveNext').disabled = data.nextOffset === null;
}

document.addEventListener('DOMContentLoaded', () => {
  let opened = false;
  document.getElementById('appointmentArchive').addEventListener('toggle', event => {
    if (event.target.open && !opened) { opened = true; showArchivePage(0); }
  });
  document.getElementById('archiveSearchForm').addEventListener('submit', event => {
    event.preventDefault();
    if (document.getElementById('archiveSearchButton').disabled) return;
    showArchivePage(0, {
      query: document.getElementById('archiveQuery').value.trim(),
      month: document.getElementById('archiveMonth').value
    });
  });
  document.getElementById('archivePrevious').addEventListener('click', () => showArchivePage(Math.max(0, archivePageOffset - 50)));
  document.getElementById('archiveNext').addEventListener('click', () => { if (archiveNextOffset !== null) showArchivePage(archiveNextOffset); });
});
