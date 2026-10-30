/* Google Docs an assignment links. GitHub installs read them with the student's own Google session (only
   docs.google.com, after the student allows it); store installs ask the student to paste the text instead. */
(function(root){
 'use strict';
 const ORIGINS=['https://docs.google.com/*'],MAX=60000;
 // A Docs link: an editor link (/document/d/ID, any /u/N/ account) or a "published to the web" link (/document/d/e/ID/pub).
 const DOC=/https?:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/(e\/)?([\w-]{20,120})/i,OTHER=/https?:\/\/docs\.google\.com\/(presentation|spreadsheets)\/(?:u\/\d+\/)?d\/(?:e\/)?([\w-]{20,120})/i;
 const decode=s=>String(s).replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);|&#(?:x([0-9a-f]{1,6})|(\d{1,7}));/gi,(m,h,d)=>{
  if(h||d){const c=parseInt(h||d,h?16:10);return c>0&&c<=0x10ffff&&!(c>=0xd800&&c<=0xdfff)?String.fromCodePoint(c):'';}
  return {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&nbsp;':' '}[m.toLowerCase()]||m;
 });
 function links(html){const out=[],seen=new Set();
  for(const m of String(html||'').matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)){
   const href=decode(m[1]||m[2]||''),title=decode(String(m[3]).replace(/<[^>]*>/g,'')).replace(/\s+/g,' ').trim().slice(0,160),doc=DOC.exec(href),other=doc?null:OTHER.exec(href);
   if(!doc&&!other)continue;const id=(doc?doc[2]:other[2]);if(seen.has(id))continue;seen.add(id);
   out.push(doc?{kind:doc[1]?'published':'document',id,title:title||'Google Doc'}:{kind:other[1].toLowerCase(),id,title:title||(other[1]==='presentation'?'Google Slides':'Google Sheet')});
  }
  return out.slice(0,6);}
 const url=link=>link.kind==='published'?'https://docs.google.com/document/d/e/'+link.id+'/pub':'https://docs.google.com/document/d/'+link.id+'/mobilebasic';
 // The document's own text: Docs serves it inside .doc-content (mobile view) or #contents (published page).
 function text(html){
  let body=String(html||'').replace(/<(script|style|head|noscript)\b[\s\S]*?<\/\1>/gi,'');
  const at=body.search(/<div\b[^>]*(?:class="[^"]*\bdoc-content\b|id="contents")/i);
  if(at<0)return '';
  body=body.slice(at);
  return decode(body.replace(/<br\b[^>]*>|<\/(?:p|div|h[1-6]|tr|table|ul|ol)>/gi,'\n').replace(/<li\b[^>]*>/gi,'\n• ').replace(/<\/t[dh]>/gi,' | ').replace(/<[^>]*>/g,'')).replace(
   /[ \t ]+/g,
   ' ').replace(
   / *\n */g,
   '\n').replace(
   / ?\| ?(?=\n|$)/g,
   '').replace(
   /\n{3,}/g,
   '\n\n').trim().slice(
   0,
   MAX);}
 // Store installs carry an update_url; they never read Google, the student pastes instead.
 const readsHere=chrome=>{try{return !chrome?.runtime?.getManifest?.()?.update_url;}catch{return false;}};
 async function allowed(chrome){try{return await chrome.permissions.contains({origins:ORIGINS})===true;}catch{return false;}}
 async function read(link,{chrome=root.chrome,fetch=root.fetch?.bind(root),timeout=15000}={}){
  if(!link||!['document','published'].includes(link.kind))return {error:'paste'};
  if(!readsHere(chrome))return {error:'paste'};if(!await allowed(chrome))return {error:'permission'};
  let timer=0;
  const res=await Promise.race([fetch(url(link),{credentials:'include',redirect:'manual'}).catch(()=>null),new Promise(r=>{timer=setTimeout(()=>r(null),timeout);})]);
  clearTimeout(timer);
  // A doc the student cannot open sends them to sign in (a redirect) or answers 401/403/404.
  if(!res||res.type==='opaqueredirect'||res.status!==200)return {error:'private'};
  const words=text(await res.text().catch(()=>''));return words?{text:words}:{error:'private'};}
 const api={ORIGINS,links,url,text,readsHere,allowed,read};
 root.CanvasHarnessGoogleDocs=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
