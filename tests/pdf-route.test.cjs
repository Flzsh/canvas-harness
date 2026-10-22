'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Host=require('../extension/pdf-host.js'),Model=require('../extension/pdf-model.js');
const canvas='https://school.instructure.com',routes=['/','/dashboard','/dashboard/','/courses/7','/courses/7/','/courses/7/assignments/12','/courses/7/assignments/12/submissions/new','/courses/7/files','/courses/7/files/folder/Readings','/courses/7/files/42','/courses/7/files/42/preview','/files/42','/files/42/preview','/courses/7/modules','/courses/7/modules/items/123','/courses/7/pages','/courses/7/pages/reading','/courses/7/announcements','/courses/7/announcements/9','/courses/7/discussion_topics','/courses/7/discussion_topics/9','/courses/7/assignments/syllabus'];
test('Canvas Harness registers the dormant PDF host on Canvas reading routes, never other sites or disabled features',async()=>{
 const site=require('../extension/site.js');
 for(const href of [...routes.map(route=>canvas+route),'https://other.instructure.com/courses/7/files/42','https://canvas.my-school.edu/courses/7/files/42','http://school.instructure.com/courses/7/files/42',canvas+'/profile',canvas+'/courses/7/grades',canvas+'/courses/7/files-other',canvas+'/dashboard/other'])for(const disabled of [false,true]){
  let listeners=0;
  const document={addEventListener(type){assert.equal(type,'click');listeners++;},removeEventListener(){listeners--;}};
  const host=Host.create({root:{document,location:new URL(href),ReserveSite:site,ReservePdfModel:Model,ReserveFeatures:{enabled:()=>!disabled}}});
  await new Promise(setImmediate);
  const expected=!disabled&&site.supported(href)&&routes.includes(new URL(href).pathname);
  assert.equal(Boolean(host),expected,href);assert.equal(listeners,expected?1:0,href);
  host?.destroy();assert.equal(listeners,0);
 }
});

test('a dormant host rechecks route and feature before intercepting later Canvas interactions',async()=>{
 let clickListener,prevented=false,on=true;
 const origin='https://school.instructure.com',href=origin+'/files/42/download';
 const document={addEventListener(type,fn){if(type==='click')clickListener=fn;},removeEventListener(){},createElement(){throw Error('No DOM work is allowed after leaving the vanilla route.');}};
 const root={document,location:new URL(origin+'/courses/7/assignments/12'),ReserveSite:require('../extension/site.js'),ReservePdfModel:Model,ReserveFeatures:{enabled:()=>on}};
 const host=Host.create({root});await new Promise(setImmediate);root.location=new URL(origin+'/profile');
 const element={href,textContent:'Lesson.pdf',getAttribute:key=>key==='href'?href:null,closest:selector=>selector.startsWith('a[href]')?element:null};
 for(const next of [origin+'/profile','https://example.com/courses/7/files/42']){root.location=new URL(next);assert.doesNotThrow(()=>clickListener({button:0,target:element,preventDefault(){prevented=true;}}));assert.equal(prevented,false);}
 root.location=new URL(origin+'/dashboard');on=false;clickListener({button:0,target:element,preventDefault(){prevented=true;}});assert.equal(prevented,false);host.destroy();
});

