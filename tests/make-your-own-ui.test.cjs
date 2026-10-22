'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../extension/make-your-own.js'),'utf8');
const colors={bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#555555',line:'#cccccc',accent:'#123456'};
const theme={format:'chtheme',version:1,name:'Garden <look>',colors:{light:colors},assets:{}};
test('customization includes the pure preset dependencies without enabling optional controllers',()=>{
 const F=require('../extension/features.js'),selection=F.resolve({preset:'custom',custom:['customization']});
 for(const file of ['planner-model.js','pet-art.js','agent-clock.js','pony-ask.js','custom-kits.js','pack-common.js','theme-pack.js','pet-pack.js','preset-pack.js','packs.js','data-theme.js','make-your-own.js'])assert.ok(selection.js.includes(file),file);
 assert.ok(!selection.enabled.includes('pony'));assert.ok(!selection.enabled.includes('planner'));assert.ok(!selection.js.includes('pets.js'));assert.ok(!selection.js.includes('widgets.js'));assert.ok(selection.js.indexOf('pony-ask.js')<selection.js.indexOf('preset-pack.js'));
});
function fixture(){
 let saved={settings:{makeYourOwn:{installed:{}}}},changes=0,validations=0;const calls=[];
 const store={get:()=>saved},env=vm.createContext({TextEncoder,fetch(){throw Error('Unexpected network');},ReserveThemePack:{async importPack(){validations++;return {pack:structuredClone(theme),media:[]};}},ReservePresetPack:{describe:pack=>[pack.kind]},ReservePacks:{async installLocal(file,options){assert.equal(options.store,store);calls.push(['install',file,options.week]);},async removeLocal(id,options){assert.equal(options.store,store);calls.push(['remove',id]);},async useLocal(id,options){assert.equal(options.store,store);calls.push(['use',id,options.week]);}}});
 vm.runInContext(source,env);const api=env.ReserveMakeYourOwn,controller=api.create({store,onChange:()=>changes++,quickPack:async file=>calls.push(['quick',file]),kitImport:async file=>calls.push(['kit',file])});
 return {api,env,store,controller,calls,get validations(){return validations;},get changes(){return changes;},set saved(value){saved=value;}};
}
test('file review validates without applying and escapes labels before explicit apply',async()=>{
 const h=fixture(),file={name:'garden.chtheme'};await h.controller.choose(file);assert.equal(h.validations,1);assert.deepEqual(h.calls,[]);
 const html=h.api.render(h.controller.state,h.store.get().settings);assert.match(html,/Garden &lt;look&gt;/);assert.match(html,/data-rd-action="make-apply"/);assert.equal((html.match(/type="file"/g)||[]).length,1);assert.match(html,/\.chpack,\.chkit,\.chtheme,\.chpet,\.chpreset/);
 await h.controller.action('apply');assert.equal(h.calls[0][0],'install');assert.equal(h.calls[0][1],file);assert.equal(h.controller.state.draft,null);assert.equal(h.controller.state.busy,false);
});
test('existing file formats route to their existing handlers and unknown files do not apply',async()=>{
 const h=fixture();await h.controller.choose({name:'art.chpack'});await h.controller.choose({name:'art.CHKIT'});await h.controller.choose({name:'code.js'});
 assert.deepEqual(h.calls.map(x=>x[0]),['quick','kit']);assert.equal(h.validations,0);assert.match(h.controller.state.status,/Choose/);
});
test('theme review includes background stills, both frame drawings and the heading font label',()=>{
 const h=fixture(),asset={type:'image/svg+xml',data:'PHN2Zy8+',svg:'<svg><title>moving</title></svg>',still:'<svg><title>still</title></svg>'},pack={...theme,background:{asset:'motion',still:'poster'},frames:{panel:{asset:'panel',slice:[1,1,1,1]},card:{asset:'card',slice:[1,1,1,1]}},title:{family:'My <font>'},assets:{motion:{type:'video/mp4'},poster:asset,panel:asset,card:asset}};
 const html=h.api.preview(pack);assert.match(html,/Background/);assert.match(html,/<figcaption>panel<\/figcaption>/);assert.match(html,/<figcaption>card<\/figcaption>/);assert.match(html,/My &lt;font&gt;/);assert.equal((html.match(/<img /g)||[]).length,3);assert.ok(html.includes(encodeURIComponent(asset.still)));assert.ok(!html.includes(encodeURIComponent(asset.svg)));
});
test('all validation and save failures leave a reviewable error and no premature mutation',async()=>{
 const h=fixture();h.env.ReserveThemePack.importPack=async()=>{throw Error('assets.sky.sha256: mismatch');};await h.controller.choose({name:'bad.chtheme'});assert.match(h.controller.state.status,/assets.sky.sha256/);assert.equal(h.controller.state.draft,null);assert.equal(h.controller.state.busy,false);assert.deepEqual(h.calls,[]);
 h.env.ReserveThemePack.importPack=async()=>({pack:theme});await h.controller.choose({name:'ok.chtheme'});h.env.ReservePacks.installLocal=async()=>{throw Error('Storage full');};await h.controller.action('apply');assert.equal(h.controller.state.status,'Storage full');assert.ok(h.controller.state.draft);assert.equal(h.controller.state.busy,false);
});
test('preset review carries the chosen week, cancellation is inert and removing uses account store',async()=>{
 const h=fixture();h.env.ReservePresetPack.importPack=async()=>({pack:{format:'chpreset',version:1,name:'Exam week',kind:'planner',data:{days:{}}}});
 await h.controller.choose({name:'week.chpreset'});assert.match(h.api.render(h.controller.state,{}),/data-rd-field="make-week"/);h.controller.week('2026-10-26');await h.controller.action('apply');assert.equal(h.calls[0][2],'2026-10-26');
 await h.controller.choose({name:'garden.chtheme'});await h.controller.action('cancel');assert.equal(h.controller.state.draft,null);assert.equal(h.calls.length,1);await h.controller.action('remove','local-id');assert.deepEqual(h.calls[1],['remove','local-id']);
});
test('using an installed file reviews it and reuses its receipt instead of duplicating the install',async()=>{
 const h=fixture();h.saved={settings:{makeYourOwn:{installed:{one:{id:'one',name:'Garden',kind:'theme',pack:theme}}}}};
 const html=h.api.render(h.controller.state,h.store.get().settings);assert.match(html,/data-rd-action="make-remove"/);await h.controller.action('use','one');assert.equal(h.calls.length,0);assert.equal(h.controller.state.draft.id,'one');await h.controller.action('apply');assert.deepEqual(h.calls[0],['use','one','']);
});
test('destroying during validation discards the result without scheduling more work',async()=>{
 const h=fixture();let resolve;h.env.ReserveThemePack.importPack=()=>new Promise(r=>resolve=r);const waiting=h.controller.choose({name:'garden.chtheme'}),before=h.changes;h.controller.destroy();resolve({pack:theme});await waiting;assert.equal(h.controller.state.draft,null);assert.equal(h.changes,before);assert.deepEqual(h.calls,[]);
});
test('account pack references hydrate outside render, stay cached and discard stale reads',async()=>{
 const h=fixture(),requests=[];h.env.ReservePacks.readLocal=(id,options)=>{assert.equal(options.store,h.store);return new Promise(resolve=>requests.push({id,resolve}));};
 h.saved={settings:{makeYourOwn:{theme:{id:'one'},installed:{one:{id:'one',name:'Garden',kind:'theme'}}}}};h.controller.sync();assert.equal(requests.length,1);assert.equal(h.controller.state.theme,null);
 h.api.render(h.controller.state,h.store.get().settings);h.controller.sync();assert.equal(requests.length,1);
 h.saved={settings:{makeYourOwn:{theme:{id:'two'},installed:{two:{id:'two',name:'Second',kind:'theme'}}}}};h.controller.sync();assert.equal(requests.length,2);
 requests[0].resolve({pack:theme});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.controller.state.theme,null);
 const second={...theme,name:'Second'};requests[1].resolve({pack:second});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.controller.state.theme,second);h.controller.sync();assert.equal(requests.length,2);
 h.saved={settings:{makeYourOwn:{installed:{}}}};h.controller.sync();assert.equal(h.controller.state.theme,null);assert.equal(h.controller.state.pet,null);h.controller.destroy();
});
test('dashboard hooks the shared picker, drop zone, review actions and synchronous theme lifecycle',t=>{
 const {fixture:dashboardFixture}=require('./dashboard-heading-fixture.cjs');let choices=0,actions=0,removed=0,applied=0,currentTheme=null;
 const h=dashboardFixture({setup({env}){
  env.ReserveMakeYourOwn={create:()=>({state:{get theme(){return currentTheme;}},choose:async()=>choices++,action:async()=>actions++,week(){},destroy(){}})};
  env.ReserveDataTheme={apply(){applied++;},remove(){removed++;}};
  env.ReserveCustomizeUI={render:()=>'<div class="rd-appearance"><div class="t-acc-panel"><div class="t-acc-panel-inner"><div data-make-drop><input type="file" data-rd-field="make-file"><button data-rd-action="make-apply">Apply</button></div></div></div></div>'};
 }});t.after(()=>h.dashboard.destroy());
 const input=h.container.querySelector('[data-rd-field="make-file"]');input.files=[{name:'look.chtheme'}];h.container.events.get('change')({target:input});assert.equal(choices,1);h.click('make-apply');assert.equal(actions,1);
 let prevented=false;h.container.events.get('drop')({target:input,preventDefault(){prevented=true;},dataTransfer:{files:[{name:'pet.chpet'}]}});assert.equal(prevented,true);assert.equal(choices,2);
 currentTheme=theme;h.store.get().settings.makeYourOwn={theme};h.store.update(()=>{});h.tick(0);assert.equal(applied,1);assert.ok(removed>=1);
});
