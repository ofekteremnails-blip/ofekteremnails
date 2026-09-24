const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let rows=[], reads=0, mails=0, locked=false;
const sheet={getLastRow:()=>rows.length+1,getRange:()=>({getValues(){reads++;return rows.map(r=>r.slice());}}),getParent:()=>({getSpreadsheetTimeZone:()=> 'Asia/Jerusalem'}),appendRow(row){assert(locked);rows.push(row);}};
const context=vm.createContext({Date,console,MailApp:{sendEmail(){assert(locked);mails++;}}, Utilities:{formatDate(date,tz,format){assert.equal(tz,'Asia/Jerusalem');return format==='yyyy-MM-dd'?date.toISOString().slice(0,10):date.toISOString().slice(11,16);}},LockService:{getScriptLock:()=>({waitLock(){assert(!locked);locked=true;},releaseLock(){locked=false;}})},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput:text=>({text,setMimeType(){return this;}})}});
vm.runInContext(fs.readFileSync('apps-script.js','utf8'),context);
context.getSheet=()=>sheet; context.saveClient=()=>{};
const data={id:'a',date:'2026-09-24',time:'10:00',duration:60,serviceName:'Service',clientName:'Test User',clientPhone:'0501234567',status:'pending'};
const save=d=>JSON.parse(context.doGet({parameter:{action:'save',...d}}).text);
assert.equal(save(data).success,true);assert.equal(rows.length,1);assert.equal(mails,1);assert.equal(locked,false);
reads=0;assert.equal(save({...data,id:'b'}).conflict,true);assert.equal(rows.length,1);assert.equal(reads,1);
reads=0;assert.equal(save(data).success,true);assert.equal(rows.length,1);assert.equal(mails,1);assert.equal(reads,1);
assert.equal(save({...data,time:'12:00'}).conflict,true);
rows[0][2]=new Date('2026-09-24T00:00:00Z');rows[0][3]=new Date('1899-12-30T10:00:00Z');
assert.equal(save({...data,id:'c',time:'10:30'}).conflict,true);
assert.equal(save({...data,id:'d',time:'11:00'}).success,true);
rows[0][7]='cancelled';assert.equal(save(data).conflict,true);
assert.equal(save({...data,id:'e'}).success,true);
console.log('PASS locked same-slot saves, single sheet read, retry idempotency, native Date cells, adjacent slots and cancellation');

// Manual override requires both the admin booking status and explicit approval.
context.getOrCreateCalendar=()=>({createEvent(){}});
assert.equal(save({...data,id:'public-override',allowOverlap:'true'}).conflict,true);
assert.equal(save({...data,id:'admin-no-override',status:'confirmed'}).conflict,true);
assert.equal(save({...data,id:'admin-override',status:'confirmed',allowOverlap:'true'}).success,true);
const count=rows.length;
assert.equal(save({...data,id:'admin-override',status:'confirmed',allowOverlap:'true'}).success,true);
assert.equal(rows.length,count);
console.log('PASS explicit admin overlap approval, public rejection and idempotent override retry');
