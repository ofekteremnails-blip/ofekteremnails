const SHEET_ID = '1lHE5n4vMMlL2W7vioDjI60WuH-MAA_QPW62mbYb-I_8';
const CAL_NAME = 'אופק תרם ניילס 💅';

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('תורים');
  if (!sheet) {
    sheet = ss.insertSheet('תורים');
    sheet.appendRow(['ID','שירות','תאריך','שעה','שם לקוחה','טלפון','הערות','סטטוס','משך','נוצר ב']);
    sheet.getRange(1,1,1,10).setFontWeight('bold').setBackground('#b76e79').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getClientsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('לקוחות');
  if (!sheet) {
    sheet = ss.insertSheet('לקוחות');
    sheet.appendRow(['שם','טלפון','נוצר ב']);
    sheet.getRange(1,1,1,3).setFontWeight('bold').setBackground('#b76e79').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getDiscountsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('הנחות');
  if (!sheet) {
    sheet = ss.insertSheet('הנחות');
    sheet.appendRow(['ID','טלפון','סכום','סוג','תאריך','תוקף עד','סטטוס','נוצר ב']);
    sheet.getRange(1,1,1,8).setFontWeight('bold').setBackground('#b76e79').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getReviewsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('ביקורות');
  if (!sheet) {
    sheet = ss.insertSheet('ביקורות');
    sheet.appendRow(['ID','שם','דירוג','טקסט','תאריך','מאושר']);
    sheet.getRange(1,1,1,6).setFontWeight('bold').setBackground('#b76e79').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateCalendar() {
  const cals = CalendarApp.getCalendarsByName(CAL_NAME);
  if (cals.length > 0) return cals[0];
  return CalendarApp.createCalendar(CAL_NAME, { color: CalendarApp.Color.FLAMINGO });
}

function doGet(e) {
  const action   = e.parameter.action   || 'load';
  const callback = e.parameter.callback || null;

  if (action === 'save') {
    const data = {
      id: e.parameter.id,
      serviceName: e.parameter.serviceName,
      duration: e.parameter.duration,
      date: e.parameter.date,
      time: e.parameter.time,
      clientName: e.parameter.clientName,
      clientPhone: e.parameter.clientPhone,
      notes: e.parameter.notes || '',
      status: e.parameter.status || 'pending'
    };
    const result = saveAppointment(data);
    if (result === 'conflict') {
      const json = JSON.stringify({ success: false, conflict: true });
      const out  = callback ? callback + '(' + json + ')' : json;
      return ContentService.createTextOutput(out)
        .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
    }
    // תמיד שמור/עדכן לקוח בטבלת לקוחות
    if (data.clientName && data.clientPhone) saveClient(data.clientName, data.clientPhone);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'saveClient') {
    saveClient(e.parameter.name, e.parameter.phone);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'loadClients') {
    const clients = loadClients();
    const json = JSON.stringify(clients);
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'deleteClient') {
    try {
      deleteClient(e.parameter.phone);
      const json = JSON.stringify({ success: true });
      const out  = callback ? callback + '(' + json + ')' : json;
      return ContentService.createTextOutput(out)
        .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
    } catch(err) {
      const json = JSON.stringify({ success: false, error: err.message });
      const out  = callback ? callback + '(' + json + ')' : json;
      return ContentService.createTextOutput(out)
        .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
    }
  }

  if (action === 'removeDuplicateClients') {
    try {
      const removed = removeDuplicateClients();
      const json = JSON.stringify({ success: true, removed });
      const out  = callback ? callback + '(' + json + ')' : json;
      return ContentService.createTextOutput(out)
        .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
    } catch(err) {
      const json = JSON.stringify({ success: false, error: err.message });
      const out  = callback ? callback + '(' + json + ')' : json;
      return ContentService.createTextOutput(out)
        .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
    }
  }

  if (action === 'updateClient') {
    updateClient(e.parameter.oldPhone, e.parameter.newName, e.parameter.newPhone);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'lookupClient') {
    const client = lookupClient(e.parameter.phone);
    const json = JSON.stringify(client);
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'saveSettings') {
    saveSettings(e.parameter.data);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'saveServices') {
    saveServices(e.parameter.data);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'loadSettings') {
    const result = loadSettings();
    const json = JSON.stringify(result);
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'loadAll') {
    const appointments = loadAppointments();
    const settings = loadSettings();
    const clients = loadClients();
    const result = {
      appointments,
      settings: settings.settings || null,
      services: settings.services || null,
      clients
    };
    const json = JSON.stringify(result);
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'updateDate') {
    updateDateAndTime(e.parameter.id, e.parameter.date, e.parameter.time);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'updateStatus') {
    updateStatus(e.parameter.id, e.parameter.status);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'deleteRow') {
    deleteRow(e.parameter.id);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'saveReview') {
    saveReview(e.parameter);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'addWaitlist') {
    addToWaitlist(e.parameter);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'loadWaitlist') {
    const waitlist = loadWaitlist();
    const json = JSON.stringify(waitlist);
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'removeWaitlist') {
    removeFromWaitlist(e.parameter.id);
    const json = JSON.stringify({ success: true });
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  // Smart waitlist matching: מצא מתאימים ל-slot שהתפנה
  if (action === 'matchWaitlist') {
    const match = matchWaitlistToSlot(e.parameter.date, parseInt(e.parameter.freedMins || '0', 10));
    const json = JSON.stringify(match || null);
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  // action === 'load'
  try {
    const sheet = getSheet();
    let result = [];
    if (sheet.getLastRow() > 1) {
      const rows    = sheet.getDataRange().getValues();
      const headers = rows[0];
      result = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
    }
    const json = JSON.stringify(result);
    const out  = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  } catch(err) {
    const out = callback ? callback + '([])' : '[]';
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
}

function hasConflict(date, time, duration) {
  if (getSheet().getLastRow() <= 1) return false;
  const rows = getSheet().getRange(2, 1, getSheet().getLastRow() - 1, 9).getValues();
  const newStart = timeToMins(time);
  const newEnd   = newStart + (Number(duration) || 60);
  for (const row of rows) {
    if (String(row[2]) !== String(date)) continue;
    if (String(row[7]) === 'cancelled') continue;
    const s = timeToMins(String(row[3]));
    const e = s + (Number(row[8]) || 60);
    if (newStart < e && newEnd > s) return true;
  }
  return false;
}

// בדיקה למנהל - חוסם רק אם יש תור confirmed אחר באותה שעה (לא pending)
function hasConfirmedConflict(date, time, duration) {
  if (getSheet().getLastRow() <= 1) return false;
  const rows = getSheet().getRange(2, 1, getSheet().getLastRow() - 1, 9).getValues();
  const newStart = timeToMins(time);
  const newEnd   = newStart + (Number(duration) || 60);
  for (const row of rows) {
    if (String(row[2]) !== String(date)) continue;
    const status = String(row[7]);
    if (status === 'cancelled' || status === 'pending') continue;
    const s = timeToMins(String(row[3]));
    const e = s + (Number(row[8]) || 60);
    if (newStart < e && newEnd > s) return true;
  }
  return false;
}

function timeToMins(t) {
  if (!t || t.includes('1899') || t.includes('T')) {
    const d = new Date(t); return d.getHours() * 60 + d.getMinutes();
  }
  const [h, m] = t.split(':').map(Number); return h * 60 + m;
}

function saveAppointment(data) {
  const sheet = getSheet();
  const ids = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().map(String)
    : [];
  if (ids.includes(String(data.id))) return;
  const conflictCheck = (data.status === 'confirmed') ? hasConfirmedConflict : hasConflict;
  if (conflictCheck(data.date, data.time, data.duration)) return 'conflict';

  sheet.appendRow([
    data.id, data.serviceName, data.date, data.time,
    data.clientName, data.clientPhone, data.notes || '',
    data.status || 'pending',
    Number(data.duration) || 60,
    new Date().toLocaleString('he-IL')
  ]);

  try {
    MailApp.sendEmail({
      to: 'ofekteremnails@gmail.com',
      subject: '💅 תור חדש - ' + data.clientName,
      body: 'תור חדש נקלט!\n\n'
        + 'שם: ' + data.clientName + '\n'
        + 'טלפון: ' + data.clientPhone + '\n'
        + 'שירות: ' + data.serviceName + '\n'
        + 'תאריך: ' + data.date + '\n'
        + 'שעה: ' + data.time + '\n'
        + (data.notes ? 'הערות: ' + data.notes + '\n' : '')
    });
  } catch(mailErr) {
    console.warn('Mail error:', mailErr);
  }

  try {
    if (data.status === 'confirmed') {
      const cal = getOrCreateCalendar();
      const [y, m, d] = data.date.split('-').map(Number);
      const [h, min]  = data.time.split(':').map(Number);
      const start = new Date(y, m - 1, d, h, min);
      const end   = new Date(y, m - 1, d, h, min + (Number(data.duration) || 60));
      cal.createEvent(
        '💅 ' + data.serviceName + ' - ' + data.clientName,
        start, end,
        { description: '📞 ' + data.clientPhone + '\n📝 ' + (data.notes || '-') }
      );
    }
  } catch(calErr) {
    console.warn('Calendar error:', calErr);
  }
}

function saveClient(name, phone) {
  const sheet = getClientsSheet();
  const normalizePhone = (p) => {
    let n = String(p).replace(/\D/g, '');
    if (n.startsWith('972')) n = '0' + n.slice(3);
    if (!n.startsWith('0')) n = '0' + n;
    return n;
  };
  const normalized = normalizePhone(phone);
  if (sheet.getLastRow() > 1) {
    const phones = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
    for (let i = 0; i < phones.length; i++) {
      if (normalizePhone(phones[i]) === normalized) {
        const existingName = sheet.getRange(i + 2, 1).getValue();
        if (existingName !== name) sheet.getRange(i + 2, 1).setValue(name);
        return;
      }
    }
  }
  sheet.appendRow([name, phone, new Date().toLocaleString('he-IL')]);
}

function loadClients() {
  const sheet = getClientsSheet();
  if (sheet.getLastRow() <= 1) return [];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return data.map(row => ({ name: row[0], phone: row[1] }));
}

function deleteClient(phone) {
  const normalizePhone = (p) => String(p).replace(/\D/g, '');
  const normalized = normalizePhone(phone);
  const apptSheet = getSheet();
  if (apptSheet.getLastRow() > 1) {
    const data = apptSheet.getRange(2, 1, apptSheet.getLastRow() - 1, 6).getValues();
    const rowsToDelete = [];
    for (let i = 0; i < data.length; i++) {
      if (normalizePhone(String(data[i][5])) === normalized) rowsToDelete.push(i + 2);
    }
    rowsToDelete.reverse().forEach(rowNum => apptSheet.deleteRow(rowNum));
  }
  const sheet = getClientsSheet();
  if (sheet.getLastRow() <= 1) return;
  const phones = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
  for (let i = 0; i < phones.length; i++) {
    if (normalizePhone(phones[i]) === normalized) { sheet.deleteRow(i + 2); return; }
  }
}

function updateClient(oldPhone, newName, newPhone) {
  const sheet = getClientsSheet();
  if (sheet.getLastRow() <= 1) return;
  const normalizePhone = (p) => String(p).replace(/\D/g, '');
  const normalized = normalizePhone(oldPhone);
  const phones = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
  for (let i = 0; i < phones.length; i++) {
    if (normalizePhone(phones[i]) === normalized) {
      sheet.getRange(i + 2, 1).setValue(newName);
      sheet.getRange(i + 2, 2).setValue(newPhone);
      return;
    }
  }
}

function lookupClient(phone) {
  const normalizePhone = (p) => {
    let n = String(p).replace(/\D/g, '');
    if (n.startsWith('972')) n = '0' + n.slice(3);
    if (n.startsWith('0')) return n;
    return '0' + n;
  };
  const normalized = normalizePhone(phone);

  // חפש בטבלת לקוחות
  const clientSheet = getClientsSheet();
  if (clientSheet.getLastRow() > 1) {
    const data = clientSheet.getRange(2, 1, clientSheet.getLastRow() - 1, 2).getValues();
    for (let row of data) {
      if (normalizePhone(row[1]) === normalized) return { name: row[0] };
    }
  }

  // fallback - חפש בטבלת תורים
  const apptSheet = getSheet();
  if (apptSheet.getLastRow() > 1) {
    const rows = apptSheet.getRange(2, 1, apptSheet.getLastRow() - 1, 6).getValues();
    for (let row of rows) {
      if (normalizePhone(String(row[5])) === normalized) {
        const name = String(row[4]);
        // שמור בטבלת לקוחות לפעם הבאה
        saveClient(name, phone);
        return { name };
      }
    }
  }

  return { name: null };
}

function updateDateAndTime(id, newDate, newTime) {
  const sheet = getSheet();
  if (sheet.getLastRow() <= 1) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.getRange(i + 2, 3).setValue(newDate);
      sheet.getRange(i + 2, 4).setValue(newTime);
      return;
    }
  }
}

function updateStatus(id, status) {
  const sheet = getSheet();
  if (sheet.getLastRow() <= 1) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.getRange(i + 2, 8).setValue(status);
      const date        = String(rows[i][2]);
      const time        = String(rows[i][3]);
      const clientName  = String(rows[i][4]);
      const serviceName = String(rows[i][1]);
      const clientPhone = String(rows[i][5]);
      const duration    = Number(rows[i][8]) || 60;
      if (status === 'confirmed') {
        try {
          const cal = getOrCreateCalendar();
          let dateStr = date;
          if (dateStr instanceof Date || dateStr.includes('T')) {
            const d = new Date(dateStr);
            dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
          }
          let timeStr = time;
          if (timeStr.includes('T') || timeStr.includes('1899')) {
            const d = new Date(timeStr);
            timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
          }
          const [y, m, d2] = dateStr.split('-').map(Number);
          const [h, min]   = timeStr.split(':').map(Number);
          const start = new Date(y, m-1, d2, h, min);
          const end   = new Date(y, m-1, d2, h, min + duration);
          cal.createEvent('💅 ' + serviceName + ' - ' + clientName, start, end,
            { description: '📞 ' + clientPhone });
        } catch(e) { console.warn('Calendar add error:', e); }
      }
      if (status === 'cancelled') {
        try { deleteCalendarEvent(date, time, clientName, serviceName); } catch(e) { console.warn('Calendar delete error:', e); }
      }
      return;
    }
  }
}

function deleteRow(id) {
  const sheet = getSheet();
  if (sheet.getLastRow() <= 1) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      // מחק מהיומן
      try {
        const date = String(rows[i][2]);
        const time = String(rows[i][3]);
        const clientName = String(rows[i][4]);
        const serviceName = String(rows[i][1]);
        deleteCalendarEvent(date, time, clientName, serviceName);
      } catch(e) { console.warn('Calendar delete error:', e); }
      sheet.deleteRow(i + 2);
      return;
    }
  }
}

function deleteCalendarEvent(date, time, clientName, serviceName) {
  const cal = getOrCreateCalendar();
  // תאריך ושעה
  let dateStr = date;
  if (dateStr instanceof Date || dateStr.includes('T')) {
    const d = new Date(dateStr);
    dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  let timeStr = time;
  if (timeStr.includes('T') || timeStr.includes('1899')) {
    const d = new Date(timeStr);
    timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const start = new Date(y, m-1, d, h, min);
  const end = new Date(y, m-1, d, h+3, min); // חלון חיפוש של 3 שעות
  const events = cal.getEvents(start, end);
  const title = '💅 ' + serviceName + ' - ' + clientName;
  for (let ev of events) {
    if (ev.getTitle() === title) { ev.deleteEvent(); break; }
  }
}

function saveReview(data) {
  const sheet = getReviewsSheet();
  const ids = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().map(String)
    : [];
  if (ids.includes(String(data.id))) return;
  sheet.appendRow([data.id, data.name, data.rating, data.text, data.date, false]);
}

function removeDuplicateClients() {
  const sheet = getClientsSheet();
  if (sheet.getLastRow() <= 1) return 0;
  const normalizePhone = (p) => String(p).replace(/\D/g, '');
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const seen = new Set();
  const toDelete = [];
  for (let i = 0; i < data.length; i++) {
    const phone = normalizePhone(data[i][1]);
    if (seen.has(phone)) toDelete.push(i + 2);
    else seen.add(phone);
  }
  toDelete.reverse().forEach(rowNum => sheet.deleteRow(rowNum));
  return toDelete.length;
}

function getSettingsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('הגדרות');
  if (!sheet) {
    sheet = ss.insertSheet('הגדרות');
    sheet.appendRow(['מפתח','ערך','עודכן ב']);
    sheet.getRange(1,1,1,3).setFontWeight('bold').setBackground('#b76e79').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveSettings(dataStr) {
  const sheet = getSettingsSheet();
  const key = 'settings';
  if (sheet.getLastRow() > 1) {
    const keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === key) {
        sheet.getRange(i + 2, 2).setValue(dataStr);
        sheet.getRange(i + 2, 3).setValue(new Date().toLocaleString('he-IL'));
        return;
      }
    }
  }
  sheet.appendRow([key, dataStr, new Date().toLocaleString('he-IL')]);
}

function saveServices(dataStr) {
  const sheet = getSettingsSheet();
  const key = 'services';
  if (sheet.getLastRow() > 1) {
    const keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === key) {
        sheet.getRange(i + 2, 2).setValue(dataStr);
        sheet.getRange(i + 2, 3).setValue(new Date().toLocaleString('he-IL'));
        return;
      }
    }
  }
  sheet.appendRow([key, dataStr, new Date().toLocaleString('he-IL')]);
}

