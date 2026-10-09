'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
require('../extension/customization-model.js');
const ui=require('../extension/customize-ui.js');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');

// Small DOM boundary fixture: the controller runs unchanged, without a browser dependency.
function fixture(){
 let focused=null,toolsOpen=true;
 const element=()=>({dataset:{},inert:false,attrs:new Map(),isConnected:true,visible:true,
  setAttribute(name,value){this.attrs.set(name,String(value));},removeAttribute(name){this.attrs.delete(name);},
  getClientRects(){return this.isConnected?[{}]:[];},closest(){return null;},
  checkVisibility(){return this.visible;},
  focus(){focused=this;}});
 const trigger=element(),source=element(),close=element(),panel=element(),inner=element(),page=element(),host=element();
 panel.contains=node=>node===close||node===inner;
 panel.querySelector=selector=>selector==='.t-acc-panel'?inner:selector==='[data-rd-action="settings-close"]'?close:null;
 const container=element();container.querySelector=selector=>selector==='.rd-appearance'?panel:selector===':focus'?focused:selector==='.rd-toolbar [data-rd-action="settings"]'?trigger:null;
 host.toggleAttribute=(name,on)=>on?host.setAttribute(name,''):host.removeAttribute(name);
 container.getRootNode=()=>({host});
 const changes=[];
 const dock=ui.createDock({container,onOpen(){toolsOpen=false;},onChange(open){changes.push(open);}});
 return {dock,container,panel,inner,page,host,trigger,source,close,changes,get focused(){return focused;},get toolsOpen(){return toolsOpen;}};
}

test('settings opens a labeled complementary dock using the existing upload and reset controls',()=>{
 const c={s:{coursePrefs:{}},allCourses:[],courses:[],customizeOpen:false};
 const html=ui.render(c);
 assert.match(html,/<div class="rd-appearance t-acc ch-settings-dock"[^>]*role="complementary"[^>]*aria-labelledby="rd-appearance-title"/);
 assert.match(html,/id="rd-appearance-title"/);
 assert.match(html,/data-rd-action="settings-close"/);
 assert.equal((html.match(/data-rd-field="art-upload"/g)||[]).length,3);
 for(const action of ['layout-reset','course-reset','advanced-settings'])assert.ok(html.includes('data-rd-action="'+action+'"'));
 assert.ok(!/aria-modal|showModal/.test(html));
});

test('rendered dashboard keeps its main workspace usable and exposes Settings and Tools without the top Planner button',()=>{
 const view=require('../extension/dashboard-view.js');
 const c={s:{...globalThis.ReserveCustomization.defaults,coursePrefs:{}},state:{courseId:'all',query:'',mode:'actionable'},
  courses:[],allCourses:[],courseMap:new Map(),items:[],local:{},insights:{ready:[],recentGrades:[]},filtered:{items:[]},
  now:Date.parse('2026-10-09T16:00:00Z'),workspace:'materials',customizeOpen:true,user:{name:'Student'},status:'Ready',materialLibrary:'<button>Read material</button>'};
 const h={E:String,icon:()=>'',assignmentLink:()=>'',formatDate:()=>'',dueText:()=>'',scoreText:()=>'',gradePeriodLabel:()=>'',dayKey:()=> '2026-10-09',complete:()=>false};
 const html=view.render(c,h),toolbar=html.match(/<header class="rd-toolbar">[\s\S]*?<\/header>/)?.[0];
 assert.ok(toolbar);assert.ok(!toolbar.includes('data-rd-action="planner"'));
 assert.ok(toolbar.includes('data-rd-action="settings"'));assert.ok(toolbar.includes('data-rd-action="toolbox"'));
 assert.match(toolbar,/aria-expanded="true" aria-controls="rd-appearance-panel"/);
 assert.match(html,/<main class="rd-workspace"[^>]*><[\s\S]*Read material/);
 assert.ok(!/<main[^>]*(?:inert|aria-hidden)/.test(html));assert.ok(!html.includes('aria-modal'));
});

