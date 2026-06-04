// ── STATE ──
let selected = { services: [], date: null, time: null };
let calYear, calMonth;
let currentClient = null;
let _slotLockTimer = null;   // countdown interval
let _slotLockExpiry = null;  // timestamp

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  requestNotificationPermission();
  initCalendar();
  bindSteps();
  bindMobileMenu();
  // אם מחוברת - הצג שלב 1 מיד, טען הגדרות ברקע
  const saved = localStorage.getItem('clientSession');
  if (saved) {
    try {
      currentClient = JSON.parse(saved);
      // אם יש session אבל אין שם - נסה לטעון מ-Sheets
      if (currentClient && !currentClient.name && currentClient.phone) {
        loadSettingsFromSheets().then(() => renderServices());
        lookupAndRefreshClient(currentClient.phone);
        return;
      }
      renderServices();
      showClientGreeting(currentClient);
      showStep(1);
      prefillClientDetails();
      loadSettingsFromSheets().then(() => renderServices());
      return;
    } catch(e) {}
  }
  loadSettingsFromSheets().then(() => {
    renderServices();
    initClientLogin();
  });
});

// ── CLIENT LOGIN ──
function lookupAndRefreshClient(phone) {
  const cb = 'lrc' + Date.now();
  const url = WEBAPP_URL + '?action=lookupClient&callback=' + cb + '&phone=' + encodeURIComponent(phone);
  window[cb] = (data) => {
    delete window[cb]; document.getElementById(cb)?.remove();
    currentClient = { name: data && data.name ? data.name : null, phone };
    localStorage.setItem('clientSession', JSON.stringify(currentClient));
    showClientGreeting(currentClient);
    showStep(1);
    prefillClientDetails();
  };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  s.onerror = () => { delete window[cb]; showStep(1); };
  document.body.appendChild(s);
}

function initClientLogin() {
  const saved = localStorage.getItem('clientSession');
  if (saved) {
    try {
      currentClient = JSON.parse(saved);
      showClientGreeting(currentClient);
      showStep(1);
      prefillClientDetails();
      return;
    } catch(e) {}
  }
  document.querySelectorAll('.booking-step').forEach(s => s.classList.add('hidden'));
  document.getElementById('stepLogin').classList.remove('hidden');
  document.getElementById('loginBtn').addEventListener('click', handleClientLogin);
  document.getElementById('loginPhone').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleClientLogin();
  });
}

function handleClientLogin() {
  const phone = document.getElementById('loginPhone').value.trim();
  if (!phone || !/^[0-9+\-\s]{9,15}$/.test(phone)) {
    document.getElementById('loginPhone').style.borderColor = '#e05';
    return;
  }
  document.getElementById('loginPhone').style.borderColor = '';
  // חפש לקוחה קיימת
  lookupClient(phone);
}

function lookupClient(phone) {
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'מחפש...';
  btn.disabled = true;
  const cb = 'lc' + Date.now();
  const url = WEBAPP_URL + '?action=lookupClient&callback=' + cb + '&phone=' + encodeURIComponent(phone);
  window[cb] = (data) => {
    delete window[cb]; document.getElementById(cb)?.remove();
    btn.textContent = 'המשך ←';
    btn.disabled = false;
    if (data && data.name) {
      // לקוחה קיימת
      currentClient = { name: data.name, phone };
    } else {
      // לקוחה חדשה
      currentClient = { name: null, phone };
    }
    localStorage.setItem('clientSession', JSON.stringify(currentClient));
    showClientGreeting(currentClient);
    showStep(1);
    prefillClientDetails();
  };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  s.onerror = () => {
    delete window[cb];
    btn.textContent = 'המשך ←';
    btn.disabled = false;
    currentClient = { name: null, phone };
    localStorage.setItem('clientSession', JSON.stringify(currentClient));
    showStep(1);
    prefillClientDetails();
  };
  document.body.appendChild(s);
}

function showClientGreeting(client) {
  const greeting = document.getElementById('clientGreeting');
  const nameEl = document.getElementById('greetingName');
  const avatarEl = document.getElementById('greetingAvatar');
  if (client && client.name) {
    nameEl.textContent = 'שלום, ' + client.name + '! 💅';
    avatarEl.textContent = client.name.charAt(0);
    greeting.classList.remove('hidden');
    loadMyAppointments(client.phone);
  } else {
    greeting.classList.add('hidden');
    document.getElementById('myAppointmentsCard').classList.add('hidden');
  }
}