function node(tag,attrs={},text='',parent=null){
 const el={tagName:tag.toUpperCase(),textContent:text,parentElement:parent,children:[],getAttribute:key=>attrs[key]??null,hasAttribute:key=>Object.hasOwn(attrs,key),get className(){return attrs.class||'';},get href(){return attrs.href||'';},matches(selector){return selector.split(',').some(part=>{part=part.trim();const tag=part.match(/^[\w-]+/)?.[0];return (!tag||tag.toUpperCase()===this.tagName)&&[...part.matchAll(/\.([\w-]+)/g)].every(([,name])=>this.className.split(/\s+/).includes(name))&&[...part.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)].every(([,key,value])=>value===undefined?Object.hasOwn(attrs,key):attrs[key]===value);});},closest(selector){return this.matches(selector)?this:parent?.closest(selector)||null;},querySelector(selector){for(const child of this.children){if(child.matches(selector))return child;const found=child.querySelector(selector);if(found)return found;}return null;}};
 if(parent)parent.children.push(el);return el;
}
const event=(target,extra={})=>({target,button:0,...extra});
test('Canvas Files rows, file pages, wiki, announcements, discussions, syllabus and home file links match',()=>{
 for(const route of ['/courses/7/files/folder/Readings','/courses/7/files/42/preview','/courses/7/pages/reading','/courses/7/announcements/9','/courses/7/discussion_topics/9','/courses/7/assignments/syllabus','/courses/7']){const row=node('div',{class:'ef-item-row','data-id':'42','data-type':'file'}),link=node('a',{href:'/courses/7/files/42',class:'ef-name-col__link','data-api-returntype':'File'},'Reading.pdf',row);const hit=Host.matchPdfClick(event(link),canvas);assert.equal(hit?.fileId,'42',route);assert.equal(hit.element,link);}
 const holder=node('span',{class:'instructure_file_link_holder'});node('a',{href:'/courses/7/files/42','data-api-returntype':'File'},'Reading.pdf',holder);const toggle=node('button',{class:'file_preview_link','aria-label':'Preview'},'',holder);assert.equal(Host.matchPdfClick(event(toggle),canvas)?.fileId,'42');
 const row=node('div',{class:'ef-item-row file','data-id':'42'}),link=node('a',{href:'#',class:'ef-name-col__link'},'Reading.pdf',row);assert.equal(Host.matchPdfClick(event(link),canvas)?.fileId,'42');
 // On a file's own page a "#" link resolves to that page; the row's file must still win.
 const onPage=node('div',{class:'ef-item-row file','data-id':'43'}),hash=node('a',{href:'#',class:'ef-name-col__link'},'Other.pdf',onPage);
 Object.defineProperty(hash,'href',{get:()=>canvas+'/courses/7/files/41#'});assert.equal(Host.matchPdfClick(event(hash),canvas)?.fileId,'43');
});
test('module file rows use content IDs; unresolved item links retain the module URL, never its ID as a file ID',()=>{
 const row=node('li',{class:'context_module_item attachment','data-module-type':'File','data-content-id':'42','data-item-id':'123'}),link=node('a',{href:'/courses/7/modules/items/123'},'Reading.pdf',row);assert.equal(Host.matchPdfClick(event(link),canvas)?.fileId,'42');
 const unresolved=node('a',{href:'/courses/7/modules/items/123'},'Reading.pdf',node('li',{class:'context_module_item attachment','data-id':'123'})),hit=Host.matchPdfClick(event(unresolved),canvas);assert.equal(hit?.moduleURL,canvas+'/courses/7/modules/items/123');assert.equal(hit?.fileId,undefined);
 const relative=node('a',{href:'items/123'},'Reading.pdf');Object.defineProperty(relative,'href',{value:canvas+'/courses/7/modules/items/123'});assert.equal(Host.matchPdfClick(event(relative),canvas)?.moduleURL,canvas+'/courses/7/modules/items/123');
 for(const type of ['Page','Assignment','ExternalUrl']){const nonfile=node('a',{href:'/courses/7/modules/items/123'},'Reading.pdf',node('li',{class:'context_module_item','data-module-type':type,'data-content-id':'42'}));assert.equal(Host.matchPdfClick(event(nonfile),canvas),null);}
});
test('dashboard Materials and Linked materials match their actual composed path',()=>{
 const host=node('div'),shadow={},row=node('button',{'data-pdf-file-id':'42','data-pdf-course-id':'7','data-pdf-name':'Reading.pdf','data-pdf-mime':'application/pdf'},'Reading.pdf'),inner=node('span',{},'Reading.pdf',row),linked=node('a',{href:'/courses/7/files/43',target:'_blank'},'Linked reading.pdf'),icon=node('svg',{},'',linked);
 for(const [target,fileId] of [[inner,'42'],[icon,'43']]){const el=target.parentElement,hit=Host.matchPdfClick(event(host,{composedPath:()=>[target,el,shadow,host]}),canvas);assert.equal(hit?.fileId,fileId);assert.equal(hit.element,el);}
 const mimeOnly=node('a',{'data-pdf-file-id':'44','data-pdf-course-id':'7','data-pdf-name':'Teacher handout','data-pdf-mime':'application/pdf',href:'/files/44'},'Read');assert.equal(Host.matchPdfClick(event(mimeOnly),canvas)?.name,'Teacher handout');
});
test('non-PDFs, folders, external links, explicit downloads, row actions and modified clicks remain native',()=>{
 const row=node('div',{class:'ef-item-row','data-id':'42','data-type':'file'});node('a',{href:'/files/42'},'Reading.pdf',row);
 const cases=[node('a',{href:'/files/42'},'Reading.docx'),node('a',{href:'/files/42',download:''},'Reading.pdf'),node('a',{href:'/files/42',class:'download_link'},'Reading.pdf'),node('a',{href:'/files/42','aria-label':'Download Reading.pdf'},'Reading.pdf'),node('a',{href:'/files/42/download'},'Download'),node('button',{'data-api-endpoint':'/api/v1/files/42','data-content-type':'application/pdf'},'Download'),node('a',{href:'https://evil.example/files/42','data-file-id':'42',class:'file_preview_link'},'Reading.pdf'),node('a',{href:'/courses/7/files/folder/Reading.pdf'},'Reading.pdf'),node('button',{},'Delete',row),node('button',{},'Pin',node('div',{'data-pdf-file-id':'42','data-pdf-course-id':'7','data-pdf-name':'Reading.pdf'})),node('button',{'data-pdf-file-id':'42','data-pdf-course-id':'7','data-pdf-name':'Reading.docx'},'Reading.docx')];
 for(const el of cases)assert.equal(Host.matchPdfClick(event(el),canvas),null,el.textContent+' '+el.href);
 assert.equal(Host.matchPdfClick(event(node('a',{href:'/files/42','data-pdf-download':'true'},'Reading.pdf')),canvas),null);
 assert.equal(Host.matchPdfClick(event(node('a',{href:'/files/42?download=1'},'Reading.pdf')),canvas)?.fileId,'42','a filename link is different from an explicit Download action');
 assert.equal(Host.matchPdfClick(event(node('a',{href:'/files/42'},'Download.pdf')),canvas)?.fileId,'42','a filename alone is not a Download action');
 const link=node('a',{href:'/files/42'},'Reading.pdf');for(const extra of [{button:1},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{defaultPrevented:true}])assert.equal(Host.matchPdfClick(event(link,extra),canvas),null);
});
test('auto-start creates the same dormant host on every reading route without mounting a preview',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync(require.resolve('../extension/pdf-host.js'),'utf8'),site=require('../extension/site.js');
 for(const route of routes){let listeners=0;const context={URL,ReserveSite:site,ReservePdfModel:Model,location:new URL(canvas+route),document:{addEventListener(){listeners++;},removeEventListener(){listeners--;},createElement(){throw Error('No automatic preview replacement.');}}};vm.runInNewContext(source,context);await new Promise(setImmediate);assert.ok(context.ReservePdfHostController,route);assert.equal(listeners,1);context.ReservePdfHostController.destroy();}
});
