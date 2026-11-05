// CH looks at the AI's thinking setting before it sends (owner, 2026-11-05: one Help card took 17 minutes because ChatGPT
// was left on Pro). With no effort chosen, ChatGPT's Power slider on its last step (Pro) is brought down to High for the
// send and put back after; a step at or below Extra high is left alone. Claude's Max comes down the same way.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..','extension',file),'utf8');
// a stand-in for ChatGPT's composer: the model button opens a menu with the Power slider (0 Instant .. 4 Pro)
function chatgpt(start){
  const slider={value:start,getAttribute:k=>k==='aria-valuenow'?String(slider.value):null,dispatchEvent(e){if(e.key==='ArrowRight')slider.value=Math.min(4,slider.value+1);if(e.key==='ArrowLeft')slider.value=Math.max(0,slider.value-1);}};
  let open=false;const button={dispatchEvent(e){if(e.type==='click')open=true;}};
  const document={querySelector:s=>s==='button[aria-label="Select ChatGPT model"]'?button:s==='[role="slider"]'&&open?slider:null,querySelectorAll:()=>[],activeElement:null,body:{dispatchEvent(){}}};
  class Ev{constructor(type,o={}){this.type=type;Object.assign(this,o);}}
  const sandbox={document,setTimeout:(f)=>{f();return 0;},PointerEvent:Ev,MouseEvent:Ev,KeyboardEvent:Ev,console};sandbox.globalThis=sandbox;sandbox.window=sandbox;
  vm.createContext(sandbox);vm.runInContext(read('ai-inject.js'),sandbox,{filename:'ai-inject.js'});
  return {api:sandbox.CanvasHarnessInject,slider};
}
test('ChatGPT left on Pro comes down to High for the send, and says where it was so it can be put back',async()=>{
  const {api,slider}=chatgpt(4),r=await api.setEffort({id:'chatgpt',value:'high',above:'extra'});
  assert.equal(slider.value,2);assert.equal(r.ok,true);assert.equal(r.before,4);
});
test('ChatGPT at Extra high or below is left as the student set it',async()=>{
  for(const start of [0,1,2,3]){const {api,slider}=chatgpt(start),r=await api.setEffort({id:'chatgpt',value:'high',above:'extra'});assert.equal(slider.value,start);assert.equal(r.before,null);}
});
test('a chosen effort is still set exactly',async()=>{
  const {api,slider}=chatgpt(4),r=await api.setEffort({id:'chatgpt',value:'medium'});assert.equal(slider.value,1);assert.equal(r.before,4);
});
test('the send asks for the cap when no effort is chosen, for ChatGPT and Claude',()=>{
  const web=read('ai-delivery-web.js').replace(/\n\s*/g,'');
  assert.match(web,/if\(receipt\.effortBefore===undefined&&\(run\.settings\?\.effort\|\|\['chatgpt','claude'\]\.includes\(run\.provider\)\)\)\{const set=await execute\(inject\.setEffort,run\.settings\?\.effort\?\{id:run\.provider,value:run\.settings\.effort\}:\{id:run\.provider,value:'high',above:'extra'\}\);/);
  assert.match(read('ai-inject.js').replace(/\n\s*/g,''),/if \(arg\.above && LEVELS\.indexOf\(was\) <= LEVELS\.indexOf\(arg\.above\)\) \{ await shut\(\); return \{ok: true, before: null\}; \}/,'Claude: only Max comes down');
});