test('opening settings closes the other dock and only makes settings interactive',()=>{
 assert.equal(typeof ui.createDock,'function');
 const f=fixture();f.dock.sync();
 assert.equal(f.panel.inert,true);assert.equal(f.inner.inert,true);
 f.dock.open(f.source);
 assert.equal(f.toolsOpen,false);assert.deepEqual(f.changes,[true]);
 assert.equal(f.container.dataset.settings,'open');assert.equal(f.panel.dataset.open,'true');
 assert.equal(f.panel.inert,false);assert.equal(f.inner.inert,false);assert.equal(f.page.inert,false);
 assert.equal(f.trigger.attrs.get('aria-expanded'),'true');assert.ok(f.host.attrs.has('data-reserve-settings'));
 assert.equal(f.focused,f.close);
});

test('Escape closes settings and restores its opener; other keys leave it open',()=>{
 const f=fixture();f.dock.open(f.source);
 assert.equal(f.dock.handleKeydown({key:'Tab'}),false);
 let prevented=false;
 assert.equal(f.dock.handleKeydown({key:'Escape',preventDefault(){prevented=true;}}),true);
 assert.equal(prevented,true);assert.equal(f.focused,f.source);
 assert.equal(f.panel.inert,true);assert.equal(f.inner.attrs.get('aria-hidden'),'true');
 assert.equal(f.trigger.attrs.get('aria-expanded'),'false');assert.equal(f.page.inert,false);
 assert.equal(f.host.attrs.has('data-reserve-settings'),false);
 assert.deepEqual(f.changes,[true,false]);
});

test('switching to Tools closes settings without stealing focus and disconnected openers fall back to Settings',()=>{
 const f=fixture();f.dock.open(f.source);f.trigger.focus();
 f.dock.close({restoreFocus:false});assert.equal(f.focused,f.trigger);
 f.dock.open(f.source);f.source.isConnected=false;f.dock.close();assert.equal(f.focused,f.trigger);
 f.source.isConnected=true;f.dock.open(f.source);f.source.visible=false;f.dock.close();assert.equal(f.focused,f.trigger);
});

test('sync preserves the settings node and active controls through data renders; destroy clears host state',()=>{
 const f=fixture();f.dock.open(f.source);f.panel.scrollTop=240;
 for(let i=0;i<3;i++)f.dock.sync();
 assert.equal(f.panel.scrollTop,240);assert.equal(f.focused,f.close);assert.deepEqual(f.changes,[true]);
 f.dock.destroy();assert.equal(f.panel.inert,true);assert.equal(f.container.dataset.settings,'closed');
 assert.equal(f.host.attrs.has('data-reserve-settings'),false);
 f.dock.open(f.source);assert.equal(f.container.dataset.settings,'closed');
});

test('desktop reservation, phone sheet and motion preferences have dedicated settings styles',()=>{
 const css=read('customize.css');
 assert.match(css,/\.rd\[data-settings=open\][^{]*\{[^}]*padding-right:calc\(var\(--ch-settings-width\)/);
 assert.match(css,/\.rd \.rd-appearance\.ch-settings-dock\s*\{[^}]*position:fixed/);
 assert.match(css,/@media\s*\(max-width:900px\)/);
 assert.match(css,/padding-bottom:calc\(var\(--ch-settings-height\)/);
 assert.match(css,/prefers-reduced-motion:reduce[\s\S]*ch-settings-dock/);
 assert.match(css,/data-motion-style=off[^\n]*ch-settings-dock/);
 assert.match(css,/data-motion-style=still[^\n]*ch-settings-dock/);
 assert.match(css,/data-input=keyboard[^\n]*ch-settings-dock/);
 assert.match(css,/data-toolbox=open[^\n]*ch-settings-dock/);
});

test('Planner is removed only from the command bar and the existing dock entry points coordinate settings',()=>{
 const view=read('dashboard-view.js'),dashboard=read('dashboard.js');
 const toolbar=view.slice(view.indexOf('function toolbar()'),view.indexOf('\n',view.indexOf('function toolbar()')));
 assert.ok(!toolbar.includes("action('planner'"));
 assert.ok(toolbar.includes("action('toolbox'"));assert.ok(toolbar.includes("action('settings'"));
 assert.ok(view.includes("action('planner'"),'Planner remains available outside the top toolbar');
 assert.match(dashboard,/onDockChange:[\s\S]*?if\(open\)settingsDock\?\.close\(\{restoreFocus:false\}\)/);
 assert.match(dashboard,/settingsDock\?\.handleKeydown\(event\)/);
 assert.match(dashboard,/action==='settings'/);
});
