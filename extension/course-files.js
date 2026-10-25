// Adapted from Gary Wu's pull request #47 to Canvas Harness.
(function(root){
 'use strict';
 const DB='reserve-course-files-v1',STORE='files',MAX_FILE=25000000,MAX_TOTAL=250000000,BACKUP_MAX=66500000,PER_COURSE=60,MAX_COURSES=500,MAX_ITEMS=1000;
 const ID=/^cf-[\w-]{4,60}$/,COURSE=/^\d{1,20}$/,queues=new Map();
 const TYPES=Object.freeze({pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain',md:'text/plain',csv:'text/csv',rtf:'application/rtf',odt:'application/vnd.oasis.opendocument.text',pages:'application/vnd.apple.pages',key:'application/vnd.apple.keynote',numbers:'application/vnd.apple.numbers',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',bmp:'image/bmp',tif:'image/tiff',tiff:'image/tiff',heic:'image/heic',heif:'image/heif'});
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),words=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n):'',bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
 const fileName=v=>typeof v==='string'&&v.trim()&&v.length<=200&&!/[\u0000-\u001f\u007f/\\]/.test(v)?v.trim():'',fileType=name=>{const extension=String(name).match(/\.([^.]+)$/)?.[1].toLowerCase();return Object.hasOwn(TYPES,extension)?TYPES[extension]:'';};
 function cleanLink(value){
  if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))return '';let s=value.trim();if(!s||s.length>2048)return '';
  if(!/^[a-z][a-z0-9+.-]*:/i.test(s))s='https://'+s;
  try{const u=new URL(s);return /^https?:$/.test(u.protocol)&&u.hostname.includes('.')&&!u.username&&!u.password&&u.href.length<=2048?u.href:'';}catch{return '';}
 }
 function linkTitle(url,title){
  const t=words(title,120);if(t)return t;
  try{const u=new URL(url),h=u.hostname.replace(/^www\./,'');if(h==='docs.google.com')return /\/spreadsheets\//.test(u.pathname)?'Google Sheet':/\/presentation\//.test(u.pathname)?'Google Slides':/\/forms\//.test(u.pathname)?'Google Form':'Google Doc';return h==='drive.google.com'?'Google Drive file':h;}catch{return 'Link';}
 }
 function checkFile(file){
  if(!file)return 'Choose a file.';const name=fileName(file.name);if(!name)return 'Choose a file with a valid name of up to 200 characters.';
  if(!fileType(name))return `${name}: use a PDF, Word, PowerPoint, Excel, text or image file.`;
  if(file.size===0)return `${name} is empty.`;if(!Number.isSafeInteger(file.size)||file.size<0)return `${name} has an invalid file size.`;
  return file.size>MAX_FILE?`${name} is larger than 25 MB.`:'';
 }
 function cleanList(value){
  const out=[],seen=new Set();for(const x of Array.isArray(value)?value:[]){
   if(!record(x)||typeof x.id!=='string'||!ID.test(x.id)||seen.has(x.id))continue;const title=words(x.title,120)||'Untitled',added=words(x.added,40);let row;
   if(x.kind==='link'){const url=cleanLink(x.url);if(url)row={id:x.id,kind:'link',title,url,...(added?{added}:{})};}
   else if(x.kind==='file'){const name=fileName(x.name);if(name&&!checkFile({name,size:x.size}))row={id:x.id,kind:'file',title,name,type:fileType(name),size:x.size,...(added?{added}:{})};}
   if(row){seen.add(row.id);out.push(row);}if(out.length>=PER_COURSE)break;
  }return out;
 }
 function cleanCourses(value){
  if(!record(value))return {};const out={},seen=new Set();let count=0,total=0;
  for(const [course,rows]of Object.entries(value)){if(!COURSE.test(course)||Object.keys(out).length>=MAX_COURSES)continue;const list=[];for(const row of cleanList(rows)){if(seen.has(row.id))continue;if(++count>MAX_ITEMS)throw Error('Keep up to 1,000 course links and files. Remove an item before adding another.');if(row.kind==='file'&&(total+=row.size)>MAX_TOTAL)throw Error('Saved course files exceed 250 MB. Remove a file before adding another.');seen.add(row.id);list.push(row);}if(list.length)out[course]=list;}
  return out;
 }
 function ownerOf(store){
  const o=store?.owner;if(!o||typeof o.origin!=='string'||!o.accountId||!/^[-\w]{1,60}$/.test(String(o.accountId)))throw Error('A verified Canvas account is required for course links and files.');
  try{const u=new URL(o.origin);if(!/^https?:$/.test(u.protocol)||u.origin!==o.origin||u.username||u.password)throw Error();}catch{throw Error('A verified Canvas site is required for course links and files.');}
  return {origin:o.origin,accountId:String(o.accountId)};
 }
 const scopeOf=o=>JSON.stringify([o.origin,o.accountId]),refOf=(course,id)=>course+':'+id,entries=courses=>Object.entries(courses).flatMap(([course,list])=>list.filter(x=>x.kind==='file').map(item=>({course,item})));
 function lock(scope,fn){
  if(root.navigator?.locks)return root.navigator.locks.request('reserve-course-files:'+scope,fn);
  const task=(queues.get(scope)||Promise.resolve()).catch(()=>{}).then(fn);queues.set(scope,task);task.finally(()=>{if(queues.get(scope)===task)queues.delete(scope);}).catch(()=>{});return task;
 }
 function fileDB(owner,indexedDB){
  const scope=scopeOf(owner),key=ref=>scope+':'+ref,indexKey=key('index');let opened,closed=false;
  const open=()=>opened||=new Promise((resolve,reject)=>{
   if(!indexedDB?.open){reject(Error('File storage is unavailable in this browser.'));return;}let request;try{request=indexedDB.open(DB,1);}catch{reject(Error('File storage is unavailable in this browser.'));return;}
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};request.onerror=()=>reject(Error('File storage could not be opened.'));request.onblocked=()=>reject(Error('Close other Canvas Harness file windows and try again.'));
   request.onsuccess=()=>{const db=request.result;if(closed){db.close();reject(Error('Course files are closed.'));return;}db.onversionchange=()=>db.close();resolve(db);};
  });
  function indexOf(value){
   if(value===undefined)return {owner:scope,files:{}};if(!record(value)||value.owner!==scope||!record(value.files)||Object.keys(value.files).length>MAX_ITEMS)throw Error('Saved file storage is invalid.');
   for(const [ref,size]of Object.entries(value.files))if(!/^\d{1,20}:cf-[\w-]{4,60}$/.test(ref)||!Number.isSafeInteger(size)||size<=0||size>MAX_FILE)throw Error('Saved file storage is invalid.');return {owner:scope,files:{...value.files}};
  }
  async function transact(wanted,change,write=true){
   const db=await open();return new Promise((resolve,reject)=>{
    let tx,result,error;try{tx=db.transaction(STORE,write?'readwrite':'readonly');}catch{reject(Error('File storage could not be opened. Reload Canvas Harness and try again.'));return;}
    const table=tx.objectStore(STORE);tx.oncomplete=()=>error?reject(error):resolve(result);tx.onerror=tx.onabort=()=>reject(error||Error('File storage could not be saved: '+(tx.error?.message||'transaction aborted.')));
    const protect=fn=>{try{fn();}catch(e){error=e;tx.abort?.();}},request=table.get(indexKey);
    request.onsuccess=()=>protect(()=>{const index=indexOf(request.result),refs=[...new Set(typeof wanted==='function'?wanted(index):wanted)],rows=new Map();let pending=refs.length;
     const finish=()=>protect(()=>{const changes=change(index,rows)||{};result=changes.result;if(!write)return;const next=changes.files||index.files;if(Object.values(next).reduce((n,size)=>n+size,0)>MAX_TOTAL)throw Error('Course file storage is full (250 MB). Remove a file before adding another.');for(const ref of changes.remove||[])table.delete(key(ref));for(const [ref,row]of changes.put||[])table.put(row,key(ref));table.put({owner:scope,files:next},indexKey);});
     if(!pending){finish();return;}for(const ref of refs){const get=table.get(key(ref));get.onsuccess=()=>protect(()=>{rows.set(ref,get.result);if(--pending===0)finish();});}
    });
   });
  }
  return {scope,transact,close(){closed=true;opened?.then(db=>db.close()).catch(()=>{});}};
 }
 function controller({store,indexedDB=root.indexedDB}={}){
  const owner=ownerOf(store),scope=scopeOf(owner),pool=fileDB(owner,indexedDB);let dead=false,active=0;
  const sameOwner=()=>store?.owner?.origin===owner.origin&&String(store?.owner?.accountId)===owner.accountId;
  function check(){if(dead)throw Error('Course files are closed.');if(!sameOwner())throw Error('The Canvas account changed. Reopen this course before adding or opening files.');}
  const every=()=>cleanCourses(store.get().courseFiles),courseId=value=>{const id=String(value);if(!COURSE.test(id))throw Error('Choose a valid Canvas course.');return id;};
  const list=course=>{if(dead||!sameOwner()||!COURSE.test(String(course)))return [];return structuredClone(every()[String(course)]||[]);};
  const exclusive=fn=>lock(scope,async()=>{check();active++;try{return await fn();}finally{if(--active===0&&dead)pool.close();}});
  const persisted=async()=>cleanCourses(store.readCourseFiles?await store.readCourseFiles():store.get().courseFiles),matches=(a,b)=>a?.kind==='file'&&a.name===b.name&&a.type===b.type&&a.size===b.size;
  const freshId=()=>{const used=new Set(Object.values(every()).flat().map(x=>x.id));let id;do{id='cf-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));}while(used.has(id));return id;};
  function room(all,course,count){if((all[course]?.length||0)+count>PER_COURSE)throw Error(`A course holds up to ${PER_COURSE} links and files. Remove an item before adding another.`);if(Object.values(all).reduce((n,list)=>n+list.length,0)+count>MAX_ITEMS)throw Error('Keep up to 1,000 course links and files. Remove an item before adding another.');if(!Object.hasOwn(all,course)&&Object.keys(all).length>=MAX_COURSES)throw Error('Keep links and files for up to 500 courses.');}
  async function addLink(course,url,title){return exclusive(async()=>{const id=courseId(course),safe=cleanLink(url);if(!safe)throw Error('Paste a valid HTTP or HTTPS web address without a username or password.');const row={id:freshId(),kind:'link',title:linkTitle(safe,title),url:safe,added:new Date().toISOString()};await store.update(d=>{check();const all=cleanCourses(d.courseFiles);room(all,id,1);all[id]=[...(all[id]||[]),row];d.courseFiles=all;});check();return structuredClone(row);});}
  async function addFiles(course,files){return exclusive(async()=>{
   const id=courseId(course),batch=Array.from(files||[]);if(!batch.length)throw Error('Choose a file.');room(every(),id,batch.length);
   const rows=batch.map(file=>{const problem=checkFile(file);if(problem)throw Error(problem);if(!(file instanceof Blob))throw Error('Choose a file from this computer.');const name=fileName(file.name),type=fileType(name),item={id:freshId(),kind:'file',title:words(name.replace(/\.[^.]+$/,''),120)||name,name,type,size:file.size,added:new Date().toISOString()};return {ref:refOf(id,item.id),item,row:{owner:scope,course:id,id:item.id,name,type,size:file.size,blob:new Blob([file],{type})}};});
   await pool.transact([],index=>{const next={...index.files};for(const r of rows){if(Object.hasOwn(next,r.ref))throw Error('This file is already saved.');next[r.ref]=r.item.size;}return {files:next,put:rows.map(r=>[r.ref,r.row])};});
   try{check();await store.update(d=>{check();const all=cleanCourses(d.courseFiles);room(all,id,rows.length);all[id]=[...(all[id]||[]),...rows.map(r=>r.item)];d.courseFiles=all;});check();}
   catch(error){try{const saved=await persisted(),remove=rows.filter(r=>!matches(saved[id]?.find(x=>x.id===r.item.id),r.item)).map(r=>r.ref);if(remove.length)await pool.transact([],index=>{const next={...index.files};for(const ref of remove)delete next[ref];return {files:next,remove};});}catch(rollback){throw Error(error.message+'; uploaded file cleanup failed: '+rollback.message);}throw error;}
   return structuredClone(rows.map(r=>r.item));
  });}
  async function rename(course,id,title){return exclusive(async()=>{const c=courseId(course),name=words(title,120);if(!name)throw Error('Enter a name for this link or file.');let result;await store.update(d=>{check();const all=cleanCourses(d.courseFiles),row=all[c]?.find(x=>x.id===id);if(!row)throw Error('This link or file is no longer saved in this course.');row.title=name;result=row;d.courseFiles=all;});check();return structuredClone(result);});}
  async function remove(course,id){return exclusive(async()=>{
   const c=courseId(course),item=list(c).find(x=>x.id===id);if(!item)throw Error('This link or file is no longer saved in this course.');const ref=refOf(c,id);let previous;
   if(item.kind==='file')previous=await pool.transact([ref],(index,rows)=>{const next={...index.files};delete next[ref];return {files:next,remove:[ref],result:rows.get(ref)};});
   try{check();await store.update(d=>{check();const all=cleanCourses(d.courseFiles);all[c]=(all[c]||[]).filter(x=>x.id!==id);if(!all[c].length)delete all[c];d.courseFiles=all;});check();}
   catch(error){if(previous)try{let referenced=error?.accountCommitted!==true;try{const saved=await persisted();referenced=matches(saved[c]?.find(x=>x.id===id),item);}catch{}if(referenced)await pool.transact([],index=>({files:{...index.files,[ref]:previous.size},put:[[ref,previous]]}));}catch(rollback){throw Error(error.message+'; file rollback failed: '+rollback.message);}throw error;}return true;
  });}
  async function getFile(course,id){return exclusive(async()=>{
   const c=courseId(course),item=list(c).find(x=>x.id===id&&x.kind==='file');if(!item)throw Error('This file is not saved in this course.');const ref=refOf(c,id),row=await pool.transact([ref],(index,rows)=>({result:index.files[ref]===item.size?rows.get(ref):null}),false);check();
   const current=list(c).find(x=>x.id===id&&x.kind==='file');if(!current||current.name!==item.name||current.type!==item.type||current.size!==item.size||!row||row.owner!==scope||row.course!==c||row.id!==id||row.name!==item.name||row.type!==item.type||row.size!==item.size||!(row.blob instanceof Blob)||row.blob.size!==item.size||row.blob.type!==item.type)throw Error(`${item.name} is no longer saved on this computer. Add it again from My links & files.`);
   return row.blob;
  });}
  const api={list,addLink,addFiles,rename,remove,getFile,available:()=>!dead&&sameOwner(),destroy(){if(dead)return;dead=true;if(!active)pool.close();}};return {api,pool,check,exclusive,every,persisted,scope};
 }
 const create=options=>controller(options).api;
 const notice=count=>count?`${count} uploaded file${count===1?' was':'s were'} not included because the backup size limit was reached or the local file was unavailable. Links and file names are included.`:'';
 async function encode(blob){const input=new Uint8Array(await blob.arrayBuffer()),parts=[];for(let at=0;at<input.length;at+=32768)parts.push(String.fromCharCode(...input.subarray(at,at+32768)));return root.btoa(parts.join(''));}
 function decode(value,size,type){
  if(typeof value!=='string'||value.length!==4*Math.ceil(size/3)||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Invalid course file backup bytes.');let text;try{text=root.atob(value);}catch{throw Error('Invalid course file backup bytes.');}if(text.length!==size)throw Error('Course file backup bytes do not match the saved file size.');const input=new Uint8Array(text.length);for(let i=0;i<text.length;i++)input[i]=text.charCodeAt(i);return new Blob([input],{type});
 }
 async function exportFiles(backup,{store,indexedDB=root.indexedDB,maxBytes=BACKUP_MAX}={}){
  const c=create({store,indexedDB}),files=entries(cleanCourses(backup.data?.courseFiles)),out={...backup,courseFileBytes:[],courseFilesOmitted:files.length,courseFilesNotice:notice(files.length)},limit=Number.isSafeInteger(maxBytes)&&maxBytes>0?Math.min(BACKUP_MAX,maxBytes):BACKUP_MAX;
  try{for(const {course,item}of files){const payload={course,id:item.id,base64:''};out.courseFileBytes.push(payload);out.courseFilesOmitted=files.length-out.courseFileBytes.length;out.courseFilesNotice=notice(out.courseFilesOmitted);if(bytes(out)+4*Math.ceil(item.size/3)>limit){out.courseFileBytes.pop();out.courseFilesOmitted++;out.courseFilesNotice=notice(out.courseFilesOmitted);continue;}try{const blob=await c.getFile(course,item.id),current=c.list(course).find(x=>x.id===item.id&&x.kind==='file');if(blob.size!==item.size||blob.type!==item.type||current?.name!==item.name)throw Error('The saved file changed.');payload.base64=await encode(blob);}catch{out.courseFileBytes.pop();out.courseFilesOmitted++;out.courseFilesNotice=notice(out.courseFilesOmitted);}}if(bytes(out)>limit)throw Error('Backup is too large. Remove unused packs or notes before exporting it.');return out;}finally{c.destroy();}
 }
 async function restoreFiles(backup,{store,indexedDB=root.indexedDB,publish,beforeRestore}={}){
  const c=controller({store,indexedDB});try{return await c.exclusive(async()=>{
   await beforeRestore?.();c.check();
   const next=cleanCourses(backup.data?.courseFiles),wanted=new Map(entries(next).map(({course,item})=>[refOf(course,item.id),{course,item}])),incoming=new Map();
   for(const payload of backup.courseFileBytes||[]){const ref=refOf(payload.course,payload.id),target=wanted.get(ref);if(!target||incoming.has(ref))throw Error('Course file backup contains an invalid or duplicate file.');const {course,item}=target,blob=decode(payload.base64,item.size,item.type);incoming.set(ref,{owner:c.scope,course,id:item.id,name:item.name,type:item.type,size:item.size,blob});}
   // Recovery guards also serialize replacements that contain no local files.
   if(!wanted.size&&!entries(await c.persisted()).length)return publish();
   let before;await c.pool.transact(index=>Object.keys(index.files),(index,rows)=>{
    before={files:{...index.files},rows:new Map(rows)};const files={},put=[...incoming],remove=[];for(const [ref,row]of rows){const target=wanted.get(ref),item=target?.item;if(!incoming.has(ref)&&item&&row?.owner===c.scope&&row.course===target.course&&row.id===item.id&&row.name===item.name&&row.type===item.type&&row.size===item.size&&row.blob instanceof Blob&&row.blob.size===item.size)files[ref]=item.size;else if(!incoming.has(ref))remove.push(ref);}for(const [ref,row]of incoming)files[ref]=row.size;return {files,put,remove};
   });
   try{c.check();return await publish();}catch(error){try{let published=error?.accountCommitted===true;try{const saved=new Map(entries(await c.persisted()).map(({course,item})=>[refOf(course,item.id),item]));published=saved.size===wanted.size&&[...wanted].every(([ref,{item}])=>{const row=saved.get(ref);return row?.name===item.name&&row.type===item.type&&row.size===item.size;});}catch{}if(!published)await c.pool.transact(index=>Object.keys(index.files),index=>({files:before.files,put:[...before.rows].filter(([,row])=>row),remove:Object.keys(index.files).filter(ref=>!before.rows.has(ref))}));}catch(rollback){throw Error(error.message+'; course file rollback failed: '+rollback.message);}throw error;}
  });}finally{c.api.destroy();}
 }
 const api={DB,STORE,MAX_FILE,MAX_TOTAL,BACKUP_MAX,PER_COURSE,MAX_COURSES,MAX_ITEMS,ID,cleanLink,linkTitle,checkFile,cleanList,cleanCourses,create,exportFiles,restoreFiles};root.ReserveCourseFiles=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
