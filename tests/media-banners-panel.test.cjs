'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const {fixture}=require('./dashboard-heading-fixture.cjs'),{settle}=require('./contributor-fixture.cjs'),Storage=require('../extension/storage.js'),Media=require('../extension/media-store.js'),Art=require('../extension/custom-art.js'),Customization=require('../extension/customization-model.js');
const plain=value=>JSON.parse(JSON.stringify(value)),kinds=['banner','card','background'],ids=['all','10','20','theme'];
const appearance=(data,id)=>id==='all'?data.settings.overviewArt:id==='theme'?data.settings.themeArt:data.settings.coursePrefs[id];
const framed=(id,kind)=>({asset:{mediaId:randomUUID(),name:id+' '+kind+' sea.jpg',kind:'image',type:'image/webp',width:2400,height:660,palette:['#123456','#345678','#567890']},fit:id==='10'||kind==='background'?'contain':'cover',focus:{x:.25,y:.75},height:kind==='background'?'tall':'small',zoom:1.5});
async function panel(t,{stored=true}={}){
 const records={},adapter={read:async key=>structuredClone(records[key]),write:async(key,value)=>{records[key]=structuredClone(value);}},mediaStore={async reserve(){},async release(){}},store=Storage.createStore({accountId:'7',origin:'https://canvas.example',adapter,mediaStore}),other=Storage.createStore({accountId:'8',origin:'https://canvas.example',adapter,mediaStore});
 await store.load();await other.load();await other.update(data=>{data.settings.overviewArt={bannerArt:framed('other account','banner')};});
 const seed=data=>{data.settings.overviewArt={};data.settings.themeArt={};for(const id of ids){const pref=id==='all'?data.settings.overviewArt:id==='theme'?data.settings.themeArt:(data.settings.coursePrefs[id]={});for(const kind of kinds)pref[kind+'Art']=framed(id,kind);}};
 if(stored)await store.update(seed);const beforeOther=plain(other.get()),reads=[],mediaReads=[];let editor,change;
 const local={async get(id){mediaReads.push(id);const value=ids.flatMap(id=>kinds.map(kind=>appearance(store.get(),id)?.[kind+'Art'])).find(value=>value?.asset.mediaId===id);return value?{asset:value.asset,blob:new Blob(['local image'],{type:'image/webp'})}:null;},async listKits(){return [];},close(){}};
 const h=fixture({courseId:'all',setup({env,store:target}){
  Object.assign(target,store);env.TextEncoder=TextEncoder;env.ReserveCustomArt=Art;env.ReserveCustomization=Customization;env.ReserveMedia={...Media,createStore:()=>local};
  for(const file of ['media-frame.js','frame-editor.js','customize-ui.js','settings-dock.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),env,{filename:file});
  const create=env.ReserveFrameEditor.create;env.ReserveFrameEditor.create=(container,options)=>{
   editor=create(container,{...options,read(id,kind){const value=options.read(id,kind);reads.push({id,kind,value:value&&plain(value)});return value;}});
   // The heading fixture stores one listener per event; retain the real editor's handler before dashboard wiring.
   change=container.events.get('change');return editor;
  };
 }});t.after(()=>h.dashboard.destroy());
 const flush=async()=>{await settle();h.tick(0);await settle();h.tick(0);await settle();};
 h.click('settings');const tab=h.container.querySelector('[data-rd-action="customize-tab"][data-value="courses"]');h.container.events.get('click')({target:tab,detail:0,preventDefault(){}});await flush();
 const choose=async id=>{const select=h.container.querySelector('[data-rd-field="customize-course"]');select.value=id;h.container.events.get('change')({target:select});await flush();};
 const controls=(id,kind)=>{
  editor.sync();
  const slot=h.container.querySelector('.ch-art-slot[data-id="'+id+'"][data-kind="'+kind+'"]'),value=appearance(store.get(),id)[kind+'Art'],node=slot?.querySelector('[data-ch-frame-editor]');assert.ok(node,id+' '+kind+' editor');
  assert.equal(node.dataset.chFrameId,id);assert.equal(node.dataset.chFrameKind,kind);assert.equal(node.querySelectorAll('[data-ch-frame-preview]').length,2,id+' '+kind+' previews after controllers');assert.doesNotMatch(node.innerHTML,/ch-frame-pin|data-ch-frame-pin|⌖|data-ch-frame-action="focus"/);
  assert.equal(node.querySelector('[data-ch-frame-field="zoom"]').value,String(value.zoom*100));const names=[];
  for(const [key,title,values]of [['fit','Fit',['cover','contain']],['height','Height',['small','medium','tall']]]){const group=node.querySelector('[data-ch-frame-choice="'+key+'"]');if(key==='height'&&kind==='card'){assert.equal(group,null);assert.equal(node.querySelector('[data-ch-frame-field="height"]'),null);continue;}assert.ok(group,id+' '+kind+' '+key+' fieldset');assert.equal(group.tagName,'FIELDSET');assert.ok(group.classList.contains('ch-frame-choice'));assert.equal(group.querySelector('legend').textContent,title);
   const inputs=group.querySelectorAll('[data-ch-frame-field="'+key+'"]'),groupNames=new Set(inputs.map(input=>input.getAttribute('name')));assert.deepEqual(inputs.map(input=>input.value),values,'paint keeps radio values intact');assert.equal(groupNames.size,1);assert.ok([...groupNames][0]);names.push([...groupNames][0]);assert.equal(group.querySelectorAll('label.ch-frame-chip').length,values.length);for(const input of inputs){assert.equal(input.tagName,'INPUT');assert.equal(input.type,'radio');assert.equal(input.closest('label.ch-frame-chip')?.parentElement,group);assert.equal(input.checked,input.value===value[key],id+' '+kind+' '+key+' checked state');}assert.deepEqual(inputs.filter(input=>input.checked).map(input=>input.value),[value[key]],'radio selection reflects the stored frame');
  }
  assert.equal(new Set(names).size,names.length);assert.equal(node.querySelector('select[data-ch-frame-field]'),null);
  assert.match(slot.querySelector('.ch-art-caption').textContent,/sea.jpg/);assert.deepEqual(reads.findLast(row=>row.id===id&&row.kind===kind)?.value,plain(value),'controller reads the selected stored frame');assert.ok(mediaReads.includes(value.asset.mediaId));assert.match(node.querySelector('.ch-frame-source .ch-frame-live').src,/^blob:/);return node;
 };
 const edit=async(id,kind,key,value)=>{const inputs=controls(id,kind).querySelectorAll('[data-ch-frame-field="'+key+'"]'),input=inputs.find(node=>node.type!=='radio'||node.value===String(value));assert.ok(input,key+' control for '+value);if(input.type==='radio'){for(const radio of inputs)radio.checked=radio===input;}else input.value=String(value);change({target:input,type:'change'});await flush();};
 return {...h,store,other,beforeOther,seed,reads,mediaReads,flush,choose,controls,editor,change,edit};
}

test('stored framed artwork keeps controls through the real panel, dashboard reconciliation and controllers for every target',async t=>{
 const h=await panel(t);const before=plain(h.store.get());
 for(const id of ids){await h.choose(id);for(const kind of kinds)h.controls(id,kind);h.dashboard.setStatus('Background refresh');await h.flush();for(const kind of kinds)h.controls(id,kind);}
 assert.deepEqual(h.store.get(),before,'rendering and controller sync never write preferences');assert.deepEqual(h.other.get(),h.beforeOther);
});

test('newly stored frames replace default captions and remain editable after target changes and saves',async t=>{
 const h=await panel(t,{stored:false});assert.equal(h.container.querySelectorAll('[data-ch-frame-editor]').length,0);
 await h.store.update(h.seed);await h.flush();for(const kind of kinds)h.controls('all',kind);
 for(const id of ['10','theme','20','all']){
  await h.choose(id);
  for(const kind of kinds){const saved=appearance(h.store.get(),id)[kind+'Art'],edits=[['zoom',225],['fit',saved.fit==='cover'?'contain':'cover'],...(kind==='card'?[]:[['height',saved.height==='tall'?'small':'tall']])];for(const [key,value]of edits){const before=plain(h.store.get());await h.edit(id,kind,key,value);const expected=key==='zoom'?value/100:value;assert.equal(appearance(h.store.get(),id)[kind+'Art'][key],expected,id+' '+kind+' '+key+' save target');appearance(before,id)[kind+'Art'][key]=expected;assert.deepEqual(h.store.get(),before,'only the selected frame field changes');h.controls(id,kind);}}
 }
 assert.deepEqual(h.other.get(),h.beforeOther);
 await h.store.update(data=>{delete data.settings.overviewArt.bannerArt;});await h.flush();assert.equal(h.container.querySelector('.ch-art-slot[data-kind="banner"] [data-ch-frame-editor]'),null);
 await h.store.update(data=>{data.settings.overviewArt.bannerArt=framed('all','banner');});await h.flush();h.controls('all','banner');
});

test('artwork slots with a framing editor span the grid outside media queries',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../extension/customize.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,''),rules=[...css.matchAll(/\.rd\s+\.ch-art-slot:has\(\.ch-frame-editor\)\s*\{([^{}]*)\}/g)],global=rules.filter(rule=>{let depth=0;for(const brace of css.slice(0,rule.index).match(/[{}]/g)||[])depth+=brace==='{'?1:-1;return depth===0;});assert.ok(global.length,'framed slot width rule is outside every media query');for(const rule of global)assert.match(rule[1],/(?:^|;)\s*grid-column\s*:\s*1\s*\/\s*-1\s*(?:;|$)/);
});
