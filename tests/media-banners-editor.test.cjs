'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createDOM,settle}=require('./market-fixture.cjs'),Art=require('../extension/custom-art.js');
const source=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const image={mediaId:'11111111-1111-4111-8111-111111111111',name:'Landscape.webp',kind:'image',type:'image/webp',width:1600,height:900,palette:['#123456']};
const movie={...image,name:'Loop.webm',kind:'video',type:'video/webm',duration:30};
const framed=(asset=image,extra={})=>({asset:plain(asset),focus:{x:.5,y:.5},zoom:1,fit:'cover',height:'medium',...(asset.kind==='video'?{loop:{start:2,end:20},still:5}:{}),...extra});
function choices(editor,frame,kind=editor.dataset.chFrameKind){
 const groups=[];for(const [key,title,values]of [['fit','Fit',['cover','contain']],['height','Height',['small','medium','tall']]]){
  const group=editor.querySelector('[data-ch-frame-choice="'+key+'"]');if(key==='height'&&kind==='card'){assert.equal(group,null);assert.equal(editor.querySelector('[data-ch-frame-field="height"]'),null);continue;}
  assert.ok(group,key+' choice exists');assert.equal(group.tagName,'FIELDSET');assert.ok(group.classList.contains('ch-frame-choice'));assert.equal(group.querySelector('legend').textContent,title);
  const inputs=group.querySelectorAll('[data-ch-frame-field="'+key+'"]'),names=new Set(inputs.map(node=>node.getAttribute('name')));assert.deepEqual(inputs.map(node=>node.value),values);assert.equal(names.size,1);assert.ok([...names][0]);
  assert.equal(group.querySelectorAll('label.ch-frame-chip').length,values.length);for(const node of inputs){assert.equal(node.tagName,'INPUT');assert.equal(node.getAttribute('type'),'radio');assert.equal(node.closest('label.ch-frame-chip')?.parentElement,group);assert.equal(node.checked,node.value===frame[key],key+' checked state matches the saved frame');}
  assert.deepEqual(inputs.filter(node=>node.checked).map(node=>node.value),[frame[key]]);groups.push([...names][0]);
 }
 assert.equal(new Set(groups).size,groups.length);assert.equal(editor.querySelector('select[data-ch-frame-field]'),null);assert.doesNotMatch(editor.innerHTML,/ch-frame-pin|data-ch-frame-pin|⌖|data-ch-frame-action="focus"/);return groups;
}
function times(editor,expected,duration){
 for(const [i,key,title]of [[0,'start','Loop from (s)'],[1,'end','Loop to (s)'],[2,'still','Still at (s)']]){const node=editor.querySelector('[data-ch-frame-field="'+key+'"]');assert.equal(node.getAttribute('type'),'number');assert.equal(node.getAttribute('step'),'0.1');assert.equal(node.getAttribute('aria-label'),title);assert.equal(node.closest('label').querySelector('span').textContent,title);assert.equal(node.value,expected[i],key+' displays one decimal');assert.match(node.value,/^\d+\.\d$/);assert.ok(Number(node.value)<=duration,key+' never displays above duration');}
}
function fixture(t,{value=framed(),kind='banner',appearance={},extras=[],write,shape}={}){
 const timers=new Map(),calls=[],errors=[],states=new Map([[kind,plain(value)],...extras.map(([key,v])=>[key,plain(v)])]);let timer=0,reads=0,measures=0;
 const env=vm.createContext({TextEncoder,ReserveCustomArt:Art,ReserveMedia:{cleanReference:asset=>asset},setTimeout(fn,delay){const id=++timer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
 for(const file of ['media-frame.js','frame-editor.js'])vm.runInContext(source(file),env,{filename:file});
 const api=env.ReserveFrameEditor,document=createDOM('<html><body><div class="rd" id="frames"></div></body></html>'),container=document.getElementById('frames');env.document=document;
 container.innerHTML=[...states].map(([key,v])=>api.render(v,{id:'10',kind:key,appearance})).join('');
 for(const node of container.querySelectorAll('[data-ch-frame-preview]')){node.getBoundingClientRect=()=>{measures++;const box=api.shape(node.closest('[data-ch-frame-editor]').dataset.chFrameKind,value,node.dataset.chFramePreview,appearance);return {left:10,top:20,width:box.width,height:box.height,right:10+box.width,bottom:20+box.height};};node.setPointerCapture=()=>{};node.releasePointerCapture=()=>{};}
 const controller=api.create(container,{read(id,key){assert.equal(id,'10');reads++;return states.get(key);},save(id,key,frame){calls.push({id,kind:key,frame:plain(frame)});const result=write?.(id,key,frame);if(result?.then)return result.then(()=>{states.set(key,plain(frame));});states.set(key,plain(frame));return result;},onError:error=>errors.push(error),shape});t.after(()=>controller.destroy());
 const editor=key=>container.querySelector('[data-ch-frame-editor][data-ch-frame-kind="'+key+'"]'),part=(selector,key=kind)=>editor(key).querySelector(selector);
 const send=(node,type,extra={})=>{const event={type,bubbles:true,button:0,pointerId:1,clientX:100,clientY:80,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.cancelBubble=true;},...extra};node.dispatchEvent(event);return event;};
 const change=(key,value,type='change',slot=kind)=>{const nodes=editor(slot).querySelectorAll('[data-ch-frame-field="'+key+'"]'),node=nodes.find(node=>node.type!=='radio'||node.value===String(value));assert.ok(node,key+' control for '+value);if(node.type==='radio'){for(const radio of nodes)radio.checked=radio===node;}else node.value=String(value);return send(node,type);};
 return {env,api,document,container,controller,calls,errors,timers,states,editor,part,send,change,reads:()=>reads,measures:()=>measures,tick(){const pending=[...timers.values()];timers.clear();for(const {fn}of pending)fn();}};
}

test('editor exports synchronous markup, normalized legacy values and narrow/wide slot shapes',t=>{
 const f=fixture(t,{value:image,appearance:{bannerFit:'contain',bannerPosition:'right'}}),html=f.api.render(image,{id:'a"<b',kind:'banner',appearance:{bannerFit:'contain'}});
 assert.equal(typeof html,'string');assert.equal(f.env.ReserveFrameEditor,f.api);assert.equal(f.api.render(null),'');assert.equal(f.api.render(image,{kind:'icon'}),'');
 assert.equal(f.container.querySelectorAll('[data-ch-frame-preview]').length,2);assert.equal(f.part('[data-ch-frame-field="zoom"]').getAttribute('min'),'100');assert.equal(f.part('[data-ch-frame-field="zoom"]').getAttribute('max'),'400');
 choices(f.editor('banner'),{fit:'contain',height:'medium'});
 const parsed=createDOM('<html><body>'+html+'</body></html>');assert.equal(parsed.querySelector('[data-ch-frame-editor]').dataset.chFrameId,'a"<b');assert.equal(parsed.querySelector('b'),null);
 assert.deepEqual(plain(f.api.shape('banner',framed(),'narrow')),{width:360,height:140});assert.deepEqual(plain(f.api.shape('banner',framed(),'wide')),{width:960,height:140});
 assert.notEqual(f.part('[data-ch-frame-preview="narrow"]').style.aspectRatio,f.part('[data-ch-frame-preview="wide"]').style.aspectRatio);assert.equal(f.timers.size,0);
});

test('card shape is fixed and background framing has both viewport shapes',t=>{
 const f=fixture(t,{kind:'card',extras:[['background',framed()]]});
 assert.equal(f.part('[data-ch-frame-field="height"]'),null);assert.ok(f.part('[data-ch-frame-field="height"]','background'));
 assert.deepEqual(plain(f.api.shape('card',framed(),'wide')),{width:320,height:144});
 const narrow=f.api.shape('background',framed(),'narrow'),wide=f.api.shape('background',framed(),'wide');assert.ok(narrow.width<narrow.height);assert.ok(wide.width>wide.height);
 assert.equal(f.container.querySelectorAll('[data-ch-frame-preview]').length,4);
});

test('radio choices preserve values and saved checked states through render, create, paint and sync',async t=>{
 const value=framed(image,{fit:'contain',height:'tall'}),f=fixture(t,{value}),raw=createDOM('<html><body>'+f.api.render(value,{id:'10',kind:'banner'})+'</body></html>');choices(raw.querySelector('[data-ch-frame-editor]'),value);choices(f.editor('banner'),value);
 const inputs=f.editor('banner').querySelectorAll('input[type="radio"]'),values=inputs.map(node=>node.value);f.change('zoom',225,'input');choices(f.editor('banner'),value);f.controller.sync();choices(f.editor('banner'),value);f.change('zoom',225);await settle();
 f.states.set('banner',framed(image,{fit:'cover',height:'small',zoom:2.25}));f.controller.sync();choices(f.editor('banner'),f.states.get('banner'));assert.deepEqual(inputs.map(node=>node.value),values);assert.equal(f.calls.length,1,'paint and external sync do not save radio choices');
 f.change('fit','contain');await settle();f.change('height','medium');await settle();assert.equal(f.calls.length,3);assert.equal(f.states.get('banner').fit,'contain');assert.equal(f.states.get('banner').height,'medium');f.controller.sync();choices(f.editor('banner'),f.states.get('banner'));assert.deepEqual(inputs.map(node=>node.value),values);
});

test('radio group names distinguish editor IDs, artwork kinds and field keys',t=>{
 const f=fixture(t),rows=['10','20','a"<b'].flatMap(id=>['banner','card','background'].map((kind,index)=>({id,kind,frame:framed(image,{fit:index===1?'cover':'contain',height:index===2?'small':'tall'})}))),document=createDOM('<html><body>'+rows.map(row=>f.api.render(row.frame,row)).join('')+'</body></html>'),names=[];f.controller.destroy();f.env.document=document;
 const check=()=>{for(const row of rows){const editor=document.querySelectorAll('[data-ch-frame-editor]').find(node=>node.dataset.chFrameId===row.id&&node.dataset.chFrameKind===row.kind);names.push(...choices(editor,row.frame));}};check();assert.equal(new Set(names).size,names.length);const before=[...names];names.length=0;
 const controller=f.api.create(document.body,{read(id,kind){return rows.find(row=>row.id===id&&row.kind===kind).frame;},save(){assert.fail('sync must not save');},onError:error=>assert.fail(error.message)});t.after(()=>controller.destroy());check();assert.deepEqual(names,before);controller.sync();names.length=0;check();assert.deepEqual(names,before);
});

test('still-only video previews add no decoders and expose loop and selected still controls',t=>{
 const f=fixture(t,{value:framed(movie)});
 assert.equal(f.container.querySelectorAll('video').length,0);assert.equal(f.container.querySelectorAll('[data-ch-frame-motion="false"]').length,2);
 times(f.editor('banner'),['2.0','20.0','5.0'],movie.duration);const raw=createDOM('<html><body>'+f.api.render(framed(movie))+'</body></html>');times(raw.querySelector('[data-ch-frame-editor]'),['2.0','20.0','5.0'],movie.duration);
 assert.equal(f.container.querySelectorAll('[data-ch-frame-field="still"]').length,1);assert.doesNotMatch(f.container.innerHTML,/autoplay|<small|<p[\s>]/i);
});

test('video time display rounds end down, rounds start/still to tenths and caps fractional durations',async t=>{
 const rows=[{duration:2.36,loop:{start:.26,end:2.36},still:2.36,display:['0.3','2.3','2.3']},{duration:2.39,loop:{start:2.33,end:2.39},still:2.35,display:['2.3','2.3','2.3']},{duration:2.3,loop:{start:.3,end:2.3},still:2.3,display:['0.3','2.3','2.3']},{duration:.3,loop:{start:0,end:.3},still:.3,display:['0.0','0.3','0.3']},{duration:.36,loop:{start:.26,end:.36},still:.35,display:['0.3','0.3','0.3']},{duration:.09,loop:{start:0,end:.09},still:.09,display:['0.0','0.0','0.0']},{duration:30,loop:{start:.26,end:2.39},still:12.25,display:['0.3','2.3','12.3']}];
 for(const row of rows)await t.test('duration '+row.duration+' and end '+row.loop.end,async t=>{const value=framed({...movie,duration:row.duration},{loop:row.loop,still:row.still}),f=fixture(t,{value}),raw=createDOM('<html><body>'+f.api.render(value)+'</body></html>');times(raw.querySelector('[data-ch-frame-editor]'),row.display,row.duration);times(f.editor('banner'),row.display,row.duration);f.controller.sync();times(f.editor('banner'),row.display,row.duration);f.change('zoom',125);await settle();times(f.editor('banner'),row.display,row.duration);assert.deepEqual(f.states.get('banner').loop,row.loop);assert.equal(f.states.get('banner').still,row.still);});
});

test('sanitized SVG passes through the existing renderer and preserves its intrinsic shape',t=>{
 const asset=Art.importSVG('<svg viewBox="0 0 40 100"><rect width="40" height="100"/></svg>','Tall.svg'),f=fixture(t,{value:framed(asset)});
 assert.equal(f.container.querySelectorAll('picture').length,2);assert.match(f.container.innerHTML,/data:image\/svg\+xml/);
 assert.throws(()=>f.api.render(framed({name:'Bad.svg',svg:'<svg onload="alert(1)"/>'})),/event|SVG/i);
 const g=f.env.ReserveMediaFrame.layout(40,100,360,140,framed(asset));assert.equal(f.part('[data-ch-frame-art]').style.height,g.height/140*100+'%');
});

test('drag updates both local previews without replacing hydrated media or saving before release',async t=>{
 const f=fixture(t,{value:framed(image,{zoom:2})}),node=f.part('[data-ch-frame-preview="narrow"]'),art=f.part('[data-ch-frame-art]'),source=f.part('.ch-frame-source'),wide=f.part('[data-ch-frame-preview="wide"] [data-ch-frame-art]'),before=wide.style.left;
 f.send(node,'pointerdown',{clientX:190,clientY:90});const measures=f.measures(),reads=f.reads();
 f.send(node,'pointermove',{clientX:230,clientY:105});f.controller.sync();
 assert.equal(f.calls.length,0);assert.equal(f.reads(),reads);assert.equal(f.measures(),measures,'pointer moves do not read layout');assert.equal(f.part('[data-ch-frame-art]'),art);assert.equal(f.part('.ch-frame-source'),source);assert.notEqual(wide.style.left,before);
 f.send(node,'pointerup',{clientX:230,clientY:105});assert.equal(f.calls.length,1);assert.ok(f.calls[0].frame.focus.x<.5);assert.ok(f.calls[0].frame.focus.y<.5);assert.equal(f.calls[0].frame.zoom,2);await settle();
 assert.equal(f.errors.length,0);assert.equal(f.timers.size,0);
});

test('taps use source coordinates and clamp to artwork edges through letterboxing',async t=>{
 const f=fixture(t,{value:framed(image,{fit:'contain'})}),node=f.part('[data-ch-frame-preview="narrow"]'),box=f.api.shape('banner',framed(),'narrow'),g=f.env.ReserveMediaFrame.layout(image.width,image.height,box.width,box.height,framed(image,{fit:'contain'}));
 const x=10+g.left+g.width*.25,y=20+g.top+g.height*.75;f.send(node,'pointerdown',{clientX:x,clientY:y});f.send(node,'pointerup',{clientX:x,clientY:y});
 assert.ok(Math.abs(f.calls[0].frame.focus.x-.25)<1e-8);assert.ok(Math.abs(f.calls[0].frame.focus.y-.75)<1e-8);await settle();
 for(const [i,point]of [{clientX:10+g.left/2,clientY:20+box.height*.25,focus:{x:0,y:.25}},{clientX:10+box.width-g.left/2,clientY:20+box.height*.75,focus:{x:1,y:.75}},{clientX:0,clientY:0,focus:{x:0,y:0}},{clientX:10+box.width+20,clientY:20+box.height+20,focus:{x:1,y:1}}].entries()){f.send(node,'pointerdown',point);assert.equal(f.calls.length,i+1);f.send(node,'pointerup',point);await settle();assert.equal(f.calls.length,i+2);assert.ok(Math.abs(f.calls.at(-1).frame.focus.x-point.focus.x)<1e-8);assert.ok(Math.abs(f.calls.at(-1).frame.focus.y-point.focus.y)<1e-8);}assert.doesNotMatch(f.editor('banner').innerHTML,/ch-frame-pin|data-ch-frame-pin|⌖|data-ch-frame-action="focus"/);
});

test('tapping cropped artwork centers the selected source point in both previews',async t=>{
 const value=framed(image,{zoom:2}),f=fixture(t,{value}),node=f.part('[data-ch-frame-preview="narrow"]'),box=f.api.shape('banner',value,'narrow'),g=f.env.ReserveMediaFrame.layout(image.width,image.height,box.width,box.height,value),focus={x:.55,y:.45},x=10+g.left+g.width*focus.x,y=20+g.top+g.height*focus.y;
 f.send(node,'pointerdown',{clientX:x,clientY:y});assert.equal(f.calls.length,0);f.send(node,'pointerup',{clientX:x,clientY:y});await settle();assert.equal(f.calls.length,1);assert.ok(Math.abs(f.calls[0].frame.focus.x-focus.x)<1e-8);assert.ok(Math.abs(f.calls[0].frame.focus.y-focus.y)<1e-8);
 for(const view of ['narrow','wide']){const box=f.api.shape('banner',value,view),art=f.part('[data-ch-frame-preview="'+view+'"] [data-ch-frame-art]');assert.ok(Math.abs((parseFloat(art.style.left)+parseFloat(art.style.width)*focus.x)/100*box.width-box.width/2)<1e-8);assert.ok(Math.abs((parseFloat(art.style.top)+parseFloat(art.style.height)*focus.y)/100*box.height-box.height/2)<1e-8);}
});

test('wheel zoom is clamped, previews immediately and commits only after wheel input settles',t=>{
 const f=fixture(t),node=f.part('[data-ch-frame-preview="wide"]');
 const event=f.send(node,'wheel',{deltaY:-5000,deltaMode:0});assert.equal(event.defaultPrevented,true);assert.equal(f.part('[data-ch-frame-zoom]').textContent,'400%');assert.equal(f.calls.length,0);assert.equal(f.timers.size,1);
 f.controller.sync();assert.equal(f.part('[data-ch-frame-zoom]').textContent,'400%');f.send(node,'wheel',{deltaY:-5000});assert.equal(f.timers.size,1);f.tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].frame.zoom,4);assert.equal(f.timers.size,0);
});
test('dragging from a clamped edge moves the crop immediately without a dead zone',t=>{
 const value=framed(image,{zoom:2,focus:{x:0,y:0}}),f=fixture(t,{value}),node=f.part('[data-ch-frame-preview="wide"]'),before=parseFloat(node.querySelector('[data-ch-frame-art]').style.left)||0;
 f.send(node,'pointerdown',{clientX:100,clientY:100});f.send(node,'pointermove',{clientX:80,clientY:80});assert.ok(parseFloat(node.querySelector('[data-ch-frame-art]').style.left)<before);f.send(node,'pointerup',{clientX:80,clientY:80});assert.equal(f.calls.length,1);const g=f.env.ReserveMediaFrame.layout(image.width,image.height,960,140,f.calls[0].frame);assert.ok(Math.abs(g.left+20)<1e-8);assert.ok(Math.abs(g.top+20)<1e-8);
});

