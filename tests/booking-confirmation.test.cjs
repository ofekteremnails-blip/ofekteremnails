const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function run(result){
  let confirmations=0, errors=0, refreshed=0;
  const button={disabled:false,textContent:''};
  const elements={clientName:{value:'Test User'},clientPhone:{value:'0501234567'},clientNotes:{value:''},toStep4:{disabled:false}};
  const context=vm.createContext({Date,selected:{services:[{id:'a',name:'Service',icon:'',duration:60}],date:'2026-09-24',time:'10:00'},document:{querySelector:()=>button,getElementById:id=>elements[id]},generateId:()=> 'id',saveToSheetsWithConflictCheck:(appt,cb)=>cb(result),showFormError:()=>errors++,showStep(){},refreshAvailability:()=>refreshed++,localStorage:{setItem(){}},showClientGreeting(){},scheduleAppointmentReminders(){},sendReminderToSheets(){},showConfirmation:()=>confirmations++,_sheetsAppointments:[]});
  const source=fs.readFileSync('booking-ui.js','utf8');
  vm.runInContext(source.slice(source.indexOf('function submitBooking('),source.indexOf('// ── STEP 5:')),context);
  context.submitBooking({preventDefault(){}});
  return {confirmations,errors,refreshed,button};
}
for(const result of [{success:false,error:'network'},{success:false,error:'timeout'},{success:false,error:'server'}]){
 const r=run(result);assert.equal(r.confirmations,0);assert.equal(r.errors,1);assert.equal(r.button.disabled,false);
}
let r=run({success:false,conflict:true});assert.equal(r.confirmations,0);assert.equal(r.refreshed,1);
r=run({success:true});assert.equal(r.confirmations,1);assert.equal(r.errors,0);
console.log('PASS booking UI confirms only explicit success; failure permits retry; conflict reloads availability');
