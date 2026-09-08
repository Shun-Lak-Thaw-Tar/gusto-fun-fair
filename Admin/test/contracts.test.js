import test from 'node:test';
import assert from 'node:assert/strict';
import {fromYangonInput,toYangonInput,statuses,api} from '../src/api.js';
test('Myanmar schedule conversion is independent of the computer timezone',()=>{
 assert.equal(fromYangonInput('2026-09-08T09:00'),'2026-09-08T02:30:00.000Z');
 assert.equal(toYangonInput('2026-09-08T02:30:00.000Z'),'2026-09-08T09:00');
});
test('all backend order states remain available, including replacement proofs',()=>{
 assert.equal(statuses.length,9);assert.ok(statuses.includes('PAYMENT_REUPLOAD_REQUESTED'));assert.ok(statuses.includes('PAYMENT_EVIDENCE_EXPIRED'));
});
test('payment review transmits JWT and unchanged proof version; server errors remain visible',async()=>{
 globalThis.sessionStorage={getItem:()=> 'existing-jwt'};
 let request;
 globalThis.fetch=async(url,options)=>{request={url,...options};return {ok:true,status:200,json:async()=>({payment:{status:'APPROVED'}})};};
 await api('/admin/payments/payment-id/review',{method:'PATCH',body:{decision:'APPROVED',proofVersion:3}});
 assert.equal(request.headers.Authorization,'Bearer existing-jwt');assert.deepEqual(JSON.parse(request.body),{decision:'APPROVED',proofVersion:3});
 globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({error:{message:'Proof version has changed'}})});
 await assert.rejects(api('/admin/payments/payment-id/review'),/Proof version has changed/);
});
