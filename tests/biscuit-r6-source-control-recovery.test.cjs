'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),ACTUAL=path.join(ROOT,'extension'),SOURCE=ACTUAL,changed=new Set();
function load(){
 const env=vm.createContext({Intl,URL,URLSearchParams}),cache=new Map();
 function source(name){
  assert.match(name,/^[a-z][a-z0-9/-]*\.(?:js|json)$/);assert.ok(!name.includes('..'));
  if(name.endsWith('.json')){assert.equal(name,'biscuit-rules/school-language.json','Only the real packaged language dictionary is permitted');return JSON.parse(fs.readFileSync(path.join(ACTUAL,name),'utf8'));}
  if(cache.has(name))return cache.get(name).exports;
  const file=path.join(changed.has(name)?SOURCE:ACTUAL,name),module={exports:{}};cache.set(name,module);
  const fn=new vm.Script('(function(module,exports,require){\n'+fs.readFileSync(file,'utf8')+'\n})',{filename:file}).runInContext(env);
  fn(module,module.exports,request=>{assert.ok(request.startsWith('./'),'Only runtime relative dependencies');return source(request.slice(2));});return module.exports;
 }
 return {source,get C(){return source('biscuit-control-request.js');},get S(){return source('biscuit-selection.js');},get R(){return source('biscuit-registry.js');},get F(){return source('biscuit-facts.js');},get E(){return source('biscuit-engine.js');}};
}
const plain=value=>JSON.parse(JSON.stringify(value)),fields=r=>r?.next?.fields||{},ids=r=>Array.from(r||[],x=>x.id),courses=[{id:'A',name:'Lantern Inquiry'},{id:'B',name:'River Archive'}];
const state=extra=>({now:Date.UTC(2031,3,7,12),timeZone:'UTC',courses:plain(courses),settings:{},features:[],...extra});
const row=(id,kind,title,extra={})=>({id,kind,title,courseId:'A',text:'Loaded material.',fields:{itemId:id},...extra});
const control=(id,title,text,extra={})=>row(id,'page',title,{text,pageType:'control',...extra});
function fact(h,line,s,session={}){return h.F.resolve(line,s,session,h.R.entries(s));}
function noMutation(r,line){assert.ok(!['setting','feature','module'].includes(r?.action),line);}
function attachmentScene(extra={}){
 const f=row('paper-a','file','Copper Fold Chart.pdf',{filename:'Copper Fold Chart.pdf'}),other=row('paper-b','file','Linen Drift Table.csv');
 const m=row('mail-a','message','Workshop reply',{attachmentIds:[f.id],unread:true});
 return state({selectedItemId:m.id,messages:[m],files:[f,other],...extra});
}
const tinyPack=label=>({schemaVersion:1,tier:'basic',features:{charMax:0},patterns:[],models:{action:{labels:[label],scale:1,weights:{bias:[4]}},item:{labels:['yes'],scale:1,weights:{bias:[0],title:[1]}}}});