function loadSettings() {
  const sheet = getSettingsSheet();
  if (sheet.getLastRow() <= 1) return { settings: null, services: null };
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const result = { settings: null, services: null };
  for (let row of data) {
    try {
      if (row[0] === 'settings') result.settings = JSON.parse(row[1]);
      else if (row[0] === 'services') result.services = JSON.parse(row[1]);
    } catch(e) {}
  }
  return result;
}

function loadAppointments() {
  try {
    const sheet = getSheet();
    if (sheet.getLastRow() <= 1) return [];
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  } catch(err) { return []; }
}

// ── WAITLIST SHEET ──
function getWaitlistSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('המתנה');
  if (!sheet) {
    sheet = ss.insertSheet('המתנה');
    sheet.appendRow(['ID','שם','טלפון','שירות','משך','תאריך','סטטוס','נוצר ב']);
    sheet.getRange(1,1,1,8).setFontWeight('bold').setBackground('#b76e79').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function addToWaitlist(params) {
  const sheet = getWaitlistSheet();
  const id = params.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,6));
  sheet.appendRow([
    id,
    params.name || '',
    params.phone || '',
    params.service || '',
    parseInt(params.duration || '60', 10),
    params.date || '',
    'waiting',
    params.createdAt || new Date().toISOString()
  ]);
}

