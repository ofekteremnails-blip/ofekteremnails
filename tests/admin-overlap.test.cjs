const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function run(approval) {
 let calls=[],prompts=0,closed=0,confirmed=0;
 const elements=Object.fromEntries(Object.entries({addApptDate:'2026-09-24',addApptTime:'10:00',addApptTimeEnd:'11:00',addApptNotes:''}).map(([id,value])=>[id,{value}]));
 const context=vm.createContext({_addApptSubmitting:false,_apptClientMode:'existing',_apptSelectedClient:{name:'Test',phone:'0500000000'},document:{querySelector:()=>({}),getElementById:id=>elements[id]},_getSelectedServices:()=>[{name:'Service',duration:60,icon:''}],generateId:()=> 'same-id',confirm:()=>{prompts++;return approval;},saveToSheetsWithConflictCheck:(a,cb)=>{calls.push({...a});cb(calls.length===1?{conflict:true}:{success:true});},_resetAddApptSubmitButton(){},showToast(){},_loadAdminSlots(){},getAppointments:()=>[],saveAppointments(){},closeAddApptModal:()=>closed++,calView:'week',renderWeekView(){},_showApptConfirmPopup:()=>confirmed++});
 const source=fs.readFileSync('admin-ui.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function submitAddAppt()'),source.indexOf('function _showApptConfirmPopup')),context);
 context.submitAddAppt();return {calls,prompts,closed,confirmed};
}
let result=run(false);assert.equal(result.calls.length,1);assert.equal(result.closed,0);assert.equal(result.confirmed,0);
result=run(true);assert.equal(result.prompts,1);assert.equal(result.calls.length,2);assert.equal(result.calls[1].allowOverlap,true);assert.equal(result.calls[0].id,result.calls[1].id);assert.equal(result.confirmed,1);
console.log('PASS declining overlap cancels save; approval retries same ID and confirms only server success');