test('a finite feature directive owns an unpunctuated background mention',()=>{
 for(const line of ['My dashboard already feels crowded switch off the Math tools feature for now','The planner has enough panels disable the PDF reader feature please','My dashboard does not need more distractions turn the Math tools feature off now']){
  const h=load(),r=h.C.resolve('feature',line,state(),{},{id:'dashboard'});assert.equal(r?.action,'feature',line);assert.equal(fields(r).id,/PDF/.test(line)?'pdf':'math');assert.equal(fields(r).on,false);
 }
});
test('whole feature tokens preserve PDF again and disallow substrings',()=>{
 const h=load(),r=h.C.resolve('feature','Turn on the PDF reader feature again.',state(),{},{id:'play'});assert.equal(r?.action,'feature');assert.equal(fields(r).id,'pdf');assert.equal(fields(r).on,true);
 assert.equal(h.C.resolve('feature','Turn off the paid feature.',state(),{},{id:'play'}),null);
});
test('finite noun-first feature values retain real catalogue identities',()=>{
 const h=load(),r=h.C.resolve('feature','Math tools feature off please.',state(),{});assert.equal(r?.action,'feature');assert.equal(fields(r).id,'math');assert.equal(fields(r).on,false);
});
test('reported, quoted, negative and hypothetical directives do not acquire positive ownership',()=>{
 for(const line of ['Do not switch off the Math tools feature.','Never disable the Math tools feature.','If I switch off the Math tools feature, what happens?','What if I disable the Math tools feature?','Would I disable the Math tools feature?','The instruction says to disable the Math tools feature.','I was asked to switch off the Math tools feature.','Save a note exactly "switch off the Math tools feature".','Read the words "disable the Math tools feature".','Switch off the Math tools feature and turn on the PDF reader feature.'])noMutation(load().C.resolve('feature',line,state(),{},{id:'play'}),line);
});
test('real feature dependency handoffs and validated deictic detail remain intact',()=>{
 const h=load();for(const [id,path]of [['dashboard',['Make it yours','Features','Dashboard & assignments']],['planner',['Make it yours','Features','Planner & home widgets']],['pony',['Canvas Harness extension popup','Companion']]]){
  const r=h.C.resolve('feature','Turn it off.',state(),{},{id});assert.equal(r?.action,'none');assert.deepEqual(plain(r.ui.path),path);assert.deepEqual(plain(fields(r)),{});
 }
 assert.equal(h.C.resolve('feature','Turn it on.',state(),{},{id:'invented'}),null);
});
test('a value without a feature target cannot borrow learned detail',()=>{
 for(const line of ['The switch is off in the illustration.','Explain why the Math tools feature is off.','My dashboard is off today.'])assert.equal(load().C.resolve('feature',line,state(),{},{id:'play'}),null,line);
});
test('finite named module and operator evidence defeat background nouns and learned keys',()=>{
 const h=load(),r=h.C.resolve('module','My notes can wait put Messages module first on Home before I revise notes.',state(),{},{key:'timer',action:'hide'});assert.equal(r?.action,'module');assert.equal(fields(r).key,'messages');assert.equal(fields(r).action,'top');
 assert.equal(h.C.resolve('module','Explain the Notes module.',state(),{},{key:'notes',action:'hide'}),null);
 assert.equal(h.C.resolve('module','Adjust this Home module.',state(),{},{key:'constructor',action:'hide'}),null);
});
test('required Home panels retain real manual consumers',()=>{
 const h=load(),r=h.C.resolve('module','Hide Up next module on Home.',state(),{});assert.equal(r?.action,'none');assert.deepEqual(plain(r.ui.path),['Home','Up next','Size and place']);assert.deepEqual(plain(fields(r)),{});
});
test('grade visibility accepts a finite display/politeness/emoji tail',()=>{
 for(const line of ['Grades off on my screen pls ??','Scores hidden from this view please!','Grade visibility off in the display now ?','My grades off please on this screen.']){
  const r=load().C.surface(line,state(),{});assert.equal(r?.action,'setting',line);assert.equal(fields(r).key,'showGrades');assert.equal(fields(r).value,false);
 }
});
test('setting tails preserve public numeric and bedtime values and refuse unsupported literals',()=>{
 const h=load();for(const [line,key,value]of [['Set night art to 35% please.','nightArt',35],['Set night art to 100% please.','nightArt',100],['Set bedtime to 21:45 please.','bedtime','21:45']]){const r=h.C.surface(line,state(),{});assert.equal(r?.action,'setting',line);assert.equal(fields(r).key,key);assert.equal(fields(r).value,value);}
 // The existing consumer normalizes away decimal points and does not support
 // arbitrary hex accent values; ownership recovery must not invent either.
 for(const line of ['Set bedtime to 29:99 please.','Set accent to #A1B2C3 please ??','Set night art to 35.5% please.','Set density to "compact please".'])noMutation(h.C.surface(line,state(),{}),line);
});
test('setting recovery preserves literal notes, hypothetical explanations and compounds',()=>{
 for(const line of ['Note: grades off on my screen pls ??','What does grades off mean?','Do not set grades off on my screen.','If grades off on my screen would help, should I do it?','Grades off on my screen then turn on the Math tools feature.'])noMutation(load().C.surface(line,state(),{}),line);
});
test('deferred settings and unsupported pet consumers stay manual',()=>{
 const h=load(),r=h.C.surface('Set density to compact after the workshop.',state(),{});assert.equal(r?.action,'none');assert.equal(r.manual,true);assert.equal(fields(r).key,undefined);
 for(const line of ['Make my companion small.','Let my pet roam everywhere.']){const result=h.C.resolve('setting',line,state(),{});assert.equal(result?.action,'none');assert.ok(result.ui?.path);assert.equal(fields(result).key,undefined);}
});
test('a loaded Sent purpose accepts determiners, Canvas qualifiers and folder word order',()=>{
 for(const line of ['Open my Sent messages in Canvas.','View the Sent Canvas messages please.','Show Sent in Inbox.','Find my archived Inbox folder.']){
  const h=load(),archived=/archived/i.test(line),c=control('folder-a',archived?'Archived Canvas messages':'Sent Canvas messages','Inbox filter: '+(archived?'Archived':'Sent')+'. Actual receipts.'),s=state({selectedItemId:c.id,pages:[c]});
  const r=fact(h,line,s);assert.equal(r?.action,'find',line);assert.equal(fields(r).itemId,c.id);assert.equal(r.relation,'source-page');assert.ok(['find','open'].includes(r.next.action));
 }
});
test('folder purpose is not established by incidental body words from another folder',()=>{
 const h=load(),c=control('wrong-folder','Archived Canvas messages','Inbox filter: Archived. A sent draft may be archived.'),s=state({pages:[c],selectedItemId:c.id});assert.equal(h.S.manualRole('Open my Sent messages in Canvas.',h.R.entries(s),s,{}),null);assert.notEqual(fact(h,'Open my Sent messages in Canvas.',s)?.action,'find');
});
test('loaded multilingual blank-compose purpose opens a real UI without sending',()=>{
 for(const line of ['Ouvre un nouveau message, je vais ?crire le texte.','Quiero escribir al profesor; ouvre un nouveau message, yo pongo las palabras.','Abre un mensaje nuevo, por favor.','Open a blank message to the course teacher.']){
  const h=load(),c=control('compose-a','New message to course teacher','Canvas Inbox > Compose. The student writes and reviews before Send; nothing has been sent.'),s=state({selectedItemId:c.id,pages:[c]});
  const r=fact(h,line,s);assert.equal(r?.action,'find',line);assert.equal(fields(r).itemId,c.id);assert.notEqual(r.next.action,'send');assert.equal(fields(r).sent,undefined);
 }
});
test('a loaded reply area is a navigation purpose with its actual source object',()=>{
 const h=load(),c=control('reply-a','Conversation reply controls','Canvas Inbox > Reply. Review the reply area before sending.'),s=state({pages:[c],selectedItemId:c.id}),r=fact(h,'Open the reply area for this message.',s);assert.equal(r?.action,'find');assert.equal(fields(r).itemId,c.id);
});
test('arbitrary message content and spoken conversation cannot acquire UI purpose',()=>{
 const h=load(),c=control('compose-a','New message to course teacher','Canvas Inbox > Compose. Choose a recipient.'),s=state({selectedItemId:c.id,pages:[c]});
 for(const line of ['What did the message say about the recipient?','Find the unread conversation about graphite.','Who is my conversation practice partner?','Why does the message explain compose functions?','Read the message containing "open a new message".']){
  assert.equal(h.S.manualRole(line,h.R.entries(s),s,{}),null,line);assert.notEqual(fact(h,line,s)?.action,'find',line);
 }
});
test('purpose matching requires the actual loaded control, not a title-only ordinary document',()=>{
 for(const extra of [{pageType:undefined},{loaded:false},{available:false},{placeholder:true},{unavailable:true}]){
  const h=load(),c=control('ghost','New message to course teacher','Inbox Compose. Nothing sent.',extra),s=state({pages:[c],selectedItemId:c.id});assert.equal(h.S.manualRole('Open a new message.',h.R.entries(s),s,{}),null,JSON.stringify(extra));
 }
});
test('UI purpose obeys explicit courses, unavailable courses and negative sources',()=>{
 const h=load(),a=control('compose-a','New message to course teacher','Canvas Inbox Compose.',{courseId:'A'}),b=control('compose-b',a.title,a.text,{courseId:'B'}),s=state({pages:[a,b],selectedItemId:a.id});
 assert.equal(fields(fact(h,'Open a new message for River Archive.',s)).itemId,b.id);
 for(const line of ['Open a new Physics message.','Open a new message without Lantern Inquiry or River Archive.'])assert.equal(h.S.manualRole(line,h.R.entries(s),s,{}),null,line);
});
test('matching UI purposes with ambiguous identities abstain without a current owner',()=>{
 const h=load(),a=control('compose-a','New message to course teacher','Inbox Compose.'),b=control('compose-b',a.title,a.text),s=state({pages:[a,b]});assert.equal(h.S.manualRole('Open a new message.',h.R.entries(s),s,{}),null);
 const conflict=state({pages:[a,{...a,courseId:'B',text:'Different recipient.'}],selectedItemId:a.id});assert.equal(h.S.manualRole('Open a new message.',h.R.entries(conflict),conflict,{}),null);
});
test('grade-private UI controls remain outside ownership',()=>{
 for(const privacy of [{showGrades:false},{showGrades:true,privacy:{grades:false}}]){
  const h=load(),c=control('private-compose','New message to course teacher','Canvas Inbox Compose.',{gradeAccess:true}),s=state({...privacy,pages:[c],selectedItemId:c.id});assert.equal(h.S.manualRole('Open a new message.',h.R.entries(s),s,{}),null);
 }
});
test('duplicate file/page aliases of the same actual UI are not fabricated ambiguities',()=>{
 const h=load(),c=control('compose-a','New message to course teacher','Inbox Compose.'),s=state({pages:[c],files:[{...c,kind:'file'}],selectedItemId:c.id}),r=fact(h,'Open a new message.',s);assert.equal(r?.action,'find');assert.equal(fields(r).itemId,c.id);
});
test('a uniquely named actual attachment owns a direct file request within a conversation',()=>{
 const h=load(),s=attachmentScene(),r=fact(h,'Find Copper Fold Chart in the conversation.',s);assert.equal(r?.action,'find');assert.equal(fields(r).itemId,'paper-a');assert.equal(r.items[0].kind,'file');assert.deepEqual(ids(r.items),['paper-a']);
});
test('direct attachment ownership follows actual IDs rather than inferred title stems or sole files',()=>{
 const h=load(),s=attachmentScene(),r=fact(h,'Show that attachment.',s);assert.equal(r?.action,'find');assert.equal(fields(r).itemId,'paper-a');
 const noLink=attachmentScene();noLink.messages[0].attachmentIds=[];assert.equal(h.S.manualRole('Show that attachment.',h.R.entries(noLink),noLink,{}),null);
 const singleton=state({files:[s.files[0]]});assert.equal(h.S.manualRole('Show that attachment.',h.R.entries(singleton),singleton,{}),null);
});
test('loaded raw Inbox attachment metadata may ground an admitted file without inventing a target parent',()=>{
 const h=load(),s=attachmentScene();s.inbox=s.messages;delete s.messages;const admitted=h.R.entries(s).filter(r=>r.kind==='file'),before=JSON.stringify(s),r=h.F.resolve('The teacher put the file in a message show that attachment.',s,{},admitted);
 assert.equal(r?.action,'find');assert.equal(fields(r).itemId,'paper-a');assert.deepEqual(ids(r.items),['paper-a']);assert.equal(JSON.stringify(s),before);
});
test('a sole deictic attachment still requires one actual relationship after course/privacy admission',()=>{
 const h=load(),s=attachmentScene();delete s.selectedItemId;const r=fact(h,'Open the attachment.',s);assert.equal(fields(r).itemId,'paper-a');
 s.messages.push(row('mail-b','message','Different reply',{attachmentIds:['paper-b']}));assert.equal(h.S.manualRole('Open the attachment.',h.R.entries(s),s,{}),null);
});
test('current and prior attachment containers remain separate and stale pointers cannot borrow',()=>{
 const h=load(),s=attachmentScene(),session={lastItemId:'mail-b'};s.messages.push(row('mail-b','message','Earlier reply',{attachmentIds:['paper-b']}));
 assert.equal(fields(fact(h,'Open the attachment from this message.',s,session)).itemId,'paper-a');assert.equal(fields(fact(h,'Open the attachment from the previous message.',s,session)).itemId,'paper-b');
 s.selectedItemId='gone';assert.equal(h.S.manualRole('Open the attachment from this message.',h.R.entries(s),s,session),null);
 session.lastItemId='gone-too';assert.equal(h.S.manualRole('Open the attachment from the previous message.',h.R.entries(s),s,session),null);
});
test('multiple attachment links, duplicate names and conflicting file IDs cannot guess',()=>{
 const h=load(),s=attachmentScene();s.messages[0].attachmentIds.push('paper-b');assert.equal(h.S.manualRole('Show that attachment.',h.R.entries(s),s,{}),null);
 s.files.push(row('paper-c','file','Copper Fold Chart.pdf'));assert.equal(h.S.manualRole('Find Copper Fold Chart in the conversation.',h.R.entries(s),s,{}),null);
 const conflict=attachmentScene();conflict.files.push({...conflict.files[0],text:'Conflicting content.'});assert.equal(h.S.manualRole('Find Copper Fold Chart in the conversation.',conflict.files,conflict,{}),null);
});
test('an explicit missing or mismatched parent cannot be erased by a named file',()=>{
 const h=load(),s=attachmentScene();for(const line of ['Find Copper Fold Chart in the missing conversation.','Find Copper Fold Chart from the Lost reply message.','Find Copper Fold Chart in the unread Physics conversation.'])assert.equal(h.S.manualRole(line,h.R.entries(s),s,{}),null,line);
});
test('attachment ownership respects exclusions, course boundaries and unavailable rows',()=>{
 const h=load();for(const extra of [{courseId:'B'},{loaded:false},{available:false},{gradeAccess:true}]){const s=attachmentScene({showGrades:false});Object.assign(s.files[0],extra);assert.equal(h.S.manualRole('Show that attachment.',h.R.entries(s),s,{}),null,JSON.stringify(extra));}
 const s=attachmentScene();for(const line of ['Find Copper Fold Chart in the conversation without Copper Fold Chart.','Open the attachment from this message for River Archive.'])assert.equal(h.S.manualRole(line,h.R.entries(s),s,{}),null,line);
});
test('a requested parent container retains existing first position and attachment relationship',()=>{
 const h=load(),s=attachmentScene();for(const line of ['Open the unread conversation with its attachment.','Open the conversation about Copper Fold Chart with its attachment.']){const r=fact(h,line,s);assert.equal(r?.action,'find',line);assert.equal(fields(r).itemId,'mail-a');assert.deepEqual(ids(r.items),['mail-a','paper-a']);}
 const announcement=row('notice-a','announcement','Workshop notice correction',{attachments:['paper-a'],postedAt:s.now}),s2=state({announcements:[announcement],files:s.files,selectedItemId:announcement.id}),r=fact(h,'Open the corrected announcement with its attachment.',s2);assert.equal(fields(r).itemId,'notice-a');assert.deepEqual(ids(r.items),['notice-a','paper-a']);
});
test('missing explicit message containers still abstain in the actual Facts consumer',()=>{
 const h=load(),s=state({files:[row('paper-a','file','Copper Fold Chart.pdf')]});for(const line of ['Open the unread conversation.','Open the conversation with its attachment.','Open the message about Copper Fold Chart.']){const r=fact(h,line,s);assert.equal(r?.action,'none',line);assert.deepEqual(ids(r.items),[]);}
});
test('source scope and conceptual-message boundaries retain existing ownership policy',()=>{
 const h=load();assert.notEqual(h.S.sourceIntent('Who is my partner for conversation practice?').kind,'message');assert.equal(h.S.sourceIntent('Open the unread conversation about spoken drills.').kind,'message');
 const s=state(),notice=row('notice-a','announcement','Workshop notice'),scope=h.S.sourceScope('Find the Physics announcement.',[notice],s,{});assert.equal(scope.explicit,true);assert.equal(scope.ids.size,0);
 assert.equal(h.S.sourceOrder('Explain why revising an argument changes meaning.',[notice],{...s,selectedItemId:notice.id}),null);
});
test('the actual Engine uses staged purpose ownership with an unfitted synthetic action head',()=>{
 const h=load(),c=control('compose-a','New message to course teacher','Canvas Inbox Compose. Review before Send.'),s=state({pages:[c],selectedItemId:c.id});
 const r=h.E.create({pack:tinyPack('open/find')}).evaluate('Open a new message.',s,{});assert.equal(r?.action,'find');assert.equal(fields(r).itemId,c.id);assert.notEqual(r.next.action,'send');
});
test('the actual Engine retains missing-source abstention with the same synthetic head',()=>{
 const h=load(),s=state({files:[row('paper-a','file','Copper Fold Chart.pdf')]});const r=h.E.create({pack:tinyPack('open/find')}).evaluate('Open the unread conversation.',s,{});assert.equal(r?.action,'none');assert.deepEqual(ids(r.items),[]);
});

