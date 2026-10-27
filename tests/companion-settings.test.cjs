'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{fixture}=require('./dashboard-heading-fixture.cjs');
const settle=()=>new Promise(setImmediate),plain=v=>JSON.parse(JSON.stringify(v));
function panel(saved={}){
 const h=fixture({setup({env,store}){
  for(const file of ['workspace-arrange.js','customization-model.js','pony-brain.js','pet-art.js','pets.js','settings-dock.js','customize-ui.js'])vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),env,{filename:file});
  env.ReserveFeatures={enabled:id=>id!=='planner'};
  const data=store.get();Object.assign(data,plain(saved));data.pet||={name:'Biscuit'};
  env.ReserveMakeYourOwn={picker:()=>'',render:()=>'',create:()=>({state:{},destroy(){}})};
 }});
 h.click('settings');
 const tab=h.container.querySelector('[data-rd-action="customize-tab"][data-value="pet"]');tab.click();
 return h;
}
async function change(h,selector,value){const node=h.container.querySelector(selector);assert.ok(node,selector);if(node.type==='checkbox')node.checked=value;else node.value=value;h.container.events.get('change')({target:node});await settle();h.tick(0);}
for(const [key,value,saved]of [['bedtime','21:45'],['biscuitOffers',false],['biscuitOffers',true,{settings:{biscuitOffers:false}}]])test('Companion Planning '+key+' '+value+' saves through the panel and restores after reload',async t=>{
 const h=panel(saved);t.after(()=>h.dashboard.destroy());await change(h,'[data-rd-field="setting"][data-setting="'+key+'"], [data-rd-field="setting"][data-key="'+key+'"]',value);
 assert.equal(h.store.get().settings[key],value);const restored=panel(plain(h.store.get()));t.after(()=>restored.dashboard.destroy());const control=restored.container.querySelector('[data-setting="'+key+'"], [data-rd-field="setting"][data-key="'+key+'"]');assert.equal(key==='bedtime'?control.value:control.checked,value);
});
test('Bedtime and Biscuit offers validate atomically in saved settings',async()=>{
 const storage=require('../extension/storage.js'),data={},store=storage.createStore({accountId:'42',origin:'https://school.instructure.com',adapter:{read:async key=>structuredClone(data[key]),write:async(key,value)=>{data[key]=structuredClone(value);}}});await store.load();
 try{for(const bedtime of ['00:00','23:59']){await store.update(d=>{d.settings.bedtime=bedtime;d.settings.biscuitOffers=false;});assert.equal((await store.load()).settings.bedtime,bedtime);assert.equal(store.get().settings.biscuitOffers,false);}
  const before=store.get();for(const bedtime of ['24:00','7:30','',null,['22:30']]){await assert.rejects(store.update(d=>{d.settings.bedtime=bedtime;}),/HH:MM/);assert.deepEqual(store.get(),before);}await assert.rejects(store.update(d=>{d.settings.biscuitOffers='false';}));assert.deepEqual(store.get(),before);
 }finally{store.destroy();}
});
