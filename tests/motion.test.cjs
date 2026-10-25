const {test}=require('node:test'),assert=require('node:assert/strict');
const Motion=require('../extension/motion.js'),{create}=Motion;
// Gentle motion (motion.js): one selection surface per control glides, or
// crossfades in place, under the text; changed content fades in place without
// delays; what leaves lets go through a short ghost; keyboard input, Off,
// reduced motion and background renders are immediate. Nothing travels,
// blurs, rotates or scales in the interface.
const R=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
const media=(matches=false)=>({matches,addEventListener(){},removeEventListener(){}});
const viewport=fn=>{const saved=globalThis.innerHeight;globalThis.innerHeight=1000;try{return fn();}finally{globalThis.innerHeight=saved;}};

// A small fake DOM. q answers querySelector/querySelectorAll (a map, or a function of the selector),
// up answers closest(), and every animate() call is recorded on the node and in the stage.
function dom(){
 const made=[],doc={createElement:tag=>el(tag)};
 function style(owner){
  let transition='';const s={props:{},log:[],transitions:[],
   get transition(){return transition;},set transition(v){s.transitions.push(v);transition=v;},
   setProperty(k,v){s.props[k]=v;s.log.push({k,v,snap:owner.dataset.selSnap});},getPropertyValue(k){return s.props[k]??'';}};
  return s;
 }
 function el(tag='div',o={}){
  const n={tagName:tag.toUpperCase(),className:o.className||'',dataset:{...o.dataset},attrs:{},children:[],parentNode:null,parentElement:o.parent||null,
   textContent:o.text??'',innerHTML:o.html??'',rect:o.rect||R(0,0,0,0),q:o.q||{},up:o.up||{},animations:[],
   offsetLeft:o.x??0,offsetTop:o.y??0,offsetParent:o.offsetParent||null,clientWidth:o.clientWidth??0,scrollLeft:0,clientLeft:0,clientTop:0,
   get offsetWidth(){return o.w??this.rect.width;},get offsetHeight(){return o.h??this.rect.height;},get ownerDocument(){return doc;},
   get classList(){const self=this;return {contains:c=>self.className.split(' ').includes(c),add:c=>{self.className=(self.className+' '+c).trim();}};},
   setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},
   getBoundingClientRect(){return this.rect;},getClientRects(){return this.rect.width?[this.rect]:[];},
   append(child){child.parentNode=this;child.parentElement=this;this.children.push(child);},
   remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;}},
   contains(other){for(let p=other;p;p=p.parentElement)if(p===this)return true;return false;},
   query(s){return typeof this.q==='function'?this.q(s):typeof this.q[s]==='function'?this.q[s]():this.q[s];},
   querySelector(s){const v=this.query(s);return (Array.isArray(v)?v[0]:v)??null;},
   querySelectorAll(s){const v=this.query(s);return v==null?[]:[].concat(v);},
   closest(s){const v=this.up[s];return (typeof v==='function'?v():v)??null;},
   animate(frames,options){const a={target:n,frames,options,cancelled:false,onfinish:null,cancel(){this.cancelled=true;},finish(){this.onfinish?.();},effect:{getComputedTiming:()=>({endTime:(options.delay||0)+(options.duration||0)})}};n.animations.push(a);made.push(a);return a;}};
  n.style=style(n);
  return n;
 }
 return {el,made};
}

// ---- Tab pills ------------------------------------------------------------
function tabs({reduced=false,motionStyle}={}){
 const {el,made}=dom();
 const pill=el('span',{w:100});let active={dataset:{tab:'work'},offsetLeft:3,offsetWidth:110};
 const bar=el('div',{clientWidth:800,q:s=>s==='.t-tabs-pill'?pill:s.startsWith('.t-tab[')?active:null});
 const container=el('section',{dataset:{input:'pointer',...(motionStyle?{motionStyle}:{})},q:s=>s==='.t-tabs'?bar:null});
 let resize,disconnected=false;
 class Observer{constructor(fn){resize=fn;}observe(){}disconnect(){disconnected=true;}}
 const motion=create(container,{media:media(reduced),ResizeObserverImpl:Observer});
 return {motion,pill,container,made,select:(tab,x,w)=>{active={dataset:{tab},offsetLeft:x,offsetWidth:w};},resize:()=>resize(),get disconnected(){return disconnected;}};
}

test('workspace tabs snap on first paint, then glide on a pill timed by its distance; background renders never interrupt it',()=>{
 const f=tabs();f.motion.syncTabs(true);
 assert.equal(f.pill.style.transform,'translateX(3px)');assert.equal(f.pill.style.width,'110px');
 assert.deepEqual(f.pill.style.transitions,['none',''],'the first paint snaps and restores the CSS transition');
 f.pill.style.transitions.length=0;f.select('hub',116,120);f.motion.syncTabs(true);
 assert.equal(f.pill.style.transform,'translateX(116px)');assert.deepEqual(f.pill.style.transitions,[],'a pointer change keeps the CSS glide');
 // 340 + min(80, .2 x travel): travel = |116 - 3| + |120 - 110| / 2 = 118px.
 assert.equal(f.pill.style.props['--rd-pill-dur'],`${Math.round(340+Math.min(80,.2*118))}ms`);
 f.select('grades',700,90);f.motion.syncTabs(true);assert.equal(f.pill.style.props['--rd-pill-dur'],'420ms','a long glide is capped at 420ms');
 f.pill.style.transition='in-progress';f.motion.syncTabs(false);assert.equal(f.pill.style.transition,'in-progress','an unchanged background render leaves a running glide alone');
 f.pill.style.transitions.length=0;f.select('inbox',500,90);f.motion.syncTabs(false);
 assert.deepEqual(f.pill.style.transitions,['none','in-progress'],'a background change snaps the pill');
 assert.equal(f.made.length,0,'CSS owns the glide; no WAAPI');
 f.motion.destroy();assert.equal(f.disconnected,true);
});

