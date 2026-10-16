'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const View=require('../extension/dashboard-view.js');
const SettingsDock=require('../extension/settings-dock.js');
const source=file=>fs.readFileSync(path.join(__dirname,'..','extension',file),'utf8');

function dashboard(customizeOpen=false){
 const courses=[{id:'7',name:'CL Chemistry',color:'#367964'},{id:'8',name:'Latin',color:'#956821'}];
 const c={s:{theme:'dark',dashboardLayout:'split',density:'compact',accent:'forest',motion:'gentle',livingArt:'on',showCourseStrip:true,showRecentGrades:true,showGrades:false},
  state:{courseId:'all',query:'',mode:'actionable'},courses,allCourses:courses,courseMap:new Map(courses.map(course=>[course.id,course])),
  items:[],local:{},insights:{ready:[],recentGrades:[]},filtered:{items:[]},now:Date.parse('2026-10-09T16:00:00Z'),
  workspace:'materials',customizeOpen,user:{name:'Student'},status:'Ready',materialLibrary:'<button type="button">Materials stay usable</button>'};
 const h={E:String,icon:()=>'',assignmentLink:()=>'',formatDate:()=>'',dueText:()=>'',scoreText:()=>'',gradePeriodLabel:()=>'',dayKey:()=> '2026-10-09',complete:()=>false};
 return View.render(c,h);
}

function fixture(){
 let focused=null,otherDockOpen=true;
 const element=()=>({dataset:{},attrs:new Map(),inert:false,isConnected:true,visible:true,scrollTop:0,
  setAttribute(name,value){this.attrs.set(name,String(value));},removeAttribute(name){this.attrs.delete(name);},
  getClientRects(){return this.isConnected?[{}]:[];},closest(){return null;},
  checkVisibility(){return this.visible;},focus(){focused=this;}});
 const opener=element(),toolbarButton=element(),closeButton=element(),panel=element(),inner=element(),workspace=element(),host=element();
 panel.contains=el=>el===inner||el===closeButton;
 panel.querySelector=selector=>selector==='.t-acc-panel'?inner:selector==='[data-rd-action="settings-close"]'?closeButton:null;
 const container=element();
 container.querySelector=selector=>selector==='.rd-appearance.ch-settings-dock'?panel:selector==='.rd-toolbar [data-rd-action="settings"]'?toolbarButton:selector===':focus'?focused:null;
 host.toggleAttribute=(name,flag)=>flag?host.setAttribute(name,''):host.removeAttribute(name);
 container.getRootNode=()=>({host});
 const changes=[];
 const dock=SettingsDock.createDock({container,onOpen(){otherDockOpen=false;},onChange(value){changes.push(value);}});
 return {dock,opener,toolbarButton,closeButton,panel,inner,workspace,host,container,changes,
  get focused(){return focused;},get otherDockOpen(){return otherDockOpen;}};
}

