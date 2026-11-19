'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Runner=require('../extension/ai-runner.js');
const never=name=>()=>{throw Error(name+' must not run in a test of the AI');};
async function drive(reply,provider='chatgpt'){
 globalThis.CanvasHarnessProviders=require('../extension/ai-providers.js');
 const sent=[],at=[1000,1000,8000],now=()=>at.length>1?at.shift():at[0],canvas=new Proxy({validate:async()=>{},hash:()=>'h'},{get:(t,k)=>t[k]||never(String(k))}),results={publish:never('publish')},account={sync:never('sync'),get:never('get')};
 const adapter={deliver:async(turn,mark)=>{sent.push(turn);await mark({status:'sent'});return typeof reply==='function'?reply(turn):{status:'reply',reply:reply.replace('WORD',/READY-\w+/.exec(turn.text)[0]),receipt:{status:'sent'}};}};
 const R=Runner.create({canvas,results,account,adapter,now,uuid:()=>'abcd1234-rest'}),run={id:'run-check-1',kind:'ask',check:true,question:'Test',provider,state:'queued',turns:[],turnIndex:0,errors:[]},save=async r=>r;
 for(let i=0;i<8&&!['unchanged','needs-you'].includes(run.state);i++)await R.step(run,{save,guard:async()=>{},signal:null,claimProvider:async()=>{}});
 return {run,sent};
}
test('the AI test sends one line with nothing from Canvas, reads the word back and says how long it took',async()=>{
 const {run,sent}=await drive('```json\n{"ready":"WORD"}\n```');
 assert.equal(run.state,'unchanged');assert.equal(sent.length,1);assert.match(run.progress,/^ChatGPT replied in \d+ s$/);
 assert.ok(sent[0].text.length<160,'a line, not a brief');assert.ok(sent[0].text.includes(run.word));assert.equal(run.snapshot,undefined,'Canvas was never read');
});
test('a reply without the word says so, and names the chosen AI',async()=>{
 const {run}=await drive('Sure, how can I help?','claude');assert.equal(run.state,'unchanged');assert.equal(run.progress,'Claude answered, but not in the form cards need');
});
test('a stop on the way shows the same reason and action a card run would',async()=>{
 const {run}=await drive(()=>({status:'needs-you',needsYou:{reason:'Allow access to your AI website',action:'Review settings'}}));
 assert.equal(run.state,'needs-you');assert.equal(run.needsYou.action,'Review settings');
});