test('a background purpose phrase cannot hide a later finite feature directive',()=>{
 const h=load(),r=h.C.resolve('feature','The dashboard is useful for coursework disable the Math tools feature please.',state(),{});assert.equal(r?.action,'feature');assert.equal(fields(r).id,'math');assert.equal(fields(r).on,false);
});
test('finite module operators preserve alternate top and nominal width syntax',()=>{
 for(const [line,key,operation]of [['Move Notes module to top on Home.','notes','top'],['Make Messages module first on Home.','messages','top'],['Clock module wide please.','clock','wide']]){const r=load().C.resolve('module',line,state(),{});assert.equal(r?.action,'module',line);assert.equal(fields(r).key,key);assert.equal(fields(r).action,operation);}
});
test('an explicit nominal feature value never executes a literal note payload',()=>{
 for(const line of ['Note: Math tools feature off please.','Write down Math tools feature off please.','Save a note Math tools feature off please.'])noMutation(load().C.resolve('feature',line,state(),{}),line);
});
test('conflicting parent attachment inventories cannot establish ownership',()=>{
 const h=load(),s=attachmentScene();s.inbox=[{...s.messages[0],attachmentIds:['paper-b']}];assert.equal(h.S.manualRole('Show that attachment.',h.R.entries(s),s,{}),null);
});
test('a notification content question does not ask for the notification choices UI',()=>{
 const h=load(),c=control('push-a','Push notification preferences','Account notifications choose delivery for messages.'),s=state({pages:[c],selectedItemId:c.id});assert.equal(h.S.manualRole('What did the message say about notification choices?',h.R.entries(s),s,{}),null);
});

