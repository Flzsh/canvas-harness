'use strict';
// Megapack (4.2, megapack engine 1): what the student sees and presses for Soul Passage, whose pictures and data come
// down from the Market. The picker's Megapack heading and the choice in its four states (from a faked megapack-state), the
// press (megapack-get, once), the asking that starts with Look and stops with the panel, the megapack's rows in settings
// (Off, Adjust, Reset, Remove; no Remove while the package holds the files) and Biscuit starting the download.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {createDOM}=require('./addons-fixture.cjs'),{fixture:dashboard}=require('./dashboard-heading-fixture.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
const pct=tile=>{const line=tile.querySelector('.mp-line');return line.style['--mp-p']||/--mp-p:(\d+)/.exec(line.getAttribute('style')||'')?.[1];};
const sha=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
// The lead's drawings (megapack-art.json), used as they came: their hashes.
const ART={markGet:'b36eaf7f01865ac3f2782e5eb98d9d751fae5d4652f7662556d3a803516dc869',lineTrack:'2ee2f441ad835d2a7b81f4160ab564e4f61d723d84fdeaf71b29b2a86d12a8e3',lineDone:'85256221b65d8de47ac8e0141fd2b4bf48994f79bd80e297621a489cdb06b700'};
const LINE_CSS='.mp-line{position:relative;display:block;height:9px;container-type:inline-size}.mp-line svg{position:absolute;left:0;top:0;width:100cqw;height:100%;display:block}.mp-done{position:absolute;left:0;top:0;height:100%;width:calc(var(--mp-p,0) * 1%);overflow:hidden;transition:width .4s ease-out}';

