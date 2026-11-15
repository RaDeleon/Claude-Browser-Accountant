(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MeterPlan=api;})(globalThis,()=>{
  'use strict';
  const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
  function normalize(raw,expectedOrg){
    if(!raw||!validId(raw.org)||raw.org!==expectedOrg||!Number.isFinite(raw.observedAt)||raw.observedAt<=0)return null;
    const clean=x=>x&&Number.isFinite(x.used)&&x.used>=0&&x.used<=100?{used:x.used,reset:typeof x.reset==='string'?x.reset.slice(0,120):''}:null;
    const session=clean(raw.session),weekly=clean(raw.weekly);
    if(!session&&!weekly)return null;
    return {org:raw.org,observedAt:raw.observedAt,session,weekly,source:'official-usage-page',precision:'displayed-percent'};
  }
  function compare(before,after,{org,submittedAt,completedAt}){
    const b=normalize(before,org),a=normalize(after,org);
    if(!a||a.observedAt<completedAt)return {status:'unavailable',before:b,after:null};
    if(!b)return {status:'no-baseline',before:null,after:a};
    if(b.observedAt>submittedAt||submittedAt-b.observedAt>300000)return {status:'stale-baseline',before:b,after:a};
    if(a.observedAt<b.observedAt)return {status:'unavailable',before:b,after:a};
    function delta(x,y){
      if(!x||!y)return {status:'unavailable',change:null};
      if(!x.reset||!y.reset||x.reset!==y.reset||y.used<x.used)return {status:'reset-or-limit-change',change:null};
      return {status:'ok',change:Math.round((y.used-x.used)*100)/100};
    }
    return {status:'observed',before:b,after:a,session:delta(b.session,a.session),weekly:delta(b.weekly,a.weekly)};
  }
  function format(comparison){
    if(!comparison)return 'Plan usage: not sampled for this response';
    if(comparison.status==='checking')return 'Plan usage: checking official session and weekly readings…';
    const a=comparison.after;
    const current=a?`Session ${a.session?.used??'—'}% · Weekly ${a.weekly?.used??'—'}%`:'Session — · Weekly —';
    if(comparison.status!=='observed')return `${current} · change unavailable (${comparison.status==='no-baseline'?'no before reading':comparison.status==='stale-baseline'?'before reading not fresh':'usage page unavailable'})`;
    function section(name,k){const b=comparison.before[k],a=comparison.after[k],d=comparison[k];
      if(!b||!a)return name+' unavailable';
      return `${name} ${b.used}% → ${a.used}% · ${d.status==='ok'?(d.change===0?'0 pp (no visible change)':`+${d.change} pp`):'reset/limit changed'}`;
    }
    return 'Plan usage · '+section('Session','session')+' · '+section('Weekly','weekly')+' · account-wide';
  }
  function readDocument(doc,org,observedAt=Date.now()){
    const result={org,observedAt};
    for(const meter of doc.querySelectorAll('[role="meter"]')){
      const label=(meter.getAttribute('aria-label')||meter.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>doc.getElementById(id)?.textContent||'').join(' ')||'').trim();
      const key=/^Current session$/i.test(label)?'session':/^All models$/i.test(label)?'weekly':null;
      if(!key)continue;
      const value=meter.getAttribute('aria-valuenow');if(value===null||value.trim()==='')continue;
      let row=meter.parentElement,reset='';
      for(let depth=0;row&&depth<5;depth++,row=row.parentElement){
        const resetNode=[...row.children].find(e=>/^Resets\b/.test(e.textContent?.trim()||''));
        if(resetNode){reset=resetNode.textContent.trim();break;}
      }
      result[key]={used:Number(value),reset};
    }
    return normalize(result,org);
  }
  return {normalize,compare,format,readDocument};
});
