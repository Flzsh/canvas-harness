'use strict';
require('../extension/site.js');
// Roadmap item 6 (owner, 2026-11): "Bring the plain bits into the art". extension/home-bits.js: the greeting table (which
// variant shows when, under a fixed clock), one line per visit, the one chip component, the drawn Edit Home / Undo move
// controls, and the art slots that a drawing fills later without a code change (scripts/bits-art.cjs).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Bits=require('../extension/home-bits.js'),Art=require('../scripts/bits-art.cjs');
const extension=path.join(__dirname,'..','extension'),read=name=>fs.readFileSync(path.join(extension,name),'utf8');
const NY='America/New_York';
// 2026-09-29 is a Tuesday; New York is UTC-4 in September. 2026-10-03 is a Saturday, 2026-10-04 a Sunday.
const tue=(hour,minute=0)=>Date.UTC(2026,8,29,hour+4,minute),sat=(hour,minute=0)=>Date.UTC(2026,9,3,hour+4,minute),sun=(hour,minute=0)=>Date.UTC(2026,9,4,hour+4,minute);
const busy={today:1};// something open due today, nothing overdue: the time of day decides
const pick=(now,situation=busy,extra={})=>Bits.greeting({now,timeZone:NY,situation,...extra});

test('the time of day: early morning, morning, midday, afternoon, evening and late night, at their exact boundaries',()=>{
 const cases=[[0,0,'late'],[4,59,'late'],[5,0,'early'],[7,59,'early'],[8,0,'morning'],[11,59,'morning'],[12,0,'midday'],[13,59,'midday'],[14,0,'afternoon'],[16,59,'afternoon'],[17,0,'evening'],[21,59,'evening'],[22,0,'late'],[23,59,'late']];
 for(const [hour,minute,id] of cases){const g=pick(tue(hour,minute));assert.equal(g.id,id,`${hour}:${minute}`);assert.equal(g.slot,'greet-'+id);}
 // the hour is the chosen time zone's, not the computer's
 assert.equal(Bits.greeting({now:tue(9),timeZone:'America/Los_Angeles',situation:busy}).id,'early','6 AM in Los Angeles');
 assert.equal(Bits.greeting({now:tue(2),timeZone:'America/Los_Angeles',situation:busy}).id,'late','11 PM in Los Angeles');
});

test('the situations: the day before a test, something gone overdue, the weekend, a clear day; late night first',()=>{
 assert.equal(pick(tue(10),{today:1,testTomorrow:1}).id,'test');
 assert.equal(pick(tue(10),{today:1,overdue:2,slipped:1}).id,'overdue');
 assert.equal(pick(tue(10),{today:1,overdue:2,slipped:0}).id,'morning','work overdue for longer does not make every greeting about it');
 assert.equal(pick(sat(10)).id,'weekend');assert.equal(pick(sun(19)).id,'weekend');
 assert.equal(pick(tue(10),{}).id,'clear','nothing open due today, nothing overdue');
 assert.equal(pick(tue(10),{today:0,overdue:1}).id,'morning','not clear while anything is overdue');
 assert.equal(pick(sat(10),{}).id,'weekend','the weekend before a clear day');
 // precedence: late night > test > overdue > weekend > clear > time of day
 assert.equal(pick(tue(23),{testTomorrow:1,slipped:1}).id,'late');
 assert.equal(pick(sun(20),{testTomorrow:1,slipped:1}).id,'test','Sunday evening before a Monday test');
 assert.equal(pick(sat(11),{slipped:1}).id,'overdue');
 assert.equal(pick(tue(4,30),{testTomorrow:1}).id,'late');
});

test('every variant has short, warm lines that name the student only by first name, and its own art slot',()=>{
 const ids=Bits.GREETINGS.map(g=>g.id);
 assert.deepEqual(ids.slice().sort(),['afternoon','clear','early','evening','late','midday','morning','overdue','test','weekend']);
 for(const g of Bits.GREETINGS){
  assert.ok(g.lines.length>=3,g.id+': several lines');
  assert.equal(g.slot,'greet-'+g.id);assert.equal(Bits.SLOTS[g.slot].use,'scene');
  for(const line of g.lines){
   const shown=line.replace('{day}','Wednesday');
   assert.ok(shown.length<=22,`${g.id}: "${shown}" fits the heading (22 characters)`);
   assert.doesNotMatch(line,/!|\?|\b(?:must|should|need|hurry|behind|late work|overdue|missing|deadline|don.t forget|catch up|again)\b/i,`${g.id}: "${line}" never nags`);
  }
 }
 const g=pick(sat(10),busy,{name:'Alexandra Rivera'});assert.ok(g.text.endsWith(', Alexandra'),g.text);
 assert.equal(pick(sat(10),busy,{name:'  '}).text,pick(sat(10)).line,'no name: the line alone');
 for(const now of [sat(9),sat(10),sat(11),sat(12),sat(13)]){const w=pick(now);if(w.index===0)assert.equal(w.line,'Happy Saturday');}
});

