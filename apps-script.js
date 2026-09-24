const SHEET_ID = '1lHE5n4vMMlL2W7vioDjI60WuH-MAA_QPW62mbYb-I_8';
const CAL_NAME = 'אופק תרם ניילס 💅';
const ARCHIVE_SPREADSHEET_ID = '1fQu1XkOW4lPuJUh4CWdym3EmmmWNYEGtVR7n7EwGIxk';
const ARCHIVE_TAB_NAME = 'ארכיון תורים';
const ARCHIVE_HEADERS = ['ID','שירות','תאריך','שעה','שם לקוחה','טלפון','הערות','סטטוס','משך','נוצר ב'];

function archiveDate(value, tz) {
  return value instanceof Date ? Utilities.formatDate(value, tz, 'yyyy-MM-dd') : String(value || '').trim();
}

function archiveRowValues(row, tz) {
  return row.map((value, index) => {
    if (index === 2) return archiveDate(value, tz);
    if (value instanceof Date) return index === 3
      ? Utilities.formatDate(value, tz, 'HH:mm') : value.toISOString();
    return value;
  });
}

function checkArchiveHeaders(sheet) {
  if (sheet.getLastColumn() !== ARCHIVE_HEADERS.length ||
      JSON.stringify(sheet.getRange(1, 1, 1, 10).getValues()[0]) !== JSON.stringify(ARCHIVE_HEADERS)) {
    throw new Error('Unexpected appointment columns: no rows were removed');
  }
}

function getArchiveSheet(create) {
  if (ARCHIVE_SPREADSHEET_ID === SHEET_ID) throw new Error('Archive must use a separate spreadsheet');
  const ss = SpreadsheetApp.openById(ARCHIVE_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ARCHIVE_TAB_NAME);
  if (!sheet && create) {
    sheet = ss.insertSheet(ARCHIVE_TAB_NAME);
    sheet.getRange(1, 1, 1, 10).setValues([ARCHIVE_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.setRightToLeft(true);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#b76e79').setFontColor('#ffffff');
  }
  if (!sheet) throw new Error('Archive not initialized; run setupAppointmentArchive in the script editor');
  checkArchiveHeaders(sheet);
  return sheet;
}

// Run in the Apps Script editor. Does not move data or install a trigger.
function setupAppointmentArchive() {
  getArchiveSheet(true);
  return previewAppointmentArchive();
}

function archiveCandidates(sheet) {
  checkArchiveHeaders(sheet);
  const tz = 'Asia/Jerusalem';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues() : [];
  const ids = new Set();
  const candidates = [];
  let skipped = 0;
  rows.forEach((raw, index) => {
    const row = archiveRowValues(raw, sheet.getParent().getSpreadsheetTimeZone());
    const id = String(row[0]);
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(row[2])) { skipped++; return; }
    if (ids.has(id)) throw new Error('Duplicate appointment ID in active sheet; no rows removed');
    ids.add(id);
    if (row[2] < today) candidates.push({ rowNumber: index + 2, row });
  });
  return { candidates, skipped, today };
}

function previewAppointmentArchive() {
  const data = archiveCandidates(getSheet());
  const result = { eligible: data.candidates.length, skipped: data.skipped, before: data.today, batchSize: 200 };
  console.log(JSON.stringify(result));
  return result;
}

// Copy, flush, read back and compare before removing any source row.
// A rerun after interruption reuses identical archive IDs without copying twice.
function archivePastAppointments() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const source = getSheet();
    const data = archiveCandidates(source);
    const batch = data.candidates.slice(0, 200);
    if (!batch.length) return { moved: 0, remaining: 0, skipped: data.skipped };
    const target = getArchiveSheet(false);
    const targetRows = target.getLastRow() > 1 ? target.getRange(2, 1, target.getLastRow() - 1, 10).getValues() : [];
    const byId = new Map();
    targetRows.forEach((raw, index) => {
      const row = archiveRowValues(raw, target.getParent().getSpreadsheetTimeZone());
      const id = String(row[0]);
      if (!id || byId.has(id)) throw new Error('Invalid or duplicate archive ID; no source rows removed');
      byId.set(id, { row, rowNumber: index + 2 });
    });
    const additions = [];
    const firstNewRow = target.getLastRow() + 1;
    batch.forEach(item => {
      const id = String(item.row[0]);
      const existing = byId.get(id);
      if (existing && JSON.stringify(existing.row) !== JSON.stringify(item.row)) {
        throw new Error('Archive copy differs from active row; no source rows removed');
      }
      if (!existing) {
        // Avoid interpreting user-entered text as a spreadsheet formula.
        if (item.row.some(value => typeof value === 'string' && value.startsWith('='))) {
          throw new Error('Formula-like text requires review; no source rows removed');
        }
        byId.set(id, { row: item.row, rowNumber: firstNewRow + additions.length });
        additions.push(item.row);
      }
    });
    if (additions.length) {
      const lastNeeded = firstNewRow + additions.length - 1;
      if (lastNeeded > target.getMaxRows()) target.insertRowsAfter(target.getMaxRows(), lastNeeded - target.getMaxRows());
      target.getRange(firstNewRow, 1, additions.length, 10).setValues(additions);
      SpreadsheetApp.flush();
    }
    const verified = target.getRange(2, 1, target.getLastRow() - 1, 10).getValues();
    batch.forEach(item => {
      const position = byId.get(String(item.row[0])).rowNumber - 2;
      const copied = archiveRowValues(verified[position], target.getParent().getSpreadsheetTimeZone());
      if (JSON.stringify(copied) !== JSON.stringify(item.row)) throw new Error('Archive verification failed; source preserved');
    });
    // Descending positions remain valid as rows are removed. Recheck each source.
    for (const item of batch.slice().reverse()) {
      const current = archiveRowValues(source.getRange(item.rowNumber, 1, 1, 10).getValues()[0], source.getParent().getSpreadsheetTimeZone());
      if (JSON.stringify(current) !== JSON.stringify(item.row)) throw new Error('Source changed during archive; stopping');
      source.deleteRow(item.rowNumber);
    }
    const result = { moved: batch.length, remaining: data.candidates.length - batch.length, skipped: data.skipped };
    console.log(JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}

// Explicit activation from the editor after verifying setup and a first batch.
function installAppointmentArchiveTrigger() {
  getArchiveSheet(false);
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'archivePastAppointments');
  if (!exists) ScriptApp.newTrigger('archivePastAppointments').timeBased().atHour(3).everyDays(1).inTimezone('Asia/Jerusalem').create();
}

