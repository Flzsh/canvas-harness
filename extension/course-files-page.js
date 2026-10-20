/* The window for a course's own links and files (course-files.html?course=ID&name=Course&origin=…&account=…), opened by
   the background for a Canvas tab. Links and the list go to chrome.storage.local under the account's
   course-files key (course-files.js); uploaded files go to this extension's IndexedDB. */
(function(){
 'use strict';
 const F=globalThis.ReserveCourseFiles;
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
 const course=/^\d{1,20}$/.test(params.get('course')||'')?params.get('course'):'',name=String(params.get('name')||'').slice(0,80)||'This course';
 let origin='';try{const u=new URL(params.get('origin')||'');origin=u.protocol==='https:'&&u.origin===params.get('origin')?u.origin:'';}catch{}
 const account=/^[\w-]{1,60}$/.test(params.get('account')||'')?params.get('account'):'';
 const listEl=$('list'),statusEl=$('status');
 if(!course||!origin||!account){$('title').textContent='No course chosen';document.querySelectorAll('form,.drop').forEach(n=>n.hidden=true);return;}
 const KEY=F.key(origin,account);
 $('title').textContent=`${name}: links and files`;document.title=`${name} · links and files`;
 const say=t=>{statusEl.textContent=t;};
 const newId=()=>'cf-'+(crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
 let dbp=null;
 const db=()=>dbp||(dbp=new Promise((ok,no)=>{const r=indexedDB.open(F.DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(F.STORE);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);}));
 const run=async(mode,fn)=>{const d=await db();return new Promise((ok,no)=>{const t=d.transaction(F.STORE,mode);fn(t.objectStore(F.STORE));t.oncomplete=()=>ok();t.onerror=t.onabort=()=>no(t.error||Error('Storage failed'));});};
 const all=async()=>(await chrome.storage.local.get(KEY))[KEY]||{};
 async function change(fn){const every=await all(),list=F.cleanList(every[course]);const next=fn(list)||list;every[course]=F.cleanList(next);if(!every[course].length)delete every[course];await chrome.storage.local.set({[KEY]:every});draw();}

 async function draw(){
  const list=F.cleanList((await all())[course]);
  listEl.textContent='';
  if(!list.length){const li=document.createElement('li'),what=document.createElement('span'),small=document.createElement('small');what.className='what';small.textContent='Nothing yet. Add a link or a file above; it shows in this course\'s Course information.';what.append(small);li.append(what);listEl.append(li);return;}
  for(const x of list){
   const li=document.createElement('li'),what=document.createElement('span');what.className='what';
   const input=document.createElement('input');input.type='text';input.value=x.title;input.maxLength=120;input.setAttribute('aria-label','Name');
   input.addEventListener('change',()=>change(l=>{const it=l.find(i=>i.id===x.id);if(it)it.title=input.value.trim()||it.title;}).then(()=>say('Renamed.')));
   const small=document.createElement('small');small.textContent=x.kind==='link'?x.url:`${x.name} · ${(x.size/1048576).toFixed(x.size>1048576?1:2)} MB`;
   what.append(input,small);
   const open=document.createElement('button');open.className='link';open.type='button';open.textContent='Open';
   open.addEventListener('click',()=>{if(x.kind==='link')window.open(x.url,'_blank','noopener');else window.open(chrome.runtime.getURL('course-file.html')+'?id='+encodeURIComponent(x.id),'_blank');});
   const del=document.createElement('button');del.className='link danger';del.type='button';del.textContent='Remove';
   del.addEventListener('click',async()=>{
    if(del.dataset.sure!=='1'){del.dataset.sure='1';del.textContent='Remove?';setTimeout(()=>{del.dataset.sure='';del.textContent='Remove';},4000);return;}
    if(x.kind==='file')await run('readwrite',s=>s.delete(x.id)).catch(()=>{});
    await change(l=>l.filter(i=>i.id!==x.id));say(`Removed ${x.title}.`);
   });
   li.append(what,open,del);listEl.append(li);
  }
 }
 $('link-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const url=F.cleanLink($('link-url').value);if(!url){say('That doesn\'t look like a web address. Paste the link from the address bar.');return;}
  const title=F.linkTitle(url,$('link-title').value);
  if(F.cleanList((await all())[course]).length>=F.PER_COURSE){say(`A course holds up to ${F.PER_COURSE} links and files.`);return;}
  await change(l=>[...l,{id:newId(),kind:'link',title,url,added:new Date().toISOString()}]);
  $('link-url').value='';$('link-title').value='';say(`Added ${title}.`);$('link-url').focus();
 });
 async function upload(files){
  for(const file of files){
   const problem=F.checkFile(file);if(problem){say(problem);continue;}
   if(F.cleanList((await all())[course]).length>=F.PER_COURSE){say(`A course holds up to ${F.PER_COURSE} links and files.`);return;}
   const id=newId();say(`Saving ${file.name}…`);
   try{await run('readwrite',s=>s.put({blob:file,name:file.name,type:file.type,size:file.size},id));}
   catch{say(`${file.name} couldn't be saved on this computer.`);continue;}
   await change(l=>[...l,{id,kind:'file',title:file.name.replace(/\.[^.]+$/,''),name:file.name,type:file.type,size:file.size,added:new Date().toISOString()}]);
   say(`Saved ${file.name}.`);
  }
 }
 $('file').addEventListener('change',e=>{upload([...e.target.files]);e.target.value='';});
 const drop=$('drop');
 drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});
 drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
 drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');upload([...(e.dataTransfer?.files||[])]);});
 chrome.storage.onChanged.addListener((c,area)=>{if(area==='local'&&c[KEY])draw();});
 draw();$('link-url').focus();
})();
