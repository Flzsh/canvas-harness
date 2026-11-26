'use strict';
require('../extension/site.js');
// Accessibility pass on 4.2 (a11y-42, 2026-11-22). Students use CH+ all day with keyboards, screen readers, 150-200 %
// zoom and Windows high-contrast themes; nothing the app adds may lock any of them out.
// Part 1: an automated check per area (the markup each area draws, linted by tests/a11y-lint.cjs; the focus rings the
// stylesheets keep for keyboard users, read by tests/a11y-css.cjs). Part 2: one test per fix. (Sample data only.)
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('./a11y-lint.cjs'),C=require('./a11y-css.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const show=list=>list.map(p=>`${p.area}: ${p.kind} ${p.el} ${p.extra}`).join('\n');

// ---------- the areas' markup, drawn by their own renderers
function makeItYours(){
 const env=vm.createContext({console,URL,TextEncoder,structuredClone,chrome:{runtime:{getURL:f=>'chrome-extension://x/'+f}},ReserveFeatures:{enabled:()=>true},ReservePets:require('../extension/pets.js'),ReservePetArt:require('../extension/pet-art.js'),ReservePetPack:require('../extension/pet-pack.js'),ReservePonyBrain:{SKILLS:{quiz:{label:'Quiz prep'},focus:{label:'Focus buddy'}}}});env.globalThis=env;
 for(const f of ['customization-model.js','workspace-arrange.js','addons-art.js','make-your-own.js','settings-dock.js','customize-ui.js'])vm.runInContext(read(f),env,{filename:f});
 return env;
}
function planner(){
 const sandbox={console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map,RegExp,Error};sandbox.globalThis=sandbox;vm.createContext(sandbox);
 for(const file of ['site.js','core.js','planner-model.js','widgets.js','planner-ui.js'])vm.runInContext(read(file),sandbox,{filename:file});
 const Core=sandbox.ReserveCore,NOW=Date.parse('2026-11-22T17:00:00Z'),course={id:'7',name:'Chemistry',color:'#286452'};
 const h={E:v=>String(v??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),dayKey:(v,tz)=>Core.dayKey(v,tz),complete:Core.isComplete,formatDate:(v,tz,o)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,...o}).format(new Date(v))};
 const item=(id,name,extra={})=>({id,name,courseId:'personal',courseName:'Personal',courseColor:'#7c718d',personal:true,dueAt:null,...extra});
 const items=[Core.normalizeAssignment({id:'17',name:'Gas laws',due_at:'2026-11-24T20:00:00Z',submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}},course),Core.normalizeAssignment({id:'18',name:'Lab report',due_at:'2026-11-20T20:00:00Z',submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}},course),item('local-a','Flashcards'),item('local-o','Old thing'),item('local-r','Piano',{repeat:{every:'week',interval:1,days:[1,4]}})];
 const local={'local-a':{plannedDate:'2026-11-23',estimate:30,plannedTime:'16:00',priority:'high'},'local-o':{plannedDate:'2026-11-19'},'local-r':{plannedDate:'2026-11-23',estimate:20}};
 const c={now:NOW,s:{timeZone:'America/New_York'},local,courses:[course],courseMap:new Map([['7',course]]),items,personal:{}};
 return {UI:sandbox.ReservePlannerUI,c,h};
}
function courseHub(){
 const context={ReserveSite:{...require('../extension/site.js'),origin:()=>'https://school.instructure.com'},URL,Date,Map,Set,AbortController,ReserveUI:{...require('../extension/ui-utils.js'),safeRichHTML:body=>body},ReserveMaterials:require('../extension/material-model.js'),ReserveCourseHubModel:{normalizeUpdates:value=>({announcements:value.announcements,tabs:value.tabs}),normalizeInbox:value=>value.conversations},document:{createElement:()=>({content:{querySelectorAll:()=>[]}})},ReserveWorkspaceArrange:require('../extension/workspace-arrange.js')};
 vm.runInNewContext(read('course-hub-ui.js'),context);
 const raw={origin:'https://school.instructure.com',accountId:'5',courseId:'7',announcements:[{id:'1',title:'Lab goggles',message:'<p>Bring goggles.</p>',postedAt:'2026-11-20T10:00:00Z',author:'Course Teacher'}],tabs:[{id:'school-tool',label:'School tool',url:'https://school.instructure.com/courses/7/external_tools/107'}],errors:[]};
 const home={raw:{modules:[],frontPage:{title:'Teacher home',body:'<p>Follow the lesson table.</p>',published:true},errors:[]}};
 const client={loadCourseUpdates:async()=>structuredClone(raw),listInbox:async()=>({origin:raw.origin,accountId:'5',conversations:[]})};
 const data={resourcePins:[]},store={owner:{origin:raw.origin,accountId:'5'},get:()=>structuredClone(data),update:async fn=>fn(data)};
 return context.ReserveCourseHubUI.create({store,onCapture(){},user:{id:'5'},client,materials:{load:async()=>0,getCourse:()=>home},onChange(){},onAuthError(){}});
}