test('Still fades the pill in where it lands; reduced motion and resize snap it',()=>{
 const s=tabs({motionStyle:'still'});s.motion.syncTabs(true);s.pill.style.transitions.length=0;
 s.select('hub',116,120);s.motion.syncTabs(true);
 assert.deepEqual(s.pill.style.transitions,['none',''],'nothing slides under Still');
 assert.equal(s.made.length,1);assert.deepEqual(s.made[0].frames,[{opacity:0},{opacity:1}]);assert.ok(s.made[0].options.duration<=220);
 s.motion.destroy();
 const r=tabs({reduced:true});r.motion.syncTabs();r.pill.style.transitions.length=0;r.select('inbox',245,85);r.motion.syncTabs(true);
 assert.equal(r.pill.style.transform,'translateX(245px)');assert.deepEqual(r.pill.style.transitions,['none','']);assert.equal(r.made.length,0);
 r.select('inbox',190,70);r.resize();assert.equal(r.pill.style.width,'70px');assert.equal(r.pill.style.transform,'translateX(190px)');
 r.motion.destroy();
});

// ---- Selection surfaces ---------------------------------------------------
// A shell with the assignment list (rows 40/90px tall: the one vertical surface since the rail's pill gave way to
// the rows' frames in 2.17), the view filters and the reader sections.
function surfaces({input='pointer',motionStyle,reduced=false,rowH=90}={}){
 const {el,made}=dom();
 const rail=el('aside'),rows=[el('button',{y:0,h:40,w:220,offsetParent:rail}),...[1,2,3,4,5,6].map(i=>el('div',{y:42+(i-1)*(rowH+2),h:rowH,w:220,offsetParent:rail}))];
 let railOn=rows[0];rail.q=s=>s.includes('.rd-assignment--selected')?railOn:s===':scope>.rd-assignment'?rows:null;
 const group=el('div'),filters=[[3,70],[75,60],[137,56],[195,80]].map(([x,w])=>el('button',{x,y:3,w,h:30,offsetParent:group}));
 let fltOn=filters[0];group.q=s=>s.includes('aria-pressed="true"')?fltOn:null;
 const track=el('div'),rtabs=[[3,96],[101,84]].map(([x,w])=>el('button',{x,y:3,w,h:28,offsetParent:track}));
 let rtabOn=rtabs[0];track.q=s=>s.includes('aria-pressed="true"')?rtabOn:null;
 const hosts={'.rd-assignment-list':rail,'.rd-filter-group':group,'.rd-reader-tabs':track};
 const shell=el('div',{rect:R(100,50,1600,1000),q:s=>hosts[s]??null});
 // motion.js writes each surface's geometry on its own box; the shared log keeps the shell's snap flag of the moment.
 for(const box of [rail,group,track]){const st=box.style;st.setProperty=(k,v)=>{st.props[k]=v;shell.style.log.push({k,v,snap:shell.dataset.selSnap});};}
 const container=el('section',{dataset:{input,...(motionStyle?{motionStyle}:{})},q:s=>s==='.rd-shell'?shell:null});
 const motion=create(container,{media:media(reduced),ResizeObserverImpl:null});
 const writes=key=>shell.style.log.filter(w=>w.k.startsWith(`--rd-sel-${key}-`));
 const snap=target=>({at:performance.now(),target,titles:new Map(),counts:new Map(),rows:new Map(),units:new Map()});
 return {motion,shell,rail,rows,group,filters,track,rtabs,made,container,writes,snap,
  pick:{rail:i=>{railOn=rows[i];},flt:i=>{fltOn=filters[i];},rtab:i=>{rtabOn=rtabs[i];}},
  clear(){shell.style.log.length=0;made.length=0;}};
}

test('each click has one lead surface that glides; every other surface snaps under data-sel-snap',()=>{
 const s=surfaces();s.motion.syncTabs(false);
 for(const key of ['pick','flt','rtab'])assert.ok(s.writes(key).length&&s.writes(key).every(w=>w.snap?.split(' ').includes(key)),`${key} snaps on first paint`);
 assert.equal(s.rail.style.props['--rd-sel-pick-o'],'1');assert.equal(s.shell.dataset.selSnap,undefined,'the snap flag is cleared at once');
 // A pointer click on the next row; the same render also changes the view filter.
 s.clear();s.pick.rail(1);s.pick.flt(2);s.motion.syncTabs(true,false,s.snap('pick'));
 const rail=s.writes('pick');
 assert.ok(rail.length&&rail.every(w=>w.snap===undefined),'the touched list surface is the lead and glides');
 assert.equal(s.rail.style.props['--rd-sel-pick-y'],'42px');assert.equal(s.rail.style.props['--rd-sel-pick-h'],'90px');
 // Travel = |42 - 0| + |90 - 40| / 2 = 67px.
 assert.equal(s.rail.style.props['--rd-sel-pick-dur'],`${Math.round(340+Math.min(80,.2*67))}ms`);
 assert.ok(s.writes('flt').filter(w=>!w.k.endsWith('-dur')).every(w=>w.snap==='flt'),'the other changed surface snaps');
 assert.equal(s.made.length,0,'a glide is a CSS transition, not WAAPI');
 // Without a named target the first surface that changed leads.
 s.clear();s.pick.flt(3);s.motion.syncTabs(true,false,s.snap(null));
 assert.ok(s.writes('flt').every(w=>w.snap===undefined));
 // A course picked in the rail leads no surface (the pen draws its row's frame instead): whatever changed simply lands.
 s.clear();s.pick.rail(2);s.pick.flt(1);s.motion.syncTabs(true,false,s.snap('rail'));
 assert.ok(s.writes('pick').length&&s.writes('flt').length&&[...s.writes('pick'),...s.writes('flt')].every(w=>w.snap),'no glide under a course switch');assert.equal(s.made.length,0);
 s.motion.destroy();
});

