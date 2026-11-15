// Opens only extension-created, inactive official Usage tabs; no internal API calls.
const MeterPlanSampler=(()=>{
  const jobs=new Map(),inflight=new Map();
  async function sample(org,notBefore=0){
    if(inflight.has(org)){
      const existing=inflight.get(org),result=await existing.promise;
      if(existing.startedAt>=notBefore)return result;
    }
    const work=(async()=>{
      const tab=await chrome.tabs.create({url:'about:blank',active:false});
      const nonce=crypto.randomUUID();let timer;
      try{
        const wait=new Promise(resolve=>{
          jobs.set(tab.id,{org,nonce,resolve});
          timer=setTimeout(()=>resolve({snapshot:null,error:'Usage page timed out'}),23000);
        });
        await chrome.storage.session.set({['meter:probe:'+tab.id]:{org,nonce,created:Date.now()}});
        await chrome.tabs.update(tab.id,{url:'https://claude.ai/settings/usage'});
        return await wait;
      }finally{
        clearTimeout(timer);jobs.delete(tab.id);
        await chrome.storage.session.remove('meter:probe:'+tab.id).catch(()=>{});
        await chrome.tabs.remove(tab.id).catch(()=>{});
      }
    })();
    const entry={promise:work,startedAt:Date.now()};inflight.set(org,entry);
    try{return await work;}finally{if(inflight.get(org)===entry)inflight.delete(org);}
  }
  async function context(tabId){return (await chrome.storage.session.get('meter:probe:'+tabId))['meter:probe:'+tabId]||null;}
  async function accept(tabId,message){
    const job=jobs.get(tabId);if(!job||job.nonce!==message.nonce)throw Error('Unrecognized usage sampler');
    const snapshot=MeterPlan.normalize(message.snapshot,job.org);
    job.resolve({snapshot,error:snapshot?null:String(message.error||'Usage readings unavailable').slice(0,180)});
  }
  // A worker can restart while a helper page loads. Remove only our expired helpers.
  async function cleanup(){
    const items=await chrome.storage.session.get(null);
    for(const [key,entry] of Object.entries(items))if(key.startsWith('meter:probe:')&&!jobs.has(Number(key.slice('meter:probe:'.length)))){
      const id=Number(key.slice('meter:probe:'.length));
      try{const tab=await chrome.tabs.get(id);if(tab.url?.startsWith('https://claude.ai/')||tab.url==='about:blank')await chrome.tabs.remove(id);}catch{}
      await chrome.storage.session.remove(key);
    }
  }
  return {sample,context,accept,cleanup};
})();
