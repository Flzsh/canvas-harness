/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// A better PDF reader on Canvas's file pages (/courses/:id/files/:id). Canvas's own viewer (the Canvadocs frame in
// #doc_preview) stays on the page, untouched and one click away: this puts the Harness reader (pdf-reader.html, an
// extension page, pdf-reader.mjs, with the vendored PDF.js) in the same spot, with a small "Harness reader | Canvas viewer" switch
// remembered on this device. Nothing else on Canvas's page changes; a PDF the reader can't open falls back to
// Canvas's viewer by itself.
(function(){'use strict';
 if(globalThis.ReservePdfView||globalThis.top!==globalThis)return;globalThis.ReservePdfView=true;
 const PREF='reserve:pdfReader';
 const fileId=()=>{const m=/^\/(?:(?:courses|groups|users)\/\d+\/)?files\/(\d+)(?:\/preview)?\/?$/.exec(location.pathname);return m?m[1]:null;};
 const getPref=()=>{try{return localStorage.getItem(PREF)==='canvas'?'canvas':'harness';}catch{return 'harness';}};
 const setPref=v=>{try{localStorage.setItem(PREF,v);}catch{}};
 const CSS=`
 .reserve-pdf-switch{display:inline-flex;gap:2px;padding:3px;margin:4px 0 10px;border-radius:10px;background:color-mix(in srgb,var(--chn-sidebar,#F5F4ED) 100%,transparent);
  border:1px solid color-mix(in srgb,var(--chn-accent,#A9522F) 25%,#E8E6DC);font:450 13px/1 var(--chn-font,"Segoe UI",system-ui,sans-serif)}
 .reserve-pdf-switch button{font:inherit;padding:6px 12px;border:0;border-radius:7px;background:transparent;color:var(--chn-ink2,#3D3D3A);cursor:pointer}
 .reserve-pdf-switch button[aria-pressed=true]{background:#fff;color:var(--chn-ink,#141413);font-weight:650;box-shadow:0 0 0 1px color-mix(in srgb,var(--chn-accent,#A9522F) 35%,transparent),0 1px 2px #0000001a}
 .reserve-pdf-switch button:focus-visible{outline:2px solid var(--chn-accent,#A9522F);outline-offset:1px}
 .reserve-pdf-frame{display:block;width:100%;border:0;border-radius:12px;background:#F2F0E9;box-shadow:0 0 0 1px #E2DED3,0 6px 24px #1414130f}
 html[data-reserve-native-theme=dark] .reserve-pdf-frame{background:#1b1f26;box-shadow:0 0 0 1px #2c323c}
 #doc_preview.reserve-pdf-hidden{display:none!important}
 .reserve-pdf-frame[hidden]{display:none!important}`;
 function frameUrl(id,meta){
  const html=document.documentElement,p=new URLSearchParams({id,origin:location.origin,name:meta.display_name||'Document.pdf',size:String(meta.size||0),
   theme:html.getAttribute('data-reserve-native-theme')==='dark'?'dark':'light',accent:(html.style.getPropertyValue('--chn-accent')||'').trim()});
  return chrome.runtime.getURL('pdf-reader.html')+'#'+p.toString();
 }
 async function start(){
  const id=fileId();if(!id)return;
  const box=document.getElementById('doc_preview');if(!box||box.dataset.reservePdf)return;box.dataset.reservePdf='1';
  let meta=null;
  try{const r=await fetch(`/api/v1/files/${id}`,{headers:{Accept:'application/json'},credentials:'same-origin'});meta=r.ok?await r.json():null;}catch{}
  if(!meta||!/^application\/pdf$/i.test(meta['content-type']||'')||meta.locked_for_user)return;
  let url;try{url=frameUrl(id,meta);}catch{return;}   // a tab left over from an extension update: leave Canvas's viewer
  if(!document.getElementById('reserve-pdf-style')){const st=document.createElement('style');st.id='reserve-pdf-style';st.textContent=CSS;(document.head||document.documentElement).append(st);}
  const sw=document.createElement('div');sw.className='reserve-pdf-switch';sw.setAttribute('role','group');sw.setAttribute('aria-label','PDF viewer');
  sw.innerHTML='<button type="button" data-v="harness">Harness reader</button><button type="button" data-v="canvas">Canvas viewer</button>';
  const frame=document.createElement('iframe');frame.className='reserve-pdf-frame';frame.title='PDF reader';frame.allow='fullscreen';frame.src=url;
  box.before(sw,frame);
  const size=()=>{const top=frame.getBoundingClientRect().top+window.scrollY;frame.style.height=Math.max(560,Math.round(window.innerHeight-Math.min(top,140)-24))+'px';};
  // Canvas's own page script shows its viewer again once it has loaded (an inline display), so the hiding is a class
  // with !important that its script can't undo; the viewer itself is never removed.
  const show=v=>{const harness=v==='harness';frame.hidden=!harness;box.classList.toggle('reserve-pdf-hidden',harness);for(const b of sw.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.v===v));if(harness)size();};
  sw.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setPref(b.dataset.v);show(b.dataset.v);});
  // The reader asks to fall back when it can't open the file (or the student picks Canvas's viewer inside it).
  window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.data?.type!=='reserve-pdf')return;if(e.data.action==='fallback')show('canvas');});
  window.addEventListener('resize',()=>{if(!frame.hidden)size();},{passive:true});
  show(getPref());
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
