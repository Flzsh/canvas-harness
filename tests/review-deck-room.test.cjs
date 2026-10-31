'use strict';
// The Review deck's two modes: the Home module (small, medium, large) and the reading room (the full page).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../extension/review-deck-model.js');require('../extension/review-deck-art.js');const UI=require('../extension/review-deck.js');
const DAY='2026-10-20',ORIGIN='https://school.instructure.com',CSS=fs.readFileSync(path.join(__dirname,'../extension/review-deck.css'),'utf8');
const card=(front='term',back='answer',extra={})=>M.makeCard({front,back,course:'5',today:DAY,...extra});
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

// A stand-in for the dashboard's container: selectors resolve to the few elements a test sets up.
function room({motion='off'}={}){
 const at=new Map(),rootNode={activeElement:null},calls={append:0,clone:0,animate:0};
 const node=(name,{inside=[],rect={left:20,top:40,width:300,height:180}}={})=>{const n={name,inside:new Set(inside),focused:0,clicked:0,isConnected:true,disabled:false,kids:new Map(),
  getBoundingClientRect:()=>({...rect,right:rect.left+rect.width,bottom:rect.top+rect.height}),
  focus(){n.focused++;rootNode.activeElement=n;},click(){n.clicked++;n.onclick?.();},
  closest(sel){for(const s of sel.split(',').map(x=>x.trim()))if(n.inside.has(s))return n.owners?.[s]||n;return null;},
  querySelector:sel=>n.kids.get(sel)||null,querySelectorAll:()=>[],animate(){calls.animate++;return null;},cloneNode(){calls.clone++;return node('ghost');}};return n;};
 const container={dataset:{motionStyle:motion},querySelector:sel=>at.get(sel)||null,querySelectorAll:()=>[],getRootNode:()=>rootNode,append(){calls.append++;},contains:()=>true};
 return {container,at,rootNode,node,calls};
}
function fixture(cards=[],{container={querySelector:()=>null},size}={}){
 let data={settings:{reviewDecks:M.cleanDeck({cards}),moduleSize:size?{review:size}:{}}},changed=0;const time=Date.parse(DAY+'T12:00:00Z');
 const context={user:{id:'7'},origin:ORIGIN,s:{timeZone:'UTC',moduleSize:size?{review:size}:{}},courses:[{id:'5',name:'Chemistry',color:'#356E5D'},{id:'9',name:'Spanish II'}],items:[]};
 const store={owner:{accountId:'7',origin:ORIGIN},get(){return structuredClone(data);},async update(fn){const next=structuredClone(data);fn(next);data=next;return structuredClone(data);}};
 const ui=UI.create({container,store,getContext:()=>context,onChange:()=>changed++,isEnabled:()=>true,isSelected:()=>true,now:()=>time});
 return {ui,context,action:(name,values={})=>ui.action('review-deck-'+name,values),input:(name,value)=>ui.input('review-deck-'+name,value),module:s=>ui.renderModule({s:{moduleSize:{review:s}}}),get data(){return structuredClone(data);},get changed(){return changed;}};
}
const inPage={tagName:'DIV',closest:sel=>sel==='[data-review-deck]'?{}:null};
const key=(ui,k,target=inPage)=>{let prevented=0;const handled=ui.keydown({key:k,target,preventDefault(){prevented++;}});return {handled,prevented};};

