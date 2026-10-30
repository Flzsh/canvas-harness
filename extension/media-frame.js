/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Canvas Harness local media framing. Rendering is synchronous; hydration owns local URLs. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),asset=v=>object(v)&&Object.hasOwn(v,'asset')?v.asset:v,framed=v=>object(v)&&Object.hasOwn(v,'asset');
 const fail=()=>{throw Error('Invalid media framing.');};
 function fields(v,keys){if(!object(v)||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value')))fail();}
 function number(v,a,b){if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)fail();return v;}
 function clean(value,cleanAsset=v=>v){
  fields(value,['asset','focus','zoom','fit','height','loop','still']);if(!Object.hasOwn(value,'asset'))fail();
  const a=cleanAsset(value.asset);if(!object(a))fail();
  const focus=value.focus??{x:.5,y:.5};
  fields(focus,['x','y']);
  const out={asset:a,focus:{x:number(focus.x,0,1),y:number(focus.y,0,1)},zoom:number(value.zoom??1,1,4),fit:value.fit??'cover',height:value.height??'medium'};
  if(!['cover','contain'].includes(out.fit)||!['small','medium','tall'].includes(out.height))fail();
  if(value.loop!==undefined){
    fields(value.loop,['start','end']);
    const end=number(value.loop.end,0,Number.isFinite(a.duration)?a.duration:3600),start=number(value.loop.start,0,end);
    if(end-start<.05||end-start>60||a.kind!=='video'&&!/^video\//.test(a.type||''))fail();
    out.loop={start,end};
  }
  if(value.still!==undefined){if(a.kind!=='video'&&!/^video\//.test(a.type||''))fail();out.still=number(value.still,0,Number.isFinite(a.duration)?a.duration:3600);}
  return out;
 }
 function resolve(value,appearance={}){
  if(framed(value)){
    const out=clean(value);
    if(out.asset.kind==='video'&&Number.isFinite(out.asset.duration)){out.loop??={start:0,end:Math.min(60,out.asset.duration)};out.still??=0;}
    return out;
  }
  const a=asset(value),out={asset:a,focus:{x:({left:0,center:.5,right:1})[appearance.bannerPosition]??.5,y:.5},zoom:1,fit:appearance.bannerFit==='contain'?'contain':'cover',height:'medium'};
  if(a?.kind==='video'&&Number.isFinite(a.duration)){out.loop={start:0,end:Math.min(60,a.duration)};out.still=0;}
  return clean(out);
 }
 function layout(width,height,boxWidth,boxHeight,frame){
  for(const n of [width,height,boxWidth,boxHeight])number(n,.000001,1000000);
  const f=resolve(frame),scale=(f.fit==='contain'?Math.min(boxWidth/width,boxHeight/height):Math.max(boxWidth/width,boxHeight/height))*f.zoom,w=width*scale,h=height*scale;
  const axis=(size,box,focus)=>size<=box?(box-size)/2:clamp(box/2-focus*size,box-size,0),left=axis(w,boxWidth,f.focus.x),top=axis(h,boxHeight,f.focus.y);
  return {width:w,height:h,left,top,pinX:left+f.focus.x*w,pinY:top+f.focus.y*h,scale};
 }
 function render(value,{kind='banner',className='',playback=true,appearance={}}={}){
  const f=resolve(value,appearance),
    media=root.ReserveMedia||(typeof module==='object'&&module.exports?require('./media-store.js'):null),
    art=root.ReserveCustomArt||(typeof module==='object'&&module.exports?require('./custom-art.js'):null),
    a=f.asset.mediaId?media.cleanReference(f.asset,kind):art.cleanAsset(f.asset);
  const attrs=`class="ch-frame-media ${E(className)}" data-ch-frame="${E(JSON.stringify({...f,asset:undefined}))}" data-ch-width="${a.width||1200}" data-ch-height="${a.height||240}" data-ch-frame-slot="${E(kind)}" data-ch-duration="${a.duration||0}" data-ch-frame-size="${f.height}" data-ch-frame-motion="${playback?'true':'false'}" aria-hidden="true"`;
  if(a.mediaId){
    const safe=media.cleanReference(a,kind),
      moving=safe.kind==='video'||safe.animated,
      live=safe.kind==='video'?'<video class="ch-frame-live" muted playsinline preload="none" tabindex="-1" hidden></video>':'<img class="ch-frame-live" alt="" draggable="false" decoding="async"'+(moving?' hidden':'')+'>';
   return `<span ${attrs} data-ch-frame-id="${safe.mediaId}" data-ch-frame-kind="${safe.kind}"${moving?' data-ch-frame-animated="true"':''} data-rd-key="framed-${safe.mediaId}-${kind}">${live}${moving?'<img class="ch-frame-still" alt="" draggable="false" decoding="async">':''}</span>`;
  }
  const svg=art.cleanAsset(a),
    size=/viewBox="[\d. -]+\s([\d.]+)\s([\d.]+)"/.exec(svg.svg),
    markup=art.render(svg,{kind:kind==='background'||kind==='card'?'banner':kind,motion:false,fit:'contain',className:'ch-frame-live'});
  return `<span ${attrs}${size?` data-ch-svg-width="${size[1]}" data-ch-svg-height="${size[2]}"`:''}>${markup}</span>`;
 }
 function createController(container,store,{motion=()=>true,onError=()=>{}}={}){
  const doc=container.ownerDocument||root.document,reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)'),nodes=new Map(),listen=(el,key,fn)=>el?.addEventListener?.(key,fn);let dead=false;
  function visible(node){
    if(doc.hidden||doc.visibilityState==='hidden'||node.isConnected===false)return false;
    let outside=false;
    for(let el=node;el;el=el.parentElement||el.getRootNode?.()?.host){
      if(el===container)outside=true;
      if(el.hidden||outside&&el.getAttribute?.('aria-hidden')==='true')return false;
      const css=root.getComputedStyle?.(el);
      if(css?.display==='none'||css?.visibility==='hidden'||css?.visibility==='collapse')return false;
    }
    return true;
  }
  function allowed(node,e){
    return e.inView&&visible(node)&&motion()&&!reduced?.matches&&!container.hasAttribute('data-art-rest')&&container.getAttribute?.('data-motion-style')!=='off'&&node.dataset.chFrameMotion==='true';
  }
  function geometry(node,e,box=node.getBoundingClientRect?.()){
    if(!box?.width||!box?.height)return;
    const f={...JSON.parse(node.dataset.chFrame),asset:e.asset||{kind:node.dataset.chFrameKind,duration:Number(node.dataset.chDuration)||undefined}},
      g=layout(Number(node.dataset.chSvgWidth||node.dataset.chWidth),Number(node.dataset.chSvgHeight||node.dataset.chHeight),box.width,box.height,f);
    for(const child of node.children){
      child.style.position='absolute';
      child.style.maxWidth='none';
      child.style.width=g.width/box.width*100+'%';
      child.style.height=g.height/box.height*100+'%';
      child.style.left=g.left/box.width*100+'%';
      child.style.top=g.top/box.height*100+'%';
    }
    e.frame=f;
  }
  function update(){
    if(dead)return;
    const decoders=new Set();
    for(const [node,e]of [...nodes].sort(([a],[b])=>({banner:0,card:1,background:2})[a.dataset.chFrameSlot]-({banner:0,card:1,background:2})[b.dataset.chFrameSlot])){
      if(!e.loaded)continue;
      const video=e.live?.tagName==='VIDEO',eligible=allowed(node,e);
      if(!eligible)e.failed=false;
      const move=eligible&&!e.failed&&(!video||!decoders.has(e.id));
      if(video&&move)decoders.add(e.id);
      if(!node.hasAttribute('data-ch-frame-animated'))continue;
      if(e.playing===move)continue;
      e.playing=move;
      if(e.still)e.still.hidden=move;
      e.live.hidden=!move;
      if(video){
        e.live.muted=e.live.defaultMuted=true;
        e.live.volume=0;
        if(move){
          if(e.live.getAttribute('src')!==e.liveURL)e.live.src=e.liveURL;
          const loop=e.frame?.loop;
          if(loop&&(e.live.currentTime<loop.start||e.live.currentTime>=loop.end))e.live.currentTime=loop.start;
          e.live.play?.()?.catch?.(()=>{
            if(dead||nodes.get(node)!==e)return;
            e.failed=true;
            e.playing=false;
            e.live.hidden=true;
            if(e.still)e.still.hidden=false;
            e.live.pause?.();
            e.live.removeAttribute('src');
            e.live.load?.();
          });
        }
        else{e.live.pause?.();if(e.live.hasAttribute('src')){e.live.removeAttribute('src');e.live.load?.();}}
      }
      else if(move)e.live.src=e.liveURL;else e.live.removeAttribute('src');
    }
  }
  const intersection=typeof root.IntersectionObserver==='function'?new root.IntersectionObserver(entries=>{
    for(const entry of entries){const e=nodes.get(entry.target);if(e)e.inView=entry.isIntersecting;}
    update();
  }):null;
  const resize=typeof root.ResizeObserver==='function'?new root.ResizeObserver(entries=>{
    for(const entry of entries){const e=nodes.get(entry.target);if(e)geometry(entry.target,e,entry.contentRect);}
  }):null;
  function drop(node,e){
    intersection?.unobserve(node);
    resize?.unobserve(node);
    if(e.live?.tagName==='VIDEO'){
      e.live.pause?.();
      e.live.removeEventListener('timeupdate',e.loop);
      e.live.removeEventListener('ended',e.loop);
      e.live.removeEventListener('volumechange',e.silence);
      e.live.removeAttribute('src');
      e.live.load?.();
    }
    for(const url of e.urls)root.URL.revokeObjectURL(url);
    nodes.delete(node);
  }
  function fallback(){
    if(!intersection)
      for(const [node,e]of nodes){const b=node.getBoundingClientRect?.();e.inView=!!b&&b.bottom>0&&b.right>0&&b.top<(root.innerHeight||10000)&&b.left<(root.innerWidth||10000);}
    update();
  }
  function sync(){
    if(dead)return;
    const wanted=new Set(container.querySelectorAll('[data-ch-frame]'));
    for(const [node,e]of nodes)if(!wanted.has(node)||e.id!==node.dataset.chFrameId)drop(node,e);
   for(const node of wanted){
     let e=nodes.get(node);
     if(e){geometry(node,e);continue;}
     e={id:node.dataset.chFrameId,urls:[],inView:!intersection,playing:null,loaded:false,live:node.querySelector('.ch-frame-live'),still:node.querySelector('.ch-frame-still')};
     nodes.set(node,e);
     resize?.observe(node);
     intersection?.observe(node);
     geometry(node,e);
     if(!e.id){e.loaded=true;continue;}
    Promise.resolve(store.get(e.id)).then(row=>{
      if(dead||nodes.get(node)!==e)return;
      if(!row)throw Error('Saved media is missing.');
      e.asset=row.asset;
      const url=blob=>{const u=root.URL.createObjectURL(blob);e.urls.push(u);return u;};
      e.liveURL=url(row.blob);
      if(e.still){if(!row.poster)throw Error('Saved still is missing.');e.still.src=url(row.poster);}
      if(e.live.tagName==='VIDEO'){
        e.live.muted=e.live.defaultMuted=e.live.playsInline=true;
        e.live.volume=0;
        e.live.poster=e.still?.src||'';
        e.loop=event=>{
          const loop=e.frame?.loop;
          if(e.playing&&loop&&(e.live.currentTime>=loop.end||e.live.currentTime<loop.start||event?.type==='ended')){
            const ended=e.live.ended||event?.type==='ended';
            e.live.currentTime=loop.start;
            if(ended)e.live.play?.()?.catch?.(()=>{});
          }
        };
        e.silence=()=>{e.live.muted=true;e.live.volume=0;};
        listen(e.live,'timeupdate',e.loop);
        listen(e.live,'ended',e.loop);
        listen(e.live,'volumechange',e.silence);
      }
      else if(!e.still)e.live.src=e.liveURL;
      e.loaded=true;
      geometry(node,e);
      update();
    }).catch(error=>{
      if(!dead&&nodes.get(node)===e)onError(error);
    });
   }fallback();
  }
  const mutation=typeof root.MutationObserver==='function'?new root.MutationObserver(update):null;
  for(let el=container;el;el=el.parentElement||el.getRootNode?.()?.host)
    mutation?.observe(el,{attributes:true,subtree:el===container,attributeFilter:['hidden','aria-hidden','class','style','data-motion-style','data-art-rest']});
  listen(doc,'visibilitychange',update);
  listen(reduced,'change',update);
  listen(doc,'scroll',fallback);
  const resized=()=>{for(const [node,e]of nodes)geometry(node,e);fallback();};
  listen(root,'resize',resized);
  return {sync,update,destroy(){
    dead=true;
    intersection?.disconnect();
    resize?.disconnect();
    mutation?.disconnect();
    doc.removeEventListener?.('visibilitychange',update);
    doc.removeEventListener?.('scroll',fallback);
    reduced?.removeEventListener?.('change',update);
    root.removeEventListener?.('resize',resized);
    for(const [node,e]of nodes)drop(node,e);
  }};
 }
 const api={asset,framed,clean,resolve,layout,render,createController};root.ReserveMediaFrame=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