test('pinch zoom commits once after the last pointer releases',t=>{
 const f=fixture(t),node=f.part('[data-ch-frame-preview="narrow"]');
 f.send(node,'pointerdown',{pointerId:1,clientX:100,clientY:80});f.send(node,'pointerdown',{pointerId:2,clientX:200,clientY:80});
 f.send(node,'pointermove',{pointerId:1,clientX:50,clientY:80});f.send(node,'pointermove',{pointerId:2,clientX:250,clientY:80});assert.equal(f.calls.length,0);assert.equal(f.part('[data-ch-frame-zoom]').textContent,'200%');
 f.send(node,'pointerup',{pointerId:1,clientX:50,clientY:80});assert.equal(f.calls.length,0);f.send(node,'pointerup',{pointerId:2,clientX:250,clientY:80});assert.equal(f.calls.length,1);assert.equal(f.calls[0].frame.zoom,2);
});

test('slider input stays local until change and fit/height preserve the finalized frame',async t=>{
 const f=fixture(t,{value:framed(movie)});
 f.change('zoom',300,'input');f.controller.sync();assert.equal(f.calls.length,0);assert.equal(f.part('[data-ch-frame-zoom]').textContent,'300%');f.change('zoom',300);assert.equal(f.calls.length,1);await settle();
 f.change('fit','contain');f.change('height','tall');await settle();const out=f.calls.at(-1).frame;
 assert.equal(out.zoom,3);assert.equal(out.fit,'contain');assert.equal(out.height,'tall');assert.equal(out.asset.mediaId,movie.mediaId);assert.deepEqual(out.loop,{start:2,end:20});assert.equal(out.still,5);assert.equal(f.part('[data-ch-frame-preview="wide"]').style.aspectRatio,'960/220');
});