test('existing compose navigation retains finite inspection of actual draft metadata',()=>{
 const h=load(),c=control('draft-route','Extension request route','New Message is addressed to the course teacher. Subject and body are blank. No extension has been granted.',{recipient:'Course teacher',extensionGranted:false}),s=state({pages:[c],selectedItemId:c.id});
 for(const line of ['Open the Inbox composer.','Open the teacher Inbox compose route and policy; I will write and send.','Open the message compose controls and show its recipient and approval status.']){
  const r=fact(h,line,s);assert.equal(r?.action,'find',line);assert.equal(fields(r).itemId,c.id);assert.equal(r.next.action,'find');assert.equal(fields(r).operation,undefined);
  if(line.includes('recipient')){assert.equal(fields(r).recipient,'Course teacher');assert.equal(fields(r).extensionGranted,false);assert.equal(fields(r).approvedDueAt,undefined);}
 }
});

test('a failed deictic attachment cannot fall through to a sole unrelated file in the Engine',()=>{
 const h=load(),s=state({files:[row('paper-a','file','Copper Fold Chart.pdf')]}),r=h.E.create({pack:tinyPack('open/find')}).evaluate('Show that attachment.',s,{});assert.equal(r?.action,'none');assert.deepEqual(ids(r.items),[]);assert.notEqual(fact(h,'Show that attachment.',s)?.action,'find');
});
test('a recognized attachment request with a stale parent cannot borrow another message in consumers',()=>{
 const h=load(),s=attachmentScene({selectedItemId:'missing-mail'}),line='Open the attachment from this message.',r=h.E.create({pack:tinyPack('open/find')}).evaluate(line,s,{});assert.equal(r?.action,'none');assert.deepEqual(ids(r.items),[]);assert.notEqual(fact(h,line,s)?.action,'find');
});
test('a missing compose purpose cannot substitute an existing content message in consumers',()=>{
 const h=load(),s=state({messages:[row('mail-a','message','Workshop correspondence')],selectedItemId:'mail-a'}),line='Open a new message.',r=h.E.create({pack:tinyPack('open/find')}).evaluate(line,s,{});assert.equal(r?.action,'none');assert.deepEqual(ids(r.items),[]);assert.notEqual(fact(h,line,s)?.action,'find');
});
test('a named file with a mismatched attachment relationship cannot borrow its parent message',()=>{
 const h=load(),s=attachmentScene();s.messages[0].attachmentIds=['paper-b'];const line='Find Copper Fold Chart in the conversation.',r=h.E.create({pack:tinyPack('open/find')}).evaluate(line,s,{});assert.equal(r?.action,'none');assert.deepEqual(ids(r.items),[]);
});