// ---- the picker drawn on its own (Make it yours > Look), as customization-scenes.test.cjs draws it
function look(megapack,settings={},{runtime=true}={}){
 const env=vm.createContext({console,ReserveFeatures:{enabled:()=>true},...(runtime?{chrome:{runtime:{getURL:file=>'chrome-extension://test/'+file}}}:{})});
 for(const file of ['workspace-arrange.js','customization-model.js','make-your-own.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});
 const input={s:settings,allCourses:[],courses:[],customizeOpen:true,customizeTab:'scenes',...(megapack===undefined?{}:{megapack})},before=JSON.stringify(input);
 const doc=createDOM('<html><body>'+env.ReserveCustomizeUI.render(input)+'</body></html>');assert.equal(JSON.stringify(input),before,'drawing changes nothing it was given');
 const group=doc.querySelector('[role="radiogroup"][aria-label="Scene"]');assert.ok(group);
 return {doc,group,env,tile:group.querySelector('.cz-mega')||group.querySelector('input[value="train"]')?.closest('label')};
}
// the group's children in order, from the Megapack heading to the next heading
function section(group,name){const kids=group.children,at=kids.findIndex(n=>n.tagName==='H4'&&n.textContent===name),out=[];for(let i=at+1;i<kids.length&&kids[i].tagName!=='H4';i++)out.push(kids[i]);return out;}

test('Megapack is a heading after the Everyday pack, with Soul Passage alone under it',()=>{
 const {group}=look();
 assert.deepEqual(group.querySelectorAll('h4').map(h=>h.textContent),['Holiday pack','Seasonal pack','Everyday pack','Megapack']);
 const everyday=section(group,'Everyday pack'),mega=section(group,'Megapack');
 assert.deepEqual(everyday.map(n=>n.querySelector('input')?.value),['starry','sea','stars','blueprint'],'no longer in the Everyday pack');
 assert.equal(mega.length,1);assert.equal(mega[0].querySelector('input').value,'train');assert.equal(mega[0].querySelector('strong').textContent,'Soul Passage');
 assert.equal(mega[0].querySelector('small'),null,'a name, no description');
 assert.equal(mega[0].querySelector('img').getAttribute('src'),'chrome-extension://test/themes/train/poster.jpg','its packaged poster');
 assert.deepEqual(group.querySelectorAll('input').map(i=>i.value),['','thanksgiving','christmas','maple','starry','sea','stars','blueprint','train'],'one radio group, the same order');
});

test('here (packaged, or not asked yet): an ordinary choice exactly like the other scenes, no tag, no Remove',()=>{
 for(const megapack of [undefined,{state:'here',bundled:true,pace:2},{pace:2}]){
  const {group,tile,doc}=look(megapack);
  assert.equal(tile.tagName,'LABEL');assert.equal(tile.className,'cz-choice');assert.equal(group.querySelector('.cz-mega'),null);
  assert.equal(tile.outerHTML,group.querySelector('input[value="blueprint"]').closest('label').outerHTML.replace(/blueprint/g,'train').replace('>Blueprint<','>Soul Passage<'),'the same markup as Blueprint\'s');
  assert.equal(doc.querySelector('[data-rd-action="megapack-remove"]'),null);assert.equal(doc.querySelector('[data-rd-action="megapack-get"]'),null);
 }
 // worn while packaged: Adjust (speed, land, time) and Reset in its "Use from" group, Off is "Use default theme"; still no Remove
 const {doc}=look({state:'here',bundled:true,pace:2},{sceneTheme:'train'});
 assert.equal(doc.querySelectorAll('[data-rd-field="megapack-adjust"]').length,18,'4 speeds, Today and the seven lands (4.2.2), 6 lights');assert.equal(doc.querySelector('[role="radiogroup"][aria-label="Speed"]').closest('.cz-group').querySelector('[data-rd-action="make-reset"]').dataset.id,'builtin:scene:train');
 assert.equal(doc.querySelector('[data-rd-action="make-clear"]').textContent,'Use default theme');assert.equal(doc.querySelector('[data-rd-action="megapack-remove"]'),null);
});

test('not on this machine (and failed): a button, not a radio, with the lead\'s tag; its name says download',()=>{
 for(const megapack of [{state:'none',pace:2},{state:'failed',reason:'The download stopped.',pace:2}]){
  const {group,tile}=look(megapack);
  assert.equal(tile.tagName,'BUTTON');assert.equal(tile.getAttribute('type'),'button');assert.equal(tile.dataset.rdAction,'megapack-get');assert.equal(tile.dataset.mp,'none');
  assert.equal(tile.getAttribute('aria-label'),'Soul Passage, download');assert.equal(tile.hasAttribute('aria-disabled'),false);
  assert.equal(group.querySelector('input[value="train"]'),null,'not a radio');assert.equal(group.querySelectorAll('input').length,8);
  assert.equal(tile.querySelector('img.cz-scene-poster').getAttribute('src'),'chrome-extension://test/themes/train/poster.jpg');
  const mark=tile.querySelector('.cz-mega-mark');assert.equal(mark.getAttribute('aria-hidden'),'true');assert.ok(mark.querySelector('svg'),'the tag at its top right');
  assert.equal(tile.querySelector('strong').textContent,'Soul Passage');assert.equal(tile.querySelector('.mp-line'),null);
 }
});

test('coming down: the lead\'s filling line on a paper strip, --mp-p from done/total, pressing does nothing, quiet line',()=>{
 const {tile}=look({state:'getting',done:11793315,total:33695184,pace:2});
 assert.equal(tile.tagName,'BUTTON');assert.equal(tile.dataset.mp,'getting');assert.equal(tile.getAttribute('aria-disabled'),'true','a press does nothing (and focus stays)');
 assert.equal(tile.getAttribute('aria-label'),'Soul Passage, 35 percent');
 const strip=tile.querySelector('.cz-mega-line');assert.equal(strip.getAttribute('aria-hidden'),'true');assert.equal(tile.querySelector('[aria-live]'),null,'not announced on every step');
 assert.equal(strip.querySelector('.mp-line').getAttribute('style'),'--mp-p:35');assert.ok(strip.querySelector('.mp-line > .mp-done'));
 assert.equal(tile.querySelector('.cz-mega-mark'),null);
 assert.equal(look({state:'getting',done:5,total:0,pace:2}).tile.getAttribute('aria-label'),'Soul Passage, 0 percent','no total yet: an empty line');
 const full=look({state:'getting',done:33695184,total:33695184,pace:2}).tile;assert.equal(full.getAttribute('aria-label'),'Soul Passage, 100 percent');assert.ok(full.hasAttribute('data-mp-full'));
});

test('the drawings are the lead\'s, as they came, and the line keeps its own rules',()=>{
 const source=read('customize-ui.js'),art=JSON.parse('{'+/const MP_ART=Object\.freeze\(\{([\s\S]*?)\}\);/.exec(source)[1].replace(/(markGet|lineTrack|lineDone):/g,'"$1":')+'}');
 for(const [key,hash]of Object.entries(ART))assert.equal(sha(art[key]),hash,key+' unchanged');
 const none=look({state:'none',pace:2}).env,getting=look({state:'getting',done:1,total:2,pace:2}).env;
 const html=megapack=>none.ReserveCustomizeUI.render({s:{},allCourses:[],courses:[],customizeOpen:true,customizeTab:'scenes',megapack});
 assert.ok(html({state:'none',pace:2}).includes('<span class="cz-mega-mark" aria-hidden="true">'+art.markGet+'</span>'),'the tag, verbatim');
 assert.ok(getting.ReserveCustomizeUI.render({s:{},allCourses:[],courses:[],customizeOpen:true,customizeTab:'scenes',megapack:{state:'getting',done:1,total:2}}).includes('<span class="mp-line" style="--mp-p:50">'+art.lineTrack+'<span class="mp-done">'+art.lineDone+'</span></span>'),'the line, verbatim');
 const css=read('settings-dock.css');for(const rule of LINE_CSS.split('}').filter(Boolean)){const [selector,body]=rule.split('{');assert.ok(css.includes('.rd .cz-mega-line '+selector+'{'+body+'}'),selector+' as it came');}
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{[^}]*\.cz-mega-line \.mp-done[^}]*transition:none/,'no easing with reduced motion');
});