test('video loop and numeric still are validated and delivered to the parent capture/save path',async t=>{
 const f=fixture(t,{value:framed(movie)});
 for(const [key,value]of [['start',21],['end',1],['still',31],['still',''],['still','NaN']])f.change(key,value);
 assert.equal(f.calls.length,0);assert.equal(f.errors.length,5);assert.equal(f.part('[data-ch-frame-field="still"]').value,'5.0');
 f.change('start',4);await settle();f.change('end',24);await settle();f.change('still',12.75,'input');assert.equal(f.calls.length,2);f.change('still',12.75);await settle();
 assert.equal(f.calls.length,3);assert.deepEqual(f.calls[2].frame.loop,{start:4,end:24});assert.equal(f.calls[2].frame.still,12.75);assert.equal(f.calls[2].frame.asset.mediaId,movie.mediaId);assert.equal(f.container.querySelectorAll('video').length,0);
});

test('fit, height, zoom and focus changes preserve exact saved loop and still precision',async t=>{
 const value=framed(movie,{loop:{start:2.3456789,end:20.987654321},still:5.5555555}),f=fixture(t,{value}),node=f.part('[data-ch-frame-preview="narrow"]'),actions=[()=>f.change('fit','contain'),()=>f.change('height','tall'),()=>f.change('zoom',225),()=>f.send(node,'keydown',{key:'ArrowRight'}),()=>{f.send(node,'pointerdown',{clientX:190,clientY:90});f.send(node,'pointerup',{clientX:190,clientY:90});}];
 for(const [i,action]of actions.entries()){action();await settle();assert.equal(f.calls.length,i+1);assert.deepEqual(f.calls.at(-1).frame.loop,value.loop);assert.equal(f.calls.at(-1).frame.still,value.still);f.controller.sync();times(f.editor('banner'),['2.3','20.9','5.6'],movie.duration);}assert.equal(f.errors.length,0);
});