test('a save that re-renders in the background before the change\'s own render (Undo) still glides from where the click saw it',()=>{
 const s=surfaces();s.motion.syncTabs(false);s.pick.rail(1);s.motion.syncTabs(false);
 const snap={...s.motion.snapshot({closest:sel=>sel==='.rd-toast-dock'?{}:null}),at:performance.now()};
 assert.equal(snap.target,'pick','the list\'s toast (Undo) acts on the list');
 // The store update renders first, with no motion: the surface snaps to its new row.
 s.pick.rail(2);s.motion.syncTabs(false);
 s.clear();s.motion.syncTabs(true,false,{...snap,target:'pick'});
 const log=s.writes('pick').filter(w=>!w.k.endsWith('-dur'));
 assert.equal(log.find(w=>w.k==='--rd-sel-pick-y'&&w.snap==='pick')?.v,'42px','put back where the student saw it, under the snap flag');
 assert.equal(log.at(-1).snap,undefined,'then it glides');assert.equal(s.rail.style.props['--rd-sel-pick-y'],'134px');
 assert.equal(s.rail.style.props['--rd-sel-pick-dur'],`${Math.round(340+Math.min(80,.2*92))}ms`,'timed by the whole way it travels (42 to 134)');
 s.motion.destroy();
});

test('a jump longer than 160px or 3 rows crossfades in place; under Still every jump does, with no slide',()=>{
 viewport(()=>{
  const s=surfaces();s.motion.syncTabs(false);s.pick.rail(1);s.motion.syncTabs(true,false,s.snap('pick'));
  // Row 1 to row 3: 184px (two 90px rows) is past 160px.
  s.clear();s.pick.rail(3);s.motion.syncTabs(true,false,s.snap('pick'));
  assert.ok(s.writes('pick').every(w=>w.snap==='pick'),'the new surface is placed where it lands');
  const [fadeIn,echo]=s.rail.animations.slice(-2);
  assert.deepEqual(fadeIn.frames,[{opacity:0},{opacity:1}]);assert.equal(fadeIn.options.pseudoElement,'::before');assert.equal(fadeIn.options.duration,220);
  assert.ok(s.rail.animations.every(a=>a.frames.every(f=>!('transform' in f))),'the new selection surface fades without an upward entrance');
  assert.deepEqual(echo.frames,[{opacity:1},{opacity:0}]);assert.equal(echo.options.pseudoElement,'::after');assert.equal(echo.options.duration,200);
  assert.equal(s.rail.style.props['--rd-echo-pick-y'],'42px','the echo lets go where the old surface was');
  s.motion.destroy();
  // More than three rows at once is a hop even when it is short: 28px rows, row 1 to row 5 is 120px.
  const short=surfaces({rowH:28});short.motion.syncTabs(false);short.pick.rail(1);short.motion.syncTabs(true,false,short.snap('pick'));
  short.clear();short.pick.rail(4);short.motion.syncTabs(true,false,short.snap('pick'));
  assert.ok(short.writes('pick').filter(w=>!w.k.endsWith('-dur')).every(w=>w.snap===undefined),'three rows (90px) still glide');
  short.clear();short.pick.rail(1);short.motion.syncTabs(true,false,short.snap('pick'));
  assert.ok(short.writes('pick').every(w=>w.snap===undefined),'back up three rows glides too');
  short.clear();short.pick.rail(5);short.motion.syncTabs(true,false,short.snap('pick'));
  assert.ok(short.writes('pick').every(w=>w.snap==='pick'),'four rows (120px) crossfade in place');
  short.motion.destroy();
  const still=surfaces({motionStyle:'still'});still.motion.syncTabs(false);still.clear();
  still.pick.rail(1);still.motion.syncTabs(true,false,still.snap('pick'));
  assert.ok(still.writes('pick').every(w=>w.snap==='pick'),'even a one-row move fades in place');
  assert.deepEqual(still.rail.animations.map(a=>a.options.pseudoElement),['::before','::after']);
  assert.ok(still.rail.animations.every(a=>a.frames.every(f=>!('transform' in f))),'Still never slides');
  still.motion.destroy();
 });
});

