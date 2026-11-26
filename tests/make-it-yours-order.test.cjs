'use strict';
// Roadmap item 5 (4.2): "Revamp Make it yours ... less about looks and more about order and categories: it's messy and
// hard to find things", with a clear way in to your own banner (on the banner itself, and in Look). Six tabs, one place
// for each thing; every control of 4.0.193 is still there (tests/fixtures/make-it-yours-controls-4.0.193.json).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
// (public: the private build's own scenes and its Make-your-own "Get more" were never in Canvas Harness)
const NEVER_PUBLIC=new Set(['action:make-get-more','field:setting setting:sceneTheme value:walls','field:setting setting:sceneTheme value:wisteria','field:setting setting:sceneTheme value:winter']);
const OLD=require('./fixtures/make-it-yours-controls-4.0.193.json').controls.filter(id=>!NEVER_PUBLIC.has(id));
const dense=s=>s.replace(/\n[ \t]*/g,'');
function ui(enabled=()=>true){
 const env=vm.createContext({console,URL,TextEncoder,structuredClone,chrome:{runtime:{getURL:f=>'chrome-extension://x/'+f}},ReserveFeatures:{enabled},ReservePets:require('../extension/pets.js'),ReservePetArt:require('../extension/pet-art.js'),ReservePetPack:require('../extension/pet-pack.js'),ReservePonyBrain:{SKILLS:{quiz:{label:'Quiz prep'},focus:{label:'Focus buddy'}}}});env.globalThis=env;
 for(const f of ['customization-model.js','workspace-arrange.js','addons-art.js','make-your-own.js','settings-dock.js','customize-ui.js'])vm.runInContext(read(f),env,{filename:f});
 return env;
}
const course={id:'101',name:'Chemistry',color:'#123456'};
function render(env,tab,s={}){return env.ReserveCustomizeUI.render({s:{...env.ReserveCustomization.defaults,coursePrefs:{},...s},customizeOpen:true,customizeTab:tab,allCourses:[course],courses:[course],customizeCourseId:'101',personal:{pet:{name:'Biscuit'}},canvasNav:'drawn'});}
const ids=html=>{const out=new Set();for(const m of html.matchAll(/<(input|select|button|textarea|label)\b([^>]*)>/g)){const a=m[2],get=k=>(a.match(new RegExp(k+'="([^"]*)"'))||[])[1]||'';const id=[get('data-rd-field')&&'field:'+get('data-rd-field'),get('data-setting')&&'setting:'+get('data-setting'),get('data-rd-action')&&'action:'+get('data-rd-action'),get('data-key')&&'key:'+get('data-key'),m[1]==='input'&&get('type')==='radio'?'value:'+get('value'):''].filter(Boolean).join(' ');if(id)out.add(id);}return out;};
const groups=html=>[...html.matchAll(/<section class="cz-group" data-art="([^"]*)"/g)].map(m=>m[1].replace(/&amp;/g,'&'));

test('six tabs in one order: Scenes, Look, Home, Courses, Companion, Settings; Look opens first; old names still land',()=>{
 const env=ui(),U=env.ReserveCustomizeUI;
 assert.deepEqual(JSON.parse(JSON.stringify(U.tabs())),[['scenes','Scenes'],['look','Look'],['layout','Home'],['courses','Courses'],['pet','Companion'],['settings','Settings']]);
 for(const [asked,shown] of [[undefined,'look'],['all','look'],['art','courses'],['features','settings'],['missing','look'],['scenes','scenes']])
  assert.match(render(env,asked),new RegExp('data-value="'+shown+'" aria-selected="true"'),String(asked));
 assert.deepEqual(JSON.parse(JSON.stringify(ui(id=>id!=='customization').ReserveCustomizeUI.tabs())),[['features','Features'],['settings','Settings']],'Lite as before');
});