test('one line per visit: the memo keeps the line while its variant and day hold; a new variant or day picks again',()=>{
 const memo={},first=pick(tue(8,5),busy,{memo});
 for(let m=0;m<230;m+=7)assert.equal(pick(tue(8,5)+m*60000,busy,{memo}).text,first.text,'the same line all morning');
 const noon=pick(tue(12,0),busy,{memo});assert.equal(noon.id,'midday');assert.deepEqual(memo.greet,{id:'midday',key:'2026-09-29',index:noon.index});
 const nextDay=pick(Date.UTC(2026,8,30,12+4),busy,{memo});assert.equal(memo.greet.key,'2026-09-30');assert.equal(nextDay.index,Bits.greeting({now:Date.UTC(2026,8,30,16),timeZone:NY,situation:busy}).index);
 // without a memo it is steady within the hour, and the hours do not all say the same thing
 assert.equal(pick(tue(9,1)).text,pick(tue(9,59)).text);
 const lines=new Set();for(let d=0;d<14;d++)for(const h of [8,9,10,11])lines.add(Bits.greeting({now:Date.UTC(2026,8,28+d,h+4),timeZone:NY,situation:busy}).line);
 assert.ok(lines.size>=2,'the morning lines take turns');
});

test('a test is a quiz, test or exam by its name or Canvas type; a review, corrections or practice is not',()=>{
 for(const name of ['Unit 3 Test','Reading quiz: Ethics II','Chapter 5 exam','Midterm','Final exam'])assert.equal(Bits.isTest({name}),true,name);
 for(const name of ['Unit 2 quiz review','Stoichiometry quiz corrections','Practice test','Lab report','Contest entry'])assert.equal(Bits.isTest({name}),false,name);
 assert.equal(Bits.isTest({name:'Vocabulary 4',submissionTypes:['online_quiz']}),true);
});

test('the chip: one component for New, Overdue, Due today and Tomorrow, its kind from the mode or the tone, the words kept',()=>{
 assert.deepEqual(Bits.CHIP_KINDS,['new','overdue','today','tomorrow']);
 for(const [value,kind] of [['new','new'],['overdue','overdue'],['today','today'],['tomorrow','tomorrow'],['danger','overdue'],['warn','today'],['info','tomorrow'],['success','new'],['nothing','']])assert.equal(Bits.chipKind(value),kind,value);
 assert.equal(Bits.chipAttrs('today'),' data-chip="today"','an empty slot: the kraft tag of refresh.css');
 assert.equal(Bits.chipAttrs('accent'),'');
 assert.equal(Bits.chip('danger','3 days <late>',{cls:'ch-handin-chip',tone:'danger'}),'<span class="ch-handin-chip rd-bit-chip" data-tone="danger" data-chip="overdue">3 days &lt;late&gt;</span>');
 // refresh.css draws it in the paper look only (a scene or a Market theme keeps its own chips) and never by colour alone
 const css=read('refresh.css'),P='.rd:not([data-theme-kit]):not([data-rd-data-theme])';
 assert.ok(css.includes(`${P} .rd-bit-chip { --tag-wash:`));assert.ok(css.includes(`${P} .rd-bit-chip::before {`)||css.includes(`${P} .rd-bit-chip::before, `)||css.includes(`, ${P} .rd-bit-chip::before {`));
 assert.ok(css.includes(`${P} .rd-bit-chip[aria-pressed=true] {`)&&/rd-bit-chip\[aria-pressed=true\] \{[^}]*font-weight: 650/.test(css),'the chosen chip is bold as well as deeper');
 assert.ok(css.includes(`${P} .rd-bit-chip[data-chip-art]::before {`),'a drawn chip label replaces the tag');
 // its class is its own: no other stylesheet styles it (widgets.css's .rd-chip is the focus timer's minute buttons)
 for(const file of fs.readdirSync(extension).filter(f=>f.endsWith('.css')&&f!=='refresh.css'))assert.doesNotMatch(read(file),/\.rd-bit-chip\b|\.rd-bit-ctl\b/,file);
});

