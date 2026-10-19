/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// The Harness PDF reader (pdf-reader.html; a module, hence .mjs), opened by pdf-view.js in place of Canvas's file viewer.
// PDF.js (vendor/pdfjs, Mozilla, Apache-2.0) draws the pages; a text layer makes text selectable, copyable and
// searchable; links in the PDF work (web links open in a new tab, links inside the document jump to their page).
// Only reads: the file comes from the student's own Canvas (the same download Canvas's button gives). No scripting,
// forms or annotations from the PDF are run. If anything fails, it hands the page back to Canvas's viewer.
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.hash.slice(1));
const ID=params.get('id')||'',ORIGIN=params.get('origin')||'',NAME=params.get('name')||'Document.pdf';
const embedded=window.top!==window;
// Local preview only (http://localhost, never inside the extension): #test=<path to a PDF on the preview server>.
const LOCAL=/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(location.origin),TEST=LOCAL&&/^\/[\w./ -]+\.pdf$/i.test(params.get('test')||'')?params.get('test'):'';
const valid=!!TEST||(/^\d{1,20}$/.test(ID)&&globalThis.ReserveSite?.supported?.(ORIGIN)&&new URL(ORIGIN).origin===ORIGIN);
const DOWNLOAD=TEST||(valid?`${ORIGIN}/files/${ID}/download?download_frd=1`:'#');