test('every control of 4.0.193 is still in Make it yours, each in one tab of the new order',()=>{
 const env=ui(),found=new Map();
 for(const s of [{},{theme:'dark',sceneTheme:'sea'},{courseNavigation:'dock'},{themeArt:{bannerArt:{type:'image/svg+xml',svg:'<svg xmlns="http://www.w3.org/2000/svg"/>',name:'b.svg'}}}])
  for(const [tab] of env.ReserveCustomizeUI.tabs())for(const id of ids(render(env,tab,s)))found.set(id,(found.get(id)||new Set()).add(tab));
 assert.deepEqual(OLD.filter(id=>!found.has(id)),[],'nothing lost');
 const one=id=>[...found.get(id)];
 for(const v of ['','sea','train','christmas'])assert.deepEqual(one('field:setting setting:sceneTheme value:'+v),['scenes']);
 for(const v of ['drawn','shown','top','original'])assert.deepEqual(one('field:canvas-nav setting:canvasNav value:'+v),['settings']);
 for(const id of ['field:setting setting:bannerSize value:large','field:setting setting:courseCardStyle value:minimal'])assert.deepEqual(one(id),['look']);
 assert.deepEqual(one('field:make-part'),['scenes']);
});

test('each tab holds its own kind of thing, most used first',()=>{
 const env=ui();
 assert.deepEqual(groups(render(env,'scenes')),['Scene','Saved looks']);
 assert.deepEqual(groups(render(env,'look')),['Light or dark','Artwork at night','Accent color','Page color','Paper','Banner','Course cards','Module outline','Type','Graphics','Motion'].filter(g=>g!=='Artwork at night'));
 assert.deepEqual(groups(render(env,'layout')),['Start from a layout','Modules on Home','Order of the three panels','Where your courses are','Spacing','What shows','Saved layouts & plans']);
 assert.deepEqual(groups(render(env,'courses')),['Course list','Kits']);assert.match(render(env,'courses'),/class="ch-art-controls cz-art"/);
 const pet=groups(render(env,'pet'));assert.deepEqual(pet.slice(0,6),['Companion','Where it goes','Reminders','Planning','Skills','Saved routines']);assert.deepEqual(pet.slice(-4),['How much Biscuit knows','Coat','Harness','Size']);
 const settings=render(env,'settings');assert.deepEqual(groups(settings).slice(0,1),['Canvas’s menu bar']);
 assert.ok(settings.indexOf('data-rd-field="canvas-nav"')<settings.indexOf('data-rd-field="preferences-timezone"'),'Canvas\'s menu bar, then the time zone');
 assert.ok(settings.indexOf('data-rd-field="preferences-timezone"')<settings.indexOf('id="features-panel"'),'the feature list last');
 assert.doesNotMatch(render(env,'layout'),/data-setting="canvasNav"/);
});

test('your own banner, in Look: the drawing and its name, Paste, then Adjust and Use default once there is one',()=>{
 const env=ui(),bare=render(env,'look'),done=render(env,'look',{themeArt:{bannerArt:{type:'image/svg+xml',svg:'<svg xmlns="http://www.w3.org/2000/svg"/>',name:'mine.svg'}}});
 const pick=bare.match(/<div class="cz-own-banner"[\s\S]*?<\/div>/)?.[0];assert.ok(pick,'in the Banner group');
 assert.match(pick,/<label class="rd-button ch-upload cz-own-pick"><span class="cz-own-art" aria-hidden="true"><svg/);assert.match(pick,/<strong>Your own banner<\/strong>/);
 assert.match(pick,/<input type="file"[^>]*data-rd-field="art-upload" data-kind="banner" data-id="theme"/);assert.match(pick,/data-rd-action="art-clipboard"[^>]*data-id="theme" data-kind="banner"/);
 assert.doesNotMatch(pick,/art-remove|data-slot/);assert.doesNotMatch(pick,/<p[ >]|<small/,'a drawing and a name, no line under it');
 assert.match(done,/<strong>Replace your banner<\/strong>/);assert.match(done,/data-rd-action="customize-tab" data-value="courses" data-course="theme" data-slot="banner"/);assert.match(done,/data-rd-action="art-remove" data-id="theme" data-kind="banner"/);
 assert.ok(bare.indexOf('cz-own-banner')<bare.indexOf('data-setting="bannerSize"'),'above the banner sizes');
 assert.doesNotMatch(render(ui(id=>id!=='course-art'),'look'),/cz-own-banner|data-setting="bannerSize"/);
 const dash=read('dashboard.js');assert.match(dash,/if\(candidate\.dataset\.course&&validArtTarget\(candidate\.dataset\.course\)\)customizeCourseId=candidate\.dataset\.course;/,'Adjust opens Courses on that artwork');
});