test('editing one numeric time preserves exact precision in the other saved time fields',async t=>{
 for(const [key,next,display]of [['start',3.1,['3.1','20.9','5.6']],['end',19.2,['2.3','19.2','5.6']],['still',6.4,['2.3','20.9','6.4']]])await t.test(key,async t=>{const value=framed(movie,{loop:{start:2.3456789,end:20.987654321},still:5.5555555}),f=fixture(t,{value}),expected=plain(value);if(key==='still')expected.still=next;else expected.loop[key]=next;f.change(key,next,'input');assert.equal(f.calls.length,0);f.change(key,next);await settle();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].frame,expected);f.controller.sync();times(f.editor('banner'),display,movie.duration);});
});

test('measured shape callback controls the real slot ratio and runs outside gesture updates',t=>{
 const shapes=[],f=fixture(t,{shape(id,kind,view,frame){shapes.push({id,kind,view,height:frame.height});return {width:view==='narrow'?340:1180,height:frame.height==='tall'?220:140};}}),node=f.part('[data-ch-frame-preview="narrow"]');
 assert.equal(f.part('[data-ch-frame-preview="wide"]').style.aspectRatio,'1180/140');assert.equal(f.part('[data-ch-frame-preview="narrow"]').style.aspectRatio,'340/140');const count=shapes.length;
 f.send(node,'pointerdown');f.send(node,'pointermove',{clientX:140});assert.equal(shapes.length,count);f.send(node,'pointerup',{clientX:140});f.change('height','tall');assert.equal(f.part('[data-ch-frame-preview="wide"]').style.aspectRatio,'1180/220');
 assert.ok(shapes.every(row=>row.id==='10'&&row.kind==='banner'));
});

