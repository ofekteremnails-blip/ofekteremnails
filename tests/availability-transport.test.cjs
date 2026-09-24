const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const source=fs.readFileSync('booking.js','utf8');let requests=0;
 const context=vm.createContext({console,AbortController,setTimeout,clearTimeout,fetch:async(url)=>{requests++;assert.equal(url,'/api/availability?month=2026-09');return {ok:true,status:200,json:async()=>({success:true,month:'2026-09',appointments:[]})};}});
 vm.runInContext(source.slice(source.indexOf('async function fetchMonthAvailability')),context);
 assert.equal((await context.fetchMonthAvailability(2026,8)).length,0);assert.equal(requests,1);
 context.fetch=async()=>({ok:false,status:503});assert.equal(await context.fetchMonthAvailability(2026,8),null);
 context.fetch=async()=>({ok:true,status:200,json:async()=>({success:true,month:'2026-10',appointments:[]})});assert.equal(await context.fetchMonthAvailability(2026,8),null);
 context.fetch=async()=>{throw new DOMException('timeout','AbortError');};assert.equal(await context.fetchMonthAvailability(2026,8),null);
 console.log('PASS same-origin client transport, errors and mismatched month rejection');
})().catch(e=>{console.error(e);process.exitCode=1;});
