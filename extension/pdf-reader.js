/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.ReservePdfReader=api;api.start();}
})(globalThis,function(root){
 'use strict';
 const SVG='http://www.w3.org/2000/svg';
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const cancelled=e=>e?.name==='RenderingCancelledException'||e?.name==='AbortException';
 // A single queue owns every canvas render, including idle thumbnails. Cancelling
 // invalidates async getPage/text work as well as the active PDF.js render task.
 class RenderQueue{
  constructor(render,onError=()=>{}){this.render=render;this.onError=onError;this.jobs=[];this.generation=0;this.running=false;this.paused=false;this.cancelActive=null;this.done=Promise.resolve();}
  set(jobs){this.jobs=jobs.slice();return this.pump();}
  cancel(){this.generation++;this.jobs=[];this.cancelActive?.();this.cancelActive=null;}
  pause(value){this.paused=value;if(value)this.cancel();else return this.pump();}
  pump(){
   if(this.running||this.paused)return this.done;
   this.running=true;
   this.done=(async()=>{
    while(this.jobs.length&&!this.paused){
     const job=this.jobs.shift(),generation=this.generation;
     const current=()=>generation===this.generation&&!this.paused;
     try{await this.render(job,{current,setCancel:fn=>{if(current())this.cancelActive=fn;else fn();}});}
     catch(error){if(current()&&!cancelled(error))this.onError(error,job);}
     finally{this.cancelActive=null;}
    }
   })().finally(()=>{this.running=false;if(this.jobs.length&&!this.paused)void this.pump();});
   return this.done;
  }
 }
 function occurrences(text,query){
  if(!query)return [];
  const haystack=text.toLocaleLowerCase(),needle=query.toLocaleLowerCase(),out=[];
  for(let at=0;(at=haystack.indexOf(needle,at))!==-1;at+=needle.length){out.push({start:at,end:at+needle.length});if(out.length>=10000)break;}
  return out;
 }
 function searchText(items){
  let text='',cursor=0;const starts=[],ends=[];
  const append=(char,start,end)=>{if(/\s/.test(char)){if(text.endsWith(' ')){ends[ends.length-1]=end;return;}char=' ';}text+=char;starts.push(start);ends.push(end);};
  for(const item of items){for(const char of (item.str||'').split('')){append(char,cursor,cursor+1);cursor++;}if(item.hasEOL)append(' ',cursor,cursor);}
  return {text,starts,ends};
 }
 function smoothPath(points){
  if(!points.length)return '';
  let path=`M ${points[0][0]} ${points[0][1]}`;
  for(let i=1;i<points.length-1;i++)path+=` Q ${points[i][0]} ${points[i][1]} ${(points[i][0]+points[i+1][0])/2} ${(points[i][1]+points[i+1][1])/2}`;
  const last=points.at(-1);return path+` L ${last[0]} ${last[1]}`;
 }
 function createReader(env=root,{library=null,model=env.ReservePdfModel}={}){
  let aiEnabled=false,selectionAI=null;
  const canAI=()=>aiEnabled;
  const doc=env.document,$=id=>doc.getElementById(id),scroll=$('page-scroll');
  const query=new URLSearchParams(env.location.search),parentOrigin=query.get('parentOrigin'),token=query.get('token');
  let alive=true,initialised=false,loading=null,pdf=null,lib=library,worker=null,pdfWorker=null,meta=null,storageWritable=false,teardown=Promise.resolve();
  let originalBytes=null,spread=false,maximised=false,accountTurn=0,accountWait=null,session=null;const sessions=new Map();
  let slots=[],visible=new Set(),currentPage=0,zoom=1,fit=true,tool='',colour='#F6DE7A',annotations=model.createAnnotations();
  let saveTimer=0,searchTimer=0,searchRevision=0,searchCursor=0,searchBusy=false;
  let matches=[],matchIndex=-1,searchQuery='',searchComplete=false,selection=null,noteDraft=null,stroke=null;
  let idleId=0,idleFallback=false,thumbReady=false,sideOpen=false,sideTab='thumbnails',thumbObserver=null;
  const thumbVisible=new Set(),thumbButtons=[],buttons={},off=new AbortController(),signal=off.signal;
  const textReaders=new Set(),cancelledReaders=new WeakSet();let textGeneration=0;
  const send=(type,data={})=>{if((alive||type==='reserve-pdf-close'||type==='reserve-pdf-close-result')&&parentOrigin&&token)env.parent.postMessage({type,token,...data},parentOrigin);};
  const notice=message=>{$('status').textContent=message;};
  const listen=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal});
  function makeButton(name,label,action,parent=$('toolbar')){
   const button=doc.createElement('button');button.type='button';button.className='pa-i';button.title=label;button.setAttribute('aria-label',label);
   button.innerHTML=env.ReservePdfArt.icons[name]||env.ReservePdfArt.icons.side;
   listen(button,'click',action);parent.append(button);return button;
  }
  function rule(){const line=doc.createElement('span');line.className='toolbar-rule';line.setAttribute('aria-hidden','true');$('toolbar').append(line);}
  function syncAI(){const allowed=canAI();if(buttons.ai){buttons.ai.hidden=!allowed;if(!allowed)buttons.ai.disabled=true;}if(selectionAI){selectionAI.hidden=!allowed;selectionAI.disabled=!allowed;}}
  function applyTheme(value){
   doc.documentElement.dataset.theme=model.theme(value);
   doc.documentElement.dataset.motion=['still','off'].includes(value?.motion)?value.motion:'gentle';
  }
  function setTool(next){
   tool=tool===next?'':next;doc.body.className=tool?'tool-'+tool:'';
   for(const name of ['highlight','underline','note','pen','eraser']){buttons[name].classList.toggle('is-active',tool===name);buttons[name].setAttribute('aria-pressed',String(tool===name));}
   $('selection-menu').hidden=true;closeMarkMenu();
   if(tool!=='highlight')$('pen-palette').hidden=true;
  }
  function popupAt(element,x,y){element.hidden=false;const r=element.getBoundingClientRect();element.style.left=clamp(x,8,Math.max(8,env.innerWidth-r.width-8))+'px';element.style.top=clamp(y,8,Math.max(8,env.innerHeight-r.height-8))+'px';}
  function palette(parent,onChoose){
   for(const [name,value]of Object.entries(env.ReservePdfArt.pens)){
    const button=doc.createElement('button');button.type='button';button.title=name+' highlighter';button.setAttribute('aria-label',name+' highlighter');button.setAttribute('aria-pressed',String(colour===value));
    const chip=doc.createElement('span');chip.className='colour-chip';chip.style.background=value;button.append(chip);parent.append(button);
    listen(button,'click',()=>{colour=value;buttons.highlight.style.setProperty('--pen',value);buttons.underline.style.setProperty('--pen',value);for(const b of parent.children)b.setAttribute('aria-pressed',String(b===button));onChoose(value);});
   }
  }
  function buildToolbar(){
   buttons.side=makeButton('side','Show page navigation',toggleSide);buttons.side.setAttribute('aria-expanded','false');rule();
   buttons.prev=makeButton('prev','Previous page',()=>go(currentPage-1));
   const control=doc.createElement('label');control.className='page-control';control.setAttribute('aria-label','Page number');
   const input=doc.createElement('input');input.id='page-number';input.type='number';input.min='1';input.value='1';input.setAttribute('aria-label','Page number');
   const count=doc.createElement('span');count.id='page-total';count.textContent='/ —';control.append(input,count);$('toolbar').append(control);
   listen(input,'change',()=>go(Number(input.value)-1));listen(input,'keydown',e=>{if(e.key==='Enter'){go(Number(input.value)-1);scroll.focus();}});
   buttons.next=makeButton('next','Next page',()=>go(currentPage+1));rule();
   buttons.zoomOut=makeButton('zoomOut','Zoom out (−)',()=>setZoom(zoom/1.2));
   const zoomLabel=doc.createElement('span');zoomLabel.id='zoom-label';zoomLabel.textContent='100%';$('toolbar').append(zoomLabel);
   buttons.zoomIn=makeButton('zoomIn','Zoom in (+)',()=>setZoom(zoom*1.2));
   buttons.fit=makeButton('fit','Fit page width',()=>{fit=true;fitWidth();});buttons.fit.setAttribute('aria-pressed','true');
   buttons.spread=makeButton('spread','Two pages side by side',toggleSpread);buttons.spread.setAttribute('aria-pressed','false');
   buttons.search=makeButton('search','Find in document (Ctrl or Command F)',()=>toggleSearch());rule();
   for(const name of ['highlight','underline','note','pen','eraser'])buttons[name]=makeButton(name,({highlight:'Highlight text / choose colour',underline:'Underline text',note:'Add a note',pen:'Draw with pen',eraser:'Erase an annotation'})[name],()=>{
    setTool(name);
    if(name==='highlight'){
     const p=$('pen-palette'),r=buttons.highlight.getBoundingClientRect();popupAt(p,r.left,r.bottom+8);
     if(selection)annotateSelection('highlight');
    }else if(selection&&name==='underline')annotateSelection('underline');
    else if(selection&&name==='note')noteSelection();
   });
   buttons.undo=makeButton('undo','Undo last annotation',()=>{if(!annotationAccess())return;try{if(annotations.undo())changed();}catch(error){notice(error.message);}});rule();
   buttons.ai=makeButton('ai','Ask AI about pages of this PDF',()=>openAskRange());buttons.ai.setAttribute('aria-haspopup','dialog');
   buttons.fullscreen=makeButton('fullscreen','Fill the window',()=>send('reserve-pdf-fullscreen'),$('heading-actions'));
   buttons.save=makeButton('save','Save a copy with my marks',()=>void saveWithMarks(),$('heading-actions'));
   const download=doc.createElement('a');download.className='pa-i';download.title='Download original Canvas file';download.setAttribute('aria-label',download.title);download.target='_blank';download.rel='noopener noreferrer';download.innerHTML=env.ReservePdfArt.icons.download;$('heading-actions').append(download);buttons.download=download;
   buttons.close=makeButton('close','Close PDF reader (Escape)',close,$('heading-actions'));
   makeButton('prev','Previous search match',()=>findNext(-1),$('find-actions'));makeButton('next','Next search match',()=>findNext(1),$('find-actions'));makeButton('close','Close search',()=>toggleSearch(false),$('find-actions'));
   palette($('pen-palette'),()=>{$('pen-palette').hidden=true;});
   palette($('selection-menu'),()=>annotateSelection('highlight'));
   for(const [name,label,action]of [['note','Note',noteSelection],['ai','Ask AI',()=>{if(selection)ask(selection.text,selection.parts[0]?.page||0);}],['','Copy',()=>void copySelection()]]){
    const b=doc.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',label+' selected text');if(name==='ai')selectionAI=b;listen(b,'click',action);$('selection-menu').append(b);
   }
   for(const [name,b]of Object.entries(buttons))if(name!=='close')b.disabled=true;
  }
  function pageViewport(slot){return slot.viewport;}
  function resizeSlot(slot){
   const width=slot.base.width*zoom,height=slot.base.height*zoom;
   slot.node.style.width=width+'px';slot.node.style.height=height+'px';
   slot.node.style.setProperty('--total-scale-factor',zoom*(slot.base.userUnit||1));slot.node.style.setProperty('--scale-round-x','1px');slot.node.style.setProperty('--scale-round-y','1px');
  }
  async function readText(page,attachCancel=()=>{}){
   // PDF.js streams can be cancelled when the document is hidden. The fallback
   // is solely for library doubles/older local builds without streaming text.
   if(!page.streamTextContent)return page.getTextContent();
   const reader=page.streamTextContent().getReader(),content={items:[],styles:{},lang:null},generation=textGeneration;textReaders.add(reader);
   attachCancel(()=>cancelReader(reader));
   try{
    while(alive&&!doc.hidden&&generation===textGeneration){const {value,done}=await reader.read();if(generation!==textGeneration||doc.hidden||!alive)break;if(done)return content;content.items.push(...value.items);Object.assign(content.styles,value.styles);content.lang??=value.lang;}
    const error=Error('Text reading paused');error.name='AbortException';throw error;
   }finally{textReaders.delete(reader);reader.releaseLock();}
  }
  function cancelReader(reader){if(cancelledReaders.has(reader))return;cancelledReaders.add(reader);void reader.cancel(new Error('PDF text job cancelled')).catch(()=>{});}
  function cancelText(){textGeneration++;for(const reader of textReaders)cancelReader(reader);}
  function pageNumber(index){return clamp(Math.round(index)||0,0,Math.max(0,slots.length-1));}
  function setCurrent(index){
   const previous=currentPage;currentPage=pageNumber(index);if(fit&&currentPage!==previous)fitWidth();if(doc.activeElement!==$('page-number'))$('page-number').value=String(currentPage+1);
   buttons.prev.disabled=currentPage===0;buttons.next.disabled=currentPage===slots.length-1;
   thumbButtons.forEach((button,i)=>{if(i===currentPage)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  }
  function go(index){
   if(!pdf)return;
   index=pageNumber(index);scroll.scrollTop=slots[index].node.offsetTop-$('pages').offsetTop;setCurrent(index);
   visible=new Set([index]);schedule();
  }
  // Fit: one page to the width, or two (side by side, with the gap between them) in the two-page view.
  function fitZoom(slot){return spread?(scroll.clientWidth-34-16)/(2*slot.base.width):(scroll.clientWidth-34)/slot.base.width;}
  function fitWidth(){if(!slots.length)return;const slot=slots[currentPage];setZoom(fitZoom(slot),true);}
  function toggleSpread(){
   spread=!spread;doc.documentElement.classList.toggle('spread',spread);
   buttons.spread.classList.toggle('is-active',spread);buttons.spread.setAttribute('aria-pressed',String(spread));buttons.spread.title=buttons.spread.ariaLabel=spread?'One page at a time':'Two pages side by side';
   buttons.spread.setAttribute('aria-label',buttons.spread.title);
   if(fit)fitWidth();else if(slots[currentPage])go(currentPage);
  }
  function setZoom(value,fromFit=false){
   value=clamp(value,.2,4);fit=fromFit;buttons.fit.classList.toggle('is-active',fit);buttons.fit.setAttribute('aria-pressed',String(fit));
   if(Math.abs(value-zoom)<.002)return;
   const slot=slots[currentPage],fraction=slot?(scroll.scrollTop-slot.node.offsetTop)/Math.max(1,slot.node.offsetHeight):0;
   if(stroke)endPen({pointerId:stroke.id},true);
   // What is on screen stays: the drawn page stretches to the new size (text and annotations follow exactly,
   // through --total-scale-factor and a redrawn overlay) until its sharp redraw replaces it. Nothing blanks.
   queue.cancel();zoom=value;slots.forEach(s=>{s.failed=false;s.rendered=false;resizeSlot(s);stretch(s);});
   $('zoom-label').textContent=Math.round(zoom*100)+'%';
   if(slot)scroll.scrollTop=slot.node.offsetTop+fraction*slot.node.offsetHeight;
   visible=new Set([currentPage]);schedule();
  }
  function stretch(slot){
   if(slot.canvas){slot.canvas.style.width=slot.base.width*zoom+'px';slot.canvas.style.height=slot.base.height*zoom+'px';}
   if(slot.page){slot.viewport=slot.page.getViewport({scale:zoom});if(slot.overlay)drawAnnotations(slot);}
   else if(!slot.canvas)slot.viewport=null;
  }
  function freePage(slot){
   slot.textTask?.cancel();slot.textTask=null;slot.canvas?.remove();if(slot.canvas){slot.canvas.width=0;slot.canvas.height=0;}slot.canvas=null;
   slot.textLayer?.remove();slot.textLayer=null;slot.overlay?.remove();slot.overlay=null;slot.viewport=null;slot.rendered=false;
   slot.page?.cleanup();slot.page=null;
  }
  const queue=new RenderQueue(renderJob,(error,job)=>{if(job.kind==='page'){const slot=slots[job.index];if(slot){freePage(slot);slot.failed=true;}}notice('This page could not be drawn: '+error.message+'. Use Download to open the original.');});
  function schedule(){
   if(!pdf||doc.hidden||!alive)return;
   if(!visible.size)visible.add(currentPage);
   const resident=slots.filter(s=>s.canvas||s.page).map(s=>s.index),window=model.renderWindow([...visible],slots.length,resident),freeing=new Set(window.free);
   slots.filter(s=>s.rendering).forEach(s=>{s.release=freeing.has(s.index);});
   window.free.forEach(index=>{if(!slots[index].rendering)freePage(slots[index]);});
   const wanted=window.render.filter(index=>!slots[index].rendered&&!slots[index].rendering&&!slots[index].failed);
   wanted.sort((a,b)=>Number(visible.has(b))-Number(visible.has(a))||Math.abs(a-currentPage)-Math.abs(b-currentPage));
   const jobs=wanted.map(index=>({kind:'page',index}));
   if(thumbReady&&sideOpen&&sideTab==='thumbnails')for(const index of thumbVisible)if(!slots[index].thumbnail&&!slots[index].thumbRendering)jobs.push({kind:'thumb',index});
   void queue.set(jobs);
  }
  async function renderJob(job,{current,setCancel}){
   const slot=slots[job.index];if(!slot||!current()||!alive)return;
   if(job.kind==='thumb')return renderThumb(slot,{current,setCancel});
   if(slot.rendered||slot.rendering||slot.failed)return;
   slot.rendering=true;
   let page;
   try{
    page=slot.page||await pdf.getPage(slot.index+1);if(!current())return;
    slot.page=page;const width=slot.base.width;slot.base=page.getViewport({scale:1});if(fit&&slot.index===currentPage&&width!==slot.base.width)fitWidth();if(!current())return;resizeSlot(slot);
    const viewport=page.getViewport({scale:zoom}),ratio=Math.min(env.devicePixelRatio||1,2),canvas=doc.createElement('canvas');
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';canvas.setAttribute('aria-hidden','true');
    const task=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0],annotationMode:lib.AnnotationMode.ENABLE});setCancel(()=>{task.cancel();slot.textTask?.cancel();});
    const discard=()=>{canvas.width=0;canvas.height=0;};
    try{await task.promise;}catch(error){discard();throw error;}if(!current()){discard();return;}
    const content=await readText(page,cancel=>setCancel(()=>{task.cancel();slot.textTask?.cancel();cancel();}));if(!current()){discard();return;}
    const layer=doc.createElement('div');layer.className='textLayer';
    const textTask=new lib.TextLayer({textContentSource:content,container:layer,viewport});slot.textTask=textTask;
    await textTask.render();if(!current()){discard();return;}
    // swap: the old (stretched) drawing leaves in the same frame the new one arrives
    if(slot.canvas&&slot.canvas!==canvas){slot.canvas.width=0;slot.canvas.height=0;slot.canvas.remove();}
    slot.textLayer?.remove();
    slot.viewport=viewport;slot.canvas=canvas;slot.textLayer=layer;slot.node.append(canvas,layer);
    slot.textTask=null;slot.rendered=true;drawAnnotations(slot);markSearch(slot);if(matches[matchIndex]?.page===slot.index)revealMatch();noticeIfLoaded();
   }finally{
    slot.rendering=false;
    if(slot.release){slot.release=false;freePage(slot);if(page&&page!==slot.page)page.cleanup();}
    else if(page&&!slot.page)page.cleanup();
    if(alive&&!doc.hidden)schedule();
   }
  }
  function noticeIfLoaded(){if($('status').textContent==='Opening your document…'||$('status').textContent==='Drawing pages…')notice('');}
  function cancelIdle(){if(idleId){if(idleFallback)env.clearTimeout(idleId);else env.cancelIdleCallback(idleId);idleId=0;}}
  function idleThumbnails(){
   if(idleId||!sideOpen||sideTab!=='thumbnails'||doc.hidden||!pdf)return;
   const run=()=>{idleId=0;if(!doc.hidden&&sideOpen&&sideTab==='thumbnails'){thumbReady=true;schedule();}};
   idleFallback=!env.requestIdleCallback;idleId=idleFallback?env.setTimeout(run,80):env.requestIdleCallback(run,{timeout:800});
  }
  async function renderThumb(slot,{current,setCancel}){
   if(!sideOpen||sideTab!=='thumbnails'||slot.thumbnail||slot.thumbRendering||!thumbVisible.has(slot.index))return;
   slot.thumbRendering=true;let page,canvas,task;
   try{
    page=await pdf.getPage(slot.index+1);if(!current()||!sideOpen)return;
    const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(100/base.width,122/base.height)});
    canvas=doc.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-hidden','true');
    task=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,annotationMode:lib.AnnotationMode.ENABLE});setCancel(()=>task.cancel());await task.promise;
    if(!current()||!sideOpen||sideTab!=='thumbnails')return;
    slot.thumbnail=canvas;thumbButtons[slot.index].prepend(canvas);canvas=null;
   }finally{slot.thumbRendering=false;if(canvas){canvas.width=0;canvas.height=0;}if(page&&page!==slot.page)page.cleanup();}
  }
  function freeThumbnails(){
   for(const slot of slots)if(slot.thumbnail){slot.thumbnail.remove();slot.thumbnail.width=0;slot.thumbnail.height=0;slot.thumbnail=null;}
  }
  function toggleSide(){
   sideOpen=!sideOpen;$('side-view').hidden=!sideOpen;buttons.side.classList.toggle('is-active',sideOpen);buttons.side.setAttribute('aria-expanded',String(sideOpen));
   thumbReady=false;if(sideOpen)idleThumbnails();else{cancelIdle();queue.cancel();freeThumbnails();schedule();}
   if(fit)fitWidth();
  }
  function switchSide(tab){
   sideTab=tab;for(const name of ['thumbnails','outline']){$(name).hidden=name!==tab;$(name+'-tab').setAttribute('aria-selected',String(name===tab));$(name+'-tab').tabIndex=name===tab?0:-1;}
   thumbReady=false;if(tab==='thumbnails')idleThumbnails();else{cancelIdle();queue.cancel();freeThumbnails();schedule();}
  }
  async function buildOutline(){
   const outline=await pdf.getOutline();if(!alive||!outline?.length)return;
   $('outline-tab').hidden=false;
   function tree(items,parent){
    const ul=doc.createElement('ul');parent.append(ul);
    for(const item of items){
     const li=doc.createElement('li'),button=doc.createElement('button');button.type='button';button.textContent=item.title||'Untitled section';li.append(button);ul.append(li);
     listen(button,'click',()=>void(async()=>{try{const dest=typeof item.dest==='string'?await pdf.getDestination(item.dest):item.dest;if(!dest)return;const index=typeof dest[0]==='number'?dest[0]:await pdf.getPageIndex(dest[0]);if(alive)go(index);}catch{notice('That outline destination is unavailable.');}})());
     if(item.items?.length)tree(item.items,li);
    }
   }
   tree(outline,$('outline'));
  }
  function svgElement(name,attrs={}){const el=doc.createElementNS(SVG,name);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));return el;}
  // a highlighter stroke, not a box: chisel ends, edges that wander a little (the same for an annotation every time)
  // Text spans overlap; drawn one by one their colour stacks darker. Rectangles that share a line become one
  // (viewport units [left,top,right,bottom]), so a highlight or a selection is one marker stroke per line.
  function mergeLines(rects){
   const list=rects.filter(r=>r[2]-r[0]>=.5&&r[3]-r[1]>=.5).map(r=>r.slice()).sort((a,b)=>a[1]-b[1]||a[0]-b[0]),lines=[];
   for(const r of list){
    const h=r[3]-r[1],line=lines.find(l=>Math.min(l.b,r[3])-Math.max(l.t,r[1])>=.5*Math.min(h,l.b-l.t));
    if(line){line.items.push(r);line.t=Math.min(line.t,r[1]);line.b=Math.max(line.b,r[3]);}else lines.push({t:r[1],b:r[3],items:[r]});
   }
   const out=[];
   for(const line of lines){
    const height=line.b-line.t;let run=null;
    for(const r of line.items.sort((a,b)=>a[0]-b[0])){
     if(run&&r[0]<=run[2]+height*.45)run[2]=Math.max(run[2],r[2]);else{run=[r[0],line.t,r[2],line.b];out.push(run);}
    }
   }
   return out;
  }
  function inkLine(x,y,w,seed){
   let n=0;for(const c of String(seed))n=(n*31+c.charCodeAt(0))>>>0;const r=()=>(n=(n*1103515245+12345)>>>0)/4294967296-.5;
   const steps=Math.max(2,Math.round(w/26));let d='M'+x.toFixed(1)+' '+(y+r()*.8).toFixed(1);
   for(let i=1;i<=steps;i++)d+='L'+(x+w*i/steps).toFixed(1)+' '+(y+r()*1.2).toFixed(1);
   return d;
  }
  function markerPath(x,y,w,h,seed){
   let n=0;for(const c of String(seed))n=(n*31+c.charCodeAt(0))>>>0;const r=()=>(n=(n*1103515245+12345)>>>0)/4294967296-.5;
   const t=y+h*.08,bm=y+h*.94,j=h*.06,steps=Math.max(2,Math.round(w/(h*1.6)));let top='',bot='';
   for(let i=0;i<=steps;i++){const px=x+w*i/steps;top+=`L${(px).toFixed(1)} ${(t+r()*j).toFixed(1)}`;}
   for(let i=steps;i>=0;i--){const px=x+w*i/steps;bot+=`L${(px).toFixed(1)} ${(bm+r()*j).toFixed(1)}`;}
   return `M${(x-h*.18).toFixed(1)} ${(bm-h*.1).toFixed(1)}`+top+`L${(x+w+h*.16).toFixed(1)} ${(t+h*.12).toFixed(1)}`+bot+'Z';
  }
  // The highlight, underline or ink stroke under a point on a page (the topmost first); notes are buttons of their own.
  function markAt(slot,clientX,clientY,list=annotations.annotations){
   if(!slot?.viewport)return null;
   const bounds=slot.node.getBoundingClientRect(),x=clientX-bounds.left,y=clientY-bounds.top,reach=Math.max(6,zoom*4);
   const near=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/Math.max(1e-6,dx*dx+dy*dy),0,1);return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<=reach;};
   const marks=list.filter(a=>a.page===slot.index&&a.type!=='note');
   for(let i=marks.length-1;i>=0;i--){
    const a=marks[i];
    if(a.type==='pen'){const p=a.points.map(q=>model.pdfToViewport(slot.viewport,q));if(p.length===1?Math.hypot(x-p[0][0],y-p[0][1])<=reach:p.some((q,k)=>k&&near(p[k-1],q)))return a;continue;}
    for(const rect of a.rects||[]){
     const p=model.pdfToViewport(slot.viewport,[rect[0],rect[1]]),q=model.pdfToViewport(slot.viewport,[rect[2],rect[3]]);
     if(x>=Math.min(p[0],q[0])-2&&x<=Math.max(p[0],q[0])+2&&y>=Math.min(p[1],q[1])-2&&y<=Math.max(p[1],q[1])+(a.type==='underline'?6:2))return a;
    }
   }
   return null;
  }
  // Clicking a mark (no tool chosen) opens its own little menu: the four colours and Remove.
  let markMenu=null,markOpen=null;
  let markReturn=null;
  function closeMarkMenu(){if(markMenu)markMenu.hidden=true;markOpen=null;const back=markReturn;markReturn=null;if(back?.isConnected)back.focus({preventScroll:true});}
  function openMarkMenu(slot,mark){
   if(!annotationAccess())return;
   if(!markMenu){markMenu=doc.createElement('div');markMenu.id='mark-menu';markMenu.className='paper-popover';markMenu.hidden=true;markMenu.setAttribute('role','toolbar');markMenu.setAttribute('aria-label','Highlight actions');doc.body.append(markMenu);listen(markMenu,'pointerdown',e=>e.preventDefault());}
   markMenu.replaceChildren();markOpen={id:mark.id,page:slot.index};
   if(mark.type!=='pen')for(const [name,value]of Object.entries(env.ReservePdfArt.pens)){
    const b=doc.createElement('button');b.type='button';b.title=name;b.setAttribute('aria-label','Make it '+name);b.setAttribute('aria-pressed',String((mark.color||'').toLowerCase()===value.toLowerCase()));
    const chip=doc.createElement('span');chip.className='colour-chip';chip.style.background=value;b.append(chip);markMenu.append(b);
    listen(b,'click',()=>{try{if(annotations.update(mark.id,{color:value}))changed();}catch(error){notice(error.message);}closeMarkMenu();});
   }
   const remove=doc.createElement('button');remove.type='button';remove.className='mark-remove';remove.textContent='Remove';remove.setAttribute('aria-label','Remove this '+(mark.type==='pen'?'drawing':mark.type));markMenu.append(remove);
   listen(remove,'click',()=>{if(annotations.erase(mark.id))changed();closeMarkMenu();});
   // above the mark, like the selection menu
   const group=slot.overlay?.querySelector(`[data-annotation="${mark.id}"]`),r=(group||slot.node).getBoundingClientRect();
   markMenu.hidden=false;const h=markMenu.getBoundingClientRect().height;popupAt(markMenu,r.left,r.top-h-10>=8?r.top-h-10:r.bottom+10);remove.focus({preventScroll:true});
  }
  function onMarkClick(event){
   if(tool||stroke||erasing)return;
   const selected=env.getSelection?.();if(selected&&!selected.isCollapsed)return;
   const node=event.target.closest?.('.pdf-page'),slot=node&&slots[Number(node.dataset.page)];if(!slot)return;
   const mark=markAt(slot,event.clientX,event.clientY);if(mark){event.preventDefault?.();openMarkMenu(slot,mark);}else closeMarkMenu();
  }
  let selectionFrame=0;
  function paintSelection(){
   selectionFrame=0;
   for(const slot of slots)slot.selectionLayer?.replaceChildren();
   const selected=env.getSelection?.();if(!selected||selected.isCollapsed||!selected.rangeCount||tool==='pen'||tool==='eraser')return;
   const range=selected.getRangeAt(0);
   for(const slot of slots){
    if(!slot.textLayer||!slot.viewport||!range.intersectsNode(slot.textLayer))continue;
    const bounds=slot.node.getBoundingClientRect(),local=[];
    for(const rect of range.getClientRects()){
     const left=Math.max(rect.left,bounds.left),right=Math.min(rect.right,bounds.right),top=Math.max(rect.top,bounds.top),bottom=Math.min(rect.bottom,bounds.bottom);
     if(right-left>=1&&bottom-top>=1)local.push([left-bounds.left,top-bounds.top,right-bounds.left,bottom-bounds.top]);
    }
    if(!local.length)continue;
    if(!slot.selectionLayer||!slot.selectionLayer.isConnected){slot.selectionLayer=svgElement('svg',{class:'selection-layer','aria-hidden':'true'});slot.node.append(slot.selectionLayer);}
    slot.selectionLayer.setAttribute('viewBox',`0 0 ${slot.viewport.width} ${slot.viewport.height}`);
    for(const [x0,y0,x1,y1]of mergeLines(local))slot.selectionLayer.append(svgElement('path',{d:markerPath(x0,y0,x1-x0,y1-y0,'sel:'+slot.index+':'+Math.round(y0)),fill:'#A9D3F0',opacity:.55,style:'mix-blend-mode:multiply'}));
   }
  }
  function selectionMoved(){if(!selectionFrame)selectionFrame=env.requestAnimationFrame(paintSelection);}
  function drawAnnotations(slot){
   slot.overlay?.remove();slot.overlay=null;if(!slot.viewport||!storageWritable)return;
   const overlay=doc.createElement('div');overlay.className='annotation-layer';slot.overlay=overlay;
   const svg=svgElement('svg',{viewBox:`0 0 ${slot.viewport.width} ${slot.viewport.height}`,'aria-hidden':'true'});overlay.append(svg);slot.node.append(overlay);
   for(const annotation of annotations.annotations.filter(a=>a.page===slot.index)){
    if(annotation.type==='note'){
     const [x,y]=model.pdfToViewport(slot.viewport,annotation.point),b=doc.createElement('button');b.type='button';b.className='note-marker';b.dataset.annotation=annotation.id;b.setAttribute('aria-label','Open note: '+(annotation.text||'Empty note').slice(0,80));b.title=annotation.text||'Open note';b.style.left=clamp(x,0,slot.viewport.width-25)+'px';b.style.top=clamp(y,0,slot.viewport.height-26)+'px';b.innerHTML=env.ReservePdfArt.icons.note;
     listen(b,'click',e=>{e.stopPropagation();if(tool==='eraser'){annotations.erase(annotation.id);changed();}else editNote(annotation);});overlay.append(b);continue;
    }
    const group=svgElement('g',{'data-annotation':annotation.id});svg.append(group);
    // a keyboard handle over the mark (pointer clicks go through it to the text); Enter or Space opens its menu
    const handle=doc.createElement('button');handle.type='button';handle.className='mark-handle';handle.dataset.annotation=annotation.id;
    handle.setAttribute('aria-label',(annotation.type==='pen'?'Drawing':annotation.type==='underline'?'Underline':'Highlight')+(annotation.text?': '+String(annotation.text).slice(0,60):'')+'. Press Enter for colours or Remove.');
    const first=annotation.type==='pen'?model.pdfToViewport(slot.viewport,annotation.points[0]):annotation.rects?.[0]&&model.pdfToViewport(slot.viewport,[annotation.rects[0][0],Math.max(annotation.rects[0][1],annotation.rects[0][3])]);
    if(first){handle.style.left=clamp(first[0],0,slot.viewport.width-12)+'px';handle.style.top=clamp(first[1],0,slot.viewport.height-12)+'px';}
    listen(handle,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();markReturn=handle;openMarkMenu(slot,annotation);}});overlay.append(handle);
    if(annotation.type==='pen'){
     const points=annotation.points.map(p=>model.pdfToViewport(slot.viewport,p));group.append(svgElement('path',{d:smoothPath(points),fill:'none',stroke:annotation.color||'#b5552e','stroke-width':Math.max(1.2,zoom*1.5),'stroke-linecap':'round','stroke-linejoin':'round'}));
    }else{
     const lines=mergeLines((annotation.rects||[]).map(rect=>{const a=model.pdfToViewport(slot.viewport,[rect[0],rect[1]]),b=model.pdfToViewport(slot.viewport,[rect[2],rect[3]]);return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];}));
     for(const [x0,y0,x1,y1]of lines){const x=x0,y=y0,w=x1-x0,h=y1-y0;
      group.append(annotation.type==='underline'?svgElement('path',{d:inkLine(x,y+h,w,annotation.id+':'+x.toFixed(0)),fill:'none',stroke:annotation.color||colour,'stroke-width':Math.max(1.5,zoom*1.8),'stroke-linecap':'round'}):svgElement('path',{d:markerPath(x,y,w,h,annotation.id+':'+x.toFixed(0)),fill:annotation.color||colour,opacity:.62,style:'mix-blend-mode:multiply'}));
     }
    }
   }
  }
  // Save a copy of the PDF with the marks written in as real PDF annotations (pdf-export.js), for any PDF app.
  async function saveWithMarks(){
   if(!annotationAccess())return;
   if(!pdf||!originalBytes||!env.ReservePdfExport){notice('Saving with marks is not available for this file.');return;}
   buttons.save.disabled=true;notice('Writing your marks into a copy…');
   try{
    const {bytes,name}=await env.ReservePdfExport.withMarks({lib,data:originalBytes.slice(0),annotations:annotations.annotations,name:meta?.name});
    const url=env.URL.createObjectURL(new env.Blob([bytes],{type:'application/pdf'})),a=doc.createElement('a');
    a.href=url;a.download=name;doc.body.append(a);a.click();a.remove();env.setTimeout(()=>env.URL.revokeObjectURL(url),60000);
    notice('Saved “'+name+'”.');env.setTimeout(()=>{if($('status').textContent.startsWith('Saved “'))notice('');},4000);
   }catch(error){notice('The copy could not be written: '+error.message+' Use Download for the original.');}
   finally{buttons.save.disabled=false;}
  }
  function syncAnnotationAccess(){
   for(const name of ['highlight','underline','note','pen','eraser','undo','save'])if(buttons[name])buttons[name].disabled=!storageWritable;
   slots.filter(s=>s.rendered).forEach(drawAnnotations);
  }
  function suspendAnnotations(){
   storageWritable=false;accountTurn++;if(accountWait){env.clearTimeout(accountWait.timer);accountWait.reject(Error('Account check cancelled.'));accountWait=null;}
   if(tool)setTool(tool);selection=null;noteDraft=null;$('selection-menu').hidden=true;$('note-text').value='';if($('note-editor').open)$('note-editor').close('cancel');closeMarkMenu();syncAnnotationAccess();
  }
  function reconcileAnnotations(target,saved){
   target.saved=model.createAnnotations(saved).serialise();const previousConflict=target.conflict;let value;try{value=model.mergeAnnotations(target.saved,target.pending);target.conflict='';if(target===session&&previousConflict&&$('status').textContent===previousConflict)notice('');}catch(error){if(error.code!=='pdf-quota')throw error;target.conflict=error.message;if(target===session&&storageWritable)notice(error.message);return;}
   target.model.replace(value);target.baseline=value;if(target===session){annotations=target.model;if(storageWritable)slots.filter(s=>s.rendered).forEach(drawAnnotations);}
  }
  async function verifyAnnotations(){
   suspendAnnotations();if(!meta||doc.hidden||!alive)return;const turn=accountTurn;
   try{
    const accountId=await new Promise((resolve,reject)=>{const timer=env.setTimeout(()=>{if(accountWait?.requestId===turn){accountWait=null;reject(Error('Canvas sign-in check timed out.'));}},15000);accountWait={requestId:turn,resolve,reject,timer};send('reserve-pdf-account',{requestId:turn});});
    if(!alive||doc.hidden||turn!==accountTurn)return;
    const key=model.storageKey(meta.origin,accountId,meta.fileId),legacy=model.legacyStorageKey(meta.origin,meta.fileId),target=sessions.get(key);
    if(target)await flush(target);
    await env.navigator.locks.request(legacy,()=>env.navigator.locks.request(key,async()=>{
     const stored=await env.chrome.storage.local.get([key,legacy,'reserve:appearance']);let value=model.createAnnotations(stored[key]).serialise();
     if(stored[legacy]&&!stored[legacy].migratedTo){const old=model.createAnnotations(stored[legacy]).serialise(),ids=new Set(value.annotations.map(a=>a.id));value=model.createAnnotations({version:1,annotations:[...value.annotations,...old.annotations.filter(a=>!ids.has(a.id))]}).serialise();await env.chrome.storage.local.set({[key]:value,[legacy]:{migratedTo:key}});}
     if(stored[legacy])await env.chrome.storage.local.remove(legacy);
     if(alive&&!doc.hidden&&turn===accountTurn){applyTheme(stored['reserve:appearance']||messageAppearance);session=target||{key,model:model.createAnnotations(value),baseline:value,pending:[],chain:Promise.resolve()};sessions.set(key,session);reconcileAnnotations(session,value);}return value;
    }));
    if(!alive||doc.hidden||turn!==accountTurn)return;
    storageWritable=true;annotations=session.model;syncAnnotationAccess();if(session.conflict)notice(session.conflict);else if($('status').textContent.startsWith('Saved annotations could not be restored.'))notice('');
   }catch(error){if(alive&&!doc.hidden&&turn===accountTurn){storageWritable=false;syncAnnotationAccess();notice('Saved annotations could not be restored. Editing is disabled to protect the existing record. '+error.message);}}
  }
  let messageAppearance=null;
  function changed(){
   if(!session||!storageWritable)return;const value=annotations.serialise();session.pending.push([session.baseline,value]);session.baseline=value;if(session.conflict)reconcileAnnotations(session,session.saved);slots.filter(s=>s.rendered).forEach(drawAnnotations);buttons.undo.disabled=false;
   env.clearTimeout(saveTimer);if(!doc.hidden)saveTimer=env.setTimeout(()=>void flush(),450);
  }
  function flush(target=session){
   env.clearTimeout(saveTimer);saveTimer=0;if(!target)return Promise.resolve();
   target.chain=target.chain.then(async()=>{
    if(!target.pending.length)return;const changes=target.pending.slice();
    const value=await env.navigator.locks.request(target.key,async()=>{const stored=await env.chrome.storage.local.get([target.key]);const value=model.mergeAnnotations(stored[target.key],changes);await env.chrome.storage.local.set({[target.key]:value});return value;});
    target.pending.splice(0,changes.length);reconcileAnnotations(target,value);
   }).catch(error=>{if(target===session)notice('Annotation storage is full or unavailable. Your new marks are still open here. Remove some marks or free storage before closing. '+error.message);});
   return target.chain;
  }
  function captureSelection(){
   const selected=env.getSelection();if(!selected||selected.isCollapsed||!selected.rangeCount)return null;
   const range=selected.getRangeAt(0),text=selected.toString().trim();if(!text)return null;
   const parts=[];
   for(const slot of slots.filter(s=>s.textLayer&&s.viewport)){
    if(!range.intersectsNode(slot.textLayer))continue;
    const bounds=slot.node.getBoundingClientRect(),rects=[];
    const local=[];
    for(const rect of range.getClientRects()){
     const left=Math.max(rect.left,bounds.left),right=Math.min(rect.right,bounds.right),top=Math.max(rect.top,bounds.top),bottom=Math.min(rect.bottom,bounds.bottom);
     if(right-left<1||bottom-top<1)continue;
     local.push([left-bounds.left,top-bounds.top,right-bounds.left,bottom-bounds.top]);
    }
    for(const line of mergeLines(local))rects.push(model.rectToPdf(slot.viewport,line));
    if(rects.length)parts.push({page:slot.index,rects});
   }
   return parts.length?{text:text.slice(0,60000),parts,rect:range.getBoundingClientRect()}:null;
  }
  function selectedText(){
   if(stroke||$('note-editor').open)return;
   selection=captureSelection();if(!selection){$('selection-menu').hidden=true;return;}
   if(tool==='highlight'||tool==='underline'){annotateSelection(tool);return;}
   const r=selection.rect,menu=$('selection-menu');menu.hidden=false;const h=menu.getBoundingClientRect().height;popupAt(menu,r.left,r.top-h-10>=8?r.top-h-10:r.bottom+10);
  }
  function annotateSelection(type){
   if(!selection||!annotationAccess())return;
   let added=0;
   try{for(const part of selection.parts){annotations.add({type,page:part.page,color:colour,rects:part.rects,text:selection.text.slice(0,10000)});added++;}changed();env.getSelection()?.removeAllRanges();selection=null;$('selection-menu').hidden=true;}
   catch(error){if(added)changed();notice(error.message);}
  }
  function noteSelection(){
   if(!selection)return;
   const part=selection.parts[0],rect=part.rects[0];editNote({type:'note',page:part.page,point:[rect[0],rect[1]],text:selection.text.slice(0,10000)});$('selection-menu').hidden=true;
  }
  function annotationAccess(){if(storageWritable&&!doc.hidden)return true;notice('Saved annotations could not be restored. Editing is disabled to protect the existing record. Reload after restoring storage access.');return false;}
  function editNote(annotation){if(!annotationAccess())return;noteDraft=annotation;$('note-editor').returnValue='';$('note-text').value=annotation.text||'';$('note-editor').showModal();$('note-text').focus();}
  async function copySelection(){if(!selection)return;try{await env.navigator.clipboard.writeText(selection.text);$('selection-menu').hidden=true;}catch{notice('Copy was unavailable. Use Ctrl or Command C on the selection.');}}
  function ask(text,page,endPage=page){if(!canAI())return;if(!text?.trim()){notice('There is no selectable text on this page. Image-only PDFs need OCR in another tool.');return;}send('reserve-pdf-ai',{text:text.slice(0,AI_LIMIT),page,endPage,name:meta?.name});$('selection-menu').hidden=true;}
  // Ask AI about pages: this page, a range, or the whole document. Every word of the chosen pages is sent (up to what
  // the AI hand-off takes); if the range is longer, nothing is cut silently: the menu says how many pages fit.
  const AI_LIMIT=100000;let rangeMenu=null,range=null,rangeTurn=0;
  function openAskRange(){
   if(!canAI()||!pdf)return;
   if(!rangeMenu){
    const el=(tag,attrs={},...kids)=>{const node=doc.createElement(tag);for(const [k,v]of Object.entries(attrs)){if(k==='text')node.textContent=v;else node.setAttribute(k,v);}for(const kid of kids)node.append(typeof kid==='string'?doc.createTextNode(kid):kid);return node;};
    const radio=value=>{const input=el('input',{type:'radio',name:'ai-range',value});input.checked=value==='page';return input;};
    range={page:radio('page'),range:radio('range'),all:radio('all'),pageLabel:el('small'),allLabel:el('small'),
     from:el('input',{type:'number',min:'1',step:'1','aria-label':'From page'}),to:el('input',{type:'number',min:'1',step:'1','aria-label':'To page'}),
     note:el('p',{class:'ai-range-note',role:'status','aria-live':'polite'}),cancel:el('button',{type:'button',text:'Cancel'}),go:el('button',{type:'submit',class:'ai-range-go',text:'Ask AI'})};
    rangeMenu=el('form',{id:'ai-range',class:'paper-popover ai-range',role:'dialog','aria-label':'Ask AI about which pages'},
     el('p',{class:'ai-range-title',text:'Ask AI about'}),
     el('label',{},range.page,el('span',{},'This page ',range.pageLabel)),
     el('label',{},range.range,el('span',{},'Pages ',range.from,' to ',range.to)),
     el('label',{},range.all,el('span',{},'Whole document ',range.allLabel)),
     range.note,el('div',{class:'ai-range-actions'},range.cancel,range.go));
    rangeMenu.hidden=true;doc.body.append(rangeMenu);
    for(const box of [range.from,range.to])listen(box,'focus',()=>{range.range.checked=true;});
    listen(range.cancel,'click',closeAskRange);
    listen(rangeMenu,'submit',event=>{event.preventDefault?.();void askRange();});
   }
   rangeTurn++;const total=slots.length;range.pageLabel.textContent='('+(currentPage+1)+')';range.allLabel.textContent='('+total+' page'+(total===1?'':'s')+')';
   range.from.max=range.to.max=String(total);range.from.value=String(currentPage+1);range.to.value=String(Math.min(total,currentPage+3));
   range.note.textContent='';range.go.disabled=false;
   const r=buttons.ai.getBoundingClientRect();rangeMenu.hidden=false;popupAt(rangeMenu,r.right-rangeMenu.getBoundingClientRect().width,r.bottom+8);
   ([range.page,range.range,range.all].find(input=>input.checked)||range.page).focus?.();
  }
  function closeAskRange(){rangeTurn++;if(rangeMenu)rangeMenu.hidden=true;buttons.ai?.focus?.();}
  async function askRange(){
   if(!canAI())return;
   const total=slots.length,choice=range.all.checked?'all':range.range.checked?'range':'page',{note,go}=range;
   let first=currentPage,last=currentPage;
   if(choice==='all'){first=0;last=total-1;}
   else if(choice==='range'){
    first=Math.round(Number(range.from.value))-1;last=Math.round(Number(range.to.value))-1;
    if(!Number.isFinite(first)||!Number.isFinite(last)||first<0||last>=total||first>last){note.textContent='Choose pages from 1 to '+total+', the first no later than the last.';return;}
   }
   const turn=++rangeTurn;go.disabled=true;note.textContent=first===last?'Reading the page…':'Reading pages '+(first+1)+' to '+(last+1)+'…';
   try{
    const parts=[];let length=0,fit=null;
    for(let index=first;index<=last;index++){
     const page=await pdf.getPage(index+1),content=await readText(page);if(slots[index]?.page!==page)page.cleanup();
     if(!alive||rangeMenu.hidden||turn!==rangeTurn)return;
     const words=content.items.map(i=>(i.str||'')+(i.hasEOL?'\n':' ')).join('').replace(/[ \t]+\n/g,'\n').trim();
     const part=(first===last?'':'[Page '+(index+1)+']\n')+words;
     if(length+part.length+2>AI_LIMIT){fit=index-1;break;}
     parts.push(part);length+=part.length+2;
     if(last>first)note.textContent='Reading page '+(index+1)+' of '+(last+1)+'…';
    }
    if(fit!==null){
     note.textContent=fit<first?'This page alone is longer than the '+AI_LIMIT.toLocaleString()+' characters AI can take here.':'Pages '+(first+1)+' to '+(last+1)+' are longer than AI can take here ('+AI_LIMIT.toLocaleString()+' characters). Pages '+(first+1)+' to '+(fit+1)+' fit; choose those or fewer.';
     go.disabled=false;return;
    }
    const text=parts.join('\n\n');
    if(!text.trim()){note.textContent='These pages have no selectable text (a scanned PDF needs OCR in another tool).';go.disabled=false;return;}
    if(turn!==rangeTurn)return;rangeMenu.hidden=true;ask(text,first,last);
   }catch(error){if(turn===rangeTurn&&alive){note.textContent=cancelled(error)?'':'The text could not be read: '+error.message;}}finally{if(turn===rangeTurn&&alive)go.disabled=false;}
  }
  function onPagePointerDown(event){
   if(event.button!==0||event.isPrimary===false||!['pen','note','eraser'].includes(tool)||!annotationAccess())return;
   const node=event.target.closest('.pdf-page'),slot=node&&slots[Number(node.dataset.page)];if(!slot?.viewport)return;
   if(event.target.closest('.note-marker')&&tool!=='eraser')return;
   const bounds=node.getBoundingClientRect(),point=model.viewportToPdf(slot.viewport,[event.clientX-bounds.left,event.clientY-bounds.top]);
   if(tool==='note'){event.preventDefault();editNote({type:'note',page:slot.index,point,text:''});return;}
   if(tool==='eraser'){event.preventDefault();try{node.setPointerCapture?.(event.pointerId);}catch{}erasing={id:event.pointerId,node,taken:new Set(),list:annotations.annotations};eraseAt(event);return;}
   event.preventDefault();node.setPointerCapture(event.pointerId);stroke={slot,id:event.pointerId,points:[point],node,path:svgElement('path',{fill:'none',stroke:'#b5552e','stroke-width':Math.max(1.2,zoom*1.5),'stroke-linecap':'round','stroke-linejoin':'round'})};slot.overlay.querySelector('svg').append(stroke.path);
  }
  // The eraser takes every mark it passes over while pressed; they vanish at once and leave as one undo step.
  let erasing=null;
  function eraseAt(event){
   const batch=event.getCoalescedEvents?.();
   for(const e of batch?.length?batch:[event]){
    const hits=[],under=doc.elementsFromPoint?.(e.clientX,e.clientY)||[];
    for(const el of under){const id=el.closest?.('[data-annotation]')?.dataset.annotation;if(id)hits.push(id);}
    const page=under.find(el=>el.closest?.('.pdf-page'))?.closest('.pdf-page'),slot=page&&slots[Number(page.dataset.page)];
    const mark=slot&&markAt(slot,e.clientX,e.clientY,erasing.list.filter(a=>!erasing.taken.has(a.id)));if(mark)hits.push(mark.id);
    for(const id of hits){if(erasing.taken.has(id))continue;erasing.taken.add(id);for(const el of $('pages').querySelectorAll(`[data-annotation="${id}"]`))el.style.display='none';}
   }
  }
  function endErase(event,cancel=false){
   if(!erasing||event.pointerId!==erasing.id)return;
   const done=erasing;erasing=null;try{done.node.releasePointerCapture?.(done.id);}catch{}
   if(cancel||!done.taken.size){for(const el of $('pages').querySelectorAll('[data-annotation]'))el.style.display='';return;}
   if(annotations.eraseMany([...done.taken]))changed();
  }
  function onPenMove(event){
   if(erasing&&event.pointerId===erasing.id){eraseAt(event);return;}
   if(!stroke||event.pointerId!==stroke.id)return;
   const bounds=stroke.node.getBoundingClientRect();
   const batch=event.getCoalescedEvents?.();
   for(const e of batch?.length?batch:[event]){
    const point=model.viewportToPdf(stroke.slot.viewport,[clamp(e.clientX-bounds.left,0,bounds.width),clamp(e.clientY-bounds.top,0,bounds.height)]),last=stroke.points.at(-1);
    if(Math.hypot(point[0]-last[0],point[1]-last[1])>.6&&stroke.points.length<10000)stroke.points.push(point);
   }
   stroke.path.setAttribute('d',smoothPath(stroke.points.map(p=>model.pdfToViewport(stroke.slot.viewport,p))));
  }
  function endPen(event,cancel=false){
   if(erasing){endErase(event,cancel);return;}
   if(!stroke||event.pointerId!==stroke.id)return;
   const done=stroke;stroke=null;
   if(done.node.hasPointerCapture(done.id))done.node.releasePointerCapture(done.id);
   if(cancel||done.points.length<2){done.path.remove();return;}
   try{annotations.add({type:'pen',page:done.slot.index,color:'#b5552e',points:done.points});changed();}catch(error){done.path.remove();notice(error.message);}
  }
  function toggleSearch(value){
   const open=value===undefined?$('find-bar').hidden:value;$('find-bar').hidden=!open;buttons.search.classList.toggle('is-active',open);buttons.search.setAttribute('aria-expanded',String(open));
   // Closing the bar clears its marks from the pages (the typed words stay for next time); reopening searches again.
   if(open){$('find-input').focus();$('find-input').select();if($('find-input').value.trim()&&!searchQuery)resetSearch();}
   else{scroll.focus();$('selection-menu').hidden=true;searchRevision++;env.clearTimeout(searchTimer);searchQuery='';matches=[];matchIndex=-1;searchComplete=false;slots.filter(s=>s.textLayer).forEach(markSearch);updateFindCount();}
   if(fit)fitWidth();
  }
  function resetSearch(){
   searchRevision++;searchQuery=$('find-input').value.trim().replace(/\s+/g,' ').slice(0,500);matches=[];matchIndex=-1;searchCursor=0;searchComplete=false;
   slots.filter(s=>s.textLayer).forEach(markSearch);updateFindCount();env.clearTimeout(searchTimer);
   if(searchQuery&&!doc.hidden)searchTimer=env.setTimeout(()=>void searchStep(),180);
  }
  function updateFindCount(){ $('find-count').textContent=searchQuery?(matches.length?`${matchIndex+1} / ${matches.length}${searchComplete?'':'…'}`:searchComplete?'No matches':'Searching…'):'';}
  async function searchStep(){
   searchTimer=0;if(searchBusy||!pdf||!searchQuery||doc.hidden||!alive)return;
   searchBusy=true;const turn=searchRevision;let page;
   try{
    const index=searchCursor;page=await pdf.getPage(index+1);if(turn!==searchRevision||doc.hidden||!alive)return;
    const content=await readText(page);if(turn!==searchRevision||doc.hidden||!alive)return;
    // Search collapsed whitespace, then map back to the unchanged PDF.js spans.
    const {text,starts,ends}=searchText(content.items);
    const found=occurrences(text,searchQuery);for(const range of found)if(matches.length<20000)matches.push({page:index,start:starts[range.start],end:ends[range.end-1]});
    searchCursor++;searchComplete=searchCursor>=slots.length||matches.length>=20000;
    if(matches.length>=20000)notice('Showing the first 20,000 search matches. Use a more specific phrase to narrow the results.');
    if(matchIndex<0&&matches.length){matchIndex=0;go(matches[0].page);}
    if(slots[index].textLayer)markSearch(slots[index]);updateFindCount();
   }catch(error){if(!cancelled(error)){if(alive)notice('Search could not read a page: '+error.message);searchCursor++;searchComplete=searchCursor>=slots.length;}}
   finally{
    if(page&&!slots.some(s=>s.page===page))page.cleanup();searchBusy=false;
    if(alive&&!doc.hidden&&searchQuery&&!searchComplete)searchTimer=env.setTimeout(()=>void searchStep(),35);
   }
  }
  function markSearch(slot){
   if(!slot.textLayer)return;
   for(const span of slot.textLayer.querySelectorAll('span:not(.markedContent)')){
    const text=span.dataset.originalText??span.textContent;span.dataset.originalText=text;span.textContent=text;
   }
   const ranges=matches.map((m,i)=>({...m,index:i})).filter(m=>m.page===slot.index);if(!ranges.length)return;
   let cursor=0;
   for(const span of slot.textLayer.querySelectorAll('span:not(.markedContent)')){
    const text=span.dataset.originalText||'',end=cursor+text.length,pieces=ranges.filter(r=>r.start<end&&r.end>cursor);let at=0;
    if(pieces.length){span.textContent='';for(const piece of pieces){const start=clamp(piece.start-cursor,0,text.length),finish=clamp(piece.end-cursor,0,text.length);span.append(doc.createTextNode(text.slice(at,start)));const mark=doc.createElement('mark');mark.textContent=text.slice(start,finish);mark.dataset.match=String(piece.index);mark.classList.toggle('current-match',piece.index===matchIndex);span.append(mark);at=finish;}span.append(doc.createTextNode(text.slice(at)));}
    cursor=end;
   }
  }
  function revealMatch(){
   const match=matches[matchIndex];if(!match)return;
   const slot=slots[match.page],mark=slot.textLayer?.querySelector(`[data-match="${matchIndex}"]`);
   if(mark){const bounds=mark.getBoundingClientRect(),rootBounds=scroll.getBoundingClientRect();if(bounds.top<rootBounds.top||bounds.bottom>rootBounds.bottom)scroll.scrollTop+=bounds.top-rootBounds.top-scroll.clientHeight/3;}
  }
  function findNext(direction){
   if(!matches.length)return;matchIndex=(matchIndex+direction+matches.length)%matches.length;go(matches[matchIndex].page);slots.filter(s=>s.textLayer).forEach(markSearch);revealMatch();updateFindCount();
  }
  function keydown(event){
   // Escape closes the innermost thing first: a note, a menu, the search bar, a tool; then the reader.
   if(event.key==='Escape'){
    event.preventDefault();
    if($('note-editor').open){$('note-editor').close('cancel');return;}
    if(rangeMenu&&!rangeMenu.hidden){closeAskRange();return;}
    if(markMenu&&!markMenu.hidden){closeMarkMenu();return;}
    if(!$('selection-menu').hidden||!$('pen-palette').hidden){$('selection-menu').hidden=true;$('pen-palette').hidden=true;return;}
    if(!$('find-bar').hidden){toggleSearch(false);buttons.search?.focus();return;}
    if(tool){setTool(tool);return;}
    if(maximised){send('reserve-pdf-fullscreen');return;}
    void close();return;
   }
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){event.preventDefault();toggleSearch(true);return;}
   if(event.target.closest('input,select,textarea,button,a,[contenteditable="true"]')||event.ctrlKey||event.metaKey||event.altKey||!pdf)return;
   const handlers={PageDown:()=>go(currentPage+1),PageUp:()=>go(currentPage-1),ArrowDown:()=>{scroll.scrollTop+=80;},ArrowUp:()=>{scroll.scrollTop-=80;},ArrowLeft:()=>go(currentPage-1),ArrowRight:()=>go(currentPage+1),Home:()=>go(0),End:()=>go(slots.length-1),'+':()=>setZoom(zoom*1.2),'=':()=>setZoom(zoom*1.2),'-':()=>setZoom(zoom/1.2)};
   if(handlers[event.key]){event.preventDefault();handlers[event.key]();}
  }
  async function initialise(message){
   if(initialised||!(message.bytes instanceof ArrayBuffer)||!/^https:\/\//.test(message.origin)||message.origin!==parentOrigin||!/^\d+$/.test(String(message.fileId)))return;
   aiEnabled=message.aiEnabled!==false;syncAI();
   initialised=true;meta={origin:message.origin,fileId:String(message.fileId),name:String(message.name||'Canvas document.pdf'),url:message.url};
   const original=new URL(meta.url,meta.origin);if(original.origin!==meta.origin||original.protocol!=='https:')throw Error('The original file address does not belong to this Canvas site.');
   buttons.download.href=original.href;$('file-name').textContent=meta.name;doc.title=meta.name+' · PDF reader';applyTheme(message.appearance);
   messageAppearance=message.appearance;await verifyAnnotations();
   if(!alive)return;
   lib=lib||await import('./vendor/pdfjs/pdf.mjs');if(!alive)return;
   lib.GlobalWorkerOptions.workerSrc=env.chrome.runtime.getURL('vendor/pdfjs/pdf.worker.mjs');
   // Never allow document JavaScript, embedded actions, remote resources or a
   // fake main-thread worker. PDFs are data; only the vendored worker parses them.
   worker=new env.Worker(lib.GlobalWorkerOptions.workerSrc,{type:'module'});
   pdfWorker=new lib.PDFWorker({port:worker,verbosity:lib.VerbosityLevel?.ERRORS??0});
   originalBytes=new Uint8Array(message.bytes.slice(0));
   loading=lib.getDocument({verbosity:lib.VerbosityLevel?.ERRORS??0,data:new Uint8Array(message.bytes),worker:pdfWorker,isEvalSupported:false,enableXfa:false,useWasm:false,useWorkerFetch:false,disableAutoFetch:true,disableStream:true,stopAtErrors:false});
   loading.onPassword=()=>{notice('This PDF needs a password. Open the original in Canvas.');send('reserve-pdf-error',{message:'Password-protected PDF: use the original Canvas viewer.'});};
   pdf=await loading.promise;if(!alive)return;
   const first=await pdf.getPage(1),base=first.getViewport({scale:1});
   for(let index=0;index<pdf.numPages;index++){
    const node=doc.createElement('section');node.className='pdf-page';node.dataset.page=String(index);node.setAttribute('aria-label','Page '+(index+1));
    const slot={index,node,base,page:index===0?first:null,viewport:null,rendered:false,canvas:null,textLayer:null,overlay:null};slots.push(slot);resizeSlot(slot);$('pages').append(node);pageObserver.observe(node);
    const button=doc.createElement('button');button.type='button';button.dataset.page=String(index);button.setAttribute('aria-label','Go to page '+(index+1));const label=doc.createElement('small');label.textContent=String(index+1);button.append(label);listen(button,'click',()=>go(index));$('thumbnails').append(button);thumbButtons.push(button);thumbObserver.observe(button);
   }
   $('page-total').textContent='/ '+pdf.numPages;$('page-number').max=String(pdf.numPages);
   for(const [name,b]of Object.entries(buttons))if(name!=='close')b.disabled=false;
   syncAI();syncAnnotationAccess();buttons.undo.disabled=true;
   visible.add(0);setCurrent(0);fitWidth();noticeIfLoaded();schedule();void buildOutline().catch(()=>{});scroll.focus();
  }
  const pageObserver=new env.IntersectionObserver(entries=>{
   if(doc.hidden)return;
   for(const entry of entries){const index=Number(entry.target.dataset.page);if(entry.isIntersecting)visible.add(index);else visible.delete(index);}
   if(visible.size){const midpoint=scroll.getBoundingClientRect().top+scroll.clientHeight*.3;let closest=currentPage,distance=Infinity;for(const index of visible){const r=slots[index].node.getBoundingClientRect(),d=Math.abs(r.top-midpoint);if(d<distance){closest=index;distance=d;}}setCurrent(closest);}
   schedule();
  },{root:scroll,threshold:[0,.01,.25,.5,.75,1]});
  thumbObserver=new env.IntersectionObserver(entries=>{
   for(const entry of entries){const index=Number(entry.target.dataset.page);if(entry.isIntersecting)thumbVisible.add(index);else{thumbVisible.delete(index);const slot=slots[index];if(slot?.thumbnail){slot.thumbnail.remove();slot.thumbnail.width=0;slot.thumbnail.height=0;slot.thumbnail=null;}}}
   thumbReady=false;idleThumbnails();
  },{root:$('thumbnails'),rootMargin:'100px'});
  // Dragging the split resizes the reader many times a second: the pages stretch on the next frame (never inside
  // the observer's own callback, which would loop) and are redrawn sharp once the width has settled.
  let resizeFrame=0,resizeTimer=0;
  const resizeObserver=new env.ResizeObserver(()=>{
   if(!alive||doc.hidden||!fit||resizeFrame)return;
   resizeFrame=env.requestAnimationFrame(()=>{
    resizeFrame=0;if(!alive||!fit||!slots.length)return;
    const slot=slots[currentPage],target=clamp(fitZoom(slot),.2,4);
    if(Math.abs(target-zoom)<.002)return;
    env.clearTimeout(resizeTimer);queue.cancel();
    const before=zoom;zoom=target;const fraction=(scroll.scrollTop-slot.node.offsetTop)/Math.max(1,slot.node.offsetHeight);
    slots.forEach(s=>{resizeSlot(s);stretch(s);});scroll.scrollTop=slot.node.offsetTop+fraction*slot.node.offsetHeight;
    $('zoom-label').textContent=Math.round(zoom*100)+'%';zoom=before;
    resizeTimer=env.setTimeout(()=>{resizeTimer=0;if(!alive||!fit)return;const s=slots[currentPage],t=s&&clamp(fitZoom(s),.2,4);if(s&&Math.abs(t-zoom)<.002){slots.forEach(x=>{resizeSlot(x);stretch(x);});$('zoom-label').textContent=Math.round(zoom*100)+'%';}else fitWidth();},160);
   });
  });resizeObserver.observe(scroll);
  function storageChanged(changes,area){
   if(area!=='local')return;if(changes['reserve:appearance'])applyTheme(changes['reserve:appearance'].newValue);
   for(const target of sessions.values())if(changes[target.key])try{reconcileAnnotations(target,changes[target.key].newValue);}catch(error){if(target===session){storageWritable=false;syncAnnotationAccess();notice('Saved annotations could not be restored. Editing is disabled to protect the existing record. '+error.message);}}
  }
  async function close(requestId){
   for(const target of sessions.values())await flush(target);if([...sessions.values()].some(s=>s.pending.length)){if(!session?.pending.length)notice('Your annotations have not been saved. Free storage or undo recent marks before closing.');if(Number.isSafeInteger(requestId))send('reserve-pdf-close-result',{requestId,ok:false});return false;}await destroy();if(Number.isSafeInteger(requestId))send('reserve-pdf-close-result',{requestId,ok:true});else send('reserve-pdf-close');return true;
  }
  function destroy(){
   if(!alive)return teardown;
   alive=false;suspendAnnotations();off.abort();queue.pause(true);cancelText();cancelIdle();env.clearTimeout(saveTimer);env.clearTimeout(searchTimer);pageObserver.disconnect();thumbObserver.disconnect();resizeObserver.disconnect();env.chrome.storage.onChanged.removeListener(storageChanged);
   for(const slot of slots)freePage(slot);freeThumbnails();slots=[];visible.clear();
   teardown=(async()=>{
    let timer;try{await Promise.race([Promise.resolve(loading?.destroy()).catch(()=>{}),new Promise(resolve=>{timer=env.setTimeout(resolve,1500);})]);}
    finally{env.clearTimeout(timer);pdfWorker?.destroy?.();worker?.terminate();lib?.TextLayer?.cleanup?.();}
   })();return teardown;
  }
  buildToolbar();syncAI();
  listen(env,'message',event=>{
   if(event.source!==env.parent||event.origin!==parentOrigin||event.data?.token!==token)return;
   if(event.data.type==='reserve-pdf-init')void initialise(event.data).catch(error=>{notice(error.message);send('reserve-pdf-error',{message:error.message});});
   else if(event.data.type==='reserve-pdf-account-result'&&accountWait?.requestId===event.data.requestId){const wait=accountWait;accountWait=null;env.clearTimeout(wait.timer);if(/^\d+$/.test(String(event.data.accountId)))wait.resolve(String(event.data.accountId));else wait.reject(Error(event.data.error||'Canvas sign-in could not be verified.'));}
   else if(event.data.type==='reserve-pdf-request-close')void close(event.data.requestId);
   else if(event.data.type==='reserve-pdf-fullscreen-state'&&buttons.fullscreen){const on=event.data.on===true;maximised=on;buttons.fullscreen.classList.toggle('is-active',on);buttons.fullscreen.setAttribute('aria-pressed',String(on));buttons.fullscreen.title=on?'Back to the split view':'Fill the window';buttons.fullscreen.setAttribute('aria-label',buttons.fullscreen.title);}
  });
  listen(doc,'keydown',keydown);
  listen($('pages'),'pointerdown',onPagePointerDown);listen($('pages'),'pointermove',onPenMove);listen($('pages'),'pointerup',event=>endPen(event));listen($('pages'),'pointercancel',event=>endPen(event,true));listen($('pages'),'lostpointercapture',event=>endPen(event,true));
  listen(doc,'pointerup',event=>{if(!event.target.closest('.paper-popover,#toolbar,.annotation-layer,dialog'))selectedText();});
  listen(doc,'keyup',event=>{if(event.shiftKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))selectedText();});
  listen(doc,'pointerdown',event=>{if(!event.target.closest('.paper-popover,#toolbar'))$('pen-palette').hidden=true;if(!event.target.closest('#mark-menu'))closeMarkMenu();});
  listen($('pages'),'click',onMarkClick);listen(doc,'selectionchange',selectionMoved);listen(scroll,'scroll',closeMarkMenu,{passive:true});
  listen($('selection-menu'),'pointerdown',event=>event.preventDefault());
  listen($('find-input'),'input',resetSearch);listen($('find-input'),'keydown',event=>{if(event.key==='Enter'){event.preventDefault();findNext(event.shiftKey?-1:1);}});
  for(const name of ['thumbnails','outline']){listen($(name+'-tab'),'click',()=>switchSide(name));listen($(name+'-tab'),'keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)&&!$('outline-tab').hidden){event.preventDefault();const next=name==='outline'?'thumbnails':'outline';switchSide(next);$(next+'-tab').focus();}});}
  listen($('note-editor'),'close',()=>{
   if($('note-editor').returnValue!=='save'||!noteDraft||!annotationAccess())return;
   try{const text=$('note-text').value;if(noteDraft.id){if(annotations.update)annotations.update(noteDraft.id,{text});else{annotations.erase(noteDraft.id);annotations.add({...noteDraft,text});}}else annotations.add({...noteDraft,text});changed();noteDraft=null;}catch(error){notice(error.message);}
  });
  listen(doc,'visibilitychange',()=>{
   doc.documentElement.dataset.hidden=String(doc.hidden);
   if(doc.hidden){if(range){rangeTurn++;range.go.disabled=false;range.note.textContent='';}if(stroke)endPen({pointerId:stroke.id},true);searchRevision++;queue.pause(true);cancelText();cancelIdle();thumbReady=false;env.clearTimeout(searchTimer);searchTimer=0;void flush();suspendAnnotations();}
   else{void verifyAnnotations();queue.pause(false);schedule();idleThumbnails();if(searchQuery&&!searchComplete)void searchStep();}
  });
  listen(env,'pagehide',()=>{void flush();destroy();},{once:true});
  env.chrome.storage.onChanged.addListener(storageChanged);
  send('reserve-pdf-ready');
  return {destroy,close,initialise,queue,get state(){return {currentPage,zoom,visible:[...visible],slots,sideOpen,matches,annotations};}};
 }
 function start(){
  const params=new URLSearchParams(root.location.search);
  if(root.parent===root||!/^https:\/\//.test(params.get('parentOrigin')||'')||!params.get('token'))return;
  createReader(root);
 }
 return {RenderQueue,occurrences,searchText,smoothPath,createReader,start};
});