test('reader sections glide a white chip on ::before; keyboard input, stale snapshots and reduced motion snap every surface',()=>{
 assert.deepEqual(Motion.surfaces.map(s=>[s.key,s.pseudo]),[['flt','::before'],['pick','::before'],['rtab','::before']]);
 const s=surfaces();s.motion.syncTabs(false);s.clear();
 s.pick.rtab(1);s.motion.syncTabs(true,false,s.snap('rtab'));
 assert.ok(s.writes('rtab').every(w=>w.snap===undefined),'the section chip glides sideways');
 assert.deepEqual(['x','y','w','h'].map(k=>s.track.style.props[`--rd-sel-rtab-${k}`]),['101px','3px','84px','28px'],'it is placed like the other chips (x, y, width and height)');
 s.motion.destroy();
 const still=surfaces({motionStyle:'still'});still.motion.syncTabs(false);still.clear();still.pick.rtab(1);still.motion.syncTabs(true,false,still.snap('rtab'));
 assert.deepEqual(still.track.animations.map(a=>[a.options.pseudoElement,a.options.duration]),[['::before',220]]);still.motion.destroy();
 for(const setup of [{input:'keyboard'},{reduced:true},{motionStyle:'off'}]){
  const k=surfaces(setup);k.motion.syncTabs(false);k.clear();k.pick.rail(4);k.pick.rtab(1);k.motion.syncTabs(true,false,k.snap('pick'));
  assert.ok(['pick','rtab'].every(key=>k.writes(key).every(w=>w.snap?.includes(key))),JSON.stringify(setup));assert.equal(k.made.length,0);k.motion.destroy();
 }
 const stale=surfaces();stale.motion.syncTabs(false);stale.clear();stale.pick.rail(1);
 stale.motion.syncTabs(true,false,{...stale.snap('pick'),at:performance.now()-Motion.limits.stale-10});
 assert.ok(stale.writes('pick').every(w=>w.snap==='pick'),'a snapshot older than 1.5s means a background render');stale.motion.destroy();
});

// ---- The settle wave ------------------------------------------------------
// A dashboard switching course: rail rows, a heading, the list, the reader and the deck.
function stage({input='pointer',reduced=false,motionStyle}={}){
 const {el,made}=dom();
 const s={made};
 s.shell=el('div',{rect:R(100,50,1600,1000)});
 s.ws=el('main',{rect:R(390,70,1300,900)});
 s.rail=el('aside',{rect:R(110,70,240,700)});
 const inWs={'.rd-workspace':()=>s.ws,'.rd-course-rail':null},inList={'.rd-workspace':()=>s.ws,'.rd-assignment-list':()=>s.list,'.rd-course-rail,.rd-assignment-list':()=>s.list};
 s.h1=el('h1',{rect:R(450,80,300,38),text:'Your work',up:inWs});
 s.date=el('p',{rect:R(760,90,160,20),text:'Wednesday, Sep 30',up:inWs});
 s.filters=el('div',{rect:R(400,140,400,36),text:'Up next Today Week My plan',up:inWs});
 s.list=el('div',{rect:R(400,200,480,600),up:inWs});
 s.rows=[['Gas laws',210],['Lab report',300],['Reading notes',390]].map(([text,top])=>el('article',{rect:R(400,top,480,88),text,up:inList,parent:s.list}));
 s.workTitle=el('h2',{rect:R(410,180,200,24),text:'Up next',up:inWs});
 s.count=el('span',{rect:R(620,184,80,16),text:'3 assignments',up:inWs});
 s.body=el('div',{rect:R(900,260,500,400),text:'Instructions',up:inWs});
 s.deck=el('section',{rect:R(1420,200,260,300),text:'Course information',up:inWs});
 s.units=()=>[s.date,s.filters,...s.rows,s.body,s.deck];
 const group=sel=>sel==='.rd-course-heading>p'?[s.date]:sel==='.rd-desk-toolbar>*'?[s.filters]:sel.startsWith('.rd-ready-note')?s.rows:sel.startsWith('.rd-reader-content')?[s.body]:sel.startsWith('.rd-course-information>.rd-deck-header')?[s.deck]:null;
 s.ws.q=sel=>sel==='.rd-workspace-heading h1'?s.h1:sel==='.rd-work-heading h2'?s.workTitle:sel==='.rd-workspace-heading h1,#rd-reader-title'?[s.h1]:group(sel);
 s.container=el('section',{dataset:{input,courseId:'all',...(motionStyle?{motionStyle}:{})},q:sel=>sel==='.rd-shell'?s.shell:sel==='.rd-workspace'?s.ws:sel==='.rd-course-rail'?s.rail:sel==='.rd-assignment-list'?s.list:sel==='.rd-toast'?s.toast||null:sel==='.rd-workspace-heading h1'?s.h1:sel==='.rd-work-heading h2'?s.workTitle:sel.startsWith('.rd-work-heading>div>span')?[s.count]:sel.includes('.rd-course-heading>p,')?s.units():null});
 s.rail.children=[];s.list.children=s.rows;
 s.motion=create(s.container,{media:media(reduced),ResizeObserverImpl:null});
 s.anims=()=>made.filter(a=>!s.ghosts().some(g=>a.target===g));
 s.layer=()=>s.shell.children.find(c=>c.className==='rd-settle-layer');
 s.ghosts=()=>s.layer()?.children||[];
 return s;
}
const ends=a=>(a.options.delay||0)+a.options.duration;
const offsets=a=>a.frames.flatMap(f=>Object.entries(f));

