/* The picker and permission prompt run only from clicks in this top-level extension page. */
(function(root){
 'use strict';
 const engine=root.CanvasHarnessOvernight.create(),scope=decodeURIComponent(root.location.hash.slice(1)),get=id=>root.document.getElementById('ch-overnight-'+id);let current;
 function render(value){
  current=value;
  get('choose').textContent=value.folder||'Choose folder';
  get('grant').hidden=!value.needsAllow;
  get('task').hidden=!value.folder;
  get('schedule').textContent=value.schedule;
  get('path').value=value.path||'';
 }
 async function publish(value){render(value);await root.chrome.runtime.sendMessage({target:'ch-overnight-updated',scopeKey:scope});}
 async function action(fn){try{get('status').textContent='';await fn();}catch(error){get('status').textContent=error.message;}}
 get('choose').addEventListener('click',()=>action(async()=>{
  const handle=await root.showDirectoryPicker({id:'canvas-harness-prep',mode:'readwrite'});
  await publish(await engine.choose(scope,handle));
 }));
 get('grant').addEventListener('click',()=>action(async()=>{await publish(await engine.allow(scope));}));
 get('path').addEventListener('change',()=>action(async()=>{await publish(await engine.configure(scope,{path:get('path').value}));}));
 get('copy').addEventListener('click',()=>action(()=>root.navigator.clipboard.writeText(current.schedule)));
 void action(async()=>render(await engine.status(scope)));
})(globalThis);
