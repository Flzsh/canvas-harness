'use strict';
// Soul Passage's Adjust (4.2, decision D5): in Make it yours > Look > "Use from Soul Passage", three groups of drawn choices in
// the picker's own form (Graphics is the model): Speed (4), Land (8: Today and the seven lands, 4.2.2), Time (6). The lead's drawings, verbatim; the values the
// popup's Scenery keeps (reserve:train-preview) and the lever's stops (reserve:train-pace); the popup and the picker agree.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {createDOM}=require('./addons-fixture.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),dense=s=>s.replace(/\n[ \t]*/g,'')/* (the public file spreads long lines: the source checks read it joined again) */,plain=value=>JSON.parse(JSON.stringify(value));
const sha=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
// the lead's drawings: the hash of each group's strings, in order
// (4.2.2: land is 4.2.1's drawings without the deep sea's, which went with its land)
const ART={speed:'027293c903a91874540d4d51783904d6063b31b2645c4c8f7e0b7a4a74869d6f',land:'ba9666b7c778fb58c24a8dfbb4b147016a645e919a55ed8dc2fa49c8cfbfe1ef',time:'a8aef6fd7c124fcb5ea793999da778658b0bbbd3e6fbb7c4ad8eb91ca0341d03'};
const SPEED=[['0','Stopped'],['1','Slow'],['2','Cruise'],['3','Fast']];
const LAND=[['','Today'],['1','Mirror sea'],['2','Rain village'],['3','Above the clouds'],['4','Canal street'],['5','City of arches'],['6','Factory'],['0','Forest of giants']];
const TIME=[['','Now'],['8','Morning'],['12.5','Noon'],['17','Sunset'],['21','Dusk'],['1','Night']];
function look(megapack,settings={sceneTheme:'train'}){
 const env=vm.createContext({console,ReserveFeatures:{enabled:()=>true},chrome:{runtime:{getURL:file=>'chrome-extension://test/'+file}}});
 for(const file of ['workspace-arrange.js','customization-model.js','make-your-own.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});
 const doc=createDOM('<html><body>'+env.ReserveCustomizeUI.render({s:settings,allCourses:[],courses:[],customizeOpen:true,customizeTab:'scenes',megapack})+'</body></html>');
 const group=doc.querySelectorAll('.cz-group').find(g=>g.querySelector('h3')?.textContent==='Use from Soul Passage');
 return {doc,group,radios:label=>doc.querySelector(`[role="radiogroup"][aria-label="${label}"]`)};
}
const art=()=>JSON.parse('{'+/const MP_ADJUST=Object\.freeze\(\{speed:Object\.freeze\((\[[\s\S]*?\])\),\s*land:Object\.freeze\((\{[\s\S]*?\})\),\s*time:Object\.freeze\((\{[\s\S]*?\})\)\}\);/.exec(dense(read('customize-ui.js'))).slice(1).map((part,i)=>JSON.stringify(['speed','land','time'][i])+':'+part.replace(/([{,])([a-z]+):"/g,'$1"$2":"')).join(',')+'}');

test('three groups of drawn choices in "Use from Soul Passage": Speed (4 across), Land and Time (3 across), named, in order',()=>{
 const {group,radios}=look({state:'here',bundled:true,pace:2});assert.ok(group);
 assert.deepEqual(group.querySelectorAll('h4.cz-subhead').map(h=>h.textContent),['Speed','Land','Time']);
 for(const [label,list,cols,name] of [['Speed',SPEED,'4','pace'],['Land',LAND,'3','land'],['Time',TIME,'3','time']]){
  const g=radios(label);assert.ok(g&&group.contains(g),label);assert.equal(g.dataset.cols,cols);assert.ok(g.classList.contains('cz-choices')&&g.classList.contains('cz-mega-adjust'));
  const labels=g.querySelectorAll('label.cz-choice');assert.deepEqual(labels.map(l=>[l.querySelector('input').value,l.querySelector('strong').textContent]),list,label+': values and names');
  for(const l of labels){const input=l.querySelector('input');assert.deepEqual([input.type,input.getAttribute('name'),input.dataset.rdField,input.dataset.adjust],['radio','cz-'+name,'megapack-adjust',name]);
   assert.equal(l.querySelector('small'),null,'a name, no description');const svg=l.querySelector('.cz-choice-art svg');assert.equal(svg.getAttribute('viewBox'),'0 0 72 48');assert.equal(svg.getAttribute('aria-hidden'),'true');}
 }
 assert.equal(group.querySelector('select'),null,'no plain select');assert.equal(group.querySelectorAll('[data-rd-field="megapack-adjust"]').filter(i=>i.type!=='radio').length,0);
 // the parts come first, Reset after the three groups; nothing else in Look changes: the same groups as for another scene
 const order=group.children.map(n=>n.tagName==='H4'?'h4:'+n.textContent:n.className.split(' ')[0]);assert.deepEqual(order.slice(-7),['h4:Speed','cz-choices','h4:Land','cz-choices','h4:Time','cz-choices','rd-text-button']);
 assert.equal(group.children.at(-1).dataset.rdAction,'make-reset');assert.ok(group.children.findIndex(n=>n.classList?.contains('cz-toggles'))<group.children.findIndex(n=>n.tagName==='H4'));
 const other=look({state:'here',bundled:true,pace:2},{sceneTheme:'starry'}),titles=d=>d.querySelectorAll('.cz-group h3').map(h=>h.textContent);
 assert.deepEqual(titles(look({state:'here',bundled:true,pace:2}).doc).map(t=>t.replace('Soul Passage','X')),titles(other.doc).map(t=>t.replace('Starry Night','X')),'Look keeps its groups');
 assert.doesNotMatch(group.textContent,/CH\+/);
});

test('the chosen ones are what is kept; busy: disabled; not on this machine or not worn: absent',()=>{
 const checked=(r,label)=>r(label).querySelectorAll('input').filter(i=>i.hasAttribute('checked')).map(i=>i.value);
 let v=look({state:'here',pace:3,land:'4',time:'17'});assert.deepEqual([checked(v.radios,'Speed'),checked(v.radios,'Land'),checked(v.radios,'Time')],[['3'],['4'],['17']]);
 v=look({state:'here',pace:2,land:'4o'});assert.deepEqual(checked(v.radios,'Land'),[''],'the deep sea\'s old value is no choice now: Today');
 v=look({state:'here',pace:2});assert.deepEqual([checked(v.radios,'Speed'),checked(v.radios,'Land'),checked(v.radios,'Time')],[['2'],[''],['']],'Cruise, Today, Now');
 v=look({state:'here',pace:9,land:'7',time:'13'});assert.deepEqual([checked(v.radios,'Speed'),checked(v.radios,'Land'),checked(v.radios,'Time')],[['2'],[''],['']],'nothing that is not one');
 v=look({state:'here',pace:2,busy:true});assert.ok(v.group.querySelectorAll('[data-rd-field="megapack-adjust"]').every(i=>i.hasAttribute('disabled')),'busy: disabled');
 for(const mp of [{state:'none',pace:2},{state:'failed',pace:2},{state:'getting',done:1,total:2,pace:2},undefined])assert.equal(look(mp).doc.querySelector('[data-rd-field="megapack-adjust"]'),null,JSON.stringify(mp));
 assert.equal(look({state:'here',pace:2},{sceneTheme:'starry'}).doc.querySelector('[data-rd-field="megapack-adjust"]'),null,'another scene: none');
 // the Reset chip on the choice: when the speed, the land or the light differs from Cruise, Today and Now, or a part was changed
 const chips=(mp,s={})=>look(mp,{...s}).doc.querySelector('.cz-mega-here')?.querySelectorAll('.ch-make-chip').map(b=>b.dataset.rdAction)||[];
 assert.deepEqual(chips({state:'here',pace:2}),['megapack-remove']);for(const mp of [{pace:1},{land:'3'},{time:'1'}])assert.deepEqual(chips({state:'here',pace:2,...mp}),['make-reset','megapack-remove'],JSON.stringify(mp));
});

test('the drawings are the lead\'s, as they came, inside the picker\'s own small drawing',()=>{
 const a=art();assert.equal(sha(JSON.stringify(a.speed)),ART.speed);assert.equal(sha(JSON.stringify(Object.values(a.land))),ART.land);assert.equal(sha(JSON.stringify(Object.values(a.time))),ART.time);
 assert.deepEqual(Object.keys(a.land),['today','mirror','rain','clouds','canal','arches','factory','forest']);assert.deepEqual(Object.keys(a.time),['now','morning','noon','sunset','dusk','night']);
 const env=vm.createContext({console,ReserveFeatures:{enabled:()=>true}});for(const file of ['workspace-arrange.js','customization-model.js','make-your-own.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});
 const html=env.ReserveCustomizeUI.render({s:{sceneTheme:'train'},allCourses:[],courses:[],customizeOpen:true,customizeTab:'scenes',megapack:{state:'here',pace:2}});
 const wrap=inner=>'<svg viewBox="0 0 72 48" width="72" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+inner+'</svg>';
 for(const inner of [...a.speed,...Object.values(a.land),...Object.values(a.time)])assert.ok(html.includes(wrap(inner)),'verbatim, in svg(): '+inner.slice(0,40));
});

// ---- the record: the picker's values against the popup's own Scenery code (popup.js), both ways
function popup(stored){
 const src=read('popup.js'),start=src.indexOf("{const KEY='reserve:train-preview'"),end=src.indexOf('}}',src.indexOf("hour.addEventListener('change',save);",start))+2;assert.ok(start>0&&end>start);
 const select=(id,values)=>({id,value:'',options:values.map(([v,t])=>({value:v,textContent:t})),get selectedIndex(){return this.options.findIndex(o=>o.value===this.value);},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});
 const day=select('train-day',LAND),hour=select('train-hour',TIME),said=[];
 const env=vm.createContext({console,$:id=>({'train-day':day,'train-hour':hour,'scenery-value':{textContent:''}})[id],notice:text=>said.push(text),
  chrome:{storage:{local:{get:async key=>({[key]:stored.value}),set:async value=>{stored.value=plain(value['reserve:train-preview']);},remove:async()=>{stored.value=undefined;}}}}});
 vm.runInContext(src.slice(start,end),env,{filename:'popup.js#scenery'});return {day,hour,said};
}
function helper(){const stored={},env=vm.createContext({console,chrome:{storage:{local:{set:async v=>{Object.assign(stored,plain(v));},remove:async k=>{delete stored[k];}}}}});vm.runInContext(read('make-your-own.js'),env,{filename:'make-your-own.js'});return {M:env.ReserveMakeYourOwn.megapack,stored};}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};


test('the engine reads the record the picker writes: each land to its weekday, each light to its hour; a deep sea record is the clock\'s land',()=>{
 const h=helper(),src=dense(read('scene-themes.js')),lookOf=new Function('raw','return ('+/const lookOf=(raw=>\{[\s\S]*?\};\});/.exec(src)[1]+')(raw)');
 for(const [land,name] of LAND)for(const [time] of TIME){const seen=lookOf(h.M.view(land,time)||undefined);
  if(!land&&!time){assert.equal(seen,null,'Today and Now: the clock');continue;}
  assert.equal(seen.day,land?parseInt(land,10):null,name);assert.equal(seen.hour,time?Number(time):null);assert.equal(seen.week,undefined,'no week: one land a day');}
 assert.equal(lookOf({day:4,week:1}),null,'the deep sea, kept from before 4.2.2: the clock');assert.deepEqual(lookOf({day:4,week:1,hour:17}),{day:null,hour:17},'its light kept');assert.deepEqual(lookOf({day:4,week:2}),{day:4,hour:null},'the glass city: Thursday');
});