test('downloaded and here: the ordinary choice carries Remove, and Reset once the speed or a part was changed',()=>{
 let {tile,doc}=look({state:'here',bundled:false,pace:2});
 assert.equal(tile.className,'cz-choice cz-mega cz-mega-here');const radio=tile.querySelector('label.cz-mega-pick input[type="radio"]');
 assert.deepEqual([radio.getAttribute('name'),radio.dataset.rdField,radio.dataset.setting,radio.value],['cz-sceneTheme','setting','sceneTheme','train']);
 assert.deepEqual(tile.querySelectorAll('.ch-make-chip').map(b=>[b.dataset.rdAction,b.textContent,b.querySelector('.ch-make-chip-ic').dataset.ic,b.getAttribute('aria-label')]),[['megapack-remove','Remove','remove','Remove Soul Passage']],'Remove only: nothing to reset');
 assert.equal(doc.querySelector('[data-rd-field="megapack-adjust"]'),null,'not worn: no Adjust');
 ({tile}=look({state:'here',bundled:false,pace:3}));assert.deepEqual(tile.querySelectorAll('.ch-make-chip').map(b=>b.dataset.rdAction),['make-reset','megapack-remove']);assert.equal(tile.querySelector('[data-rd-action="make-reset"]').dataset.id,'builtin:scene:train');assert.equal(tile.querySelector('[data-rd-action="make-reset"]').getAttribute('aria-label'),'Reset Soul Passage');
 ({tile}=look({state:'here',bundled:true,pace:3}));assert.deepEqual(tile.querySelectorAll('.ch-make-chip').map(b=>b.dataset.rdAction),['make-reset'],'packaged: Reset, never Remove');
 ({tile}=look({state:'here',bundled:false,pace:2},{makeYourOwn:{adjustments:{'builtin:scene:train':{parts:{banner:false}}}}}));assert.deepEqual(tile.querySelectorAll('.ch-make-chip').map(b=>b.dataset.rdAction),['make-reset','megapack-remove']);
 ({tile}=look({state:'here',bundled:false,pace:2,busy:true}));assert.ok(tile.querySelector('[data-rd-action="megapack-remove"]').hasAttribute('disabled'),'busy while it works');
 const worn=look({state:'here',bundled:false,pace:1},{sceneTheme:'train'});assert.equal(worn.tile.querySelector('input').hasAttribute('checked'),true,'the chosen one');
 const speed=worn.doc.querySelector('[role="radiogroup"][aria-label="Speed"]');assert.equal(speed.querySelectorAll('input').filter(i=>i.hasAttribute('checked')).map(i=>i.value).join(),'1','Slow, as kept');
 const group=speed.closest('.cz-group');assert.equal(group.querySelector('h3').textContent,'Use from Soul Passage');assert.ok(group.querySelector('[data-rd-field="make-part"][data-part="banner"]'),'beside the parts');
 assert.equal(group.querySelector('[data-rd-action="make-reset"]').textContent,'Reset to how it came');assert.equal(group.querySelector('[data-rd-action="make-reset"]').dataset.id,'builtin:scene:train');
 assert.doesNotMatch(worn.doc.body.textContent,/CH\+/,'Canvas Harness, never the private build\'s name');
});

test('without an extension runtime the choice stays drawn (the plain illustration) and nothing breaks',()=>{
 const {tile}=look({state:'none',pace:2},{},{runtime:false});assert.equal(tile.tagName,'BUTTON');assert.equal(tile.querySelector('img'),null);assert.ok(tile.querySelector('svg'));
});

