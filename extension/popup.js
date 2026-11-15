'use strict';
let context=null,ledger=null;
const $=id=>document.getElementById(id);
async function request(m){const r=await chrome.runtime.sendMessage(m);if(!r?.ok)throw Error(r?.error||'Request failed');return r.value;}
function showPlan(state){const p=state?.snapshot;$('plan').textContent=p?`Account-wide plan usage:\nSession ${p.session?.used??'—'}% · Weekly ${p.weekly?.used??'—'}%\nChecked ${new Date(p.observedAt).toLocaleTimeString()}${state.error?'\n'+state.error:''}`:state?.error||'No plan reading yet.';}
async function init(){
  $('date').textContent=ClaudeMeterCore.rateDate;
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.url?.startsWith('https://claude.ai/'))return;
    context=await chrome.tabs.sendMessage(tab.id,{type:'meter-context'});
    if(!context?.org){$('status').textContent='Waiting for Claude’s active organization. Reload the chat if needed.';return;}
    $('controls').hidden=false;$('status').textContent=context.error||'Local tracking · estimated tokens';
    $('scope').textContent='Organization: '+context.org;$('label').value=context.label;
    $('pause').textContent=context.paused?'Resume this organization':'Pause this organization';
    $('plan-enabled').checked=context.planEnabled;showPlan(context.plan);
    if(context.chat){ledger=await request({type:'read',org:context.org,chat:context.chat});const t=ClaudeMeterCore.totals(ledger.rows,context.org,context.chat);
      $('totals').textContent=`This chat (tracked responses):\nInput ≈ ${t.input.toLocaleString()} · Output ≈ ${t.output.toLocaleString()}\nTotal ≈ ${t.tokens.toLocaleString()} tokens\nAPI equivalent ≈ $${t.cost.toFixed(5)}${t.unpriced?' + '+t.unpriced+' unpriced response(s)':''}`;
    }else{$('export').disabled=true;$('totals').textContent='Start a chat to see running totals.';}
  }catch(e){$('status').textContent='Reload your Claude tab to activate the extension. '+e.message;}
}
$('save').addEventListener('click',async()=>{try{await request({type:'configure',org:context.org,label:$('label').value});$('status').textContent='Label saved for this organization only.';}catch(e){$('status').textContent=e.message;}});
$('pause').addEventListener('click',async()=>{try{const value=await request({type:'configure',org:context.org,paused:!context.paused});context.paused=value.paused;$('pause').textContent=value.paused?'Resume this organization':'Pause this organization';$('status').textContent=value.paused?'Tracking paused for this organization.':'Tracking resumed for this organization.';}catch(e){$('status').textContent=e.message;}});
$('plan-enabled').addEventListener('change',async()=>{try{await request({type:'configure',org:context.org,planEnabled:$('plan-enabled').checked});$('status').textContent='Plan checks '+($('plan-enabled').checked?'enabled':'disabled')+' for this organization.';}catch(e){$('status').textContent=e.message;}});
$('plan-refresh').addEventListener('click',async()=>{try{$('plan-refresh').disabled=true;$('plan').textContent='Checking official Usage page…';showPlan(await request({type:'plan-sample',org:context.org}));}catch(e){$('plan').textContent=e.message;}finally{$('plan-refresh').disabled=false;}});
$('export').addEventListener('click',async()=>{try{const value=await request({type:'read',org:context.org,chat:context.chat});const blob=new Blob([JSON.stringify({org:context.org,chat:context.chat,source:'visible-text-estimate',ratesChecked:ClaudeMeterCore.rateDate,records:value.rows},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='claude-meter-'+context.org.slice(0,8)+'-'+context.chat+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){$('status').textContent=e.message;}});
init();