test('snapshot reads only what is painted in view, and nothing for keyboard, reduced motion, Off or a destroyed dashboard',()=>viewport(()=>{
 const s=stage();s.rows[2].rect=R(400,5000,480,88);
 const snap=s.motion.snapshot({closest:sel=>sel==='.rd-course-rail'?{}:null});
 assert.equal(snap.target,'rail');assert.ok(performance.now()-snap.at<50);
 assert.equal(snap.titles.get('heading').text,'Your work');assert.equal(snap.titles.get('work').text,'Up next');
 assert.equal(snap.counts.get(s.count),'3 assignments');
 assert.ok(snap.units.has(s.rows[0])&&!snap.units.has(s.rows[2]),'off-screen units are not read');
 assert.equal(snap.units.get(s.date).top,20,'units are measured from their region, so page scroll cancels out');
 assert.deepEqual(snap.art,{},'the course art in view (none here) is read for its ghost');assert.equal('tile' in snap||'illo' in snap,false,'no motif-era fields');
 s.motion.destroy();assert.equal(s.motion.snapshot({}),null,'a destroyed dashboard reads nothing');
 for(const setup of [{input:'keyboard'},{reduced:true},{motionStyle:'off'}]){const k=stage(setup);assert.equal(k.motion.snapshot({}),null,JSON.stringify(setup));k.motion.destroy();}
 assert.equal(Motion.limits.stale,1500);
}));

test('reveal animates nothing for keyboard input, reduced motion, Off, or a background render',()=>viewport(()=>{
 for(const [setup,options] of [[{input:'keyboard'},{}],[{reduced:true},{}],[{motionStyle:'off'},{}],[{},{animate:false}],[{},{snapshot:null}],[{},{stale:true}]]){
  const s=stage(setup),snap=s.motion.snapshot({})||{at:performance.now(),target:null,titles:new Map(),counts:new Map(),rows:new Map(),units:new Map()};
  if(options.stale)snap.at=performance.now()-2000;
  s.h1.textContent='Chemistry';
  for(const kind of ['course','filter','reader']){
   s.motion.reveal(s.ws,{animate:options.animate??true,kind,snapshot:'snapshot' in options?options.snapshot:snap});
   assert.equal(s.ws.dataset.motion,'settled',`${JSON.stringify(setup)} ${JSON.stringify(options)} ${kind}`);
  }
  assert.equal(s.made.length,0,`${JSON.stringify(setup)} ${JSON.stringify(options)}`);assert.equal(s.layer(),undefined);s.motion.destroy();
 }
}));

test('a course switch: the title hands over through a ghost and all changed content fades in place together',()=>viewport(()=>{
 const s=stage(),snap=s.motion.snapshot({closest:sel=>sel==='.rd-course-rail'?{}:null});
 s.h1.textContent='Chemistry';s.rows[0].textContent='Titration lab';s.rows[1].textContent='Stoichiometry';s.rows[2].textContent='Lab safety';s.deck.textContent='Chemistry home page';s.count.textContent='3 assignments';
 s.motion.reveal(s.ws,{animate:true,kind:'course',snapshot:snap});
 assert.equal(s.ws.dataset.motion,'entering');
 // The title: the old words let go where they stood (90ms), and the new ones fade without translation.
 const [ghost]=s.ghosts();assert.ok(ghost,'a ghost of the old title');assert.equal(ghost.innerHTML,snap.titles.get('heading').html);
 const letGo=ghost.animations[0];assert.deepEqual(letGo.frames,[{opacity:1},{opacity:0}]);assert.ok(letGo.options.duration<=120);
 assert.equal(s.layer().attrs['aria-hidden'],'true');
 const title=s.h1.animations[0];assert.deepEqual(title.frames,[{opacity:0},{opacity:1}]);assert.equal(title.options.duration,200);
 // Unchanged units stay still: the date and the filter bar.
 assert.equal(s.date.animations.length+s.filters.animations.length+s.body.animations.length,0,'unchanged text in the same place never moves');
 const entering=[...s.rows,s.deck].map(n=>n.animations[0]);
 assert.ok(entering.every(a=>a&&a.options.fill==='backwards'),'changed units use a short fading effect');
 assert.ok(entering.every(a=>!a.options.delay),'all content, including course information, fades at once');
 assert.equal(s.deck.animations[0].options.duration,190);
 for(const a of s.anims()){
  assert.ok(a.options.duration<=220,`a UI fade of ${a.options.duration}ms`);
  assert.ok(ends(a)<=220,`the switch settles by 220ms (${ends(a)})`);
  assert.ok(a.frames.every(f=>Object.keys(f).every(k=>['opacity'].includes(k))),`no transform or rise: ${JSON.stringify(a.frames)}`);
 }
 // The last animation to end settles the switch; an earlier one cannot.
 const last=s.anims().reduce((a,b)=>ends(b)>ends(a)?b:a);
 s.rows[0].animations[0].finish();assert.equal(s.ws.dataset.motion,'entering');
 last.finish();assert.equal(s.ws.dataset.motion,'settled');
 letGo.finish();assert.equal(s.ghosts().length,0,'a finished ghost is removed');
 s.motion.destroy();
}));

test('unchanged keyed content never animates merely because its layout position changed',()=>viewport(()=>{
 const s=stage(),snap=s.motion.snapshot({});
 s.h1.textContent='Chemistry';
 // Same text: a list row nudged 30px up, the filter bar 10px down and the deck 30px down.
 s.rows[1].rect=R(400,270,480,88);s.filters.rect=R(400,150,400,36);s.deck.rect=R(1420,230,260,300);
 s.motion.reveal(s.ws,{animate:true,kind:'course',snapshot:snap});
 assert.equal(s.rows[1].animations.length,0,'a list row can reflow without a vertical animation');
 assert.equal(s.filters.animations.length,0,'unchanged toolbar text does not move');
 assert.equal(s.deck.animations.length,0,'unchanged course information stays still even when its position changes');
 assert.deepEqual(s.h1.animations[0].frames,[{opacity:0},{opacity:1}],'only the changed course title fades');
 s.motion.destroy();
 assert.equal(Motion.limits.glidePx,160);assert.equal(Motion.limits.glideRows,3);
}));