function queryAppointmentArchive(params) {
  const month = String(params.month || '');
  const query = String(params.query || '').trim().toLowerCase().slice(0, 100);
  const offset = Number(params.offset || 0);
  if ((month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) || !Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid filter');
  const sheet = getArchiveSheet(false);
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues() : [];
  const phoneQuery = query.replace(/\D/g, '');
  const appointments = rows.map(row => archiveRowValues(row, sheet.getParent().getSpreadsheetTimeZone()))
    .filter(row => (!month || row[2].startsWith(month + '-')) && (!query ||
      String(row[4]).toLowerCase().includes(query) || String(row[5]).includes(query) ||
      (phoneQuery && String(row[5]).replace(/\D/g, '').includes(phoneQuery))))
    .sort((a, b) => (String(b[2]) + String(b[3]) + String(b[0])).localeCompare(String(a[2]) + String(a[3]) + String(a[0])));
  return { success: true, total: appointments.length, offset, nextOffset: offset + 50 < appointments.length ? offset + 50 : null,
    appointments: appointments.slice(offset, offset + 50).map(row => ({
      id: String(row[0]), serviceName: String(row[1]), date: String(row[2]), time: String(row[3]),
      clientName: String(row[4]), clientPhone: String(row[5]), notes: String(row[6]), status: String(row[7]),
      duration: Number(row[8]) || 60, createdAt: String(row[9])
    })) };
}

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
  // Serialize writes with the nightly archive job. Reads do not take this lock.
  const reads = ['load', 'loadAll', 'availability', 'bookingStatus', 'loadArchive', 'loadSettings',
    'loadClients', 'lookupClient', 'matchWaitlist', 'loadWaitlist'];
  const action = e.parameter.action || 'load';
  if (reads.includes(action)) return handleGet(e);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return handleGet(e); } finally { lock.releaseLock(); }
}