function loadWaitlist() {
  const sheet = getWaitlistSheet();
  if (sheet.getLastRow() <= 1) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return {
      id:        String(obj['ID'] || ''),
      name:      String(obj['שם'] || ''),
      phone:     String(obj['טלפון'] || ''),
      service:   String(obj['שירות'] || ''),
      duration:  parseInt(obj['משך'] || '60', 10),
      date:      String(obj['תאריך'] || ''),
      status:    String(obj['סטטוס'] || 'waiting'),
      createdAt: String(obj['נוצר ב'] || '')
    };
  }).filter(r => r.id && r.status === 'waiting');
}

function removeFromWaitlist(id) {
  const sheet = getWaitlistSheet();
  if (sheet.getLastRow() <= 1) return;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().map(String);
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === String(id)) { sheet.deleteRow(i + 2); return; }
  }
}

// Smart FIFO matching: מוצא את הראשון שנכנס ושמשך השירות שלו <= freedMins
function matchWaitlistToSlot(date, freedMins) {
  const waitlist = loadWaitlist()
    .filter(w => w.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // FIFO

  // priority 1: התאמה מדויקת למשך
  // priority 2: משך קצר יותר שנכנס בתוך הזמן שהתפנה
  const match = waitlist.find(w => w.duration <= freedMins);
  return match || null;
}

// notifyUser: שולח WhatsApp דרך link (ניתן להרחיב ל-SMS/Email)
function notifyUser(waitlistEntry, date, time) {
  // בשלב זה מחזיר את הנתונים - ה-admin ישלח ידנית
  return {
    phone: waitlistEntry.phone,
    name:  waitlistEntry.name,
    waLink: 'https://wa.me/' + String(waitlistEntry.phone).replace(/\D/g,'')
      + '?text=' + encodeURIComponent(
        'היי ' + waitlistEntry.name + '! 💅\n'
        + 'התפנה מקום ביום ' + date + ' בשעה ' + time + '!\n'
        + 'רוצה לקבוע? לחצי כאן לקביעת תור 🌸'
      )
  };
}