test('a new view of the list fades its rows together; the toast fades out in place',()=>viewport(()=>{
 const s=stage();s.toast=s.shell.ownerDocument.createElement('div');s.toast.rect=R(900,700,300,50);s.toast.innerHTML='<span role="status">Marked done</span>';
 const snap=s.motion.snapshot({closest:sel=>sel==='.rd-filter-group'?{}:null});assert.equal(snap.target,'flt');assert.ok(snap.toast);
 s.toast=null;s.rows.forEach((r,i)=>{r.textContent='Row '+i;});s.count.textContent='2 assignments';s.workTitle.textContent='Today';
 s.motion.reveal(s.list,{animate:true,kind:'filter',snapshot:snap});
 assert.ok(s.rows.every(r=>r.animations[0]?.options.fill==='backwards'));
 const toast=s.ghosts().find(g=>g.className.includes('rd-toast-ghost'));assert.ok(toast,'the toast lets go where it was');
 const exit=toast.animations[0];
 assert.deepEqual(exit.frames,[{opacity:1},{opacity:0}]);assert.equal(exit.options.duration,160);
 assert.ok(s.count.animations.length===1,'a changed count updates in place');
 s.motion.cancel();assert.equal(s.ghosts().length,0,'cancel removes every ghost');assert.ok(exit.cancelled);
 assert.equal(s.list.dataset.motion,'settled');s.motion.destroy();
}));

test('every non-art interface keyframe uses opacity alone on content changes',()=>viewport(()=>{
 const frames=[];
 const run=(kind,change,target)=>{const s=stage();s.toast=s.shell.ownerDocument.createElement('div');s.toast.rect=R(900,700,300,50);const snap=s.motion.snapshot({});s.toast=null;change(s);s.motion.reveal(target(s),{animate:true,kind,snapshot:snap});frames.push(...s.made.map(a=>[kind,a]));s.motion.destroy();};
 run('course',s=>{s.h1.textContent='Ethics';s.rows.forEach(r=>{r.textContent+='!';});s.deck.textContent='x';},s=>s.ws);
 run('filter',s=>{s.rows.forEach(r=>{r.textContent+='!';});},s=>s.list);
 run('reader',s=>{s.body.textContent='New';},s=>s.body);
 run('workspace',()=>{},s=>{s.ws.q=sel=>sel.startsWith('.rd-workspace-heading,')?[s.h1,s.list]:null;return s.ws;});
 run('section',()=>{},s=>s.body);
 assert.ok(frames.length>10);
 assert.ok(frames.some(([,a])=>a.target.className.includes('rd-toast-ghost')),'the leaving toast is among them');
 // The course art film (ids 'rd-art' and 'rd-art-loop') is decorative and pinned apart (tests/art-motion.test.cjs).
 for(const [kind,a] of frames.filter(([,a])=>!['rd-art','rd-art-loop'].includes(a.options.id))){
  const text=JSON.stringify(a.frames);
  assert.ok(a.frames.every(f=>Object.keys(f).every(k=>k==='opacity')),`${kind}: ${text}`);
 }
}));

test('every UI arrival fade takes 160-220ms; deliberate selection travel still caps at 420ms',()=>{
 const {fadeMs,maxUiMs}=Motion.limits;
 for(const [kind,duration] of Object.entries(fadeMs))assert.ok(duration>=160&&duration<=220,`${kind}: ${duration}`);
 assert.equal(maxUiMs,420);
 // The glide itself: 0.6% overshoot at most, settled by 420ms.
 assert.ok(Math.max(...Motion.easings.glide.match(/[\d.]+/g).map(Number))<=1.006);
 assert.doesNotMatch(Motion.easings.settle,/1\.0\d*[1-9]/,'the settle spring never overshoots');
});

test('keyboard input, cancel and destroy stop a running switch and leave nothing behind',()=>viewport(()=>{
 for(const stop of ['keyboard','cancel','destroy']){
  const s=stage(),snap=s.motion.snapshot({});s.h1.textContent='Chemistry';s.rows[0].textContent='Titration lab';
  s.motion.reveal(s.ws,{animate:true,kind:'course',snapshot:snap});
  const running=[...s.made];assert.ok(running.length&&s.ghosts().length);
  if(stop==='keyboard'){s.container.dataset.input='keyboard';s.motion.reveal(s.ws,{animate:false,kind:'course'});}else if(stop==='cancel')s.motion.cancel();else s.motion.destroy();
  assert.ok(running.filter(a=>a.target!==s.ghosts()[0]).every(a=>a.cancelled),`${stop} cancels every animation`);
  if(stop!=='keyboard')assert.equal(s.ghosts().length,0,`${stop} removes the ghosts`);
  assert.equal(s.ws.dataset.motion,'settled');
  if(stop==='destroy')assert.equal(s.layer(),undefined,'destroy removes the ghost layer');
  s.motion.destroy();
 }
}));