// ---- the worker's side as the page sees it (make-your-own.js megapack): messages and Biscuit's choice
function helper(answer){
 const sent=[],stored=[],env=vm.createContext({console,KeyboardEvent:class{constructor(type,init){this.type=type;Object.assign(this,init);}}});
 if(answer)env.chrome={runtime:{sendMessage:async message=>{sent.push(plain(message));const a=answer(message);if(a instanceof Error)throw a;return a;}},storage:{local:{set:async value=>{stored.push(plain(value));}}}};
 for(const file of ['make-your-own.js'])vm.runInContext(read(file),env,{filename:file});
 return {M:env.ReserveMakeYourOwn.megapack,sent,stored};
}
test('the page asks the worker exactly as the protocol says: megapack-state, megapack-get (owner), megapack-remove',async()=>{
 let h=helper(m=>m.type==='megapack-state'?{ok:true,state:'getting',done:10,total:40,at:7}:m.type==='megapack-get'?{ok:true,state:'getting'}:{ok:true});
 assert.deepEqual(plain(await h.M.state()),{state:'getting',done:10,total:40,bundled:false,reason:'',at:7});
 await h.M.get({origin:'https://school.instructure.com',accountId:'5',extra:'x'});await h.M.remove();
 assert.deepEqual(h.sent,[{type:'megapack-state',id:'soul-passage'},{type:'megapack-get',id:'soul-passage',owner:{origin:'https://school.instructure.com',accountId:'5'}},{type:'megapack-remove',id:'soul-passage'}]);
 h=helper(()=>({ok:true,state:'here',bundled:true}));assert.deepEqual(plain(await h.M.state()),{state:'here',done:0,total:0,bundled:true,reason:'',at:0});
 for(const bad of [{ok:false,reason:'Invalid megapack request.'},{ok:true,state:'odd'},null,new Error('Extension context invalidated.')]){h=helper(()=>bad);assert.equal(await h.M.state(),null,JSON.stringify(bad));}
 h=helper(()=>new Error('Could not establish connection.'));assert.deepEqual(plain(await h.M.get()),{ok:false,reason:'Could not establish connection.'});assert.deepEqual(h.sent,[{type:'megapack-get',id:'soul-passage'}]);
 assert.equal(await helper().M.state(),null,'no runtime: no answer');
});
test('a scene asked for by name: with the files here or another scene nothing is sent but the state; otherwise the download starts once',async()=>{
 let h=helper(()=>({ok:true,state:'here'}));assert.equal(await h.M.choose('starry'),null);assert.deepEqual(h.sent,[],'another scene: no message');
 assert.equal(await h.M.choose('train'),null);assert.deepEqual(h.sent.map(m=>m.type),['megapack-state'],'here: as today');
 h=helper(m=>m.type==='megapack-state'?{ok:true,state:'none'}:{ok:true,state:'getting'});
 assert.deepEqual(plain(await h.M.choose('train',{owner:{origin:'https://school.instructure.com',accountId:'5'}})),{ok:true,state:'getting',message:'Getting Soul Passage from the Market. It goes on once it is here.'});
 assert.deepEqual(h.sent.map(m=>m.type),['megapack-state','megapack-get']);
 h=helper(m=>m.type==='megapack-state'?{ok:true,state:'failed',reason:'x'}:{ok:true,state:'getting'});assert.equal((await h.M.choose('train')).state,'getting','a failed one is asked again');
 h=helper(()=>({ok:true,state:'getting',done:1,total:9}));assert.deepEqual(plain(await h.M.choose('train')),{ok:true,state:'getting',message:'Soul Passage is still coming down.'});assert.deepEqual(h.sent.map(m=>m.type),['megapack-state'],'running: not asked twice');
 h=helper(m=>m.type==='megapack-state'?{ok:true,state:'none'}:{ok:false,reason:'Update Canvas Harness to add this'});assert.deepEqual(plain(await h.M.choose('train')),{ok:false,message:'Update Canvas Harness to add this'});
 h=helper(m=>m.type==='megapack-state'?{ok:true,state:'none'}:{ok:true,state:'here'});assert.equal(await h.M.choose('train'),null,'it was here after all: as today');
});
test('the speed stop is only written where the theme reads it (the scene moves the lever and the ride itself)',()=>{
 const h=helper(()=>({ok:true}));
 for(const n of [0,3,1])assert.equal(h.M.speed(n),true);assert.deepEqual(h.stored,[{'reserve:train-pace':0},{'reserve:train-pace':3},{'reserve:train-pace':1}]);
 for(const bad of [4,-1,1.5,'2',null])assert.equal(h.M.speed(bad),false,String(bad));assert.equal(h.stored.length,3,'nothing else written');
});

