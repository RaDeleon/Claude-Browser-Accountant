const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../extension/core.js'),S=require('../extension/store.js');
function memory(){const data={};return {data,async get(k){return {[k]:structuredClone(data[k])};},async set(obj){await new Promise(r=>setTimeout(r,1));Object.assign(data,structuredClone(obj));}};}
const row=(org='personal',chat='chat1',id='response1')=>({id,org,chat,position:2,model:'sonnet-5-5',inputTokens:10000,outputTokens:2000,time:1});
test('concurrent tabs and replay do not lose or duplicate writes',async()=>{
 const storage=memory(),handle=S.create(storage,C);await Promise.all(Array.from({length:20},(_,n)=>handle({type:'write',org:'work',chat:'chat1',record:row('work','chat1','r'+n)})));
 await handle({type:'write',org:'work',chat:'chat1',record:row('work','chat1','r1')});
 const v=await handle({type:'read',org:'work',chat:'chat1'});assert.equal(v.rows.length,20);assert.equal(C.totals(v.rows,'work','chat1').cost,.8000000000000002);
});
test('personal and work remain separate even when chat IDs are identical',async()=>{
 const storage=memory(),handle=S.create(storage,C);
 await handle({type:'write',org:'personal',chat:'same',record:row('personal','same')});
 await handle({type:'write',org:'work',chat:'same',record:{...row('work','same'),inputTokens:99}});
 assert.equal((await handle({type:'read',org:'personal',chat:'same'})).rows[0].inputTokens,10000);
 assert.equal((await handle({type:'read',org:'work',chat:'same'})).rows[0].inputTokens,99);
 await assert.rejects(handle({type:'write',org:'personal',chat:'same',record:row('work','same')}),/Cross-account/);
});
test('record storage excludes text, cookies, credentials and supplied cost',async()=>{
 const storage=memory(),handle=S.create(storage,C);
 await handle({type:'write',org:'personal',chat:'chat1',record:{...row(),prompt:'PRIVATE_SENTINEL',cookie:'SECRET_SENTINEL',cost:999999,source:'reported'}});
 const value=(await handle({type:'read',org:'personal',chat:'chat1'})).rows[0];
 assert.equal(value.cost,.04);assert.equal(value.source,'visible-text-estimate');assert.ok(!JSON.stringify(storage.data).includes('SENTINEL'));
});
test('pause, labels and service-worker restarts preserve per-org state',async()=>{
 const storage=memory();let handle=S.create(storage,C);
 await handle({type:'configure',org:'work',label:'Work · Example',paused:true});
 await handle({type:'write',org:'work',chat:'chat1',record:row('work')});
 assert.equal((await handle({type:'read',org:'work',chat:'chat1'})).rows.length,0);
 await handle({type:'write',org:'personal',chat:'chat1',record:row()});
 handle=S.create(storage,C);
 assert.equal((await handle({type:'read',org:'personal',chat:'chat1'})).rows.length,1);
 assert.equal((await handle({type:'account',org:'work'})).paused,true);
 assert.equal((await handle({type:'account',org:'personal'})).label,undefined);
});
test('invalid identities, counts and row scopes fail closed',async()=>{
 const handle=S.create(memory(),C);
 await assert.rejects(handle({type:'read',org:'',chat:'chat1'}));
 await assert.rejects(handle({type:'write',org:'personal',chat:'chat1',record:{...row(),outputTokens:-1}}));
 await assert.rejects(handle({type:'write',org:'personal',chat:'chat1',record:{...row(),position:0}}));
 await assert.rejects(handle({type:'write',org:'personal',chat:'chat1',record:{...row(),inputTokens:Infinity}}));
});