function loadMyAppointments(phone) {
  const card = document.getElementById('myAppointmentsCard');
  const list = document.getElementById('myApptsList');
  card.classList.remove('hidden');

  const norm = (p) => { let n = String(p||'').replace(/\D/g,''); if(n.startsWith('972')) n='0'+n.slice(3); if(!n.startsWith('0')&&n.length>0) n='0'+n; return n; };

  function renderAppts(rows) {
    const today = todayStrTZ();
    const appts = rows.map(r => {
      let time = String(r['שעה'] || r.time || '');
      if (time.includes('T') || time.includes('1899')) {
        const d = new Date(time);
        time = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
      }
      let date = String(r['תאריך'] || r.date || '');
      if (date.includes('T') || date.includes('Z')) {
        const d = new Date(date);
        date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      }
      let p = String(r['טלפון'] || r.clientPhone || '');
      return {
        serviceName: String(r['שירות'] || r.serviceName || ''),
        date, time,
        status: String(r['סטטוס'] || r.status || ''),
        phone: norm(p)
      };
    }).filter(a => norm(a.phone) === norm(phone) && (a.status === 'pending' || a.status === 'confirmed') && a.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    if (appts.length === 0) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const waPhone = (getSettings().waPhone || '972546827299').replace(/\D/g,'');
    list.innerHTML = appts.map(a => {
      const statusEmoji = a.status === 'confirmed' ? '✅' : '⏳';
      const statusText  = a.status === 'confirmed' ? 'מאושר' : 'ממתין לאישור';
      const statusColor = a.status === 'confirmed' ? '#25D366' : '#f0a500';
      const cancelMsg = encodeURIComponent(`היי אופק! 💅\nאני רוצה לבטל את התור שלי:\n💅 ${a.serviceName}\n📅 ${formatDate(a.date)}\n🕐 ${a.time}\nתודה!`);
      const changeMsg = encodeURIComponent(`היי אופק! 💅\nאני רוצה לשנות את התור שלי:\n💅 ${a.serviceName}\n📅 ${formatDate(a.date)}\n🕐 ${a.time}\nאפשר לתאם זמן אחר?`);
      return `
        <div class="my-appt-item">
          <div class="my-appt-status" style="color:${statusColor}">${statusEmoji} ${statusText}</div>
          <div class="my-appt-service">💅 ${sanitize(a.serviceName)}</div>
          <div class="my-appt-datetime">📅 ${sanitize(formatDate(a.date))} · 🕐 ${sanitize(a.time)}</div>
          <div class="my-appt-actions">
            <a href="https://wa.me/${waPhone}?text=${changeMsg}" target="_blank" class="my-appt-btn change">✏️ שינוי תור</a>
            <a href="https://wa.me/${waPhone}?text=${cancelMsg}" target="_blank" class="my-appt-btn cancel">✕ ביטול</a>
          </div>
        </div>`;
    }).join('');
  }

  // הצג מיד מ-localStorage
  const cached = getAppointments();
  if (cached.length > 0) renderAppts(cached);
  else list.innerHTML = '<p style="color:#aaa;font-size:13px;padding:8px 0">טוען תורים...</p>';

  // רענן מ-Sheets ברקע
  const cb = 'ma' + Date.now();
  const url = WEBAPP_URL + '?action=load&callback=' + cb;
  window[cb] = (rows) => {
    delete window[cb]; document.getElementById(cb)?.remove();
    if (Array.isArray(rows) && rows.length > 0) {
      saveAppointments(rows.map(r => {
        let time = String(r['שעה'] || '');
        if (time.includes('T') || time.includes('1899')) {
          const d = new Date(time);
          time = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        }
        let date = String(r['תאריך'] || '');
        if (date.includes('T') || date.includes('Z')) {
          const d = new Date(date);
          date = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        }
        return {
          id: String(r['ID'] || ''),
          serviceName: String(r['שירות'] || ''),
          date,
          time,
          clientPhone: String(r['טלפון'] || ''),
          status: String(r['סטטוס'] || 'pending'),
          duration: Number(r['משך'] || 60)
        };
      }).filter(a => a.id));
      renderAppts(rows);
    }
  };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  s.onerror = () => { delete window[cb]; };
  document.body.appendChild(s);
}

function toggleMyAppointments() {
  const list = document.getElementById('myApptsList');
  const btn = document.querySelector('.btn-toggle-appts');
  const isHidden = list.style.display === 'none';
  list.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? '▲' : '▼';
}

function prefillClientDetails() {
  if (!currentClient) return;
  const nameInput = document.getElementById('clientName');
  const phoneInput = document.getElementById('clientPhone');
  if (currentClient.name) nameInput.value = currentClient.name;
  if (currentClient.phone) phoneInput.value = currentClient.phone;
}

function skipLogin() {
  currentClient = null;
  showStep(1);
}

function logoutClient() {
  currentClient = null;
  localStorage.removeItem('clientSession');
  document.getElementById('clientGreeting').classList.add('hidden');
  document.querySelectorAll('.booking-step').forEach(s => s.classList.add('hidden'));
  document.getElementById('stepLogin').classList.remove('hidden');
  document.getElementById('loginPhone').value = '';
}

// ── MOBILE MENU ──
function bindMobileMenu() {
  document.getElementById('hamburger')?.addEventListener('click', () =>
    document.getElementById('mobileMenu').classList.add('open'));
  document.getElementById('closeMenu')?.addEventListener('click', () =>
    document.getElementById('mobileMenu').classList.remove('open'));
  document.querySelectorAll('.mob-link').forEach(l =>
    l.addEventListener('click', () => document.getElementById('mobileMenu').classList.remove('open')));
}

// ── CUSTOM TOAST / DIALOG ──
function showFormError(msg) {
  let el = document.getElementById('formError');
  if (!el) {
    el = document.createElement('p');
    el.id = 'formError';
    el.style.cssText = 'color:#e05;font-size:13px;font-weight:600;margin-top:-8px;margin-bottom:8px;';
    document.getElementById('bookingForm').prepend(el);
  }
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 3000);
}

