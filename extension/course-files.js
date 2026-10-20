/* Canvas Harness: a course's own links and files. A student keeps the things a course needs that Canvas doesn't hold
   (a Google Doc of notes, a revision website, a PDF or Word file) one click away in the course's Course information
   and Course hub. The list lives in chrome.storage.local beside the account's own data
   (reserve:v1:<origin>:<account>:course-files = {courseId: [{id, kind:'link'|'file', title, url | name+type+size, added}]});
   uploaded files themselves live in the extension's IndexedDB ("reserve-course-files"), on this computer only.
   Adding happens in a small extension window (course-files.html), opened by the background for a Canvas tab;
   a file opens in course-file.html. Nothing is sent to Canvas or anywhere else. */
(function(root){
 'use strict';
 const DB='reserve-course-files',STORE='files',MAX=50*1024*1024,PER_COURSE=60;
 const TYPES=/\.(pdf|docx?|pptx?|xlsx?|txt|rtf|odt|pages|key|numbers|png|jpe?g|gif|webp|heic|csv|md)$/i;
 const ID=/^cf-[\w-]{4,60}$/;
 const key=(origin,account)=>`reserve:v1:${origin}:${account}:course-files`;

 /* ---- shared rules (the window, the panel and the tests use these) ---- */
 function cleanLink(value){
  let s=String(value||'').trim();if(!s)return '';
  if(!/^[a-z][a-z0-9+.-]*:/i.test(s))s='https://'+s;
  try{const u=new URL(s);return /^https?:$/.test(u.protocol)&&u.hostname.includes('.')&&!u.username&&!u.password?u.href:'';}catch{return '';}
 }
 function linkTitle(url,title){
  const t=String(title||'').trim().slice(0,120);if(t)return t;
  try{const u=new URL(url),h=u.hostname.replace(/^www\./,'');
   if(h==='docs.google.com')return /\/spreadsheets\//.test(u.pathname)?'Google Sheet':/\/presentation\//.test(u.pathname)?'Google Slides':/\/forms\//.test(u.pathname)?'Google Form':'Google Doc';
   if(h==='drive.google.com')return 'Google Drive file';
   return h;}catch{return 'Link';}
 }
 function checkFile(file){
  if(!file)return 'Choose a file.';
  if(!TYPES.test(file.name||''))return `${file.name}: use a PDF, Word, PowerPoint, Excel, text or image file.`;
  if(!(file.size>0))return `${file.name} is empty.`;
  if(file.size>MAX)return `${file.name} is larger than 50 MB.`;
  return '';
 }
 function cleanList(v){
  const out=[];
  for(const x of Array.isArray(v)?v:[]){
   if(!x||typeof x!=='object'||typeof x.id!=='string'||!ID.test(x.id))continue;
   const title=String(x.title||'').slice(0,120).trim()||'Untitled',added=String(x.added||'').slice(0,40);
   if(x.kind==='link'){const url=cleanLink(x.url);if(url)out.push({id:x.id,kind:'link',title,url,added});}
   else if(x.kind==='file')out.push({id:x.id,kind:'file',title,name:String(x.name||'').slice(0,200),type:String(x.type||'').slice(0,100),size:Math.max(0,Number(x.size)||0),added});
   if(out.length>=PER_COURSE)break;
  }
  return out;
 }

 /* ---- the Canvas page: read the list, draw the section, ask the background to open things ---- */
 function watch({owner,onChange=()=>{}}={}){
  let all={},dead=false,unsubscribe=null;const storage=root.chrome?.storage?.local,name=owner&&key(owner.origin,owner.accountId);
  if(storage&&name){
   Promise.resolve(storage.get(name)).then(v=>{if(!dead){all=v?.[name]||{};onChange();}},()=>{});
   const handler=(changes,area)=>{if(area==='local'&&changes[name]&&!dead){all=changes[name].newValue||{};onChange();}};
   root.chrome.storage.onChanged?.addListener(handler);unsubscribe=()=>root.chrome.storage.onChanged?.removeListener(handler);
  }
  const send=message=>{try{return Promise.resolve(root.chrome?.runtime?.sendMessage?.({type:'ch-course-files',...message})).catch(()=>null);}catch{return Promise.resolve(null);}};
  return {
   list:id=>cleanList(all[String(id)]),
   available:()=>!!(storage&&name&&root.chrome?.runtime?.sendMessage),
   manage:(course,title)=>send({op:'manage',course:String(course),name:String(title||'').slice(0,80),account:String(owner?.accountId||'')}),
   open:id=>ID.test(String(id))?send({op:'open',id:String(id)}):Promise.resolve(null),
   destroy(){dead=true;unsubscribe?.();}
  };
 }
 // The section: a row per link (opens in a new tab) or file (opens through the extension), and Add.
 function render(course,list,{E,available=true}={}){
  const id=String(course.id),name=course.shortName||course.name||'this course';
  const rows=list.map(x=>x.kind==='link'
   ?`<li><a class="rd-own-file" href="${E(x.url)}" target="_blank" rel="noopener noreferrer" title="${E(x.url)}"><span>${E(x.title)}</span><small>${E(linkTitle(x.url,''))} ↗</small></a></li>`
   :`<li><button type="button" class="rd-own-file" data-rd-action="hub-own-open" data-course="${E(id)}" data-file="${E(x.id)}" title="${E(x.name)}"><span>${E(x.title)}</span><small>${E((x.name.match(/\.([^.]+)$/)?.[1]||'file').toUpperCase())} · on this computer</small></button></li>`).join('');
  const add=available?`<button type="button" class="rd-text-button" data-rd-action="hub-own-add" data-course="${E(id)}" data-name="${E(name)}" aria-label="Add a link or file to ${E(name)}">+ Add</button>`:'';
  return `<section class="rd-deck-section rd-deck-own" data-rd-section="course-deck-${E(id)}-own" aria-label="My links and files"><div class="rd-sheet-heading"><h3><span>My links &amp; files</span></h3><div class="rd-source-actions">${add}</div></div>${rows?`<ul class="rd-own-files">${rows}</ul>`:`<p class="rd-hub-notice">${available?'Add a Google Doc, a website or a PDF or Word file to keep it one click away.':'Your own links and files can be added in the installed extension.'}</p>`}</section>`;
 }
 const api={DB,STORE,MAX,PER_COURSE,ID,key,cleanLink,linkTitle,checkFile,cleanList,watch,render};
 root.ReserveCourseFiles=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
