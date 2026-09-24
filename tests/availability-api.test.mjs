import assert from 'node:assert/strict';
import handler from '../api/availability.mjs';
const originalFetch=globalThis.fetch;
let calls=0;
const valid={success:true,month:'2026-09',appointments:[{date:'2026-09-24',time:'10:00',duration:60,status:'pending',clientName:'PRIVATE',clientPhone:'PRIVATE'}]};
async function request(query={month:'2026-09'}, method='GET') {
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await handler({query,method},res);return res;
}
try {
 globalThis.fetch=async(url,options)=>{calls++;assert(url.includes('?action=availability&month=2026-09'));assert.equal(options.cache,'no-store');return {ok:true,json:async()=>valid};};
 let result=await request();assert.equal(result.code,200);assert.equal(result.headers['Cache-Control'],'no-store');assert(!JSON.stringify(result.body).includes('PRIVATE'));assert.equal(calls,1);
 assert.equal((await request({month:'2026-13'})).code,400);assert.equal((await request({month:['2026-09']})).code,400);assert.equal((await request({},'POST')).code,405);assert.equal(calls,1);
 calls=0;globalThis.fetch=async()=>++calls===1?{ok:false,status:404}:{ok:true,json:async()=>valid};
 assert.equal((await request()).code,200);assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({...valid,month:'2026-10'})};};
 assert.equal((await request()).code,503);assert.equal(calls,2);
 globalThis.fetch=async()=>({ok:true,json:async()=>({...valid,appointments:[]})});assert.deepEqual((await request()).body.appointments,[]);
 calls=0;globalThis.fetch=async()=>{calls++;throw new DOMException('Timeout','AbortError');};assert.equal((await request()).code,503);assert.equal(calls,2);
 console.log('PASS proxy validation, method restrictions, private field filtering, 404 retry, timeout, empty month and fail-closed errors');
} finally {globalThis.fetch=originalFetch;}
