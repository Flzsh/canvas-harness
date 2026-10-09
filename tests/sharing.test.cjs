'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),art=require('../extension/course-art.js'),storage=require('../extension/storage.js');
const read=name=>fs.readFileSync(path.join(root,'extension',name),'utf8');
test('unmatched recipient courses keep the shared artwork without invented lettering',()=>{
 assert.ok(art.kinds.includes('home')&&art.kinds.includes('bookmarks'));
 for(const course of [{id:'101',name:'Course One'},{id:'102',name:'Course Two'},{id:'103',name:'A renamed course',originalName:'Something else'}]){
  assert.equal(art.kind(course),'home');assert.equal(art.title(course),'');assert.equal(art.titleFrame(course),'');assert.equal(art.titled(course),null);
  assert.match(art.scene(course,{crop:'wide'}),/data-art="home"/);assert.match(art.scene(course,{crop:'wide'}),/data-cycle="16"/);
  assert.match(art.mini(course),/data-art="home"/);assert.match(art.frame('anything',course.id),/data-kind="home"/);
 }
 assert.equal(art.kind({id:'folio-bookmarks'}),'bookmarks');
});
test('fresh recipients start without grades, notes, bookmarks or cached courses',async()=>{
 const data={},adapter={read:async key=>structuredClone(data[key]),write:async(key,value)=>{data[key]=structuredClone(value);}};
 const author=storage.createStore({accountId:'1001',adapter}),recipient=storage.createStore({accountId:'1002',adapter});
 await author.load();await author.update(s=>{s.settings.showGrades=true;s.tasks['401']={notes:'Private test note',pinned:true};});
 const fresh=await recipient.load();assert.notEqual(fresh.settings.showGrades,true);assert.deepEqual(fresh.tasks,{});assert.deepEqual(fresh.resourcePins,[]);assert.deepEqual(fresh.customTasks,[]);
 assert.equal(fresh.snapshot,undefined);assert.throws(()=>storage.validateBackup(author.exportBackup(),recipient.owner),/different Canvas account or site/);
});
test('sharing build keeps the limited permissions and only read-only Canvas transport',()=>{
 const manifest=JSON.parse(read('manifest.json'));assert.equal(manifest.name,'Canvas Harness');
 assert.deepEqual(manifest.permissions,['storage']);assert.deepEqual(manifest.host_permissions,['https://*.instructure.com/*']);
 assert.match(read('api.js'),/method:'GET'/);assert.ok(!/method:\s*['"](?:POST|PUT|PATCH|DELETE)/.test(read('api.js')));
});
test('course headings display recipient names without embedded private lettering',()=>{
 assert.match(read('dashboard-view.js'),/course\?E\(short\(course\)\):'All courses'/);
 assert.match(read('course-hub-ui.js'),/E\(course.shortName\|\|course.name\)/);
 assert.match(read('materials-ui.js'),/E\(course.shortName\|\|course.name\)/);
 for(const name of ['dashboard-view.js','course-hub-ui.js','materials-ui.js'])assert.match(read(name),/rd-course-detail|rd-heading-detail/);
});
test('neutral and packaged subject frames are available without school-specific assets',()=>{
 const css=read('refresh.css');assert.ok(css.includes('.rd .rd-frame[data-kind=home]'));
 assert.match(read('subject-art.css'),/\.rd \.rd-frame\[data-kind=chemistry\]/);
 assert.ok(!/\.rd \.rd-frame\[data-kind=(?:chemistry|math|engineering|biology|literature|latin|ethics)\] \> \.rd-frame-orn/.test(css));
});
test('decorative artwork preserves its SVG containers and metadata',()=>{
 for(const svg of [art.scene({id:'101'}),art.mini({id:'101'}),art.frame('home','101')]){
  assert.match(svg,/^<(?:svg|span)\b[^>]*>/);assert.match(svg,/<svg\b[^>]*><metadata>Canvas Harness artwork \| original creator: Flzsh \| org.flzsh.canvas-harness<\/metadata>/);
  assert.ok(!svg.includes('return FRAMES'));assert.match(svg,/<\/(?:svg|span)>$/);
 }
});