test('notification or privacy topics inside an explicitly requested message keep the message as owner',()=>{
 const h=load(),m=row('mail-topic','message','Workshop correspondence',{text:'The recipient asks about push preferences and a privacy toggle.'}),c=control('push-a','Push notification preferences','Account notifications choose delivery.'),s=state({messages:[m],pages:[c],selectedItemId:c.id});
 for(const line of ['Open the message about push preferences.','Read the message about the privacy toggle.']){const r=fact(h,line,s);assert.equal(r?.action,'find',line);assert.equal(fields(r).itemId,m.id);assert.equal(h.S.manualRole(line,h.R.entries(s),s,{}),null,line);}
});

const workScene=()=>{const a=row('study-a','assignment','Verdant Report',{dueAt:Date.UTC(2031,3,12,16)}),b=row('study-b','assignment','Harbor Notebook',{courseId:'B',dueAt:Date.UTC(2031,3,13,16)}),log=row('log-a','page','Drift index');return {rows:[a,b,log],s:state({selectedItemId:a.id,assignments:[a,b],pages:[log]}),session:{lastItemId:b.id}};};
test('typed current and prior work noun slots use their respective loaded IDs',()=>{
 const h=load(),{rows,s,session}=workScene();for(const [phrase,id,owner]of [['this work','study-a','current'],['current work','study-a','current'],['the selected work','study-a','current'],['that work','study-b','prior'],['the same work','study-b','prior'],['the previous work','study-b','prior'],['the work from before','study-b','prior']]){const r=h.S.reference('Reserve 23 minutes for '+phrase+' tomorrow.',rows,s,session,{actor:'plan'});assert.equal(r.explicit,true,phrase);assert.equal(r.owner,owner,phrase);assert.equal(r.row?.id,id,phrase);}
});
test('bare typed work noun phrases retain ownership without an action-specific shortcut',()=>{
 const h=load(),{rows,s,session}=workScene();assert.equal(h.S.reference('this work',rows,s,session).row?.id,'study-a');const prior=h.S.reference('that work',rows,s,session);assert.equal(prior.explicit,true);assert.equal(prior.row?.id,'study-b');
});
test('the real Details allocation keeps this-work ownership and its own date, clock and budget',()=>{
 const h=load(),{rows,s,session}=workScene(),r=h.source('biscuit-details.js').resolve('plan','Reserve 23 minutes for this work tomorrow starting at 16:20; then show Drift index at 20:40 for 80 minutes',s,session,rows,[],{});
 assert.equal(r?.action,'plan');assert.equal(fields(r).itemId,'study-a');assert.equal(fields(r).minutes,23);assert.equal(fields(r).startAt,Date.UTC(2031,3,8,16,20));assert.equal(fields(r).endAt,Date.UTC(2031,3,8,16,43));assert.doesNotMatch(fields(r).line,/Drift index|20:40|80 minutes/);
});
test('real Details focus consumes both current and prior work noun slots',()=>{
 const h=load(),{rows,s,session}=workScene();for(const [phrase,id]of [['this work','study-a'],['that work','study-b']]){const r=h.source('biscuit-details.js').resolve('focus','Start a 17-minute focus for '+phrase+'.',s,session,rows,rows,{});assert.equal(r?.action,'focus');assert.equal(fields(r).itemId,id);assert.equal(fields(r).minutes,17);}
});
test('stale or absent explicit work pointers never fall back across current and prior owners',()=>{
 const h=load(),{rows,s,session}=workScene();for(const [line,snapshot,memory]of [['Reserve 23 minutes for this work.',{...s,selectedItemId:'gone',itemId:'study-a'},session],['Reserve 23 minutes for this work.',{...s,selectedItemId:undefined},session],['Reserve 23 minutes for that work.',s,{lastItemId:'gone',itemId:'study-b'}],['Reserve 23 minutes for that work.',s,{}]]){const r=h.S.reference(line,rows,snapshot,memory,{actor:'plan'});assert.equal(r.explicit,true,line);assert.equal(r.row,null,line);}
});
test('competing current and prior work objects stay ambiguous',()=>{
 const h=load(),{rows,s,session}=workScene(),r=h.S.reference('Reserve 23 minutes for this work or that work.',rows,s,session,{actor:'plan'});assert.equal(r.explicit,true);assert.equal(r.owner,'ambiguous');assert.equal(r.row,null);
});
test('relative work clauses and pronominal work verbs do not become typed work objects',()=>{
 const h=load(),{rows,s,session}=workScene();for(const line of ['Explain the methods that work in low light.','Find procedures that work for a small team.','Does that work?','Can this work tomorrow?','Make that work before 18:00.','Reserve 23 minutes before that at 18:00.','Reserve 23 minutes this evening.'])assert.equal(h.S.reference(line,rows,s,session,{actor:'plan'}).explicit,false,line);
});
test('quoted typed work words and quoted time phrases cannot acquire ownership',()=>{
 const h=load(),{rows,s,session}=workScene();for(const line of ['Save a note exactly "this work tomorrow at 18:00".','Explain the phrase "that work".'])assert.equal(h.S.reference(line,rows,s,session,{actor:'plan'}).explicit,false,line);
});
test('work noun slots preserve positive name precedence and negative source exclusions',()=>{
 const h=load(),{rows,s,session}=workScene();const named=h.S.reference('Reserve 23 minutes for Harbor Notebook rather than this work.',rows,s,session,{actor:'plan'});assert.equal(named.owner,'named');assert.equal(named.row?.id,'study-b');const prior=h.S.reference('Reserve 23 minutes for that work, not this work.',rows,s,session,{actor:'plan'});assert.equal(prior.row?.id,'study-b');
});
test('typed work references retain duplicate-identity refusal and caller immutability',()=>{
 const h=load(),{rows,s,session}=workScene(),before=JSON.stringify({rows,s,session}),r=h.S.reference('Reserve 23 minutes for this work.',[...rows,{...rows[0],courseId:'B',title:'Conflicting work'}],s,session,{actor:'plan'});assert.equal(r.explicit,true);assert.equal(r.row,null);assert.equal(JSON.stringify({rows,s,session}),before);
});


