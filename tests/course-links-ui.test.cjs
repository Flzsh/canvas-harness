// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const UI=require('../extension/course-links-ui.js');
const course={id:'7',name:'Chemistry'},info={course:'7',place:'info'},hub={course:'7',place:'hub'};
const link=(id='cf-link1',title='Notes',url='https://docs.google.com/document/d/notes/edit')=>({id,kind:'link',title,url});
const file=(id='cf-file1',name='Lab.pdf')=>({id,kind:'file',title:name.replace(/\.[^.]+$/,''),name,type:name.endsWith('.pdf')?'application/pdf':'',size:50});
function setup(initial={}){
  const lists=new Map(Object.entries(initial).map(([id,items])=>[id,structuredClone(items)])),calls=[],opens=[];
  let changes=0,error='',before=null,sequence=0;
  const titleFor=url=>url.includes('/spreadsheets/')?'Google Sheet':url.includes('/presentation/')?'Google Slides':'Google Doc';
  const op=async(method,args,mutate)=>{calls.push([method,...args]);if(before)await before();if(error)throw Error(error);return mutate();};
  const files={list:id=>structuredClone(lists.get(String(id))||[]),
    addLink:(id,url,title)=>op('addLink',[id,url,title],()=>{if(!url.trim())throw Error('Enter a web address.');const item=link('cf-added'+(++sequence),title.trim()||titleFor(url),url);lists.set(id,[...files.list(id),item]);return item;}),
    addFiles:(id,selected)=>op('addFiles',[id,selected],()=>{const items=selected.map(selected=>file('cf-added'+(++sequence),selected.name));lists.set(id,[...files.list(id),...items]);return items;}),
    rename:(id,itemId,title)=>op('rename',[id,itemId,title],()=>{if(!title.trim())throw Error('Enter a name.');const items=files.list(id),item=items.find(item=>item.id===itemId);item.title=title.trim();lists.set(id,items);return item;}),
    remove:(id,itemId)=>op('remove',[id,itemId],()=>lists.set(id,files.list(id).filter(item=>item.id!==itemId)))};
  const ui=UI.create({files,onChange:()=>changes++,onOpen:async(id,itemId)=>{opens.push([id,itemId]);if(error)throw Error(error);}});
  return {ui,files,calls,opens,get changes(){return changes;},set error(value){error=value;},set before(value){before=value;}};
}

test('rows render synchronously with short kinds, escaped names and safe new-tab links',()=>{
  const f=setup({'7':[link('cf-note1','Unit 2 <notes>','https://docs.google.com/document/d/notes?x=1&y=2'),file(),link('cf-bad1','Unsafe','javascript:alert(1)')]});
  const html=f.ui.render(course);
  assert.equal(typeof html,'string');assert.match(html,/My links &amp; files/);assert.match(html,/Unit 2 &lt;notes&gt;/);
  assert.match(html,/href="https:\/\/docs.google.com\/document\/d\/notes\?x=1&amp;y=2" target="_blank" rel="noopener noreferrer"/);
  assert.match(html,/ch-links-kind">Google Doc<\/span>/);assert.match(html,/ch-links-kind">PDF<\/span>/);
  assert.doesNotMatch(html,/Unsafe|javascript:|on this computer|Add a Google Doc/);
  assert.match(html,/data-rd-action="hub-own-rename"/);assert.match(html,/data-rd-action="hub-own-remove"/);assert.equal(f.calls.length,0);
});