// ---- the art slots: every bit names one; an empty slot keeps the existing drawing; a filled one is used as it is ----
test('the slot table: sizes, places and fallbacks for every bit; the generated block is current',()=>{
 const slots=Object.keys(Bits.SLOTS);
 for(const id of ['early','morning','midday','afternoon','evening','late','weekend','clear','overdue','test'])assert.ok(slots.includes('greet-'+id),id);
 for(const s of ['ctl-edit-home','ctl-undo-move','ctl-show-info','chip-new','chip-overdue','chip-today','chip-tomorrow','bookmark-slip'])assert.ok(slots.includes(s),s);
 for(const [name,s] of Object.entries(Bits.SLOTS)){assert.ok(['scene','icon','frame'].includes(s.use),name);assert.ok(s.where&&s.fallback&&s.max>0,name);if(s.use==='frame')assert.equal(s.slice.length,4,name);}
 const {source,next}=Art.build();assert.equal(source,next,'run npm run bits-art');
 assert.deepEqual(Object.keys(Bits.ART),[],'no slot holds a drawing yet: every bit uses its fallback');
 assert.equal(Bits.scene('greet-late'),'');assert.equal(Bits.icon('ctl-undo-move'),'');assert.equal(Bits.frame('chip-new'),'');
});

test('bits-art checks a dropped-in drawing: its slot, its size and nothing that reaches outside the file',()=>{
 const scene=w=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 240" data-cycle="8"><g class="art-ink"><path d="M0 200H${w}"/></g></svg>`;
 assert.deepEqual(Art.check('greet-late.svg',scene(1200),Bits.SLOTS),{w:1200,cycle:8,inner:'<g class="art-ink"><path d="M0 200H1200"/></g>'});
 assert.throws(()=>Art.check('greet-late.svg',scene(400),Bits.SLOTS),/480 <= W <= 1680/);
 assert.throws(()=>Art.check('greet-noon.svg',scene(480),Bits.SLOTS),/not a slot/);
 assert.deepEqual(Art.check('ctl-undo-move.svg','<svg viewBox="0 0 40 40"><path d="M5 5L35 35"/></svg>',Bits.SLOTS),{inner:'<path d="M5 5L35 35"/>'});
 assert.throws(()=>Art.check('ctl-undo-move.svg','<svg viewBox="0 0 36 36"><path d="M5 5"/></svg>',Bits.SLOTS),/0 0 40 40/);
 const tag=Art.check('chip-today.svg','<svg viewBox="0 0 60 22"><path d="M2 11L8 2H58V20H8Z" fill="#EBDBBC"/></svg>',Bits.SLOTS);
 assert.match(tag.svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 60 22">/,'a frame is used whole as an image: it gets its namespace');
 for(const bad of ['<svg viewBox="0 0 40 40"><script>alert(1)</script></svg>','<svg viewBox="0 0 40 40"><path onclick="x()" d="M0 0"/></svg>','<svg viewBox="0 0 40 40"><use href="https://example.invalid/a.svg#x"/></svg>','<svg viewBox="0 0 40 40"><path style="fill:url(https://example.invalid/x)" d="M0 0"/></svg>','<svg viewBox="0 0 40 40"><image href="#a"/></svg>','<svg viewBox="0 0 40 40"><foreignObject/></svg>'])assert.throws(()=>Art.check('ctl-edit-home.svg',bad,Bits.SLOTS),/no |not allowed|href only|url\(\) only/,bad);// (the allow-list's own cases: tests/bits-art-gate.test.cjs)
 assert.throws(()=>Art.check('ctl-edit-home.svg',`<svg viewBox="0 0 40 40"><path d="${'M0 0'.repeat(2000)}"/></svg>`,Bits.SLOTS),/at most 6144/);
 assert.doesNotThrow(()=>Art.check('ctl-edit-home.svg','<svg viewBox="0 0 40 40"><defs><clipPath id="c"><path d="M0 0H40V40Z"/></clipPath></defs><use href="#c"/><path clip-path="url(#c)" d="M0 0"/></svg>',Bits.SLOTS),'ids inside the file are fine');
});

// The real view (dashboard-view.js) over a made-up Home: no account, no Canvas data.
function home({overviewArt={},slots={},hasLayoutUndo=false,boardEditing=false,arrange=true,greeting='on',now=sat(10),glance={},showCourseInformation=true}={}){
 const env=vm.createContext({TextEncoder,URL,Intl});
 if(!arrange)env.ReserveFeatures={enabled:id=>id!=='arrange'};
 for(const file of ['site.js','core.js','custom-art.js','generic-art.js','course-art.js','ui-utils.js','icons.js','home-bits.js','addons-art.js','workspace-arrange.js','customization-model.js','customize-ui.js','dashboard-view.js'])vm.runInContext(read(file),env,{filename:file});
 env.ReserveWidgets={glyph:key=>`<svg class="rd-widget-glyph" viewBox="0 0 24 24" data-glyph="${key}"><path d="M4 4h16"/></svg>`,gallery:()=>''};
 Object.assign(env.ReserveHomeBits.ART,slots);
 const c={s:{timeZone:NY,motion:'off',livingArt:'off',greeting,showGrades:false,showBookmarks:true,showCourseInformation,overviewArt},
  state:{courseId:'all',mode:'actionable',query:'',day:null},courses:[],allCourses:[],courseMap:new Map(),items:[],filtered:{items:[],olderCount:0},
  local:{},insights:{ready:[],recentGrades:[]},resourcePins:[],courseLoad:new Map(),glance:{overdue:1,today:2,tomorrow:3,...glance},newCount:4,modeCounts:{},visibleLimit:20,
  now,user:{short_name:'Learner Example'},status:'Sample data',workspace:'work',hasLayoutUndo,boardEditing};
 const h={E:env.ReserveUI.escapeHTML,icon:env.ReserveIcon,dayKey:env.ReserveCore.dayKey,complete:env.ReserveCore.isComplete,
  formatDate:(value,timeZone,options)=>new Intl.DateTimeFormat('en-US',{timeZone,...options}).format(new Date(value)),
  assignmentLink:()=>'/courses/sample/assignments',dueText:()=>'',scoreText:()=>'',gradePeriodLabel:()=>''};
 return {env,html:env.ReserveDashboardView.render(c,h,{headingCache:{}})};
}
const guide=html=>html.match(/<div class="rd-arrange-guide"[\s\S]*?<\/div><\/div>/)?.[0]||'';
const button=(html,action)=>html.match(new RegExp(`<button type="button" class="[^"]*" data-rd-action="${action}"[^>]*>[\\s\\S]*?</button>`))?.[0]||'';

test('Edit Home and Undo move are drawn controls, a drawing and a name; Undo move is there only while a move can be undone',()=>{
 let {html}=home();
 const edit=button(guide(html),'board-edit');
 assert.match(edit,/^<button type="button" class="rd-text-button rd-board-edit rd-bit-ctl" data-rd-action="board-edit" aria-pressed="false"><svg class="rd-bit-art rd-bit-paper" aria-hidden="true" focusable="false" viewBox="0 0 36 36">/,'the Move things around drawing');
 assert.match(edit,/<span>Edit Home<\/span><\/button>$/);
 assert.equal(button(html,'arrange-undo'),'','nothing to undo: no Undo move');
 ({html}=home({hasLayoutUndo:true,boardEditing:true}));
 const undo=button(html,'arrange-undo');
 assert.match(undo,/class="rd-text-button rd-bit-ctl rd-bit-undo"/);
 assert.match(undo,/<svg class="rd-bit-art" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><g transform="translate\(20 20\) scale\(-1\.5 1\.5\) translate\(-20 -14\.2\)"><path class="k" d="M29\.6 14\.2[^"]*"\/><path d="M30\.6 8\.6l-\.8 6\.2-6-1\.4"[^>]*\/><\/g><\/svg><span>Undo move<\/span><\/button>$/,'the refresh drawing’s upper arrow, turned back');
 assert.match(button(html,'board-edit'),/aria-pressed="true">[\s\S]*<span>Done editing<\/span><\/button>$/);
 ({html}=home({showCourseInformation:false}));
 assert.match(button(html,'arrange-restore'),/<svg class="rd-bit-art rd-bit-glyph" viewBox="0 0 24 24" data-glyph="context">[\s\S]*<span>Show course information<\/span><\/button>$/);
 // without Arrange the Edit Home control still stands alone, drawn
 ({html}=home({arrange:false}));
 assert.match(html,/<button type="button" class="rd-text-button rd-bit-ctl" data-rd-action="board-edit" ><svg class="rd-bit-art rd-bit-paper"[\s\S]*?<span>Edit Home<\/span><\/button>/);
});

test('the heading chips are the chip component, and the greeting names its variant; Greeting off keeps "Your work"',()=>{
 const {html}=home();
 const chips=[...html.matchAll(/<button type="button" class="rd-glance-chip rd-bit-chip" data-rd-action="glance" data-mode="(\w+)" data-tone="(\w+)" aria-pressed="false" data-chip="(\w+)"><span>([^<]+)<\/span><b>(\d+)<\/b><\/button>/g)].map(m=>m.slice(1).join(' '));
 assert.deepEqual(chips,['new success new New 4','overdue danger overdue Overdue 1','today warn today Due today 2','tomorrow info tomorrow Tomorrow 3']);
 assert.match(html,/<h1 data-greet="weekend">(?:Happy Saturday|Enjoy your weekend|A slower day), Learner<span class="rd-sr-only"> — your work<\/span><\/h1>/);
 assert.match(html,/<span class="rd-heading-art" aria-hidden="true"><svg class="rd-art" data-art="home"/,'an empty greet-weekend slot: the All courses scene');
 assert.match(home({greeting:'off'}).html,/<h1>Your work<\/h1>/);
 assert.match(home({glance:{slipped:1}}).html,/<h1 data-greet="overdue">/);
 assert.match(home({glance:{testTomorrow:1}}).html,/<h1 data-greet="test">/);
});

test('a drawing dropped into a slot shows with no code change: greeting scene, control drawings, chip labels, bookmark slip',()=>{
 const slots={'greet-weekend':{w:960,cycle:0,inner:'<path class="sample" d="M0 200H960"/>'},'ctl-undo-move':{inner:'<path class="sample-arrow" d="M30 20H10"/>'},'ctl-edit-home':{inner:'<path class="sample-edit" d="M5 5H35"/>'},'chip-overdue':{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 22"><path d="M2 11L8 2H58V20H8Z" fill="#EBDBBC"/></svg>'},'bookmark-slip':{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 40"><rect width="90" height="40" fill="none" stroke="#000"/></svg>'}};
 const {html}=home({slots,hasLayoutUndo:true});
 assert.match(html,/<span class="rd-heading-art" aria-hidden="true"><svg class="rd-art" data-art="greet-weekend" data-crop="wide" data-place="heading" data-rd-key="art-greet-weekend-wide" viewBox="0 0 960 240" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false" data-wide="true" style="--rd-art-w:960"><path class="sample" d="M0 200H960"\/><\/svg><\/span>/);
 assert.match(button(html,'arrange-undo'),/<svg class="rd-bit-art" data-slot="ctl-undo-move" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path class="sample-arrow" d="M30 20H10"\/><\/svg><span>Undo move<\/span>/);
 assert.match(button(html,'board-edit'),/data-slot="ctl-edit-home"/);
 const overdue=html.match(/<button[^>]*data-mode="overdue"[^>]*>/)[0];
 assert.match(overdue,/data-chip="overdue" data-chip-art="true" style="--chip-art:url\('data:image\/svg\+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww\.w3\.org%2F2000%2Fsvg%22[^']*'\)"/);
 assert.doesNotMatch(html.match(/<button[^>]*data-mode="today"[^>]*>/)[0],/data-chip-art/,'an empty slot keeps the kraft tag');
 assert.match(html,/<section class="rd-bookmarks" data-rd-key="bookmarks" aria-labelledby="rd-bookmarks-title" data-slip-art="true" style="--bit-slip:url\('data:image\/svg\+xml,/);
 // a banner the student chose for All courses still wins over a greeting drawing
 const own=home({slots,overviewArt:{bannerArt:{svg:'<svg viewBox="0 0 10 10"><path d="M0 0H10"/></svg>'}}}).html;
 assert.doesNotMatch(own,/data-art="greet-weekend"/);assert.match(own,/<h1 data-greet="weekend">/);
});

test('the counts the greeting reads: open work gone overdue today or yesterday, and an open test due tomorrow (dashboard.js)',()=>{
 const {fixture}=require('./dashboard-heading-fixture.cjs');
 // the fixture's clock: Saturday 17 Oct 2026, 10:00 UTC (its time zone is UTC)
 const at=hours=>new Date(Date.UTC(2026,9,17,10)+hours*3600000).toISOString();
 const work=(id,name,hours,types=['online_upload'])=>({id,course_id:'20',name,due_at:at(hours),submission_types:types,submission:{workflow_state:'unsubmitted'}});
 const greet=assignments=>{const f=fixture({courseId:'all',assignments});f.tick(0);const id=f.container.querySelector('.rd-workspace-heading h1')?.getAttribute('data-greet');f.dashboard.destroy();return id;};
 assert.equal(greet([]),'weekend');
 assert.equal(greet([work('1','Essay draft',-20)]),'overdue','due yesterday, still open');
 assert.equal(greet([work('1','Essay draft',-60)]),'weekend','overdue for days: the weekend greets');
 assert.equal(greet([work('2','Unit 4 Test',26)]),'test','a test due tomorrow');
 assert.equal(greet([work('2','Unit 4 test review',26)]),'weekend','a review is not a test');
 assert.equal(greet([work('3','Vocabulary 9',26,['online_quiz'])]),'test','a Canvas quiz');
});