test('completed rows play one held exit: tick 0-200ms, strike 60-320ms, fade 140-310ms, gap 170-470ms',async()=>{
 const {el}=dom();
 const row=(finished=Promise.resolve())=>{
  const strokes=[el('path'),el('path')];strokes.forEach((p,i)=>{p.getTotalLength=()=>10+i*6;});
  const svg=el('svg',{q:{'path,circle,line,polyline':strokes}}),title=el('a');
  const r=el('article',{rect:R(0,0,400,84),q:{'.rd-check-off svg':svg,'.rd-assignment-title':title}});
  const animate=r.animate;r.animate=(frames,options)=>{const a=animate(frames,options);a.finished=finished;return a;};
  return {r,strokes,title};
 };
 const f=tabs(),{r,strokes,title}=row(),exit=f.motion.leave(r);
 assert.equal(r.dataset.motion,'leaving');
 const tick=strokes.flatMap(p=>p.animations);assert.equal(tick.length,2);assert.ok(tick.every(a=>a.options.delay>=0&&ends(a)<=200&&a.options.fill==='backwards'),'the tick draws by 200ms');
 assert.ok(tick.every(a=>a.frames[0].strokeDashoffset&&a.frames.at(-1).strokeDashoffset==='0'),'drawn with dashes in keyframes, never attributes');
 const [strike]=title.animations;assert.deepEqual(strike.frames,[{backgroundSize:'0% 1.5px'},{backgroundSize:'100% 1.5px'}],'a drawn strike, not a line-through');
 assert.deepEqual([strike.options.delay,ends(strike)],[60,320]);
 const [fade,close]=r.animations;
 assert.deepEqual(fade.frames,[{opacity:1},{opacity:0}]);assert.deepEqual([fade.options.delay,ends(fade)],[140,310]);assert.equal(fade.options.fill,'forwards');
 assert.equal(close.frames[0].height,'84px');assert.equal(close.frames[1].height,'0px');assert.deepEqual([close.options.delay,ends(close)],[170,470]);
 assert.equal(await exit.finished,true);exit.cancel();
 assert.ok([...tick,strike,fade,close].every(a=>a.cancelled),'the caller releases the held frame after re-rendering');assert.equal(r.dataset.motion,'settled');
 const interrupted=f.motion.leave(row(Promise.reject(Error('cancelled'))).r);assert.equal(await interrupted.finished,false,'an interrupted exit lets the save continue');
 // A key press or resize during an exit cancels everything (cancelAll) without throwing.
 const pressed=row(),held=f.motion.leave(pressed.r);assert.doesNotThrow(()=>f.motion.cancel());
 assert.equal(pressed.r.dataset.motion,'settled');assert.ok(pressed.r.animations.every(a=>a.cancelled));held.cancel();
 assert.equal(tabs({reduced:true}).motion.leave(row().r),null,'reduced motion removes the row without waiting');
 assert.equal(tabs({motionStyle:'off'}).motion.leave(row().r),null,'so does Off');
 assert.equal(f.motion.leave({dataset:{}}),null);f.motion.destroy();assert.equal(f.motion.leave(row().r),null);
});

test('a group\'s only row takes its head along in the same exit, and the head below eases to the first head\'s padding, so the re-render moves nothing',async()=>{
 const {el}=dom(),saved=globalThis.getComputedStyle;
 const head=el('h3',{className:'rd-date-group',rect:R(0,0,400,39)}),r=el('article',{className:'rd-assignment',rect:R(0,39,400,84)}),below=el('h3',{className:'rd-date-group',rect:R(0,123,400,49)});
 Object.assign(head,{previousElementSibling:null,nextElementSibling:r});Object.assign(r,{previousElementSibling:head,nextElementSibling:below});
 globalThis.getComputedStyle=n=>({paddingTop:n===head?'6px':'16px'});
 try{
  const f=tabs(),exit=f.motion.leave(r);
  const [fade,close]=head.animations;
  assert.deepEqual(fade.frames,[{opacity:1},{opacity:0}]);assert.deepEqual([fade.options.delay,ends(fade)],[140,310],'the head lets go with its row');
  assert.equal(close.frames[0].height,'39px');assert.deepEqual(close.frames[1],{height:'0px',paddingTop:'0px',paddingBottom:'0px',marginTop:'0px',marginBottom:'0px'});assert.deepEqual([close.options.delay,ends(close)],[170,470],'and closes in the row\'s gap');
  assert.deepEqual(below.animations[0].frames,[{paddingTop:'16px'},{paddingTop:'6px'}],'the next head becomes the first: its 16px top eases to the first head\'s 6px');
  assert.ok([fade,close,below.animations[0]].every(a=>a.options.fill==='forwards'),'held until the re-render, which then matches it');
  await exit.finished;exit.cancel();assert.ok([...head.animations,...below.animations].every(a=>a.cancelled));
  // A group that keeps other rows keeps its head.
  const kept=el('h3',{className:'rd-date-group'}),mid=el('article',{className:'rd-assignment',rect:R(0,39,400,84)}),sibling=el('article',{className:'rd-assignment'});
  Object.assign(mid,{previousElementSibling:kept,nextElementSibling:sibling});f.motion.leave(mid).cancel();
  assert.equal(kept.animations.length+sibling.animations.length,0);
  // The last group's only row: the head goes, and nothing follows to ease.
  const last=el('h3',{className:'rd-date-group',rect:R(0,0,400,49)}),tail=el('article',{className:'rd-assignment',rect:R(0,49,400,84)});
  Object.assign(last,{previousElementSibling:r});Object.assign(tail,{previousElementSibling:last,nextElementSibling:null});f.motion.leave(tail).cancel();
  assert.equal(last.animations.length,2);f.motion.destroy();
 }finally{globalThis.getComputedStyle=saved;}
});

