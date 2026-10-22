'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./dashboard-heading-fixture.cjs'),{settle}=require('./contributor-fixture.cjs');
const art=require('../extension/custom-art.js'),media=require('../extension/media-store.js'),kits=require('../extension/custom-kits.js'),custom=require('../extension/customization-model.js');
function adapter(){let state={media:[],kits:[]};return {async transact(fn,write){const next=structuredClone(state),out=fn(next);if(write)state=next;return out;}};}
test('dashboard saves, uses and removes a portable kit while preserving course data',async t=>{
 const owner={accountId:'42',origin:'https://school.instructure.com'},local=media.createStore(owner,{adapter:adapter()}),banner=art.importSVG('<svg><rect width="20" height="10" fill="red"/></svg>','Mine.svg');let context;
 const h=fixture({setup({env,store}){
  store.owner=owner;Object.assign(store.get().settings,{accent:'#123abc',font:'serif',bannerSize:'large',overviewArt:{bannerArt:banner},coursePrefs:{'10':{name:'My chemistry',color:'#123456'}}});
  env.structuredClone=structuredClone;env.ReserveCustomArt=art;env.ReserveCustomization=custom;env.ReserveCustomKits=kits;env.ReserveMedia={...media,createStore:()=>local,createController:()=>({sync(){},destroy(){}})};
  env.ReserveCustomizeUI={render(c){context=c;return '<div class="rd-appearance"><div class="t-acc-panel"><div class="t-acc-panel-inner"><input data-rd-field="kit-name"><button data-rd-action="kit-save" data-id="all">Save as kit</button>'+(c.customKits||[]).map(kit=>['use','remove'].map(action=>'<button data-rd-action="kit-'+action+'" data-id="10" data-kit="'+kit.id+'">'+action+'</button>').join('')).join('')+'</div></div></div>';}};
 }});t.after(()=>h.dashboard.destroy());
 const name=h.container.querySelector('[data-rd-field="kit-name"]');name.value='My kit';h.container.events.get('input')({target:name});h.click('kit-save');await settle();h.tick(0);await settle();h.tick(0);
 const saved=await local.listKits();assert.equal(saved.length,1);assert.equal(saved[0].name,'My kit');assert.equal(saved[0].accent,'#123abc');assert.equal(saved[0].font,'serif');assert.equal(saved[0].appearance.bannerArt.svg,banner.svg);assert.equal(context.customizeBusy,false);assert.equal(context.customizeStatus,'');
 await h.store.update(data=>{Object.assign(data.settings,{accent:'clay',font:'system',bannerSize:'compact'});});h.tick(0);h.click('kit-use',{id:'10'});await settle();h.tick(0);
 const s=h.store.get().settings;assert.equal(s.coursePrefs['10'].name,'My chemistry');assert.equal(s.coursePrefs['10'].color,'#123456');assert.equal(s.coursePrefs['10'].bannerArt.svg,banner.svg);assert.equal(s.accent,'#123abc');assert.equal(s.font,'serif');assert.equal(s.bannerSize,'large');
 h.click('kit-remove',{id:'10'});await settle();h.tick(0);assert.deepEqual(await local.listKits(),[]);assert.equal(h.store.get().settings.coursePrefs['10'].bannerArt.svg,banner.svg);
});
