'use strict';
// A course's own links and files (extension/course-files.js, course-files-page.js, course-file.js, background.js):
// kept per Canvas account on this computer, shown in Course information and the Course hub.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','extension',f),'utf8');
const F=require('../extension/course-files.js');
const E=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('links: web addresses only, with a friendly name for Google files',()=>{
 assert.equal(F.cleanLink('docs.google.com/document/d/abc/edit'),'https://docs.google.com/document/d/abc/edit');
 for(const bad of ['javascript:alert(1)','file:///Users/x','https://user:pw@x.com','notaurl',''])assert.equal(F.cleanLink(bad),'',bad);
 assert.equal(F.linkTitle('https://docs.google.com/document/d/abc/edit',''),'Google Doc');
 assert.equal(F.linkTitle('https://docs.google.com/spreadsheets/d/abc',''),'Google Sheet');
 assert.equal(F.linkTitle('https://www.khanacademy.org/x',''),'khanacademy.org');
 assert.equal(F.linkTitle('https://x.com','  Unit 2 notes '),'Unit 2 notes');
});

test('files: documents and images up to 50 MB',()=>{
 assert.equal(F.checkFile({name:'Lab.pdf',size:1000}),'');assert.equal(F.checkFile({name:'Essay.docx',size:1000}),'');
 assert.match(F.checkFile({name:'run.exe',size:10}),/use a PDF/);assert.match(F.checkFile({name:'big.pdf',size:60*1024*1024}),/50 MB/);assert.match(F.checkFile({name:'e.pdf',size:0}),/empty/);
});

test('the stored list is cleaned: ids, kinds, safe links, at most 60 a course',()=>{
 const list=F.cleanList([{id:'cf-abcd1',kind:'link',title:'Notes',url:'https://docs.google.com/x'},{id:'cf-abcd2',kind:'link',url:'javascript:x'},{id:'bad',kind:'link',url:'https://x.com'},
  {id:'cf-abcd3',kind:'file',title:'',name:'Lab.pdf',type:'application/pdf',size:12},...Array.from({length:70},(_,i)=>({id:'cf-many'+i,kind:'link',title:'L',url:'https://x.com'}))]);
 assert.equal(list[0].title,'Notes');assert.equal(list[1].id,'cf-abcd3');assert.equal(list[1].title,'Untitled');assert.equal(list.length,60);
 assert.deepEqual(F.cleanList('nope'),[]);
});

test('kept per Canvas site and account, beside the account\'s own data',()=>{
 assert.equal(F.key('https://school.instructure.com','42'),'reserve:v1:https://school.instructure.com:42:course-files');
});

test('the section: a row per link and file, + Add for the manager, escaped titles',()=>{
 const html=F.render({id:'5',shortName:'Chem'},F.cleanList([{id:'cf-abcd1',kind:'link',title:'Unit 2 <notes>',url:'https://docs.google.com/document/d/x'},{id:'cf-abcd2',kind:'file',title:'Lab',name:'Lab.pdf'}]),{E});
 assert.match(html,/href="https:\/\/docs\.google\.com\/document\/d\/x" target="_blank" rel="noopener noreferrer"/);assert.match(html,/Unit 2 &lt;notes&gt;/);assert.match(html,/Google Doc ↗/);
 assert.match(html,/data-rd-action="hub-own-open" data-course="5" data-file="cf-abcd2"/);assert.match(html,/PDF · on this computer/);
 assert.match(html,/data-rd-action="hub-own-add" data-course="5" data-name="Chem"/);
 const empty=F.render({id:'5',name:'Chemistry'},[],{E});assert.match(empty,/Add a Google Doc/);
 const preview=F.render({id:'5',name:'Chemistry'},[],{E,available:false});assert.doesNotMatch(preview,/hub-own-add/);assert.match(preview,/installed extension/);
});

test('the page side: reads its account\'s list, follows changes, and only asks the background',async()=>{
 const name=F.key('https://school.instructure.com','42'),listeners=new Set(),sent=[];let changes=0;
 const saved={[name]:{'5':[{id:'cf-abcd1',kind:'link',title:'Notes',url:'https://x.org/a'}]}};
 globalThis.chrome={storage:{local:{get:async k=>({[k]:saved[k]})},onChanged:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)}},runtime:{sendMessage:async m=>{sent.push(m);return {ok:true};}}};
 try{
  const w=F.watch({owner:{origin:'https://school.instructure.com',accountId:'42'},onChange:()=>changes++});
  await new Promise(r=>setImmediate(r));
  assert.equal(w.list('5')[0].title,'Notes');assert.equal(changes,1);assert.equal(w.available(),true);
  for(const f of listeners)f({[name]:{newValue:{'5':[]}}},'local');assert.deepEqual(w.list('5'),[]);assert.equal(changes,2);
  for(const f of listeners)f({'reserve:v1:https://school.instructure.com:43:course-files':{newValue:{'5':[{id:'cf-zzzz1',kind:'link',url:'https://y.org'}]}}},'local');
  assert.deepEqual(w.list('5'),[],'another account\'s list is not this one');
  await w.manage('5','Chem');await w.open('cf-abcd2');await w.open('../x');
  assert.deepEqual(sent,[{type:'ch-course-files',op:'manage',course:'5',name:'Chem',account:'42'},{type:'ch-course-files',op:'open',id:'cf-abcd2'}]);
  w.destroy();assert.equal(listeners.size,0);
 }finally{delete globalThis.chrome;}
 assert.equal(F.watch({owner:{origin:'https://x',accountId:'1'}}).available(),false,'the preview, without the extension');
});

test('wired in: Course information and the Course hub show it; the background opens things only for a Canvas tab',()=>{
 const hub=read('course-hub-ui.js');
 assert.match(hub,/\$\{own\(course\)\}<\/div><\/aside>/,'Course information, under the course documents');
 assert.match(hub,/\$\{own\(course\)\}<\/aside><\/div><\/section>`/,'the Course hub, under the announcements');
 assert.match(hub,/action==='hub-own-add'/);assert.match(hub,/action==='hub-own-open'/);
 assert.match(read('dashboard.js'),/ReserveCourseFiles\?\.watch\(\{owner:store\.owner/);
 const bg=read('background.js');
 assert.match(bg,/async function courseFiles\(message,sender\)\{\n  if\(!canvasSender\(sender\)\)return \{ok:false\};/);
 assert.match(bg,/origin:new URL\(sender\.url\)\.origin/,'the window\'s account is the asking tab\'s site');
 for(const f of ['course-files.js','course-files-page.js','course-file.js'])assert.doesNotMatch(read(f),/fetch\(|XMLHttpRequest|sendBeacon/,f);
 const m=JSON.parse(read('manifest.json'));
 assert.ok(!m.web_accessible_resources.some(w=>w.resources.some(r=>/course-files?\.html/.test(r))),'not reachable from websites');
 const scripts=m.content_scripts.flatMap(s=>s.js);assert.ok(scripts.indexOf('course-files.js')<scripts.indexOf('course-hub-ui.js'));
 assert.match(read('course-files.html'),/<script src="course-files\.js"><\/script>\n<script src="course-files-page\.js"><\/script>/);
});