// ---- the real dashboard (tests/dashboard-heading-fixture.cjs): the press, the asking, the rows, Biscuit
function mounted(t,{state,get,settings={},owner=true,pets=false}={}){
 const sent=[],stored={},listeners=[],uses=[],resets=[],said=[];let companion=null,got=false;
 // the worker: once asked to get, it says the files are coming down
 state??=()=>got?{ok:true,state:'getting',done:0,total:33695184}:{ok:true,state:'none'};get??=()=>{got=true;return {ok:true,state:'getting'};};
 const f=dashboard({courseId:'all',setup:({env,store})=>{
  env.ReserveFeatures={enabled:()=>true,KEY:'reserve:features',catalogue:[],normalize:()=>({preset:'full',custom:[]}),resolve:()=>({enabled:[]}),current:{enabled:[]}};
  env.KeyboardEvent=class{constructor(type,init){this.type=type;Object.assign(this,init);}};
  env.chrome={runtime:{getURL:file=>'chrome-extension://test/'+file,sendMessage:async message=>{sent.push(plain(message));if(message.type==='megapack-state')return state(message);if(message.type==='megapack-get')return get(message);if(message.type==='megapack-remove')return {ok:true};return {ok:false,reason:'Not in this test.'};}},
   storage:{local:{get:async()=>({}),set:async value=>{Object.assign(stored,plain(value));for(const listen of [...listeners])listen(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,{newValue:v}])),'local');},remove:async key=>{for(const k of [key].flat())delete stored[k];for(const listen of [...listeners])listen(Object.fromEntries([key].flat().map(k=>[k,{newValue:undefined}])),'local');}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:fn=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);}}}};
  // (the public packs.js has no useInstalled or resetInstalled: a scene goes on and off through the account's store)
  env.ReservePacks={catalogue:async()=>[],isCurrent:()=>false};
  if(owner)store.owner={origin:'https://school.instructure.com',accountId:'5'};
  const files=['workspace-arrange.js','customization-model.js','settings-dock.js','make-your-own.js','customize-ui.js','addons-art.js','addons-panel.js'];
  if(pets){env.ReservePonyBrain=require('../extension/pony-brain.js');env.ReservePonyAsk=require('../extension/pony-ask.js');files.push('planner-model.js','planner-ui.js','pet-art.js','pets.js','widgets.js');}
  for(const file of files)vm.runInContext(read(file),env,{filename:file});
  if(pets)env.ReservePets={...env.ReservePets,create:options=>{companion=options;return {sync(){},setFocus(){},destroy(){}};}};
  vm.runInContext(read('dashboard.js'),env,{filename:'dashboard.js'});
  const data=store.get();Object.assign(data,{tasks:{},customTasks:[],toolbox:{scratchpad:''},focus:{minutes:25,remaining:1500,endsAt:null},pet:{name:'Pip',knowledge:'most',enabled:true,nudges:'off'}});Object.assign(data.settings,plain(env.ReserveCustomization.defaults),settings);
  const say=env.ReserveMakeYourOwn.create;env.ReserveMakeYourOwn.create=options=>{const c=say(options),own=c.say;c.say=text=>{said.push(text);own(text);};return c;};
 }});
 t.after(()=>f.dashboard.destroy());
 const asked=type=>sent.filter(m=>m.type===type).length,tile=()=>f.container.querySelector('.cz-mega')||f.container.querySelector('input[data-setting="sceneTheme"][value="train"]')?.closest('label');
 const press=target=>{target.focus({preventScroll:true});f.container.events.get('click')({detail:1,target,preventDefault(){}});};
 const change=target=>f.container.events.get('change')({target});
 const close=()=>f.click('settings-close');
 const settle=async()=>{for(let i=0;i<3;i++){await flush();f.tick(0);}await flush();};
 return {...f,sent,stored,uses,resets,said,asked,tile,press,change,close,settle,get companion(){return companion;},listeners};
}