// ── STEP NAVIGATION ──
function showStep(n) {
  document.querySelectorAll('.booking-step').forEach(s => s.classList.add('hidden'));
  document.getElementById('step' + n).classList.remove('hidden');
  document.querySelectorAll('.step').forEach(s => {
    const sn = +s.dataset.step;
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
  });
  setTimeout(() => {
    document.getElementById('step' + n).scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, 50);
}

function bindSteps() {
  document.getElementById('toStep2').addEventListener('click', () => { showStep(2); renderCalendar(); });
  document.getElementById('toStep1Back').addEventListener('click', () => showStep(1));
  document.getElementById('toStep3').addEventListener('click', () => {
    showStep(3);
    const grid = document.getElementById('slotsGrid');
    grid.innerHTML = '<p style="text-align:center;color:#aaa;padding:20px">טוען שעות פנויות...</p>';
    document.getElementById('toStep4').disabled = true;
    loadFromSheets().finally(() => renderSlots());
  });
  document.getElementById('toStep2Back').addEventListener('click', () => showStep(2));
  document.getElementById('toStep4').addEventListener('click', () => { showStep(4); renderSummaryMini(); prefillClientDetails(); });
  document.getElementById('toStep3Back').addEventListener('click', () => showStep(3));
  document.getElementById('bookingForm').addEventListener('submit', submitBooking);
}

// ── STEP 1: SERVICES ──
function renderServices() {
  const services = getServices();
  const container = document.getElementById('servicesList');
  container.innerHTML = services.map(s => `
    <div class="service-pick-card" data-id="${s.id}" onclick="toggleService('${s.id}')">
      <div class="spc-icon">${s.icon}</div>
      <div class="spc-info">
        <h3>${s.name}</h3>
        <p>${s.duration} דקות${s.price ? ' · ₪' + s.price : ''}</p>
      </div>
      <div class="spc-check">✓</div>
    </div>
  `).join('');
}

function toggleService(id) {
  const service = getServices().find(s => s.id === id);
  const index = selected.services.findIndex(s => s.id === id);
  
  if (index >= 0) {
    selected.services.splice(index, 1);
  } else {
    selected.services.push(service);
  }
  
  document.querySelectorAll('.service-pick-card').forEach(c => {
    const isSelected = selected.services.some(s => s.id === c.dataset.id);
    c.classList.toggle('selected', isSelected);
  });
  
  updateSelectedServicesPreview();
  document.getElementById('toStep2').disabled = selected.services.length === 0;
}

function updateSelectedServicesPreview() {
  const preview = document.getElementById('selectedServicesPreview');
  const list = document.getElementById('selectedServicesList');
  const totalDuration = document.getElementById('totalDuration');
  
  if (selected.services.length === 0) {
    preview.style.display = 'none';
    return;
  }
  
  preview.style.display = 'block';
  list.innerHTML = selected.services.map(s => 
    `<span style="background:var(--pink);color:#fff;padding:6px 12px;border-radius:20px;font-size:13px">${s.icon} ${s.name}</span>`
  ).join('');
  
  const total = selected.services.reduce((sum, s) => sum + s.duration, 0);
  totalDuration.textContent = total;
}

// ── STEP 2: CALENDAR ──
function initCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
}