test('Undo: the returning row and group head fade immediately, while other rows use their final positions',()=>viewport(()=>{
 const s=stage(),snap=s.motion.snapshot({});
 const head=s.shell.ownerDocument.createElement('h3'),back=s.shell.ownerDocument.createElement('article');
 head.className='rd-date-group';head.rect=R(400,200,480,39);back.className='rd-assignment';back.rect=R(400,239,480,88);back.textContent='Gas Stoich Odds';
 back.matches=sel=>sel==='.rd-assignment';back.previousElementSibling=head;back.up={'.rd-workspace':()=>s.ws};
 s.rows.forEach((r,i)=>{r.rect=R(400,337+i*90,480,88);});s.list.children=[head,back,...s.rows];
 s.motion.reveal(back,{animate:true,kind:'filter',snapshot:snap});
 assert.deepEqual(back.animations[0].frames,[{opacity:0},{opacity:1}],'the row fades in where it rests');
 assert.deepEqual(head.animations[0].frames,[{opacity:0},{opacity:1}],'its group head fades at the same time');
 assert.ok(s.rows.every(r=>r.animations.length===0),'existing rows can reflow with no upward movement');
 assert.ok(!back.animations[0].options.delay&&!head.animations[0].options.delay,'the returning row and head appear without a cascade');
 assert.equal(back.animations[0].options.duration,180);
 s.motion.destroy();
 // Keyboard input stays immediate: no glide.
 const k=stage({input:'keyboard'});k.motion.reveal(k.rows[0],{animate:true,kind:'filter',snapshot:null});assert.equal(k.made.length,0);k.motion.destroy();
}));

// The course name as artwork (2.17): where a title piece shows, the real h1 is clipped to 1px for assistive technology.
test('a title that is hidden visually (the course name stands beside it as artwork) is neither snapshotted nor set down; the words it replaces still let go',()=>viewport(()=>{
 const clipped=R(449,180,1,1);
 // From a lettered title to a course whose name is artwork: the old words let go through their ghost; the hidden h1 takes no entrance.
 const s=stage();const snap={...s.motion.snapshot({closest:sel=>sel==='.rd-course-rail'?{}:null}),at:performance.now()};
 assert.equal(snap.titles.get('heading').text,'Your work');
 s.h1.textContent='Chemistry';s.h1.rect=clipped;s.container.dataset.courseId='7';
 s.motion.reveal(s.ws,{animate:true,kind:'course',snapshot:snap});
 assert.equal(s.h1.animations.length,0,'nothing is animated on a title nobody sees');
 const [ghost]=s.ghosts();assert.ok(ghost,'the lettered title it replaces lets go where it stood');
 assert.equal(ghost.innerHTML,snap.titles.get('heading').html);assert.deepEqual(ghost.animations[0].frames,[{opacity:1},{opacity:0}]);assert.equal(ghost.style.left,`${(450-100).toFixed(1)}px`,'at the old title\'s place, not at the 1px box');
 s.motion.destroy();
 // From a course whose name is artwork: its clipped h1 is not a title to hand over (a 1px ghost of its words would show).
 const t=stage();t.h1.textContent='Chemistry';t.h1.rect=clipped;
 const from={...t.motion.snapshot({closest:sel=>sel==='.rd-course-rail'?{}:null}),at:performance.now()};
 assert.equal(from.titles.has('heading'),false);assert.ok(from.titles.has('work'),'the other titles are read as before');
 t.h1.textContent='Ethics';t.h1.rect=R(450,80,300,38);
 t.motion.reveal(t.ws,{animate:true,kind:'course',snapshot:from});
 assert.equal(t.h1.animations.length,1,'the next visible course title fades in');
 assert.deepEqual(t.h1.animations[0].frames,[{opacity:0},{opacity:1}]);
 assert.ok(!t.ghosts().some(g=>/Chemistry/.test(g.innerHTML||'')),'no ghost of the hidden words');
 t.motion.destroy();
}));

test('course and assignment changes fade in place in 220ms; stable course information never reenters',()=>viewport(()=>{
 const s=stage(),snap=s.motion.snapshot({});
 s.h1.textContent='Ethics';s.rows[0].textContent='Aristotle';s.deck.textContent='Ethics resources';s.body.textContent='Read Book II';
 s.motion.reveal(s.ws,{animate:true,kind:'course',snapshot:snap});
 for(const node of [s.h1,s.rows[0],s.deck,s.body]){
  assert.equal(node.animations.length,1,`${node.textContent} enters once`);
  assert.deepEqual(node.animations[0].frames,[{opacity:0},{opacity:1}],`${node.textContent} fades in place`);
  assert.ok(node.animations[0].options.duration>=160&&node.animations[0].options.duration<=220,`${node.textContent} completes promptly`);
 }
 const courseInfoAnimations=s.deck.animations.length,first=s.body.animations[0];
 s.body.up['.rd-reader']=()=>s.ws;
 const next=s.motion.snapshot({});s.body.textContent='Next assignment';
 s.motion.reveal(s.body,{animate:true,kind:'reader',snapshot:next});
 assert.equal(s.deck.animations.length,courseInfoAnimations,'the unchanged course-info section does not animate again');
 assert.equal(s.body.animations.length,2,'changed reader content enters once');
 assert.deepEqual(s.body.animations[1].frames,[{opacity:0},{opacity:1}]);
 assert.equal(first.cancelled,true,'a fast reader change cancels its earlier content entrance');
 s.motion.destroy();
}));
