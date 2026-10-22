const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const UI=require('../extension/ui-utils.js'),Materials=require('../extension/material-model.js');
test('topbar puts the shared banner and title before the course strip; sidebar keeps it in the workspace',async t=>{
 const {fixture}=require('./dashboard-heading-fixture.cjs'),f=fixture();t.after(()=>f.dashboard.destroy());
 await f.store.update(data=>{data.settings.courseNavigation='topbar';});
 const shell=f.container.querySelector('.rd-shell'),heading=f.container.querySelector('.rd-workspace-heading'),workspace=f.container.querySelector('.rd-workspace');
 assert.ok(shell.firstElementChild===heading);assert.ok(heading.querySelector('h1'));assert.notEqual(shell.children[1],workspace);
 await f.store.update(data=>{data.settings.courseNavigation='sidebar';});
 assert.ok(f.container.querySelector('.rd-workspace').firstElementChild===f.container.querySelector('.rd-workspace-heading'));
});
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const decode=value=>String(value).replace(/&(?:amp|quot|lt|gt|#39);/g,entity=>({'&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&#39;':"'"}[entity]));
const anchors=html=>[...html.matchAll(/<a\b[^>]*>/g)].map(m=>attrs(m[0]));
async function materials(raw){
 const catalog={origin:'https://school.instructure.com',accountId:'5',courseId:'7',modules:[],pages:[],files:[],errors:[],fetchedAt:new Date().toISOString(),...raw};
 const store={owner:{origin:catalog.origin,accountId:'5'},get:()=>({resourcePins:[]})};
 const context={ReserveSite:{...require('../extension/site.js'),origin:()=> 'https://school.instructure.com'},URL,Date,Map,Set,AbortController,ReserveUI:UI,ReserveMaterials:Materials};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/materials-ui.js'),'utf8'),context);
 const ui=context.ReserveMaterialsUI.create({store,client:{loadCourseResources:async()=>catalog}});await ui.load('7');
 const html=ui.renderLibrary({id:'7',name:'Chemistry'});ui.destroy();return html;
}
test('PDF Materials links use the actual file content ID and preserve fallback anchors and actions',async()=>{
 const html=await materials({modules:[{id:10,name:'Unit 1',items:[{id:11,type:'File',content_id:21,title:'Gas worksheet.PDF',html_url:'/courses/7/files/21?download=1'},{id:12,type:'File',content_id:22,title:'Gas notes.docx',html_url:'/courses/7/files/22'},{id:13,type:'Page',content_id:23,page_url:'lesson',title:'Lesson.pdf',html_url:'/courses/7/pages/lesson'},{id:14,type:'File',title:'Unknown.pdf',html_url:'/courses/7/modules/items/14'},{id:15,type:'File',content_id:'bad-id',title:'Invalid.pdf',html_url:'/courses/7/modules/items/15'}]}]});
 const links=anchors(html),pdf=links.find(a=>a.href==='https://school.instructure.com/courses/7/files/21?download=1');
 assert.deepEqual([pdf['data-pdf-file-id'],pdf['data-pdf-course-id'],pdf['data-pdf-name'],pdf['data-pdf-mime']],['21','7','Gas worksheet.PDF','application/pdf']);
 assert.equal(pdf.target,'_blank');assert.equal(pdf.rel,'noopener noreferrer');assert.equal(pdf.class,'rd-row-open');
 assert.equal(links.filter(a=>a['data-pdf-file-id']).length,1);
 assert.match(html,/data-rd-action="material-read" data-resource="module:10:13" data-course="7"/);
 assert.match(html,/data-rd-action="material-capture" data-resource="module:10:11" data-course="7"/);
 assert.match(html,/data-rd-action="material-pin" data-resource="module:10:11" data-course="7"/);
 assert.doesNotMatch(html,/<(?:li|button)\b[^>]*data-pdf-/);
});
test('PDF Materials recognize matching file metadata without classifying unrelated files or entities',async()=>{
 const html=await materials({modules:[{id:10,name:'Unit 1',items:[{id:11,type:'File',content_id:31,title:'Teacher handout',html_url:'/courses/7/files/31'},{id:12,type:'Assignment',content_id:34,title:'Assignment.pdf',html_url:'/courses/7/assignments/34'}]}],files:[{id:31,display_name:'Teacher handout',filename:'Original handout.pdf'},{id:32,display_name:'Reading',filename:'reading', 'content-type':'application/pdf'},{id:33,display_name:'Workbook',filename:'workbook.docx','content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}]});
 const links=anchors(html),pdfs=links.filter(a=>a['data-pdf-file-id']);assert.equal(pdfs.length,2);
 assert.equal(pdfs.find(a=>a['data-pdf-file-id']==='31')['data-pdf-name'],'Original handout.pdf');
 assert.equal(pdfs.find(a=>a['data-pdf-file-id']==='32')['data-pdf-name'],'reading');
});
test('PDF answer keys retain their separate file identity and URL',async()=>{
 const html=await materials({files:[{id:41,display_name:'Gas worksheet.pdf'},{id:42,display_name:'Gas worksheet answer key.pdf'}]});
 const key=anchors(html).find(a=>a.class==='rd-row-key');assert.ok(key,'worksheet answer key remains a secondary link');
 assert.equal(key['data-pdf-file-id'],'42');assert.equal(key['data-pdf-course-id'],'7');assert.equal(key.href,'https://school.instructure.com/courses/7/files/42');assert.equal(key.target,'_blank');
});
function dashboard(description,courseId='7'){
 const events={},element={dataset:{},style:{setProperty(){}},setAttribute(){},addEventListener:(k,v)=>events[k]=v,removeEventListener(){},querySelector:()=>null,remove(){},innerHTML:''};
 const template=()=>{let html='',nodes=[];return {set innerHTML(value){html=value;nodes=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m=>{const values=Object.fromEntries(Object.entries(attrs(m[1])).map(([key,value])=>[key,decode(value)]));if(/(?:^|\s)download(?:\s|=|$)/i.test(m[1])&&!Object.hasOwn(values,'download'))values.download='';return {index:m.index,end:m.index+m[0].length,inside:m[2],values,getAttribute:name=>values[name]??null,hasAttribute:name=>Object.hasOwn(values,name),setAttribute:(name,value)=>values[name]=String(value),textContent:decode(m[2].replace(/<[^>]+>/g,''))};});},get innerHTML(){let cursor=0,out='';for(const node of nodes){out+=html.slice(cursor,node.index)+'<a '+Object.entries(node.values).map(([key,value])=>key+'="'+UI.escapeHTML(value)+'"').join(' ')+'>'+node.inside+'</a>';cursor=node.end;}return out+html.slice(cursor);},content:{querySelectorAll:selector=>selector==='a[href]'?nodes:[]}};};
 const store={owner:{origin:'https://school.instructure.com',accountId:'5'},get:()=>({settings:{theme:'light'},tasks:{}}),subscribe:()=>()=>{}};
 const context={ReserveSite:{...require('../extension/site.js'),origin:()=> 'https://school.instructure.com'},URL,Intl,Date,Map,Set,matchMedia:()=>({matches:false}),document:{createElement:tag=>tag==='template'?template():element,addEventListener(){},removeEventListener(){}},setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},ReserveUI:{...UI,safeRichHTML:value=>value.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/g,(_,tag,text)=>{const url=UI.safeURL(decode(attrs(tag).href));return url==='#'?text:`<a href="${UI.escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;})},ReserveCore:require('../extension/core.js'),ReserveDashboardModel:require('../extension/dashboard-model.js'),ReserveWorkModel:require('../extension/work-model.js'),ReserveSettingsDock:require('../extension/settings-dock.js'),ReserveDashboardView:require('../extension/dashboard-view.js')};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/dashboard.js'),'utf8'),context);
 const snapshot={courses:[{id:courseId,name:'Chemistry'}],assignments:[{id:'17',course_id:courseId,name:'Gas laws',description,due_at:new Date(Date.now()+86400000).toISOString(),submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}}]};
 const view=context.ReserveDashboard.mount({append(){}},{snapshot,store,initialState:{workspace:'work',courseId,selectedId:'17',readerOpen:true}});
 const html=element.innerHTML;view.destroy();return html;
}
test('Linked materials annotate canonical same-origin PDF file URLs with exact file and course context',()=>{
 const html=dashboard('<a href="https://school.instructure.com/files/51/download?download_frd=1">Lab "notes".pdf</a><a href="https://school.instructure.com/courses/8/files/52/preview">Other.PDF</a>');
 const section=html.match(/<section class="rd-resources">[\s\S]*?<\/section>/)?.[0];assert.ok(section,'assignment reader renders linked materials');
 const links=anchors(section);assert.equal(links.length,2);
 assert.deepEqual([links[0]['data-pdf-file-id'],links[0]['data-pdf-course-id'],links[0]['data-pdf-name']],['51','7','Lab &quot;notes&quot;.pdf']);
 assert.equal(links[0].href,'https://school.instructure.com/files/51/download?download_frd=1');assert.equal(links[0].target,'_blank');assert.equal(links[0].rel,'noopener noreferrer');
 assert.equal(links[1]['data-pdf-file-id'],'52');assert.equal(links[1]['data-pdf-course-id'],'8');
});
test('Linked materials preserve external, non-PDF, module and invalid file links without PDF annotations',()=>{
 const html=dashboard('<a href="https://example.com/files/51">External.pdf</a><a href="https://school.instructure.com/files/52">Notes.docx</a><a href="https://school.instructure.com/courses/7/modules/items/53">Module.pdf</a><a href="https://school.instructure.com/courses/7/assignments/54">Assignment.pdf</a><a href="https://school.instructure.com/files/55/other">Invalid.pdf</a><a href="https://user@school.instructure.com/files/56">Credential.pdf</a>');
 const section=html.match(/<section class="rd-resources">[\s\S]*?<\/section>/)?.[0];assert.ok(section);assert.doesNotMatch(section,/data-pdf-/);
 const links=anchors(section);assert.equal(links.length,5);assert.ok(links.every(a=>a.target==='_blank'&&a.rel==='noopener noreferrer'));
 assert.equal(links[0].href,'https://example.com/files/51');
});

test('Linked materials preserve detached filename, title, aria-label and MIME evidence behind Read labels',()=>{
 const html=dashboard('<a href="/files/61" title="Handout.pdf" data-pdf-file-id="999" data-pdf-course-id="999">Read</a><a href="https://school.instructure.com/courses/8/files/62" aria-label="Class notes.PDF">Read</a><a href="https://school.instructure.com/files/63" data-filename="Lab.pdf">Read</a><a href="https://school.instructure.com/files/64" type="application/pdf">Read</a><a href="https://school.instructure.com/files/65" data-content-type="application/pdf; charset=binary">Read</a><a href="https://example.com/files/66" title="External.pdf">Read</a>');
 const section=html.match(/<section class="rd-resources">[\s\S]*?<\/section>/)?.[0],links=anchors(section);assert.equal(links.length,6);
 assert.deepEqual(links.slice(0,5).map(a=>a['data-pdf-file-id']),['61','62','63','64','65']);
 assert.deepEqual(links.slice(0,3).map(a=>a['data-pdf-name']),['Handout.pdf','Class notes.PDF','Lab.pdf']);
 assert.equal(links[0]['data-pdf-course-id'],'7');assert.equal(links[1]['data-pdf-course-id'],'8');assert.equal(links[5]['data-pdf-file-id'],undefined);
 assert.equal((section.match(/<span>Read<\/span>/g)||[]).length,6,'original labels remain visible');assert.doesNotMatch(section,/data-filename=|data-content-type=|data-pdf-file-id="999"|aria-label=/);
});
test('Linked materials retain explicit source download intent after sanitization',()=>{
 const html=dashboard('<a href="https://school.instructure.com/files/71" download="Handout.pdf">Read</a><a href="https://school.instructure.com/files/72" download title="Notes.pdf">Read</a><a href="https://school.instructure.com/files/73" title="Lab.pdf" aria-label="Download Lab.pdf">Read</a><a href="https://school.instructure.com/files/74" class="file_download_link" title="More.pdf">Read</a><a href="https://school.instructure.com/files/75">Download notes.pdf</a>');
 const section=html.match(/<section class="rd-resources">[\s\S]*?<\/section>/)?.[0],links=anchors(section);assert.equal(links.length,5);assert.ok(links.every(a=>a['data-pdf-download']==='true'));
 assert.deepEqual(links.map(a=>a['data-pdf-file-id']),['71','72','73','74','75']);assert.ok(links.every(a=>a.target==='_blank'&&a.rel==='noopener noreferrer'));
 assert.equal(links[0]['data-pdf-name'],'Handout.pdf');assert.equal((section.match(/<span>Read<\/span>/g)||[]).length,4);assert.doesNotMatch(section,/ download(?:=|\s|>)|class="file_download_link"/);
});
test('Linked materials keep filename links with download queries eligible and preserve the first duplicate intent',()=>{
 const html=dashboard('<a href="https://school.instructure.com/files/81?download=1">Handout.pdf</a><a href="https://school.instructure.com/files/82" title="Class.pdf">Read</a><a href="https://school.instructure.com/files/82" download>Download</a><a href="https://school.instructure.com/files/83" download="Other.pdf">Read</a><a href="https://school.instructure.com/files/83">Other.pdf</a>');
 const section=html.match(/<section class="rd-resources">[\s\S]*?<\/section>/)?.[0],links=anchors(section);assert.equal(links.length,3);
 assert.equal(links[0].href,'https://school.instructure.com/files/81?download=1');assert.equal(links[0]['data-pdf-file-id'],'81');assert.equal(links[0]['data-pdf-download'],undefined);
 assert.equal(links[1]['data-pdf-file-id'],'82');assert.equal(links[1]['data-pdf-download'],undefined);assert.equal(links[2]['data-pdf-download'],'true');
});

test('inline sanitized PDF anchors retain invisible identity and explicit download evidence',()=>{
 const html=dashboard('<p>Please <a href="/courses/8/files/91?download=1" title="Lab &quot;one&quot;.pdf" data-pdf-file-id="999" data-pdf-course-id="999">Read</a> and <a href="/files/92" download="Notes.pdf">save this copy</a> before class.</p>');
 const inline=html.match(/<section class="rd-instructions"[\s\S]*?<\/section>/)?.[0];assert.ok(inline,'paragraph with surrounding text remains in the instructions');
 const links=anchors(inline);assert.equal(links.length,2);
 assert.deepEqual([links[0]['data-pdf-file-id'],links[0]['data-pdf-course-id'],links[0]['data-pdf-name'],links[0]['data-pdf-mime']],['91','8','Lab &quot;one&quot;.pdf','application/pdf']);
 assert.equal(links[0].href,'https://school.instructure.com/courses/8/files/91?download=1');assert.equal(links[0]['data-pdf-download'],undefined);
 assert.deepEqual([links[1]['data-pdf-file-id'],links[1]['data-pdf-course-id'],links[1]['data-pdf-name'],links[1]['data-pdf-download']],['92','7','Notes.pdf','true']);
 assert.ok(links.every(a=>a.target==='_blank'&&a.rel==='noopener noreferrer'));assert.match(inline,/>Read<\/a> and <a[^>]*>save this copy<\/a> before class/);
 assert.doesNotMatch(inline,/data-pdf-file-id="999"|data-pdf-course-id="999"| download=| title=/);
});
test('inline repeated file URLs preserve each download occurrence while the summary keeps its first occurrence',()=>{
 const html=dashboard('<p>First <a href="/files/93" title="First.pdf">Read</a>, then <a href="https://school.instructure.com/files/93" download="Second.pdf">Save</a>, then <a href="/files/93" data-filename="Third.pdf">Read again</a>.</p><p>Also <a href="/files/94" download="Other.pdf">Save first</a> and <a href="/files/94" title="Other.pdf">Read later</a>.</p>');
 const inline=anchors(html.match(/<section class="rd-instructions"[\s\S]*?<\/section>/)?.[0]),summary=anchors(html.match(/<section class="rd-resources">[\s\S]*?<\/section>/)?.[0]);
 assert.equal(inline.length,5);assert.deepEqual(inline.map(a=>a['data-pdf-file-id']),['93','93','93','94','94']);
 assert.deepEqual(inline.map(a=>a['data-pdf-download']),[undefined,'true',undefined,'true',undefined]);
 assert.deepEqual(inline.slice(0,3).map(a=>a['data-pdf-name']),['First.pdf','Second.pdf','Third.pdf']);
 assert.equal(summary.length,2);assert.equal(summary[0]['data-pdf-name'],'First.pdf');assert.equal(summary[0]['data-pdf-download'],undefined);assert.equal(summary[1]['data-pdf-download'],'true');
});
test('inline PDF evidence is applied after the twelve-link summary limit without annotating unrelated identities',()=>{
 const first=Array.from({length:12},(_,i)=>'<a href="https://example.com/'+i+'">Reference '+i+'</a>').join(' ');
 const html=dashboard('<p>'+first+' and <a href="/files/95" class="file_download_link" title="Late.pdf">Read</a>, <a href="https://example.com/files/96" data-pdf-file-id="96" title="External.pdf">Read external</a> and <a href="/courses/7/assignments/97" title="Assignment.pdf" data-pdf-file-id="97">Read assignment</a>.</p>');
 const inline=anchors(html.match(/<section class="rd-instructions"[\s\S]*?<\/section>/)?.[0]),summary=anchors(html.match(/<section class="rd-resources">[\s\S]*?<\/section>/)?.[0]);
 assert.equal(summary.length,12);assert.equal(inline.length,15);assert.equal(inline[12]['data-pdf-file-id'],'95');assert.equal(inline[12]['data-pdf-download'],'true');
 assert.equal(inline[13]['data-pdf-file-id'],undefined);assert.equal(inline[14]['data-pdf-file-id'],undefined);
});