function renderCalendar() {
  const title = document.getElementById('calTitle');
  const grid = document.getElementById('calGrid');
  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  title.textContent = `${monthNames[calMonth]} ${calYear}`;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = todayStrTZ();

  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isPast = dateStr < todayStr;
    const isWork = isWorkDay(dateStr);
    const isSelected = selected.date === dateStr;
    let cls = 'cal-cell';
    if (isPast || !isWork) cls += ' disabled';
    else cls += ' available';
    if (isSelected) cls += ' selected';
    const onclick = (!isPast && isWork) ? `onclick="selectDate('${dateStr}')"` : '';
    html += `<div class="${cls}" ${onclick}>${d}</div>`;
  }
  grid.innerHTML = html;

  document.getElementById('prevMonth').onclick = () => {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  };
  document.getElementById('nextMonth').onclick = () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  };
}

function selectDate(dateStr) {
  // שחרר lock קודם אם היה slot נבחר
  if (selected.date && selected.time) releaseSlot(selected.date, selected.time);
  selected.date = dateStr;
  selected.time = null;
  _clearSlotLockUI();
  document.getElementById('toStep3').disabled = false;
  renderCalendar();
}

// ── STEP 3: SLOTS ──
function renderSlots() {
  const label = document.getElementById('selectedDateLabel');
  const grid = document.getElementById('slotsGrid');
  const noSlots = document.getElementById('noSlots');
  const waitlistOffer = document.getElementById('waitlistOffer');
  label.textContent = formatDate(selected.date);

  const totalDuration = selected.services.reduce((sum, s) => sum + s.duration, 0);
  const slots = getAvailableSlots(selected.date, totalDuration);

  if (slots.length === 0) {
    grid.innerHTML = '';
    noSlots.classList.remove('hidden');
    if (waitlistOffer) {
      waitlistOffer.classList.remove('hidden');
      // אפס את ה-offer אם כבר נרשמו קודם
      if (!waitlistOffer.querySelector('.btn-waitlist') && !waitlistOffer.querySelector('[style*="e8f8ef"]')) {
        waitlistOffer.innerHTML = `
          <p style="color:#888;font-size:14px;margin-bottom:12px">או הירשמי לרשימת המתנה ליום זה ונודיע לך אם יתפנה מקום</p>
          <button class="btn-waitlist" onclick="joinWaitlist()">🔔 הירשמי לרשימת המתנה</button>`;
      }
    }
    document.getElementById('toStep4').disabled = true;
    return;
  }

  noSlots.classList.add('hidden');
  if (waitlistOffer) { waitlistOffer.classList.add('hidden'); waitlistOffer.innerHTML = ''; }
  grid.innerHTML = slots.map(t =>
    `<button class="slot-btn" onclick="selectSlot('${t}', this)">${t}</button>`
  ).join('');
}

