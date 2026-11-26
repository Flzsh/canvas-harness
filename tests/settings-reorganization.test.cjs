'use strict';

// The public settings editor renders one pane and keeps local file review available.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const extension=path.resolve(__dirname,'../extension'),read=file=>fs.readFileSync(path.join(extension,file),'utf8');
const headings=html=>[...html.matchAll(/<section class="cz-group" data-art="[^"]*"><h3>([^<]+)<\/h3>/g)].map(match=>match[1].replaceAll('&amp;','&'));
const pane=html=>[...html.matchAll(/class="cz-pane" data-pane="([^"]+)"/g)].map(match=>match[1]);

function editor(){
 const env=vm.createContext({console,TextEncoder});
 env.ReservePonyAsk={cleanRoutines:routines=>routines||[],cleanReminders:reminders=>reminders||[]};
 for(const file of ['workspace-arrange.js','customization-model.js','custom-art.js','course-art.js','pet-art.js','pets.js','quick-upload-ui.js','make-your-own.js','settings-dock.js','customize-ui.js']){
  vm.runInContext(read(file),env,{filename:file});
 }
 env.ReserveWidgets={FRAMES:[['pen','Pen','Outline'],['stitch','Stitch','Outline']]};
 const allCourses=[{id:'10',name:'Biology',color:'#123456'},{id:'20',name:'History',color:'#abcdef'}];
 const s={...env.ReserveCustomization.defaults,theme:'light',accent:'clay',makeYourOwn:{theme:null,pet:null,installed:{}},coursePrefs:{}};
 const c={s,allCourses,courses:allCourses,customizeOpen:true,customizeCourseId:'10',customizeTab:'look',personal:{pet:{}},makeOwn:{busy:false,status:'',draft:null,week:'',presetKinds:{}},customKits:[]};
 const render=tab=>{c.customizeTab=tab;return env.ReserveCustomizeUI.render(c);};
 return {env,c,s,render};
}

// Adapted from customize-performance.test.cjs and personal-settings-dock.test.cjs.
test('closed dock is inert, constant sized and reads no protected settings',()=>{
 const f=editor(),readKeys=[];
 f.c.customizeOpen=false;
 for(const key of ['s','allCourses','courses','makeOwn','customizeDrafts']){
  Object.defineProperty(f.c,key,{get(){readKeys.push(key);throw Error('Read while closed: '+key);}});
 }
 const html=f.render('courses');
 assert.match(html,/data-open="false"/);
 assert.match(html,/inert aria-hidden="true"/);
 assert.doesNotMatch(html,/<(?:input|select|textarea|button|svg|img)\b|class="cz-pane"/);
 assert.deepEqual(readKeys,[]);
 assert.ok(Buffer.byteLength(html)<1000);
});

// Adapted from customize-performance.test.cjs and installed-controls.test.cjs.
// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).

// Adapted from course-dock-settings.test.cjs.

// Adapted from cleanup-look.test.cjs.

// Adapted from customization.test.cjs and media-banners-panel.test.cjs.

// Adapted from course-dock-settings.test.cjs feature-gate checks.
// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).

// Adapted from installed-controls.test.cjs.

// Adapted from personal-settings-dock.test.cjs and installed-controls.test.cjs.
// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).

// Adapted from installed-controls.test.cjs: local saved-pack metadata is loaded
// through the public pack reader, without copying private catalogue controls.
test('saved preset categories resolve from the public pack reader',async()=>{
 const f=editor();
 const installed={themeA:{id:'themeA',name:'Theme',kind:'theme'},lookA:{id:'lookA',name:'Saved look',kind:'preset'}};
 const store={get:()=>({settings:{makeYourOwn:{theme:installed.themeA,pet:null,installed}}}),subscribe:()=>()=>{}};
 f.env.ReservePacks={readLocal:async id=>({pack:{kind:id==='lookA'?'settings':'theme',name:id}})};
 const state=f.env.ReserveMakeYourOwn.create({store,onChange(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.state.presetKinds.lookA,'settings');
 assert.equal(state.state.theme.kind,'theme');
 state.destroy();
});

test('a missing saved preset does not prevent an active theme from loading',async()=>{
 const f=editor();
 const installed={missing:{id:'missing',name:'Missing saved look',kind:'preset'}};
 const store={get:()=>({settings:{makeYourOwn:{theme:{id:'themeA'},pet:null,installed}}}),subscribe:()=>()=>{}};
 f.env.ReservePacks={readLocal:async id=>{
  if(id==='missing')throw Error('File no longer exists');
  return {pack:{kind:'theme',name:'Working theme'}};
 }};
 const state=f.env.ReserveMakeYourOwn.create({store,onChange(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.state.theme.name,'Working theme');
 assert.deepEqual(Object.keys(state.state.presetKinds),[]);
 state.destroy();
});

// Adapted from personal-settings-dock.test.cjs.
// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).

test('settings title leaves no default heading margin',()=>{assert.match(read('settings-dock.css'),/\.rd \.ch-settings-dock \.rd-section-heading h2 \{ font-size:23px; margin:0; \}/);});

// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).

// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).

// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).