test('saves serialize across artwork slots so a second slot waits for the parent busy state',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve;}),f=fixture(t,{extras:[['card',framed()]],write(id,kind){return kind==='banner'?gate:undefined;}});
 f.change('zoom',200);f.change('zoom',300,'change','card');assert.deepEqual(f.calls.map(row=>row.kind),['banner']);assert.equal(f.part('[data-ch-frame-zoom]','card').textContent,'300%');
 release();await settle();assert.deepEqual(f.calls.map(row=>row.kind),['banner','card']);assert.equal(f.states.get('card').zoom,3);assert.equal(f.errors.length,0);
});

test('cancel restores a gesture, keyboard changes are bounded and destroy clears pending wheel work',async t=>{
 const f=fixture(t),node=f.part('[data-ch-frame-preview="narrow"]'),before=f.part('[data-ch-frame-art]').style.left;
 f.send(node,'pointerdown');f.send(node,'pointermove',{clientX:200});f.send(node,'pointercancel');assert.equal(f.calls.length,0);assert.equal(f.part('[data-ch-frame-art]').style.left,before);
 f.send(node,'keydown',{key:'ArrowRight',shiftKey:true});await settle();assert.ok(Math.abs(f.calls[0].frame.focus.x-.6)<1e-8);
 f.send(node,'wheel',{deltaY:20000});assert.equal(f.part('[data-ch-frame-zoom]').textContent,'100%');f.controller.destroy();f.tick();f.send(node,'pointerdown');f.send(node,'pointerup');assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
});

