'use strict';
// Start a Google Doc beside an assignment: the new-document link, the header copied for its top, and where the button
// sits. All course and assignment data here is fictional.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../extension/site.js');require('../extension/ui-utils.js');require('../extension/icons.js');require('../extension/core.js');
const C=require('../extension/ai-context.js');require('../extension/views.js');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const ORIGIN='https://school.instructure.com';
const item={id:'77',courseId:'10',name:'Lab  report 3',courseName:'Chemistry',url:ORIGIN+'/courses/10/assignments/77?module_item_id=5#top',dueAt:'2026-10-24T23:59:00Z',state:'unsubmitted',points:20,description:'',rubric:[]};

test('the new doc is Google Docs\' own new-document page, named for the course and the assignment',()=>{
 const doc=C.googleDoc(item,{origin:ORIGIN});
 assert.equal(doc.name,'Chemistry — Lab report 3','spaces are tidied');
 assert.equal(doc.href,'https://docs.google.com/document/create?title=Chemistry%20%E2%80%94%20Lab%20report%203');
 assert.equal(new URL(doc.href).searchParams.get('title'),doc.name,'only the name travels in the address');
 assert.equal(C.googleDoc({...item,courseName:''},{origin:ORIGIN}).name,'Lab report 3');assert.equal(C.googleDoc({},{}).name,'Assignment');
 assert.ok(C.googleDoc({...item,name:'x'.repeat(400),courseName:'y'.repeat(300)},{origin:ORIGIN}).name.length<=80+3+160,'long names are cut');
});
test('the header names the assignment, course, due date and Canvas link, then the instructions',()=>{
 const doc=C.googleDoc(item,{origin:ORIGIN,html:'<p>Write <strong>two</strong> pages.</p><ul><li>Hypothesis</li></ul>',due:'Due Fri, Oct 24 at 11:59 PM'});
 assert.equal(doc.text,'Lab report 3\n\nChemistry · Due Fri, Oct 24 at 11:59 PM · '+ORIGIN+'/courses/10/assignments/77\n\nInstructions\nWrite two pages.\n\nHypothesis');
 assert.match(doc.html,/^<h1>Lab report 3<\/h1><p>Chemistry · Due Fri, Oct 24 at 11:59 PM · <a href="https:\/\/school\.instructure\.com\/courses\/10\/assignments\/77">Open in Canvas<\/a><\/p><h2>Instructions<\/h2><p>Write <strong>two<\/strong> pages\.<\/p>/);
 assert.doesNotMatch(doc.text+doc.html,/module_item_id|#top/,'the link loses its query and fragment');
 const bare=C.googleDoc(item,{origin:ORIGIN});assert.doesNotMatch(bare.text+bare.html,/Instructions/,'no empty instructions heading');
});
test('names are escaped in the header, and a link to another site or scheme is left out',()=>{
 const doc=C.googleDoc({...item,name:'<img src=x onerror=alert(1)>',courseName:'A & "B"'},{origin:ORIGIN});
 assert.doesNotMatch(doc.html,/<img/);assert.match(doc.html,/A &#38; &#34;B&#34;|A &amp; &quot;B&quot;/);
 for(const url of ['javascript:alert(1)','https://user:pw@school.instructure.com/x'])assert.doesNotMatch(C.googleDoc({...item,url},{origin:ORIGIN}).html,/<a /);
});
test('the header is copied inside the click: a filled copy event first, both kinds at once',async()=>{
 const doc={text:'plain header',html:'<h1>header</h1>'},listeners=new Set(),data={};
 const document={addEventListener(type,fn){if(type==='copy')listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);},
  execCommand(name){assert.equal(name,'copy');const event={clipboardData:{setData:(type,value)=>{data[type]=value;}},preventDefault(){this.prevented=true;}};for(const fn of listeners)fn(event);return event.prevented===true;}};
 const result=C.copyDoc(doc,{document,navigator:{clipboard:{write:()=>{throw Error('async clipboard must not be used');}}}});
 assert.deepEqual(data,{'text/html':'<h1>header</h1>','text/plain':'plain header'},'filled before copyDoc returns');assert.equal(listeners.size,0,'the one-shot listener is removed');
 assert.equal(await result,true);
});
test('when the copy event is refused, the async clipboard is chosen up front and is not retried after the tab takes focus',async()=>{
 class Blob{constructor(parts,{type}){this.text=parts.join('');this.type=type;}}
 class ClipboardItem{constructor(types){this.types=types;}}
 const doc={text:'plain header',html:'<h1>header</h1>'},refused={addEventListener(){},removeEventListener(){},execCommand:()=>false};
 const calls=[];assert.equal(await C.copyDoc(doc,{document:refused,ClipboardItem,Blob,navigator:{clipboard:{write:async items=>{calls.push(items);}}}}),true);
 const [[copied]]=calls;assert.deepEqual(Object.keys(copied.types).sort(),['text/html','text/plain']);assert.equal(copied.types['text/html'].text,'<h1>header</h1>');
 // The new tab takes focus right after the click: the queued write is refused, and plain text is not tried again then.
 let blurred=false,plainTries=0;const later={write:()=>new Promise((_,no)=>setTimeout(()=>{blurred=true;no(Error('Document is not focused'));},0)),writeText:async()=>{plainTries++;if(blurred)throw Error('Document is not focused');}};
 assert.equal(await C.copyDoc(doc,{document:refused,ClipboardItem,Blob,navigator:{clipboard:later}}),false,'the note then says the header could not be copied');assert.equal(plainTries,0);
 let plain='';assert.equal(await C.copyDoc(doc,{document:refused,navigator:{clipboard:{writeText:async t=>{plain=t;}}}}),true,'no ClipboardItem: plain text');assert.equal(plain,'plain header');
 assert.equal(await C.copyDoc(doc,{navigator:{}}),false,'no clipboard at all');
});
test('the copy keeps attachment-only links and turns equations back into TeX',()=>{
 const doc=C.googleDoc(item,{origin:ORIGIN,html:'<p>Read this first.</p><p><a href="https://school.instructure.com/courses/10/files/9">Lab handout.pdf</a></p><p>Rate <math class="rd-math" aria-label="k"><semantics><mi>k</mi><annotation encoding="application/x-tex">k = A e^{-E_a/RT} &lt; 1</annotation></semantics></math>.</p><math display="block"><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math>'});
 assert.match(doc.html,/<a href="https:\/\/school\.instructure\.com\/courses\/10\/files\/9">Lab handout\.pdf<\/a>/);assert.match(doc.text,/Lab handout\.pdf/);
 assert.match(doc.html,/Rate \\\(k = A e\^\{-E_a\/RT\} &lt; 1\\\)\./);assert.match(doc.text,/Rate \\\(k = A e\^\{-E_a\/RT\} < 1\\\)\./);assert.match(doc.text,/\\\[x\^2\\\]/);assert.doesNotMatch(doc.html,/<math|<annotation/);
 // Both entry points build the header from the description itself, not from the reader's trimmed copy.
 const dash=read('dashboard.js'),app=read('app.js'),start=dash.slice(dash.indexOf('function startDoc('),dash.indexOf('function onAuxClick('));
 assert.match(start,/html:item\.description\?U\.safeRichHTML\(item\.description\):''/);assert.doesNotMatch(start,/readingContent/);assert.match(app,/html:item\.description\?U\.safeRichHTML\(item\.description\):''/);
});
test('the doc has the same name from the reader and the Planner: the course as the student sees it',()=>{
 const view=read('dashboard-view.js'),dash=read('dashboard.js'),views=read('views.js');
 assert.match(view,/function docButton\(item,course\)\{const doc=Context\(\)\?\.googleDoc\?\.\(item,\{courseName:short\(course\)\}\)/);assert.match(view,/const short=course=>course\?\.shortName\|\|course\?\.name\|\|''/);
 assert.match(dash,/courseName:course\?\.shortName\|\|course\?\.name/);assert.match(views,/googleDoc\?\.\(item,\{courseName:cname\(c\.course\(item\.courseId\)\)\}\)/);assert.match(views,/const cname=course=>course\?\.shortName\|\|course\?\.name\|\|''/);
});

test('the Planner\'s assignment drawer offers Start a Google Doc next to Open in Canvas, not for personal tasks',()=>{
 const c={local:{},settings:{},course:()=>({id:'10',name:'Chemistry 101',shortName:'Chemistry',color:'#2a6f97'}),date:()=>'Fri, Oct 24, 11:59 PM',complete:()=>false};
 const html=globalThis.ReserveViews.drawer(c,item),link=/<a class="button" data-doc-id="77" href="([^"]+)" target="_blank" rel="noopener noreferrer"[^>]*>[\s\S]*?Start a Google Doc<\/a>/.exec(html);
 assert.ok(link,'the drawer has the doc link');assert.equal(new URL(link[1].replaceAll('&amp;','&')).searchParams.get('title'),'Chemistry — Lab report 3');
 assert.ok(html.indexOf('Open in Canvas')<html.indexOf('Start a Google Doc'),'it follows Open in Canvas');
 assert.doesNotMatch(globalThis.ReserveViews.drawer(c,{...item,id:'local-1'}),/Start a Google Doc/);
});
test('the doc opens through its own link in both views: the click copies the header and never cancels the link',()=>{
 const view=read('dashboard-view.js'),dash=read('dashboard.js'),app=read('app.js');
 assert.match(view,/\$\{icon\('external'\)\}<\/a>\$\{docButton\(item,course\)\}\$\{checkButton\(item,true\)\}/,'reader: right after Open in Canvas');
 assert.match(view,/data-rd-action="google-doc" data-id="\$\{E\(item\.id\)\}" href="\$\{E\(doc\.href\)\}" target="_blank" rel="noopener noreferrer"/);
 assert.match(dash,/if\(action==='google-doc'\)\{startDoc\(String\(button\.dataset\.id\)\);return;\}/);
 const handler=dash.slice(dash.indexOf('function startDoc('),dash.indexOf('function onAuxClick('));
 assert.ok(handler.length>0);assert.doesNotMatch(handler,/preventDefault|await /,'the link is followed, and the copy starts inside the click');assert.match(handler,/Context\.copyDoc\(doc\)/);
 assert.match(dash,/function onAuxClick\(event\)\{if\(event\.button!==1\)return;const link=event\.target\.closest\?\.\('\[data-rd-action="google-doc"\]'\);if\(link\)startDoc/,'a middle click copies too');
 assert.match(dash,/container\.addEventListener\('auxclick',onAuxClick\)/);assert.match(dash,/container\.removeEventListener\('auxclick',onAuxClick\)/);
 assert.match(app,/function auxClicked\(event\)\{if\(event\.button!==1\)return;const doc=event\.target\.closest\('\[data-doc-id\]'\);if\(doc\)startDoc/);assert.match(app,/container\.addEventListener\('auxclick',auxClicked\)/);
 assert.match(app,/async function clicked\(event\)\{const doc=event\.target\.closest\('\[data-doc-id\]'\);if\(doc\)\{startDoc\(doc\.dataset\.docId\);return;\}/,'drawer: handled before data-action, which prevents defaults');
 const start=app.slice(app.indexOf('function startDoc('),app.indexOf('async function clicked('));assert.doesNotMatch(start,/preventDefault|await /);
});
test('Canvas Harness asks for no new permission and talks to no Google API',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 // scripts/check.cjs pins the exact permission list; this feature adds no sign-in and no Google host to it.
 assert.ok(!manifest.permissions.includes('identity'));assert.equal(manifest.oauth2,undefined,'no Google sign-in');assert.doesNotMatch(JSON.stringify(manifest),/googleapis\.com|docs\.google\.com|"identity"/,'no Google API or Docs host');
 for(const file of ['ai-context.js','dashboard.js','app.js','views.js','dashboard-view.js'])assert.doesNotMatch(read(file),/googleapis\.com|identity\.getAuthToken/,file);
});