// theme and accent from the Canvas page (Harness's light/dark choice and its accent colour)
if(params.get('theme')==='dark')document.documentElement.dataset.theme='dark';
const accent=params.get('accent')||'';if(/^#[0-9a-f]{3,8}$/i.test(accent))document.documentElement.style.setProperty('--accent',accent);

const ICONS={
 thumbs:'<rect x="3.5" y="4" width="6" height="16" rx="1.5"/><path d="M13 6h7.5M13 10h7.5M13 14h7.5M13 18h5"/>',
 prev:'<path d="M14.5 6l-6 6 6 6"/>',next:'<path d="M9.5 6l6 6-6 6"/>',
 'zoom-out':'<path d="M6 12h12"/>','zoom-in':'<path d="M6 12h12M12 6v12"/>',
 'hit-prev':'<path d="M7 14.5l5-5 5 5"/>','hit-next':'<path d="M7 9.5l5 5 5-5"/>',
 rotate:'<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v4.6h-4.6"/>',
 download:'<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>',
 newtab:'<path d="M13.5 4.5h6v6M19.5 4.5l-8 8"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
 full:'<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/>'};
for(const b of document.querySelectorAll('.icon')){const k=b.dataset.do||b.id;if(ICONS[k])b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;}
$('name').textContent=NAME;$('name').title=NAME;document.title=NAME;
$('download').href=DOWNLOAD;$('download').setAttribute('download',NAME);
if(!embedded)document.querySelector('[data-do=newtab]').hidden=true;

const viewer=$('viewer'),pagesEl=$('pages'),statusEl=$('status');
const S={doc:null,lib:null,pages:[],mode:'width',scale:1,rotation:0,current:1,thumbsBuilt:false,
 text:null,query:'',hits:[],hit:-1};
const dpr=()=>Math.min(window.devicePixelRatio||1,3);
// PDF.js 5+ takes the canvas itself; older builds took its 2D context
const target=c=>Number(String(S.lib?.version||'0').split('.')[0])>=5?{canvas:c}:{canvasContext:c.getContext('2d',{alpha:false})};

function fail(message){
 statusEl.innerHTML='';const p=document.createElement('span');p.textContent=message;statusEl.append(p);
 if(embedded){const b=document.createElement('button');b.type='button';b.textContent="Use Canvas's viewer";b.onclick=()=>back();statusEl.append(document.createElement('br'),b);}
}
function back(){try{window.parent.postMessage({type:'reserve-pdf',action:'fallback'},ORIGIN);}catch{}}

async function open(){
 if(!valid){fail('This link is not a Canvas file.');return;}
 let data;
 try{
  const r=await fetch(DOWNLOAD,{credentials:'include',cache:'no-store'});
  if(!r.ok)throw new Error(String(r.status));
  data=new Uint8Array(await r.arrayBuffer());
  if(String.fromCharCode(...data.subarray(0,5))!=='%PDF-')throw new Error('not a PDF');
 }catch(e){fail("The reader couldn't load this file, so Canvas's viewer is shown instead.");back();return;}
 try{
  S.lib=await import('./vendor/pdfjs/pdf.mjs');
  S.lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  // The decoders and data PDF.js needs to draw every PDF the way Canvas's viewer does: scanned pages (JBIG2, JPEG 2000),
  // the 14 standard fonts PDFs leave out, Asian character maps and the CMYK colour profile. The image decoders run as
  // their plain-JavaScript builds, since the extension's security policy doesn't allow WebAssembly.
  const base=new URL('./vendor/pdfjs-data/',import.meta.url).href;
  const task=S.lib.getDocument({data,isEvalSupported:false,enableXfa:false,stopAtErrors:false,useWorkerFetch:true,useWasm:false,
   wasmUrl:base+'wasm/',standardFontDataUrl:base+'standard_fonts/',cMapUrl:base+'cmaps/',cMapPacked:true,iccUrl:base+'iccs/'});
  task.onPassword=()=>{task.destroy();fail('This PDF is password-protected. Use Canvas\'s viewer or download it.');back();};
  S.doc=await task.promise;
 }catch(e){fail("The reader couldn't open this PDF, so Canvas's viewer is shown instead.");back();return;}
 statusEl.textContent='';
 $('total').textContent=`of ${S.doc.numPages}`;
 const first=await S.doc.getPage(1),v=first.getViewport({scale:1});
 S.pages=Array.from({length:S.doc.numPages},(_,i)=>({n:i+1,w:v.width,h:v.height,page:i===0?first:null,el:null,key:'',task:null,busy:false}));
 build();layout();watch();
 // real page sizes (some PDFs mix sizes), without holding up the first view
 for(let i=1;i<S.pages.length;i++){const p=S.pages[i];try{p.page=await S.doc.getPage(p.n);const pv=p.page.getViewport({scale:1});if(Math.abs(pv.width-p.w)>1||Math.abs(pv.height-p.h)>1){p.w=pv.width;p.h=pv.height;p.sized=true;}}catch{}}
 if(S.pages.some(p=>p.sized))keepPlace(layout);
}

function build(){
 const frag=document.createDocumentFragment();
 for(const p of S.pages){
  const el=document.createElement('div');el.className='page';el.dataset.n=p.n;el.setAttribute('aria-label',`Page ${p.n}`);
  const num=document.createElement('span');num.className='num';num.textContent=p.n;el.append(num);
  p.el=el;frag.append(el);
 }
 pagesEl.append(frag);
}
const rotated=p=>S.rotation%180?{w:p.h,h:p.w}:{w:p.w,h:p.h};
function fitScale(){
 const maxW=Math.max(...S.pages.map(p=>rotated(p).w)),maxH=Math.max(...S.pages.map(p=>rotated(p).h));
 const width=(viewer.clientWidth-32-44)/maxW;
 if(S.mode==='width')return width;
 if(S.mode==='page')return Math.min(width,(viewer.clientHeight-44)/maxH);
 return Number(S.mode)||1;
}
function layout(){
 S.scale=Math.max(.25,Math.min(5,fitScale()));
 for(const p of S.pages){const r=rotated(p);p.el.style.width=Math.round(r.w*S.scale)+'px';p.el.style.height=Math.round(r.h*S.scale)+'px';p.el.style.setProperty('--scale-factor',S.scale);}
 const sel=$('zoom'),pct=Math.round(S.scale*100);
 if(S.mode==='width'||S.mode==='page')sel.value=S.mode;
 else{const opt=[...sel.options].find(o=>Number(o.value)&&Math.round(Number(o.value)*100)===pct);if(opt)sel.value=opt.value;else{const c=sel.querySelector('[value=custom]');c.textContent=pct+'%';c.hidden=false;sel.value='custom';}}
 refresh();
}
// keep the same spot of the same page while the layout changes
function keepPlace(change){
 const p=S.pages[S.current-1],top=p?.el.offsetTop??0,frac=p?(viewer.scrollTop-top)/Math.max(1,p.el.offsetHeight):0;
 change();
 if(p)viewer.scrollTop=p.el.offsetTop+frac*p.el.offsetHeight;
}
function setMode(mode){keepPlace(()=>{S.mode=mode;layout();});}
function zoomBy(f){setMode(String(Math.max(.25,Math.min(5,Math.round(S.scale*f*100)/100))));}

// drawing: only pages near the view, sharp on any screen; far pages give their memory back
let io=null;const near=new Set();
function watch(){
 io=new IntersectionObserver(es=>{for(const e of es){const n=Number(e.target.dataset.n);if(e.isIntersecting)near.add(n);else near.delete(n);}refresh();},{root:viewer,rootMargin:'120% 0px'});
 for(const p of S.pages)io.observe(p.el);
 viewer.addEventListener('scroll',onScroll,{passive:true});
 new ResizeObserver(()=>{if(S.mode==='width'||S.mode==='page')keepPlace(layout);}).observe(viewer);
}
function refresh(){
 for(const n of near)draw(S.pages[n-1]);
 // keep at most 6 drawn pages outside the view, the farthest ones go first
 const drawn=S.pages.filter(p=>p.key&&!near.has(p.n)).sort((a,b)=>Math.abs(b.n-S.current)-Math.abs(a.n-S.current));
 for(const p of drawn.slice(0,Math.max(0,drawn.length-6)))clear(p);
}
function clear(p){p.task?.cancel();p.task=null;p.key='';for(const n of p.el.querySelectorAll('canvas,.textLayer,.links'))n.remove();}
async function draw(p){
 const key=`${S.scale}|${S.rotation}`;if(p.key===key||p.busy)return;
 p.busy=true;
 try{
  p.page??=await S.doc.getPage(p.n);
  if(p.key===key)return;
  p.task?.cancel();
  const viewport=p.page.getViewport({scale:S.scale,rotation:S.rotation}),ratio=dpr();
  const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
  const task=p.page.render({...target(canvas),viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null,annotationMode:S.lib.AnnotationMode?.ENABLE??1});
  p.task=task;await task.promise;
  if(`${S.scale}|${S.rotation}`!==key)return;
  for(const n of p.el.querySelectorAll('canvas,.textLayer,.links'))n.remove();
  p.el.prepend(canvas);p.key=key;p.task=null;
  const tl=document.createElement('div');tl.className='textLayer';p.el.append(tl);
  const textLayer=new S.lib.TextLayer({textContentSource:p.page.streamTextContent({includeMarkedContent:true,disableNormalization:true}),container:tl,viewport});
  textLayer.render().then(()=>mark(p)).catch(()=>{});
  links(p,viewport);
 }catch(e){if(e?.name!=='RenderingCancelledException')p.key='';}
 finally{p.busy=false;}
 if(near.has(p.n)&&p.key!==`${S.scale}|${S.rotation}`)draw(p);
}
async function links(p,viewport){
 let annots=[];try{annots=await p.page.getAnnotations({intent:'display'});}catch{return;}
 const box=document.createElement('div');box.className='links';
 for(const a of annots){
  if(a.subtype!=='Link')continue;
  // PDF space -> page pixels with the viewport's own transform (PDF.js 6 no longer has convertToViewportRectangle)
  const [m0,m1,m2,m3,m4,m5]=viewport.transform,pt=(x,y)=>[m0*x+m2*y+m4,m1*x+m3*y+m5];
  const [x1,y1]=pt(a.rect[0],a.rect[1]),[x2,y2]=pt(a.rect[2],a.rect[3]),left=Math.min(x1,x2),top=Math.min(y1,y2);
  const el=document.createElement('a');Object.assign(el.style,{left:left+'px',top:top+'px',width:Math.abs(x2-x1)+'px',height:Math.abs(y2-y1)+'px'});
  if(a.url&&/^(https?:|mailto:)/i.test(a.url)){el.href=a.url;el.target='_blank';el.rel='noopener noreferrer';el.title=a.url;}
  else if(a.dest){el.href='#';el.title='Go to the linked page';el.addEventListener('click',e=>{e.preventDefault();follow(a.dest);});}
  else continue;
  box.append(el);
 }
 if(box.childElementCount)p.el.append(box);
}
async function follow(dest){
 try{const d=typeof dest==='string'?await S.doc.getDestination(dest):dest;if(!d)return;
  const ref=d[0],index=typeof ref==='number'?ref:await S.doc.getPageIndex(ref);go(index+1);}catch{}
}

// where we are
let ticking=0;
function onScroll(){if(!ticking)ticking=requestAnimationFrame(()=>{ticking=0;track();});}
function track(){
 const y=viewer.scrollTop+viewer.clientHeight*.35;let lo=0,hi=S.pages.length-1;
 while(lo<hi){const mid=(lo+hi+1)>>1;if(S.pages[mid].el.offsetTop<=y)lo=mid;else hi=mid-1;}
 setCurrent(lo+1);
}
function setCurrent(n,force){
 if(!force&&n===S.current&&$('page').value===String(n))return;S.current=n;
 if(document.activeElement!==$('page'))$('page').value=n;
 document.querySelector('[data-do=prev]').disabled=n<=1;document.querySelector('[data-do=next]').disabled=n>=S.pages.length;
 for(const t of document.querySelectorAll('.thumb'))t.setAttribute('aria-current',String(Number(t.dataset.n)===n));
 document.querySelector(`.thumb[data-n="${n}"]`)?.scrollIntoView({block:'nearest'});
}
function go(n){n=Math.max(1,Math.min(S.pages.length,n|0));const p=S.pages[n-1];if(!p)return;viewer.scrollTop=p.el.offsetTop-12;setCurrent(n);}

// page strip
function thumbs(){
 const nav=$('thumbs'),open=nav.hidden;nav.hidden=!open;document.querySelector('[data-do=thumbs]').setAttribute('aria-pressed',String(open));
 if(open&&!S.thumbsBuilt&&S.doc){
  S.thumbsBuilt=true;
  const tio=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){tio.unobserve(e.target);thumb(e.target);}},{root:nav,rootMargin:'200px 0px'});
  for(const p of S.pages){const b=document.createElement('button');b.type='button';b.className='thumb';b.dataset.n=p.n;b.setAttribute('aria-label',`Page ${p.n}`);
   const ph=document.createElement('span');ph.className='ph';ph.style.aspectRatio=`${p.w} / ${p.h}`;b.append(ph,document.createTextNode(String(p.n)));
   b.onclick=()=>go(p.n);nav.append(b);tio.observe(b);}
  setCurrent(S.current,true);
 }
 if(S.mode==='width'||S.mode==='page')keepPlace(layout);
}
async function thumb(b){
 const p=S.pages[Number(b.dataset.n)-1];try{
  p.page??=await S.doc.getPage(p.n);const v1=p.page.getViewport({scale:1}),v=p.page.getViewport({scale:(126/v1.width)*dpr()});
  const c=document.createElement('canvas');c.width=Math.floor(v.width);c.height=Math.floor(v.height);
  await p.page.render({...target(c),viewport:v,annotationMode:S.lib.AnnotationMode?.ENABLE??1}).promise;b.querySelector('.ph')?.replaceWith(c);}catch{}
}

