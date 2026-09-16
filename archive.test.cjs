const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const headers = ['ID','שירות','תאריך','שעה','שם לקוחה','טלפון','הערות','סטטוס','משך','נוצר ב'];
const row = (id, date, name = 'לקוחה לדוגמה') => [id, 'טיפול', date, '10:00', name, '0501234567', '', 'completed', 60, '2026-01-01'];

function fixture(activeRows, archiveRows = [], options = {}) {
  let deleted = 0, writes = 0, locked = false;
  class Sheet {
    constructor(rows) { this.rows = [headers.slice(), ...rows.map(r => r.slice())]; }
    getLastRow() { return this.rows.length; }
    getLastColumn() { return this.rows[0].length; }
    getMaxRows() { return 10000; }
    getParent() { return { getSpreadsheetTimeZone: () => 'Asia/Jerusalem' }; }
    getRange(r, c, nr = 1, nc = 1) {
      const self = this;
      return {
        getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => self.rows[r - 1 + i]?.[c - 1 + j] ?? '')); },
        setValues(values) {
          assert(locked, 'copy must be locked');
          writes++;
          if (options.failWrite) throw new Error('write failed');
          values.forEach((v, i) => { self.rows[r - 1 + i] = v.slice(); });
          if (options.corruptWrite) self.rows[r - 1][4] = 'corrupt';
        }
      };
    }
    deleteRow(r) {
      assert(locked, 'deletion must be locked');
      if (options.interruptDelete && deleted === 1) throw new Error('interrupted');
      deleted++; this.rows.splice(r - 1, 1);
    }
  }
  const active = new Sheet(activeRows), archive = new Sheet(archiveRows);
  const context = {
    console: { log() {}, error() {} }, Date, Map, Set,
    Utilities: { formatDate: (date, tz, format) => format === 'yyyy-MM-dd' ? '2026-09-15' : '10:00' },
    SpreadsheetApp: {
      openById: id => ({ getSheetByName: () => id.startsWith('1fQu') ? archive : active }),
      flush: () => { if (options.failFlush) throw new Error('flush failed'); }
    },
    LockService: { getScriptLock: () => ({ waitLock() { locked = true; }, releaseLock() { locked = false; } }) }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script.js', 'utf8'), context);
  return { context, active, archive, stats: () => ({ deleted, writes, locked }) };
}

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
test('moves only dates before today; all statuses and every field survive', () => {
  const old = row('old', '2026-09-14'); old[6] = 'הערה'; old[7] = 'pending';
  const f = fixture([old, row('today', '2026-09-15'), row('future', '2026-09-16'), row('bad', '')]);
  const result = f.context.archivePastAppointments();
  assert.equal(result.moved, 1); assert.equal(result.skipped, 1);
  assert.deepEqual(f.archive.rows[1], old);
  assert.deepEqual(f.active.rows.slice(1).map(r => r[0]), ['today', 'future', 'bad']);
  assert.equal(f.stats().locked, false);
  assert.equal(f.context.archivePastAppointments().moved, 0);
});
test('preview does not mutate either spreadsheet', () => {
  const f = fixture([row('old', '2026-01-01')]);
  assert.equal(f.context.previewAppointmentArchive().eligible, 1);
  assert.deepEqual(f.stats(), { deleted: 0, writes: 0, locked: false });
});
for (const option of ['failWrite', 'corruptWrite', 'failFlush']) test(option + ' preserves source', () => {
  const f = fixture([row('old', '2026-01-01')], [], { [option]: true });
  assert.throws(() => f.context.archivePastAppointments());
  assert.equal(f.active.rows.length, 2); assert.equal(f.stats().deleted, 0); assert.equal(f.stats().locked, false);
});
test('existing identical archive row is reused without duplicate copy', () => {
  const old = row('old', '2026-01-01');
  const f = fixture([old], [old]);
  assert.equal(f.context.archivePastAppointments().moved, 1);
  assert.equal(f.archive.rows.length, 2); assert.equal(f.stats().writes, 0);
});
test('conflicting duplicate ID prevents all source deletion', () => {
  const f = fixture([row('old', '2026-01-01')], [row('old', '2026-01-01', 'different')]);
  assert.throws(() => f.context.archivePastAppointments()); assert.equal(f.stats().deleted, 0);
});
test('interrupted delete can resume without duplicates', () => {
  const options = { interruptDelete: true };
  const f = fixture([row('a', '2026-01-01'), row('b', '2026-02-01')], [], options);
  assert.throws(() => f.context.archivePastAppointments());
  assert.equal(f.archive.rows.length, 3);
  options.interruptDelete = false;
  f.context.archivePastAppointments();
  assert.equal(f.active.rows.length, 1); assert.equal(f.archive.rows.length, 3);
});
test('batch bounds and reruns preserve all records', () => {
  const f = fixture(Array.from({ length: 205 }, (_, i) => row('id' + i, '2026-01-01')));
  assert.equal(f.context.archivePastAppointments().remaining, 5);
  assert.equal(f.context.archivePastAppointments().moved, 5);
  assert.equal(f.archive.rows.length, 206); assert.equal(f.active.rows.length, 1);
});
test('changed headers and formula-like text cannot be deleted', () => {
  const f = fixture([row('a', '2026-01-01')]);
  f.active.rows[0].push('extra');
  assert.throws(() => f.context.archivePastAppointments());
  f.active.rows[0].pop(); f.active.rows[1][6] = '=1+1';
  assert.throws(() => f.context.archivePastAppointments()); assert.equal(f.stats().deleted, 0);
});
test('archive supports month/name/phone filtering, stable ordering and pagination', () => {
  const rows = Array.from({ length: 55 }, (_, i) => row(String(i).padStart(3, '0'), '2026-08-01'));
  const f = fixture([], [...rows, row('sept', '2026-09-01', 'אופק')]);
  const first = f.context.queryAppointmentArchive({ month: '2026-08' });
  assert.equal(first.total, 55); assert.equal(first.appointments.length, 50); assert.equal(first.nextOffset, 50);
  const second = f.context.queryAppointmentArchive({ month: '2026-08', offset: '50' });
  assert.equal(second.appointments.length, 5); assert.equal(second.nextOffset, null);
  assert.equal(new Set([...first.appointments, ...second.appointments].map(a => a.id)).size, 55);
  assert.equal(f.context.queryAppointmentArchive({ query: 'אופק' }).total, 1);
  assert.equal(f.context.queryAppointmentArchive({ query: '050-123-4567' }).total, 56);
  assert.equal(f.context.queryAppointmentArchive({ query: 'missing' }).total, 0);
  assert.throws(() => f.context.queryAppointmentArchive({ month: '2026-13' }));
});
test('availability and ordinary load never open archive spreadsheet', () => {
  const f = fixture([]);
  const originalOpen = f.context.SpreadsheetApp.openById;
  f.context.SpreadsheetApp.openById = id => { assert(!id.startsWith('1fQu')); return originalOpen(id); };
  f.context.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => text }) };
  assert.equal(JSON.parse(f.context.doGet({ parameter: { action: 'availability', month: '2026-09' } })).success, true);
  assert.deepEqual(JSON.parse(f.context.doGet({ parameter: { action: 'load' } })), []);
});
console.log(`${checks} archive tests passed`);
