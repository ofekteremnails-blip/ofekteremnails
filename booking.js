// ── GOOGLE SHEETS + CALENDAR SYNC ──
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxWE5GsJqR05MTabvUrtmb1_siLD-pmLwpXHiG3T7AAUkwr07xpOhBbqCZeV4fqx7E/exec';

async function loadAllData() {
  return new Promise((resolve) => {
    const cb = 'loadAll_' + Date.now();
    const url = WEBAPP_URL + '?action=loadAll&callback=' + cb;
    window[cb] = (data) => {
      delete window[cb];
      document.getElementById(cb)?.remove();
      if (data) {
        if (data.appointments) saveAppointments(data.appointments);
        if (data.settings) DB.set('settings', data.settings);
        if (data.services) DB.set('services', data.services);
      }
      resolve(data);
    };
    const s = document.createElement('script');
    s.id = cb;
    s.src = url;
    s.onerror = () => { delete window[cb]; resolve(null); };
    document.body.appendChild(s);
    setTimeout(() => { delete window[cb]; resolve(null); }, 10000);
  });
}

function saveToSheets(appt) {
  const slim = {
    id: appt.id, serviceName: appt.serviceName, duration: appt.duration,
    date: appt.date, time: appt.time, clientName: appt.clientName,
    clientPhone: appt.clientPhone, notes: appt.notes || '', status: appt.status,
  };
  const cb = 'sc' + Date.now();
  const url = WEBAPP_URL
    + '?action=save'
    + '&callback=' + cb
    + '&id='          + encodeURIComponent(slim.id)
    + '&serviceName=' + encodeURIComponent(slim.serviceName)
    + '&duration='    + slim.duration
    + '&date='        + slim.date
    + '&time='        + encodeURIComponent(slim.time)
    + '&clientName='  + encodeURIComponent(slim.clientName)
    + '&clientPhone=' + encodeURIComponent(slim.clientPhone)
    + '&notes='       + encodeURIComponent(slim.notes)
    + '&status='      + slim.status;
  window[cb] = (res) => { delete window[cb]; document.getElementById(cb)?.remove(); };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}

// מנסה להסיק משך שירות לפי שם - fallback לתורים ישנים ללא עמודת משך
function _guessDuration(serviceName) {
  const svc = getServices().find(s => s.name === serviceName);
  return svc ? svc.duration : 60;
}

async function loadFromSheets() {
  return new Promise((resolve) => {
    const callbackName = 'sheetsCallback_' + Date.now();
    const url = WEBAPP_URL + '?action=load&callback=' + callbackName;
    window[callbackName] = (rows) => {
      delete window[callbackName];
      document.getElementById('jsonpScript')?.remove();
      if (!Array.isArray(rows) || rows.length === 0) { resolve(null); return; }
      const appts = rows.map(r => {
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
        let phone = String(r['טלפון'] || '');
        if (phone && !phone.startsWith('0') && !phone.startsWith('+') && phone.length <= 9) phone = '0' + phone;
        return {
          id:          String(r['ID'] || ''),
          serviceName: String(r['שירות'] || ''),
          serviceIcon: '💅',
          date, time,
          clientName:  String(r['שם לקוחה'] || ''),
          clientPhone: phone,
          notes:       String(r['הערות'] || ''),
          status:      String(r['סטטוס'] || 'pending'),
          duration:    Number(r['משך'] || r['duration'] || 0) || _guessDuration(String(r['שירות'] || '')),
        };
      }).filter(a => a.id && a.date);
      saveAppointments(appts);
      resolve(appts);
    };
    const script = document.createElement('script');
    script.id = 'jsonpScript';
    script.src = url;
    script.onerror = () => { resolve(null); };
    document.body.appendChild(script);
    setTimeout(() => { delete window[callbackName]; resolve(null); }, 8000);
  });
}

function saveClientToSheets(name, phone) {
  const cb = 'cl' + Date.now();
  const url = WEBAPP_URL + '?action=saveClient&callback=' + cb
    + '&name=' + encodeURIComponent(name)
    + '&phone=' + encodeURIComponent(phone);
  window[cb] = () => { delete window[cb]; document.getElementById(cb)?.remove(); };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}

