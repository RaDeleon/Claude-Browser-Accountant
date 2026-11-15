(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MeterStore=api;})(globalThis,()=>{
  'use strict';
  const P=typeof module==='object'&&module.exports?require('./plan.js'):globalThis.MeterPlan;
  const part=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
  function scope(org,chat){if(!part(org)||!part(chat))throw Error('Missing valid organization/chat identity');return 'meter:v1:chat:'+org+':'+chat;}
  function account(org){if(!part(org))throw Error('Missing organization identity');return 'meter:v1:org:'+org;}
  function planComparison(raw,org){
    if(!raw)return null;
    if(raw.state==='checking')return {status:'checking'};
    if(!Number.isFinite(raw.submittedAt)||!Number.isFinite(raw.completedAt)||raw.completedAt<raw.submittedAt)return {status:'unavailable'};
    return P.compare(raw.before,raw.after,{org,submittedAt:raw.submittedAt,completedAt:raw.completedAt});
  }
  function validate(r,C){
    scope(r.org,r.chat);
    if(!part(r.id)||!Number.isSafeInteger(r.inputTokens)||!Number.isSafeInteger(r.outputTokens)||r.inputTokens<0||r.outputTokens<0||r.inputTokens>1e9||r.outputTokens>1e9)throw Error('Invalid usage record');
    if(!Number.isSafeInteger(r.position)||r.position<1||r.position>1e7)throw Error('Invalid response position');
    const model=C.modelKey(r.model)||'unknown';
    const counts={input:r.inputTokens,output:r.outputTokens,reads:0,write5:0,write1:0};
    // Only numbers, opaque IDs and rate metadata cross the storage boundary.
    return {id:r.id,org:r.org,chat:r.chat,position:r.position,model,inputTokens:r.inputTokens,outputTokens:r.outputTokens,
      tokens:r.inputTokens+r.outputTokens,cost:C.cost(model,counts),source:'visible-text-estimate',rateDate:C.rateDate,
      turnKey:typeof r.turnKey==='string'&&/^[a-zA-Z0-9_-]{1,180}$/.test(r.turnKey)?r.turnKey:null,
      plan:planComparison(r.plan,r.org),status:r.status==='stopped'?'stopped':'complete',time:Number.isFinite(r.time)?r.time:Date.now()};
  }
  function create(storage,C){
    let queue=Promise.resolve();
    return function request(m){
      const task=queue.then(async()=>{
        const a=account(m.org),accountData=(await storage.get(a))[a]||{};
        if(m.type==='account')return accountData;
        const pk='meter:v1:plan:'+m.org;
        if(m.type==='plan-state')return (await storage.get(pk))[pk]||{snapshot:null,error:null};
        if(m.type==='plan-save'){
          const previous=(await storage.get(pk))[pk]||{};
          const snapshot=P.normalize(m.snapshot,m.org);
          const next={snapshot:snapshot||previous.snapshot||null,error:snapshot?null:String(m.error||'Plan usage unavailable').slice(0,180),checkedAt:Date.now()};
          await storage.set({[pk]:next});return next;
        }
        if(m.type==='configure'){
          const next={label:typeof m.label==='string'?m.label.trim().slice(0,60):accountData.label||'',paused:typeof m.paused==='boolean'?m.paused:!!accountData.paused,
            planEnabled:typeof m.planEnabled==='boolean'?m.planEnabled:accountData.planEnabled!==false};
          await storage.set({[a]:next});return next;
        }
        const k=scope(m.org,m.chat),rows=(await storage.get(k))[k]||[];
        const clean=rows.filter(r=>r.org===m.org&&r.chat===m.chat);
        if(m.type==='read')return {rows:clean,account:accountData};
        if(m.type==='plan-update'){
          const index=clean.findIndex(r=>r.id===m.id);if(index<0)throw Error('Response not found in this organization/chat');
          clean[index]={...clean[index],plan:planComparison(m.plan,m.org)};
          await storage.set({[k]:clean});return {rows:clean,account:accountData};
        }
        if(m.type==='write'){
          if(accountData.paused)return {rows:clean,account:accountData,paused:true};
          const row=validate(m.record,C);
          if(row.org!==m.org||row.chat!==m.chat)throw Error('Cross-account write rejected');
          const next=C.upsert(clean,row);await storage.set({[k]:next});return {rows:next,account:accountData};
        }
        throw Error('Unknown meter operation');
      });
      queue=task.catch(()=>{});return task;
    };
  }
  return {scope,account,validate,create};
});