test('area check: Home draws every control with a name and every role in its place (the dashboard as a student opens it)',()=>{
 const {fixture}=require('./dashboard-small-dom-fixture.cjs');const f=fixture();
 try{
  const html=f.element.innerHTML,problems=L.lint(html,{area:'home'});
  assert.equal(problems.length,0,show(problems));
  assert.ok(L.controls(html).length>40,'the check saw the page');
  assert.match(html,/<h1[^>]*>[\s\S]*?<\/h1>/,'the greeting is the page heading');
  assert.match(html,/role="tablist" aria-label="Workspace"/);
 }finally{f.view.destroy();}
});
test('area check: Make it yours, every one of its six tabs',()=>{
 const env=makeItYours(),U=env.ReserveCustomizeUI,course={id:'101',name:'Chemistry',color:'#123456'};
 const tabs=U.tabs();assert.equal(tabs.length,6);
 for(const [tab] of tabs)for(const s of [{},{courseNavigation:'dock'},{sceneTheme:'sea'}]){
  const html=U.render({s:{...env.ReserveCustomization.defaults,coursePrefs:{},...s},customizeOpen:true,customizeTab:tab,allCourses:[course],courses:[course],customizeCourseId:'101',personal:{pet:{name:'Biscuit'}},canvasNav:'drawn'});
  const problems=L.lint(html,{area:'make:'+tab});assert.equal(problems.length,0,show(problems));assert.ok(L.controls(html).length>3,tab);
 }
});
test('area check: the Planner, week and day, with a card\'s menu open',()=>{
 const {UI,c,h}=planner();
 // (4.2.12: List is the default, Day is List with a day open, and the card's menu became the task's sheet; Show open, To plan
 // opened over the page and the hours shown are checked too)
 for(const [label,ui] of [['list',{drafts:{'':{text:'chem essay due fri 5pm 45m',ignore:[]}}}],['week',{mode:'week',drafts:{'':{text:'chem essay due fri 5pm 45m',ignore:[]}}}],['day',{mode:'day',day:'2026-11-23'}],['sheet',{sheet:'local-a'}],['sheet-canvas',{sheet:'17',mode:'week'}],['show',{showOpen:true,show:['7']}],['side',{side:true,mode:'week'}],['hours',{hours:true}]]){
  const html=UI.render(c,h,ui),problems=L.lint(html,{area:'plan-'+label});assert.equal(problems.length,0,show(problems));assert.ok(L.controls(html).length>5,label);
 }
});
test('area check: the Course hub with a course open',async()=>{
 const ui=courseHub();try{await ui.loadCourse('7');const html=ui.renderHub({id:'7',name:'Chemistry',defaultView:'wiki'});const problems=L.lint(html,{area:'hub'});assert.equal(problems.length,0,show(problems));assert.ok(L.controls(html).length>3);}finally{ui.destroy();}
});
test('area check: Tools, Biscuit\'s ask form and the page switch (their markup as written in the source)',()=>{
 // Tools: the dialog's shell (toolbox.js init); its tabs are buttons with role tab inside the tablist
 const tb=read('toolbox.js');assert.match(tb,/dialog\.setAttribute\('aria-labelledby','rd-utility-title'\)/);assert.match(tb,/role="tablist" aria-label="Tools"/);
 // Biscuit: the button that opens the chat, the chat's ask field (named), and Escape back to the button
 const pets=read('pets.js');assert.match(pets,/<button type="button" class="pet"[^>]*aria-expanded="false"/);assert.match(pets,/data-pet-question aria-label="\$\{E\(label\)\}"/);assert.match(pets,/key==='Escape'&&menuOpen\)\{event\.preventDefault\(\);closeBubble\(\);node\.focus\(\)/);
 // the page switch: a real switch with its name and the note that describes it
 const ps=read('page-switch.js'),m=/shadow\.innerHTML='<style>'\+CSS\+'<\/style>(.*?)';/.exec(ps);assert.ok(m,'the switch markup');
 const html=m[1].replace(/'\+BOOKS\+'/,'').replace(/'\+KNOB\+'/,'').replace('<span class="t"></span>','<span class="t">Canvas Harness on this page</span>');
 const problems=L.lint(html,{area:'page-switch'});assert.equal(problems.length,0,show(problems));assert.match(html,/role="switch" aria-checked="true" aria-describedby="ps-note"/);
});
test('area check: Help, a card with its drawer open: every button and field has a name',async()=>{
 const Band=require('../extension/study-band.js'),{dom,descendants}=require('./study-fixture.cjs');
 const answer={kind:'ask',title:'Answer',data:{v:1,kind:'ask',title:'Answer',headline:'Start here',size:'l',importance:1,points:[{text:'Read the question.',src:'Lab'}],next:'Compare observations.',gaps:[]},progress:{}};
 const d=dom(),host=new d.Element('div'),view=Band.renderBand(host,{a:answer},{env:{document:d.document},onAsk:()=>true,store:{addNote:async()=>({})}});await view.loaded;
 try{
  descendants(host).find(n=>n.dataset?.act==='ask').fire('click');
  const all=descendants(host).filter(n=>!n.hidden),controls=all.filter(n=>['BUTTON','INPUT','TEXTAREA','SELECT'].includes(n.tagName));
  assert.ok(controls.length>=6,'the check saw the band');
  const unnamed=controls.filter(n=>!String(n.getAttribute('aria-label')||n.textContent||n.placeholder||n.getAttribute('title')||'').trim());
  assert.deepEqual(unnamed.map(n=>n.tagName+'.'+n.className),[]);
  assert.equal(all.find(n=>n.className==='ch-band-status')?.getAttribute('role'),'status','the band\'s count line is a status');
 }finally{view.destroy();}
});

