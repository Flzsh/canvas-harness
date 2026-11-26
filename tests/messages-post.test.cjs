// pages-42: Messages as the post room. Unread first, then by course under each course's drawing and colour, the
// conversation in a reading pane beside the list (oldest to newest, your own lines marked, files as kraft tags) with
// Reply in Canvas at its head; Escape and the arrow keys. Reading never marks a conversation read and never writes to
// Canvas. Every older behaviour stays covered by tests/course-hub-ui.test.cjs.
require('../extension/site.js');
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Model=require('../extension/course-hub-model.js');
const hour=36e5,ago=h=>new Date(Date.now()-h*hour).toISOString();
const conv=(id,course,subject,unread,hours,extra={})=>({id,subject,workflow_state:unread?'unread':'read',last_message:subject+' text',last_message_at:ago(hours),context_code:course?'course_'+course:'user_5',context_name:course?'Course '+course:'Sample School',message_count:1,properties:[],participants:[{id:'5',name:'Sample Student'},{id:'t'+(course||0),name:'Course Teacher'}],...extra});
function setup({conversations,read}={}){
 const raw={origin:'https://school.instructure.com',accountId:'5',conversations:conversations||[conv('1','7','Lab goggles',true,1,{message_count:3,properties:['attachments']}),conv('2','8','Office hours',true,3),conv('3','7','Reading',false,48),conv('4','8','Quiz moved',false,24),conv('5',null,'Advisory',false,120),conv('6','7','Welcome',false,240)],errors:[]};
 const calls={inbox:0,read:[],changes:0},data={resourcePins:[]};
 const context={ReserveSite:{...require('../extension/site.js'),origin:()=>'https://school.instructure.com'},URL,Date,Map,Set,AbortController,ReserveUI:{...require('../extension/ui-utils.js'),safeRichHTML:body=>body},ReserveMaterials:require('../extension/material-model.js'),ReserveCourseHubModel:Model,document:{createElement:()=>({content:{querySelectorAll:()=>[]}})},
  ReserveCourseArt:{mini:(course,{place})=>`<svg class="rd-mini" data-place="${place}" data-course="${course.id}"></svg>`},ReserveDashboardView:{drawing:key=>`<svg class="rd-tb-ic" data-drawing="${key}"></svg>`}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/course-hub-ui.js'),'utf8'),context);
 const t1=ago(30),t2=ago(20),t3=ago(2);
 const client={listInbox:async()=>{calls.inbox++;return structuredClone(raw);},readConversation:read||(async id=>{calls.read.push(id);return {origin:raw.origin,accountId:'5',conversation:{id,participants:[{id:'5',name:'Sample Student'},{id:'t7',name:'Course Teacher'}],messages:[
  {id:'c',author_id:'t7',created_at:t3,body:'Third line',attachments:[{display_name:'Lab handout.docx',url:'https://school.instructure.com/files/9/download'}]},
  {id:'b',author_id:'5',created_at:t2,body:'My reply'},{id:'a',author_id:'t7',created_at:t1,body:'First line'}]}};})};
 const store={owner:{origin:raw.origin,accountId:'5'},get:()=>structuredClone(data),update:async fn=>fn(data)};
 const ui=context.ReserveCourseHubUI.create({store,user:{id:'5'},client,onChange:()=>calls.changes++});
 return {ui,calls,data,raw};
}
const courses=[{id:'7',name:'Chemistry',shortName:'Chemistry',color:'#a05252'},{id:'8',name:'CL Calculus',shortName:'Calculus',color:'#35608f'}];
const settle=()=>new Promise(setImmediate);
const pos=(html,s)=>html.indexOf(s);

test('the model keeps who else is in a conversation, how many messages, and whether it carries files',()=>{
 const [one]=Model.normalizeInbox({accountId:'5',conversations:[conv('1','7','Lab goggles',true,1,{message_count:3,properties:['attachments']})]});
 assert.deepEqual([one.people,one.count,one.files],[['Course Teacher'],3,true],'never the student');
 const [two]=Model.normalizeInbox({accountId:'5',conversations:[{id:'2',subject:'x',participants:'junk',message_count:'n'}]});
 assert.deepEqual([two.people,two.count,two.files],[[],null,false]);
});

test('unread first, then each course under its drawing (the newest course first), then the messages with no course',async()=>{
 const f=setup();await f.ui.loadInbox();const html=f.ui.renderInbox(courses);
 const groups=[...html.matchAll(/<section class="rd-post-group" data-group="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(groups,['unread','8','7','other']);
 assert.match(html,/<h2 class="rd-post-group-head" id="rd-post-unread"><span class="rd-message-dot" data-unread="true" aria-hidden="true"><\/span>Unread <span class="rd-n">2<\/span><\/h2>/);
 assert.match(html,/<section class="rd-post-group" data-group="7" data-rd-key="post-group-7" aria-labelledby="rd-post-7" style="--rd-course:#a05252;--rd-course-ink:[^"]+"><h2 class="rd-post-group-head" id="rd-post-7"><svg class="rd-mini" data-place="row" data-course="7"><\/svg><span title="Chemistry">Chemistry<\/span> <span class="rd-n">2<\/span><\/h2>/);
 assert.match(html,/<h2 class="rd-post-group-head" id="rd-post-other"><svg class="rd-mini" data-place="row" data-course="folio-home"><\/svg><span>Not from a course<\/span> <span class="rd-n">1<\/span><\/h2>/);
 assert.ok(pos(html,'Lab goggles')<pos(html,'Office hours')&&pos(html,'Office hours')<pos(html,'Quiz moved')&&pos(html,'Quiz moved')<pos(html,'Reading')&&pos(html,'Reading')<pos(html,'Welcome')&&pos(html,'Welcome')<pos(html,'Advisory'));
 const unreadRow=html.slice(pos(html,'data-message="1"'),html.indexOf('</li>',pos(html,'data-message="1"')));
 assert.match(unreadRow,/<span class="rd-post-mark" aria-hidden="true"><svg class="rd-mini" data-place="row" data-course="7"><\/svg><\/span>/,'an unread row shows its course');
 assert.match(unreadRow,/<span class="rd-announcement-meta" title="Chemistry">Chemistry<\/span><span aria-hidden="true"> · <\/span><span class="rd-post-people">Course Teacher<\/span><span aria-hidden="true"> · <\/span><span class="rd-post-count">3 messages<\/span><span aria-hidden="true"> · <\/span><span class="rd-file-tag rd-file-tag--mini" data-paper="doc">File<\/span>/);
 const readRow=html.slice(pos(html,'data-message="3"'),html.indexOf('</li>',pos(html,'data-message="3"')));
 assert.match(readRow,/<span class="rd-post-mark" aria-hidden="true"><\/span>/,'a course group\'s rows need no course of their own');assert.doesNotMatch(readRow,/rd-announcement-meta/);
 assert.match(html,/<p class="rd-post-facts">2 unread<span aria-hidden="true"> · <\/span>6 conversations<\/p>/);
 assert.match(html,/<span class="rd-post-art" aria-hidden="true"><svg class="rd-tb-ic" data-drawing="inbox"><\/svg><\/span><div><h1>Messages<\/h1>/,'the Messages tab\'s own drawing heads the page');
 f.ui.handle('hub-unread',{value:'true'});assert.deepEqual([...f.ui.renderInbox(courses).matchAll(/data-group="([^"]+)"/g)].map(m=>m[1]),['unread']);
 f.ui.destroy();
});

test('nothing open: the pane is the mailbox with the unread count',async()=>{
 const f=setup();await f.ui.loadInbox();const html=f.ui.renderInbox(courses);
 assert.match(html,/<aside class="rd-thread-pane rd-thread-pane--idle" id="rd-thread-pane" aria-label="Conversation"><span class="rd-post-art rd-post-art--idle" aria-hidden="true"><svg class="rd-tb-ic" data-drawing="inbox"><\/svg><\/span><p class="rd-thread-idle">2 unread<\/p>/);
 assert.doesNotMatch(html,/data-open="true"/);assert.equal(f.calls.read.length,0,'nothing is read until a row is opened');
 f.ui.destroy();
});

test('opening a row reads it into the pane: oldest to newest, your own lines marked, files as kraft tags, Reply in Canvas at its head; nothing is marked read or written',async()=>{
 const f=setup();await f.ui.loadInbox();f.ui.renderInbox(courses);
 f.ui.handle('hub-open-message',{message:'1'});assert.deepEqual({...f.ui.takeFocusRequest()},{type:'thread'});
 let html=f.ui.renderInbox(courses);assert.match(html,/<section class="rd-inbox rd-post" aria-label="Canvas message summaries" data-open="true">/);
 assert.match(html,/Loading the conversation…/,'the pane shows the newest line while the thread loads');
 await settle();html=f.ui.renderInbox(courses);assert.deepEqual(f.calls.read,['1']);
 const pane=html.slice(pos(html,'<article class="rd-thread-pane"'),html.indexOf('</article><p class="rd-message-disclaimer"')>0?html.indexOf('<p class="rd-message-disclaimer"'):undefined);
 assert.match(pane,/^<article class="rd-thread-pane" id="rd-thread-pane" aria-labelledby="rd-thread-title" data-message="1" data-rd-key="thread-1" style="--rd-course:#a05252;--rd-course-ink:[^"]+"><header class="rd-thread-head">/);
 assert.match(pane,/<p class="rd-thread-course"><svg class="rd-mini" data-place="row" data-course="7"><\/svg><span class="rd-thread-who"><b title="Chemistry">Chemistry<\/b><span aria-hidden="true"> · <\/span>Course Teacher<span aria-hidden="true"> · <\/span>3 messages<\/span><\/p><h2 id="rd-thread-title" tabindex="-1"><span class="rd-sr-only">Unread: <\/span>Lab goggles<\/h2>/);
 assert.match(pane,/<div class="rd-thread-actions"><a class="rd-button rd-button--primary rd-thread-reply" href="https:\/\/school.instructure.com\/conversations\/1">Reply in Canvas <span aria-hidden="true">↗<\/span><\/a><div class="rd-message-save">/,'Reply in Canvas leads the pane\'s head');
 assert.match(pane,/data-rd-action="hub-capture-message"[^>]*>Add to my plan<\/button>/);assert.match(pane,/data-rd-action="hub-save-message"[^>]*>Bookmark message<\/button>/);
 assert.ok(pos(pane,'First line')<pos(pane,'My reply')&&pos(pane,'My reply')<pos(pane,'Third line'),'oldest to newest');
 assert.match(pane,/<article class="rd-letter" data-own="true"><header><strong>You<\/strong>/);assert.match(pane,/<article class="rd-letter" data-own="false"><header><strong>Course Teacher<\/strong><time datetime="[^"]+">/);
 assert.match(pane,/<a class="rd-file-link" href="https:\/\/school.instructure.com\/files\/9\/download" target="_blank" rel="noopener noreferrer"><span class="rd-file-tag" data-paper="doc">Word<\/span><span>Lab handout\.docx<\/span><span aria-hidden="true">↗<\/span><\/a>/);
 const row=html.slice(pos(html,'<li class="rd-post-row" data-message="1"'),html.indexOf('</li>',pos(html,'<li class="rd-post-row" data-message="1"')));
 assert.match(row,/data-unread="true" data-open="true"/,'still unread: a preview never marks it read');assert.match(row,/aria-current="true"/);
 assert.equal(f.data.resourcePins.length,0);assert.equal(f.calls.inbox,1);
 f.ui.handle('hub-open-message',{message:'1'});await settle();assert.deepEqual(f.calls.read,['1'],'opening again reads nothing new');
 f.ui.handle('hub-open-message',{message:'999'});assert.match(f.ui.renderInbox(courses),/data-message="1" data-rd-key="thread-1"/,'an unknown id opens nothing');
 f.ui.destroy();
});

test('closing gives focus back to its row; the course switch and destroy close it too',async()=>{
 const f=setup();await f.ui.loadInbox();f.ui.handle('hub-open-message',{message:'3'});f.ui.takeFocusRequest();await settle();
 f.ui.handle('hub-close-message',{});assert.deepEqual({...f.ui.takeFocusRequest()},{type:'message-row',id:'3'});assert.match(f.ui.renderInbox(courses),/rd-thread-pane--idle/);
 f.ui.handle('hub-open-message',{message:'3'});f.ui.setCourse('7');assert.match(f.ui.renderInbox(courses),/rd-thread-pane--idle/,'a new course starts with nothing open');
 f.ui.handle('hub-open-message',{message:'3'});f.ui.destroy();assert.doesNotMatch(f.ui.renderInbox(courses),/data-open="true"/);
});

test('keys: Escape closes the open conversation (not while typing); up and down walk the rows',async()=>{
 const f=setup();await f.ui.loadInbox();f.ui.handle('hub-open-message',{message:'1'});f.ui.takeFocusRequest();await settle();
 const focused=[];const button=id=>({tagName:'BUTTON',dataset:{message:id},classList:{contains:c=>c==='rd-post-open'},getClientRects:()=>[1],focus(){focused.push(id);},scrollIntoView(){}});
 const rows=['1','2','4'].map(button),inbox={querySelectorAll:()=>rows};for(const r of rows)r.closest=()=>inbox;
 const key=(k,target)=>{let prevented=false;const handled=f.ui.keydown({key:k,target,composedPath:()=>[target],preventDefault(){prevented=true;}});return {handled,prevented};};
 assert.deepEqual(key('ArrowDown',rows[0]),{handled:true,prevented:true});assert.deepEqual(focused,['2']);
 assert.deepEqual(key('ArrowUp',rows[0]),{handled:false,prevented:false},'no row above the first');
 const field={tagName:'INPUT',classList:{contains:()=>false},closest:()=>inbox};
 assert.equal(key('Escape',field).handled,false,'Escape in the search leaves the conversation open');
 assert.equal(key('Escape',rows[1]).handled,true);assert.deepEqual({...f.ui.takeFocusRequest()},{type:'message-row',id:'1'});
 assert.equal(key('Escape',rows[1]).handled,false,'nothing open, Escape is not ours');
 const outside={tagName:'BUTTON',classList:{contains:()=>true},closest:()=>null};assert.equal(key('ArrowDown',outside).handled,false,'keys outside Messages are not ours');
 f.ui.destroy();
});

test('a conversation that cannot load says so and offers Try again; a refresh reads the open one again',async()=>{
 let fail=true;const f=setup({read:async id=>{if(fail)throw Error('Canvas is busy');return {origin:'https://school.instructure.com',accountId:'5',conversation:{id,messages:[{id:'x',author_id:'t7',body:'Back again',created_at:ago(1)}],participants:[]}};}});
 await f.ui.loadInbox();f.ui.handle('hub-open-message',{message:'2'});await settle();let html=f.ui.renderInbox(courses);
 assert.match(html,/<p class="rd-hub-notice" role="alert">Canvas is busy<\/p><button type="button" class="rd-text-button" data-rd-action="hub-retry-message" data-course="" data-message="2">Try again<\/button>/);
 assert.match(html,/<article class="rd-letter rd-letter--preview"><p>Office hours text<\/p><\/article>/,'the newest line still shows');
 fail=false;await f.ui.loadInbox({force:true});await settle();assert.match(f.ui.renderInbox(courses),/Back again/);
 f.ui.destroy();
});

test('a long thread shows its latest 30, oldest first, and says so; forwarded mail and media point to Canvas',async()=>{
 const f=setup({read:async id=>({origin:'https://school.instructure.com',accountId:'5',conversation:{id,participants:[],messages:Array.from({length:34},(_,i)=>({id:String(i),author_id:'t7',created_at:ago(i+1),body:'Note '+(34-i),...(i===0?{forwarded_messages:[{}]}:{})}))}})});
 await f.ui.loadInbox();f.ui.handle('hub-open-message',{message:'4'});await settle();const html=f.ui.renderInbox(courses);
 assert.equal((html.match(/<article class="rd-letter" /g)||[]).length,30);assert.ok(pos(html,'Note 5<')<pos(html,'Note 34<'));assert.doesNotMatch(html,/Note 4</);
 assert.match(html,/The latest 30 messages are shown\./);assert.match(html,/Open the original conversation for forwarded messages or media\./);
 f.ui.destroy();
});

test('the dashboard view lends a page its tab\'s drawing',()=>{
 const View=require('../extension/dashboard-view.js');
 assert.match(View.drawing('inbox'),/^<svg class="rd-tb-ic" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path /);
 assert.match(View.drawing('materials'),/^<svg class="rd-tb-ic"/);assert.equal(View.drawing('nothing-here'),'');
});
