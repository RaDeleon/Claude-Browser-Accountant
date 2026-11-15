const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../extension/plan.js'),S=require('../extension/store.js'),C=require('../extension/core.js');
const snap=(org='work',at=1000,s=3,w=19,reset='Resets Sun 12:00 AM')=>({org,observedAt:at,session:{used:s,reset},weekly:{used:w,reset:'Resets Wed 5:00 AM'},secret:'not-stored'});
const options={org:'work',submittedAt:2000,completedAt:3000};
test('separate session and weekly percentage-point changes',()=>{
 const d=P.compare(snap(),snap('work',4000,4,21),options);assert.equal(d.session.change,1);assert.equal(d.weekly.change,2);assert.match(P.format(d),/3% → 4% · \+1 pp/);assert.match(P.format(d),/account-wide/);
});
test('rounded no-change is not presented as no consumption',()=>{
 const d=P.compare(snap(),snap('work',4000),options);assert.equal(d.session.change,0);assert.match(P.format(d),/no visible change/);
});
test('reset boundaries and decreasing allowance invalidate deltas',()=>{
 const d=P.compare(snap(),snap('work',4000,1,19,'Resets Sun 5:00 AM'),options);assert.equal(d.session.change,null);assert.match(P.format(d),/reset\/limit changed/);
 const e=P.compare(snap(),snap('work',4000,2,18),options);assert.equal(e.weekly.change,null);
});
test('missing, late and stale baselines cannot fabricate a prompt delta',()=>{
 assert.equal(P.compare(null,snap('work',4000),options).status,'no-baseline');
 assert.equal(P.compare(snap('work',2500),snap('work',4000),options).status,'stale-baseline');
 assert.equal(P.compare(snap(),snap('work',400000),{...options,submittedAt:350000}).status,'stale-baseline');
 assert.equal(P.compare(snap(),snap('work',2500),options).status,'unavailable');
});
test('invalid or cross-organization readings are rejected and stripped',()=>{
 assert.equal(P.normalize(snap('personal'),'work'),null);
 assert.equal(P.normalize({...snap(),session:{used:101},weekly:null},'work'),null);
 assert.ok(!JSON.stringify(P.normalize(snap(),'work')).includes('not-stored'));
});
test('DOM parser uses labelled meters and their own reset rows, not Fable',()=>{
 const meter=(id,value,reset)=>({getAttribute:k=>({'aria-labelledby':id,'aria-valuenow':String(value)})[k]??null,parentElement:{children:[{textContent:reset}],parentElement:null}});
 const doc={querySelectorAll:()=>[meter('session',4,'Resets Sun 12:00 AM'),meter('weekly',19,'Resets Wed 5:00 AM'),meter('fable',12,'Resets Wed 5:00 AM')],getElementById:id=>({textContent:{session:'Current session',weekly:'All models',fable:'Fable'}[id]})};
 assert.equal(P.readDocument(doc,'work').session.used,4);assert.equal(P.readDocument(doc,'work').weekly.used,19);
});
test('plan states and response comparisons remain isolated and survive a store restart',async()=>{
 const data={},storage={async get(k){return {[k]:data[k]};},async set(o){Object.assign(data,structuredClone(o));}};let h=S.create(storage,C);
 await h({type:'plan-save',org:'work',snapshot:snap()});await h({type:'plan-save',org:'personal',snapshot:snap('personal',1000,72,88)});
 assert.equal((await h({type:'plan-state',org:'work'})).snapshot.session.used,3);
 assert.equal((await h({type:'plan-state',org:'personal'})).snapshot.session.used,72);
 await h({type:'write',org:'work',chat:'chat',record:{id:'r',org:'work',chat:'chat',position:2,model:'opus-5-5',inputTokens:1,outputTokens:1,plan:{state:'checking'}}});
 await h({type:'plan-update',org:'work',chat:'chat',id:'r',plan:{before:snap(),after:snap('work',4000,4,19),submittedAt:2000,completedAt:3000}});
 h=S.create(storage,C);assert.equal((await h({type:'read',org:'work',chat:'chat'})).rows[0].plan.session.change,1);
 await assert.rejects(h({type:'plan-update',org:'personal',chat:'chat',id:'r',plan:{}}),/not found/);
 assert.ok(!JSON.stringify(data).includes('not-stored'));
});