test('save failures report once and resync the saved frame; late failure after destroy stays quiet',async t=>{
 const f=fixture(t,{write(){return Promise.reject(Error('Media storage is full.'));}});f.change('zoom',250);await settle();assert.equal(f.errors.length,1);assert.match(f.errors[0].message,/storage is full/);assert.equal(f.part('[data-ch-frame-zoom]').textContent,'100%');
 let reject;const pending=new Promise((resolve,no)=>{reject=no;}),later=fixture(t,{write(){return pending;}});later.change('zoom',200);later.controller.destroy();reject(Error('late'));await settle();assert.equal(later.errors.length,0);
});

test('CustomizeUI unwraps artwork, keeps four SVG templates and gives media slots upload/paste/editor controls',t=>{
 const f=fixture(t),env=f.env,svg=Art.importSVG('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20"/></svg>','Icon.svg');
 env.ReserveCustomization={defaults:{},artKeys:['bannerArt','cardArt','backgroundArt','iconArt','borderArt','titleArt']};env.ReserveCourseArt={scene:()=>'',mini:()=>'',frame:()=>'',title:()=>'',kind:()=>'home'};
 vm.runInContext(source('customize-ui.js'),env,{filename:'customize-ui.js'});
 const pref={bannerArt:framed(),cardArt:framed(),backgroundArt:framed(),iconArt:svg,borderArt:svg,titleArt:svg},courses=[{id:'10',name:'Chemistry',color:'#123456'}],context={customizeOpen:true,customizeTab:'art',customizeCourseId:'10',allCourses:courses,courses,s:{coursePrefs:{10:pref}},customKits:[]},before=JSON.stringify(context);
 const document=createDOM('<html><body>'+env.ReserveCustomizeUI.render(context)+'</body></html>');assert.equal(document.querySelectorAll('[data-rd-action="art-template"]').length,4);assert.equal(document.querySelectorAll('[data-ch-frame-editor]').length,3);assert.equal(document.querySelectorAll('[data-rd-action="art-clipboard"]').length,3);assert.equal(document.querySelectorAll('.ch-art-slot').length,6);
 for(const kind of ['banner','card','background']){const slot=document.querySelector('.ch-art-slot[data-kind="'+kind+'"]'),upload=slot.querySelector('[data-rd-field="art-upload"]'),paste=slot.querySelector('[data-rd-action="art-clipboard"]');assert.equal(slot.getAttribute('tabindex'),'0');assert.equal(slot.dataset.id,'10');assert.ok(slot.hasAttribute('data-ch-frame-target'));assert.equal(paste.dataset.id,'10');assert.equal(paste.dataset.kind,kind);for(const type of ['image/avif','image/gif','image/webp','video/mp4','video/webm','image/svg+xml'])assert.ok(upload.getAttribute('accept').includes(type));assert.match(slot.querySelector('.ch-art-caption').textContent,/Landscape.webp/);}
 assert.equal(document.querySelector('[data-setting="bannerFit"]'),null);assert.equal(document.querySelector('[data-setting="bannerPosition"]'),null);assert.ok(document.querySelector('[data-setting="titlePlacement"]'));assert.ok(document.querySelector('[data-accent="#123456"]'));assert.equal(JSON.stringify(context),before);
});