// ---------- keyboard focus rings in the companion's stylesheets (every area)
// Every rule that takes the outline away from a focused control must be followed, later in the cascade, by a rule that
// gives a :focus-visible ring back to that control's class, unless the control's focus is drawn another way on
// purpose (the list below says how). A hover look (a tint, a border colour) is not a ring: it is the same as the mouse
// sees, often too faint, and Windows high contrast removes it.
const DRAWN_ANOTHER_WAY={
 'refresh.css .rd .rd-search input:focus-visible':'a text field: its caret and its inset line show focus',
 'refresh.css .rd :is(h1, h2, h3)[tabindex="-1"]:focus':'a heading the page moves focus to, not a control',
 'refresh.css .rd .rd-row-open:focus-visible':'its whole row draws the ring (:has())',
 'refresh.css .rd .rd-utility-dialog .rd-quick-search input:focus-visible':'a text field inside a box that draws focus-within',
 'refresh.css .rd .rd-utility-dialog .rd-composer-card textarea:focus-visible':'a text field inside a card that draws focus-within',
 'settings-dock.css .rd .ch-settings-dock .cz-pet-hero .rd-field input:focus':'a text field: underline and inset line',
 'settings-dock.css .rd .ch-settings-dock .cz-group :is(select,input[type=time],input[type=text]):focus-visible':'fields: a heavier underline',
 'settings-dock.css .rd .ch-settings-dock .cz-art select:focus-visible':'a field: a heavier underline',
 'widgets.css .rd[data-workspace] .rd-workspace .rd-plan-add input:focus,.rd .rd-plan-add input:focus':'a text field: its pen line',
 'pet.css .rd .pet-bubble .biscuit-ask input:focus,.rd .pet-bubble .biscuit-ask input:focus-visible,.pet-bubble .biscuit-ask input:focus-visible':'the chat\'s one text field, focused as the chat opens: its caret',
 'review-deck.css .rv .rv-card:focus-visible':'the Review deck (outside this pass)','review-deck.css .rv .rv-ef textarea:focus-visible':'the Review deck (outside this pass)'
};
function cascade(){const all=[];C.sheetOrder().forEach((f,fi)=>C.rules(f).forEach((r,ri)=>all.push({...r,fi,ri})));return all;}
function ringsTakenAway(){
 const all=cascade(),out=[];
 for(const r of all){
  if(/forced-colors/.test(r.media)||!C.outlineOff(r.body))continue;
  const sels=C.splitTop(r.selector).filter(s=>/:focus/.test(s));if(!sels.length)continue;
  const back=sels.every(s=>{const {own,alts}=C.subjectClasses(s),keys=own.length?[own[0]]:alts;return keys.length&&keys.every(k=>all.some(r2=>(r2.fi>r.fi||r2.fi===r.fi&&r2.ri>r.ri)&&!/forced-colors/.test(r2.media)&&C.outlineOn(r2.body)&&C.splitTop(r2.selector).some(s2=>/:focus-visible/.test(s2)&&new RegExp('\\.'+k+'(?![\\w-])').test(s2))));});
  if(!back)out.push(r);
 }
 return out;
}
test('area check: no control loses its keyboard focus ring to a hover look (Home, Planner, Biscuit, Help, Tools, Make it yours)',()=>{
 const missing=ringsTakenAway().filter(r=>!DRAWN_ANOTHER_WAY[r.file+' '+r.selector.replace(/\s+/g,' ').trim()]);
 assert.deepEqual(missing.map(r=>`${r.file}:${r.line} ${r.selector.replace(/\s+/g,' ').trim()}`),[]);
 // and the global ring itself is still there for every native control
 assert.ok(cascade().some(r=>/\.rd button:focus-visible/.test(r.selector)&&C.outlineOn(r.body)));
});
test('area check: in Windows high contrast every focused control shows an outline in the system highlight',()=>{
 const forced=cascade().filter(r=>/forced-colors:\s*active/.test(r.media));
 const ring=forced.find(r=>C.splitTop(r.selector).includes('.rd :focus-visible'));
 assert.ok(ring,'a forced-colours ring for every focused control in the companion');
 assert.match(C.decl(ring.body,'outline'),/^2px solid Highlight !important$/);
});
test('fix: at 1280 px and 200 % zoom the command bar gives up its words instead of running off the page',()=>{
 // (a 640 px page with the course rail: the bar was under 560 px, where none of its "give up words" steps applied; the
 // page was 957 px wide and Tools, Make it yours, Refresh and the Canvas switch were off the right edge: a11y-42-look)
 const rules=cascade().filter(r=>/@media \(min-width:601px\) & @container commands \(max-width:559\.98px\)/.test(r.media)),has=sel=>rules.find(r=>C.splitTop(r.selector).includes(sel));
 assert.ok(rules.length>=5,'the narrow step exists, outside the phone layout only');
 assert.equal(C.decl(has('.rd .rd-toolbar > .rd-workspace-tabs').body,'flex'),'1 1 auto','the tab strip (a scroller) gives way');
 assert.equal(C.decl(has('.rd .rd-toolbar > .rd-workspace-tabs').body,'min-width'),'0');
 for(const sel of ['.rd .rd-toolbar .rd-workspace-tab > span:not(.rd-n):not(.rd-sr-only)','.rd .rd-tools .rd-tb-tool > span','.rd .rd-tools .rd-toolbox-trigger > span','.rd .rd-grade-switch > span:not(.rd-switch-track)'])
  assert.match(has(sel)?.body||'',/clip-path:inset\(50%\)/,sel+': kept for screen readers, not drawn');
 // the same words the wider steps already give up (refresh.css): nothing new is hidden, only at a narrower bar
 const wider=cascade().filter(r=>/@container commands \(min-width: 560px\)/.test(r.media)).map(r=>r.selector).join(' ');
 for(const part of ['.rd-workspace-tab > span:not(.rd-n):not(.rd-sr-only)','.rd-tb-tool > span','.rd-toolbox-trigger > span','.rd-grade-switch > span:not(.rd-switch-track)','.rd-toolbox-trigger kbd','.rd-native-switch > span'])assert.ok(wider.includes(part),part);
});
test('fix: in Windows high contrast the drawn switches keep an edge, a knob and an "on" fill',()=>{
 // (their track and knob were background colours and shadows, which forced colours drop: on and off looked alike)
 const forced=cascade().filter(r=>/forced-colors:\s*active/.test(r.media)),rule=sel=>forced.find(r=>C.splitTop(r.selector).includes(sel));
 for(const [sel,prop,value] of [['.rd .cz-toggle i','outline','1.5px solid CanvasText'],['.rd .rd-gswitch','box-shadow','inset 0 0 0 1.5px CanvasText!important'],['.rd .cz-toggle i::after','background','CanvasText!important'],['.rd .rd-gswitch i','background','CanvasText!important'],['.rd .cz-toggle input:checked+i','background','Highlight!important'],['.rd .rd-gswitch[aria-checked=true]','background','Highlight!important'],['.rd .cz-toggle input:checked+i::after','background','HighlightText!important']]){
  const r=rule(sel);assert.ok(r,sel);assert.equal(C.decl(r.body,prop),value,sel);
 }
 for(const sel of ['.rd .cz-toggle i','.rd .rd-gswitch','.rd .cz-toggle i::after'])assert.equal(C.decl(rule(sel).body,'forced-color-adjust'),'none',sel);
 // and nothing of it applies outside forced colours
 assert.equal(cascade().filter(r=>!/forced-colors/.test(r.media)&&/CanvasText|Highlight/.test(r.body)&&/cz-toggle|rd-gswitch/.test(r.selector)).length,0);
});