test('both modes render: the reading room and the module in three sizes, with no room in the module',async()=>{
 const f=fixture([card('molar mass of H2O','18 g/mol'),card('Avogadro','6.02e23'),card('hola','hello',{course:'9'})]);
 const page=f.ui.renderReviewDeck();
 assert.match(page,/data-review-deck/);assert.match(page,/data-rv-mode="home"/);assert.match(page,/class="rv-stage"[^>]*data-rd-own="review-room"/);
 assert.match(page,/Study all<small class="rv-n"> · 3<\/small>/,'the count is read out with the name but is no part of it');assert.match(page,/data-rd-key="rv-box-5"/);assert.match(page,/data-rd-key="rv-box-9"/);assert.match(page,/data-rd-key="rv-box-personal"/);
 assert.match(page,/New card/);assert.match(page,/data-rd-action="review-deck-fold"/);assert.match(page,/data-rv-go="work"[^>]*|data-tab="work" data-rv-go="work"/);
 assert.match(page,/class="rv-boxart"/,'boxes are drawn');assert.match(page,/data-rd-key="rv-box-5" data-rd-action="review-deck-start" data-course="5" aria-label="Course box" [^>]*aria-describedby="rv-box-say-room-5"[^]*?<\/button><span id="rv-box-say-room-5" hidden>Chemistry: 2 due<\/span>/,'a box is named Course box and described by its course and what is due');assert.match(page,/bx-step/,'step dividers carry their labels for hover');
 const small=f.module('s'),medium=f.module('m'),large=f.module('l');
 assert.match(small,/data-rv-size="s"/);assert.match(small,/<strong>3<\/strong><span>due today/);assert.match(small,/data-rd-action="review-deck-open" data-start="all"/);
 assert.match(medium,/data-rv-size="m"/);assert.match(medium,/Study all<small class="rv-n"> · 3<\/small>/);assert.match(medium,/role="img" aria-label="Due over the next 7 days/);assert.equal((medium.match(/class="rv-box"/g)||[]).length,3);
 assert.match(large,/data-rv-size="l"/);assert.match(large,/data-rd-action="review-deck-start" data-course="all" data-here="true"/);
 // a box with nothing due in the module grows into the room with its cards out; the drawer only exists in the room
 assert.doesNotMatch(large,/class="rv-box"[^>]*data-rd-action="review-deck-tab"/);assert.match(large,/data-rd-key="rv-box-personal" data-rd-action="review-deck-open" data-open="cards" data-course="personal"/);
 for(const html of [small,medium,large]){assert.doesNotMatch(html,/rv-stage|rv-world|data-review-deck[ >]/,'no room in the module');assert.match(html,/data-rv-go="review"/);}
 assert.match(f.ui.moduleOpener(),/data-rd-action="review-deck-open"[^>]*aria-label="Open the reading room"/);
 assert.equal(UI.renderModule({reviewDeck:f.ui,s:{moduleSize:{review:'s'}}}),small);
 globalThis.ReserveFeatures={enabled:()=>false};try{assert.equal(UI.renderModule({reviewDeck:f.ui}),'');assert.equal(UI.moduleOpener({reviewDeck:f.ui}),'');}finally{delete globalThis.ReserveFeatures;}
 await f.action('start');let study=f.ui.renderReviewDeck();
 assert.match(study,/data-rv-mode="study"/);assert.match(study,/class="rv-cardwrap" data-rd-key="rv-card-page-0" data-side="front"/);assert.match(study,/data-up="false" inert aria-hidden="true"/);assert.match(study,/3 to go/);
 assert.match(study,/data-rd-key="rv-cardbtn" data-rd-action="review-deck-reveal" aria-label="Show answer" aria-describedby="rv-face-page-f"/,'the card is named by what it does and described by the face on show');assert.match(study,/id="rv-face-page-f" class="rv-face rv-front">/);assert.match(study,/rv-face rv-back" aria-hidden="true"/);
 await f.action('reveal');study=f.ui.renderReviewDeck();assert.match(study,/data-side="back"/);assert.match(study,/data-rd-action="review-deck-turn" aria-label="Turn the card" aria-describedby="rv-face-page-b"/);assert.match(study,/data-up="true"/);assert.match(study,/18 g\/mol/);
 for(let i=0;i<3;i++){await f.action('reveal');await f.action('grade',{grade:'good'});}
 const done=f.ui.renderReviewDeck();assert.match(done,/data-rv-mode="done"/);assert.match(done,/<strong>Done<\/strong>/);assert.match(done,/Back to boxes/);assert.match(done,/rv-sticker/);
 f.ui.destroy();
});

test('one session across both modes: the module grows into the room and folds back on the same card',async()=>{
 const f=fixture([card('one','1'),card('two','2'),card('three','3'),card('four','4')],{size:'l'});
 await f.action('start',{course:'all',here:'true'});let mod=f.module('l');assert.match(mod,/data-rv-mode="study"/);assert.match(mod,/rv-card-mod-0/);
 await f.action('reveal');await f.action('grade',{grade:'good'});mod=f.module('l');assert.match(mod,/rv-card-mod-1/);assert.match(mod,/3 to go/);assert.match(mod,/>two</);
 await f.action('open');let page=f.ui.renderReviewDeck();
 assert.match(page,/data-rv-mode="study"/);assert.match(page,/rv-card-page-1/);assert.match(page,/3 to go/);assert.match(page,/>two</);assert.match(page,/data-arrive="rest"/,'growing keeps the card in hand instead of dealing a new one');
 await f.action('reveal');await f.action('grade',{grade:'easy'});await f.action('fold');
 mod=f.module('l');assert.match(mod,/rv-card-mod-2/);assert.match(mod,/2 to go/);assert.match(mod,/>three</);
 assert.equal(key(f.ui,'Escape',{tagName:'BUTTON',closest:sel=>sel==='[data-rv-mod]'?{}:null}).handled,true,'Esc in the module leaves the session');
 assert.equal(f.ui.getState().session.away,true);assert.equal(f.ui.getState().session.index,2);
 assert.match(f.module('s'),/data-rd-action="review-deck-open" data-resume="true"><svg[^]*Carry on<small class="rv-n"> · 2 left<\/small>/);
 assert.match(f.ui.renderReviewDeck(),/data-rv-mode="home"[^]*Carry on<small class="rv-n"> · 2 left<\/small>/);
 await f.action('open',{resume:'true'});page=f.ui.renderReviewDeck();assert.match(page,/data-rv-mode="study"/);assert.match(page,/rv-card-page-2/);assert.equal(f.ui.getState().session.away,false);
 f.ui.destroy();
});

test('focus returns to the module opener when the room folds, goes into the room when it opens, and back to the drawer opener',async()=>{
 const r=room(),{at,node,rootNode}=r;
 const page=node('page'),fold=node('fold',{inside:['[data-review-deck]']}),cardButton=node('card',{inside:['[data-review-deck]']}),cabtag=node('cabtag',{inside:['[data-review-deck]']});
 const mod=node('module'),grow=node('grow',{inside:['[data-rv-mod]']}),widget=node('widget',{rect:{left:600,top:300,width:420,height:260}});mod.inside.add('.rd-widget');mod.owners={'.rd-widget':widget};
 page.kids.set('button.rv-card',cardButton);page.kids.set('[data-rv-opener="cabinet"]',cabtag);
 const goHome=node('go-work'),goRoom=node('go-review');
 const showPage=()=>{at.clear();at.set('[data-review-deck]',page);at.set('[data-rv-fold]',fold);at.set('[data-rv-go="work"]',goHome);};
 const showHome=()=>{at.clear();at.set('[data-rv-mod]',mod);at.set('[data-rv-grow]',grow);at.set('[data-rv-go="review"]',goRoom);};
 const f=fixture([card('a','1'),card('b','2')],{container:r.container});
 goHome.onclick=()=>{showHome();f.module('m');};goRoom.onclick=()=>{showPage();f.ui.renderReviewDeck();};
 showPage();f.ui.renderReviewDeck();await f.action('start');await tick();
 rootNode.activeElement=fold;assert.equal(key(f.ui,'Escape',fold).handled,true);await tick();
 assert.equal(goHome.clicked,1,'Esc folds the room through the dashboard workspace button');assert.equal(grow.focused,1);assert.equal(rootNode.activeElement,grow,'focus returns to the opener');
 await f.action('open');await tick();assert.equal(goRoom.clicked,1);assert.equal(rootNode.activeElement,cardButton,'focus goes to the card in the room');
 await f.action('tab',{tab:'cards',rvOpener:'cabinet'});f.ui.renderReviewDeck();await tick();await f.action('drawer-close');f.ui.renderReviewDeck();await tick();assert.equal(rootNode.activeElement,cabtag,'the drawer gives focus back to its opener');
 f.ui.destroy();
});

// The real order: an action, a tick (nothing may move yet), then the dashboard draws the new state, then a tick.
test('focus follows the render that shows the new state: the card on start, the pencil after a mid-session save, Back to boxes at the end',async()=>{
 const r=room(),{at,node,rootNode}=r,inRoom={inside:['[data-review-deck]']};
 const show=page=>{at.clear();at.set('[data-review-deck]',page);};
 const f=fixture([card('a','1'),card('b','2')],{container:r.container});
 const home=node('home'),studyAll=node('study-all',inRoom);home.kids.set('.rv-primary',studyAll);
 show(home);f.ui.renderReviewDeck();await tick();studyAll.focus();
 await f.action('start',{course:'all'});await tick();assert.equal(rootNode.activeElement,studyAll,'nothing moves before the study page is drawn');
 const study=node('study'),first=node('card-1',inRoom);study.kids.set('button.rv-card',first);
 studyAll.isConnected=false;show(study);f.ui.renderReviewDeck();await tick();assert.equal(rootNode.activeElement,first,'Study all puts focus on the card');
 // the pencil mid-session: focus goes into the card, and after Save back to the pencil
 await f.action('reveal');
 const editing=node('editing'),field=node('front-field',inRoom),cardDiv=node('card-edit',inRoom);cardDiv.focus=()=>{};editing.kids.set('.rv-card-edit textarea',field);editing.kids.set('.rv-card',cardDiv);
 await f.action('edit',{id:f.ui.getState().session.list[0].id,session:'true'});first.isConnected=false;show(editing);f.ui.renderReviewDeck();await tick();assert.equal(rootNode.activeElement,field);
 f.input('front','a, fixed');await f.action('save');await tick();assert.equal(rootNode.activeElement,field,'nothing moves before the saved card is drawn');
 const saved=node('saved'),again=node('card-1-again',inRoom),pencil=node('pencil',inRoom);saved.kids.set('button.rv-card',again);saved.kids.set('[data-rd-key="rv-pencil"]',pencil);
 field.isConnected=false;show(saved);f.ui.renderReviewDeck();await tick();assert.equal(rootNode.activeElement,pencil,'focus returns to the pencil after a mid-session save');
 assert.equal(f.data.settings.reviewDecks.cards[0].f,'a, fixed');
 // grading: the next card takes over from the one that left; the last grade hands focus to Back to boxes
 await f.action('grade',{grade:'good'});await tick();
 const next=node('next'),second=node('card-2',inRoom);next.kids.set('button.rv-card',second);
 pencil.isConnected=false;again.isConnected=false;show(next);f.ui.renderReviewDeck();await tick();assert.equal(rootNode.activeElement,second);
 await f.action('reveal');await f.action('grade',{grade:'good'});await tick();assert.equal(rootNode.activeElement,second,'nothing moves before the done page is drawn');
 const done=node('done'),finish=node('finish',inRoom);done.kids.set('[data-rd-key="rv-finish"]',finish);
 second.isConnected=false;show(done);f.ui.renderReviewDeck();await tick();assert.equal(rootNode.activeElement,finish,'Back to boxes takes focus at the end');
 f.ui.destroy();
 // from a small module: Study grows into the room, and the card there takes focus
 const q=room(),g=fixture([card('c','3')],{container:q.container}),mod=q.node('module'),study2=q.node('study',{inside:['[data-rv-mod]']}),goRoom=q.node('go-review');
 mod.kids.set('.rv-primary',study2);q.at.set('[data-rv-mod]',mod);q.at.set('[data-rv-go="review"]',goRoom);g.module('s');await tick();study2.focus();
 const page=q.node('page'),third=q.node('card-3',{inside:['[data-review-deck]']});page.kids.set('button.rv-card',third);
 goRoom.onclick=()=>{q.at.clear();q.at.set('[data-review-deck]',page);study2.isConnected=false;};
 await g.action('open',{start:'all'});await tick();assert.equal(goRoom.clicked,1,'the module grows through the dashboard workspace button');
 g.ui.renderReviewDeck();await tick();assert.equal(q.rootNode.activeElement,third,'the card takes focus in the room');
 g.ui.destroy();
});

test('more than four boxes stand in two rows: the back row on a drawn step, the new-card stack at the front row end; Market kits colour the room',()=>{
 const f=fixture([card('a','1'),card('b','2',{course:'9'}),card('c','3',{course:'11'}),card('d','4',{course:'12'}),card('e','5',{course:'13'})]);
 const page=f.ui.renderReviewDeck(),front=page.match(/<div class="rv-tier rv-tier-front"[^]*?(?=<div class="rv-tier rv-tier-back")/)?.[0]||'',back=page.slice(page.indexOf('class="rv-tier rv-tier-back"'));
 assert.match(page,/class="rv-boxes"[^>]*data-n="6" data-rows="2"/);
 assert.equal((front.match(/class="rv-box"/g)||[]).length,3);assert.match(front,/class="rv-newcard"/,'the new-card stack stays in the front row');
 assert.match(back,/^class="rv-tier rv-tier-back"[^>]*><span class="rv-riser" aria-hidden="true"><svg class="rv-riserart"/);assert.equal((back.match(/class="rv-box"/g)||[]).length,3);
 const one=fixture([card('a','1')]).ui.renderReviewDeck();assert.match(one,/data-rows="1"/);assert.doesNotMatch(one,/rv-tier-back|rv-riser/);
 // the room is never cropped more than a little at the top; a wide room shows more of the room on the left
 assert.match(CSS,/\.rv-room\{--u:min\(max\(calc\(100cqw \/ 1600\),calc\(100cqh \/ 1000\)\),calc\(100cqh \/ 960\)\)/);
 assert.doesNotMatch(CSS,/\.rv-world\{[^}]*contain:layout paint/,'the drawing may run on past the world on the left');
 // Market kits mark the dashboard data-rd-data-theme: the room's furniture, cloth, books and line follow the kit
 const kit=CSS.match(/\.rd\[data-rd-data-theme\] \.rv\{([^}]*)\}/)?.[1]||'';
 for(const name of ['wall','wd','cu','cu2','tie','rug','rug2','b1','b8','rk','rkh','rkp','rkt','ink','paper','clay','again','good','easy'])assert.match(kit,new RegExp(`--rv-${name}:[^;]*var\\(--rd-`),`--rv-${name} follows the kit`);
 assert.doesNotMatch(CSS,/\.rd\[data-theme-kit\]:not\(/,'scene kits are not mistaken for Market kits');
});

// Every move waits for the render that shows where things end up, then plays once.
test('the moves play once the new state is drawn: a box carried to the table end, the drawer pushed home, the card put down after the pencil, the done pile carried to the middle',async()=>{
 const r=room({motion:'gentle'}),{at,calls}=r;
 const el=(name,extra)=>{const n=r.node(name,extra);n.attrs={};n.style={cssText:'',getPropertyValue:()=>'',setProperty(){}};n.classList={add(){},contains:()=>false};
  n.setAttribute=(k,v)=>{n.attrs[k]=v;};n.removeAttribute=k=>{delete n.attrs[k];};n.getAttribute=k=>n.attrs[k]??null;n.append=c=>{(n.added||=[]).push(c);};n.remove=()=>{n.gone=true;};
  n.cloneNode=()=>{calls.clone++;return el(name+' copy');};n.animate=frames=>{calls.animate++;(n.moves||=[]).push(frames);return null;};n.getAnimations=()=>[];n.querySelectorAll=()=>n.all||[];return n;};
 r.container.ownerDocument={createElement:tag=>el('new '+tag),defaultView:globalThis};
 const f=fixture([card('a','1'),card('b','2',{course:'9'})],{container:r.container}),show=page=>{at.clear();at.set('[data-review-deck]',page);};
 // opening a box: the box pressed is carried to the table's end, the other box sinks behind the edge
 const home=el('home'),chem=el('chemistry box'),spanish=el('spanish box');chem.attrs['data-rd-key']='rv-box-5';spanish.attrs['data-rd-key']='rv-box-9';home.all=[chem,spanish];
 show(home);f.ui.renderReviewDeck();await tick();
 await f.action('start',{course:'5'});await tick();assert.equal(calls.animate,0,'nothing moves before the study page is drawn');
 const study=el('study'),side=el('side box'),cabtag=el('cabinet tag');study.kids.set('.rv-sidebox',side);show(study);f.ui.renderReviewDeck();await tick();
 assert.equal(side.moves?.length,1,'the box is carried to the table end');assert.match(JSON.stringify(side.moves[0]),/scale\(1\.05,\.93\)/,'and lands with a squash');
 assert.ok(calls.clone>=1,'the other box is copied to sink out of sight');
 // the card put down after the pencil: lowered, the pencil taken away
 const wrap=el('wrap'),cardBtn=el('card');wrap.kids.set('.rv-card',cardBtn);study.kids.set('.rv-cardwrap',wrap);
 await f.action('edit',{id:f.ui.getState().session.list[0].id,session:'true'});f.ui.renderReviewDeck();await tick();
 await f.action('edit-cancel');await tick();assert.equal(cardBtn.moves,undefined);
 f.ui.renderReviewDeck();await tick();assert.equal(cardBtn.moves?.length,1,'the card is lowered');assert.equal(wrap.added?.length,1,'the pencil is taken away');
 f.ui.renderReviewDeck();await tick();assert.equal(cardBtn.moves.length,1,'once');
 // the last card: the done pile is carried to the middle
 const pileArt=el('pile art',{rect:{left:900,top:500,width:120,height:96}});wrap.inside.add('[data-review-deck]');wrap.owners={'[data-review-deck]':study};study.kids.set('.rv-pile-done .rv-pile-art',pileArt);at.set('[data-review-deck] .rv-cardwrap',wrap);
 await f.action('reveal');await f.action('grade',{grade:'good'});await tick();
 const done=el('done'),stack=el('stack',{rect:{left:500,top:400,width:400,height:120}});done.kids.set('.rv-donestack',stack);show(done);at.set('[data-review-deck] .rv-cardwrap',null);f.ui.renderReviewDeck();await tick();
 assert.equal(stack.moves?.length,1,'the pile is carried to the middle');
 // the card files: pushed home after the render, and the cabinet tag swings
 await f.action('finish');const home2=el('home 2'),drawer=el('drawer');home2.kids.set('.rv-cabtag',cabtag);show(home2);f.ui.renderReviewDeck();await tick();
 await f.action('tab',{tab:'cards',rvOpener:'cabinet'});at.set('[data-review-deck] .rv-drawer',drawer);f.ui.renderReviewDeck();await tick();
 await f.action('drawer-close');await tick();assert.equal(cabtag.moves,undefined,'nothing moves before the drawer is gone from the page');
 at.delete('[data-review-deck] .rv-drawer');f.ui.renderReviewDeck();await tick();assert.equal(cabtag.moves?.length,1,'the tag swings when the drawer goes home');
 f.ui.destroy();
});

test('reduced motion and Motion off keep everything still',async()=>{
 // the stylesheet: every one-off motion of the deck is behind Motion gentle, and off or reduced motion stop all of it
 assert.match(CSS,/\.rd\[data-motion-style=off\] :is\(\.rv,\.rv-fly\) \*,\.rd\[data-motion-style=off\] :is\(\.rv,\.rv-fly,\.rv-grow\),\.rd\[data-feature-motion=off\] :is\(\.rv,\.rv-fly\) \*,\.rd\[data-feature-motion=off\] :is\(\.rv,\.rv-fly,\.rv-grow\)\{animation:none!important;transition:none!important\}/);
 // the loops that never stop also stop with Living drawings off, like every loop on the dashboard
 for(const name of ['rv-drift','rv-puff','rv-steam','rv-glint','rv-caustic'])for(const m of CSS.matchAll(new RegExp(`([^{}]*)\\{[^{}]*animation:${name} `,'g')))assert.match(m[1],/\.rd\[data-motion-style=gentle\]:not\(\[data-living-art=off\]\)/,`${name} stops with Living drawings off`);
 assert.match(CSS,/@media \(prefers-reduced-motion:reduce\)\{:is\(\.rv,\.rv-fly\) \*,:is\(\.rv,\.rv-fly,\.rv-grow\)\{animation:none!important;transition:none!important\}\}/);
 for(const name of ['rv-flip','rv-unflip','rv-deal','rv-rise','rv-set','rv-slide','rv-drop','rv-pull','rv-lift','rv-pencil','rv-square','rv-drift','rv-puff','rv-steam','rv-glint'])
  for(const m of CSS.matchAll(new RegExp(`([^{}]*)\\{[^{}]*animation:${name} `,'g')))assert.match(m[1],/data-motion-style=gentle/,`${name} plays only with Motion on`);
 assert.match(CSS,/\.rv-world\[data-paused\] \*/,'the room rests while the page is hidden');
 // the view: with reduced motion nothing is thrown or animated
 const saved=globalThis.matchMedia;globalThis.matchMedia=q=>({matches:/reduce/.test(q)});
 try{
  const r=room({motion:'gentle'}),page=r.node('page'),wrap=r.node('wrap');r.at.set('[data-review-deck] .rv-cardwrap',wrap);r.at.set('[data-review-deck]',page);
  const f=fixture([card('a','1'),card('b','2')],{container:r.container});await f.action('start');await f.action('reveal');await f.action('grade',{grade:'good'});await tick();
  assert.equal(r.calls.clone,0,'no thrown card');assert.equal(r.calls.append,0);assert.equal(r.calls.animate,0);assert.equal(f.ui.getState().session.index,1);f.ui.destroy();
 }finally{if(saved)globalThis.matchMedia=saved;else delete globalThis.matchMedia;}
 const r=room({motion:'off'}),wrap=r.node('wrap');r.at.set('[data-review-deck] .rv-cardwrap',wrap);
 const f=fixture([card('a','1')],{container:r.container});await f.action('start');await f.action('reveal');await f.action('grade',{grade:'good'});await tick();assert.equal(r.calls.clone,0);assert.equal(r.calls.animate,0);f.ui.destroy();
 // the Living drawings & motion feature switched off is Motion off for the deck too
 const q=room({motion:'gentle'}),wrap2=q.node('wrap');q.container.dataset.featureMotion='off';q.at.set('[data-review-deck] .rv-cardwrap',wrap2);
 const g=fixture([card('a','1')],{container:q.container});await g.action('start');await g.action('reveal');await g.action('grade',{grade:'good'});await tick();assert.equal(q.calls.clone,0,'no thrown card with the motion feature off');assert.equal(q.calls.animate,0);g.ui.destroy();
});

test('#64: editing a card mid-session never blocks grading, and the session resumes on the same card',async()=>{
 const learned=card('molar mass','18'),d=M.cleanDeck({cards:[learned,card('second','2')]});M.answer(d,learned.id,'f','good','2026-10-12');M.answer(d,learned.id,'f','good','2026-10-14');
 const f=fixture(d.cards);const boxBefore=f.data.settings.reviewDecks.cards[0].s.f.box;
 await f.action('start');assert.equal(f.ui.getState().session.list[0].id,learned.id);await f.action('reveal');
 await f.action('edit',{id:learned.id,session:'true'});let html=f.ui.renderReviewDeck();
 assert.equal(f.ui.getState().session.editing,learned.id);assert.match(html,/rv-card-edit/);assert.match(html,/data-up="false" inert/,'no grading while the pencil is down');assert.doesNotMatch(html,/class="rv-drawer"/,'the card is edited in place');
 f.input('front','molar mass of H2O');await f.action('save');
 const saved=f.data.settings.reviewDecks.cards[0];assert.equal(saved.f,'molar mass of H2O');assert.equal(saved.s.f.box,boxBefore,'a fix keeps the card in its step');
 const s=f.ui.getState().session;assert.equal(s.editing,null);assert.equal(s.index,0,'same card');assert.equal(s.revealed,true,'still turned over');
 html=f.ui.renderReviewDeck();assert.match(html,/molar mass of H2O/);assert.match(html,/data-up="true"/);
 await f.action('grade',{grade:'good'});assert.doesNotMatch(f.ui.renderReviewDeck(),/changed elsewhere/);assert.equal(f.ui.getState().session.index,1);assert.equal(f.data.settings.reviewDecks.cards[0].s.f.last,DAY);
 f.ui.destroy();
 // by keys: E edits before the turn, Esc puts the pencil down, Space turns, 3 grades
 const g=fixture([card('front one','back one'),card('front two','back two')]);await g.action('start');
 assert.equal(key(g.ui,'e').handled,true);assert.ok(g.ui.getState().session.editing);
 assert.equal(key(g.ui,'Escape',{tagName:'TEXTAREA',closest:sel=>sel==='[data-review-deck]'?{}:null}).handled,true);assert.equal(g.ui.getState().session.editing,null);assert.equal(g.data.settings.reviewDecks.cards[0].f,'front one');
 assert.equal(key(g.ui,' ').handled,true);assert.equal(g.ui.getState().session.revealed,true);
 assert.equal(key(g.ui,' ').handled,true);assert.equal(g.ui.getState().session.peek,true,'Space turns the card back over');key(g.ui,' ');
 key(g.ui,'3');await tick();assert.equal(g.ui.getState().session.index,1);g.ui.destroy();
 // through the card files while the session waits
 const h=fixture([card('alpha','a'),card('beta','b')]);await h.action('start');const id=h.ui.getState().session.list[0].id;
 await h.action('tab',{tab:'cards'});await h.action('edit',{id});assert.equal(h.ui.getState().drawer,true);h.input('back','alpha, first letter');await h.action('save');
 await h.action('tab',{tab:'review'});assert.equal(h.ui.getState().drawer,false);await h.action('reveal');await h.action('grade',{grade:'good'});
 assert.equal(h.ui.getState().session.index,1);assert.equal(h.data.settings.reviewDecks.cards[0].b,'alpha, first letter');assert.doesNotMatch(h.ui.renderReviewDeck(),/changed elsewhere/);h.ui.destroy();
});

test('keys stay with the deck: nothing is taken from inputs, other pages, or a module that is not studying',async()=>{
 const f=fixture([card('a','1')]);await f.action('start');
 assert.equal(key(f.ui,'1').handled,false,'grades wait for the turn');
 assert.equal(key(f.ui,' ',{tagName:'INPUT',closest:()=>null}).handled,false);
 assert.equal(key(f.ui,' ',{tagName:'BUTTON',closest:sel=>sel.includes('button')?{}:null}).handled,false,'Space on a button is the button');
 f.ui.destroy();
 let selected=false;const g=UI.create({container:{querySelector:()=>null},store:{owner:{accountId:'7',origin:ORIGIN},get:()=>({settings:{reviewDecks:M.cleanDeck({cards:[card('a','1')]})}}),update:async()=>{}},getContext:()=>({user:{id:'7'},origin:ORIGIN,s:{timeZone:'UTC'},courses:[]}),isEnabled:()=>true,isSelected:()=>selected,now:()=>Date.parse(DAY+'T12:00:00Z')});
 await g.action('review-deck-start');assert.equal(key(g,' ',{tagName:'DIV',closest:()=>null}).handled,false,'another workspace keeps its keys');g.destroy();
});