test('legacy CustomizeUI retains existing icon, border, title and banner-setting behavior without framing modules',t=>{
 const f=fixture(t),env=f.env;env.ReserveCustomization={defaults:{},artKeys:['bannerArt','iconArt','borderArt','titleArt']};env.ReserveCourseArt={scene:()=>'',mini:()=>'',frame:()=>'',title:()=>'',kind:()=>'home'};
 const banner=Art.importSVG('<svg/>','Banner.svg');env.ReserveFrameEditor=null;env.ReserveMediaFrame=null;vm.runInContext(source('customize-ui.js'),env);
 const courses=[{id:'10',name:'Course'}],document=createDOM('<html><body>'+env.ReserveCustomizeUI.render({customizeOpen:true,customizeTab:'art',customizeCourseId:'10',allCourses:courses,courses,s:{coursePrefs:{10:{bannerArt:banner,bannerFit:'cover',bannerPosition:'left'}}}})+'</body></html>');
 assert.equal(document.querySelectorAll('.ch-art-slot').length,4);assert.equal(document.querySelectorAll('[data-rd-action="art-template"]').length,4);assert.equal(document.querySelector('[data-setting="bannerFit"] option[selected]').value,'cover');assert.equal(document.querySelector('[data-setting="bannerPosition"] option[selected]').value,'left');
});