// (4.2, roadmap item 5: the scenes moved from Look to Scenes; the picker asks when Scenes opens)
test('the picker asks when Scenes opens, not before; a press sends megapack-get once and shows the line at once',async t=>{
 let answer={ok:true,state:'none'};const h=mounted(t,{state:()=>answer,get:()=>{answer={ok:true,state:'getting',done:0,total:33695184};return {ok:true,state:'getting'};}});await h.settle();
 assert.equal(h.asked('megapack-state'),0,'nothing asked while the panel is shut');
 h.click('settings');await h.settle();assert.equal(h.asked('megapack-state'),0,'Look first: nothing asked');h.press(h.container.querySelector('[data-rd-action="customize-tab"][data-value="scenes"]'));await h.settle();assert.equal(h.asked('megapack-state'),1,'asked once when Scenes opens');
 let tile=h.tile();assert.equal(tile.tagName,'BUTTON');assert.equal(tile.getAttribute('aria-label'),'Soul Passage, download');
 h.press(tile);h.tick(0);assert.equal(h.tile().dataset.mp,'getting','the line at once, before the worker answers');assert.equal(h.tile().getAttribute('aria-disabled'),'true');
 assert.equal(h.document.activeElement,h.tile(),'focus stays on the choice');
 await h.settle();assert.deepEqual(h.sent.filter(m=>m.type==='megapack-get'),[{type:'megapack-get',id:'soul-passage',owner:{origin:'https://school.instructure.com',accountId:'5'}}]);
 h.press(h.tile());h.press(h.tile());await h.settle();assert.equal(h.asked('megapack-get'),1,'pressing again does nothing');
 // twice a second while it comes down: the line and the name move in place
 answer={ok:true,state:'getting',done:11793315,total:33695184};const before=h.asked('megapack-state');h.tick(500);await h.settle();
 assert.ok(h.asked('megapack-state')>before,'asked again after half a second');assert.equal(pct(h.tile()),'35');
 h.document.activeElement=null;answer={ok:true,state:'getting',done:23586629,total:33695184};h.tick(500);await h.settle();assert.equal(h.tile().getAttribute('aria-label'),'Soul Passage, 70 percent');assert.equal(pct(h.tile()),'70');
 // focused: the number in its name is not rewritten on every step
 h.tile().focus({preventScroll:true});answer={ok:true,state:'getting',done:30325666,total:33695184};h.tick(500);await h.settle();assert.equal(h.tile().getAttribute('aria-label'),'Soul Passage, 70 percent');assert.equal(pct(h.tile()),'90');
 // shut: no more asking
 h.close();await h.settle();const shut=h.asked('megapack-state');h.tick(3000);await h.settle();assert.equal(h.asked('megapack-state'),shut,'stops when the picker closes');
 // open again: asked again; it ended meanwhile and the worker saved the scene: an ordinary choice, the chosen one, with Remove
 answer={ok:true,state:'here'};h.store.get().settings.sceneTheme='train';h.click('settings');await h.settle();assert.equal(h.asked('megapack-state'),shut+1);
 tile=h.tile();assert.equal(tile.className,'cz-choice cz-mega cz-mega-here');assert.equal(tile.querySelector('input').checked,true);assert.ok(tile.querySelector('[data-rd-action="megapack-remove"]'));
 h.tick(3000);await h.settle();assert.equal(h.asked('megapack-state'),shut+1,'here: no more asking');
 // another tab of Make it yours: not the picker, nothing asked
 h.press(h.container.querySelector('[data-rd-action="customize-tab"][data-value="layout"]'));await h.settle();h.tick(3000);await h.settle();assert.equal(h.asked('megapack-state'),shut+1);
});

test('the download ending while Scenes shows: the choice becomes ordinary, the chosen one, and keeps focus',async t=>{
 let answer={ok:true,state:'getting',done:1,total:2};const h=mounted(t,{state:()=>answer});h.click('settings');await h.settle();h.press(h.container.querySelector('[data-rd-action="customize-tab"][data-value="scenes"]'));await h.settle();
 h.tile().focus({preventScroll:true});answer={ok:true,state:'here'};h.store.get().settings.sceneTheme='train';h.tick(500);await h.settle();
 const radio=h.container.querySelector('input[data-setting="sceneTheme"][value="train"]');assert.ok(radio);assert.equal(radio.checked,true);assert.equal(h.document.activeElement,radio,'focus moves to the chosen one');
});

test('a download just asked for whose progress is not written yet is not shown as "not on this machine"',async t=>{
 let answer={ok:true,state:'none'};const h=mounted(t,{state:()=>answer,get:()=>({ok:true,state:'getting'})});h.click('settings');await h.settle();h.press(h.container.querySelector('[data-rd-action="customize-tab"][data-value="scenes"]'));await h.settle();
 h.press(h.tile());await h.settle();assert.equal(h.tile().dataset.mp,'getting','the worker said none a moment after the get: still the line');
 h.tick(500);await h.settle();assert.equal(h.tile().dataset.mp,'getting');const n=h.asked('megapack-state');
 answer={ok:true,state:'getting',done:5,total:10};h.tick(500);await h.settle();assert.ok(h.asked('megapack-state')>n,'still asked');assert.equal(pct(h.tile()),'50');
 answer={ok:true,state:'none'};h.tick(4000);await h.settle();assert.equal(h.tile().dataset.mp,'none','later, "none" is believed (Remove from another page)');
});

