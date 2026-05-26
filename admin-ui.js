// ── WEBAUTHN BIOMETRIC ──
const BIOMETRIC_KEY = 'biometricCredentialId';

async function initBiometric() {
  if (!window.PublicKeyCredential) return;
  const credId = localStorage.getItem(BIOMETRIC_KEY);
  if (credId) {
    // יש Face ID שמור - הצג כפתור ונסה אוטומטית
    document.getElementById('biometricBtn').style.display = 'flex';
    document.getElementById('biometricBtn').addEventListener('click', loginWithBiometric);
    setTimeout(() => loginWithBiometric(), 300);
  } else {
    // אין Face ID - הצג כפתור הגדרה מתחת הסיסמא
    document.getElementById('setupBiometricBtn').style.display = 'block';
  }
}

async function loginWithBiometric() {
  try {
    const credId = localStorage.getItem(BIOMETRIC_KEY);
    if (!credId) return;
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: base64ToBuffer(credId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      }
    });
    if (assertion) {
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('adminWrap').style.display = 'flex';
      initAdmin();
    }
  } catch(e) {
    console.log('Biometric failed:', e.message);
  }
}

async function setupBiometric() {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: '???? ??? ?????', id: location.hostname },
        user: { id: userId, name: 'admin', displayName: 'Admin' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' },
        timeout: 60000,
      }
    });
    if (credential) {
      localStorage.setItem(BIOMETRIC_KEY, bufferToBase64(credential.rawId));
      document.getElementById('biometricBtn').style.display = 'flex';
      document.getElementById('setupBiometricBtn').style.display = 'none';
      showToast('✅ Face ID נשמר בהצלחה!');
    }
  } catch(e) {
    showToast('❌ לא ניתן להגדיר Face ID בדפדפן זה', '#e05');
  }
}

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
function base64ToBuffer(base64) {
  const bin = atob(base64);
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initBiometric();
  document.getElementById('loginBtn').addEventListener('click', tryLogin);
  document.getElementById('passInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  document.getElementById('setupBiometricBtn').addEventListener('click', setupBiometric);
  document.querySelectorAll('.snav-btn, .bnav-btn').forEach(btn => btn.addEventListener('click', () => switchPanel(btn.dataset.panel)));
  document.getElementById('filterStatus').addEventListener('change', renderAllAppointments);
  document.getElementById('filterDate').addEventListener('change', renderAllAppointments);
  document.getElementById('clearFilter').addEventListener('click', clearFilters);
  document.getElementById('saveSettings').addEventListener('click', saveSettingsHandler);
  document.getElementById('addServiceBtn').addEventListener('click', addService);
  document.getElementById('saveServices').addEventListener('click', saveServicesHandler);
  document.getElementById('clientSearch').addEventListener('input', renderClientsList);

  document.getElementById('dashSearch')?.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    const resultsEl = document.getElementById('dashSearchResults');
    if (!q) { resultsEl.innerHTML = ''; return; }
    const results = getAppointments().filter(a =>
      a.clientName.toLowerCase().includes(q) || a.clientPhone.includes(q)
    ).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    resultsEl.innerHTML = results.length ? results.map(a => apptCard(a, true)).join('') : emptyMsg('לא נמצאו תוצאות');
  });
});

// ── LOGIN ──
function tryLogin() {
  const pass = document.getElementById('passInput').value.trim();
  const settings = getSettings();
  const correctPass = settings.adminPass || '1234';
  if (pass === correctPass) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminWrap').style.display = 'flex';
    // הצג כפתור הגדרת Face ID אם לא הוגדר עדיין
    if (window.PublicKeyCredential && !localStorage.getItem(BIOMETRIC_KEY)) {
      document.getElementById('setupBiometricBtn').style.display = 'block';
    }
    initAdmin();
  } else {
    document.getElementById('loginErr').classList.remove('hidden');
    document.getElementById('passInput').value = '';
  }
}

function doLogout() {
  document.getElementById('adminWrap').style.display = 'none';
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('passInput').value = '';
  document.getElementById('loginErr').style.display = 'none';
}

function initAdmin() {
  requestNotificationPermission();
  showMiniLoader();
  Promise.all([loadFromSheets(), loadSettingsFromSheets(), loadClientsFromSheets().then(clients => {
    if (clients && clients.length > 0) DB.set('clients_cache', clients);
  })]).then(() => {
    hideMiniLoader();
    _renderDashboard();
  }).catch(() => {
    hideMiniLoader();
    _renderDashboard();
  });
}

