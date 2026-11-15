(() => {
  'use strict';
  if(location.hostname!=='claude.ai'||window!==window.top||globalThis.__claudeBrowserMeter)return;
  const C=globalThis.ClaudeMeterCore,P=globalThis.MeterPlan;
  const instance={version:'1.1.1',captures:0,error:null};globalThis.__claudeBrowserMeter=instance;
  const DETAILS='Estimated from visible conversation text (UTF-8 bytes ÷ 4). Input includes rendered history again for each response. Hidden instructions, unrendered history, files/images, hidden thinking/tool activity and cache behavior are unknown. Standard API list prices; not subscription billing. Totals begin when tracking starts.';
  let active='',scope=null,rows=[],account={},pending=null,scheduled=false,reading=false,generation=0;
  let planState={snapshot:null,error:null},sampling=null,lastSampleStart=0,didPrefetch=false;
  let domArmed=false,highestUserPosition=0;
  const chatSurface=()=>/^\/(chat\/|new(?:\/|$))/.test(location.pathname)&&!location.hash.includes('settings/');
  const roots=()=>[...document.querySelectorAll('[role="feed"] [role="article"],article[data-message-author-role], [data-testid="assistant-message"], [data-testid="user-message"]')].filter((e,i,a)=>!a.some((x,j)=>i!==j&&x.contains(e)));
  const heading=e=>e.querySelector('h3,[role="heading"]')?.textContent||'';
  const assistant=e=>/^(Claude responded|Assistant)/i.test(heading(e))||e.matches('[data-message-author-role="assistant"],[data-testid="assistant-message"]');
  const turnKey=e=>e.getAttribute('data-turn-key')||e.querySelector('[data-turn-key]')?.getAttribute('data-turn-key')||null;
  function text(e){const x=e.cloneNode(true);const h=x.querySelector('h3,[role="heading"]');if(h&&/^(Claude responded|You said|Assistant|User)/i.test(h.textContent))h.remove();x.querySelectorAll('[data-cam],[role="toolbar"],time,[role="status"],button').forEach(n=>n.remove());return x.textContent||'';}
  function identity(){
    let org;try{org=decodeURIComponent(document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]*)/)?.[1]||'');}catch{return null;}
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(org))return null;
    return {org,chat:location.pathname.match(/^\/chat\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]||null};
  }
  function model(){
    const b=document.querySelector('button[aria-label^="Model:"]');
    if(b)return C.modelKey(b.getAttribute('aria-label'))||'unknown';
    const candidate=[...document.querySelectorAll('button')].find(b=>C.modelKey(b.textContent)&&/model|Opus|Sonnet|Haiku|Fable|Mythos/i.test(b.textContent));
    return C.modelKey(candidate?.textContent)||'unknown';
  }
  async function request(m){const r=await chrome.runtime.sendMessage(m);if(!r?.ok)throw Error(r?.error||'Extension unavailable; reload this tab');return r.value;}
  const fmt=n=>n.toLocaleString(),money=n=>n===null?'unpriced':'$'+n.toFixed(5);
  function label(o){return account.label||'Organization '+o.slice(0,8);}
  function streaming(){return !!document.querySelector('[aria-label="Currently streaming message"],button[aria-label="Stop response"],button[aria-label="Stop Response"],[data-is-streaming="true"]')||[...document.querySelectorAll('button')].some(b=>/^(Stop response|Stop Response)$/.test(b.textContent?.trim()||''));}
  function clear(){document.querySelectorAll('[data-cam="footer"]').forEach(e=>e.remove());rows=[];account={};planState={snapshot:null,error:null};lastSampleStart=0;didPrefetch=false;domArmed=false;highestUserPosition=0;}
  async function samplePlan(org,notBefore=0){
    lastSampleStart=Date.now();
    const work=request({type:'plan-sample',org,notBefore});sampling=work;
    try{const result=await work;if(identity()?.org===org){planState={snapshot:P.normalize(result.snapshot,org)||planState.snapshot,error:result.error};render();}return result;}
    catch(e){if(identity()?.org===org){planState.error=e.message;render();}return {snapshot:null,error:e.message};}
    finally{if(sampling===work)sampling=null;}
  }
  async function refresh(){
    const next=identity(),k=next?next.org+':'+(next.chat||'new'):'';
    if(k!==active){
      // Carry a new-chat submission only into its first assigned chat ID in the same org.
      if(pending&&(pending.org!==next?.org||(pending.chat&&pending.chat!==next?.chat)))pending=null;
      active=k;scope=next;clear();generation++;
    }
    if(!next||reading)return;
    const g=generation;reading=true;
    try{const [value,plan]=await Promise.all([request(next.chat?{type:'read',...next}:{type:'account',org:next.org}),request({type:'plan-state',org:next.org})]);if(g===generation){if(next.chat){rows=value.rows;account=value.account;}else account=value;planState=plan;instance.error=null;}}
    catch(e){instance.error=e.message;}finally{reading=false;if(g!==generation)schedule();}
  }
  function startSubmission(retryTarget=null){
    const i=identity();if(!i||account.paused)return;
    if(pending&&Date.now()-pending.created<500)return;
    const all=roots();let inputText,before=all.length;
    if(retryTarget){
      const index=all.findIndex(el=>el===retryTarget||el.contains(retryTarget));if(index<0)return;
      inputText=all.slice(0,index+(assistant(retryTarget)?0:1)).map(text).join('\n');
    }else{
      const box=document.querySelector('[contenteditable="true"][role="textbox"],textarea');
      const prompt=box?.innerText||box?.value||'';if(!prompt.trim())return;
      inputText=all.map(text).join('\n')+'\n'+prompt;
    }
    pending={id:crypto.randomUUID(),...i,created:Date.now(),inputTokens:C.estimate(inputText),model:model(),before,
      planBefore:P.normalize(planState.snapshot,i.org),planEnabled:account.planEnabled!==false,
      retry:!!retryTarget,sawStreaming:false,stopped:false,committing:false};
  }
  function armDomObserver(){
    if(domArmed)return;
    highestUserPosition=Math.max(0,...roots().map((el,n)=>/^You said:/i.test(heading(el))||el.matches('[data-testid="user-message"]')?Number(el.getAttribute('aria-posinset'))||n+1:0));
    domArmed=true;
  }
  function observeNewUserMessage(){
    if(!domArmed)return;
    const i=identity();if(!i||i.org!==scope?.org||(scope.chat&&scope.chat!==i.chat))return;
    const all=roots();
    for(let n=0;n<all.length;n++){
      const el=all[n],user=/^You said:/i.test(heading(el))||el.matches('[data-testid="user-message"],[data-message-author-role="user"]');
      const position=Number(el.getAttribute('aria-posinset'))||n+1;
      if(!user||position<=highestUserPosition||!text(el).trim())continue;
      highestUserPosition=position;
      if(pending||account.paused)return;
      pending={id:crypto.randomUUID(),...i,created:Date.now(),inputTokens:C.estimate(all.slice(0,n+1).map(text).join('\n')),model:model(),before:n+1,
        planBefore:P.normalize(planState.snapshot,i.org),planEnabled:account.planEnabled!==false,retry:false,sawStreaming:streaming(),stopped:false,committing:false};
    }
  }
  async function commit(){
    const p=pending,i=identity();if(!p||p.committing||!i?.chat)return;
    if(p.org!==i.org||(p.chat&&p.chat!==i.chat)){pending=null;return;}
    if(streaming()){p.sawStreaming=true;return;}
    const all=roots(),last=all.at(-1);
    if(!last||!assistant(last)||!text(last).trim())return;
    if(p.retry?!p.sawStreaming:all.length<=p.before)return;
    const position=Number(last.getAttribute('aria-posinset'))||all.length;
    const completedAt=Date.now();
    const r={id:p.id,org:p.org,chat:i.chat,position,turnKey:turnKey(last),model:p.model,inputTokens:p.inputTokens,
      outputTokens:C.estimate(text(last)),status:p.stopped?'stopped':'complete',time:completedAt,
      plan:p.planEnabled?{state:'checking'}:null};
    p.committing=true;
    try{
      const result=await request({type:'write',org:r.org,chat:r.chat,record:r});
      if(pending===p)pending=null;
      if(identity()?.org===r.org&&identity()?.chat===r.chat){rows=result.rows;account=result.account;instance.captures++;instance.error=null;render();}
      if(p.planEnabled&&!result.paused)finishPlan(r,p.planBefore,p.created,completedAt);
    }catch(e){p.committing=false;instance.error=e.message;render();}
  }
  async function finishPlan(r,before,submittedAt,completedAt){
    await new Promise(resolve=>setTimeout(resolve,1500));
    const result=await samplePlan(r.org,completedAt);
    try{const saved=await request({type:'plan-update',org:r.org,chat:r.chat,id:r.id,plan:{before,after:result.snapshot,submittedAt,completedAt}});
      if(identity()?.org===r.org&&identity()?.chat===r.chat){rows=saved.rows;render();}
    }catch(e){instance.error=e.message;render();}
  }
  function render(){
    if(!document.body)return;
    const i=identity();
    let host=document.getElementById('claude-api-meter');
    if(!host){host=document.createElement('div');host.id='claude-api-meter';host.dataset.cam='panel';host.style.cssText='position:relative;margin-left:8px;z-index:100;font:12px/1.5 system-ui;max-width:min(450px,55vw);flex-shrink:1';
      const shadow=host.attachShadow({mode:'open'});
      shadow.innerHTML='<style>details{color:#f1eadf;font-size:11px}summary{cursor:pointer;list-style:none;font-weight:600;background:#25241ff5;border:1px solid #8f8272;border-radius:9px;padding:7px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}aside{position:absolute;right:0;top:100%;width:min(430px,85vw);box-sizing:border-box;background:#25241ff5;border:1px solid #8f8272;border-radius:9px;box-shadow:0 4px 16px #0003;padding:10px 12px}p{margin:0 0 8px;color:#c9c1b5}p:last-child{margin-bottom:0}button{background:#3b352b;color:#fff;border:1px solid #8f8272;border-radius:6px;padding:6px;cursor:pointer}</style><details><summary></summary><aside><p class="stats"></p><p class="plan"></p><button type="button">Refresh plan usage</button><p class="detail"></p></aside></details>';
      shadow.querySelector('button').addEventListener('click',()=>{const id=identity();if(id&&!account.paused&&account.planEnabled!==false)samplePlan(id.org);});
      const toolbar=document.querySelector('[role="toolbar"][aria-label="Page tools"]');
      if(toolbar)toolbar.append(host);else{host.style.cssText+=';position:fixed;right:14px;top:56px';document.body.append(host);}
    }
    const availableToolbar=document.querySelector('[role="toolbar"][aria-label="Page tools"]');
    if(availableToolbar&&host.parentElement!==availableToolbar){host.style.position='relative';host.style.removeProperty('right');host.style.removeProperty('top');availableToolbar.append(host);}
    const s=host.shadowRoot;
    const visible=i?.chat&&active===i.org+':'+i.chat?rows:[];
    const t=C.totals(visible,i?.org,i?.chat);
    host.dataset.camRequests=String(t.requests);
    const costLabel=t.unpriced?(t.requests===t.unpriced?'unpriced':money(t.cost)+' + unpriced'):money(t.cost);
    const snapshot=P.normalize(planState.snapshot,i?.org);
    const quota=snapshot?` · S ${snapshot.session?.used??'—'}% · W ${snapshot.weekly?.used??'—'}%`:'';
    const title=!i?'API meter · awaiting organization':`${label(i.org)} · ${account.paused?'paused':i.chat?'Chat ≈ '+costLabel:'API meter ready'}${quota}`;
    const stats=`Estimated input ≈ ${fmt(t.input)} · output ≈ ${fmt(t.output)} · total ≈ ${fmt(t.tokens)} tokens · ${t.requests} tracked response(s)${pending?' · responding…':''}`;
    if(s.querySelector('summary').textContent!==title)s.querySelector('summary').textContent=title;
    if(s.querySelector('.stats').textContent!==stats)s.querySelector('.stats').textContent=stats;
    const planLine=account.planEnabled===false?'Automatic plan checks are off.':snapshot?`Plan usage (account-wide): Session ${snapshot.session?.used??'—'}% · Weekly ${snapshot.weekly?.used??'—'}%. Checked ${new Date(snapshot.observedAt).toLocaleTimeString()}. ${planState.error||'Rounded readings can show no visible change; other apps count too.'}`:`Plan usage: ${sampling?'checking official Usage page…':planState.error||'awaiting first reading'}`;
    if(s.querySelector('.plan').textContent!==planLine)s.querySelector('.plan').textContent=planLine;
    const detail=DETAILS+' Rates: '+C.rateDate+'. '+(instance.error||'Open the extension popup to label or pause this organization.');
    if(s.querySelector('.detail').textContent!==detail)s.querySelector('.detail').textContent=detail;
    if(!i?.chat)return;
    const all=roots();
    for(const el of all.filter(assistant)){
      const pos=Number(el.getAttribute('aria-posinset'))||all.indexOf(el)+1;
      const currentKey=turnKey(el);
      const r=visible.filter(x=>x.turnKey?x.turnKey===currentKey:x.position===pos).at(-1);if(!r)continue;
      let footer=el.querySelector('[data-cam="footer"]');
      if(!footer){footer=document.createElement('div');footer.dataset.cam='footer';footer.style.cssText='border-top:1px solid #998c7866;margin:12px 0 8px;padding-top:8px;font:12px/1.7 system-ui;opacity:.85';el.append(footer);}
      const stop=r.status==='stopped'?' · stopped response':'';
      footer.style.whiteSpace='pre-line';
      const line=`Estimated · Input ≈ ${fmt(r.inputTokens)} · Output ≈ ${fmt(r.outputTokens)} · Tokens ≈ ${fmt(r.tokens)} · API equivalent ≈ ${money(r.cost)} · ${r.model}${stop}\n${P.format(r.plan)}`;
      if(footer.textContent!==line)footer.textContent=line;
      footer.title=DETAILS+(r.plan?.before&&r.plan?.after?` Plan comparison interval: ${new Date(r.plan.before.observedAt).toLocaleTimeString()} to ${new Date(r.plan.after.observedAt).toLocaleTimeString()}. Account-wide, including other Claude surfaces; displayed rounding and reporting delays apply.`:'');
    }
  }
  async function update(){scheduled=false;await refresh();await commit();render();const i=identity();if(i&&chatSurface()&&!pending&&!sampling&&!account.paused&&account.planEnabled!==false&&!didPrefetch){didPrefetch=true;if(!planState.snapshot||Date.now()-planState.snapshot.observedAt>30000)samplePlan(i.org);}}
  function schedule(){observeNewUserMessage();if(pending&&streaming())pending.sawStreaming=true;if(!scheduled){scheduled=true;setTimeout(()=>update().catch(e=>{instance.error=e.message;}),300);}}
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.target.closest?.('[contenteditable="true"],textarea'))startSubmission();},true);
  // Arm DOM fallback only after actual composition, never while old history hydrates.
  document.addEventListener('input',e=>{if(e.target.closest?.('[contenteditable="true"],textarea'))armDomObserver();},true);
  document.addEventListener('focusin',e=>{const i=identity();if(i&&chatSurface()&&e.target.closest?.('[contenteditable="true"],textarea')&&!pending&&!sampling&&!account.paused&&account.planEnabled!==false&&Date.now()-lastSampleStart>30000)samplePlan(i.org);},true);
  function buttonAction(e){const b=e.target.closest?.('button');if(!b)return;const name=b.getAttribute('aria-label')||b.textContent?.trim()||'';
    if(/^(Send message|Send Message|Send)$/.test(name))startSubmission();
    if(name==='Retry')startSubmission(b.closest('[role="article"],article,[data-testid="assistant-message"],[data-testid="user-message"]'));
    if(/^Stop response$/i.test(name)&&pending)pending.stopped=true;
  }
  // The app can replace a Retry button on pointer-down, before click reaches us.
  document.addEventListener('pointerdown',buttonAction,true);
  document.addEventListener('click',buttonAction,true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','aria-busy','data-is-streaming']});
  window.addEventListener('popstate',schedule);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&scope&&(changes['meter:v1:chat:'+scope.org+':'+scope.chat]||changes['meter:v1:org:'+scope.org]))schedule();});
  chrome.runtime.onMessage.addListener((m,_sender,reply)=>{if(m?.type==='meter-context'){const i=identity();reply({...(i||{}),label:i?label(i.org):'',paused:!!account.paused,planEnabled:account.planEnabled!==false,plan:planState,error:instance.error});}if(m?.type==='meter-changed'&&m.org===identity()?.org)schedule();});
  schedule();
})();