test('the personal editor renders as an accessible, nonmodal settings dock',()=>{
 const closed=dashboard(false),open=dashboard(true);
 assert.match(closed,/<div class="rd-appearance t-acc ch-settings-dock"[^>]*data-open="false"[^>]*role="complementary"[^>]*aria-labelledby="rd-appearance-title"[^>]*inert aria-hidden="true"/);
 assert.match(open,/<div class="rd-appearance t-acc ch-settings-dock"[^>]*data-open="true"[^>]*role="complementary"/);
 assert.match(open,/<h2 id="rd-appearance-title">Make it yours<\/h2>/);
 assert.match(open,/data-rd-action="settings-close"[^>]*aria-label="Close customization"/);
 assert.doesNotMatch(open,/aria-modal|role="dialog"|showModal\(/);
 assert.match(open,/<main class="rd-workspace"[^>]*>[\s\S]*Materials stay usable/);
 assert.doesNotMatch(open,/<main[^>]*(inert|aria-hidden)/);
});

test('every original personal customization field, course editor, and grade control remains present',()=>{
 const html=dashboard(true);
 // "Workspace columns" (dashboardLayout) was a second control for the panel order; its one-column choice now lives in deskOrder.
 for(const key of ['deskOrder','density','textSize','font','motion','livingArt','readingFont','greeting','showCourseStrip','showRecentGrades']){
  assert.ok(html.includes(`data-setting="${key}"`),`keep personal ${key} control`);
 }
 for(const field of ['course-visible','course-color','course-name']){
  assert.equal((html.match(new RegExp(`data-rd-field="${field}"`,'g'))||[]).length,2,`keep ${field} for both courses`);
 }
 for(const text of ['Accent color','Course names, colors &amp; visibility','All settings &amp; backups','Living drawings','Iris accent','CL Chemistry','Latin']){
  if(text==='Course names, colors &amp; visibility'||text==='All settings &amp; backups'){
   assert.ok(html.includes(text.replace('&amp;','&'))||html.includes(text),`keep ${text}`);
  }else assert.ok(html.includes(text),`keep ${text}`);
 }
 assert.match(html,/data-rd-action="accent"/);
 assert.doesNotMatch(html,/data-setting="accent"/,'one visible palette');
 // Dark mode (the user asked for it, 2026-10-15) is a choice in Look, light unless chosen; the night slider shows only in dark.
 {const ui=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','extension','customize-ui.js'),'utf8');assert.match(ui,/choices\('theme','Theme',\[\['light','Light'[\s\S]*?\{value:s\.theme==='dark'\?'dark':'light',cols:2\}\)/);assert.match(ui,/\(s\.theme==='dark'\?group\('Artwork at night'/);}
 assert.equal((html.match(/class="rd-swatch ch-accent-choice"/g)||[]).length,6);
 assert.match(html,/data-rd-field="setting" data-setting="showGrades"/);
 const viewSource=source('dashboard-view.js');
 for(const token of ['ReserveCourseArt','art.frame','art.mini','art.scene','const Grades='])assert.ok(viewSource.includes(token),`retain course-art and grades behavior: ${token}`);
});

test('Planner is removed only from the top toolbar; drawer entry and focus clock remain',()=>{
 const html=dashboard(true),toolbar=html.match(/<header class="rd-toolbar">[\s\S]*?<\/header>/)?.[0];
 assert.ok(toolbar,'toolbar exists');
 assert.doesNotMatch(toolbar,/data-rd-action="planner"/);
 assert.match(toolbar,/data-rd-action="toolbox"/);
 assert.match(toolbar,/data-rd-action="settings"/);
 assert.match(toolbar,/data-rd-focus-clock/);
 assert.match(toolbar,/aria-expanded="true" aria-controls="rd-appearance-panel"/);
 assert.match(html,/data-rd-action="planner"/,'drawer keeps personal planner navigation');
});

test('open activates only settings, closes the other dock, and leaves the page interactive',()=>{
 const f=fixture();f.dock.sync();
 assert.equal(f.container.dataset.settings,'closed');
 assert.equal(f.panel.inert,true);assert.equal(f.inner.inert,true);
 f.dock.open(f.opener);
 assert.equal(f.otherDockOpen,false);assert.deepEqual(f.changes,[true]);
 assert.equal(f.container.dataset.settings,'open');assert.equal(f.panel.dataset.open,'true');
 assert.equal(f.panel.inert,false);assert.equal(f.inner.inert,false);assert.equal(f.workspace.inert,false);
 assert.equal(f.toolbarButton.attrs.get('aria-expanded'),'true');
 assert.ok(f.host.attrs.has('data-reserve-settings'));
 assert.equal(f.focused,f.closeButton);
 f.dock.sync();f.dock.open(f.opener);
 assert.deepEqual(f.changes,[true],'repeated open and sync do not reopen the other dock');
});

test('Escape closes and returns focus; Tab is never trapped',()=>{
 const f=fixture();f.dock.open(f.opener);
 assert.equal(f.dock.handleKeydown({key:'Tab'}),false);
 let prevented=0;
 assert.equal(f.dock.handleKeydown({key:'Escape',preventDefault(){prevented++;}}),true);
 assert.equal(prevented,1);assert.equal(f.focused,f.opener);
 assert.equal(f.panel.inert,true);assert.equal(f.inner.attrs.get('aria-hidden'),'true');
 assert.equal(f.toolbarButton.attrs.get('aria-expanded'),'false');
 assert.equal(f.workspace.inert,false);assert.equal(f.host.attrs.has('data-reserve-settings'),false);
 assert.deepEqual(f.changes,[true,false]);
 assert.equal(f.dock.handleKeydown({key:'Escape',preventDefault(){throw Error('unexpected');}}),false);
});

test('dock handoff skips focus restoration; hidden or detached openers use Settings',()=>{
 const f=fixture();f.dock.open(f.opener);f.toolbarButton.focus();
 f.dock.close({restoreFocus:false});assert.equal(f.focused,f.toolbarButton);
 f.dock.open(f.opener);f.opener.isConnected=false;f.dock.close();assert.equal(f.focused,f.toolbarButton);
 f.opener.isConnected=true;f.dock.open(f.opener);f.opener.visible=false;f.dock.close();assert.equal(f.focused,f.toolbarButton);
 f.opener.visible=true;f.dock.toggle(f.opener);assert.equal(f.container.dataset.settings,'open');
 f.dock.toggle();assert.equal(f.container.dataset.settings,'closed');
});

test('sync preserves the rendered panel and scroll; destroy safely cleans up',()=>{
 const f=fixture();f.dock.open(f.opener);f.panel.scrollTop=180;
 for(let i=0;i<3;i++)f.dock.sync();
 assert.equal(f.panel.scrollTop,180);assert.equal(f.focused,f.closeButton);
 assert.deepEqual(f.changes,[true]);
 f.dock.destroy();assert.equal(f.panel.inert,true);assert.equal(f.inner.inert,true);
 assert.equal(f.container.dataset.settings,'closed');assert.equal(f.host.attrs.has('data-reserve-settings'),false);
 f.dock.open(f.opener);assert.equal(f.container.dataset.settings,'closed');
});

test('dock CSS reserves desktop space, adapts to phone and respects reduced motion',()=>{
 const css=source('settings-dock.css');
 assert.match(css,/\.rd\[data-settings=['"]?open['"]?\][^{]*\{[^}]*padding-right:/);
 assert.match(css,/\.rd \.rd-appearance\.ch-settings-dock\s*\{[^}]*position:fixed/);
 assert.match(css,/\.rd \.ch-settings-dock \.rd-customize-grid/);
 assert.match(css,/\.rd \.ch-settings-dock \.rd-course-setting/);
 assert.match(css,/@media\s*\(max-width:\s*900px\)/);
 assert.match(css,/padding-bottom:\s*calc\(var\(--rd-settings-height\)/);
 assert.match(css,/prefers-reduced-motion:\s*reduce[\s\S]*ch-settings-dock/);
 assert.match(css,/data-motion-style=['"]?off['"]?[^\n]*ch-settings-dock/);
 assert.match(css,/data-motion-style=['"]?still['"]?[^\n]*ch-settings-dock/);
 assert.match(css,/data-input=['"]?keyboard['"]?[^\n]*ch-settings-dock/);
 assert.match(css,/\.rd-utility-dialog:not\(\[data-leaving="true"\]\)/,'a departing tool stays visible during handoff');
 assert.doesNotMatch(css,/\.rd\[data-settings=['"]?open['"]?\]\s*\{[^}]*pointer-events:\s*none/);
});
