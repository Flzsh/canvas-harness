/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/*! Canvas Harness — prevalidated, data-only dashboard themes. Original creator: Flzsh. */
(function(global){
 'use strict';
 const states=new WeakMap(),imageTypes=new Set(['image/svg+xml','image/png','image/webp','image/jpeg','image/gif','image/avif']),videoTypes=new Set(['video/mp4','video/webm']);
 const modes=new Set(['gentle','still','off']),fits=new Set(['cover','contain']),positions=new Set(['center','top','bottom','left','right']);
 const licenses=new Set(['OFL-1.1','Apache-2.0','CC0-1.0']),colorNames=['bg','surface','ink','muted','line','accent'],MAX_BYTES=40000000;
 const marker='data-rd-data-theme',bannerMarker='data-rd-data-banner',motifMarker='data-rd-data-motif';
 let sequence=0;
 function invalid(message){throw new TypeError('Invalid prevalidated theme: '+message);}
 function object(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
 function framing(){
   const api=global.ReserveMediaFrame||(typeof module==='object'&&module.exports?require('./media-frame.js'):null);
   if(!api?.resolve||!api.layout)invalid('media framing support unavailable');
   return api;
 }
 function number(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)invalid(label);return value;}
 function enumValue(value,allowed,fallback,label){if(value===undefined)return fallback;if(!allowed.has(value))invalid(label);return value;}
 function describe(pack){
  if(!object(pack)||pack.format!=='chtheme'||pack.version!==1||!object(pack.colors))invalid('expected a validated chtheme v1 pack');
  const d={colors:{},assets:new Map(),background:null,banner:null,frames:{},title:null,icons:[]};
  for(const mode of ['light','dark'])if(Object.hasOwn(pack.colors,mode)){
   const palette=pack.colors[mode];if(!object(palette))invalid('color palette');d.colors[mode]={};
   for(const key of colorNames){if(typeof palette[key]!=='string'||!/^#[\da-f]{6}$/i.test(palette[key]))invalid('colors.'+mode+'.'+key);d.colors[mode][key]=palette[key];}
  }
  if(!Object.keys(d.colors).length)invalid('missing color palette');
  function ref(id,types){
   if(typeof id!=='string'||!id.length||['__proto__','constructor','prototype'].includes(id)||!object(pack.assets)||!Object.hasOwn(pack.assets,id))invalid('asset reference');
   const asset=pack.assets[id];
   if(!object(asset)||
     !types.has(asset.type)||
     typeof asset.data!=='string'||
     !asset.data.length||
     asset.data.length>Math.ceil(MAX_BYTES/3)*4||
     typeof asset.sha256!=='string'||
     !(/^[\da-f]{64}$/i).test(asset.sha256))
     invalid('asset '+id);
   for(const key of ['svg','still'])
     if(asset[key]!==undefined&&(asset.type!=='image/svg+xml'||typeof asset[key]!=='string'||asset[key].length>MAX_BYTES||!/^\s*<svg\b/.test(asset[key])))invalid('sanitized SVG '+id);
   d.assets.set(id,asset);return id;
  }
  for(const kind of ['background','banner'])if(pack[kind]!==undefined){
   const value=pack[kind];if(!object(value))invalid(kind);
   d[kind]={
     asset:ref(value.asset,new Set([...imageTypes,...videoTypes])),
     fit:enumValue(value.fit,kind==='background'?new Set([...fits,'tile']):fits,'cover',kind+'.fit'),
     position:enumValue(value.position,positions,'center',kind+'.position')
   };
   if(value.still!==undefined)d[kind].still=typeof value.still==='number'?number(value.still,0,3600,kind+'.still'):ref(value.still,imageTypes);
   if(value.stillAsset!==undefined)d[kind].stillAsset=ref(value.stillAsset,imageTypes);
   if(value.focus!==undefined){if(!object(value.focus))invalid(kind+'.focus');d[kind].focus={x:number(value.focus.x,0,1,kind+'.focus.x'),y:number(value.focus.y,0,1,kind+'.focus.y')};}
   if(value.zoom!==undefined)d[kind].zoom=number(value.zoom,1,4,kind+'.zoom');
   if(value.height!==undefined)d[kind].height=enumValue(value.height,new Set(['small','medium','tall']),'medium',kind+'.height');
   if(value.loop!==undefined){
     if(!object(value.loop))invalid(kind+'.loop');
     d[kind].loop={start:number(value.loop.start,0,3600,kind+'.loop.start'),end:number(value.loop.end,0,3600,kind+'.loop.end')};
     if(value.loop.end-value.loop.start<.05||value.loop.end-value.loop.start>60)invalid(kind+'.loop');
   }
  }
  if(pack.frames!==undefined){
   if(!object(pack.frames))invalid('frames');
   for(const kind of ['panel','card'])if(pack.frames[kind]!==undefined){
    const frame=pack.frames[kind];
    if(!object(frame)||!Array.isArray(frame.slice)||frame.slice.length!==4||frame.slice.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0))invalid('frame slice');
    d.frames[kind]={asset:ref(frame.asset,new Set(['image/svg+xml'])),slice:frame.slice.slice()};
   }
  }
  if(pack.title!==undefined){
   const title=pack.title;
   if(!object(title)||!licenses.has(title.license)||typeof title.weight!=='number'||!Number.isInteger(title.weight)||title.weight<1||title.weight>1000)invalid('title font or license');
   d.title={asset:ref(title.asset,new Set(['font/woff2'])),weight:title.weight,license:title.license};
  }
  if(pack.icons!==undefined){if(!Array.isArray(pack.icons)||pack.icons.length>6)invalid('icons');d.icons=pack.icons.map(id=>ref(id,imageTypes));}
  d.key=JSON.stringify([
    d.colors,
    d.background,
    d.banner,
    d.frames,
    d.title,
    d.icons,
    [...d.assets].map(([id,a])=>[id,a.type,a.sha256.toLowerCase(),a.width,a.height,a.duration,a.animated])
  ]);
  return d;
 }
 function optionsFor(container,options){
  if(!object(options))invalid('render options');
  const theme=options.theme??container.getAttribute('data-theme')??'light';if(theme!=='light'&&theme!=='dark')invalid('render theme');
  return {theme,motionStyle:enumValue(options.motionStyle,modes,modes.has(container.getAttribute('data-motion-style'))?container.getAttribute('data-motion-style'):'gentle','motionStyle')};
 }
 function setAttr(el,key,value){if(el.getAttribute(key)!==value)el.setAttribute(key,value);}
 function dropAttr(el,key){if(el.hasAttribute(key))el.removeAttribute(key);}
 function hide(el,value){if(el.hidden!==value)el.hidden=value;}
 function restore(el,key,before,id){if(el.getAttribute(key)!==id)return;if(before===null)dropAttr(el,key);else setAttr(el,key,before);}
 function listen(state,target,event,fn,options){
   if(!target?.addEventListener)return;
   target.addEventListener(event,fn,options);
   state.disposers.push(()=>target.removeEventListener(event,fn,options));
 }
 function inViewport(state,node){
   const box=node.getBoundingClientRect?.();
   return !!box&&
     box.width>0&&
     box.height>0&&
     box.bottom>0&&
     box.right>0&&
     box.top<(state.win.innerHeight||state.doc.documentElement?.clientHeight||10000)&&
     box.left<(state.win.innerWidth||state.doc.documentElement?.clientWidth||10000);
 }
 function hidden(state,entry){
  const {container:rd,doc,root,win}=state;if(doc.hidden||doc.visibilityState==='hidden'||rd.isConnected===false||!state.intersecting)return true;
  if(entry&&(entry.node.isConnected===false||entry.node.hidden))return true;
  const seen=new Set();
  for(const start of [entry?.node.parentElement,rd,root.host])for(let el=start;el&&!seen.has(el);el=el.parentElement||el.getRootNode?.()?.host){
   seen.add(el);if(el.hidden||el.getAttribute?.('aria-hidden')==='true'&&!el.classList?.contains('rd-heading-art')&&!el.classList?.contains('rd-banner-art'))return true;
   const css=win.getComputedStyle?.(el);if(css?.display==='none'||css?.visibility==='hidden'||css?.visibility==='collapse'||css?.contentVisibility==='hidden')return true;
  }
  return false;
 }
 function rasterAnimated(bytes,type){
  const n=bytes.length,word=at=>String.fromCharCode(...bytes.subarray(at,at+4)),u32=at=>(bytes[at]*16777216+bytes[at+1]*65536+bytes[at+2]*256+bytes[at+3]);
  if(type==='image/png'){for(let at=8;at+12<=n;){const size=u32(at);if(word(at+4)==='acTL')return true;if(!Number.isFinite(size)||at+size+12>n)break;at+=size+12;}return false;}
  if(type==='image/webp'){
    for(let at=12;at+8<=n;){
      const tag=word(at+0),size=bytes[at+4]+bytes[at+5]*256+bytes[at+6]*65536+bytes[at+7]*16777216;
      if(tag==='ANIM'||tag==='ANMF'||tag==='VP8X'&&size>=10&&!!(bytes[at+8]&2))return true;
      if(!Number.isFinite(size)||at+size+8>n)break;
      at+=size+8+(size%2);
    }
    return false;
  }
  if(type!=='image/gif')return false;
  if(n<13)return true;
  let at=13+(bytes[10]&128?3*(1<<((bytes[10]&7)+1)):0),frames=0;
  function blocks(){while(at<n){const size=bytes[at++];if(!size)return true;if(at+size>n)return false;at+=size;}return false;}
  while(at<n){
    const tag=bytes[at++];
    if(tag===59)return false;
    if(tag===33){at++;if(!blocks())return true;}
    else if(tag===44){if(at+9>n)return true;const local=bytes[at+8];at+=9+(local&128?3*(1<<((local&7)+1)):0);if(++frames>1)return true;at++;if(!blocks())return true;}else return true;
  }
  return true;
 }
 function readAsset(state,id){
  if(state.bytes.has(id))return state.bytes.get(id);
  const asset=state.data.assets.get(id),encoded=asset.data;
  if(encoded.length%4||!(/^[A-Za-z0-9+/]*={0,2}$/).test(encoded))invalid('base64 asset '+id);
  const decode=state.win.atob||global.atob;if(typeof decode!=='function')invalid('base64 decoding unavailable');
  const binary=decode(encoded);state.byteCount+=binary.length;if(state.byteCount>MAX_BYTES)invalid('asset size limit');
  const bytes=new Uint8Array(binary.length);for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);
  const text=asset.svg??binary,
    animated=videoTypes.has(asset.type)||
      rasterAnimated(bytes,asset.type)||
      asset.type==='image/svg+xml'&&(/<(?:animate|animateTransform|animateMotion|set)\b|@(?:-webkit-)?keyframes\b|\banimation(?:-[\w-]+)?\s*:/i.test(text));
  const width=asset.width,height=asset.height;if(width!==undefined)number(width,.000001,1000000,'asset width');if(height!==undefined)number(height,.000001,1000000,'asset height');
  const resource={
    asset,
    bytes,
    animated:videoTypes.has(asset.type)||asset.animated===true||animated,
    live:asset.svg??bytes,
    still:asset.still,
    width,
    height,
    duration:asset.duration
  };
  state.bytes.set(id,resource);
  return resource;
 }
 function assetURL(state,id,still=false){
  const resource=readAsset(state,id);if(still&&resource.animated&&!resource.still)invalid('animated asset needs a still copy: '+id);
  const useStill=still&&typeof resource.still==='string'&&resource.still!==resource.asset.svg,key=id+(useStill?':still':':live');
  if(state.urlCache.has(key))return state.urlCache.get(key);
  const blob=new state.Blob([useStill?resource.still:resource.live],{type:resource.asset.type}),url=state.URL.createObjectURL(blob);state.urls.add(url);
  if(typeof url!=='string'||!/^blob:[A-Za-z0-9:/_.-]+$/.test(url))invalid('unsafe object URL');
  state.urlCache.set(key,url);return url;
 }
 function sourceFor(state,value){
  const resource=readAsset(state,value.asset),
    still=value.stillAsset||(typeof value.still==='string'?value.still:null),
    animated=resource.animated||!!still,
    type=resource.asset.type;
  let frame;
  if(['focus','zoom','height','loop'].some(key=>value[key]!==undefined)||typeof value.still==='number')
    frame=framing().resolve({
      asset:{type,kind:videoTypes.has(type)?'video':'image',...(resource.duration!==undefined?{duration:resource.duration}:{})},
      focus:value.focus||{x:({left:0,right:1})[value.position]??.5,y:({top:0,bottom:1})[value.position]??.5},
      zoom:value.zoom??1,
      fit:value.fit==='contain'?'contain':'cover',
      height:value.height||'medium',
      ...(value.loop?{loop:value.loop}:{}),
      ...(typeof value.still==='number'?{still:value.still}:{})
    });
  return {
    type,
    animated,
    live:assetURL(state,value.asset),
    still:still?assetURL(state,still,true):assetURL(state,value.asset,animated),
    fit:value.fit||'contain',
    position:value.position||'center',
    width:resource.width,
    height:resource.height,
    frame
  };
 }
 function frameRule(scope,selector,frame){
  const slice=frame.slice.join(' '),width=frame.slice.map(n=>n+'px').join(' ');
  return selector.split(',').map(s=>scope+' '+s.trim()).join(',')+'{border-style:solid!important;border-color:transparent!important;border-width:1px!important;border-image-source:url("'+frame.url+'")!important;border-image-slice:'+slice+'!important;border-image-width:'+width+'!important;border-image-outset:0!important;border-image-repeat:stretch!important;}';
 }
 function stylesheet(state,theme){
  const d=state.data,mode=d.colors[theme]?theme:d.colors.light?'light':'dark',p=d.colors[mode],scope='.rd['+marker+'="'+state.id+'"]',rules=[];
  const vars={};for(const key of colorNames)vars[key]=p[key];
  for(const key of ['surface-2','surface-3','sidebar','sidebar-hover','sidebar-sel','tint','row-hover'])vars[key]=p.surface;
  for(const key of ['control-line','line-strong'])vars[key]=p.line;
  for(const key of ['ink-2'])vars[key]=p.ink;
  for(const key of ['faint','control'])vars[key]=p.muted;
  for(const key of ['mark','switch-on','accent-deep'])vars[key]=p.accent;
  vars.soft='color-mix(in srgb,'+p.accent+' 8%,'+p.surface+')';
  rules.push(scope+'{'+Object.entries(vars).map(([key,value])=>'--rd-'+key+':'+value+'!important;').join('')+'color-scheme:'+mode+';'+(state.background?'position:relative;isolation:isolate;':'')+'}');
  if(state.background){
    const tiledVideo=d.background.fit==='tile'&&!!state.background.video&&!state.background.source.frame,child=tiledVideo?' > .rd-data-theme-tile > ':' > ';
    rules.push(scope+
      ' > .rd-data-theme-background{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;'+
      (tiledVideo?
        'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));':
        d.background.fit==='tile'&&!state.background.video?'background-repeat:repeat;background-position:'+d.background.position+';':'')+
      '}'+
      (tiledVideo?scope+' > .rd-data-theme-background > .rd-data-theme-tile{min-width:0;min-height:0;overflow:hidden;}':'')+
      scope+
      ' > .rd-data-theme-background'+
      child+
      'img,'+
      scope+
      ' > .rd-data-theme-background'+
      child+
      'video{display:block;width:100%;height:100%;object-fit:'+
      (tiledVideo?'cover':d.background.fit==='tile'?'contain':d.background.fit)+
      ';object-position:'+
      d.background.position+
      ';}'+
      (d.background.fit==='tile'&&!state.background.video?scope+' > .rd-data-theme-background > img{visibility:hidden;}':''));
  }
  if(state.bannerSource)
    rules.push(scope+
      ' ['+
      bannerMarker+
      '="'+
      state.id+
      '"] > :not(.rd-data-theme-banner){display:none!important;}'+
      scope+
      ' .rd-data-theme-banner{display:block;position:relative;width:100%;height:100%;pointer-events:none;overflow:hidden;}'+
      scope+
      ' .rd-data-theme-banner > img,'+
      scope+
      ' .rd-data-theme-banner > video{display:block;width:100%;height:100%;object-fit:'+
      d.banner.fit+
      ';object-position:'+
      d.banner.position+
      ';}');
  if(d.banner?.height){
    const height=({small:90,medium:140,tall:220})[d.banner.height]+'px',slot='['+bannerMarker+'="'+state.id+'"]';
    rules.push(scope+
      ' .rd-workspace-heading:has('+
      slot+
      '),'+
      scope+
      ' .rd-course-banner:has('+
      slot+
      '){--rd-band-h:'+
      height+
      ';--ch-banner-h:'+
      height+
      ';}'+
      scope+
      ' '+
      slot+
      '{height:'+
      height+
      '!important;--rd-band-h:'+
      height+
      ';--rd-art-h:'+
      height+
      ';}');
  }
  if(state.background||state.bannerSource)rules.push(scope+' .rd-data-theme-background > [hidden],'+scope+' .rd-data-theme-tile > [hidden],'+scope+' .rd-data-theme-banner > [hidden]{display:none!important;}');
  if(state.frames.panel)rules.push(frameRule(scope,'.rd-widget,.rd-course-information,.rd-work-column,.rd-information,[role="tabpanel"]',state.frames.panel));
  if(state.frames.card){
    rules.push(frameRule(scope,'.rd-rail-all > .rd-frame,.rd-rail-course > .rd-frame,.rd-course-card',state.frames.card));
    rules.push(scope+' .rd-rail-all > .rd-frame > *,'+scope+' .rd-rail-course > .rd-frame > *{display:none!important;}');
  }
  if(state.font)rules.push(['h1','h2','h3','h4','h5','h6'].map(s=>scope+' '+s).join(',')+'{font-family:"'+state.id+'",var(--rd-ui-font,system-ui)!important;font-weight:'+d.title.weight+'!important;}');
  if(state.iconSources.length)
    rules.push(scope+
      ' .rd-rail-art['+
      motifMarker+
      '="'+
      state.id+
      '"] > svg,'+
      scope+
      ' svg.rd-mini['+
      motifMarker+
      '="'+
      state.id+
      '"]{display:none!important;}'+
      scope+
      ' .rd-rail-art > .rd-data-theme-icon{display:block;width:100%;height:100%;object-fit:contain;}'+
      scope+
      ' .rd-data-theme-mini{display:inline-block;object-fit:contain;vertical-align:middle;flex:none;}');
  return rules.join('\n');
 }
 function mediaNode(state,source,kind){
  const doc=state.doc,
    icon=kind==='icon',
    node=doc.createElement(icon?'img':'div'),
    entry={
      node,
      source,
      kind,
      video:null,
      img:null,
      videos:[],
      images:[],
      moving:null,
      anchor:null,
      previous:null,
      marker:null,
      disposers:[],
      intersecting:source.animated?null:true,
      failed:false
    },
    isVideo=videoTypes.has(source.type),
    count=kind==='background'&&source.fit==='tile'&&isVideo&&!source.frame?4:1;
  node.className=icon?'rd-data-theme-icon':'rd-data-theme-'+kind;setAttr(node,'aria-hidden','true');
  if(kind==='background')setAttr(node,'data-rd-keep','');
  const on=(target,event,fn)=>{target.addEventListener(event,fn);entry.disposers.push(()=>target.removeEventListener(event,fn));};
  for(let i=0;i<count;i++){
  const cell=count===1?node:doc.createElement('div');if(count>1){cell.className='rd-data-theme-tile';node.append(cell);}
  if(isVideo){
    const video=doc.createElement('video');
    video.muted=true;
    video.defaultMuted=true;
    video.volume=0;
    video.loop=!source.frame?.loop;
    video.playsInline=true;
    video.autoplay=false;
    video.controls=false;
    video.preload='none';
    video.poster=source.still;
    setAttr(video,'aria-hidden','true');
    video.tabIndex=-1;
    entry.videos.push(video);
    entry.video??=video;
    cell.append(video);
   const seek=()=>{
     const loop=source.frame?.loop;
     if(!entry.moving||!loop||video.readyState<1)return;
     if(!Number.isFinite(video.currentTime)||video.currentTime<loop.start||video.currentTime>=loop.end){try{video.currentTime=loop.start;}catch{}}
   };
   on(video,'loadedmetadata',seek);
   on(video,'timeupdate',seek);
   on(video,'ended',()=>{seek();if(entry.moving)video.play?.()?.catch?.(()=>{});});
   on(video,'volumechange',()=>{if(!video.muted)video.muted=true;if(video.volume!==0)video.volume=0;});
   entry.seek=seek;
  }
  const img=icon?node:doc.createElement('img');img.alt='';img.draggable=false;setAttr(img,'aria-hidden','true');entry.images.push(img);entry.img??=img;if(!icon)cell.append(img);
  }
  if(source.frame)setAttr(node,'data-ch-frame-height',source.frame.height);
  state.media.add(entry);
  state.entries.set(node,entry);
  if(source.animated)state.intersection?.observe(node);
  if(source.frame)state.resize?.observe(node);
  return entry;
 }
 function layoutEntry(state,entry,box){
  const source=entry.source;if(!source.frame||!source.width||!source.height)return;box??=entry.node.getBoundingClientRect?.();if(!box?.width||!box?.height)return;
  const key=JSON.stringify([source.width,source.height,box.width,box.height,source.frame]);if(entry.geometry===key)return;
  const g=framing().layout(source.width,source.height,box.width,box.height,source.frame);entry.geometry=key;
  for(const node of [...entry.images,...entry.videos])
    for(const [key,value]of Object.entries({
      position:'absolute',
      maxWidth:'none',
      maxHeight:'none',
      width:g.width/box.width*100+'%',
      height:g.height/box.height*100+'%',
      left:g.left/box.width*100+'%',
      top:g.top/box.height*100+'%'
    }))
      if(node.style[key]!==value)node.style[key]=value;
 }
 function syncMotion(state){
  if(state.dead||!state.media.size)return;
  const attr=state.container.getAttribute('data-motion-style');if(attr!==state.motionAttribute){state.motionAttribute=attr;state.motionStyle=modes.has(attr)?attr:'off';}
  const moving=state.motionStyle==='gentle'&&!state.reduced?.matches&&!state.container.hasAttribute('data-art-rest')&&!hidden(state);
  const active=new Set(),selected=new Map(),entries=[...state.media].sort((a,b)=>(a.kind==='banner'?0:1)-(b.kind==='banner'?0:1));
  for(const entry of entries){
    const visible=(!entry.source.animated||entry.intersecting)&&!hidden(state,entry);
    if(!moving||!visible)entry.failed=false;
    let live=entry.source.animated&&moving&&visible&&!entry.failed;
    if(entry.video&&live){if(active.has(entry.source.live))live=false;else active.add(entry.source.live);}
    selected.set(entry,!!live);
  }
  for(const entry of entries)
    if(entry.video&&!selected.get(entry)){
      for(const video of entry.videos){
        if(entry.moving===true)video.pause?.();
        video.autoplay=false;
        hide(video,true);
        if(video.hasAttribute('src')){dropAttr(video,'src');video.preload='none';video.load?.();}
      }
      entry.moving=false;
    }
  for(const entry of entries){
   const live=selected.get(entry);
   if(entry.video){
    for(const img of entry.images){setAttr(img,'src',entry.source.still);hide(img,live);}
    const changed=entry.moving!==live;
    entry.moving=live;
    if(changed)
      for(const video of entry.videos){
        hide(video,!live);
        video.autoplay=live;
        if(live){
          setAttr(video,'src',entry.source.live);
          video.preload='metadata';
          entry.seek?.();
          const started=video.play?.();
          started?.catch?.(()=>{if(state.dead||!state.media.has(entry)||!entry.moving)return;entry.failed=true;syncMotion(state);});
        }
      }
   }
   else{
     const url=live?entry.source.live:entry.source.still;
     setAttr(entry.img,'src',url);
     if(entry.source.fit==='tile'){const image='url("'+url+'")';if(entry.node.style.backgroundImage!==image)entry.node.style.backgroundImage=image;}
   }
   entry.moving=live;
  }
 }
 function pauseEntry(entry){if(entry.video&&entry.moving){for(const video of entry.videos)video.pause?.();entry.moving=false;}}
 function disposeMedia(state,entry){
  state.media.delete(entry);
  state.entries.delete(entry.node);
  state.intersection?.unobserve?.(entry.node);
  state.resize?.unobserve?.(entry.node);
  for(const dispose of entry.disposers)dispose();
  entry.disposers.length=0;
  pauseEntry(entry);for(const video of entry.videos){video.autoplay=false;dropAttr(video,'src');video.load?.();}
  for(const img of entry.images)dropAttr(img,'src');entry.node.remove();
  if(entry.anchor)restore(entry.anchor,entry.marker,entry.previous,state.id);
 }
 function reconcile(state,map,targets,make){
  const present=new Set(targets);for(const [el,entry]of map)if(!present.has(el)){disposeMedia(state,entry);map.delete(el);}
  targets.forEach((el,index)=>{
    let entry=map.get(el);
    if(!entry){entry=make(el,index);entry.anchor=el;entry.previous=el.getAttribute(entry.marker);map.set(el,entry);}
    setAttr(el,entry.marker,state.id);
   if(entry.marker===motifMarker&&el.tagName?.toLowerCase()==='svg'){
     if(entry.node.parentNode!==el.parentNode||entry.node.nextSibling!==el)el.parentNode.insertBefore(entry.node,el);
   }
   else if(entry.node.parentNode!==el){pauseEntry(entry);el.append(entry.node);}
  });
 }
 function syncDOM(state){
  const {root,container:rd}=state;
  if(state.style.parentNode!==root)root.append(state.style);setAttr(rd,marker,state.id);
  if(state.background&&state.background.node.parentNode!==rd){pauseEntry(state.background);rd.insertBefore(state.background.node,rd.firstChild);}
  if(state.background)hide(state.background.node,!!rd.querySelector('.ch-frame-background'));
  if(state.bannerSource)
    reconcile(state,state.banners,[...rd.querySelectorAll('.rd-heading-art, .rd-banner-art')].filter(el=>!el.classList.contains('ch-custom-banner')&&!el.querySelector('.ch-custom-banner')),()=>{
      const entry=mediaNode(state,state.bannerSource,'banner');
      entry.marker=bannerMarker;
      return entry;
    });
  if(state.iconSources.length){
   const topbar=rd.getAttribute('data-course-navigation')==='topbar',navigation=el=>!!el.closest('.rd-dock')||topbar&&!!el.closest('.rd-course-rail');
   const arts=[...rd.querySelectorAll('.rd-rail-art')].filter(el=>!navigation(el)&&![...el.querySelectorAll('img,video,picture')].some(img=>!img.classList.contains('rd-data-theme-icon')));
   const smalls=[...rd.querySelectorAll('svg.rd-mini')].filter(el=>!el.closest('.rd-rail-art')&&!navigation(el));
   function motif(el,index,mini){
    const source=state.iconSources[(mini?(el.closest('.rd-empty-art')?2:index+3):index)%state.iconSources.length],entry=mediaNode(state,source,'icon');entry.marker=motifMarker;
    if(mini){
      entry.node.className+=' rd-data-theme-mini';
      const box=el.getBoundingClientRect?.();
      for(const key of ['width','height']){const n=box?.[key];entry.node.style[key]=typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=10000?n+'px':'1em';}
    }
    return entry;
   }
   reconcile(state,state.icons,arts,(el,index)=>motif(el,index,false));reconcile(state,state.minis,smalls,(el,index)=>motif(el,index,true));
   arts.forEach((el,index)=>{state.icons.get(el).source=state.iconSources[index%state.iconSources.length];});
   smalls.forEach((el,index)=>{state.minis.get(el).source=state.iconSources[(el.closest('.rd-empty-art')?2:index+3)%state.iconSources.length];});
  }
  for(const entry of state.media){layoutEntry(state,entry);if(entry.source.animated&&entry.intersecting===null)entry.intersecting=inViewport(state,entry.node);}
  syncMotion(state);
 }
 function watch(state){
  const framed=!!(state.background?.source.frame||state.bannerSource?.frame);
  if(framed&&typeof state.win.ResizeObserver==='function'){
    state.resize=new state.win.ResizeObserver(entries=>{
      if(state.dead)return;
      for(const item of entries){const entry=state.entries.get(item.target);if(entry)layoutEntry(state,entry,item.contentRect);}
    });
    for(const entry of state.media)if(entry.source.frame)state.resize.observe(entry.node);
    state.disposers.push(()=>state.resize.disconnect());
  }
  else if(framed)listen(state,state.win,'resize',()=>{for(const entry of state.media)layoutEntry(state,entry);});
  if(!state.animated)return;
  const sync=()=>syncMotion(state),win=state.win;state.reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  listen(state,state.doc,'visibilitychange',sync);
  if(state.reduced?.addEventListener)listen(state,state.reduced,'change',sync);
  else if(state.reduced?.addListener){state.reduced.addListener(sync);state.disposers.push(()=>state.reduced.removeListener(sync));}
  if(typeof win.MutationObserver==='function'){
   const observer=new win.MutationObserver(sync),seen=new Set();
   for(const start of [state.container,state.root.host])
     for(let el=start;el&&!seen.has(el);el=el.parentElement||el.getRootNode?.()?.host){
       seen.add(el);
       observer.observe(el,{attributes:true,subtree:el===state.container,attributeFilter:['hidden','aria-hidden','class','style','data-motion-style','data-art-rest']});
     }
   state.disposers.push(()=>observer.disconnect());
  }
  if(typeof win.IntersectionObserver==='function'){
    const observer=state.intersection=new win.IntersectionObserver(entries=>{
      if(state.dead)return;
      for(const item of entries){
        if(item.target===state.container)
          state.intersecting=item.isIntersecting;
        else{const entry=state.entries.get(item.target);if(entry)entry.intersecting=item.isIntersecting;}
      }
      sync();
    });
    observer.observe(state.container);
    for(const entry of state.media)if(entry.source.animated)observer.observe(entry.node);
    state.disposers.push(()=>observer.disconnect());
  }
  else{
    const fallback=()=>{for(const entry of state.media)if(entry.source.animated)entry.intersecting=inViewport(state,entry.node);sync();};
    listen(state,state.doc,'scroll',fallback,true);
    listen(state,win,'resize',fallback);
  }
 }
 function destroy(state){
  if(state.dead)return;state.dead=true;for(const dispose of state.disposers)dispose();state.disposers.length=0;
  for(const entry of [...state.media])disposeMedia(state,entry);state.banners.clear();state.icons.clear();state.minis.clear();
  if(state.font)state.doc.fonts?.delete(state.font);state.style?.remove();
  for(const url of state.urls)state.URL.revokeObjectURL(url);state.urls.clear();state.urlCache.clear();state.bytes.clear();
  if(state.previous!==undefined)restore(state.container,marker,state.previous,state.id);
 }
 function prepare(root,container,data){
  const doc=container.ownerDocument||global.document,win=doc?.defaultView||global;
  if(!doc?.createElement||!root?.append||!container?.querySelectorAll)invalid('dashboard root');
  const state={
    root,
    container,
    doc,
    win,
    data,
    id:'CHDataTheme'+(++sequence),
    Blob:win.Blob||global.Blob,
    URL:win.URL||global.URL,
    urls:new Set(),
    urlCache:new Map(),
    bytes:new Map(),
    byteCount:0,
    media:new Set(),
    entries:new WeakMap(),
    disposers:[],
    banners:new Map(),
    icons:new Map(),
    minis:new Map(),
    frames:{},
    intersecting:true,
    dead:false
  };
  try{
   if(data.assets.size&&(!state.Blob||!state.URL?.createObjectURL||!state.URL?.revokeObjectURL))invalid('local asset APIs unavailable');
   state.style=doc.createElement('style');setAttr(state.style,'data-rd-data-theme-style',state.id);
   if(data.background)state.background=mediaNode(state,sourceFor(state,data.background),'background');
   if(data.banner)state.bannerSource=sourceFor(state,data.banner);
   for(const kind of ['panel','card'])if(data.frames[kind])state.frames[kind]={...data.frames[kind],url:assetURL(state,data.frames[kind].asset,true)};
   state.iconSources=data.icons.map(asset=>sourceFor(state,{asset}));
   if(data.title){
     const font=readAsset(state,data.title.asset),Face=win.FontFace||global.FontFace;
     if(typeof Face==='function'&&doc.fonts?.add)state.font=new Face(state.id,font.bytes.buffer,{weight:String(data.title.weight),display:'swap'});
   }
   state.animated=[...state.media].some(entry=>entry.source.animated)||!!state.bannerSource?.animated||state.iconSources.some(source=>source.animated);
   return state;
  }catch(error){destroy(state);throw error;}
 }
 function remove(container){const state=container&&states.get(container);if(!state)return;states.delete(container);destroy(state);}
 function apply(root,container,pack,options={}){
  if(pack===null||pack===undefined){remove(container);return false;}
  if(!container?.getAttribute)invalid('dashboard container');
  const opts=optionsFor(container,options),data=describe(pack);let state=states.get(container);
  if(state&&state.root===root&&state.data.key===data.key){
   state.motionStyle=opts.motionStyle;state.motionAttribute=container.getAttribute('data-motion-style');const css=stylesheet(state,opts.theme);
   if(state.style.textContent!==css)state.style.textContent=css;syncDOM(state);return true;
  }
  const next=prepare(root,container,data);
  try{if(next.font)next.doc.fonts.add(next.font);next.style.textContent=stylesheet(next,opts.theme);}catch(error){destroy(next);throw error;}
  remove(container);
  state=next;
  state.previous=container.getAttribute(marker);
  state.motionStyle=opts.motionStyle;
  state.motionAttribute=container.getAttribute('data-motion-style');
  states.set(container,state);
  try{watch(state);syncDOM(state);}catch(error){states.delete(container);destroy(state);throw error;}
  return true;
 }
 const api=Object.freeze({apply,remove});global.ReserveDataTheme=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