// ── SANITIZE ──
function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── DATA STORE ──
const DB = {
  get: (key, def) => { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

// ── DEFAULTS ──
const DEFAULT_SERVICES = [
  { id: 's1', name: "לק ג'ל קלאסי",                   icon: '💅', duration: 45,  price: 120 },
  { id: 's2', name: 'תיקון מבנה אנטומי',               icon: '✨', duration: 90,  price: 140 },
  { id: 's3', name: "טיפסים הפוכים (בנייה בג'ל)",     icon: '💎', duration: 90,  price: 350 },
  { id: 's4', name: 'הדבקת טיפסים (בנייה בטיפס)',     icon: '🌸', duration: 90,  price: 280 },
  { id: 's5', name: "לק ג'ל רגליים",                  icon: '💅', duration: 40,  price: 120 },
  { id: 's6', name: 'השלמת ציפורן / הוספת קישוט',     icon: '💅', duration: 15,  price: 15  },
  { id: 's7', name: 'הסרה',                            icon: '💅', duration: 30,  price: 70  },
];

const DEFAULT_SETTINGS = {
  workDays: {
    0: { active: false, start: '10:00', end: '20:00' },
    1: { active: true,  start: '10:00', end: '20:00' },
    2: { active: true,  start: '10:00', end: '20:00' },
    3: { active: true,  start: '10:00', end: '20:00' },
    4: { active: true,  start: '10:00', end: '20:00' },
    5: { active: true,  start: '10:00', end: '20:00' },
    6: { active: false, start: '10:00', end: '14:00' },
  },
  slotInterval: 15,
  waPhone: '972546827299',
  adminPass: '1234',
  blockedDates: [],
};

// ── INIT ──
function getServices() { return DB.get('services', DEFAULT_SERVICES); }
function getSettings() {
  const saved = DB.get('settings', null);
  if (!saved) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    adminPass: saved.adminPass || DEFAULT_SETTINGS.adminPass,
    workDays: { ...DEFAULT_SETTINGS.workDays, ...saved.workDays },
    blockedDates: saved.blockedDates || [],
  };
}
function getAppointments() { return DB.get('appointments', []); }
function saveAppointments(arr) { DB.set('appointments', arr); }
function saveSettings(s) { DB.set('settings', s); saveSettingsToSheets(s); }
function saveServices(s) { DB.set('services', s); saveServicesToSheets(s); }

function saveSettingsToSheets(settings) {
  const cb = 'ss' + Date.now();
  const url = WEBAPP_URL + '?action=saveSettings&callback=' + cb
    + '&data=' + encodeURIComponent(JSON.stringify(settings));
  window[cb] = () => { delete window[cb]; document.getElementById(cb)?.remove(); };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}

function saveServicesToSheets(services) {
  const cb = 'sv' + Date.now();
  const url = WEBAPP_URL + '?action=saveServices&callback=' + cb
    + '&data=' + encodeURIComponent(JSON.stringify(services));
  window[cb] = () => { delete window[cb]; document.getElementById(cb)?.remove(); };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}

async function loadSettingsFromSheets() {
  return new Promise((resolve) => {
    const cb = 'ls' + Date.now();
    const url = WEBAPP_URL + '?action=loadSettings&callback=' + cb;
    window[cb] = (data) => {
      delete window[cb]; document.getElementById(cb)?.remove();
      if (data && data.settings) DB.set('settings', data.settings);
      if (data && data.services) DB.set('services', data.services);
      resolve(data);
    };
    const s = document.createElement('script');
    s.id = cb; s.src = url;
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
    setTimeout(() => { delete window[cb]; resolve(null); }, 8000);
  });
}

// ── HELPERS ──
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
function fromMinutes(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ── TIMEZONE ──
// כל חישובי תאריך/שעה מבוססים על timezone ישראל (Asia/Jerusalem)
const TZ = 'Asia/Jerusalem';

function nowInTZ() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

function todayStrTZ() {
  const d = nowInTZ();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function isPastDateTZ(dateStr) {
  return dateStr < todayStrTZ();
}

// ── SLOT LOCKING (מניעת double booking) ──
// lock נשמר ב-localStorage: { key: { lockedBy, expiresAt } }
const LOCK_TTL_MS = 45 * 1000; // 45 שניות

function _lockKey(dateStr, timeStr) { return `lock_${dateStr}_${timeStr}`; }

function lockSlot(dateStr, timeStr) {
  const key = _lockKey(dateStr, timeStr);
  const existing = DB.get(key, null);
  const now = Date.now();
  // אם יש lock פעיל של מישהו אחר - נכשל
  if (existing && existing.expiresAt > now && existing.lockedBy !== _myLockId()) return false;
  DB.set(key, { lockedBy: _myLockId(), expiresAt: now + LOCK_TTL_MS });
  return true;
}

function releaseSlot(dateStr, timeStr) {
  const key = _lockKey(dateStr, timeStr);
  const existing = DB.get(key, null);
  if (existing && existing.lockedBy === _myLockId()) DB.set(key, null);
}

function isSlotLocked(dateStr, timeStr) {
  const key = _lockKey(dateStr, timeStr);
  const lock = DB.get(key, null);
  if (!lock) return false;
  if (lock.expiresAt <= Date.now()) { DB.set(key, null); return false; }
  return lock.lockedBy !== _myLockId();
}

function _myLockId() {
  let id = sessionStorage.getItem('_lockId');
  if (!id) { id = generateId(); sessionStorage.setItem('_lockId', id); }
  return id;
}

// ── ISRAELI HOLIDAYS ──
const ISRAELI_HOLIDAYS = {
  2025: [
    '2025-04-12','2025-04-13','2025-04-14','2025-04-15','2025-04-16',
    '2025-04-17','2025-04-18','2025-04-19','2025-04-20',
    '2025-05-04','2025-05-05',
    '2025-06-01','2025-06-02','2025-06-03',
    '2025-09-22','2025-09-23','2025-09-24',
    '2025-10-01','2025-10-02',
    '2025-10-06','2025-10-07','2025-10-08','2025-10-09','2025-10-10',
    '2025-10-11','2025-10-12','2025-10-13','2025-10-14',
  ],
  2026: [
    '2026-04-01','2026-04-02','2026-04-03','2026-04-04','2026-04-05',
    '2026-04-06','2026-04-07','2026-04-08','2026-04-09',
    '2026-04-22','2026-04-23',
    '2026-05-21','2026-05-22','2026-05-23',
    '2026-09-11','2026-09-12','2026-09-13',
    '2026-09-20','2026-09-21',
    '2026-09-25','2026-09-26','2026-09-27','2026-09-28','2026-09-29',
    '2026-09-30','2026-10-01','2026-10-02','2026-10-03',
  ]
};

function isIsraeliHoliday(dateStr) {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return (ISRAELI_HOLIDAYS[year] || []).includes(dateStr);
}

// ── FREE INTERVALS ──
function getFreeIntervals(workIntervals, bookedIntervals) {
  let free = workIntervals.map(w => ({ ...w }));
  bookedIntervals.forEach(appt => {
    const next = [];
    free.forEach(interval => {
      if (appt.end <= interval.start || appt.start >= interval.end) {
        next.push(interval);
      } else {
        if (appt.start > interval.start) next.push({ start: interval.start, end: appt.start });
        if (appt.end < interval.end)   next.push({ start: appt.end,   end: interval.end });
      }
    });
    free = next;
  });
  return free;
}

function getAvailableSlots(dateStr, durationMins) {
  const settings = getSettings();
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, mo - 1, d).getDay();

  // שעות מיוחדות עוקפות הכל - גם חגים וימים חסומים
  const customForDate = (settings.customHours || []).filter(c => c.date === dateStr);
  const hasCustom = customForDate.length > 0;

  if (!hasCustom) {
    // בדוק חג ישראלי
    if (isIsraeliHoliday(dateStr)) return [];
    // בדוק חסום
    if ((settings.blockedDates || []).includes(dateStr)) return [];
    // בדוק יום עבודה
    const day = settings.workDays[dow];
    if (!day || !day.active) return [];
  }

  // בנה טווחי עבודה
  let workIntervals;
  if (hasCustom) {
    // שעות מיוחדות בלבד
    workIntervals = customForDate.map(c => ({ start: toMinutes(c.start), end: toMinutes(c.end) }));
  } else {
    const day = settings.workDays[dow];
    workIntervals = [{ start: toMinutes(day.start), end: toMinutes(day.end) }];
    // חתוך הפסקת צהריים
    const lb = settings.lunchBreak;
    if (lb && lb.start && lb.end && lb.start > day.start && lb.end < day.end) {
      workIntervals = [
        { start: toMinutes(day.start), end: toMinutes(lb.start) },
        { start: toMinutes(lb.end),   end: toMinutes(day.end)   },
      ];
    }
  }

  // תורים קיימים + שעות חסומות
  const bookedIntervals = [
    ...getAppointments()
      .filter(a => a.date === dateStr && a.status !== 'cancelled')
      .map(a => ({ start: toMinutes(a.time), end: toMinutes(a.time) + (Number(a.duration) || 60) })),
    ...(settings.blockedHours || [])
      .filter(b => b.date === dateStr)
      .map(b => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
  ];

  const freeIntervals = getFreeIntervals(workIntervals, bookedIntervals);

  // מרווח קבוע לבדיקת זמינות
  const slotInterval = settings.slotInterval || 15;
  const slots = [];
  freeIntervals.forEach(({ start, end }) => {
    for (let t = start; t + durationMins <= end; t += slotInterval) {
      const timeStr = fromMinutes(t);
      if (!isSlotLocked(dateStr, timeStr)) slots.push(timeStr);
    }
  });

  return slots.sort((a, b) => a.localeCompare(b));
}

function isWorkDay(dateStr) {
  const settings = getSettings();
  // שעות מיוחדות עוקפות הכל
  if ((settings.customHours || []).some(c => c.date === dateStr)) return true;
  if (isIsraeliHoliday(dateStr)) return false;
  if ((settings.blockedDates || []).includes(dateStr)) return false;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, mo - 1, d).getDay();
  const day = settings.workDays[dow];
  return !!(day && day.active);
}

function formatDate(dateStr) {
  // פרסור ישיר ללא תלות ב-timezone של הדפדפן
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function sendWhatsApp(phone, msg) {
  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
}

// ── NOTIFICATIONS (PWA) ──
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function scheduleLocalNotification(title, body, fireAt) {
  const delay = fireAt - Date.now();
  if (delay <= 0) return;
  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'logo.png' });
    }
  }, delay);
}

