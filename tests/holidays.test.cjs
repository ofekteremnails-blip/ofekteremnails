const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the same function used by month, week and day views without admin login.
const source = fs.readFileSync(path.join(__dirname, '../admin-ui.js'), 'utf8');
const context = vm.createContext({ Intl, Date });
vm.runInContext(source.slice(source.indexOf('const hebrewDateFormatter'), source.indexOf('function setCalView')), context);
const holiday = context.getHoliday;
// Daytime dates cross-checked against https://www.hebcal.com/holidays/?i=on
const fixtures = {
  '2025-09-22': 'ערב ראש השנה', '2025-09-23': 'ראש השנה',
  '2026-09-11': 'ערב ראש השנה', '2026-09-12': 'ראש השנה',
  '2026-09-13': 'ראש השנה', '2026-09-23': null,
  '2026-09-20': 'ערב יום כיפור', '2026-09-21': 'יום כיפור',
  '2026-09-25': 'ערב סוכות', '2026-09-26': 'סוכות',
  '2026-09-27': 'חול המועד סוכות', '2026-10-02': 'הושענא רבה',
  '2026-10-03': 'שמיני עצרת ושמחת תורה', '2026-10-04': null,
  '2026-04-01': 'ערב פסח', '2026-04-02': 'פסח',
  '2026-04-03': 'חול המועד פסח', '2026-04-08': 'שביעי של פסח',
  '2026-04-09': null, '2026-05-21': 'ערב שבועות', '2026-05-22': 'שבועות',
  '2026-03-03': 'פורים', '2027-03-23': 'פורים', '2027-02-21': null,
  '2025-05-01': 'יום העצמאות', '2025-04-30': 'יום הזיכרון',
  '2026-04-21': 'יום הזיכרון', '2026-04-22': 'יום העצמאות',
  '2026-04-14': 'יום השואה', '2027-05-04': 'יום השואה',
  '2026-12-04': 'ערב חנוכה', '2026-12-05': 'חנוכה',
  '2026-12-12': 'חנוכה', '2026-12-13': null, '2026-12-25': null,
  '2025-01-01': 'חנוכה · ראש השנה האזרחי',
  '2026-01-01': 'ראש השנה האזרחי', '2026-02-30': null, 'invalid': null
};
for (const [date, expected] of Object.entries(fixtures)) assert.equal(holiday(date), expected, date);

// All eight Hanukkah days, including both lengths of Kislev, over multiple years.
for (let year = 2024; year <= 2040; year++) {
  let count = 0;
  for (let date = new Date(Date.UTC(year, 10, 1)); date < new Date(Date.UTC(year + 1, 0, 15)); date.setUTCDate(date.getUTCDate() + 1)) {
    if (holiday(date.toISOString().slice(0, 10))?.startsWith('חנוכה')) count++;
  }
  assert.equal(count, 8, `Hanukkah ${year}`);
}
console.log(`Passed ${Object.keys(fixtures).length} date fixtures and 17 Hanukkah seasons (${process.env.TZ || 'default timezone'}).`);