test('failed: back to "not on this machine", the reason said once on the status line a failed Market add uses',async t=>{
 let answer={ok:true,state:'getting',done:3,total:9};const h=mounted(t,{state:()=>answer});h.click('settings');await h.settle();h.press(h.container.querySelector('[data-rd-action="customize-tab"][data-value="scenes"]'));await h.settle();
 const reason='The connection to the Market was lost. The download goes on from where it stopped.';
 answer={ok:true,state:'failed',done:3,total:9,reason,at:42};h.tick(500);await h.settle();
 const tile=h.tile();assert.equal(tile.tagName,'BUTTON');assert.equal(tile.dataset.mp,'none');assert.equal(tile.getAttribute('aria-label'),'Soul Passage, download');
 const status=h.container.querySelector('.ch-make-files p[role="status"]');assert.ok(status,'the status line of Make it yours');assert.equal(status.textContent,reason);
 assert.deepEqual(h.said.filter(Boolean),[reason]);const n=h.asked('megapack-state');h.tick(2000);await h.settle();assert.equal(h.asked('megapack-state'),n,'no more asking');
 h.close();await h.settle();h.click('settings');await h.settle();assert.deepEqual(h.said.filter(Boolean),[reason],'the same failure is not said again');
 // a worker that refuses at once
 const r=mounted(t,{get:()=>({ok:false,reason:'Update Canvas Harness to add this'})});r.click('settings');await r.settle();r.press(r.container.querySelector('[data-rd-action="customize-tab"][data-value="scenes"]'));await r.settle();r.press(r.tile());await r.settle();
 assert.equal(r.tile().dataset.mp,'none');assert.equal(r.container.querySelector('.ch-make-files p[role="status"]').textContent,'Update Canvas Harness to add this');
});

test('settings rows: Adjust sets the stop, Reset sends it to Cruise, Off is the default theme, Remove sends megapack-remove',async t=>{
 let answer={ok:true,state:'here'};const h=mounted(t,{state:()=>answer,settings:{sceneTheme:'train'}});h.click('settings');await h.settle();h.press(h.container.querySelector('[data-rd-action="customize-tab"][data-value="scenes"]'));await h.settle();
 // Adjust: a drawn choice in each group writes what the scene and the popup read (no key events: the scene hears the store)
 const pick=(kind,value)=>{const input=h.container.querySelectorAll('input[data-rd-field="megapack-adjust"]').find(i=>i.dataset.adjust===kind&&i.value===value);assert.ok(input,kind+' '+value);input.checked=true;h.change(input);};
 pick('pace','3');await h.settle();assert.equal(h.stored['reserve:train-pace'],3);assert.deepEqual(h.tile().querySelectorAll('.ch-make-chip').map(b=>b.dataset.rdAction),['make-reset','megapack-remove'],'changed: Reset appears');
 pick('land','4');await h.settle();assert.deepEqual(h.stored['reserve:train-preview'],{day:4});
 pick('time','17');await h.settle();assert.deepEqual(h.stored['reserve:train-preview'],{day:4,hour:17});
 assert.equal(h.container.querySelectorAll('input[data-rd-field="megapack-adjust"]').filter(i=>i.dataset.adjust==='land').length,8,'Today and the seven lands');
 pick('land','');await h.settle();assert.deepEqual(h.stored['reserve:train-preview'],{hour:17},'Today: the clock\'s land, the light kept');
 assert.deepEqual(['pace','land','time'].map(k=>h.container.querySelectorAll('input[data-rd-field="megapack-adjust"]').filter(i=>i.dataset.adjust===k&&i.checked).map(i=>i.value).join()),['3','','17'],'drawn as kept');
 pick('pace','2');await h.settle();assert.deepEqual(h.tile().querySelectorAll('.ch-make-chip').map(b=>b.dataset.rdAction),['make-reset','megapack-remove'],'Cruise, but the light still changed: Reset stays');
 pick('pace','0');await h.settle();
 // Reset: Cruise, Today, Now and the parts back
 h.press(h.container.querySelector('.cz-group [data-rd-action="make-reset"]'));await h.settle();assert.equal(h.stored['reserve:train-pace'],2,'Cruise');assert.equal(Object.hasOwn(h.stored,'reserve:train-preview'),false,'Today and Now: the record gone');
 assert.deepEqual(h.tile().querySelectorAll('.ch-make-chip').map(b=>b.dataset.rdAction),['megapack-remove'],'nothing to reset');
 // Off: Use default theme (the scene none, the files kept: nothing goes to the worker)
 const before=h.sent.length;h.press(h.container.querySelector('[data-rd-action="make-clear"]'));await h.settle();assert.equal(h.store.get().settings.sceneTheme,'','the scene none');assert.equal(h.sent.slice(before).filter(m=>m.type==='megapack-remove').length,0);
 // Remove
 answer={ok:true,state:'none'};h.press(h.container.querySelector('[data-rd-action="megapack-remove"]'));await h.settle();
 assert.deepEqual(h.sent.filter(m=>m.type==='megapack-remove'),[{type:'megapack-remove',id:'soul-passage'}]);assert.equal(h.tile().dataset.mp,'none','the tag again');assert.ok(h.said.includes('Removed'));
 // packaged: no Remove anywhere
 const p=mounted(t,{state:()=>({ok:true,state:'here',bundled:true}),settings:{sceneTheme:'train'}});p.click('settings');await p.settle();p.press(p.container.querySelector('[data-rd-action="customize-tab"][data-value="scenes"]'));await p.settle();assert.equal(p.container.querySelector('[data-rd-action="megapack-remove"]'),null);assert.ok(p.container.querySelector('[data-rd-field="megapack-adjust"]'));
});

