// Adapted from Gary Wu's pull request #45 to Canvas Harness.
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../extension/hand-in.js'),Core=require('../extension/core.js'),Storage=require('../extension/storage.js'),Arrange=require('../extension/workspace-arrange.js');
const now=Date.parse('2026-10-21T16:00:00Z'),item=(id,dueAt,over={})=>({id:String(id),name:'Work '+id,courseId:'7',dueAt,state:'unsubmitted',submissionTypes:['online_upload'],...over});
const context=(items,local={})=>({items,local,now,s:{timeZone:'America/New_York'},courseMap:new Map([['7',{name:'Course'}]])});
test('handin weeks end Sunday, including Sunday itself',()=>{
 assert.deepEqual(H.weekEnds('2026-10-21'),{thisWeek:'2026-10-25',nextWeek:'2026-11-01'});
 assert.deepEqual(H.weekEnds('2026-10-25'),{thisWeek:'2026-10-25',nextWeek:'2026-11-01'});
});
test('handin groups missing, overdue and due soon without dropping old or undated missing work',()=>{
 const c=context([item(1,'2026-09-01',{missing:true}),item(2,null,{missing:true}),item(3,'2026-10-20'),item(4,'2026-10-23'),item(5,'2026-10-30'),item(6,'2026-11-03'),item(7,'2026-10-23',{submissionTypes:['on_paper']}),item(8,'2026-10-23',{submissionTypes:['online_quiz']}),item(9,'2026-10-23',{state:'submitted'}),item(10,null),item(11,'2026-10-23',{state:'excused',missing:true})]);
 const l=H.lists(c);assert.deepEqual(l.missing.map(x=>x.id),['2','1']);assert.deepEqual(l.overdue.map(x=>x.id),['3']);assert.deepEqual(l.thisWeek.map(x=>x.id),['4']);assert.deepEqual(l.nextWeek.map(x=>x.id),['5']);
});
test('handin uses current completion semantics for graded missing and redo work',()=>{
 const l=H.lists(context([item(1,'2026-10-20',{state:'graded',missing:true}),item(2,'2026-10-20',{state:'submitted',redoRequested:true}),item(3,'2026-10-20',{state:'graded'})]));
 assert.deepEqual(l.missing.map(x=>x.id),['1','2']);assert.equal(l.overdue.length,0);
});
test('handin dismissals remain recoverable beyond their original date window and after Canvas changes',()=>{
 const work=item(1,'2026-12-01',{state:'graded'}),c=context([work],{'1':{checkedOff:true,doneReason:'paper'}}),l=H.lists(c);
 assert.equal(l.hidden.length,1);assert.equal(l.hidden[0].reason,'paper');assert.equal(H.lists({...c,local:{'1':{checkedOff:false}}}).hidden.length,0);
 const hidden=H.lists(context([item(2,'2026-10-20')],{'2':{checkedOff:true}}));assert.equal(hidden.hidden.length,1,'shared Mark done is also recoverable');
});
test('handin respects course scope and calendar boundaries in the student timezone',()=>{
 const l=H.lists({...context([item(1,'2026-10-26T02:00:00Z'),item(2,'2026-10-26T06:00:00Z'),item(3,'2026-10-23',{courseId:'8'})]),state:{courseId:'7'}});
 assert.deepEqual(l.thisWeek.map(x=>x.id),['1']);assert.deepEqual(l.nextWeek.map(x=>x.id),['2']);
});
const E=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fmt=(value,timeZone,options)=>new Intl.DateTimeFormat('en-US',{timeZone,...options}).format(new Date(value));
const helpers={E,dayKey:Core.dayKey,complete:Core.isComplete,formatDate:fmt},button=(name,text,attrs='',cls='')=>`<button type="button" class="${cls}" data-rd-action="${name}" ${attrs}>${text}</button>`;
const strip=html=>html.replace(/<[^>]+>/g,'');
test('handin renders escaped labels, recoverable undo and all four reasons',()=>{
 const html=H.render(context([item(1,'2026-10-23',{name:'<script>'}),item(2,'2026-10-20')],{'2':{checkedOff:true,doneReason:'class'}}),helpers,{action:button});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/handin-undo/);for(const [reason]of H.REASONS)assert.match(html,new RegExp(`data-value="${reason}"`));
 // Inline styles carry only the course colour; drawings are inline svg, never scripts or images.
 for(const style of html.match(/style="[^"]*"/g)||[])assert.match(style,/^style="--rd-course:[^;"]+;--rd-course-ink:[^;"]+"$/);assert.doesNotMatch(html,/<img|\son\w+=/);
});
// Owner, 2026-10-27: "the UI and aesthetic is so bad now". The module is drawn like Up next; these pin its markup.
test('handin rows read like Up next: course drawing and colour, name, course · due time and a late / today chip',()=>{
 const course={id:'7',name:'Synthetic Biology',shortName:'BioDesign',color:'#2E7D5B'},c={...context([item(1,'2026-10-19T03:59:00Z'),item(2,'2026-10-22T03:59:00Z'),item(3,'2026-10-22T20:00:00Z'),item(4,'2026-10-24T03:59:00Z'),item(5,'2026-10-29T03:59:00Z'),item(6,'2026-10-10T03:59:00Z',{missing:true})]),courseMap:new Map([['7',course]])};
 // (ICU may put a narrow no-break space before AM/PM.)
 const html=H.render(c,helpers,{action:button}).replace(/ /g,' '),rows=html.match(/<li class="ch-handin-row"[\s\S]*?<\/li>/g);
 assert.equal(rows.length,6);assert.match(html,/^<div class="ch-handin">/);
 // Section labels: the name and the count apart (no "·" glued into one bold line), in the order of urgency.
 assert.deepEqual([...html.matchAll(/<h3 class="ch-handin-label"><span>([^<]+)<\/span> <b>(\d+)<\/b><\/h3>/g)].map(m=>m[1]+' '+m[2]),['Missing in Canvas 1','Overdue 1','Due this week 3','Due next week 1']);
 const row=id=>rows.find(r=>r.includes(`data-rd-key="handin-${id}"`)),chip=id=>row(id).match(/<span class="ch-handin-chip" data-tone="(\w+)">([^<]+)<\/span>/)?.slice(1)||null;
 for(const r of rows){assert.match(r,/style="--rd-course:#2E7D5B;--rd-course-ink:#[0-9A-Fa-f]{6}"/);assert.match(r,/<svg class="ch-handin-dot"/);assert.match(r,/<small><span>BioDesign<\/span><span>[^<]+<\/span><\/small>/);}
 assert.deepEqual(chip(1),['danger','3 days late']);assert.match(row(1),/<span>Sun 11:59 PM<\/span>/);
 assert.deepEqual(chip(2),['warn','Today']);assert.match(row(2),/<span>11:59 PM<\/span>/);
 assert.deepEqual(chip(3),['info','Tomorrow']);
 assert.equal(chip(4),null);assert.match(row(4),/<span>Fri 11:59 PM<\/span>/);
 assert.equal(chip(5),null);assert.match(row(5),/<span>Oct 28, 11:59 PM<\/span>/);
 assert.deepEqual(chip(6),['danger','12 days late']);
 // With course art on, the row carries the course's own mini drawing in place of the colour dot.
 const before=globalThis.ReserveCourseArt;globalThis.ReserveCourseArt={mini:(course,{place})=>`<svg class="rd-mini" data-place="${place}" data-course="${course.id}"></svg>`};
 try{const drawn=H.render(c,helpers,{action:button});assert.match(drawn,/<svg class="rd-mini" data-place="row" data-course="7"><\/svg><strong>/);assert.doesNotMatch(drawn,/ch-handin-dot/);}finally{if(before===undefined)delete globalThis.ReserveCourseArt;else globalThis.ReserveCourseArt=before;}
});
test('handin keeps every way it was done and its control labels; the choices sit behind one small word',()=>{
 const calls=[],action=(name,text,attrs,cls)=>{calls.push({name,label:strip(text),cls});return button(name,text,attrs,cls);};
 const html=H.render(context([item(1,'2026-10-23'),item(2,'2026-10-20')],{'2':{checkedOff:true,doneReason:'paper'}}),helpers,{action});
 // Biscuit and the click handler know these by action and label: unchanged.
 assert.deepEqual(calls.filter(x=>x.name==='handin-dismiss').map(x=>x.label),H.REASONS.map(([,label])=>label));
 assert.deepEqual(calls.filter(x=>x.name==='handin-undo').map(x=>x.label),['Undo']);
 assert.deepEqual(calls.filter(x=>x.name==='preview').length,1);
 // One drawn word opens a row of drawn choices (a group with a name), each a drawing and its name; nothing else.
 const menu=html.match(/<details class="ch-handin-menu">[\s\S]*?<\/details>/)[0];
 assert.match(menu,/^<details class="ch-handin-menu"><summary>Done another way<\/summary><div class="ch-handin-reasons" role="group" aria-label="Done another way">/);
 assert.equal((menu.match(/class="ch-handin-reason"/g)||[]).length,4);assert.equal((menu.match(/<span class="ch-handin-glyph" aria-hidden="true"><\/span>/g)||[]).length,4);
 assert.doesNotMatch(html,/rd-widget-empty|<p[ >]/,'no sentences and no blurbs');
 const hidden=html.match(/<details class="ch-handin-hidden">[\s\S]*<\/details>/)[0];
 assert.match(hidden,/<summary>1 done another way<\/summary>/);assert.match(hidden,/<strong>Work 2<\/strong><small>Handed in on paper<\/small>/);assert.match(hidden,/class="rd-text-button ch-handin-undo" data-rd-action="handin-undo" data-id="2"/);
});
test('handin with nothing to hand in is a drawing with a name, not a sentence',()=>{
 const html=H.render(context([item(1,'2026-10-23',{state:'submitted'})]),helpers,{action:button});
 assert.match(html,/^<div class="ch-handin"><div class="ch-handin-empty" role="img" aria-label="Nothing to hand in"><svg class="ch-handin-empty-art"[^>]*aria-hidden="true"/);
 assert.equal(strip(html),'');
});
test('handin is drawn in the house style: its css is in widgets.css, with no browser defaults left',()=>{
 const fs=require('node:fs'),css=fs.readFileSync(require('node:path').join(__dirname,'../extension/widgets.css'),'utf8'),start=css.indexOf('/* <x:generated> To hand in'),block=css.slice(start,css.indexOf('/* </x:generated> */',start));
 assert.ok(start>0,'the To hand in section exists');
 // No disclosure triangles, no list bullets, no gradients, glows or filters.
 assert.match(block,/\.ch-handin summary::-webkit-details-marker\{display:none\}/);assert.match(block,/\.ch-handin summary::marker\{content:""\}/);assert.match(block,/\.ch-handin-list\{[^}]*list-style:none/);assert.match(block,/\.ch-handin-done-list\{[^}]*list-style:none/);
 assert.doesNotMatch(block,/gradient\(|filter:|blur\(|drop-shadow|text-shadow/);
 // Theme colours only through the page variables; the reasons are drawn paper tags; motion stops for Off, Still and reduced motion.
 assert.match(block,/\.ch-handin-reason::after\{[^}]*-webkit-mask-box-image:url\("data:image\/svg\+xml/);
 for(const sel of ['data-motion-style=off','data-motion-style=still','data-feature-motion=off'])assert.ok(block.includes(`.rd[${sel}] .ch-handin *`),sel);
 assert.match(block,/@media \(prefers-reduced-motion:reduce\)\{\.rd \.ch-handin \*/);
 // With a mouse the small word waits for hover or focus by opacity alone: it stays in the tab order and the accessibility tree.
 assert.doesNotMatch(block,/visibility:hidden|display:none[^}]*summary|\.ch-handin-menu>summary\{[^}]*display:none/);assert.match(block,/:is\(summary,\.ch-handin-undo\):focus-visible\{outline:2px solid var\(--rd-accent\)/);
 // Theme kits paint the tags and the tray from their own surface and accent; dark mode has its own paper.
 assert.match(block,/\.rd\[data-theme-kit\] \.ch-handin\{--hi-wash:color-mix\(in srgb,var\(--rd-accent\) \d+%,var\(--rd-surface\)\)/);assert.match(block,/\.rd\[data-theme=dark\]:not\(\[data-theme-kit\]\) \.ch-handin\{/);
 // Small and large modules have their own compact layouts.
 assert.match(block,/@container \(max-width:299px\)/);assert.match(block,/@container \(min-width:620px\)/);
 // The Edit Home switch is the settings panel's drawn switch: an ink outline, the knob a ring, the accent wash when on.
 assert.match(block,/\.rd \.rd-gallery \.rd-gswitch\{[^}]*border:1\.5px solid var\(--rd-ink\)/);assert.match(block,/\.rd-gswitch\[aria-checked=true\]\{background:color-mix\(in srgb,var\(--rd-accent\) 78%,var\(--rd-surface\)\)\}/);
});
test('handin has a drawing in its module heading and in Edit Home, with the drawn switch',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),env={ReserveWorkspaceArrange:Arrange,ReserveHandIn:H,ReserveCore:Core};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../extension/widgets.js'),'utf8'),env);
 const W=env.ReserveWidgets,settings={};Arrange.change(settings,{type:'add',key:'handin'});
 assert.notEqual(W.glyph('handin'),W.glyph('notes'),'its own drawing, not the notes fallback');
 const module=W.render('handin',{...context([item(1,'2026-10-23')]),s:{...settings,timeZone:'America/New_York'}},helpers);
 assert.match(module,/<header class="rd-arrange-heading rd-widget-head" data-arrange-head="handin"><svg class="rd-widget-glyph"/);assert.match(module,/<h2>To hand in<\/h2>/);assert.match(module,/<div class="rd-widget-body"><div class="ch-handin">/);
 const card=W.gallery({s:settings},{E}).match(/<li[^>]*data-rd-key="gallery-handin"[\s\S]*?<\/li>/)[0];
 assert.match(card,/<svg class="rd-widget-glyph"/);assert.match(card,/<button type="button" class="rd-gswitch" role="switch" data-rd-action="widget-remove" data-widget="handin" aria-checked="true" aria-label="Remove To hand in"><i><\/i><\/button>/);
});
test('handin completion reasons stay account bound and roundtrip in backups with shared undo',async()=>{
 const data=new Map(),adapter={read:async key=>structuredClone(data.get(key)),write:async(key,value)=>data.set(key,structuredClone(value))},a=Storage.createStore({accountId:'1',adapter}),b=Storage.createStore({accountId:'2',adapter});await a.load();await b.load();
 await a.update(s=>{s.tasks['1']={checkedOff:true,doneReason:'paper',notes:'Keep'};});assert.equal(Core.isWorkComplete(item(1,null),a.get().tasks['1']),true);assert.equal(b.get().tasks['1'],undefined);assert.equal(Storage.validateBackup(a.exportBackup()).tasks['1'].doneReason,'paper');
 await a.update(s=>{s.tasks['1'].checkedOff=false;delete s.tasks['1'].doneReason;});assert.equal(a.get().tasks['1'].notes,'Keep');assert.equal(Core.isWorkComplete(item(1,null),a.get().tasks['1']),false);
 const bad=a.exportBackup();bad.data.tasks['1'].doneReason='unknown';assert.equal(Storage.validateBackup(bad).tasks['1'].doneReason,undefined);a.destroy();b.destroy();
});
test('handin is an independently arranged Planner module',()=>{
 assert.ok(Arrange.EXTRA.includes('handin'));assert.equal(Arrange.label('handin'),'To hand in');const settings={};Arrange.change(settings,{type:'add',key:'handin'});assert.ok(Arrange.snapshot(settings).order.includes('handin'));
});