// ---------- part 2: one test per fix
test('fix: the status line does not announce "Updated N min ago" every minute; a real change is still said',()=>{
 // (a screen reader read the minute tick of the footer's live line all day; it is often only for screen readers)
 const {fixture}=require('./dashboard-heading-fixture.cjs'),MIN=60000;
 const f=fixture({courseId:'all',assignments:[],initialState:{workspace:'work'}});
 try{
  f.tick(0);f.dashboard.updateSnapshot({...f.snapshot,fetchedAt:new Date(f.env.Date.now()).toISOString()});f.tick(0);
  const line=()=>f.container.querySelector('.rd-status [role="status"]');
  assert.equal(line().textContent,'Updated just now');assert.equal(line().getAttribute('aria-live'),null,'"just now" (after a refresh) is said');
  for(let i=0;i<3;i++)f.tick(MIN);
  assert.equal(line().textContent,'Updated 3 min ago');assert.equal(line().getAttribute('aria-live'),'off','the minute tick is silent');
  f.dashboard.setStatus('Refresh failed: offline');assert.equal(line().textContent,'Refresh failed: offline');assert.equal(line().getAttribute('aria-live'),null,'a failure is said');
  f.dashboard.setStatus('');assert.match(line().textContent,/^Updated \d+ min ago$/);assert.equal(line().getAttribute('aria-live'),'off');
  // the drawn page agrees with the live update (a full render writes the same attribute)
  assert.match(read('dashboard-view.js'),/<span role="status"\$\{\/\^Updated \(\?!just now\)\/\.test\(c\.status\|\|''\)\?' aria-live="off"':''\}>/);
 }finally{f.dashboard.destroy();}
});
test('fix: a Planner card\'s open button keeps its short name and is described by the line the card shows',()=>{
 const {UI,c,h}=planner(),html=UI.render(c,h,{day:'2026-11-23'}),root=L.parse(html),all=L.elements(root),byId=new Map(all.filter(n=>n.attrs.id).map(n=>[n.attrs.id,n]));
 // (4.2.13: a row of the day's page; its title opens the task's sheet and keeps the task's name; its time and its quiet line
 // are the description, word for word as the row shows them)
 const opens=all.filter(n=>n.attrs['data-rd-action']==='plan-sheet'&&/\brd-plan-title\b/.test(n.attrs.class||''));assert.ok(opens.length>=2);
 for(const b of opens){
  assert.doesNotMatch(b.attrs['aria-label'],/^Open /);
  const ids=(b.attrs['aria-describedby']||'').split(/\s+/).filter(Boolean);assert.ok(ids.length,'described: '+b.attrs['aria-label']);
  const said=L.clean(ids.map(id=>{assert.ok(byId.has(id),'the description is on the page: '+id);return L.textOf(byId.get(id),{skipHidden:false});}).join(' '));
  const small=byId.get(ids.at(-1));assert.equal(small.tag,'small');assert.equal(said.endsWith(L.clean(L.textOf(small,{skipHidden:false}))),true,'the row\'s own line, word for word');
 }
 const describe=b=>L.clean(b.attrs['aria-describedby'].split(/\s+/).map(id=>L.textOf(byId.get(id),{skipHidden:false})).join(' '));
 const flash=opens.find(b=>b.attrs['data-id']==='local-a'),words=describe(flash);
 assert.match(words,/4:00 PM/);assert.match(words,/30 min/);
 const piano=opens.find(b=>b.attrs['data-id']==='local-r');assert.match(describe(piano),/Every Mon, Thu/,'the repeat said only to screen readers reaches them now');
 // (4.2.13: work left on a day already gone is not carried with a "from" stamp any more: it waits in the Overdue list, where
 // its day button says the day it was planned for)
 assert.match(UI.render(c,h,{overdueOpen:true}),/data-rd-action="plan-pick" data-id="local-o" data-day="2026-11-19" data-planned="true" aria-haspopup="dialog" aria-expanded="false" aria-label="Old thing: planned for Thursday, November 19\. Change the day"/,'it says where it was left');
 const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'ids are unique on the page');
});
test('fix: Biscuit\'s button says it opens a dialog, the kind of popup it opens',()=>{
 // (it said "menu": screen readers then announce a menu and expect arrow keys, but the chat is a form with a text field)
 const pets=read('pets.js').replace(/\n[ \t]*/g,'')/* (public spreads long lines: joined again for the checks) */,button=/<button type="button" class="pet"[^>]*>/.exec(pets)[0];
 assert.match(button,/aria-haspopup="dialog"/);
 assert.match(pets,/if\(menu\)\{bubble\.setAttribute\('role','dialog'\)/,'the chat opened from it is a dialog');
});
test('fix: Biscuit\'s preview is said once the typing pauses, not at every key',()=>{
 // (the preview line was a live region: 17 keys made 13 announcements on top of the screen reader's own key echo)
 const {fixture}=require('./pony-fixture.cjs'),B=require('../extension/pony-brain.js'),A=require('../extension/pony-ask.js');
 const f=fixture({brain:B,ask:A,parser:{parse:text=>[{intent:'focus',fields:{minutes:40},preview:`Focus · ${text.length} letters`}]}});
 try{
  f.node.emit('click');
  const input=new f.Element(),preview=new f.Element(),suggestions=new f.Element(),said=new f.Element();input.value='';input.setAttribute('data-pet-question','');input.parentNode=f.bubble;said.setAttribute('data-pet-said','');
  f.bubble.slots={'[data-pet-question]':input,'[data-pet-preview]':preview,'[data-pet-suggestions]':suggestions};const q=f.bubble.querySelector.bind(f.bubble);f.bubble.querySelector=sel=>sel==='[data-pet-said]'?said:q(sel);
  const html=f.bubble.html;
  assert.doesNotMatch(/<button[^>]*id="biscuit-preview"[^>]*>/.exec(html)[0],/aria-live/,'the preview button is no live region');
  assert.match(html,/<span class="rd-sr-only" role="status" data-pet-said><\/span>/,'one quiet status line for screen readers');
  const text='focus 40 min calc',heard=[];
  for(let i=1;i<=text.length;i++){input.value=text.slice(0,i);f.bubble.emit('input',{target:input});f.advance(120);heard.push(said.textContent);}
  assert.equal(heard.filter(Boolean).length,0,'nothing said while the keys come');
  assert.equal(preview.textContent,'Focus · 17 letters','the preview itself still follows every key');
  f.advance(1000);assert.equal(said.textContent,'Focus · 17 letters','said once, after the pause');
 }finally{f.controller.destroy();}
 // (in the page: 20 keys made 40 announcements, the preview line and the whole answer card, which follows every key)
 const pets=read('pets.js');assert.match(pets,/<div class="biscuit-answer" data-biscuit-answer hidden><\/div>/,'the answer card shown while typing is no live region');
});
test('fix: Biscuit\'s replies and offers are said through a status line that stays on the page',()=>{
 // (each reply came in a new bubble that was itself the live region; one inserted already full is not read: in the page,
 // nothing was said after Enter)
 const {fixture}=require('./pony-fixture.cjs'),copy=v=>JSON.parse(JSON.stringify(v));
 const brain=s=>({cleanLearning:v=>copy(v||{kinds:{},nudges:{day:'',count:0,items:[]},hiddenUntil:0}),evaluate(){return {mood:'calm',dueToday:1,suggestions:s};},record:v=>v,canNudge:()=>false,markNudge:v=>v,speech:()=>''});
 const f=fixture({brain:brain([{id:'break-session',kind:'break',action:'break',label:'Break 5 min',data:{minutes:5},score:200}]),actions:{break:()=>true}});
 try{
  const layer=f.container.children.find(n=>n.className==='pet-layer'),reply=layer._reply;
  assert.ok(reply,'the line is made with Biscuit');assert.equal(reply.attrs.role,'status');assert.equal(reply.className,'rd-sr-only');assert.ok(layer.children.includes(reply));
  assert.equal(f.node,layer.firstElementChild,'Biscuit\'s own button stays first');
  f.controller.setFocus(true,{endsAt:f.epoch+1500000,fromPony:true});f.controller.celebrate('focus',{today:'2026-10-19'});
  assert.match(f.bubble.html,/Break 5 min/);assert.equal(f.bubble.attrs.role,'status','the offer bubble itself is unchanged');
  f.advance(100);assert.match(reply.textContent,/Break 5 min/,'the offer is said on the line that was already there');
 }finally{f.controller.destroy();}
});
test('fix: Help keeps keyboard focus when a card\'s drawer folds or the band redraws (it fell to the page before)',async()=>{
 const Band=require('../extension/study-band.js'),{dom,descendants,tick}=require('./study-fixture.cjs');
 const answer={kind:'ask',title:'Answer',data:{v:1,kind:'ask',title:'Answer',headline:'Start here',size:'l',importance:1,points:[{text:'Read the question.',src:'Lab'}],next:'Compare observations.',gaps:[]},progress:{}};
 const d=dom(),host=new d.Element('div'),aids={a:structuredClone(answer)},asked=[],view=Band.renderBand(host,aids,{env:{document:d.document},onAsk:text=>{asked.push(text);return true;}});await view.loaded;
 try{
  const all=()=>descendants(host),ask=()=>all().find(n=>n.dataset?.act==='ask'),field=()=>all().find(n=>String(n.className).includes('ch-band-drawer-input')),live=n=>all().includes(n);
  const esc=n=>n.fire('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}}),enter=n=>n.fire('keydown',{key:'Enter',preventDefault(){},stopPropagation(){}});
  // Escape in the drawer's field: the drawer folds and focus is on that card's Ask again
  ask().fire('click');field().focus();esc(field());assert.equal(field(),undefined,'folded');assert.ok(live(d.document.activeElement),'focus stays in Help');assert.equal(d.document.activeElement,ask());
  // a question sent: the drawer folds, focus back on Ask
  ask().fire('click');field().focus();field().value='Why divide?';enter(field());await tick();await tick();assert.deepEqual(asked,['Why divide?']);assert.equal(d.document.activeElement,ask());
  // pressing Ask again folds it: focus stays on the (redrawn) Ask
  ask().fire('click');ask().focus();ask().fire('click');assert.equal(field(),undefined);assert.equal(d.document.activeElement,ask());
  // the band redraws while a student types in an open drawer: still in the field, the words kept
  ask().fire('click');field().focus();field().value='half typed';field().fire('input',{stopPropagation(){}});view.update(aids);assert.ok(live(d.document.activeElement),'not lost');assert.equal(d.document.activeElement,field());assert.equal(field().value,'half typed');
 }finally{view.destroy();}
});
test('fix: a module\'s size-and-place menu answers the keys a menu promises (arrows, Home, End; Tab past its ends leaves from its button)',()=>{
 // (role="menu" with no arrow keys: screen readers in a menu send the arrows to the page, and nothing moved; Tab from its
 // last item went on to the end of the page, the menu still open). The browser check (a11y-42-look/after3 and after4,
 // menu-debug.json) shows it on the page; this pins the handler in widgets.js beside the menu's Escape.
 const src=read('widgets.js'),handler=src.slice(src.indexOf("if(event.key==='Escape'&&menu)"),src.indexOf('// Keys are heard on the document'));
 assert.match(src,/menu\.setAttribute\('role','menu'\)/);
 for(const key of ['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'])assert.ok(handler.includes(`'${key}'`),key);
 assert.match(handler,/if\(menu\.contains\(at\)\)/,'only keys from inside the menu');
 assert.match(handler,/items\[next\]\?\.focus\(/);
 assert.match(handler,/if\(event\.key==='Tab'\)\{const items=\[\.\.\.menu\.querySelectorAll\('button'\)\],i=items\.indexOf\(at\);if\(event\.shiftKey\?i<=0:i>=items\.length-1\)\{closeMenu\(true\);return false;\}\}/,'Tab walks the items; past either end the menu closes onto its button and the key goes on from there');
});
test('fix: the Planner\'s quick add says what it understood once the typing pauses, not tag by tag between keys',()=>{
 // (the reading line was a live region: each tag that appeared while a student typed was read out over the key echo)
 const D=require('./a11y-dom.cjs');let clock=0,seq=0;const timers=new Map();
 const sandbox={console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map,RegExp,Error,setTimeout:(fn,ms=0)=>{const id=++seq;timers.set(id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id)};sandbox.globalThis=sandbox;vm.createContext(sandbox);
 const advance=ms=>{const end=clock+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);clock=next[1].at;next[1].fn();}clock=end;};
 for(const file of ['site.js','core.js','planner-model.js','widgets.js','planner-ui.js'])vm.runInContext(read(file),sandbox,{filename:file});
 const Core=sandbox.ReserveCore,course={id:'7',name:'Chemistry',color:'#286452'};
 const h={E:v=>String(v??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),dayKey:(v,tz)=>Core.dayKey(v,tz),complete:Core.isComplete,formatDate:(v,tz,o)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,...o}).format(new Date(v))};
 const c={now:Date.parse('2026-11-22T17:00:00Z'),s:{timeZone:'America/New_York'},local:{},courses:[course],courseMap:new Map([['7',course]]),items:[],personal:{}};
 const doc=D.document(),container=new D.Element('div',{class:'rd'},doc),UI=sandbox.ReservePlannerUI;
 const ctl=UI.create({container,store:{get:()=>({})},save(){},rerender(){},getContext:()=>c,helpers:()=>h});container.innerHTML=UI.render(c,h,ctl.ui);
 const field=container.querySelector('[data-rd-field="plan-quick"]'),line=container.querySelector('.rd-plan-read[data-for=""]'),say=container.querySelector('[data-rd-key="plan-say"]');
 assert.ok(field&&line&&say);assert.equal(line.getAttribute('aria-live'),null,'the tag line is no live region');assert.equal(say.getAttribute('aria-live'),'polite');
 for(const html of [UI.render(c,h,{mode:'day',day:'2026-11-23'}),UI.render(c,h,{})])assert.doesNotMatch(html,/class="rd-plan-read[^"]*"[^>]*aria-live/,'no tag line in any view is live');
 const text='chem essay due fri 5pm 45m',lines=[];
 for(let i=1;i<=text.length;i++){field.value=text.slice(0,i);ctl.input({target:field});advance(110);lines.push(line.textContent);assert.equal(say.textContent,'','nothing said between keys');}
 assert.ok(lines.filter((t,i)=>i&&t!==lines[i-1]).length>=3,'the tags still follow the typing on screen');
 advance(1200);assert.equal(say.textContent,'Understood: Due Fri, Nov 27, 5:00 PM, 45 min, Chemistry','said once, after the pause, in reading order');
 // Enter before the pause: the task is added and only "Added" is said (the pending line is dropped)
 say.textContent='';field.value='read notes 20m';ctl.input({target:field});advance(300);ctl.adding(field,'local-x');advance(2000);assert.equal(say.textContent,'','the line pending when Enter came is not said after it');
});