test('the settings dock lists the downloaded megapack with Use (and off again), Reset and Remove; not while packaged',async t=>{
 const open=async h=>{h.click('settings');await h.settle();h.press(h.container.querySelector('[data-rd-action="customize-tab"][data-value="settings"]'));await h.settle();return h.container.querySelector('#features-panel');};
 const rows=panel=>panel.querySelectorAll('.ap-row').filter(r=>r.querySelector('[data-remove-pack]'));
 const h=mounted(t,{state:()=>({ok:true,state:'here'})});let panel=await open(h);assert.ok(panel,'the Features list');
 const row=rows(panel).find(r=>r.textContent.includes('Soul Passage'));assert.ok(row,'Soul Passage among the installed');
 assert.equal(row.querySelector('.ap-kind').textContent,'megapack · From the Market');assert.equal(row.querySelector('img').getAttribute('src'),'chrome-extension://test/themes/train/poster.jpg');
 const button=key=>h.container.querySelector('#features-panel').querySelectorAll('button').find(b=>b.dataset[key]==='megapack:soul-passage');
 const hit=key=>{const target=button(key);assert.ok(target,key);target.closest('section.ap').events.get('click')({target});};
 hit('usePack');await h.settle();assert.equal(h.store.get().settings.sceneTheme,'train','Use: on');
 assert.equal(button('usePack').getAttribute('aria-pressed'),'true');
 hit('usePack');await h.settle();assert.equal(h.store.get().settings.sceneTheme,'','pressed again: off (the files kept)');assert.equal(h.sent.filter(m=>m.type==='megapack-remove').length,0);
 h.stored['reserve:train-preview']={day:1,hour:8};hit('resetPack');await h.settle();assert.equal(h.stored['reserve:train-pace'],2,'Cruise');assert.equal(Object.hasOwn(h.stored,'reserve:train-preview'),false,'Today and Now');
 hit('removePack');await h.settle();assert.deepEqual(h.sent.filter(m=>m.type==='megapack-remove'),[{type:'megapack-remove',id:'soul-passage'}]);
 const p=mounted(t,{state:()=>({ok:true,state:'here',bundled:true})}),panel2=await open(p);assert.equal(rows(panel2).filter(r=>r.textContent.includes('Soul Passage')).length,0,'nothing to remove while the package holds the files');
});

test('Biscuit: asked for Soul Passage while it is not here he starts the download and says so; with it here, as today',async t=>{
 const h=mounted(t,{pets:true});await h.settle();assert.ok(h.companion?.actions?.setting,'the companion\'s actions');
 const result=await h.companion.actions.setting({key:'sceneTheme',value:'train'});await h.settle();
 assert.equal(result.ok,true);assert.equal(result.message,'Getting Soul Passage from the Market. It goes on once it is here.');
 assert.deepEqual(h.sent.filter(m=>m.type.startsWith('megapack-')).map(m=>m.type),['megapack-state','megapack-get']);assert.equal(h.store.get().settings.sceneTheme,'','no scene that cannot show');
 const again=await h.companion.actions.setting({key:'sceneTheme',value:'train'});assert.equal(again.message,'Soul Passage is still coming down.');assert.equal(h.asked('megapack-get'),1,'not started twice');
 const here=mounted(t,{pets:true,state:()=>({ok:true,state:'here',bundled:true})});await here.settle();
 const ok=await here.companion.actions.setting({key:'sceneTheme',value:'train'});await here.settle();assert.notEqual(ok,false);assert.equal(here.store.get().settings.sceneTheme,'train');assert.equal(here.asked('megapack-get'),0);
 const other=await here.companion.actions.setting({key:'sceneTheme',value:'starry'});await here.settle();assert.notEqual(other,false);assert.equal(here.store.get().settings.sceneTheme,'starry');
});