// search: every page's text once, matches listed in order, the current one highlighted
async function index(){
 if(S.text)return S.text;
 const all=[];
 for(const p of S.pages){
  try{p.page??=await S.doc.getPage(p.n);const tc=await p.page.getTextContent({disableNormalization:true});
   let str='';const items=[];for(const it of tc.items){if(typeof it.str!=='string')continue;if(it.str){items.push({start:str.length,end:str.length+it.str.length});}str+=it.str+(it.hasEOL?'\n':'');}
   all.push({str:str.toLowerCase(),items});}catch{all.push({str:'',items:[]});}
 }
 return S.text=all;
}
async function search(q){
 S.query=q.trim().toLowerCase();S.hits=[];S.hit=-1;$('hits').textContent='';
 for(const p of S.pages)mark(p);
 if(!S.query||!S.doc)return;
 $('hits').textContent='…';
 const text=await index();if(S.query!==q.trim().toLowerCase())return;
 text.forEach((t,i)=>{let at=t.str.indexOf(S.query);while(at!==-1){S.hits.push({page:i+1,start:at,end:at+S.query.length});at=t.str.indexOf(S.query,at+1);}});
 if(!S.hits.length){$('hits').textContent='No matches';return;}
 const after=S.hits.findIndex(h=>h.page>=S.current);step(0,after<0?0:after);
}
function step(d,to){
 if(!S.hits.length)return;
 S.hit=to??((S.hit+d+S.hits.length)%S.hits.length);
 const h=S.hits[S.hit];$('hits').textContent=`${S.hit+1} of ${S.hits.length}`;
 const p=S.pages[h.page-1];
 if(Math.abs(p.el.offsetTop-viewer.scrollTop)>viewer.clientHeight*.6||h.page!==S.current)go(h.page);
 for(const q of S.pages)mark(q);
 requestAnimationFrame(()=>{const now=p.el.querySelector('.textLayer mark.now');if(now){const r=now.getBoundingClientRect(),vr=viewer.getBoundingClientRect();if(r.top<vr.top+60||r.bottom>vr.bottom-40)viewer.scrollTop+=r.top-vr.top-vr.height*.35;}});
}
// Highlights only the matched characters: the matched part of each text-layer span is wrapped in <mark>.
function mark(p){
 const tl=p.el?.querySelector('.textLayer');if(!tl)return;
 const spans=[...tl.querySelectorAll('span:not(.markedContent)')];
 for(const s of spans)if(s.dataset.t!==undefined){s.textContent=s.dataset.t;delete s.dataset.t;}
 if(!S.query||!S.text)return;const t=S.text[p.n-1];if(!t)return;
 const per=new Map();// span index -> [[from,to,current]]
 S.hits.forEach((h,k)=>{if(h.page!==p.n)return;
  t.items.forEach((it,i)=>{if(it.end>h.start&&it.start<h.end&&spans[i]){const a=Math.max(h.start,it.start)-it.start,b=Math.min(h.end,it.end)-it.start;(per.get(i)||per.set(i,[]).get(i)).push([a,b,k===S.hit]);}});});
 for(const [i,ranges] of per){
  const s=spans[i],text=s.textContent;if(text.length!==t.items[i].end-t.items[i].start)continue;
  s.dataset.t=text;s.textContent='';let at=0;
  for(const [a,b,now] of ranges.sort((x,y)=>x[0]-y[0])){if(a<at)continue;if(a>at)s.append(text.slice(at,a));const m=document.createElement('mark');m.textContent=text.slice(a,b);if(now)m.className='now';s.append(m);at=b;}
  if(at<text.length)s.append(text.slice(at));
 }
}