function selectSlot(time, el) {
  // שחרר lock קודם
  if (selected.time) releaseSlot(selected.date, selected.time);

  const locked = lockSlot(selected.date, time);
  if (!locked) {
    // מישהו אחר תפס את ה-slot באותה שנייה - רענן
    el.disabled = true;
    el.textContent = 'תפוס';
    el.classList.add('taken');
    renderSlots();
    return;
  }

  selected.time = time;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('toStep4').disabled = false;
  _startSlotLockCountdown();
}

function _startSlotLockCountdown() {
  _clearSlotLockUI();
  _slotLockExpiry = Date.now() + LOCK_TTL_MS;

  let timerEl = document.getElementById('slotLockTimer');
  if (!timerEl) {
    timerEl = document.createElement('div');
    timerEl.id = 'slotLockTimer';
    timerEl.style.cssText = 'text-align:center;font-size:13px;color:#f0a500;font-weight:600;margin-top:10px;padding:8px;background:#fff8e6;border-radius:8px;border:1px solid #ffc107';
    document.getElementById('slotsGrid').after(timerEl);
  }

  _slotLockTimer = setInterval(() => {
    const remaining = Math.ceil((_slotLockExpiry - Date.now()) / 1000);
    if (remaining <= 0) {
      _clearSlotLockUI();
      selected.time = null;
      document.getElementById('toStep4').disabled = true;
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      renderSlots();
      return;
    }
    if (timerEl) timerEl.textContent = `⏳ ה-slot שמור לך עוד ${remaining} שניות`;
  }, 1000);
}

function _clearSlotLockUI() {
  if (_slotLockTimer) { clearInterval(_slotLockTimer); _slotLockTimer = null; }
  document.getElementById('slotLockTimer')?.remove();
}

// ── WAITLIST ──
function joinWaitlist() {
  const offer = document.getElementById('waitlistOffer');

  // אם אין לקוחה מחוברת - הצג טופס inline
  if (!currentClient || !currentClient.phone) {
    offer.innerHTML = `
      <div class="waitlist-form">
        <input id="wlName" type="text" placeholder="שם מלא *" style="width:100%;padding:10px;border:1.5px solid #e0c8d0;border-radius:10px;font-family:inherit;font-size:14px;margin-bottom:8px"/>
        <input id="wlPhone" type="tel" placeholder="טלפון *" inputmode="numeric" style="width:100%;padding:10px;border:1.5px solid #e0c8d0;border-radius:10px;font-family:inherit;font-size:14px;margin-bottom:12px"/>
        <button onclick="submitWaitlist()" class="btn-waitlist" style="width:100%">✅ הירשמי לרשימת המתנה</button>
        <p id="wlError" style="color:#e05;font-size:13px;margin-top:6px"></p>
      </div>`;
    return;
  }
  submitWaitlist();
}

function submitWaitlist() {
  const offer = document.getElementById('waitlistOffer');
  let name  = currentClient?.name;
  let phone = currentClient?.phone;

  if (!name || !phone) {
    name  = document.getElementById('wlName')?.value.trim();
    phone = document.getElementById('wlPhone')?.value.trim();
    if (!name) { document.getElementById('wlError').textContent = 'אנא הכניסי שם'; return; }
    if (!phone || !/^[0-9+\-\s]{9,15}$/.test(phone)) { document.getElementById('wlError').textContent = 'טלפון לא תקין'; return; }
    currentClient = { name, phone };
    localStorage.setItem('clientSession', JSON.stringify(currentClient));
  }

  const totalDuration = selected.services.reduce((sum, s) => sum + s.duration, 0);
  const servicesNames = selected.services.map(s => s.name).join(', ');

  const url = WEBAPP_URL + '?action=addWaitlist'
    + '&date='     + encodeURIComponent(selected.date)
    + '&name='     + encodeURIComponent(name)
    + '&phone='    + encodeURIComponent(phone)
    + '&service='  + encodeURIComponent(servicesNames)
    + '&duration=' + totalDuration
    + '&status=waiting'
    + '&createdAt='+ encodeURIComponent(new Date().toISOString());

  fetch(url, { mode: 'no-cors' })
    .then(() => {
      offer.innerHTML = `
        <div style="background:#e8f8ef;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:32px;margin-bottom:8px">✅</div>
          <p style="color:#1a6e3a;font-weight:700;font-size:15px">נרשמת לרשימת המתנה!</p>
          <p style="color:#555;font-size:13px;margin-top:4px">נשלח לך הודעת WhatsApp אם יתפנה מקום ביום זה 💅</p>
        </div>`;
    })
    .catch(() => {
      offer.innerHTML = '<p style="color:#e05;font-size:13px">שגיאה בהרשמה, נסי שוב</p>';
    });
}