function handleGet(e) {
  const action   = e.parameter.action   || 'load';
  const callback = e.parameter.callback || null;

  if (action === 'bookingStatus') {
    let result = { success: false, saved: false };
    try {
      const id = String(e.parameter.id || '');
      if (!id || id.length > 150) throw new Error('Invalid booking ID');
      const sheet = getSheet();
      const lastRow = sheet.getLastRow();
      const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 9).getValues() : [];
      const tz = sheet.getParent().getSpreadsheetTimeZone();
      const row = rows.find(r => String(r[0]) === id);
      const date = row && (row[2] instanceof Date ? Utilities.formatDate(row[2], tz, 'yyyy-MM-dd') : String(row[2]).trim());
      const time = row && (row[3] instanceof Date ? Utilities.formatDate(row[3], tz, 'HH:mm') : String(row[3]).trim().padStart(5, '0'));
      const saved = !!(row && String(row[7]) !== 'cancelled' && date === e.parameter.date && time === e.parameter.time
        && (Number(row[8]) || 60) === Number(e.parameter.duration));
      result = { success: true, saved, id };
    } catch (err) { console.warn('Booking verification failed'); }
    const json = JSON.stringify(result);
    return ContentService.createTextOutput(callback ? callback + '(' + json + ')' : json)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'loadArchive') {
    let result;
    try { result = queryAppointmentArchive(e.parameter); }
    catch (err) {
      console.error('Archive read failed', err);
      result = { success: false, error: 'archive_unavailable' };
    }
    const json = JSON.stringify(result);
    return ContentService.createTextOutput(callback ? callback + '(' + json + ')' : json)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

  if (action === 'availability') {
    let result;
    try {
      const month = String(e.parameter.month || '');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
      const sheet = getSheet();
      const tz = sheet.getParent().getSpreadsheetTimeZone();
      const rows = sheet.getLastRow() > 1
        ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues() : [];
      const appointments = [];
      for (const row of rows) {
        if (!row[0] || String(row[7]) === 'cancelled') continue;
        const date = row[2] instanceof Date
          ? Utilities.formatDate(row[2], tz, 'yyyy-MM-dd') : String(row[2]).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid appointment date');
        if (!date.startsWith(month + '-')) continue;
        const time = row[3] instanceof Date
          ? Utilities.formatDate(row[3], tz, 'HH:mm') : String(row[3]).trim().padStart(5, '0');
        const duration = Number(row[8]) || 60;
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || duration <= 0) throw new Error('Invalid appointment time');
        appointments.push({ date, time, duration, status: String(row[7] || 'pending') });
      }
      result = { success: true, month, appointments };
    } catch (err) {
      console.error('Availability load failed', err);
      result = { success: false, error: 'availability_unavailable' };
    }
    const json = JSON.stringify(result);
    return ContentService.createTextOutput(callback ? callback + '(' + json + ')' : json)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }

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
      status: e.parameter.status || 'pending',
      allowOverlap: e.parameter.status === 'confirmed' && e.parameter.allowOverlap === 'true'
    };
    const saveStarted = Date.now();
    const result = saveAppointment(data);
    console.log(JSON.stringify({ metric: 'booking_save_ms', ms: Date.now() - saveStarted }));
    if (result === 'conflict') {
      const json = JSON.stringify({ success: false, conflict: true });
      const out  = callback ? callback + '(' + json + ')' : json;
      return ContentService.createTextOutput(out)
        .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
    }
    // תמיד שמור/עדכן לקוח בטבלת לקוחות
    const clientStarted = Date.now();
    if (data.clientName && data.clientPhone) saveClient(data.clientName, data.clientPhone);
    console.log(JSON.stringify({ metric: 'booking_client_ms', ms: Date.now() - clientStarted }));
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
    const error = JSON.stringify({ success: false, error: 'load_failed' });
    const out = callback ? callback + '(' + error + ')' : error;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
}

function hasConflict(date, time, duration, rows, tz) {
  if (!rows) {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 9).getValues() : [];
    tz = sheet.getParent().getSpreadsheetTimeZone();
  }
  const newStart = timeToMins(time);
  const newEnd   = newStart + (Number(duration) || 60);
  for (const row of rows) {
    const rowDate = row[2] instanceof Date ? Utilities.formatDate(row[2], tz, 'yyyy-MM-dd') : String(row[2]).trim();
    if (rowDate !== String(date)) continue;
    if (String(row[7]) === 'cancelled') continue;
    const rowTime = row[3] instanceof Date ? Utilities.formatDate(row[3], tz, 'HH:mm') : String(row[3]);
    const s = timeToMins(rowTime);
    const e = s + (Number(row[8]) || 60);
    if (newStart < e && newEnd > s) return true;
  }
  return false;
}

// בדיקה למנהל - חוסם אם יש תור confirmed או pending באותה שעה
function hasConfirmedConflict(date, time, duration) {
  return hasConflict(date, time, duration);
}

function timeToMins(t) {
  if (!t || t.includes('1899') || t.includes('T')) {
    const d = new Date(t); return d.getHours() * 60 + d.getMinutes();
  }
  const [h, m] = t.split(':').map(Number); return h * 60 + m;
}

function saveAppointment(data) {
  const readStarted = Date.now();
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 9).getValues() : [];
  const tz = sheet.getParent().getSpreadsheetTimeZone();
  console.log(JSON.stringify({ metric: 'booking_read_ms', ms: Date.now() - readStarted, rows: rows.length }));
  const existing = rows.find(row => String(row[0]) === String(data.id));
  if (existing) {
    const date = existing[2] instanceof Date ? Utilities.formatDate(existing[2], tz, 'yyyy-MM-dd') : String(existing[2]).trim();
    const time = existing[3] instanceof Date ? Utilities.formatDate(existing[3], tz, 'HH:mm') : String(existing[3]).trim().padStart(5, '0');
    // A retry acknowledges the same active booking, never a different/cancelled one.
    if (date !== data.date || time !== data.time || String(existing[7]) === 'cancelled'
        || String(existing[1]) !== String(data.serviceName)
        || String(existing[5]).replace(/\D/g, '').replace(/^0/, '') !== String(data.clientPhone).replace(/\D/g, '').replace(/^0/, '')
        || (Number(existing[8]) || 60) !== (Number(data.duration) || 60)) return 'conflict';
    return;
  }
  if (!(data.status === 'confirmed' && data.allowOverlap === true)
      && hasConflict(data.date, data.time, data.duration, rows, tz)) return 'conflict';

  sheet.appendRow([
    data.id, data.serviceName, data.date, data.time,
    data.clientName, data.clientPhone, data.notes || '',
    data.status || 'pending',
    Number(data.duration) || 60,
    new Date().toLocaleString('he-IL')
  ]);
  SpreadsheetApp.flush();

  const mailStarted = Date.now();
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
  } finally {
    console.log(JSON.stringify({ metric: 'booking_mail_ms', ms: Date.now() - mailStarted }));
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
