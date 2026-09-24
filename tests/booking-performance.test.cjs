const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('booking.js', 'utf8');
function browser() {
  const scripts = [], timers = new Map(); let clock = 100000, timerId = 0;
  class FakeDate extends Date { static now() { return clock; } }
  const context = vm.createContext({ Date: FakeDate, console: {warn(){}}, window: {},
    document: { createElement: () => ({remove(){}}), body: {appendChild(s){scripts.push(s);}} },
    setTimeout(fn, ms){timers.set(++timerId,{fn,ms}); return timerId;}, clearTimeout(id){timers.delete(id);} });
  vm.runInContext("const WEBAPP_URL='https://example.test/exec';" + source.slice(source.indexOf('const pendingBookingIds'), source.indexOf('// מנסה להסיק')) + source.slice(source.indexOf('// Booking availability')), context);
  return {context,scripts, advance(ms){clock+=ms;}, timeout(ms){const item=[...timers.values()].find(t=>t.ms===ms); assert(item); item.fn();}, reply(s,data){context.window[new URL(s.src).searchParams.get('callback')](data);} };
}
(async () => {
  const b = browser(), c = b.context; c.verifyBookingSaved = async () => false; const flush = () => new Promise(resolve => setImmediate(resolve));
  const recovery=browser(); const recoveryPromise=recovery.context.loadMonthAvailability(2026,8);
  recovery.timeout(30000); await Promise.resolve(); assert.equal(recovery.scripts.length,2);
  recovery.reply(recovery.scripts[1],{success:true,month:'2026-09',appointments:[]}); assert.equal((await recoveryPromise).length,0);
  const response = {success:true,month:'2026-09',appointments:[{date:'2026-09-24',time:'10:00',duration:60}]};
  const first=c.loadMonthAvailability(2026,8), second=c.loadMonthAvailability(2026,8);
  assert.equal(b.scripts.length,1); b.reply(b.scripts[0],response);
  const a=await first, d=await second; a[0].duration=999; assert.equal(d[0].duration,60);
  await c.loadMonthAvailability(2026,8); assert.equal(b.scripts.length,1);
  b.advance(20001); const expired=c.loadMonthAvailability(2026,8); assert.equal(b.scripts.length,2);
  b.reply(b.scripts[1],response); await expired;
  c.invalidateAvailability(); const stale=c.loadMonthAvailability(2026,8); c.invalidateAvailability();
  b.reply(b.scripts[2],response); assert.equal(await stale,null);
  const timed=c.loadMonthAvailability(2026,8); b.timeout(30000); await Promise.resolve(); b.timeout(30000); assert.equal(await timed,null);
  const retry=c.loadMonthAvailability(2026,8); b.reply(b.scripts.at(-1),{...response,appointments:[]}); assert.equal((await retry).length,0);
  const appt={id:'one',serviceName:'service',duration:60,date:'2026-09-24',time:'10:00',clientName:'Test User',clientPhone:'0501234567',status:'pending'};
  let results=[]; c.saveToSheetsWithConflictCheck({...appt},r=>results.push(r));
  const request=b.scripts.at(-1); request.onerror(); await flush(); b.reply(request,{success:true});
  assert.equal(results.length,1); assert.equal(results[0].success,false);
  const retried={...appt,id:'new'}; c.saveToSheetsWithConflictCheck(retried,r=>results.push(r));
  assert.equal(retried.id,'one'); b.reply(b.scripts.at(-1),{success:true}); assert.equal(results.at(-1).success,true);
  c.saveToSheetsWithConflictCheck({...appt,id:'other'},r=>results.push(r)); b.timeout(30000); await flush(); assert.equal(results.at(-1).error,'timeout');
  c.saveToSheetsWithConflictCheck({...appt},r=>results.push(r)); b.reply(b.scripts.at(-1),{}); await flush(); assert.equal(results.at(-1).success,false);
  c.saveToSheetsWithConflictCheck({...appt},r=>results.push(r)); b.reply(b.scripts.at(-1),{success:false,conflict:true}); assert.equal(results.at(-1).conflict,true);
  console.log('PASS shared requests, TTL, isolated copies, invalidation, timeout, retry IDs, explicit success, conflict and late responses');
})().catch(e=>{console.error(e);process.exitCode=1;});