test('your own banner on the banner itself: Home\'s heading carries the same upload, for this course or All courses',()=>{
 const src=read('dashboard-view.js');
 assert.match(src,/const ownBanner=enabled\('customization'\)&&enabled\('course-art'\)&&c\.s\.graphicsPlan\?\.panorama!=='off'&&root\.ReserveMediaFrame\?/);
 assert.match(src,/<label class="rd-banner-own" title="Use your own banner">/);assert.match(src,/<span class="rd-banner-own-name">Your banner<\/span>/);
 assert.match(src,/data-rd-field="art-upload" data-kind="banner" data-id="\$\{E\(course\?course\.id:'all'\)\}"/);
 assert.match(src,/\$\{chips\}<\/p>\$\{named\}<\/div>\$\{search\}\$\{ownBanner\}<\/div>/,'after the course heading in its row (the heading keeps only the name and its pieces, the title piece last); placed on the banner by its CSS');
 assert.match(read('customize.css'),/\.rd \.rd-workspace-heading:has\(> \.rd-banner-own\)\{position:relative\}/);assert.match(read('customize.css'),/anchor-name:--rd-own-banner/);
 const css=read('customize.css');assert.match(css,/\.rd\[data-theme-kit\] \.rd-banner-own\{display:none\}/,'a scene draws its own banner: the tag stays off it');
 assert.match(css,/\.rd \.rd-banner-own\{position:absolute;/);assert.doesNotMatch(css.match(/\.rd \.rd-banner-own\{[^}]*\}/)[0],/position:fixed|sticky/);
});

test('Biscuit still opens a setting by name: the path\'s tab in the new order, and the other tabs when it is not there',()=>{
 const answer=dense(read('biscuit-answer.js'));assert.match(answer,/tab:\(\{look:'look',scenes:'scenes',scene:'scenes',layout:'layout',home:'layout','course dock':'layout',courses:'courses',artwork:'courses',pet:'pet',companion:'pet',settings:'settings',features:'settings',more:'settings'\}\)\[tab\]\|\|'look'/);
 const pets=dense(read('pets.js'));assert.match(pets,/if\(!hit&&open&&label\)for\(const \[other\] of root\.ReserveCustomizeUI\?\.tabs\?\.\(\)\|\|\[\]\)\{if\(other===tab\)continue;try\{await open\(\{tab:other\}\);\}catch\{continue;\}/);
 const U=ui().ReserveCustomizeUI;assert.equal(U.tabFor('sceneTheme'),'scenes');assert.equal(U.tabFor('canvasNav'),'settings');assert.equal(U.tabFor('bannerSize'),'look');assert.equal(U.tabFor('courseCardStyle'),'look');assert.equal(U.tabFor('density'),'layout');
 const inv=require('../scripts/biscuit-control-inventory.cjs').extract()/* (public: the inventory as the public generator makes it) */,place=id=>inv.controls.find(c=>c.id===id)?.ui?.path?.[1];
 assert.equal(place('setting:canvasNav'),'Settings');assert.equal(place('setting:sceneTheme'),'Scenes');assert.equal(place('setting:courseCardStyle'),'Look');
 assert.ok(inv.controls.some(c=>c.id==='settings-tab:scenes'));assert.ok(!inv.controls.some(c=>/page-switch/.test(c.id)),'the page switch is on Canvas pages, never Biscuit\'s');
});