// ── STEP 4: SUMMARY + FORM ──
function renderSummaryMini() {
  const servicesHtml = selected.services.map(s => 
    `<div class="summary-row"><span>${sanitize(s.icon)} ${sanitize(s.name)}</span></div>`
  ).join('');
  
  document.getElementById('summaryMini').innerHTML = `
    ${servicesHtml}
    <div class="summary-row"><span>📅 ${sanitize(formatDate(selected.date))}</span></div>
    <div class="summary-row"><span>🕐 ${sanitize(selected.time)}</span></div>
  `;
}

function submitBooking(e) {
  e.preventDefault();
  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const notes = document.getElementById('clientNotes').value.trim();

  if (!name) { showFormError('אנא הכניסי שם מלא'); return; }
  if (name.trim().split(/\s+/).length < 2) { showFormError('אנא הכניסי שם פרטי ושם משפחה'); return; }
  if (!phone) { showFormError('אנא הכניסי מספר טלפון'); return; }
  if (!/^[0-9+\-\s]{9,15}$/.test(phone)) { showFormError('מספר טלפון לא תקין'); return; }

  // בדוק שה-slot עדיין פנוי (re-validate לפני שמירה)
  const totalDuration = selected.services.reduce((sum, s) => sum + s.duration, 0);
  const available = getAvailableSlots(selected.date, totalDuration);
  if (!available.includes(selected.time)) {
    showFormError('השעה שבחרת כבר נתפסה על ידי מישהו אחר. אנא בחרי שעה אחרת');
    _clearSlotLockUI();
    selected.time = null;
    document.getElementById('toStep4').disabled = true;
    showStep(3);
    renderSlots();
    return;
  }

  const servicesNames = selected.services.map(s => s.name).join(', ');
  const servicesIcons = selected.services.map(s => s.icon).join(' ');

  const appt = {
    id: generateId(),
    serviceId: selected.services.map(s => s.id).join(','),
    serviceName: servicesNames,
    serviceIcon: servicesIcons,
    duration: totalDuration,
    date: selected.date,
    time: selected.time,
    clientName: name,
    clientPhone: phone,
    notes,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // שחרר lock לפני שמירה (התור עצמו יחסום את ה-slot)
  releaseSlot(selected.date, selected.time);
  _clearSlotLockUI();

  const appointments = getAppointments();
  appointments.push(appt);
  saveAppointments(appointments);
  saveToSheets(appt);

  saveClientToSheets(name, phone);
  currentClient = { name, phone };
  localStorage.setItem('clientSession', JSON.stringify(currentClient));
  showClientGreeting(currentClient);
  scheduleAppointmentReminders(appt);
  sendReminderToSheets(appt);
  showConfirmation(appt);
}

// ── STEP 5: CONFIRMATION ──
function showConfirmation(appt) {
  showStep(5);
  document.getElementById('confirmDetails').innerHTML = `
    <div class="confirm-row">${sanitize(appt.serviceIcon)} <strong>${sanitize(appt.serviceName)}</strong></div>
    <div class="confirm-row">📅 <strong>${sanitize(formatDate(appt.date))}</strong></div>
    <div class="confirm-row">🕐 <strong>${sanitize(appt.time)}</strong></div>
    <div class="confirm-row">👤 <strong>${sanitize(appt.clientName)}</strong></div>
  `;

  const settings = getSettings();
  const msg = `היי אופק! 💅\nקבעתי תור:\n✨ ${appt.serviceName}\n📅 ${formatDate(appt.date)}\n🕐 ${appt.time}\n👤 ${appt.clientName}\n📞 ${appt.clientPhone}${appt.notes ? '\n📝 ' + appt.notes : ''}`;
  document.getElementById('confirmWA').href = `https://wa.me/${settings.waPhone}?text=${encodeURIComponent(msg)}`;

  // show whatsapp button - don't auto-open (blocked on mobile)
}