function scheduleAppointmentReminders(appt) {
  const apptTime = new Date(`${appt.date}T${appt.time}`).getTime();
  const service = getServices().find(s => s.id === appt.serviceId);
  const svcName = service ? service.name : appt.serviceName;
  scheduleLocalNotification('💅 תור מחר!', `${appt.clientName} - ${svcName} בשעה ${appt.time}`, apptTime - 24 * 60 * 60 * 1000);
  scheduleLocalNotification('💅 תור בעוד שעה!', `${appt.clientName} - ${svcName} בשעה ${appt.time}`, apptTime - 60 * 60 * 1000);
}

function sendReminderToSheets(appt) {
  const cb = 'rem' + Date.now();
  const url = WEBAPP_URL + '?action=scheduleReminder&callback=' + cb
    + '&id=' + encodeURIComponent(appt.id)
    + '&date=' + appt.date
    + '&time=' + encodeURIComponent(appt.time)
    + '&clientName=' + encodeURIComponent(appt.clientName)
    + '&clientPhone=' + encodeURIComponent(appt.clientPhone)
    + '&serviceName=' + encodeURIComponent(appt.serviceName);
  window[cb] = () => { delete window[cb]; document.getElementById(cb)?.remove(); };
  const s = document.createElement('script');
  s.id = cb; s.src = url;
  document.body.appendChild(s);
}
