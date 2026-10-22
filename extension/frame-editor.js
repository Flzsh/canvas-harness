/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Canvas Harness local framing controls. Original creator: Flzsh. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const views=['narrow','wide'],heights={small:90,medium:140,tall:220},frameAPI=()=>root.ReserveMediaFrame;
 const copy=f=>({...f,focus:{...f.focus},...(f.loop?{loop:{...f.loop}}:{})}),video=a=>a?.kind==='video'||/^video\//.test(a?.type||'');
 const seconds=(value,duration,down=false)=>Math.min(down?Math.floor((value??0)*10)/10:Number((value??0).toFixed(1)),Math.floor((duration??3600)*10)/10).toFixed(1);
 function dimensions(value){return value&&Number.isFinite(value.width)&&Number.isFinite(value.height)&&value.width>0&&value.height>0&&value.width<=1000000&&value.height<=1000000?{width:value.width,height:value.height}:null;}
 function shape(kind,frame,view='wide',appearance={}){
  const saved=dimensions(appearance.shapes?.[kind]?.[view]||appearance.shapes?.[view]);if(saved)return saved;
  if(kind==='card')return view==='narrow'?{width:160,height:90}:{width:320,height:144};
  if(kind==='background')return view==='narrow'?{width:390,height:844}:{width:1440,height:900};
  return {width:view==='narrow'?360:960,height:heights[frame.height]||140};
 }
 function sourceSize(a){
  const known=dimensions(a);if(known)return known;
  const match=/\bviewBox\s*=\s*["']([^"']+)["']/.exec(a?.svg||''),parts=match?.[1].trim().split(/[\s,]+/).map(Number),box=parts?.length===4&&dimensions({width:parts[2],height:parts[3]});
  return box||{width:1200,height:240};
 }
 function preview(frame,kind){
  const neutral={...copy(frame),focus:{x:.5,y:.5},zoom:1,fit:'contain'},html=frameAPI().render(neutral,{kind,className:'ch-frame-source',playback:false});
  return html.replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi,'<img class="ch-frame-live" alt="" draggable="false" hidden>');
 }
 function render(value,{id='all',kind='banner',appearance={}}={}){
  const F=frameAPI();if(!value||!F||!['banner','card','background'].includes(kind))return '';
  const frame=F.resolve(value,appearance),a=frame.asset,html=preview(frame,kind),label=kind==='card'?'Card':kind==='background'?'Background':'Banner';
  const saved={bannerFit:appearance.bannerFit,bannerPosition:appearance.bannerPosition,bannerSize:appearance.bannerSize};
  if(appearance.shapes)saved.shapes=Object.fromEntries(views.map(view=>[view,shape(kind,frame,view,appearance)]));
  const field=(key,title,type,value,extra='')=>`<label class="rd-field ch-frame-field"><span>${title}</span><input type="${type}" data-ch-frame-field="${key}" value="${E(value)}" aria-label="${title}" ${extra}></label>`;
  const choice=(key,title,options,value)=>`<fieldset class="ch-frame-choice" data-ch-frame-choice="${key}"><legend>${title}</legend>${options.map(([v,name])=>`<label class="ch-frame-chip"><input type="radio" name="ch-frame-${E(id)}-${kind}-${key}" data-ch-frame-field="${key}" value="${v}"${v===value?' checked':''}><span>${name}</span></label>`).join('')}</fieldset>`;
  return `<div class="ch-frame-editor" data-ch-frame-editor data-ch-frame-id="${E(id)}" data-ch-frame-kind="${kind}" data-ch-frame-appearance="${E(JSON.stringify(saved))}" role="group" aria-label="${label} framing"><div class="ch-frame-previews">${views.map(view=>{const box=shape(kind,frame,view,appearance),size=sourceSize(a),g=F.layout(size.width,size.height,box.width,box.height,frame);return `<div class="ch-frame-view" data-ch-frame-view="${view}"><span>${view==='narrow'?'Narrow':'Wide'}</span><div class="ch-frame-preview" data-ch-frame-preview="${view}" style="aspect-ratio:${box.width}/${box.height}" tabindex="0" role="group" aria-label="${view==='narrow'?'Narrow':'Wide'} ${label.toLowerCase()} framing"><div class="ch-frame-art" data-ch-frame-art style="width:${g.width/box.width*100}%;height:${g.height/box.height*100}%;left:${g.left/box.width*100}%;top:${g.top/box.height*100}%">${html}</div></div></div>`;}).join('')}</div><div class="ch-frame-controls">${field('zoom','Zoom','range',Math.round(frame.zoom*100),'min="100" max="400" step="1"')}<output data-ch-frame-zoom aria-live="off">${Math.round(frame.zoom*100)}%</output>${choice('fit','Fit',[['cover','Fill'],['contain','Fit whole']],frame.fit)}${kind==='card'?'':choice('height','Height',[['small','Small'],['medium','Medium'],['tall','Tall']],frame.height)}</div>${video(a)?`<div class="ch-frame-controls">${field('start','Loop from (s)','number',seconds(frame.loop?.start,a.duration),`min="0" max="${a.duration||3600}" step="0.1"`)}${field('end','Loop to (s)','number',seconds(frame.loop?.end??a.duration,a.duration,true),`min="0" max="${a.duration||3600}" step="0.1"`)}${field('still','Still at (s)','number',seconds(frame.still,a.duration),`min="0" max="${a.duration||3600}" step="0.1"`)}</div>`:''}</div>`;
 }
 function create(container,{read,save,onError=()=>{},shape:measureShape}={}){
  if(!container||typeof read!=='function'||typeof save!=='function')throw Error('Framing controls need read and save callbacks.');
  const doc=container.ownerDocument||root.document,entries=new Map(),listeners=[];let dead=false,tail=null;
  const listen=(node,type,fn,options)=>{node?.addEventListener?.(type,fn,options);listeners.push([node,type,fn,options]);};
  const error=(cause,e)=>{if(!dead)onError(cause instanceof Error?cause:Error(String(cause)),{id:e?.id,kind:e?.kind});};
  const find=node=>{const editor=node?.closest?.('[data-ch-frame-editor]');return editor&&entries.get(editor);};
  const active=e=>e.points.size||e.editing||e.timer!==null;
  function boxes(e){
   e.boxes=new Map();for(const node of e.el.querySelectorAll('[data-ch-frame-preview]')){const view=node.dataset.chFramePreview,box=dimensions(measureShape?.(e.id,e.kind,view,copy(e.frame)))||shape(e.kind,e.frame,view,e.appearance);e.boxes.set(node,box);node.style.aspectRatio=box.width+'/'+box.height;}
  }
  function geometry(e,node){const box=e.boxes.get(node),size=sourceSize(e.frame.asset);return {...frameAPI().layout(size.width,size.height,box.width,box.height,e.frame),box};}
  function paint(e){
   for(const [node,box]of e.boxes){const g=geometry(e,node),art=node.querySelector('[data-ch-frame-art]');
    if(art){art.style.width=g.width/box.width*100+'%';art.style.height=g.height/box.height*100+'%';art.style.left=g.left/box.width*100+'%';art.style.top=g.top/box.height*100+'%';}
   }
   for(const node of e.el.querySelectorAll('[data-ch-frame-field]')){const key=node.dataset.chFrameField,value=key==='zoom'?Math.round(e.frame.zoom*100):key==='start'||key==='end'?e.frame.loop?.[key]:e.frame[key];if(node.type==='radio')node.checked=node.value===value;else if(value!==undefined)node.value=key==='start'||key==='end'||key==='still'?seconds(value,e.frame.asset.duration,key==='end'):String(value);}
   const output=e.el.querySelector('[data-ch-frame-zoom]');if(output)output.textContent=Math.round(e.frame.zoom*100)+'%';
  }
  function clearTimer(e){if(e.timer!==null){root.clearTimeout(e.timer);e.timer=null;}}
  function cancel(e){
   clearTimer(e);if(e.before)e.frame=copy(e.before);e.before=null;e.gesture=null;e.editing=false;e.dirty=false;
   for(const [id,p]of e.points){try{p.node.releasePointerCapture?.(id);}catch{}}e.points.clear();if(!dead)paint(e);
  }
  function commit(e){
   clearTimer(e);if(!e.dirty||dead)return;e.dirty=false;
   let frame;try{frame=frameAPI().resolve(copy(e.frame));}catch(cause){error(cause,e);return;}
   const version=++e.version;e.pending++;
   const write=()=>{if(!dead)return save(e.id,e.kind,copy(frame));};
   const finish=cause=>{
    e.pending--;if(cause&&!dead){if(e.version===version&&!active(e)&&container.contains(e.el)){try{e.frame=frameAPI().resolve(read(e.id,e.kind),e.appearance);boxes(e);paint(e);}catch{} }error(cause,e);}
   };
   let task;try{task=tail?tail.then(write):write();}catch(cause){finish(cause);return;}
   const next=Promise.resolve(task).then(()=>finish(),cause=>finish(cause));tail=next;next.then(()=>{if(tail===next)tail=null;});
  }
  function sync(){
   if(dead||!frameAPI())return;
   const wanted=new Set(container.querySelectorAll('[data-ch-frame-editor]'));if(container.matches?.('[data-ch-frame-editor]'))wanted.add(container);
   for(const [node,e]of entries)if(!wanted.has(node)){cancel(e);entries.delete(node);}
   for(const node of wanted){let e=entries.get(node);if(e&&(active(e)||e.pending))continue;
    try{if(!e){let appearance={};try{appearance=JSON.parse(node.dataset.chFrameAppearance||'{}');}catch{}e={el:node,id:node.dataset.chFrameId,kind:node.dataset.chFrameKind,appearance,points:new Map(),boxes:new Map(),dirty:false,editing:false,timer:null,before:null,gesture:null,pending:0,version:0};}
     const value=read(e.id,e.kind);if(!value)continue;e.frame=frameAPI().resolve(value,e.appearance);entries.set(node,e);boxes(e);paint(e);
    }catch(cause){error(cause,e);}
   }
  }
  function baseline(e,node,rect){
   const points=[...e.points.values()],center=points.reduce((p,v)=>({x:p.x+v.x/points.length,y:p.y+v.y/points.length}),{x:0,y:0});
   e.gesture={node,rect:rect||node.getBoundingClientRect?.(),frame:copy(e.frame),g:geometry(e,node),center,distance:points.length>1?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0,moved:!!e.gesture?.moved||points.length>1,pinch:!!e.gesture?.pinch||points.length>1};
  }
  function focusAt(e,x,y){const g=e.gesture,rect=g.rect;e.frame.focus={x:clamp(((x-rect.left)*g.g.box.width/rect.width-g.g.left)/g.g.width,0,1),y:clamp(((y-rect.top)*g.g.box.height/rect.height-g.g.top)/g.g.height,0,1)};}
  function down(event){
   const node=event.target?.closest?.('[data-ch-frame-preview]'),e=find(node);if(!e||event.button!==undefined&&event.button!==0||e.points.size>=2||e.gesture&&e.gesture.node!==node)return;
   const rect=node.getBoundingClientRect?.();if(!rect?.width||!rect?.height)return;
   event.preventDefault();clearTimer(e);if(!e.points.size){e.before=copy(e.frame);e.gesture=null;}e.points.set(event.pointerId??0,{x:event.clientX,y:event.clientY,node});baseline(e,node,rect);
   try{node.setPointerCapture?.(event.pointerId??0);}catch{}
  }
  function move(event){
   for(const e of entries.values()){const point=e.points.get(event.pointerId??0);if(!point)continue;event.preventDefault();point.x=event.clientX;point.y=event.clientY;
    const g=e.gesture,points=[...e.points.values()],center=points.reduce((p,v)=>({x:p.x+v.x/points.length,y:p.y+v.y/points.length}),{x:0,y:0}),dx=center.x-g.center.x,dy=center.y-g.center.y;
    if(Math.hypot(dx,dy)>2||points.length>1)g.moved=true;
    if(points.length>1){const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);e.frame.zoom=clamp(g.frame.zoom*(g.distance>0?distance/g.distance:1),1,4);}
    const pan=(size,box,offset,delta,view,focus)=>size<=box?focus:clamp((box/2-offset-delta*box/view)/size,0,1);e.frame.focus={x:pan(g.g.width,g.g.box.width,g.g.left,dx,g.rect.width,g.frame.focus.x),y:pan(g.g.height,g.g.box.height,g.g.top,dy,g.rect.height,g.frame.focus.y)};
    e.dirty=true;paint(e);return;
   }
  }
  function up(event){
   for(const e of entries.values()){const point=e.points.get(event.pointerId??0);if(!point)continue;event.preventDefault();const g=e.gesture;
    e.points.delete(event.pointerId??0);try{point.node.releasePointerCapture?.(event.pointerId??0);}catch{}
    if(e.points.size){baseline(e,g.node,g.rect);return;}
    if(!g.moved&&!g.pinch){focusAt(e,event.clientX??point.x,event.clientY??point.y);e.dirty=true;paint(e);}
    e.before=null;e.gesture=null;commit(e);return;
   }
  }
  function interrupted(event){for(const e of entries.values())if(e.points.has(event.pointerId??0)){cancel(e);return;}}
  function wheel(event){
   const node=event.target?.closest?.('[data-ch-frame-preview]'),e=find(node);if(!e||e.points.size||!Number.isFinite(event.deltaY))return;event.preventDefault();
   e.frame.zoom=clamp(e.frame.zoom*Math.exp(-event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?400:1)*.002),1,4);e.dirty=true;paint(e);clearTimer(e);e.timer=root.setTimeout(()=>{e.timer=null;if(!e.points.size&&!e.editing)commit(e);},150);
  }
  function field(event){
   const node=event.target?.closest?.('[data-ch-frame-field]'),e=find(node);if(!e)return;
   const key=node.dataset.chFrameField;if(node.type==='radio'&&!node.checked||event.type==='input'&&key!=='zoom')return;
   try{const next=copy(e.frame),number=()=>{const n=Number(node.value);if(!String(node.value).trim()||!Number.isFinite(n))throw Error('Choose a valid '+(key==='still'?'still time.':key==='start'||key==='end'?'loop time.':'zoom.'));return n;};
    if(key==='zoom')next.zoom=clamp(number()/100,1,4);
    else if(key==='fit'&&['cover','contain'].includes(node.value))next.fit=node.value;
    else if(key==='height'&&e.kind!=='card'&&Object.hasOwn(heights,node.value))next.height=node.value;
    else if((key==='start'||key==='end')&&video(next.asset))next.loop={...next.loop,[key]:number()};
    else if(key==='still'&&video(next.asset))next.still=number();else return;
    const changed=JSON.stringify(next)!==JSON.stringify(e.frame);e.frame=frameAPI().resolve(next);e.dirty=e.dirty||changed;e.editing=event.type==='input';if(key==='height')boxes(e);paint(e);if(!e.editing)commit(e);
   }catch(cause){e.editing=false;paint(e);error(cause,e);}
  }
  function key(event){
   const node=event.target?.closest?.('[data-ch-frame-preview]'),e=find(node);if(!e||event.altKey||event.ctrlKey||event.metaKey)return;
   const step=event.shiftKey?0.1:0.01,direction={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
   if(event.key==='Escape'&&(e.points.size||e.dirty)){event.preventDefault();cancel(e);return;}
   if(direction)e.frame.focus={x:clamp(e.frame.focus.x+direction[0],0,1),y:clamp(e.frame.focus.y+direction[1],0,1)};
   else if(['+','=','-','_'].includes(event.key))e.frame.zoom=clamp(e.frame.zoom+(['-','_'].includes(event.key)?-.05:.05),1,4);else return;
   event.preventDefault();e.dirty=true;paint(e);commit(e);
  }
  listen(container,'pointerdown',down);listen(doc,'pointermove',move);listen(doc,'pointerup',up);listen(doc,'pointercancel',interrupted);listen(container,'wheel',wheel,{passive:false});listen(container,'input',field);listen(container,'change',field);listen(container,'keydown',key);
  sync();
  return {sync,destroy(){if(dead)return;dead=true;for(const e of entries.values())cancel(e);entries.clear();for(const [node,type,fn,options]of listeners)node?.removeEventListener?.(type,fn,options);listeners.length=0;}};
 }
 const api={render,create,shape};root.ReserveFrameEditor=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
