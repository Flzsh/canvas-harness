/* Opens one of a course's uploaded files from this extension's IndexedDB (course-files-page.js stores them).
   course-file.html?id=cf-… : a PDF, image or text file shows in this tab; anything else downloads with its name. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id')||'';
 const msg=t=>{$('msg').textContent=t;};
 if(!/^cf-[\w-]{4,60}$/.test(id)){msg('This file link is not valid.');return;}
 const req=indexedDB.open('reserve-course-files',1);
 req.onupgradeneeded=()=>req.result.createObjectStore('files');
 req.onerror=()=>msg('The file could not be opened.');
 req.onsuccess=()=>{
  const get=req.result.transaction('files').objectStore('files').get(id);
  get.onerror=()=>msg('The file could not be opened.');
  get.onsuccess=()=>{
   const rec=get.result;if(!rec?.blob){msg('This file is no longer saved here. Add it again from the course\'s Course information.');return;}
   const name=rec.name||'file',type=(rec.type||rec.blob.type||'').toLowerCase(),url=URL.createObjectURL(rec.blob);
   document.title=name;
   if(type==='application/pdf'||/\.pdf$/i.test(name)||/^text\//.test(type)){$('view').src=url;$('view').hidden=false;$('note').hidden=true;return;}
   if(/^image\//.test(type)){$('pic').src=url;$('pic').alt=name;$('pic').hidden=false;$('note').hidden=true;return;}
   // Word, PowerPoint, Excel and the rest: hand it to the computer with its own name.
   const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
   $('msg').textContent='';const p=$('msg');p.append(`${name} was downloaded. Open it from Downloads, or `);
   const again=document.createElement('a');again.href=url;again.download=name;again.textContent='download it again';p.append(again,'.');
  };
 };
})();
