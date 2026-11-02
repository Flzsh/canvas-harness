'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dom,descendants}=require('./study-fixture.cjs'),Band=require('../extension/study-band.js');
const find=host=>descendants(host).find(n=>String(n.className||'').includes('ch-band-ai'))||null;
function mount(opts){const d=dom(),host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:{get:async()=>({}),set:async()=>{}}}},matchMedia:()=>({matches:false})};Band.renderBand(host,{},{env,scope:'s',onPrepare:async()=>({}),...opts});return host;}
test('the Help band offers the student\'s AI beside Daily AI help, and a change goes to the saved setting',async()=>{
 const picked=[];const host=mount({aiChoice:()=>'claude',onAiChoice:async id=>{picked.push(id);}}),pick=find(host);
 assert.ok(pick,'the choice is there');assert.equal(pick.getAttribute('aria-label'),'Your AI');assert.equal(pick.children.length,8);assert.deepEqual(pick.children.slice(0,3).map(o=>o.textContent),['ChatGPT','Claude','Gemini']);
 pick.value='gemini';await pick.handlers.get('change')();await new Promise(r=>setTimeout(r,0));assert.deepEqual(picked,['gemini']);assert.equal(pick.disabled,false);
});
test('with an API key, or with Your AI off, there is no site to pick',()=>{assert.equal(find(mount({aiChoice:()=>'',onAiChoice:async()=>{}})),null);});
test('a refused change puts the saved AI back and says why',async()=>{
 const errors=[];const host=mount({aiChoice:()=>'chatgpt',onAiChoice:async()=>{throw Error('no');},onError:e=>errors.push(e.message)}),pick=find(host);
 pick.value='kimi';await pick.handlers.get('change')();await new Promise(r=>setTimeout(r,0));assert.equal(pick.value,'chatgpt');assert.deepEqual(errors,['no']);
});
test('Test beside Your AI runs the check once and shows what it found',async()=>{
 const calls=[];const host=mount({aiChoice:()=>'chatgpt',onAiChoice:async()=>{},onAiCheck:async()=>{calls.push(1);throw Error('Allow access first');},onError:()=>{}}),test=descendants(host).find(n=>n.tagName==='BUTTON'&&n.textContent==='Test');
 assert.ok(test,'the button is there');await test.handlers.get('click')();assert.equal(calls.length,1);assert.equal(test.disabled,false);assert.ok(descendants(host).some(n=>n.textContent==='Allow access first'));
});
