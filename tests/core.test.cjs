const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../extension/core.js');
test('standard API-equivalent cost uses separate input and output rates',()=>{
  const r=C.record({id:'r',org:'work',chat:'a',model:'Model: Sonnet 5.5 Medium',usage:{input_tokens:10000,output_tokens:2000}});
  assert.equal(r.cost,.04);assert.equal(r.tokens,12000);assert.equal(r.source,'reported');
});
test('cache categories are priced separately without double counting',()=>{
  const r=C.record({id:'r',org:'work',chat:'a',model:'claude-opus-5-5',usage:{input_tokens:1000,output_tokens:2000,cache_read_input_tokens:10000,cache_creation_input_tokens:3000,cache_creation:{ephemeral_5m_input_tokens:1000,ephemeral_1h_input_tokens:2000}}});
  assert.equal(r.tokens,16000);assert.equal(r.inputTokens,14000);assert.ok(Math.abs(r.cost-.067)<1e-12);
});
test('partial counters are never labeled measured',()=>{
  const r=C.record({id:'r',org:'work',chat:'a',model:'sonnet-5-5',inputText:'abcd',outputText:'abcdefgh',usage:{output_tokens:100}});
  assert.equal(r.source,'visible-text-estimate');assert.equal(r.outputTokens,2);
});
test('request replay replaces a record, a retry adds consumption',()=>{
  const r=C.record({id:'r',org:'work',chat:'a',model:'sonnet-5-5',usage:{input_tokens:10000,output_tokens:2000}});
  let rows=C.upsert([],r);rows=C.upsert(rows,r);assert.equal(rows.length,1);
  rows=C.upsert(rows,{...r,id:'retry',model:'opus-5-5',cost:.08});
  assert.equal(C.totals(rows,'work','a').cost,.12);
});
test('ledgers and totals cannot leak across organizations or chats',()=>{
  const r=C.record({id:'r',org:'work',chat:'a',model:'sonnet-5-5'});
  assert.throws(()=>C.upsert([r],{...r,org:'personal'}),/Cross-account/);
  assert.throws(()=>C.upsert([r],{...r,chat:'b'}),/Cross-account/);
  assert.equal(C.totals([r],'personal','a').requests,0);
});
test('unknown models stay unpriced; Haiku long context uses its higher tier',()=>{
  assert.equal(C.cost('unannounced-model',{input:1,output:1,reads:0,write5:0,write1:0}),null);
  assert.equal(C.cost('haiku-5-5',{input:100001,output:1,reads:0,write5:0,write1:0}),.050003);
  assert.equal(C.modelKey('Opus 5.5 Medium'),'opus-5-5');
  assert.equal(C.modelKey('claude-opus-5-5-20261001'),'opus-5-5');
});