function showMiniLoader() {
  const loader = document.createElement('div');
  loader.id = 'miniLoader';
  loader.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(232,164,184,0.95);color:#fff;padding:12px 24px;border-radius:50px;font-size:14px;font-weight:600;z-index:9999;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.2);animation:slideDown 0.3s ease';
  loader.innerHTML = '<div style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite"></div><span>טוען נתונים...</span>';
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes slideDown { from { transform: translateX(-50%) translateY(-20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
  `;
  document.head.appendChild(style);
  document.body.appendChild(loader);
}

function hideMiniLoader() {
  const loader = document.getElementById('miniLoader');
  if (loader) {
    loader.style.animation = 'slideDown 0.3s ease reverse';
    setTimeout(() => loader.remove(), 300);
  }
}

// ── PANEL NAVIGATION ──
function switchPanel(panel) {
  document.querySelectorAll('.snav-btn, .bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll(`[data-panel="${panel}"]`).forEach(b => b.classList.add('active'));
  document.getElementById('panel-' + panel).classList.add('active');
  const titleEl = document.getElementById('topbarTitle');
  const btn = document.querySelector(`.snav-btn[data-panel="${panel}"] span, .bnav-btn[data-panel="${panel}"] span`);
  if (titleEl && btn) titleEl.textContent = btn.textContent;
  if (panel === 'dashboard') renderDashboard();
  if (panel === 'calendar') renderAdminCalendar();
  if (panel === 'appointments') renderAllAppointments();
  if (panel === 'settings') renderSettings();
  if (panel === 'clients') renderClientsList();
  if (panel === 'services') renderServicesEditor();
}

// ── TOAST ──
function showToast(msg, color = '#25D366') {
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(80px);background:#1e1118;color:#fff;padding:14px 28px;border-radius:50px;font-size:14px;font-weight:600;font-family:Heebo,sans-serif;z-index:9999;transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;white-space:nowrap;';
    document.body.appendChild(t);
  }
  t.style.borderLeft = `4px solid ${color}`;
  t.textContent = msg;
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.transform = 'translateX(-50%) translateY(80px)'; }, 2500);
}

// ── CONFIRM DIALOG ──
function showConfirmDialog(msg, onConfirm) {
  let overlay = document.getElementById('confirmDialog');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirmDialog';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:20px;padding:32px 28px;max-width:320px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    const msgEl = document.createElement('p');
    msgEl.id = 'confirmDialogMsg';
    msgEl.style.cssText = 'font-size:16px;color:#1e1118;margin-bottom:24px;line-height:1.6;';

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    const noBtn = document.createElement('button');
    noBtn.id = 'confirmDialogNo';
    noBtn.style.cssText = 'padding:10px 24px;border:2px solid #e0e0e0;border-radius:20px;background:none;cursor:pointer;font-family:Heebo,sans-serif;font-size:14px;color:#888;';
    noBtn.textContent = 'בטל';

    const yesBtn = document.createElement('button');
    yesBtn.id = 'confirmDialogYes';
    yesBtn.style.cssText = 'padding:10px 24px;border:none;border-radius:20px;background:#e05;color:#fff;cursor:pointer;font-family:Heebo,sans-serif;font-size:14px;font-weight:700;';
    yesBtn.textContent = 'מחק';

    btns.appendChild(noBtn);
    btns.appendChild(yesBtn);
    box.appendChild(msgEl);
    box.appendChild(btns);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
  document.getElementById('confirmDialogMsg').textContent = msg;
  overlay.style.display = 'flex';
  document.getElementById('confirmDialogYes').onclick = () => { overlay.style.display = 'none'; onConfirm(); };
  document.getElementById('confirmDialogNo').onclick  = () => { overlay.style.display = 'none'; };
}

// ── HELPERS ──
function todayStr() { return new Date().toISOString().slice(0, 10); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function weekEnd() { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }

const STATUS_LABELS = { pending: 'ממתין', confirmed: 'מאושר', completed: 'הושלם', cancelled: 'בוטל' };
const STATUS_COLORS = { pending: '#f0a500', confirmed: '#25D366', completed: '#888', cancelled: '#e05' };

function emptyMsg(txt) { return `<p class="empty-msg">${txt}</p>`; }

function toWAPhone(phone) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('972')) return p;
  if (p.startsWith('0')) return '972' + p.slice(1);
  return '972' + p;
}

function apptCard(appt, showDate = false) {
  const dateLabel = showDate ? `<div class="appt-date">${sanitize(formatDate(appt.date))}</div>` : '';
  const statusBg = { pending: '#fff8e6', confirmed: '#e8f8ef', completed: '#f5f5f5', cancelled: '#fff0f0' };
  const statusColor = STATUS_COLORS[appt.status];
  return `
    <div class="appt-card status-${sanitize(appt.status)}" data-id="${sanitize(appt.id)}">
      <div class="appt-card-main">
        <div class="appt-card-left">
          <div class="appt-time-badge">${sanitize(appt.time)}</div>
          <span class="appt-status-pill" style="background:${statusBg[appt.status]};color:${statusColor}">${STATUS_LABELS[appt.status]}</span>
        </div>
        <div class="appt-card-body">
          ${dateLabel}
          <div class="appt-client-name">${sanitize(appt.clientName)}</div>
          <div class="appt-service-name">${sanitize(appt.serviceIcon || '💅')} ${sanitize(appt.serviceName)} &bull; ${sanitize(String(appt.duration))}דק'</div>
          <a href="tel:${sanitize(appt.clientPhone)}" class="appt-phone">${sanitize(appt.clientPhone)}</a>
          ${appt.notes ? `<div class="appt-notes">📝 ${sanitize(appt.notes)}</div>` : ''}
        </div>
      </div>
      <div class="appt-card-actions">
        ${appt.status === 'pending' ? `<button onclick="updateStatus('${sanitize(appt.id)}','confirmed')" class="act-btn confirm">✓ אשר</button>` : ''}
        ${appt.status !== 'completed' && appt.status !== 'cancelled' ? `<button onclick="updateStatus('${sanitize(appt.id)}','completed')" class="act-btn complete">✔ הושלם</button>` : ''}
        ${appt.status === 'cancelled' ? `<button onclick="updateStatus('${sanitize(appt.id)}','confirmed')" class="act-btn" style="background:#25D366;color:#fff">↩️ החזר תור</button>` : ''}
        ${appt.status !== 'cancelled' ? `<button onclick="updateStatus('${sanitize(appt.id)}','cancelled')" class="act-btn cancel">✕ בטל</button>` : ''}
        ${appt.status !== 'cancelled' ? `<button onclick="sendCancelWA('${sanitize(appt.id)}')" class="act-btn wa" style="background:#ff9800">💬 וואטסאפ ביטול</button>` : ''}
        <button onclick="sendReminderWA('${sanitize(appt.id)}')" class="act-btn wa">💬 וואטסאפ</button>
        <button onclick="deleteAppt('${sanitize(appt.id)}')" class="act-btn del">🗑</button>
      </div>
    </div>
  `;
}

function renderDashboard() {
  _renderDashboard();
  loadFromSheets().then(() => _renderDashboard());
}

function _renderDashboard() {
  const all = getAppointments();
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const week = weekEnd();

  const todayAppts = all.filter(a => a.date === today && a.status !== 'cancelled');
  const weekAppts  = all.filter(a => a.date >= today && a.date <= week && a.status !== 'cancelled');
  const pending    = all.filter(a => a.status === 'pending');

  document.getElementById('statToday').textContent   = todayAppts.length;
  document.getElementById('statWeek').textContent    = weekAppts.length;
  document.getElementById('statTotal').textContent   = all.filter(a => a.status !== 'cancelled').length;
  document.getElementById('statPending').textContent = pending.length;
  const services = getServices();
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStr = monthStart.toISOString().slice(0, 7);
  const monthRevenue = all
    .filter(a => a.date.startsWith(monthStr) && a.status !== 'cancelled')
    .reduce((sum, a) => {
      const svc = services.find(s => s.name === a.serviceName);
      return sum + (svc && svc.price ? Number(svc.price) : 0);
    }, 0);
  const revenueEl = document.getElementById('statRevenue');
  if (revenueEl) revenueEl.textContent = '₪' + monthRevenue;

  const todaySorted    = [...todayAppts].sort((a, b) => a.time.localeCompare(b.time));
  const tomorrowSorted = all.filter(a => a.date === tomorrow && a.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));

  document.getElementById('todayList').innerHTML    = todaySorted.length    ? todaySorted.map(a => apptCard(a)).join('')    : emptyMsg('אין תורים היום');
  document.getElementById('tomorrowList').innerHTML = tomorrowSorted.length ? tomorrowSorted.map(a => apptCard(a)).join('') : emptyMsg('אין תורים מחר');

  // ממתינות לאישור
  const pendingList = document.getElementById('pendingList');
  const pendingSection = document.getElementById('pendingSection');
  if (pendingList) {
    const pendingSorted = [...pending].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    pendingList.innerHTML = pendingSorted.length ? pendingSorted.map(a => apptCard(a, true)).join('') : emptyMsg('אין תורים הממתינים לאישור 🎉');
    if (pendingSection) pendingSection.style.display = pendingSorted.length ? '' : 'none';
  }

  // תזכורות למחר - עם כפתורי WhatsApp
  renderReminders(tomorrowSorted);
  
  // תזכורות תחזוקה - לקוחות שצריכות לחזור
  renderMaintenanceReminders(all);

  // תורים קרובים - 7 ימים הבאים
  const upcomingSorted = all
    .filter(a => a.date > tomorrow && a.date <= week && a.status !== 'cancelled')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const upcomingEl = document.getElementById('upcomingList');
  if (upcomingEl) upcomingEl.innerHTML = upcomingSorted.length ? upcomingSorted.map(a => apptCard(a, true)).join('') : emptyMsg('אין תורים קרובים');

  // כל התורים - תמיד מוצג
  const allDashEl = document.getElementById('allApptsDashList');
  if (allDashEl) {
    const today2 = todayStr();
    const future = [...all].filter(a => a.date >= today2).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const past   = [...all].filter(a => a.date <  today2).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const allSorted = [...future, ...past];
    allDashEl.innerHTML = allSorted.length ? allSorted.map(a => apptCard(a, true)).join('') : emptyMsg('אין תורים עדיין');
  }
}

function renderReminders(tomorrowAppts) {
  const list = document.getElementById('remindersList');
  if (!list) return;
  
  if (tomorrowAppts.length === 0) {
    list.innerHTML = emptyMsg('אין תורים מחר לשליחת תזכורות');
    return;
  }
  
  const settings = getSettings();
  const waPhone = settings.waPhone || '972546827299';
  
  list.innerHTML = tomorrowAppts.map(appt => {
    const message = `שלום ${appt.clientName}! 💅

תזכורת: יש לך תור מחר ב-???? ??? ?????

🎨 ${appt.serviceName}
🕐 ${appt.time}

מחכה לראותך! ❤️

אופק`;
    
    const waLink = `https://wa.me/${toWAPhone(appt.clientPhone)}?text=${encodeURIComponent(message)}`;
    
    return `
      <div class="appt-card status-${sanitize(appt.status)}" style="border-right-color:#25D366">
        <div class="appt-card-main">
          <div class="appt-card-left">
            <div class="appt-time-badge">${sanitize(appt.time)}</div>
          </div>
          <div class="appt-card-body">
            <div class="appt-client-name">${sanitize(appt.clientName)}</div>
            <div class="appt-service-name">${sanitize(appt.serviceIcon || '💅')} ${sanitize(appt.serviceName)}</div>
            <a href="tel:${sanitize(appt.clientPhone)}" class="appt-phone">${sanitize(appt.clientPhone)}</a>
          </div>
        </div>
        <div class="appt-card-actions">
          <a href="${waLink}" target="_blank" class="act-btn wa" style="flex:1;text-align:center;text-decoration:none;background:#25D366;color:#fff;font-weight:700">
            💬 שלח תזכורת ב-WhatsApp
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function renderMaintenanceReminders(allAppts) {
  const list = document.getElementById('maintenanceList');
  if (!list) return;
  
  const today = new Date();
  const threeWeeksAgo = new Date(today);
  threeWeeksAgo.setDate(today.getDate() - 21);
  const threeWeeksAgoStr = threeWeeksAgo.toISOString().slice(0, 10);
  
  // מצא לקוחות שהתור האחרון שלהן היה לפני 3 שבועות
  const clientsMap = {};
  
  allAppts
    .filter(a => a.status === 'completed')
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .forEach(appt => {
      const phone = appt.clientPhone;
      if (!clientsMap[phone]) {
        clientsMap[phone] = appt;
      }
    });
  
  const needMaintenance = Object.values(clientsMap)
    .filter(appt => appt.date <= threeWeeksAgoStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (needMaintenance.length === 0) {
    list.innerHTML = emptyMsg('אין לקוחות שצריכות תזכורת תחזוקה 🌸');
    return;
  }
  
  const settings = getSettings();
  
  list.innerHTML = needMaintenance.map(appt => {
    const daysSince = Math.floor((today - new Date(appt.date)) / (1000 * 60 * 60 * 24));
    const weeksSince = Math.floor(daysSince / 7);
    
    const message = `היי ${appt.clientName}! 💅💖

איך את? עברו ${weeksSince} שבועות מאז היית אצלי... 😊

זה הזמן לרענן את הציפורניים! 💅✨

מתי נקבע תור?

מחכה לראות אותך! ❤️

אופק`;
    
    const waLink = `https://wa.me/${toWAPhone(appt.clientPhone)}?text=${encodeURIComponent(message)}`;
    
    return `
      <div class="appt-card" style="border-right-color:#ff9800">
        <div class="appt-card-main">
          <div class="appt-card-left">
            <div style="text-align:center;color:#ff9800;font-weight:700;font-size:13px">
              <div style="font-size:20px;margin-bottom:4px">📅</div>
              ${weeksSince} שבועות
            </div>
          </div>
          <div class="appt-card-body">
            <div class="appt-client-name">${sanitize(appt.clientName)}</div>
            <div class="appt-service-name">תור אחרון: ${sanitize(formatDate(appt.date))}</div>
            <div class="appt-service-name">${sanitize(appt.serviceIcon || '💅')} ${sanitize(appt.serviceName)}</div>
            <a href="tel:${sanitize(appt.clientPhone)}" class="appt-phone">${sanitize(appt.clientPhone)}</a>
          </div>
        </div>
        <div class="appt-card-actions">
          <a href="${waLink}" target="_blank" class="act-btn" style="flex:1;text-align:center;text-decoration:none;background:#ff9800;color:#fff;font-weight:700">
            📩 שלח תזכורת תחזוקה
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// ── ADMIN CALENDAR ──
let adminCalYear, adminCalMonth, adminSelectedDate;
let calView = 'month';
let weekStart = null;

// חגים ישראליים קבועים (גרגוריאני משוער)
const IL_HOLIDAYS = {
  '01-01': 'ראש השנה האזרחי',
  '04-23': 'יום הזיכרון',
  '04-24': 'יום העצמאות',
  '05-14': 'יום ירושלים',
  '09-22': 'ערב ראש השנה',
  '09-23': 'ראש השנה',
  '09-24': 'ראש השנה',
  '10-01': 'ערב יום כיפור',
  '10-02': 'יום כיפור',
  '10-06': 'ערב סוכות',
  '10-07': 'סוכות',
  '10-13': 'הושענא רבה',
  '10-14': 'שמחת תורה',
  '12-25': 'חנוכה',
  '12-26': 'חנוכה',
};

function getHoliday(dateStr) {
  const md = dateStr.slice(5); // MM-DD
  return IL_HOLIDAYS[md] || null;
}

function setCalView(view) {
  calView = view;
  document.getElementById('calViewMonth').style.background = view === 'month' ? 'var(--dark-pink)' : '';
  document.getElementById('calViewMonth').style.color = view === 'month' ? '#fff' : '';
  document.getElementById('calViewWeek').style.background = view === 'week' ? 'var(--dark-pink)' : '';
  document.getElementById('calViewWeek').style.color = view === 'week' ? '#fff' : '';
  document.getElementById('calMonthView').style.display = view === 'month' ? '' : 'none';
  document.getElementById('calWeekView').style.display = view === 'week' ? '' : 'none';
  if (view === 'week') renderWeekView();
  else renderAdminCalendar();
}

function renderAdminCalendar() {
  if (!adminCalYear) { const now = new Date(); adminCalYear = now.getFullYear(); adminCalMonth = now.getMonth(); }
  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  document.getElementById('adminCalTitle').textContent = `${monthNames[adminCalMonth]} ${adminCalYear}`;

  const firstDay    = new Date(adminCalYear, adminCalMonth, 1).getDay();
  const daysInMonth = new Date(adminCalYear, adminCalMonth + 1, 0).getDate();
  const all         = getAppointments();
  const settings    = getSettings();
  const todayStr2   = todayStr();

  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr   = `${adminCalYear}-${String(adminCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayAppts  = all.filter(a => a.date === dateStr && a.status !== 'cancelled');
    const count     = dayAppts.length;
    const isBlocked = settings.blockedDates.includes(dateStr);
    const isWork    = isWorkDay(dateStr);
    const isSelected = adminSelectedDate === dateStr;
    const isToday   = dateStr === todayStr2;
    const dow       = new Date(dateStr).getDay();
    const isWeekend = dow === 5 || dow === 6;
    const holiday   = getHoliday(dateStr);
    let cls = 'cal-cell admin-cal-cell';
    if (isBlocked) cls += ' blocked';
    else if (!isWork) cls += ' disabled';
    if (isSelected) cls += ' selected';
    if (isToday) cls += ' cal-today';
    if (isWeekend && !isBlocked) cls += ' cal-weekend';
    let dots = '';
    if (count > 0) {
      const hasPending   = dayAppts.some(a => a.status === 'pending');
      const hasConfirmed = dayAppts.some(a => a.status === 'confirmed');
      const hasCompleted = dayAppts.some(a => a.status === 'completed');
      if (hasPending)   dots += `<span class="cal-dot" style="background:#f0a500">${dayAppts.filter(a=>a.status==='pending').length}</span>`;
      if (hasConfirmed) dots += `<span class="cal-dot" style="background:#25D366">${dayAppts.filter(a=>a.status==='confirmed').length}</span>`;
      if (hasCompleted) dots += `<span class="cal-dot" style="background:#aaa">${dayAppts.filter(a=>a.status==='completed').length}</span>`;
    }
    const holidayHtml = holiday ? `<div style="font-size:9px;color:#b76e79;line-height:1;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${holiday}</div>` : '';
    html += `<div class="${cls}" onclick="adminSelectDay('${dateStr}')" style="flex-direction:column;gap:1px" draggable="false">
      <span style="font-weight:${isToday?'700':'400'}">${d}</span>
      ${holidayHtml}
      <div style="display:flex;gap:2px;justify-content:center">${dots}</div>
    </div>`;
  }
  document.getElementById('adminCalGrid').innerHTML = html;

  document.getElementById('adminPrevMonth').onclick = () => { adminCalMonth--; if (adminCalMonth < 0) { adminCalMonth = 11; adminCalYear--; } renderAdminCalendar(); };
  document.getElementById('adminNextMonth').onclick = () => { adminCalMonth++; if (adminCalMonth > 11) { adminCalMonth = 0; adminCalYear++; } renderAdminCalendar(); };
}

function renderWeekView() {
  if (!weekStart) {
    const now = new Date();
    now.setDate(now.getDate() - now.getDay());
    weekStart = now;
  }
  const all = getAppointments();
  const settings = getSettings();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  const dayNames = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  const firstDay = days[0];
  const lastDay  = days[6];
  document.getElementById('weekTitle').textContent =
    `${firstDay.getDate()}/${firstDay.getMonth()+1} - ${lastDay.getDate()}/${lastDay.getMonth()+1}/${lastDay.getFullYear()}`;

  const todayStr2 = todayStr();
  let html = '';
  days.forEach(d => {
    const dateStr = d.toISOString().slice(0,10);
    const dayAppts = all.filter(a => a.date === dateStr && a.status !== 'cancelled').sort((a,b) => a.time.localeCompare(b.time));
    const isBlocked = settings.blockedDates.includes(dateStr);
    const isToday = dateStr === todayStr2;
    const holiday = getHoliday(dateStr);
    const dow = d.getDay();
    const isWeekend = dow === 5 || dow === 6;
    const bgColor = isToday ? '#fdf0f5' : isWeekend ? '#f9f5f7' : '#fff';
    const borderColor = isToday ? 'var(--dark-pink)' : isBlocked ? '#e05' : '#f0e0e8';
    html += `<div style="background:${bgColor};border:2px solid ${borderColor};border-radius:12px;padding:10px;min-height:120px;cursor:pointer" onclick="adminSelectDay('${dateStr}')">
      <div style="font-weight:700;font-size:13px;color:${isToday?'var(--dark-pink)':'var(--dark)'};margin-bottom:4px">${dayNames[dow]} ${d.getDate()}/${d.getMonth()+1}</div>
      ${holiday ? `<div style="font-size:10px;color:#b76e79;margin-bottom:4px">${holiday}</div>` : ''}
      ${isBlocked ? '<div style="font-size:11px;color:#e05">🚫 חסום</div>' : ''}
      ${dayAppts.length === 0 && !isBlocked ? '<div style="font-size:11px;color:#ccc;margin-top:8px">פנוי</div>' : ''}
      ${dayAppts.map(a => `
        <div draggable="true" ondragstart="dragStart(event,'${a.id}')" style="background:${a.status==='pending'?'#fff8e6':a.status==='confirmed'?'#e8f8ef':'#f5f5f5'};border-radius:8px;padding:5px 8px;margin-bottom:4px;font-size:11px;cursor:grab;border-right:3px solid ${STATUS_COLORS[a.status]}">
          <strong>${a.time}</strong> ${sanitize(a.clientName)}
          <div style="color:#888;font-size:10px">${sanitize(a.serviceName)}</div>
        </div>
      `).join('')}
    </div>`;
  });
  const grid = document.getElementById('weekGrid');
  grid.innerHTML = html;

  // drop targets
  grid.querySelectorAll('[onclick]').forEach(cell => {
    cell.addEventListener('dragover', e => { e.preventDefault(); cell.style.outline = '2px dashed var(--dark-pink)'; });
    cell.addEventListener('dragleave', () => { cell.style.outline = ''; });
    cell.addEventListener('drop', e => {
      e.preventDefault();
      cell.style.outline = '';
      const id = e.dataTransfer.getData('apptId');
      const dateStr = cell.getAttribute('onclick').match(/'([^']+)'/)[1];
      if (id && dateStr) moveApptToDate(id, dateStr);
    });
  });

  document.getElementById('weekPrev').onclick = () => { weekStart.setDate(weekStart.getDate() - 7); renderWeekView(); };
  document.getElementById('weekNext').onclick = () => { weekStart.setDate(weekStart.getDate() + 7); renderWeekView(); };
}

function adminSelectDay(dateStr) {
  adminSelectedDate = dateStr;
  if (calView === 'month') renderAdminCalendar();
  else renderWeekView();
  const appts = getAppointments().filter(a => a.date === dateStr && a.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));
  const holiday = getHoliday(dateStr);
  document.getElementById('adminDayTitle').textContent = formatDate(dateStr) + (holiday ? ` • ${holiday}` : '');

  // שעות פנויות
  const freeEl = document.getElementById('freeSlotsSummary');
  const settings = getSettings();
  const dow = new Date(dateStr).getDay();
  const workDay = settings.workDays[dow];
  if (freeEl && workDay && workDay.active && !settings.blockedDates.includes(dateStr)) {
    const freeSlots = getFreeSlots(dateStr, appts, settings);
    freeEl.innerHTML = freeSlots.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 0">${freeSlots.map(s => `<span style="background:#e8f8ef;color:#1a6e3a;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600">${s}</span>`).join('')}</div>`
      : `<div style="font-size:12px;color:#e05;padding:6px 0">🔴 יום מלא</div>`;
  } else if (freeEl) {
    freeEl.innerHTML = '';
  }

  // drag & drop על תורים
  document.getElementById('adminDayAppts').innerHTML = appts.length ? appts.map(a => apptCardDraggable(a)).join('') : emptyMsg('אין תורים ביום זה');

  const isBlocked = getSettings().blockedDates.includes(dateStr);
  const blockBtn = document.getElementById('blockDayBtn');
  blockBtn.textContent = isBlocked ? '✅ בטל חסימה' : '🚫 חסום יום זה';
  blockBtn.onclick = () => toggleBlockDay(dateStr);
}

function getFreeSlots(dateStr, appts, settings) {
  const dow = new Date(dateStr).getDay();
  const customHour = (settings.customHours || []).find(c => c.date === dateStr);
  const workDay = customHour || settings.workDays[dow];
  if (!workDay || !workDay.active) return [];
  const [sh, sm] = workDay.start.split(':').map(Number);
  const [eh, em] = workDay.end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  const busy = appts.map(a => {
    const [ah, am] = a.time.split(':').map(Number);
    const s = ah * 60 + am;
    return { s, e: s + (Number(a.duration) || 60) };
  });
  const slots = [];
  for (let m = startMin; m + 30 <= endMin; m += 30) {
    const slotEnd = m + 30;
    const free = !busy.some(b => m < b.e && slotEnd > b.s);
    if (free) slots.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);
  }
  return slots;
}

function apptCardDraggable(appt) {
  const card = apptCard(appt);
  return card.replace('<div class="appt-card', `<div draggable="true" ondragstart="dragStart(event,'${sanitize(appt.id)}')" class="appt-card`);
}

function dragStart(event, id) {
  event.dataTransfer.setData('apptId', id);
}

function moveApptToDate(id, newDate) {
  const appts = getAppointments();
  const appt = appts.find(a => a.id === id);
  if (!appt || appt.date === newDate) return;
  const oldDate = appt.date;
  appt.date = newDate;
  saveAppointments(appts);
  updateDateInSheets(id, newDate, appt.time);
  showToast(`✅ תור הועבר ל-${formatDate(newDate)}`);
  if (calView === 'week') renderWeekView();
  else { renderAdminCalendar(); if (adminSelectedDate) adminSelectDay(adminSelectedDate); }
}

function updateDateInSheets(id, newDate, newTime) {
  const cb = 'ud' + Date.now();
  const url = WEBAPP_URL + '?action=updateDate&callback=' + cb
    + '&id=' + encodeURIComponent(id)
    + '&date=' + encodeURIComponent(newDate)
    + '&time=' + encodeURIComponent(newTime);
  window[cb] = () => { delete window[cb]; document.getElementById(cb)?.remove(); };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}

function openAddApptModal(dateStr) {
  const modal = document.getElementById('addApptModal');
  modal.style.display = 'flex';
  document.getElementById('addApptDate').value = dateStr || todayStr();
  document.getElementById('addApptTime').value = '';
  document.getElementById('addApptName').value = '';
  document.getElementById('addApptPhone').value = '';
  document.getElementById('addApptNotes').value = '';
  const services = getServices();
  const svcSelect = document.getElementById('addApptService');
  svcSelect.innerHTML = services.map(s => `<option value="${s.id}">${s.icon} ${sanitize(s.name)} (${s.duration}דק')</option>`).join('');
  // טען שעות פנויות בכל שינוי תאריך או שירות
  svcSelect.onchange = () => _loadAdminSlots();
  document.getElementById('addApptDate').onchange = () => _loadAdminSlots();
  _loadAdminSlots();
}

function _loadAdminSlots() {
  const dateStr = document.getElementById('addApptDate').value;
  const svcId   = document.getElementById('addApptService').value;
  const timeInput = document.getElementById('addApptTime');
  const slotsWrap = document.getElementById('addApptSlotsWrap');
  if (!dateStr || !svcId) return;

  const svc = getServices().find(s => s.id === svcId);
  if (!svc) return;

  slotsWrap.innerHTML = '<p style="font-size:12px;color:#aaa;margin:6px 0">טוען שעות פנויות...</p>';

  // טען תורים עדכניים מ-Sheets ואז חשב slots
  loadFromSheets().finally(() => {
    const slots = getAvailableSlots(dateStr, svc.duration);
    if (slots.length === 0) {
      slotsWrap.innerHTML = '<p style="font-size:12px;color:#e05;margin:6px 0">🔴 אין שעות פנויות ביום זה</p>';
      return;
    }
    slotsWrap.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">' +
      slots.map(t =>
        `<button type="button" onclick="_pickAdminSlot('${t}', this)" style="padding:6px 12px;border:1.5px solid #e0c8d0;border-radius:20px;background:#fff;cursor:pointer;font-size:13px;font-family:inherit">${t}</button>`
      ).join('') + '</div>';
  });
}

function _pickAdminSlot(time, el) {
  document.getElementById('addApptTime').value = time;
  document.querySelectorAll('#addApptSlotsWrap button').forEach(b => {
    b.style.background = '#fff';
    b.style.color = '#333';
    b.style.borderColor = '#e0c8d0';
  });
  el.style.background = 'var(--dark-pink)';
  el.style.color = '#fff';
  el.style.borderColor = 'var(--dark-pink)';
}

function closeAddApptModal() {
  document.getElementById('addApptModal').style.display = 'none';
}

function submitAddAppt() {
  const date  = document.getElementById('addApptDate').value;
  const time  = document.getElementById('addApptTime').value;
  const name  = document.getElementById('addApptName').value.trim();
  const phone = document.getElementById('addApptPhone').value.trim();
  const notes = document.getElementById('addApptNotes').value.trim();
  const svcId = document.getElementById('addApptService').value;
  if (!date || !time || !name || !phone) { showToast('אנא מלאי את כל השדות', '#e05'); return; }
  const services = getServices();
  const svc = services.find(s => s.id === svcId) || services[0];
  if (!svc) { showToast('אנא הגדירי שירות', '#e05'); return; }
  const id = generateId();
  const appt = { id, serviceName: svc.name, serviceIcon: svc.icon, duration: svc.duration, date, time, clientName: name, clientPhone: phone, notes, status: 'confirmed' };
  const appts = getAppointments();
  appts.push(appt);
  saveAppointments(appts);
  saveToSheets(appt);
  closeAddApptModal();
  adminSelectedDate = date;
  if (calView === 'week') renderWeekView();
  else { renderAdminCalendar(); adminSelectDay(date); }
  _showApptConfirmPopup(appt);
}

function _showApptConfirmPopup(appt) {
  // הסר פופאפ קודם אם קיים
  document.getElementById('apptConfirmPopup')?.remove();

  const msg = `היי ${appt.clientName}! 💅✨
קבעתי לך תור:

✨ ${appt.serviceName}
📅 ${formatDate(appt.date)}
🕐 ${appt.time}

מחכה לך! 🌸`;
  const waLink = `https://wa.me/${toWAPhone(appt.clientPhone)}?text=${encodeURIComponent(msg)}`;

  const popup = document.createElement('div');
  popup.id = 'apptConfirmPopup';
  popup.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
  popup.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center">
      <div style="font-size:40px;margin-bottom:12px">✅</div>
      <h3 style="font-family:'DM Serif Display',serif;color:var(--dark);margin-bottom:6px;font-size:20px">תור נקבע בהצלחה!</h3>
      <div style="background:#fdf0f5;border-radius:12px;padding:14px;margin:16px 0;text-align:right">
        <div style="font-size:14px;color:var(--dark);line-height:1.8">
          <div>👤 <strong>${sanitize(appt.clientName)}</strong></div>
          <div>📱 ${sanitize(appt.clientPhone)}</div>
          <div>💅 ${sanitize(appt.serviceName)}</div>
          <div>📅 ${sanitize(formatDate(appt.date))}</div>
          <div>🕐 ${sanitize(appt.time)}</div>
          ${appt.notes ? `<div>📝 ${sanitize(appt.notes)}</div>` : ''}
        </div>
      </div>
      <a href="${waLink}" target="_blank"
        style="display:block;width:100%;padding:14px;background:#25D366;color:#fff;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:10px;box-sizing:border-box">
        💬 שלח אישור ב-WhatsApp
      </a>
      <button onclick="document.getElementById('apptConfirmPopup').remove()"
        style="width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:12px;background:none;cursor:pointer;font-family:Heebo,sans-serif;font-size:14px;color:#888">
        סגור
      </button>
    </div>
  `;
  document.body.appendChild(popup);
}

function toggleBlockDay(dateStr) {
  const settings = getSettings();
  const idx = settings.blockedDates.indexOf(dateStr);
  if (idx >= 0) settings.blockedDates.splice(idx, 1);
  else settings.blockedDates.push(dateStr);
  saveSettings(settings);
  renderAdminCalendar();
  adminSelectDay(dateStr);
}

// ── ALL APPOINTMENTS ──
function renderAllAppointments() {
  const statusFilter = document.getElementById('filterStatus').value;
  const dateFilter   = document.getElementById('filterDate').value;
  let all = getAppointments();
  if (statusFilter !== 'all') all = all.filter(a => a.status === statusFilter);
  if (dateFilter) all = all.filter(a => a.date === dateFilter);
  const today = todayStr();
  const future = all.filter(a => a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past   = all.filter(a => a.date <  today).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const sorted = [...future, ...past];
  document.getElementById('allApptList').innerHTML = sorted.length ? sorted.map(a => apptCard(a, true)).join('') : emptyMsg('אין תורים');
  
  // הסרתי את renderWaitlist() כי זה לא קיים
}

function clearFilters() {
  document.getElementById('filterStatus').value = 'all';
  document.getElementById('filterDate').value = '';
  renderAllAppointments();
}

// ── APPOINTMENT ACTIONS ──
function updateStatus(id, status) {
  const appts = getAppointments();
  const appt = appts.find(a => a.id === id);
  if (!appt) return;
  appt.status = status;
  saveAppointments(appts);
  updateStatusInSheets(id, status);
  refreshCurrentPanel();
}

function sendConfirmationWA(appt) {
  const msg = `היי ${appt.clientName}! 💅✨\nהתור שלך אושר!\n\n📅 ${formatDate(appt.date)}\n🕐 ${appt.time}\n💅 ${appt.serviceName}\n\nמחכה לך! 🌸`;
  let phone = appt.clientPhone;
  window.open(`https://wa.me/${toWAPhone(phone)}?text=${encodeURIComponent(msg)}`, '_blank');
}

function deleteAppt(id) {
  showConfirmDialog('למחוק תור זה לצמיתות?', () => {
    saveAppointments(getAppointments().filter(a => a.id !== id));
    deleteFromSheets(id);
    refreshCurrentPanel();
  });
}

function deleteFromSheets(id) {
  const cb = 'dc' + Date.now();
  const url = WEBAPP_URL + '?action=deleteRow&callback=' + cb + '&id=' + encodeURIComponent(id);
  window[cb] = () => { delete window[cb]; document.getElementById(cb)?.remove(); };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}

function sendCancelWA(id) {
  const appt = getAppointments().find(a => a.id === id);
  if (!appt) return;
  const msg = `היי ${appt.clientName}! 💅

לצערי, התור שלך בוטל:
✨ ${appt.serviceName}
📅 ${formatDate(appt.date)}
🕐 ${appt.time}

אשמח לקבוע לך מועד חדש! מתי יוצא לך? ❤️

אופק`;
  window.open(`https://wa.me/${toWAPhone(appt.clientPhone)}?text=${encodeURIComponent(msg)}`, '_blank');
}

function sendReminderWA(id) {
  const appt = getAppointments().find(a => a.id === id);
  if (!appt) return;
  const msg = `היי ${appt.clientName}! 💅\nתזכורת לתור שלך:\n✨ ${appt.serviceName}\n📅 ${formatDate(appt.date)}\n🕐 ${appt.time}\nמחכה לך! 🌸`;
  window.open(`https://wa.me/${toWAPhone(appt.clientPhone)}?text=${encodeURIComponent(msg)}`, '_blank');
}

function updateStatusInSheets(id, status) {
  const cb = 'uc' + Date.now();
  const url = WEBAPP_URL
    + '?action=updateStatus'
    + '&callback=' + cb
    + '&id=' + encodeURIComponent(id)
    + '&status=' + encodeURIComponent(status);
  window[cb] = () => { delete window[cb]; document.getElementById(cb)?.remove(); };
  const s = document.createElement('script');
  s.id = cb;
  s.src = url;
  document.body.appendChild(s);
}

function syncSheets() {
  showMiniLoader();
  loadFromSheets().then(() => {
    hideMiniLoader();
    _renderDashboard();
    showToast('✅ סונכרן בהצלחה!');
  }).catch(() => {
    hideMiniLoader();
    showToast('❌ שגיאה בסנכרון', '#e05');
  });
}

function refreshCurrentPanel() {
  const active = document.querySelector('.snav-btn.active, .bnav-btn.active')?.dataset.panel;
  if (active === 'dashboard') _renderDashboard();
  if (active === 'calendar') {
    if (calView === 'week') renderWeekView();
    else { renderAdminCalendar(); if (adminSelectedDate) adminSelectDay(adminSelectedDate); }
  }
  if (active === 'appointments') renderAllAppointments();
  if (active === 'stats') renderStatistics();
  if (active === 'reviews') renderReviews();
}
const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function renderSettings() {
  const settings = getSettings();
  document.getElementById('waPhoneInput').value = settings.waPhone;
  document.getElementById('breakTimeInput').value = settings.breakTime !== undefined ? settings.breakTime : 10;
  const lb = settings.lunchBreak || {};
  document.getElementById('lunchBreakStart').value = lb.start || '';
  document.getElementById('lunchBreakEnd').value   = lb.end   || '';

  // הפסקת צהריים
  if (settings.lunchBreak) {
    document.getElementById('lunchBreakStart').value = settings.lunchBreak.start || '';
    document.getElementById('lunchBreakEnd').value   = settings.lunchBreak.end   || '';
  }
  const container = document.getElementById('workDaysEditor');
  container.innerHTML = Object.entries(settings.workDays).map(([dow, day]) => `
    <div class="work-day-row">
      <label class="toggle-wrap">
        <input type="checkbox" class="wd-active" data-dow="${dow}" ${day.active ? 'checked' : ''}/>
        <span class="toggle-slider"></span>
      </label>
      <span class="wd-name">${DAY_NAMES[dow]}</span>
      <input type="time" class="wd-start" data-dow="${dow}" value="${day.start}" ${!day.active ? 'disabled' : ''}/>
      <span>עד</span>
      <input type="time" class="wd-end" data-dow="${dow}" value="${day.end}" ${!day.active ? 'disabled' : ''}/>
    </div>
  `).join('');

  container.querySelectorAll('.wd-active').forEach(cb => {
    cb.addEventListener('change', () => {
      const row = cb.closest('.work-day-row');
      row.querySelector('.wd-start').disabled = !cb.checked;
      row.querySelector('.wd-end').disabled   = !cb.checked;
    });
  });

  renderBlockedDates();
  renderCustomHours();
  renderVacations();

  document.getElementById('addBlockDate').onclick = () => {
    const val = document.getElementById('blockDateInput').value;
    if (!val) return;
    const s = getSettings();
    if (!s.blockedDates.includes(val)) { s.blockedDates.push(val); saveSettings(s); }
    document.getElementById('blockDateInput').value = '';
    renderBlockedDates();
  };

  document.getElementById('addCustomHour').onclick = () => {
    const date = document.getElementById('customHourDate').value;
    const start = document.getElementById('customHourStart').value;
    const end = document.getElementById('customHourEnd').value;
    
    if (!date || !start || !end) {
      showToast('אנא מלאי את כל השדות', '#e05');
      return;
    }
    if (start >= end) {
      showToast('שעת הסיום חייבת להיות אחרי שעת ההתחלה', '#e05');
      return;
    }
    
    const s = getSettings();
    if (!s.customHours) s.customHours = [];
    s.customHours.push({ date, start, end });
    saveSettings(s);
    document.getElementById('customHourDate').value = '';
    document.getElementById('customHourStart').value = '19:00';
    document.getElementById('customHourEnd').value = '22:00';
    renderCustomHours();
    showToast(`✅ שעות מיוחדות נשמרו! ${start}–${end}`);
  };
}

function populateServiceDropdown() {
  const services = getServices();
  const select = document.getElementById('customHourService');
  if (!select) return;
  
  select.innerHTML = '<option value="">בחרי שירות...</option>' + 
    services.map(s => `<option value="${s.id}">${s.icon} ${sanitize(s.name)} (${s.duration} דק')</option>`).join('');
}

function renderBlockedDates() {
  const settings = getSettings();
  const list = document.getElementById('blockedDatesList');
  list.innerHTML = settings.blockedDates.length
    ? settings.blockedDates.sort().map(d => `
        <div class="blocked-tag">
          ${formatDate(d)}
          <button onclick="removeBlockDate('${d}')">✕</button>
        </div>`).join('')
    : '<p style="color:#aaa;font-size:13px">אין תאריכים חסומים</p>';
}

function renderCustomHours() {
  const settings = getSettings();
  const list = document.getElementById('customHoursList');
  const items = (settings.customHours || []).sort((a, b) => a.date.localeCompare(b.date));
  list.innerHTML = items.length
    ? items.map((c, idx) => `
        <div class="blocked-tag" style="background:#e8f8ef;border-color:#25D366;color:#1a6e3a">
          <span>
            ${formatDate(c.date)} &nbsp;
            <strong style="color:#25D366">${c.start}–${c.end}</strong>
          </span>
          <button onclick="removeCustomHour(${idx})" style="color:#1a6e3a">✕</button>
        </div>`).join('')
    : '<p style="color:#aaa;font-size:13px">אין שעות מיוחדות</p>';
}

function removeCustomHour(idx) {
  const s = getSettings();
  if (!s.customHours || !s.customHours[idx]) return;
  s.customHours.splice(idx, 1);
  saveSettings(s);
  renderCustomHours();
}

function renderVacations() {
  const settings = getSettings();
  const list = document.getElementById('vacationsList');
  const vacations = settings.vacations || [];

  // הגדר את כפתור addVacation פעם אחת בלבד
  const addBtn = document.getElementById('addVacation');
  if (addBtn && !addBtn._bound) {
    addBtn._bound = true;
    addBtn.addEventListener('click', () => {
      const start = document.getElementById('vacationStart').value;
      const end = document.getElementById('vacationEnd').value;
      if (!start || !end) { showToast('אנא בחרי תאריך התחלה וסיום', '#e05'); return; }
      if (start > end) { showToast('תאריך הסיום חייב להיות אחרי תאריך ההתחלה', '#e05'); return; }
      const s = getSettings();
      if (!s.vacations) s.vacations = [];
      const dates = [];
      const current = new Date(start);
      const endDate = new Date(end);
      while (current <= endDate) {
        const dateStr = current.toISOString().slice(0, 10);
        if (!s.blockedDates.includes(dateStr)) s.blockedDates.push(dateStr);
        dates.push(dateStr);
        current.setDate(current.getDate() + 1);
      }
      s.vacations.push({ start, end, dates });
      saveSettings(s);
      document.getElementById('vacationStart').value = '';
      document.getElementById('vacationEnd').value = '';
      renderVacations();
      renderBlockedDates();
      showToast(`✅ חופשה נקבעה! ${dates.length} ימים נחסמו`);
    });
  }

  if (vacations.length === 0) {
    list.innerHTML = '<p style="color:#aaa;font-size:13px">אין חופשות מתוכננות</p>';
    return;
  }

  list.innerHTML = vacations.sort((a, b) => a.start.localeCompare(b.start)).map((v, idx) => `
    <div class="blocked-tag" style="background:#fff3cd;border-color:#ffc107;color:#856404;padding:10px 16px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div>
          <div style="font-weight:700;margin-bottom:4px">🏖️ ${formatDate(v.start)} - ${formatDate(v.end)}</div>
          <div style="font-size:12px;opacity:0.8">${getDaysBetween(v.start, v.end)} ימים</div>
        </div>
        <button onclick="removeVacation(${idx})" style="color:#856404;background:none;border:none;cursor:pointer;font-size:18px;padding:4px 8px">✕</button>
      </div>
    </div>
  `).join('');
}

function removeVacation(idx) {
  const s = getSettings();
  const vacation = s.vacations[idx];
  
  // הסר את התאריכים החסומים
  vacation.dates.forEach(date => {
    const idx = s.blockedDates.indexOf(date);
    if (idx >= 0) s.blockedDates.splice(idx, 1);
  });
  
  s.vacations.splice(idx, 1);
  saveSettings(s);
  renderVacations();
  renderBlockedDates();
  showToast('✅ חופשה בוטלה');
}

function getDaysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate - startDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

function renderWaitlist() {
  const section = document.getElementById('waitlistSection');
  if (!section) return;
  
  loadWaitlistFromSheets().then(waitlist => {
    if (!waitlist || waitlist.length === 0) {
      section.innerHTML = '<p style="color:#aaa;font-size:13px">אין לקוחות ברשימת המתנה</p>';
      return;
    }
    
    const grouped = {};
    waitlist.forEach(w => {
      // תיקון: המרת תאריך לפורמט נכון
      let dateStr = w.date;
      if (dateStr instanceof Date || (typeof dateStr === 'string' && dateStr.includes('T'))) {
        const d = new Date(dateStr);
        dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(w);
    });
    
    section.innerHTML = Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => `
        <div style="margin-bottom:16px;padding:12px;background:#fef9e7;border-radius:12px;border:1.5px solid #f0a500">
          <div style="font-weight:700;color:#856404;margin-bottom:8px;font-size:14px">
            📅 ${formatDate(date)} - ${items.length} בהמתנה
          </div>
          ${items.map(w => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:#fff;border-radius:8px;margin-bottom:6px">
              <div>
                <strong style="color:var(--dark)">${sanitize(w.name)}</strong>
                <span style="color:#888;font-size:13px;margin-right:8px">${sanitize(w.phone)}</span>
                <div style="font-size:12px;color:#888;margin-top:2px">💅 ${sanitize(w.service)}</div>
              </div>
              <div style="display:flex;gap:6px">
                <button onclick="notifyWaitlist('${w.id}', '${date}')" class="act-btn" style="background:#25D366;color:#fff;font-size:12px;padding:6px 12px">
                  📩 הודע
                </button>
                <button onclick="removeFromWaitlist('${w.id}')" class="act-btn del" style="font-size:12px;padding:6px 10px">
                  ✕
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');
  });
}

function loadWaitlistFromSheets() {
  return new Promise((resolve) => {
    const cb = 'wl' + Date.now();
    const url = WEBAPP_URL + '?action=loadWaitlist&callback=' + cb;
    window[cb] = (data) => {
      delete window[cb]; document.getElementById(cb)?.remove();
      resolve(Array.isArray(data) ? data : []);
    };
    const s = document.createElement('script');
    s.id = cb; s.src = url;
    s.onerror = () => resolve([]);
    document.body.appendChild(s);
    setTimeout(() => { delete window[cb]; resolve([]); }, 8000);
  });
}

function notifyWaitlist(waitlistId, date) {
  loadWaitlistFromSheets().then(waitlist => {
    const item = waitlist.find(w => w.id === waitlistId);
    if (!item) return;
    
    const message = `היי ${item.name}! 💅✨

יש חדשות טובות! 🎉

התפנה מקום ביום ${formatDate(date)}

רוצה לקבוע תור? 💅

מחכה לשמוע ממך! ❤️

אופק`;
    
    let phone = item.phone;
    window.open(`https://wa.me/${toWAPhone(phone)}?text=${encodeURIComponent(message)}`, '_blank');
  });
}

function removeFromWaitlist(waitlistId) {
  showConfirmDialog('להסיר מרשימת המתנה?', () => {
    const cb = 'rw' + Date.now();
    const url = WEBAPP_URL + '?action=removeWaitlist&callback=' + cb + '&id=' + encodeURIComponent(waitlistId);
    window[cb] = () => {
      delete window[cb]; document.getElementById(cb)?.remove();
      renderWaitlist();
      showToast('✅ הוסר מרשימת המתנה');
    };
    const s = document.createElement('script');
    s.id = cb; s.src = url;
    document.body.appendChild(s);
  });
}

function addNewClient() {
  const name = prompt('שם מלא:');
  if (!name || !name.trim()) return;
  
  const phone = prompt('מספר טלפון (05X-XXXXXXX):');
  if (!phone || !phone.trim()) return;
  
  if (!/^[0-9+\-\s]{9,15}$/.test(phone)) {
    showToast('מספר טלפון לא תקין', '#e05');
    return;
  }
  
  saveClientToSheets(name.trim(), phone.trim());
  showToast('✅ לקוח נוסף בהצלחה!');
  setTimeout(() => renderClientsList(), 1000);
}

function removeDuplicates() {
  showConfirmDialog('למחוק לקוחות כפולים? (יישמר רק הרשומה הראשונה)', () => {
    const cb = 'rd' + Date.now();
    const url = WEBAPP_URL + '?action=removeDuplicateClients&callback=' + cb;
    window[cb] = (response) => {
      delete window[cb]; document.getElementById(cb)?.remove();
      if (response && response.success) {
        DB.set('clients_cache', null);
        showToast(`✅ נמחקו ${response.removed} כפילויות`);
        renderClientsList();
      } else {
        showToast('❌ שגיאה במחיקת כפילויות', '#e05');
      }
    };
    const s = document.createElement('script');
    s.id = cb; s.src = url;
    s.onerror = () => {
      delete window[cb];
      showToast('❌ שגיאה במחיקת כפילויות', '#e05');
    };
    document.body.appendChild(s);
  });
}

function editClient(oldPhone, oldName) {
  const newName = prompt('ערוך שם:', oldName);
  if (!newName || !newName.trim()) return;
  
  const newPhone = prompt('ערוך טלפון:', oldPhone);
  if (!newPhone || !newPhone.trim()) return;
  
  if (!/^[0-9+\-\s]{9,15}$/.test(newPhone)) {
    showToast('מספר טלפון לא תקין', '#e05');
    return;
  }
  
  const cb = 'ec' + Date.now();
  const url = WEBAPP_URL + '?action=updateClient&callback=' + cb
    + '&oldPhone=' + encodeURIComponent(oldPhone)
    + '&newName=' + encodeURIComponent(newName.trim())
    + '&newPhone=' + encodeURIComponent(newPhone.trim());
  window[cb] = () => {
    delete window[cb]; document.getElementById(cb)?.remove();
    DB.set('clients_cache', null);
    showToast('✅ לקוח עודכן!');
    renderClientsList();
  };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}

function deleteClient(phone) {
  showConfirmDialog('למחוק לקוח זה? ⚠️ כל התורים שלו יימחקו גם!', () => {
    const cb = 'dc' + Date.now();
    const url = WEBAPP_URL + '?action=deleteClient&callback=' + cb + '&phone=' + encodeURIComponent(phone);
    window[cb] = (response) => {
      delete window[cb]; document.getElementById(cb)?.remove();
      if (response && response.error) {
        showToast('⚠️ לא ניתן למחוק - יש ללקוח תורים פעילים. מחקי את התורים קודם', '#e05');
      } else {
        DB.set('clients_cache', null);
        showToast('✅ לקוח וכל התורים שלו נמחקו');
        renderClientsList();
      }
    };
    const s = document.createElement('script');
    s.id = cb; s.src = url;
    s.onerror = () => {
      delete window[cb];
      showToast('❌ שגיאה במחיקת הלקוח', '#e05');
    };
    document.body.appendChild(s);
  });
}

function renderStatistics() {
  const all = getAppointments();
  const services = getServices();
  const completed = all.filter(a => a.status === 'completed');
  
  // סטטיסטיקות כלליות
  const totalAppts = all.filter(a => a.status !== 'cancelled').length;
  const totalCompleted = completed.length;
  const totalCancelled = all.filter(a => a.status === 'cancelled').length;
  const cancelRate = totalAppts > 0 ? ((totalCancelled / totalAppts) * 100).toFixed(1) : 0;
  
  document.getElementById('generalStats').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:12px">
      <div style="background:#fdf0f5;padding:16px;border-radius:12px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:var(--dark-pink);font-family:'Playfair Display',serif">${totalAppts}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">סה"כ תורים</div>
      </div>
      <div style="background:#e8f8ef;padding:16px;border-radius:12px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#25D366;font-family:'Playfair Display',serif">${totalCompleted}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">הושלמו</div>
      </div>
      <div style="background:#fff0f0;padding:16px;border-radius:12px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#e05;font-family:'Playfair Display',serif">${cancelRate}%</div>
        <div style="font-size:13px;color:#888;margin-top:4px">אחוז ביטולים</div>
      </div>
    </div>
  `;
  
  // לקוחות VIP
  const clientsMap = {};
  completed.forEach(a => {
    const norm = (p) => p.replace(/\D/g, '');
    const key = norm(a.clientPhone);
    if (!clientsMap[key]) clientsMap[key] = { name: a.clientName, phone: a.clientPhone, count: 0 };
    clientsMap[key].count++;
  });
  
  const vipList = Object.values(clientsMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  document.getElementById('vipClients').innerHTML = vipList.length ? vipList.map((c, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#fdf8fa;border-radius:10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:32px;height:32px;background:linear-gradient(135deg,var(--pink),var(--dark-pink));border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">${i + 1}</div>
        <div>
          <strong style="color:var(--dark)">${sanitize(c.name)}</strong>
          <div style="font-size:12px;color:#888">${sanitize(c.phone)}</div>
        </div>
      </div>
      <div style="background:var(--dark-pink);color:#fff;padding:6px 14px;border-radius:20px;font-weight:700;font-size:13px">
        ${c.count} תורים
      </div>
    </div>
  `).join('') : '<p style="color:#aaa;font-size:13px">אין נתונים עדיין</p>';
  
  // שירותים פופולריים
  const servicesCount = {};
  completed.forEach(a => {
    if (!servicesCount[a.serviceName]) servicesCount[a.serviceName] = 0;
    servicesCount[a.serviceName]++;
  });
  
  const popularList = Object.entries(servicesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const maxCount = popularList[0]?.[1] || 1;
  
  document.getElementById('popularServices').innerHTML = popularList.length ? popularList.map(([name, count]) => {
    const percent = (count / maxCount) * 100;
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <strong style="font-size:14px;color:var(--dark)">💅 ${sanitize(name)}</strong>
          <span style="font-weight:700;color:var(--dark-pink)">${count}</span>
        </div>
        <div style="background:#f0e0e8;height:8px;border-radius:10px;overflow:hidden">
          <div style="background:linear-gradient(90deg,var(--pink),var(--dark-pink));height:100%;width:${percent}%;transition:width 0.5s"></div>
        </div>
      </div>
    `;
  }).join('') : '<p style="color:#aaa;font-size:13px">אין נתונים עדיין</p>';
  
  // שעות עומס
  const hoursCount = {};
  completed.forEach(a => {
    const hour = a.time.split(':')[0];
    if (!hoursCount[hour]) hoursCount[hour] = 0;
    hoursCount[hour]++;
  });
  
  const hoursList = Object.entries(hoursCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const maxHour = hoursList[0]?.[1] || 1;
  
  document.getElementById('peakHours').innerHTML = hoursList.length ? hoursList.map(([hour, count]) => {
    const percent = (count / maxHour) * 100;
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <strong style="font-size:14px;color:var(--dark)">🕐 ${hour}:00</strong>
          <span style="font-weight:700;color:#f0a500">${count} תורים</span>
        </div>
        <div style="background:#fff8e6;height:8px;border-radius:10px;overflow:hidden">
          <div style="background:#f0a500;height:100%;width:${percent}%;transition:width 0.5s"></div>
        </div>
      </div>
    `;
  }).join('') : '<p style="color:#aaa;font-size:13px">אין נתונים עדיין</p>';
  
  // הכנסות חודשיות
  const monthlyMap = {};
  completed.forEach(a => {
    const month = a.date.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { count: 0, revenue: 0 };
    monthlyMap[month].count++;
    const svc = services.find(s => s.name === a.serviceName);
    if (svc && svc.price) monthlyMap[month].revenue += Number(svc.price);
  });
  
  const monthlyList = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);
  
  document.getElementById('monthlyRevenue').innerHTML = monthlyList.length ? monthlyList.map(([month, data]) => {
    const [year, m] = month.split('-');
    const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    const monthName = monthNames[parseInt(m) - 1];
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;background:#fdf8fa;border-radius:12px;margin-bottom:10px">
        <div>
          <strong style="font-size:15px;color:var(--dark)">${monthName} ${year}</strong>
          <div style="font-size:12px;color:#888;margin-top:2px">${data.count} תורים</div>
        </div>
        <div style="font-size:20px;font-weight:700;color:#25D366;font-family:'Playfair Display',serif">
          ₪${data.revenue}
        </div>
      </div>
    `;
  }).join('') : '<p style="color:#aaa;font-size:13px">אין נתונים עדיין</p>';
}

function viewClientGallery(phone, name) {
  const modal = document.getElementById('clientGalleryModal');
  const content = document.getElementById('clientGalleryContent');
  
  modal.style.display = 'block';
  content.innerHTML = '<p style="text-align:center;color:#aaa">טוען...</p>';
  
  const appts = getAppointments().filter(a => {
    const norm = (p) => p.replace(/\D/g, '');
    return norm(a.clientPhone) === norm(phone) && a.status === 'completed';
  }).sort((a, b) => b.date.localeCompare(a.date));
  
  if (appts.length === 0) {
    content.innerHTML = `
      <h2 style="font-family:'Playfair Display',serif;color:var(--dark);margin-bottom:20px">📸 גלריה של ${sanitize(name)}</h2>
      <p style="text-align:center;color:#aaa;padding:40px 0">עדיין אין תמונות בגלריה</p>
      <p style="text-align:center;color:#888;font-size:14px">תמונות יתווספו אוטומטית לאחר כל תור שהושלם</p>
    `;
    return;
  }
  
  content.innerHTML = `
    <h2 style="font-family:'Playfair Display',serif;color:var(--dark);margin-bottom:8px">📸 גלריה של ${sanitize(name)}</h2>
    <p style="color:#888;font-size:14px;margin-bottom:24px">${appts.length} תורים הושלמו</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">
      ${appts.map(a => `
        <div style="background:#fdf8fa;border-radius:12px;padding:12px;border:2px solid #f0e0e8">
          <div style="aspect-ratio:1;background:linear-gradient(135deg,#fdf0f5,#f0e0e8);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;font-size:48px">
            ${a.serviceIcon || '💅'}
          </div>
          <div style="font-weight:700;font-size:14px;color:var(--dark);margin-bottom:4px">${sanitize(a.serviceName)}</div>
          <div style="font-size:12px;color:#888">${formatDate(a.date)}</div>
          ${a.notes ? `<div style="font-size:11px;color:#aaa;margin-top:6px;font-style:italic">"${sanitize(a.notes)}"</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function closeClientGallery() {
  document.getElementById('clientGalleryModal').style.display = 'none';
}

function renderReviews() {
  const list = document.getElementById('reviewsList');
  if (!list) return;
  
  list.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px 0">טוען ביקורות...</p>';
  
  loadReviewsFromSheets().then(reviews => {
    if (!reviews || reviews.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px 0">עדיין אין ביקורות</p>';
      return;
    }
    
    const pending = reviews.filter(r => !r.approved);
    const approved = reviews.filter(r => r.approved);
    
    let html = '';
    
    if (pending.length > 0) {
      html += '<div class="settings-card" style="margin-bottom:20px"><h3 class="settings-card-title">⏳ ממתינות לאישור (${pending.length})</h3>';
      html += pending.map(r => renderReviewCard(r, false)).join('');
      html += '</div>';
    }
    
    if (approved.length > 0) {
      html += '<div class="settings-card"><h3 class="settings-card-title">✅ ביקורות מאושרות (${approved.length})</h3>';
      html += approved.map(r => renderReviewCard(r, true)).join('');
      html += '</div>';
    }
    
    list.innerHTML = html;
  });
}

function renderReviewCard(review, isApproved) {
  const stars = '⭐'.repeat(review.rating);
  return `
    <div style="background:#fdf8fa;border-radius:12px;padding:16px;margin-bottom:12px;border:2px solid ${isApproved ? '#25D366' : '#f0a500'}">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
        <div>
          <div style="font-size:20px;margin-bottom:4px">${stars}</div>
          <strong style="color:var(--dark);font-size:15px">${sanitize(review.name)}</strong>
          <span style="color:#aaa;font-size:13px;margin-right:8px">${formatDate(review.date)}</span>
        </div>
        <div style="display:flex;gap:6px">
          ${!isApproved ? `<button onclick="approveReview('${review.id}')" class="act-btn" style="background:#25D366;color:#fff;font-size:12px;padding:6px 12px">✅ אשר</button>` : ''}
          <button onclick="deleteReview('${review.id}')" class="act-btn del" style="font-size:12px;padding:6px 10px">🗑</button>
        </div>
      </div>
      <p style="color:#555;line-height:1.6;font-size:14px">${sanitize(review.text)}</p>
    </div>
  `;
}

function loadReviewsFromSheets() {
  return new Promise((resolve) => {
    const cb = 'lr' + Date.now();
    const url = WEBAPP_URL + '?action=loadReviews&callback=' + cb;
    window[cb] = (data) => {
      delete window[cb]; document.getElementById(cb)?.remove();
      resolve(Array.isArray(data) ? data : []);
    };
    const s = document.createElement('script');
    s.id = cb; s.src = url;
    s.onerror = () => resolve([]);
    document.body.appendChild(s);
    setTimeout(() => { delete window[cb]; resolve([]); }, 8000);
  });
}

function approveReview(reviewId) {
  const cb = 'ar' + Date.now();
  const url = WEBAPP_URL + '?action=approveReview&callback=' + cb + '&id=' + encodeURIComponent(reviewId);
  window[cb] = () => {
    delete window[cb]; document.getElementById(cb)?.remove();
    showToast('✅ ביקורת אושרה!');
    renderReviews();
  };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}

function deleteReview(reviewId) {
  showConfirmDialog('למחוק ביקורת זו?', () => {
    const cb = 'dr' + Date.now();
    const url = WEBAPP_URL + '?action=deleteReview&callback=' + cb + '&id=' + encodeURIComponent(reviewId);
    window[cb] = () => {
      delete window[cb]; document.getElementById(cb)?.remove();
      showToast('✅ ביקורת נמחקה');
      renderReviews();
    };
    const s = document.createElement('script');
    s.id = cb; s.src = url;
    document.body.appendChild(s);
  });
}

function removeBlockDate(dateStr) {
  const s = getSettings();
  s.blockedDates = s.blockedDates.filter(d => d !== dateStr);
  saveSettings(s);
  renderBlockedDates();
}

function saveSettingsHandler() {
  const settings = getSettings();
  settings.waPhone = document.getElementById('waPhoneInput').value.trim();
  const breakTimeVal = parseInt(document.getElementById('breakTimeInput').value, 10);
  if (!isNaN(breakTimeVal) && breakTimeVal >= 0) settings.breakTime = breakTimeVal;
  const lbStart = document.getElementById('lunchBreakStart').value;
  const lbEnd   = document.getElementById('lunchBreakEnd').value;
  if (lbStart && lbEnd) settings.lunchBreak = { start: lbStart, end: lbEnd };
  else delete settings.lunchBreak;
  const newPass = document.getElementById('newPassInput').value.trim();
  if (newPass) settings.adminPass = newPass;

  document.querySelectorAll('.wd-active').forEach(cb => {
    const dow = cb.dataset.dow;
    const row = cb.closest('.work-day-row');
    settings.workDays[dow] = {
      active: cb.checked,
      start: row.querySelector('.wd-start').value,
      end:   row.querySelector('.wd-end').value,
    };
  });

  saveSettings(settings);
  showToast('✅ הגדרות נשמרו בהצלחה!');
  document.getElementById('newPassInput').value = '';
}

// ── CLIENTS LIST ──
function _displayClients(clients) {
  const search = document.getElementById('clientSearch')?.value.toLowerCase() || '';
  const list = document.getElementById('clientsList');
  if (!list) return;
  if (!clients || clients.length === 0) { list.innerHTML = emptyMsg('אין לקוחות רשומים עדיין'); return; }
  const filtered = search
    ? clients.filter(c => c.name.toLowerCase().includes(search) || c.phone.includes(search))
    : clients;
  if (filtered.length === 0) { list.innerHTML = emptyMsg('לא נמצאו תוצאות'); return; }
  const appts = getAppointments();
  list.innerHTML = filtered.map(c => {
    const normPhone = (p) => String(p || '').replace(/\D/g, '');
    const clientAppts = appts.filter(a => normPhone(a.clientPhone) === normPhone(c.phone) && a.status !== 'cancelled');
    const lastAppt = clientAppts.sort((a,b) => b.date.localeCompare(a.date))[0];
    let displayPhone = String(c.phone || '').replace(/\D/g, '');
    if (displayPhone && !displayPhone.startsWith('972')) {
      if (displayPhone.startsWith('0')) displayPhone = displayPhone;
      else displayPhone = '0' + displayPhone;
    } else if (displayPhone.startsWith('972')) {
      displayPhone = '0' + displayPhone.slice(3);
    }
    const waPhone = displayPhone.replace(/\D/g, '').replace(/^0/, '972');
    return `
      <div class="client-card">
        <div class="client-avatar">${c.name.charAt(0)}</div>
        <div class="client-info">
          <strong>${sanitize(c.name)}</strong>
          <span><a href="tel:${sanitize(displayPhone)}">${sanitize(displayPhone)}</a></span>
          <span>תורים: ${clientAppts.length} | אחרון: ${lastAppt ? lastAppt.date : 'אין'}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="viewClientGallery('${sanitize(c.phone)}', '${sanitize(c.name)}')" class="act-btn" style="background:#e8f0ff;color:#1a5a9e;font-size:12px;padding:8px 12px">🖼️</button>
          <button onclick="editClient('${sanitize(c.phone)}', '${sanitize(c.name)}')" class="act-btn" style="background:#e8f8ef;color:#1a9e4a;font-size:12px;padding:8px 12px">✏️</button>
          <a href="https://wa.me/${waPhone}" target="_blank" class="act-btn wa" style="font-size:12px;padding:8px 12px">💬</a>
          <button onclick="deleteClient('${sanitize(c.phone)}')" class="act-btn del" style="font-size:12px;padding:8px 12px">🗑</button>
        </div>
      </div>`;
  }).join('');
}

function renderClientsList() {
  const list = document.getElementById('clientsList');
  if (!list) return;
  // הצג מ-cache מיד
  const cached = DB.get('clients_cache', null);
  if (cached && cached.length > 0) {
    _displayClients(cached);
  } else {
    list.innerHTML = '<p class="empty-msg">טוען לקוחות...</p>';
  }
  // משוך עדכון ברקע
  loadClientsFromSheets().then(clients => {
    if (clients && clients.length > 0) {
      DB.set('clients_cache', clients);
      _displayClients(clients);
    }
  });
}

function loadClientsFromSheets() {
  return new Promise((resolve) => {
    const cb = 'lc' + Date.now();
    const url = WEBAPP_URL + '?action=loadClients&callback=' + cb;
    window[cb] = (data) => {
      delete window[cb]; document.getElementById(cb)?.remove();
      resolve(Array.isArray(data) ? data : []);
    };
    const s = document.createElement('script');
    s.id = cb; s.src = url;
    s.onerror = () => resolve([]);
    document.body.appendChild(s);
    setTimeout(() => { delete window[cb]; resolve([]); }, 8000);
  });
}

// ── SERVICES EDITOR ──
function renderServicesEditor() {
  const services = getServices();
  document.getElementById('servicesEditor').innerHTML = services.map((s, i) => `
    <div class="svc-edit-row" data-idx="${i}">
      <input class="svc-icon"     type="text"   value="${s.icon}"     placeholder="💅" maxlength="2"/>
      <input class="svc-name"     type="text"   value="${s.name}"     placeholder="שם שירות"/>
      <div class="svc-num-wrap">
        <label>דקות</label>
        <input class="svc-duration" type="number" value="${s.duration}" min="15" step="15"/>
      </div>
      <div class="svc-num-wrap">
        <label>מחיר ₪</label>
        <input class="svc-price" type="number" value="${s.price}" min="0" placeholder="0"/>
      </div>
      <button class="act-btn del" onclick="removeService(${i})">🗑</button>
    </div>
  `).join('');
}

function removeService(idx) {
  const services = getServices();
  services.splice(idx, 1);
  saveServices(services);
  renderServicesEditor();
}

function addService() {
  const services = getServices();
  services.push({ id: generateId(), name: 'שירות חדש', icon: '💅', duration: 60, price: '' });
  saveServices(services);
  renderServicesEditor();
}

function saveServicesHandler() {
  const rows     = document.querySelectorAll('.svc-edit-row');
  const services = getServices();
  rows.forEach((row, i) => {
    if (!services[i]) return;
    services[i].icon     = row.querySelector('.svc-icon').value;
    services[i].name     = row.querySelector('.svc-name').value;
    services[i].duration = +row.querySelector('.svc-duration').value;
    services[i].price    = row.querySelector('.svc-price').value;
  });
  saveServices(services);
  showToast('✅ שירותים נשמרו בהצלחה!');
}

