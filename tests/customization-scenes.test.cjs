'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const storage=require('../extension/storage.js');
const {createDOM}=require('./addons-fixture.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const ids=['','starry','sea','stars','blueprint'];
function makeStore(){
 const data={};return storage.createStore({accountId:'42',origin:'https://school.instructure.com',adapter:{read:async key=>structuredClone(data[key]),write:async(key,value)=>{data[key]=structuredClone(value);}}});
}
function editor({settings={},enabled,runtime=true}={}){
 const urls=[],env=vm.createContext({console});
 if(runtime)env.chrome={runtime:{getURL(file){urls.push(file);return 'chrome-extension://test/'+file;}}};
 if(enabled)env.ReserveFeatures={enabled};
 for(const file of ['workspace-arrange.js','customization-model.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});
 const context={s:settings,allCourses:[],courses:[],customizeOpen:true,customizeTab:'look'},before=JSON.stringify(context);
 const html=env.ReserveCustomizeUI.render(context),document=createDOM('<html><body>'+html+'</body></html>');
 assert.equal(JSON.stringify(context),before,'rendering preserves all stored settings');
 return {html,document,urls};
}

test('scene defaults and every packaged choice survive save, reload and JSON backup restore',async()=>{
 const model=require('../extension/customization-model.js'),store=makeStore();await store.load();
 assert.deepEqual(model.enums.sceneTheme,ids);assert.equal(model.defaults.sceneTheme,'');assert.equal(store.get().settings.sceneTheme,'');
 await store.update(data=>{Object.assign(data.settings,{theme:'dark',nightArt:65,pageTint:'sage'});data.tasks['9']={notes:'Keep my notes'};});
 for(const sceneTheme of ids){
  await store.update(data=>{data.settings.sceneTheme=sceneTheme;});
  const saved=await store.load();assert.equal(saved.settings.sceneTheme,sceneTheme);
  assert.equal(saved.settings.theme,'dark');assert.equal(saved.settings.nightArt,65);assert.equal(saved.settings.pageTint,'sage');
  assert.equal(saved.tasks['9'].notes,'Keep my notes');
  const restored=storage.validateBackup(JSON.stringify(store.exportBackup()),store.owner);
  assert.deepEqual(restored,saved);await store.replace(restored);assert.deepEqual(await store.load(),saved);
 }
 const legacy=store.exportBackup();delete legacy.data.settings.sceneTheme;
 assert.equal(storage.validateBackup(legacy,store.owner).settings.sceneTheme,'','older backups use no scene');
});

test('unknown or malformed scenes reject backups and saves without changing existing data',async()=>{
 const store=makeStore();await store.load();await store.update(data=>{data.settings.sceneTheme='sea';data.tasks['9']={notes:'Saved work'};});
 const saved=store.get();
 for(const sceneTheme of ['ocean','Starry','../stars','themes/sea/poster.jpg',null,false,0,{},['sea']]){
  const backup=store.exportBackup();backup.data.settings.sceneTheme=sceneTheme;
  assert.throws(()=>storage.validateBackup(backup,store.owner),/Invalid sceneTheme setting in backup/);
  await assert.rejects(store.update(data=>{data.settings.sceneTheme=sceneTheme;}),/Invalid sceneTheme setting in backup/);
  assert.deepEqual(await store.load(),saved);
 }
});

test('Look offers five named native radio choices and only packaged decorative poster thumbnails',()=>{
 const {document,urls}=editor(),group=document.querySelector('[role="radiogroup"][aria-label="Scene"]');
 assert.ok(group,'Scene is a labeled radio group in Look');
 const radios=group.querySelectorAll('input');
 assert.deepEqual(radios.map(input=>input.value),ids);
 assert.deepEqual(radios.map(input=>input.closest('label').querySelector('strong').textContent),['None','Starry Night','Under the Sea','Starfield','Blueprint']);
 for(const input of radios){
  assert.equal(input.type,'radio');assert.equal(input.getAttribute('name'),'cz-sceneTheme');
  assert.equal(input.dataset.rdField,'setting');assert.equal(input.dataset.setting,'sceneTheme');
  assert.equal(input.disabled,false);assert.equal(input.hidden,false);assert.equal(input.hasAttribute('tabindex'),false,'native radio keyboard behavior stays available');
  assert.ok(input.closest('label').querySelector('.cz-choice-art'));
 }
 assert.deepEqual(radios.filter(input=>input.checked).map(input=>input.value),['']);
 assert.equal(radios[0].closest('label').querySelector('img'),null,'None keeps the plain page illustration');
 assert.deepEqual(urls,['themes/starry/poster.jpg','themes/sea/poster.jpg','themes/stars/poster.jpg','themes/blueprint/poster.jpg']);
 const images=group.querySelectorAll('img');assert.equal(images.length,4);
 for(const [index,img]of images.entries()){
  assert.equal(img.getAttribute('src'),'chrome-extension://test/'+urls[index]);
  assert.equal(img.getAttribute('alt'),'');assert.equal(img.getAttribute('aria-hidden'),'true');
 }
});

test('each active scene hides night artwork and keeps Light/Dark editable with the saved choice',()=>{
 for(const sceneTheme of ids.slice(1))for(const theme of ['light','dark','system']){
  const {document}=editor({settings:{sceneTheme,theme,nightArt:70,themePack:'night-library'}});
  const scenes=document.querySelectorAll('input[data-setting="sceneTheme"]');
  assert.deepEqual(scenes.filter(input=>input.checked).map(input=>input.value),[sceneTheme]);
  assert.ok(scenes.every(input=>!input.disabled),'None remains available to restore saved appearance');
  assert.equal(document.querySelector('[data-setting="nightArt"]'),null);
  const themeChoices=document.querySelectorAll('input[data-setting="theme"]');assert.equal(themeChoices.length,2);
  assert.ok(themeChoices.every(input=>!input.disabled),'scene colors remain adjustable in either mode');
  assert.deepEqual(themeChoices.filter(input=>input.checked).map(input=>input.value),[theme==='dark'?'dark':'light']);
  assert.doesNotMatch(document.body.textContent,/Choose None/,'no standing explanation: the locked choices speak for themselves');
 }
 const {document}=editor({settings:{sceneTheme:'',theme:'dark',nightArt:70}});
 assert.ok(document.querySelectorAll('input[data-setting="theme"]').every(input=>!input.disabled));
 assert.equal(document.querySelector('[data-setting="nightArt"]').value,'70');
});

test('disabled scenes are absent and do not lock saved appearance or resolve posters',()=>{
 const {document,urls}=editor({settings:{sceneTheme:'sea',theme:'dark',nightArt:45},enabled:id=>id!=='scene-themes'});
 assert.equal(document.querySelector('[aria-label="Scene"]'),null);
 assert.equal(document.querySelector('[data-setting="sceneTheme"]'),null);assert.deepEqual(urls,[]);
 assert.ok(document.querySelectorAll('input[data-setting="theme"]').every(input=>!input.disabled));
 assert.equal(document.querySelector('[data-setting="nightArt"]').value,'45');
 const off=editor({settings:{sceneTheme:'stars'},enabled:id=>id!=='customization'});
 assert.ok(off.document.querySelector('[data-value="features"]'));assert.ok(off.document.querySelector('[data-value="settings"]'));assert.equal(off.document.querySelector('[data-setting="sceneTheme"]'),null);assert.deepEqual(off.urls,[]);
});

test('the picker remains usable without an extension runtime and avoids school-relative image requests',()=>{
 const {document}=editor({runtime:false}),group=document.querySelector('[aria-label="Scene"]');
 assert.ok(group);assert.equal(group.querySelectorAll('input[type="radio"]').length,5);
 assert.equal(group.querySelector('img'),null);
});