test('Add opens only the chosen placement and typing preserves drafts without redrawing',()=>{
  const f=setup();f.ui.handle('hub-own-add',info);const changed=f.changes;
  assert.match(f.ui.render(course),/aria-label="Add a link or files"/);assert.doesNotMatch(f.ui.render(course,{place:'hub'}),/aria-label="Add a link or files"/);
  assert.doesNotMatch(f.ui.render({id:'8',name:'Latin'}),/aria-label="Add a link or files"/);
  f.ui.input('hub-own-url','https://docs.google.com/document/d/a?x="&',info);f.ui.input('hub-own-title','<Draft>',info);
  assert.equal(f.changes,changed,'input must not force a render or replace the active field');
  assert.match(f.ui.render(course),/value="&lt;Draft&gt;"/);assert.match(f.ui.render(course),/a\?x=&quot;&amp;"/);
  assert.deepEqual(f.ui.takeFocusRequest(),{type:'own',courseId:'7',place:'info',field:'hub-own-url'});
  assert.equal(f.ui.takeFocusRequest(),null);
  f.ui.handle('hub-own-add',hub);f.ui.input('hub-own-title','Hub draft',hub);
  assert.match(f.ui.render(course),/value="&lt;Draft&gt;"/);assert.match(f.ui.render(course,{place:'hub'}),/value="Hub draft"/);
});

test('inline link addition delegates optional names and renders friendly Google file defaults',async()=>{
  const f=setup();f.ui.handle('hub-own-add',info);
  for(const [path,title] of [['document','Google Doc'],['spreadsheets','Google Sheet'],['presentation','Google Slides']]){
    const url=`https://docs.google.com/${path}/d/example/edit`;
    f.ui.input('hub-own-url',url,info);await f.ui.handle('hub-own-save-link',info);
    assert.deepEqual(f.calls.at(-1),['addLink','7',url,'']);assert.match(f.ui.render(course),new RegExp(`>${title}</a>`));
  }
  assert.match(f.ui.render(course),/data-rd-field="hub-own-url"[^>]*value=""/);
  f.ui.input('hub-own-url','https://example.com/notes',info);f.ui.input('hub-own-title','Personal notes',info);await f.ui.handle('hub-own-save-link',info);
  assert.equal(f.files.list('7').at(-1).title,'Personal notes');assert.equal(f.files.list('8').length,0);
});

test('multi-file input sends one selected collection and labels document, text and image rows',async()=>{
  const f=setup();f.ui.handle('hub-own-add',hub);
  const selected=['Lab.pdf','Essay.docx','Lecture.pptx','Marks.xlsx','Notes.txt','Diagram.png'].map(name=>({name,size:50}));
  const markup=f.ui.render(course,{place:'hub'});assert.match(markup,/type="file"[^>]* multiple accept="[^"\n]*\.pdf[^"\n]*\.docx[^"\n]*\.pptx[^"\n]*\.xlsx[^"\n]*\.txt[^"\n]*\.png/);
  f.ui.input('hub-own-files','C:\\fakepath\\Lab.pdf',hub);assert.equal(f.calls.length,0,'a file input string is not an upload');
  await f.ui.input('hub-own-files',selected,hub);assert.deepEqual(f.calls[0],['addFiles','7',selected]);
  const rows=f.ui.render(course,{place:'hub'});for(const kind of ['PDF','Word','PowerPoint','Excel','Text','Image'])assert.match(rows,new RegExp(`ch-links-kind">${kind}</span>`));
  assert.equal(f.files.list('7').length,6);
});

test('rename saves inline and remove requires its inline confirmation',async()=>{
  const f=setup({'7':[file()]}),row={...info,file:'cf-file1'};
  f.ui.handle('hub-own-rename',row);f.ui.input('hub-own-name','Exam <review>',row);
  assert.match(f.ui.render(course),/value="Exam &lt;review&gt;"/);assert.equal(f.files.list('7')[0].title,'Lab');
  await f.ui.handle('hub-own-save-name',row);assert.equal(f.files.list('7')[0].title,'Exam <review>');assert.doesNotMatch(f.ui.render(course),/data-rd-field="hub-own-name"/);
  f.ui.handle('hub-own-remove',row);assert.equal(f.files.list('7').length,1);assert.match(f.ui.render(course),/Remove\?/);
  f.ui.handle('hub-own-cancel-row',row);assert.equal(f.files.list('7').length,1);
  f.ui.handle('hub-own-remove',row);await f.ui.handle('hub-own-confirm-remove',row);assert.equal(f.files.list('7').length,0);
  assert.deepEqual(f.calls.map(call=>call[0]),['rename','remove']);
});

test('operation and limit errors remain escaped and scoped to their course and placement',async()=>{
  const f=setup();f.ui.handle('hub-own-add',info);f.ui.input('hub-own-title','Keep this draft',info);f.error='A course holds up to 60 links and files. <limit>';
  await f.ui.handle('hub-own-save-link',info);const html=f.ui.render(course);
  assert.match(html,/role="alert">A course holds up to 60 links and files\. &lt;limit&gt;/);assert.match(html,/value="Keep this draft"/);
  assert.doesNotMatch(f.ui.render(course,{place:'hub'}),/limit/);assert.doesNotMatch(f.ui.render({id:'8'}),/limit|Keep this draft/);
  f.error='';f.ui.input('hub-own-url','https://docs.google.com/document/d/notes',info);await f.ui.handle('hub-own-save-link',info);
  assert.doesNotMatch(f.ui.render(course),/role="alert"/);assert.equal(f.files.list('7').length,1);
});

test('pending changes block duplicate writes, keep results in the original course and stop publishing after destroy',async()=>{
  const f=setup();let release;f.before=()=>new Promise(resolve=>{release=resolve;});
  f.ui.handle('hub-own-add',info);f.ui.input('hub-own-url','https://docs.google.com/document/d/a',info);
  const pending=f.ui.handle('hub-own-save-link',info);f.ui.handle('hub-own-save-link',info);assert.equal(f.calls.length,1);
  assert.match(f.ui.render(course),/aria-busy="true"/);assert.doesNotMatch(f.ui.render({id:'8'}),/Google Doc/);
  const changes=f.changes;f.ui.destroy();release();await pending;
  assert.equal(f.changes,changes);assert.equal(f.ui.render(course),'');
  f.ui.handle('hub-own-add',info);f.ui.input('hub-own-url','https://example.com',info);assert.equal(f.ui.takeFocusRequest(),null);
  await f.ui.input('hub-own-files',[{name:'Late.pdf',size:1}],info);await f.ui.handle('hub-own-open',{...info,file:'cf-added1'});
  assert.equal(f.calls.length,1);assert.equal(f.opens.length,0);assert.equal(f.changes,changes);
  const other=setup();assert.doesNotMatch(other.ui.render(course),/aria-label="Add a link or files"|Google Doc/);
});

test('PDF open delegates only matching saved files to the shared reader callback',async()=>{
  const f=setup({'7':[file(),link()]});
  await f.ui.handle('hub-own-open',{...hub,file:'cf-file1'});assert.deepEqual(f.opens,[['7','cf-file1']]);
  await f.ui.handle('hub-own-open',{...hub,file:'cf-link1'});await f.ui.handle('hub-own-open',{course:'8',place:'hub',file:'cf-file1'});assert.equal(f.opens.length,1);
  f.error='The file could not be opened.';await f.ui.handle('hub-own-open',{...hub,file:'cf-file1'});assert.match(f.ui.render(course,{place:'hub'}),/role="alert">The file could not be opened\./);
});

test('Enter saves the active inline edit and Escape cancels its own placement',async()=>{
  const f=setup({'7':[file()]}),row={...info,file:'cf-file1'};let prevented=0;
  f.ui.handle('hub-own-rename',row);f.ui.input('hub-own-name','Renamed',row);
  assert.equal(f.ui.keydown({key:'Enter',target:{dataset:{...row,rdField:'hub-own-name'}},preventDefault:()=>prevented++}),true);
  await new Promise(setImmediate);assert.equal(f.files.list('7')[0].title,'Renamed');
  f.ui.handle('hub-own-add',hub);assert.equal(f.ui.keydown({key:'Escape',target:{dataset:{...hub,rdField:'hub-own-url'}},preventDefault:()=>prevented++}),true);
  assert.doesNotMatch(f.ui.render(course,{place:'hub'}),/aria-label="Add a link or files"/);assert.equal(prevented,2);
  assert.equal(f.ui.keydown({key:'Enter',isComposing:true,target:{dataset:{...info,rdField:'hub-own-title'}},preventDefault:()=>prevented++}),false);
});

test('course information and hub place the controller after documents and announcements and forward its events',()=>{
  const calls=[],context={ReserveSite:require('../extension/site.js'),URL,Map,Set,Date,AbortController,ReserveUI:require('../extension/ui-utils.js'),ReserveMaterials:require('../extension/material-model.js'),ReserveCourseHubModel:require('../extension/course-hub-model.js')};
  vm.runInNewContext(fs.readFileSync(require.resolve('../extension/course-hub-ui.js'),'utf8'),context);
  const ownFiles={render:(selected,{place})=>`<section data-own-place="${place}">Own files ${selected.id}</section>`,handle:(...args)=>calls.push(['handle',...args]),input:(...args)=>calls.push(['input',...args]),keydown:()=>true,takeFocusRequest:()=>({type:'own',courseId:'7',place:'hub',field:'hub-own-url'}),destroy:()=>calls.push(['destroy'])};
  const hubUI=context.ReserveCourseHubUI.create({store:{owner:{origin:'https://school.instructure.com',accountId:'5'},get:()=>({resourcePins:[]})},ownFiles});
  const deck=hubUI.renderDeck(course),full=hubUI.renderHub(course);
  assert.ok(deck.indexOf('data-own-place="info"')>deck.indexOf('More course documents'));assert.ok(full.indexOf('data-own-place="hub"')>full.indexOf('Recent announcements'));
  hubUI.handle('hub-own-add',hub);hubUI.input('hub-own-url','draft',hub);assert.equal(hubUI.keydown({}),true);assert.equal(hubUI.takeFocusRequest().place,'hub');
  assert.deepEqual(calls,[['handle','hub-own-add',hub],['input','hub-own-url','draft',hub]]);hubUI.destroy();assert.equal(calls.at(-1)[0],'destroy');
  hubUI.handle('hub-own-add',hub);assert.equal(calls.length,3);
});

test('keyboard edits use the original input when document events are retargeted by the shadow root',async()=>{
  const f=setup(),target={dataset:{...info,rdField:'hub-own-url'}};let prevented=0;
  f.ui.handle('hub-own-add',info);f.ui.input('hub-own-url','https://example.com/notes',info);
  assert.equal(f.ui.keydown({key:'Enter',target:{dataset:{}},composedPath:()=>[target],preventDefault:()=>prevented++}),true);
  await new Promise(setImmediate);assert.equal(f.files.list('7').length,1);assert.equal(prevented,1);
});
