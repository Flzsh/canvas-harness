'use strict';
// Power run 2026-10-27: a Make it yours tab switch redraws only the panel; a setting still redraws the page.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{fixture}=require('./dashboard-heading-fixture.cjs');
function panel(){
 const h=fixture({setup({env,store}){
  for(const file of ['workspace-arrange.js','customization-model.js','study-kind.js','pony-brain.js','pet-art.js','pets.js','settings-dock.js','customize-ui.js'].filter(file=>fs.existsSync('extension/'+file)))vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),env,{filename:file});
  env.ReserveFeatures={enabled:id=>id!=='planner'};
  const data=store.get();data.pet||={name:'Biscuit'};
  env.ReserveMakeYourOwn={activeLook:()=>({key:null,layer:{}}),picker:()=>'',render:()=>'',create:()=>({state:{},destroy(){}})};
 }});
 const View=h.env.ReserveDashboardView,render=View.render;let pages=0;View.render=(...args)=>{pages++;return render(...args);};
 h.click('settings');
 return {h,pages:()=>pages,tab:name=>h.container.querySelector('[data-rd-action="customize-tab"][data-value="'+name+'"]')};
}
test('a settings tab switch redraws only the panel, with the new tab shown and selected',t=>{
 const p=panel();t.after(()=>p.h.dashboard.destroy());
 p.tab('layout').click();const before=p.pages(),hero=p.h.container.querySelector('.cz-pet-hero');assert.equal(hero,null);
 p.tab('pet').click();
 assert.equal(p.pages(),before,'the dashboard was not rebuilt');
 assert.ok(p.h.container.querySelector('.cz-pet-hero'),'the companion page is shown');
 assert.equal(p.tab('pet').getAttribute('aria-selected'),'true');assert.equal(p.tab('layout').getAttribute('aria-selected'),'false');
 p.tab('layout').click();assert.equal(p.pages(),before);assert.equal(p.h.container.querySelector('.cz-pet-hero'),null);
});
test('the panel alone reads the same page of Make it yours as a whole render',t=>{
 const p=panel();t.after(()=>p.h.dashboard.destroy());
 p.tab('pet').click();const alone=p.h.container.querySelector('.rd-appearance .t-acc-panel-inner').innerHTML,before=p.pages();
 // Closing and opening again is a whole render that shows the same remembered tab.
 p.h.click('settings');p.h.click('settings');assert.ok(p.pages()>before,'reopening rebuilt the page');
 assert.equal(p.tab('pet').getAttribute('aria-selected'),'true');
 // patchUI keeps a kept node's attribute order, so attributes are compared as sets.
 const norm=html=>html.replace(/<([a-z0-9-]+)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*>/gi,(m,tag,attrs)=>'<'+tag+' '+(attrs.match(/[^\s=]+(?:="[^"]*")?/g)||[]).sort().join(' ')+'>');
 assert.equal(norm(p.h.container.querySelector('.rd-appearance .t-acc-panel-inner').innerHTML),norm(alone));
});
test('a setting in the panel still redraws the page',async t=>{
 const p=panel();t.after(()=>p.h.dashboard.destroy());
 p.tab('layout').click();const before=p.pages();
 const input=p.h.container.querySelector('input[data-setting="density"][value="compact"]')||p.h.container.querySelector('input[data-rd-field="setting"]');assert.ok(input);
 input.checked=true;p.h.container.events.get('change')({target:input});
 for(let i=0;i<5;i++)await new Promise(setImmediate);p.h.tick?.(1000);
 assert.ok(p.pages()>before,'a setting change is not limited to the panel');
});
