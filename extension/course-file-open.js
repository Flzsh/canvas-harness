// Adapted from Gary Wu's pull request #47 to Canvas Harness.
(function(root){
 'use strict';
 function create({store,files,container,root:env=root}){
  const owner={...store.owner},urls=new Set();let dead=false,viewer=null,turn=0;
  const current=()=>!dead&&store.owner.origin===owner.origin&&String(store.owner.accountId)===String(owner.accountId);
  const check=()=>{if(!current())throw Error('Your Canvas account changed. Reload Canvas.');};
  const release=url=>{if(urls.delete(url))env.URL.revokeObjectURL(url);};
  function close(){const prior=viewer;viewer=null;if(prior){prior.dialog.close?.();prior.dialog.remove();if(prior.url)release(prior.url);if(prior.trigger?.isConnected)prior.trigger.focus?.();}}
  function dismiss(){++turn;close();env.ReservePdfHostController?.closeLocal?.(owner);}
  async function open(course,id,element){
   check();const version=++turn,item=files.list(String(course)).find(x=>x.id===id&&x.kind==='file');if(!item)throw Error('This file is no longer saved in this course.');
   const blob=await files.getFile(String(course),id);check();if(version!==turn)return;if(!blob)throw Error('This file is no longer saved here.');
   const name=item.name||'file',pdf=/\.pdf$/i.test(name),picture=/\.(?:png|jpe?g|gif|webp|avif|bmp|tiff?|heic|heif)$/i.test(name),text=/\.(?:txt|md|csv)$/i.test(name);
   if(pdf){const host=env.ReservePdfHostController;if(!host?.openLocal)throw Error('The PDF reader is unavailable.');await host.openLocal({blob,id:item.id,name,owner,element});return;}
   close();
   if(!picture&&!text){
    const url=env.URL.createObjectURL(blob);urls.add(url);const a=env.document.createElement('a');a.href=url;a.download=name;container.append(a);a.click();a.remove();env.setTimeout(()=>release(url),60000);return;
   }
   const content=text?await blob.text():null;check();if(version!==turn)return;
   const doc=env.document,node=(tag,cls,value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
   const dialog=node('dialog','rd-utility-dialog ch-links-viewer'),shell=node('div','rd-utility-shell'),header=node('header','rd-utility-heading'),title=node('h2','rd-utility-title',name),button=node('button','rd-text-button','Close'),body=node('div','rd-utility-body');
   button.type='button';button.addEventListener('click',close);dialog.setAttribute('aria-label',name);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});header.append(title,button);shell.append(header,body);dialog.append(shell);
   const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',bmp:'image/bmp',tif:'image/tiff',tiff:'image/tiff',heic:'image/heic',heif:'image/heif'},type=types[name.split('.').at(-1).toLowerCase()],url=env.URL.createObjectURL(picture?blob.slice(0,blob.size,type):blob),download=node('a','rd-text-button','Download');urls.add(url);download.href=url;download.download=name;header.append(download);
   if(picture){
    const img=node('img','ch-links-picture');img.addEventListener('error',()=>{if(img.hidden)return;img.hidden=true;const error=node('p','','This image could not be displayed.');error.setAttribute('role','alert');body.append(error);});img.src=url;img.alt=name;body.append(img);
   }else body.append(node('pre','ch-links-text',content));
   viewer={dialog,url,trigger:element};container.append(dialog);dialog.showModal();
  }
  return {open,close:dismiss,destroy(){if(dead)return;dead=true;dismiss();for(const url of [...urls])release(url);}};
 }
 const api={create};root.ReserveCourseFileOpen=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
