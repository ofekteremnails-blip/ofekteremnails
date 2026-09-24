const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('booking.js','utf8');
function fixture(){
 const scripts=[],timers=new Map();let tid=0;
 const ctx=vm.createContext({Date,console,window:{},getServices:()=>[],stored:[],document:{createElement:()=>({remove(){}}),body:{appendChild:s=>scripts.push(s)}},setTimeout(fn,ms){timers.set(++tid,{fn,ms});return tid;},clearTimeout:id=>timers.delete(id),invalidateAvailability(){}});
 vm.runInContext("const WEBAPP_URL='https://example.invalid/exec';"+source.slice(source.indexOf('const pendingBookingIds'),source.indexOf('function saveClientToSheets'))+'\nfunction saveAppointments(a){appointmentsRevision++;stored=a;}',ctx);
 return {ctx,scripts,fire(ms){const t=[...timers.values()].find(t=>t.ms===ms);assert(t);return t.fn();},reply(s,data){ctx.window[new URL(s.src).searchParams.get('callback')](data);}};
}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const f=fixture(),appt={id:'id',date:'2026-09-24',time:'10:00',duration:60,status:'confirmed'};let results=[];
 f.ctx.saveToSheetsWithConflictCheck(appt,r=>results.push(r));const save=f.scripts[0];f.fire(10000);
 assert(new URL(f.scripts[1].src).searchParams.get('action')==='bookingStatus');
 f.reply(f.scripts[1],{success:true,saved:true,id:'id'});await flush();assert.equal(results.length,1);assert.equal(results[0].verified,true);
 f.reply(save,{success:true});assert.equal(results.length,1);
 const g=fixture();results=[];g.ctx.saveToSheetsWithConflictCheck(appt,r=>results.push(r));g.fire(30000);
 g.reply(g.scripts[1],{success:true,saved:true,id:'different'});await flush();assert.equal(results[0].success,false);
 const h=fixture();results=[];h.ctx.saveToSheetsWithConflictCheck(appt,r=>results.push(r));h.fire(30000);h.reply(h.scripts[0],{success:true});h.reply(h.scripts[1],{success:false});await flush();assert.equal(results.length,1);assert.equal(results[0].success,true);
 const l=fixture();let load=l.ctx.loadFromSheets();l.ctx.saveAppointments([{id:'new'}]);l.reply(l.scripts[0],[]);assert.equal(await load,null);assert.equal(l.ctx.stored[0].id,'new');
 const old=l.ctx.loadFromSheets(),latest=l.ctx.loadFromSheets();l.reply(l.scripts.at(-1),[]);assert.equal((await latest).length,0);l.reply(l.scripts.at(-2),[{ID:'stale','תאריך':'2026-09-24','שעה':'10:00'}]);assert.equal(await old,null);assert.equal(l.ctx.stored.length,0);
 load=l.ctx.loadFromSheets();const slow=l.scripts.at(-1);l.fire(30000);assert.equal(await load,null);l.reply(slow,[]);assert.equal(l.ctx.stored.length,0);
 console.log('PASS verification before delayed acknowledgement, mismatched ID rejection, late success, refresh races, genuine empty data and timed-out callbacks');
 const admin=fs.readFileSync('admin-ui.js','utf8');let refreshed=0,toasts=[];
 const c=vm.createContext({loadFromSheets:async()=>null,showMiniLoader(){},hideMiniLoader(){},_renderDashboard(){},refreshCurrentPanel(){refreshed++;},showToast:m=>toasts.push(m)});
 vm.runInContext(admin.slice(admin.indexOf('let adminSyncInProgress'),admin.indexOf('function refreshCurrentPanel')),c);
 await c.syncSheets();assert.equal(refreshed,0);assert(!toasts[0].includes('בהצלחה'));
 c.loadFromSheets=async()=>[];await c.syncSheets();assert.equal(refreshed,1);assert(toasts.at(-1).includes('בהצלחה'));
 console.log('PASS refresh updates active panel only after successful data retrieval');
})().catch(e=>{console.error(e);process.exitCode=1;});