test('Theme target reads themeArt and routes label-only media controls and framing to theme',async t=>{
 const f=fixture(t),env=f.env,draws=[],reads=[],saves=[];f.controller.destroy();
 env.ReserveCustomization={defaults:{},artKeys:['bannerArt','cardArt','backgroundArt','iconArt','borderArt','titleArt']};env.ReserveCourseArt={scene:()=>'',mini:course=>{draws.push(plain(course));return '';},frame:()=>'',title:()=>'',kind:()=>'home'};
 vm.runInContext(source('customize-ui.js'),env,{filename:'customize-ui.js'});
 const themeArt={bannerArt:framed({...image,name:'Theme banner.webp'},{focus:{x:.2,y:.8},zoom:2}),cardArt:framed({...image,name:'Theme card.webp'}),backgroundArt:framed({...movie,name:'Theme background.webm'},{still:12.25})},courses=[{id:'10',name:'Chemistry'}],context={customizeOpen:true,customizeTab:'art',customizeCourseId:'theme',allCourses:courses,courses,s:{themeArt,overviewArt:{bannerArt:framed({...image,name:'Overview.webp'})},coursePrefs:{10:{bannerArt:framed({...image,name:'Course.webp'})}}}},before=JSON.stringify(context);
 const document=createDOM('<html><body>'+env.ReserveCustomizeUI.render(context)+'</body></html>'),selector=document.querySelector('[data-rd-field="customize-course"]'),artwork=document.querySelector('.ch-art-controls');env.document=document;
 assert.deepEqual(selector.querySelectorAll('option').map(node=>node.value),['all','theme','10']);assert.equal(selector.querySelector('option[selected]').value,'theme');assert.equal(selector.querySelector('option[value="theme"]').textContent,'Theme');assert.equal(document.querySelector('#ch-art-title').textContent,'Theme artwork');
 assert.equal(artwork.querySelectorAll('p,small,.cz-hint,.ch-hint').length,0);assert.equal(artwork.querySelector('[data-rd-action="course-reset"]').textContent,'Reset theme artwork');assert.equal(document.querySelectorAll('[data-rd-action="art-template"]').length,4);
 for(const kind of ['banner','card','background']){const slot=document.querySelector('.ch-art-slot[data-kind="'+kind+'"]');assert.equal(slot.dataset.id,'theme');assert.ok(slot.hasAttribute('data-ch-frame-target'));assert.equal(slot.getAttribute('tabindex'),'0');assert.equal(slot.querySelector('[data-rd-field="art-upload"]').getAttribute('aria-label'),'Upload '+kind+' for Theme');for(const target of slot.querySelectorAll('[data-rd-field="art-upload"],[data-rd-action="art-clipboard"],[data-rd-action="art-remove"]')){assert.equal(target.dataset.id,'theme');assert.equal(target.dataset.kind,kind);}assert.equal(slot.querySelector('[data-rd-field="art-source"]').dataset.course,'theme');assert.equal(slot.querySelector('[data-ch-frame-editor]').dataset.chFrameId,'theme');assert.match(slot.querySelector('.ch-art-caption').textContent,new RegExp('Theme '+kind));}
 assert.equal(document.querySelector('[data-ch-frame-kind="banner"][data-ch-frame-editor] [data-ch-frame-field="zoom"]').value,'200');assert.equal(document.querySelector('[data-ch-frame-field="still"]').value,'12.3');assert.ok(draws.some(course=>course.id==='folio-home'&&course.name==='Theme'));assert.equal(JSON.stringify(context),before);assert.doesNotMatch(artwork.textContent,/Overview\.webp|Course\.webp/);
 const controller=env.ReserveFrameEditor.create(document.body,{read(id,kind){reads.push([id,kind]);return context.s.themeArt[kind+'Art'];},save(id,kind,frame){saves.push({id,kind,frame:plain(frame)});},onError:error=>assert.fail(error.message)});t.after(()=>controller.destroy());
 assert.deepEqual(reads,[['theme','banner'],['theme','card'],['theme','background']]);const zoom=document.querySelector('[data-ch-frame-kind="banner"][data-ch-frame-editor] [data-ch-frame-field="zoom"]');zoom.value='225';f.send(zoom,'change');await settle();
 assert.equal(saves.length,1);assert.equal(saves[0].id,'theme');assert.equal(saves[0].kind,'banner');assert.equal(saves[0].frame.zoom,2.25);assert.equal(saves[0].frame.asset.name,'Theme banner.webp');assert.deepEqual(saves[0].frame.focus,{x:.2,y:.8});assert.equal(JSON.stringify(context),before);
});

test('Theme is available before any imported or saved theme artwork',t=>{
 const f=fixture(t),env=f.env,draws=[];env.ReserveCustomization={defaults:{},artKeys:['bannerArt','cardArt','backgroundArt','iconArt','borderArt','titleArt']};env.ReserveCourseArt={scene:course=>{draws.push(plain(course));return '';},mini:()=>'',frame:()=>'',title:()=>'',kind:()=>'home'};vm.runInContext(source('customize-ui.js'),env);
 const document=createDOM('<html><body>'+env.ReserveCustomizeUI.render({customizeOpen:true,customizeTab:'art',customizeCourseId:'theme',allCourses:[],courses:[],s:{}})+'</body></html>');
 assert.equal(document.querySelector('[data-rd-field="customize-course"] option[selected]').value,'theme');assert.equal(document.querySelectorAll('[data-rd-field="art-upload"]').length,6);assert.equal(document.querySelectorAll('[data-rd-action="art-clipboard"]').length,3);assert.equal(document.querySelectorAll('[data-ch-frame-editor]').length,0);assert.equal(draws.length,1);assert.equal(draws[0].id,'folio-home');assert.equal(draws[0].name,'Theme');assert.equal(document.querySelectorAll('.ch-art-controls p,.ch-art-controls small').length,0);
});