// controls
document.querySelector('.bar').addEventListener('click',e=>{
 const b=e.target.closest('[data-do]');if(!b||b.disabled)return;
 ({thumbs,prev:()=>go(S.current-1),next:()=>go(S.current+1),'zoom-out':()=>zoomBy(1/1.2),'zoom-in':()=>zoomBy(1.2),
  rotate:()=>keepPlace(()=>{S.rotation=(S.rotation+90)%360;for(const p of S.pages)p.key='';layout();}),
  'hit-prev':()=>step(-1),'hit-next':()=>step(1),
  newtab:()=>window.open(location.href,'_blank','noopener'),
  full:()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.().catch(()=>{})})[b.dataset.do]?.();
});
$('zoom').addEventListener('change',e=>setMode(e.target.value==='custom'?String(S.scale):e.target.value));
$('page').addEventListener('change',e=>go(Number(e.target.value)));
$('page').addEventListener('keydown',e=>{if(e.key==='Enter'){go(Number(e.target.value));viewer.focus();}});
$('page').addEventListener('blur',e=>{e.target.value=S.current;});
let searchTimer=0;
$('q').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(e.target.value),250);});
$('q').addEventListener('keydown',e=>{
 if(e.key==='Enter'){e.preventDefault();clearTimeout(searchTimer);if(S.query!==e.target.value.trim().toLowerCase())search(e.target.value);else step(e.shiftKey?-1:1);}
 if(e.key==='Escape'){e.target.value='';search('');viewer.focus();}
});
window.addEventListener('keydown',e=>{
 const typing=e.target.matches?.('input,select,textarea');
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'){e.preventDefault();$('q').focus();$('q').select();return;}
 if((e.metaKey||e.ctrlKey)&&(e.key==='='||e.key==='+')){e.preventDefault();zoomBy(1.2);return;}
 if((e.metaKey||e.ctrlKey)&&e.key==='-'){e.preventDefault();zoomBy(1/1.2);return;}
 if((e.metaKey||e.ctrlKey)&&e.key==='0'){e.preventDefault();setMode('width');return;}
 if(typing||e.metaKey||e.ctrlKey||e.altKey)return;
 const k=e.key;
 if(k==='+'||k==='=')zoomBy(1.2);else if(k==='-')zoomBy(1/1.2);
 else if(k==='ArrowRight')go(S.current+1);else if(k==='ArrowLeft')go(S.current-1);
 else if(k==='Home')go(1);else if(k==='End')go(S.pages.length);else if(k==='f')document.querySelector('[data-do=full]').click();
 else return;e.preventDefault();
});
// pinch on a trackpad (or Ctrl + wheel) zooms
let pinch=1,pinchFrame=0;
viewer.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();pinch*=Math.exp(-e.deltaY*0.01);
 if(!pinchFrame)pinchFrame=requestAnimationFrame(()=>{pinchFrame=0;const f=pinch;pinch=1;if(Math.abs(f-1)>.01)zoomBy(f);});},{passive:false});
document.addEventListener('selectionchange',()=>{for(const t of document.querySelectorAll('.textLayer'))t.classList.toggle('selecting',!!document.getSelection()?.toString());});

open();
