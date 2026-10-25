// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../extension/features.js'),read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
test('My links & files is owned, ordered and enabled only in selected workspace builds',()=>{
 const entry=F.catalogue.find(f=>f.id==='course-files');assert.equal(entry?.name,'My links & files');
 for(const prefs of [{preset:'full'},{preset:'custom'},{preset:'custom',custom:['course-files']}]){
  const picked=F.resolve(prefs);assert.ok(picked.enabled.includes('course-files'));
  for(const file of ['course-files.js','course-links-ui.js','course-file-open.js'])assert.equal(picked.js.filter(f=>f===file).length,1,file);
  assert.ok(picked.js.indexOf('course-links-ui.js')<picked.js.indexOf('course-hub-ui.js'));assert.ok(picked.css.includes('course-links.css'));
 }
 for(const prefs of [{preset:'lite'},{preset:'custom',custom:['dashboard']},{preset:'custom',custom:['course-hub']}]){
  const picked=F.resolve(prefs);assert.ok(!picked.enabled.includes('course-files'));assert.ok(!picked.js.some(f=>/^course-(?:files|links|file-open)/.test(f)));assert.ok(!picked.css.includes('course-links.css'));
 }
});
test('course links remain packaged without permissions, external writes or separate manager pages',()=>{
 const manifest=JSON.parse(read('manifest.json'));assert.deepEqual(manifest.permissions,['storage','unlimitedStorage','offscreen','scripting']);
 assert.ok(!manifest.content_scripts.flatMap(s=>s.js).some(f=>/^course-(?:files|links|file-open)/.test(f)));
 assert.ok(!manifest.web_accessible_resources.some(r=>r.resources.some(f=>/^course-(?:files|links|file-open).*\.js$/.test(f))),'feature scripts stay internal');
 assert.match(read('background.js'),/target==='ch-course-files'/,'explicit backups can load the packaged codec through the worker');
 for(const file of ['course-files.js','course-links-ui.js','course-file-open.js']){
  const code=read(file);assert.ok(code.startsWith("// Adapted from Gary Wu's pull request #47 to Canvas Harness.\n"));assert.doesNotMatch(code,/CanvasHarnessAI|fetch\(|XMLHttpRequest|sendBeacon|windows\.create/);
 }
 assert.ok(!fs.existsSync(path.join(__dirname,'../extension/course-files.html')));
});

test('the real dashboard conceals personal rows and blocks their actions until account verification resumes',t=>{
 const vm=require('node:vm'),{fixture}=require('./dashboard-heading-fixture.cjs'),f=fixture({setup({env,store}){
  store.owner={origin:'https://school.instructure.com',accountId:'1'};env.ReserveCourseFiles={create:()=>({list:course=>course==='10'?[{id:'cf-notes1',kind:'link',title:'Private notes',url:'https://example.com/notes'}]:[],destroy(){}})};env.ReserveCourseFileOpen={create:()=>({close(){},destroy(){}})};
  for(const file of ['material-model.js','course-hub-model.js','course-links-ui.js','course-hub-ui.js'])vm.runInContext(read(file),env,{filename:file});
 }});t.after(()=>f.dashboard.destroy());assert.ok(f.container.querySelector('.ch-links'));
 f.dashboard.closePersonalFiles();assert.equal(f.container.dataset.chLinksPending,'true');f.click('hub-own-add');f.tick(0);assert.equal(f.container.querySelector('.ch-links-form'),null);
 assert.match(read('course-links.css'),/\.rd\[data-ch-links-pending\]\s+\.ch-links\s*\{\s*display:\s*none/);
 f.dashboard.resumePersonalFiles();assert.equal(f.container.dataset.chLinksPending,undefined);f.click('hub-own-add');f.tick(0);assert.ok(f.container.querySelector('.ch-links-form'));
});