test('generic attachment objects and Spanish politeness cannot invent an academic course',()=>{
 const h=load(),s=attachmentScene();s.courses.push({id:'P',name:'Psychology'});assert.equal(fields(fact(h,'Show that attachment.',s)).itemId,'paper-a');
 assert.notEqual(fact(h,'Show that attachment in Physics.',s)?.action,'find');
 const scope=h.S.sourceScope('Find attachment theory in Psychology.',h.R.entries(s),s,{});assert.ok(scope.ids.has('P'));assert.equal(scope.explicit,true);
 const c=control('compose-a','New message to course teacher','Canvas Inbox > Compose.'),ui=state({pages:[c],selectedItemId:c.id});assert.equal(fields(fact(h,'Abre un mensaje nuevo, por favor.',ui)).itemId,c.id);
 ui.courses.push({id:'POR',name:'Portuguese',courseCode:'POR'});assert.equal(h.S.sourceScope('Open a new message for POR.',h.R.entries(ui),ui,{}).ids.has('POR'),true);
});


test('legacy compose URLs prove an actual route without requiring a synthetic page type',()=>{
 const h=load(),c=row('legacy-compose','page','Question to course instructor',{text:'Canvas message composer for requesting more time. No request sent or approved.',url:'https://school.invalid/conversations?compose=1'}),s=state({pages:[c],selectedItemId:c.id});assert.equal(fields(fact(h,'Open the course message composer.',s)).itemId,c.id);
 const plain={...c,url:'https://school.invalid/courses/A/pages/essay-about-composers',text:'A document about composers.'};assert.equal(h.S.manualRole('Open the course message composer.',h.R.entries(state({pages:[plain]})),state({pages:[plain]}),{}),null);
});
test('a group recipients composer keeps its real UI metadata and group identity',()=>{
 const h=load(),c=control('group-compose','Message Cedar Team','Canvas Inbox > Compose > Student Groups > Cedar Team. Recipients: three classmates.',{recipientGroupId:'cedar'}),s=state({pages:[c],selectedItemId:c.id});assert.equal(fields(fact(h,'Take me to the group recipients composer.',s)).itemId,c.id);
});
test('qualified approval and correction containers keep parent-first attachment ownership',()=>{
 const h=load(),s=attachmentScene();s.messages[0].extensionApproved=true;s.messages[0].approvedDueAt=Date.UTC(2031,3,10,12);const line='The unread approval carries a source packet; retrieve its attachment.';assert.equal(fields(fact(h,line,s)).itemId,'mail-a');assert.equal(h.S.role(line,h.R.entries(s),s,{},'open/find')?.name,'source-container');
});
test('finite submission-details requests retain their actual non-Inbox container',()=>{
 const h=load(),c=row('submission-a','submission','Submission comment exchange',{text:'Submission Details comment thread with Attach File.',submissionComments:[{author:'Teacher',text:'Add the axis key here.'}]}),s=state({submissions:[c],messages:[row('unrelated','message','Other conversation')],selectedItemId:c.id});assert.equal(fields(fact(h,'The teacher wanted a submission comment; open that details thread.',s)).itemId,c.id);
});
test('explicit module follow-ups may inherit only an actual prior module proposal',()=>{
 const h=load(),line='Make that same card wide so I can read the list.',s=state(),session={workflowAction:{action:'module',fields:{key:'notes',action:'show'}}},r=h.C.resolve('module',line,s,session,{key:'week',action:'wide'});assert.equal(r?.action,'module');assert.equal(fields(r).key,'notes');assert.equal(fields(r).action,'wide');assert.equal(h.C.resolve('module',line,s,{}, {key:'notes',action:'wide'}),null);
});
test('a finite installed feature switch adjunct remains a real feature request',()=>{
 const h=load(),r=h.C.resolve('feature','In extension settings, disable the installed PDF reader feature using its switch.',state(),{},{});assert.equal(r?.action,'feature');assert.equal(fields(r).id,'pdf');assert.equal(fields(r).on,false);
});
test('compose routes can include a policy display requirement without borrowing a content message',()=>{
 const h=load(),c=row('compose-policy','inbox-compose','Extension request route',{text:'Course late policy: 2 days. New Message is addressed to the teacher; subject and body are blank.',recipient:'Teacher'}),s=state({pages:[c],messages:[row('approval','message','Extension approved')],selectedItemId:c.id});assert.equal(fields(fact(h,'Open the teachers Inbox compose route with the extension policy visible.',s)).itemId,c.id);
});
test('purpose clauses preserve the student as author of a future message',()=>{
 const h=load(),I=h.source('biscuit-intent.js');for(const line of ['Open the course message composer so I can request an extension and explain my circumstances.','Bring up a new message so I can explain the problem and ask for one more day.'])assert.equal(I.workflowParts(line).length,1,line);
 assert.equal(I.workflowParts('Open the course message composer; then explain the late policy.').length,2);
});


test('the bare unread-messages shell stays navigation rather than a missing control-object lookup',()=>{
 const h=load(),m=row('mail-shell','message','Unread Inbox',{unread:true}),s=state({messages:[m],selectedItemId:m.id});assert.equal(h.S.manualRole('Take me to unread messages.',h.R.entries(s),s,{}),null);assert.notEqual(h.S.role('Take me to unread messages.',h.R.entries(s),s,{},'navigate')?.name,'control');const r=h.E.create({pack:tinyPack('navigate')}).evaluate('Take me to unread messages.',s,{});assert.equal(r.action,'navigate');assert.equal(fields(r).itemId,m.id);assert.equal(fields(r).filter,'unread');
});
