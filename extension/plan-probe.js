(async()=>{
  'use strict';
  if(location.hostname!=='claude.ai'||window!==window.top)return;
  const send=async m=>{const r=await chrome.runtime.sendMessage(m);if(!r?.ok)throw Error(r?.error||'Plan sampler unavailable');return r.value;};
  let context;try{context=await send({type:'plan-probe-context'});}catch{return;}
  if(!context)return;
  let finished=false,observer,timer;
  async function finish(snapshot,error){
    if(finished)return;finished=true;observer?.disconnect();clearTimeout(timer);
    try{await send({type:'plan-probe-result',nonce:context.nonce,snapshot,error});}catch{}
  }
  function inspect(){
    let org;try{org=decodeURIComponent(document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]*)/)?.[1]||'');}catch{return;}
    if(org&&org!==context.org){finish(null,'Organization changed; sample discarded');return;}
    if(org!==context.org)return;
    if(!location.pathname.includes('/settings/usage')&&!location.hash.includes('settings/usage'))return;
    const snapshot=MeterPlan.readDocument(document,org);
    if(snapshot?.session&&snapshot?.weekly)finish(snapshot,null);
  }
  observer=new MutationObserver(inspect);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-valuenow']});
  timer=setTimeout(()=>finish(null,'Official usage page did not provide both readings'),18000);
  inspect();
})();
