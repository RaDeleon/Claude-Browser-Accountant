(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClaudeMeterCore = api;
})(globalThis, function () {
  'use strict';
  const rateDate = '2026-11-14';
  const rates = {
    'fable-5-2': [8, 40, .20, 10, 16],
    'mythos-5-2': [8, 40, .20, 10, 16],
    'fable-5-1': [10, 50, .25, 12.5, 20],
    'mythos-5-1': [10, 50, .25, 12.5, 20],
    'opus-5-5': [4, 20, .20, 5, 8],
    'sonnet-5-5': [2, 10, .10, 2.5, 4],
    'haiku-5-5': [.10, .50, .01, .125, .20],
    'opus-5': [5, 25, .50, 6.25, 10],
    'opus-4-8': [5, 25, .50, 6.25, 10],
    'opus-4-7': [5, 25, .50, 6.25, 10],
    'opus-4-6': [5, 25, .50, 6.25, 10],
    'sonnet-4-6': [3, 15, .30, 3.75, 6],
    'sonnet-4-5': [3, 15, .30, 3.75, 6],
    'haiku-4-5': [1, 5, .10, 1.25, 2]
  };
  function modelKey(value) {
    const s = String(value || '').toLowerCase().replace(/claude[- ]?/g, '').replace(/[. ]/g, '-');
    return Object.keys(rates).sort((a,b)=>b.length-a.length).find(k=>new RegExp('(?:^|-)'+k+'(?:-|$)').test(s)) || null;
  }
  function estimate(text) { return Math.ceil(new TextEncoder().encode(String(text || '')).length / 4); }
  function number(v) { return Number.isSafeInteger(v) && v >= 0 ? v : null; }
  function normalizeUsage(usage) {
    if (!usage || typeof usage !== 'object') return null;
    const input = number(usage.input_tokens), output = number(usage.output_tokens);
    if (input === null || output === null) return null;
    const reads = number(usage.cache_read_input_tokens) ?? 0;
    const writes = number(usage.cache_creation_input_tokens) ?? 0;
    const five = number(usage.cache_creation?.ephemeral_5m_input_tokens);
    const hour = number(usage.cache_creation?.ephemeral_1h_input_tokens);
    const splitKnown = writes === 0 || (five !== null && hour !== null && five + hour === writes);
    return {input,output,reads,write5: splitKnown ? five ?? 0 : writes,write1: splitKnown ? hour ?? 0 : 0,
      cacheAssumed: !splitKnown, cacheReported: 'cache_read_input_tokens' in usage && 'cache_creation_input_tokens' in usage};
  }
  function cost(model, counts) {
    const key = modelKey(model);let rate = rates[key];
    if (!rate) return null;
    const totalInput = counts.input + counts.reads + counts.write5 + counts.write1;
    if (key === 'haiku-5-5' && totalInput > 100000) rate=[.5,2.5,.05,.625,1];
    // Fast mode, geographic routing, tools and discounts are intentionally not inferred.
    return (counts.input*rate[0] + counts.output*rate[1] + counts.reads*rate[2] + counts.write5*rate[3] + counts.write1*rate[4])/1e6;
  }
  function record({id,org,chat,model,inputText='',outputText='',usage=null,position=null,status='complete'}) {
    if (!id || !org || !chat) throw new Error('An explicit organization, chat and request ID are required');
    const measured = normalizeUsage(usage);
    const counts = measured || {input:estimate(inputText),output:estimate(outputText),reads:0,write5:0,write1:0,cacheAssumed:true,cacheReported:false};
    return {id,org,chat,model:modelKey(model)||String(model||'Unknown'),position,status,counts,
      tokens: counts.input+counts.output+counts.reads+counts.write5+counts.write1,
      inputTokens:counts.input+counts.reads+counts.write5+counts.write1,outputTokens:counts.output,
      cost:cost(model,counts),source:measured?'reported':'visible-text-estimate',rateDate,time:new Date().toISOString()};
  }
  function upsert(rows, item) {
    if (rows.some(r=>r.org!==item.org||r.chat!==item.chat)) throw new Error('Cross-account or cross-chat ledger rejected');
    return [...rows.filter(r=>r.id!==item.id),item];
  }
  function totals(rows, org, chat) {
    const selected = rows.filter(r=>r.org===org&&r.chat===chat);
    return {input:selected.reduce((s,r)=>s+r.inputTokens,0),output:selected.reduce((s,r)=>s+r.outputTokens,0),
      tokens:selected.reduce((s,r)=>s+r.tokens,0),cost:selected.reduce((s,r)=>s+(r.cost??0),0),
      unpriced:selected.filter(r=>r.cost===null).length,estimated:selected.some(r=>r.source!=='reported'),requests:selected.length};
  }
  return {rateDate,rates,modelKey,estimate,normalizeUsage,cost,record,upsert,totals};
});
