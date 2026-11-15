importScripts('core.js','plan.js','store.js','plan-sampler.js');
const handleMeter=MeterStore.create(chrome.storage.local,ClaudeMeterCore);
// Keep the journal in the extension's trusted context, rather than website localStorage.
const ready=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
MeterPlanSampler.cleanup().catch(()=>{});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  const ownPage=sender.url?.startsWith(chrome.runtime.getURL(''));
  const claudePage=sender.frameId===0&&sender.tab?.url?.startsWith('https://claude.ai/');
  if(!ownPage&&!claudePage){reply({ok:false,error:'Unsupported sender'});return false;}
  if(!m||!['read','write','account','configure','plan-state','plan-save','plan-sample','plan-probe-context','plan-probe-result','plan-update'].includes(m.type))return false;
  ready.then(async()=>{
    if(m.type==='plan-probe-context')return claudePage?await MeterPlanSampler.context(sender.tab.id):null;
    if(m.type==='plan-probe-result'){
      if(!claudePage)throw Error('Invalid usage-page sender');
      await MeterPlanSampler.accept(sender.tab.id,m);return {accepted:true};
    }
    if(m.type==='plan-save')throw Error('Plan samples must come from an extension-created usage page');
    if(m.type==='plan-sample'){
      const account=await handleMeter({type:'account',org:m.org});
      if(account.paused||account.planEnabled===false)return {snapshot:null,error:'Plan sampling paused for this organization'};
      const result=await MeterPlanSampler.sample(m.org,Number.isFinite(m.notBefore)?m.notBefore:0);
      await handleMeter({type:'plan-save',org:m.org,...result});return result;
    }
    return await handleMeter(m);
  }).then(value=>{
    reply({ok:true,value});
    if(['write','configure','plan-update','plan-sample'].includes(m.type))chrome.tabs.query({url:'https://claude.ai/*'}).then(tabs=>{
      for(const tab of tabs)chrome.tabs.sendMessage(tab.id,{type:'meter-changed',org:m.org}).catch(()=>{});
    }).catch(()=>{});
  }).catch(e=>reply({ok:false,error:String(e.message||e)}));
  return true;
});
