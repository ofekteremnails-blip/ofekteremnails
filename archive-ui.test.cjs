const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const nodes = new Map(), scripts = [], timers = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', disabled: false, innerHTML: '', textContent: '', handlers: {},
      addEventListener(type, handler) { this.handlers[type] = handler; }, setAttribute(key, value) { this[key] = value; } });
    return nodes.get(id);
  };
  const context = {
    WEBAPP_URL: 'https://example.test/exec', window: {}, console,
    sanitize: str => String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {},
    document: { getElementById: node, addEventListener: (event, cb) => cb(),
      createElement: () => ({ remove() { this.removed = true; } }), body: { appendChild: s => scripts.push(s) } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('admin-archive.js', 'utf8'), context);
  const respond = data => context.window[new URL(scripts.at(-1).src).searchParams.get('callback')](data);
  return { context, node, scripts, timers, respond };
}
const appointment = { id: 'a', clientName: '<img onerror=alert(1)>', clientPhone: '0501234567', date: '2026-08-01', time: '10:00', serviceName: 'טיפול', status: 'completed', notes: '<script>bad</script>', duration: 60 };
(async () => {
  const f = setup();
  assert.equal(f.scripts.length, 0, 'no archive requests at startup');
  const pending = f.context.showArchivePage(0, { query: 'שם & טלפון', month: '2026-08' });
  assert.equal(f.node('archiveSearchButton').disabled, true);
  const request = new URL(f.scripts[0].src);
  assert.equal(request.searchParams.get('query'), 'שם & טלפון');
  f.respond({ success: true, appointments: [appointment], total: 51, offset: 0, nextOffset: 50 });
  await pending;
  assert.equal(f.node('archiveNext').disabled, false);
  assert.equal(f.node('archivePrevious').disabled, true);
  assert(!f.node('archiveList').innerHTML.includes('<script>'));
  assert(!f.node('archiveList').innerHTML.includes('<img'));
  assert(!f.node('archiveList').innerHTML.includes('onclick='));
  assert.equal(f.scripts[0].removed, true);
  const empty = f.context.showArchivePage(0);
  f.respond({ success: true, appointments: [], total: 0, offset: 0, nextOffset: null }); await empty;
  assert(f.node('archiveStatus').textContent.includes('לא נמצאו'));
  assert.equal(f.node('archiveNext').disabled, true);
  const failed = f.context.showArchivePage(0);
  f.respond({ success: false }); await failed;
  assert(f.node('archiveStatus').textContent.includes('לא הצלחנו'));
  assert.equal(f.node('archiveSearchButton').disabled, false);
  const invalid = f.context.showArchivePage(0);
  f.respond({ success: true, appointments: [null], total: 1, offset: 0, nextOffset: null }); await invalid;
  assert(f.node('archiveStatus').textContent.includes('לא הצלחנו'));
  const timeout = f.context.showArchivePage(0);
  f.timers.filter(t => t.delay === 25000).at(-1).fn(); await timeout;
  assert.equal(f.node('archiveList')['aria-busy'], 'false');
  assert.equal(f.node('archiveSearchButton').disabled, false);
  f.respond({ success: true, appointments: [appointment], total: 1, offset: 0, nextOffset: null });
  assert(f.node('archiveStatus').textContent.includes('לא הצלחנו'), 'late JSONP response is ignored');
  console.log('PASS archive UI: lazy loading, filters, paging, escaped read-only cards, empty/error/invalid/timeout and late response');
})().catch(error => { console.error(error); process.exitCode = 1; });
