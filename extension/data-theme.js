/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/*! Canvas Harness — prevalidated, data-only dashboard themes. Original creator: Flzsh. */
(function(global){
 'use strict';
 const states=new WeakMap(),imageTypes=new Set(['image/svg+xml','image/png','image/webp','image/jpeg','image/gif','image/avif']),videoTypes=new Set(['video/mp4','video/webm']);
 const modes=new Set(['gentle','still','off']),fits=new Set(['cover','contain']),positions=new Set(['center','top','bottom','left','right']);
 const licenses=new Set(['OFL-1.1','Apache-2.0','CC0-1.0']),colorNames=['bg','surface','ink','muted','line','accent'],MAX_BYTES=40000000;
 const marker='data-rd-data-theme',bannerMarker='data-rd-data-banner',motifMarker='data-rd-data-motif';
 let sequence=0;
 // The band kit (band-kit.js) reads everything beyond a plain band picture; the piece renderer (band-pieces.js) draws
 // the pieces. Without them a band is the one picture it always was.
 const K=global.ReserveBandKit||null,Pieces=global.ReserveBandPieces||null;
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
  const d={colors:{},assets:new Map(),background:null,banner:null,band:null,frames:{},title:null,icons:[]};
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
  // The band (theme-pack.js): one picture or video across the top of Home, behind the menu bar, the greeting and the
  // Bookmarks row, painted like the packaged scenes' skies; cropped to the band (cover) at its focus.
  // band.dark is the same kind of picture for dark mode; without it the one band shows in both modes, as the scenes do.
  function bandPicture(value,label){
   if(!object(value))invalid(label);const out={asset:ref(value.asset,new Set([...imageTypes,...videoTypes]))};
   if(value.still!==undefined)out.still=typeof value.still==='number'?number(value.still,0,3600,label+'.still'):ref(value.still,imageTypes);
   if(value.stillAsset!==undefined)out.stillAsset=ref(value.stillAsset,imageTypes);
   if(value.loop!==undefined){
     if(!object(value.loop))invalid(label+'.loop');
     out.loop={start:number(value.loop.start,0,3600,label+'.loop.start'),end:number(value.loop.end,0,3600,label+'.loop.end')};
     if(value.loop.end-value.loop.start<.05||value.loop.end-value.loop.start>60)invalid(label+'.loop');
   }
   return out;
  }
  if(pack.band!==undefined&&K&&object(pack.band)){
   // the kit is tolerant: unknown keys are ignored and a piece it cannot read is left out; only the main picture is strict
   const stills=new Set([...imageTypes].filter(type=>type!=='image/gif'));
   const read=K.clean(pack.band,{picture:(value,path,strict)=>{
     try{return bandPicture(value,String(path).replace(/^\$\./,''));}catch(error){if(strict)throw error;return null;}
   },image:id=>{try{ref(id,stills);return true;}catch{return false;}}});
   d.band={focus:{x:1,y:.5},...read.band,auto:!read.band.focus};
  }else if(pack.band!==undefined){
   const value=pack.band;d.band={...bandPicture(value,'band'),focus:{x:1,y:.5}};
   if(value.focus!==undefined){if(!object(value.focus))invalid('band.focus');d.band.focus={x:number(value.focus.x,0,1,'band.focus.x'),y:number(value.focus.y,0,1,'band.focus.y')};}
   if(value.dark!==undefined)d.band.dark=bandPicture(value.dark,'band.dark');
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
    d.band,
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
 // THE BAND (owner, 2026-11-07: "revamp them, add detail, and fill the band"). A theme's band is painted the way the
 // packaged scenes paint their sky (scene-themes.js measureBand, themes/<id>/theme.css .tk-sky): across the whole top of
 // the dashboard, as tall as the strip above the first module plus 28px, cropped to it (cover) at the theme's focus
 // (default: its right end, so a narrower window crops from the left), faded in over the left quarter and out into the
 // page just under the modules' top edge. The heading is transparent over it and the slot banner gives way: the band is
 // the picture. What sits on it reads on the theme's own paper (surface) and page colour (bg), in both modes.
 function bandSource(state,value){
  const resource=readAsset(state,value.asset),still=value.stillAsset||(typeof value.still==='string'?value.still:null),animated=resource.animated||!!still;
  return {
    type:resource.asset.type,
    animated,
    live:assetURL(state,value.asset),
    still:still?assetURL(state,still,true):assetURL(state,value.asset,animated),
    fit:'cover',
    position:'center',
    width:resource.width,
    height:resource.height,
    ...(value.loop?{loop:value.loop}:{})
  };
 }
 function bandRules(scope,band,mode){
  const sky=scope+' > .rd-data-theme-band',at=n=>Math.round(n*1000)/10+'%',paper=n=>'color-mix(in srgb,var(--rd-surface) '+n+'%,transparent)',halo=n=>'color-mix(in srgb,var(--rd-bg) '+n+'%,transparent)',
   mask='linear-gradient(90deg,rgba(0,0,0,var(--rd-band-left-a,0)) 0,rgba(0,0,0,var(--rd-band-left-b,.5)) 8%,#000 25%,#000 97%,transparent 100%),linear-gradient(180deg,#000 0,#000 calc(100% - 56px),rgba(0,0,0,.4) calc(100% - 26px),transparent 100%)';
  return [
   sky+'{position:absolute;left:0;right:0;top:0;height:calc(var(--rd-pack-band,330px) + 28px);z-index:0;overflow:hidden;pointer-events:none;background:none;-webkit-mask-image:'+mask+';-webkit-mask-composite:source-in;mask-image:'+mask+';mask-composite:intersect;}',
   sky+'[hidden]{display:none!important;}',
   // a picture with clear parts (PNG, WebP, SVG) shows the page colour through them: nothing is painted under it
   sky+' > img,'+sky+' > video{display:block;width:100%;height:100%;object-fit:cover;object-position:'+at(band.focus.x)+' '+at(band.focus.y)+';background:none;}',
   scope+' > .rd-shell{position:relative;z-index:1;}',
   // the band is the picture: Home's banner slot gives way (a banner the student set for a course stays)
   scope+' .rd-heading-art:not(:has(> .ch-custom-banner)){display:none!important;}',
   scope+' .rd-workspace-heading{background:none!important;box-shadow:none!important;}',
   // the menu bar: the theme's paper, nearly solid
   scope+' .rd-toolbar{background:'+paper(90)+';box-shadow:inset 0 0 0 1px '+halo(55)+';}',
   // the greeting, the date and the row labels: a halo of the page colour
   scope+' :is(.rd-workspace-heading,.rd-course-heading) h1{text-shadow:0 1px 0 '+halo(85)+',0 0 20px '+halo(95)+';}',
   scope+' :is(.rd-heading-date,.rd-heading-detail,.rd-bookmarks :is(p,small,h2,span)){text-shadow:0 1px 0 '+halo(85)+',0 0 10px '+halo(90)+';}',
   scope+' .rd-heading-date{color:color-mix(in srgb,var(--rd-ink) 70%,var(--rd-muted));}',
   // New / Overdue / Due today / Tomorrow keep their own tone, on solid paper
   scope+' .rd-glance-chip{background:color-mix(in srgb,var(--tone) 14%,var(--rd-surface));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tone) 30%,transparent);}',
   scope+' .rd-glance-chip[aria-pressed=true]{box-shadow:inset 0 0 0 1.5px var(--tone);}',
   // the Bookmarks / views row, the day pills and the Help band read on paper, never on the picture
   scope+' :is(.rd-filter-group,.rd-week){background:'+paper(90)+'!important;}',
   scope+' :is(.rd-bookmarks,.rd-more-views){background:'+paper(82)+';border-radius:8px;}',
   scope+' .ch-help-band{background:'+paper(94)+';}',
   // Edit Home and Undo move end the row, over the band's lower right corner
   scope+' .rd-arrange-guide > div:not(:empty){padding:0 8px;border-radius:8px;background:'+paper(90)+';box-shadow:inset 0 0 0 1px '+halo(60)+';}',
   // the title block (greeting or course name, date, chips) reads in a soft pool of the page colour, as a scene's course
   // heading does: a shade growing from the left (where the band fades into the page) to just past the words;
   // heading does; in dark mode, over a band painted light (one band for both modes), the pool is deeper so the light
   // words keep their contrast on any picture
   scope+' .rd-course-heading{position:relative;}',
   scope+' .rd-course-heading h1::before{background:none!important;}',
   scope+' .rd-course-heading::before{content:""!important;display:block!important;position:absolute!important;inset:auto auto -22px -48px!important;width:min(620px,calc(100% + 96px))!important;max-width:none!important;height:150px!important;margin:0!important;z-index:-1!important;pointer-events:none!important;mask:none!important;-webkit-mask:none!important;background:radial-gradient(ellipse 100% 50% at 0 50%,'+halo(mode==='dark'?85:72)+','+halo(mode==='dark'?55:40)+' 55%,'+halo(0)+')!important;}',
   ...(mode==='dark'?[scope+' :is(.rd-workspace-heading,.rd-course-heading) h1{text-shadow:0 1px 2px '+halo(90)+',0 0 18px '+halo(95)+',0 0 36px '+halo(80)+';}']:[])
  ].join('');
 }
 // The band reaches just where the desk starts (.rd-main: Home's first module, below the Help band when that is on),
 // as the scenes' sky does: measured on each sync, when the window's size changes and when a box above the desk changes
 // height (the Help band filling, a font arriving). Written on the band alone: a variable on the root would restyle the
 // whole dashboard.
 // ---- The band beyond one picture (band-kit.js): the look for now, its fit, its edge, its words and its pieces.
 // A band that is one picture takes none of this past the first lines: no timer, no frame callback, no image read.
 const pictureKey=value=>JSON.stringify([value.asset,value.still,value.stillAsset,value.loop]);
 const bandEntries=state=>[state.band,state.bandDark,...(state.bandMore?state.bandMore.values():[])].filter(Boolean);
 const bandRich=band=>!!(band.pieces?.length||band.dark?.pieces?.length||band.variants?.length||band.narrow||band.dark?.narrow);
 const details=new Map(),clamp01=n=>Math.max(0,Math.min(1,n)),px=n=>Math.round(n*100)/100+'px';
 const lum=hex=>{const n=parseInt(String(hex).slice(1),16);return Number.isFinite(n)?((n>>16&255)*.2126+(n>>8&255)*.7152+(n&255)*.0722)/255:.5;};
 const rgba=(hex,a)=>{const n=parseInt(String(hex).slice(1),16)||0;return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+Math.round(a*100)/100+')';};
 // the kit lets a colour be a name from the theme's palette (bg, surface, ink, muted, line, accent): the colour in use now
 const named=(state,c)=>typeof c==='string'&&c[0]!=='#'&&/^#[\da-f]{6}$/i.test(state.palette?.[c]||'')?state.palette[c]:c;
 const shaOf=(state,value)=>String(state.data.assets.get(value.stillAsset||(typeof value.still==='string'?value.still:value.asset))?.sha256||'').toLowerCase();
 function styleSet(node,styles){for(const [key,value]of Object.entries(styles))if((node.style[key]||'')!==value)node.style[key]=value;}
 // the student's local clock, read when the band is measured and once a minute (watch), never per frame
 function bandClock(state){
   const now=new (state.win.Date||Date)();
   return {hour:now.getHours()+now.getMinutes()/60,month:now.getMonth()+1,day:now.getDay(),week:K?.week?.(now)??1};
 }
 function bandLook(state){
   const view=state.bandView;
   return K.resolve(state.data.band,{mode:state.mode,...(view?.h>0?{ratio:view.w/view.h}:{}),...(state.bandTimed?bandClock(state):{})});
 }
 function bandEntry(state,look){
  const key=pictureKey(look);for(const entry of bandEntries(state))if(entry.key===key)return entry;
  try{
    const entry=mediaNode(state,bandSource(state,look),'band');
    entry.key=key;
    entry.sha=shaOf(state,look);
    setAttr(entry.node,'data-rd-band','more');
    state.bandMore.set(key,entry);
    if(state.bandPx)entry.node.style.setProperty('--rd-pack-band',state.bandPx+'px');
    return entry;
  }
  catch{return state.band;}
 }
 // What the picture itself shows (where its detail is, the colours down its sides), read once from its still and only
 // for a band that needs it: a keep box, a picture too tall for the band, or text "auto".
 function bandDetail(state,entry){
  const sha=entry.sha;if(!sha)return null;if(details.has(sha))return details.get(sha);
  const Img=state.win.Image;if(typeof Img!=='function'||entry.detailing)return null;entry.detailing=true;
  try{
   const img=new Img();
   img.onload=()=>{
    if(state.dead)return;
    try{
     const nw=img.naturalWidth,nh=img.naturalHeight;if(!(nw>0&&nh>0))return;
     const w=96,h=Math.max(8,Math.min(96,Math.round(96*nh/nw))),canvas=state.doc.createElement('canvas');canvas.width=w;canvas.height=h;
     const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,w,h);const data=g.getImageData(0,0,w,h).data,seen={...K.detail(data,w,h),size:{w:nw,h:nh}};
     // each side in four steps, so a fade follows a sky that is light above and dark below; a clear side stays clear
     const mean=(x0,x1,y0,y1)=>{
       let r=0,gr=0,b=0,a=0,n=0;
       for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*4;r+=data[i];gr+=data[i+1];b+=data[i+2];a+=data[i+3];n++;}
       return !n||a/n<128?'transparent':'#'+[r,gr,b].map(v=>Math.round(v/n).toString(16).padStart(2,'0')).join('');
     };
     const edge=Math.max(1,Math.round(w*.04)),strip=Math.max(1,Math.round(h*.08)),steps=[0,1,2,3],cut=(n,i)=>Math.floor(i*n/4);
     seen.sides={
       left:steps.map(i=>mean(0,edge,cut(h,i),cut(h,i+1))),
       right:steps.map(i=>mean(w-edge,w,cut(h,i),cut(h,i+1))),
       top:steps.map(i=>mean(cut(w,i),cut(w,i+1),0,strip)),
       bottom:steps.map(i=>mean(cut(w,i),cut(w,i+1),h-strip,h))
     };
     if(details.size>24)details.clear();details.set(sha,seen);bandUpdate(state);
    }catch{}
   };
   img.src=entry.source.still;
  }catch{}
  return null;
 }
 // a still picture a piece draws: loaded from the pack's own bytes when a piece first draws it, and kept while one does
 function bandImage(state,id){
  if(state.bandImages.has(id))return state.bandImages.get(id);
  state.bandImages.set(id,null);const Img=state.win.Image;if(typeof Img!=='function')return null;
  try{
    const img=new Img();
    img.onload=()=>{
      if(state.dead||state.bandImages.get(id)!==null)return;
      const px=(img.naturalWidth||0)*(img.naturalHeight||0);
      if(px>12000000||(state.bandImagePixels||0)+px>48000000)return;
      state.bandImagePixels=(state.bandImagePixels||0)+px;
      state.bandImages.set(id,img);
      state.bandImageCount=(state.bandImageCount||0)+1;
      bandUpdate(state);
    };
    img.src=assetURL(state,id,true);
  }catch{}
  return null;
 }
 // Pictures no piece shows now (another hour's, weekday's or month's) are let go, so the 48 million pixels are what shows
 // now, and a picture held back for room is asked for again the next time it is shown.
 function bandRelease(state,pieces){
  const used=new Set();for(const piece of pieces||[])for(const d of piece.draw||[])if(d.kind==='image')used.add(d.asset);
  for(const [id,img]of [...state.bandImages])
    if(!used.has(id)){state.bandImages.delete(id);if(img)state.bandImagePixels=Math.max(0,(state.bandImagePixels||0)-(img.naturalWidth||0)*(img.naturalHeight||0));}
 }
 // What fills the band beside a picture that does not cover it: by default the picture's own side colours, which the
 // picture melts into; "mirror" and "repeat" lay copies of the still beside it.
 function bandEdge(state,entry,fill){
  const node=entry.node,background=fill?.background||'';if((node.style.background||'')!==background)node.style.background=background;
  const copies=fill?.copies||[],have=entry.copies||(entry.copies=[]);
  while(have.length>copies.length)have.pop().remove();
  copies.forEach((c,i)=>{
    let img=have[i];
    if(!img){img=state.doc.createElement('img');img.alt='';img.draggable=false;setAttr(img,'aria-hidden','true');img.className='rd-data-theme-edge';have.push(img);node.insertBefore(img,node.firstChild);}
    setAttr(img,'src',entry.source.still);
    styleSet(img,{position:'absolute',left:px(c.x),top:px(c.y),width:px(c.w),height:px(c.h),maxWidth:'none',maxHeight:'none',objectFit:'fill',transform:c.flip?'scaleX(-1)':''});
  });
 }
 const fitKeys=['position','left','top','width','height','maxWidth','maxHeight','objectFit','maskImage','webkitMaskImage','maskComposite','webkitMaskComposite'];
 /* Where the picture sits in the band. Band-shaped art with no keep box is cropped by CSS as it always was (cover, at
    the focus). With a keep box (the pack's, or one found round the picture's detail when the art is too tall for a
    band) the picture is scaled so the box stays in view, and whatever it leaves open is filled by the edge. */
 function bandFit(state,entry,look,view){
  const band=state.data.band,source=entry.source,auto=!!band.auto&&!look.keep&&look.focus===band.focus,nodes=[...entry.images,...entry.videos];
  let art=source.width>0&&source.height>0?{w:source.width,h:source.height}:null;
  const seen=look.keep||look.text==='auto'||(auto&&(!art||K.autoKeep(art)))?bandDetail(state,entry):null;
  if(!art&&seen?.size)art=seen.size;
  const keep=art?look.keep||(auto?K.autoKeep(art,seen):null):null;
  if(!art||!keep){
   const at=n=>Math.round(n*1000)/10+'%',position=look.focus===band.focus?'':at(look.focus.x)+' '+at(look.focus.y);
   if(entry.fitted){for(const node of nodes)for(const key of fitKeys)if(node.style[key])node.style[key]='';entry.fitted=false;bandEdge(state,entry,null);}
   for(const node of nodes)if((node.style.objectPosition||'')!==position)node.style.objectPosition=position;
   const f=art?K.fit(art,view,{focus:look.focus}):{x:0,y:0,w:view.w,h:view.h};return {art:{x:f.x,y:f.y,w:f.w,h:f.h},seen};
  }
  const f=K.fit(art,view,{focus:look.keep?look.focus:{x:1,y:seen?.y??.5},keep}),g=f.gap,mode=look.edge?.mode||'fade',fade=mode==='fade';
  const soft=(gap,size,cap)=>gap>.5?Math.round(Math.min(size*.3,cap,Math.max(gap,40))):0,
    L=fade?soft(g.left,f.w,260):0,
    R=fade?soft(g.right,f.w,260):0,
    T=soft(g.top,f.h,90),
    B=soft(g.bottom,f.h,90);
  const ramp=(dir,a,b)=>'linear-gradient('+dir+','+(a?'transparent 0,#000 '+a+'px':'#000 0')+','+(b?'#000 calc(100% - '+b+'px),transparent 100%':'#000 100%')+')';
  const masks=[...(L||R?[ramp('90deg',L,R)]:[]),...(T||B?[ramp('180deg',T,B)]:[])],mask=masks.join(',');
  for(const node of nodes)
    styleSet(node,{
      position:'absolute',
      left:px(f.x),
      top:px(f.y),
      width:px(f.w),
      height:px(f.h),
      maxWidth:'none',
      maxHeight:'none',
      objectFit:'fill',
      objectPosition:'',
      maskImage:mask,
      webkitMaskImage:mask,
      maskComposite:masks.length>1?'intersect':'',
      webkitMaskComposite:masks.length>1?'source-in':''
    });
  entry.fitted=true;
  const flat=named(state,look.edge?.color),sides=seen?.sides,tones=side=>flat?[flat,flat]:sides?sides[side]:['transparent','transparent'],layers=[],copies=[];
  if(g.top>.5)layers.push('linear-gradient(90deg,'+tones('top').join(',')+') left top/100% '+px(g.top+T)+' no-repeat');
  if(g.bottom>.5)layers.push('linear-gradient(90deg,'+tones('bottom').join(',')+') left bottom/100% '+px(g.bottom+B)+' no-repeat');
  if(fade){
   if(g.left>.5)layers.push('linear-gradient(180deg,'+tones('left').join(',')+') left top/'+px(g.left+L)+' 100% no-repeat');
   if(g.right>.5)layers.push('linear-gradient(180deg,'+tones('right').join(',')+') right top/'+px(g.right+R)+' 100% no-repeat');
  }else{
   for(let k=1;k<=3&&f.x-f.w*(k-1)>.5;k++)copies.push({x:f.x-f.w*k,y:f.y,w:f.w,h:f.h,flip:mode==='mirror'&&k%2===1});
   for(let k=1;k<=3&&f.x+f.w*k<view.w-.5;k++)copies.push({x:f.x+f.w*k,y:f.y,w:f.w,h:f.h,flip:mode==='mirror'&&k%2===1});
 }
  bandEdge(state,entry,{background:layers.join(','),copies});
  return {art:{x:f.x,y:f.y,w:f.w,h:f.h},seen};
 }
 // the greeting's box in the band: pieces thin out under it, and text "auto" reads the picture there
 function bandQuiet(state){
  const rd=state.container,base=rd.getBoundingClientRect?.();if(!base)return null;let box=null;
  for(const el of [rd.querySelector('.rd-workspace-heading h1'),rd.querySelector('.rd-workspace-heading .rd-heading-date')]){
   if(!el)continue;let r=null;try{const range=state.doc.createRange?.();if(range){range.selectNodeContents(el);r=range.getBoundingClientRect?.();}}catch{r=null;}
   if(!r||!(r.width>0&&r.height>0))r=el.getBoundingClientRect?.();if(!r||!(r.width>0&&r.height>0))continue;
   box=box?{l:Math.min(box.l,r.left),t:Math.min(box.t,r.top),r:Math.max(box.r,r.right),b:Math.max(box.b,r.bottom)}:{l:r.left,t:r.top,r:r.right,b:r.bottom};
  }
  return box?{x:Math.round(box.l-base.left),y:Math.round(box.t-base.top),w:Math.round(Math.min(box.r-box.l,620)),h:Math.round(box.b-box.t)}:null;
 }
 const wordsKey=(state,look)=>JSON.stringify([look.text,look.text==='auto'?state.bandTone||0:0,look.shade,look.fade]);
 // The words on the band: "text" turns the greeting light or dark when the theme's own ink is the other tone, "shade"
 // is the pool behind it, "fade" a colour the band takes on at its foot. None given: the rules above stand as they are.
 function bandWords(scope,state,look){
  const out=[],want=look.text==='auto'?state.bandTone:look.text,tone=want&&(want==='light')!==(lum(state.palette.ink)>.55)?want:null;let shade=look.shade||null;
  if(tone){
   const ink=tone==='light'?'#FBF8F1':'#1F1D1A',back=tone==='light'?'#15130F':'#FFFDF8';
   out.push(scope+' :is(.rd-workspace-heading,.rd-course-heading) :is(h1,.rd-heading-date,.rd-heading-detail){color:'+ink+'!important;text-shadow:0 1px 2px '+rgba(back,.8)+',0 0 18px '+rgba(back,.85)+'!important;}');
   if(!shade)shade={color:back,strength:.6};
  }
  if(shade){
    const color=named(state,shade.color);
    out.push(scope+' .rd-course-heading::before{background:radial-gradient(ellipse 100% 50% at 0 50%,'+rgba(color,shade.strength)+','+rgba(color,shade.strength*.6)+' 55%,'+rgba(color,0)+')!important;}');
  }
  // The page column scrolls, so it cuts whatever reaches past its left edge and its top. The pool of the rules above
  // reaches past both: unseen while it is the page's own colour beside a band that fades into the page, a hard line
  // once the pool has a colour of its own or the band keeps its left end. Then it starts inside the column and
  // feathers in from the left; top and bottom it already runs out to nothing.
  if(shade||(look.fade?.left!==undefined&&look.fade.left<1))out.push(scope+' .rd-course-heading::before{inset:0 auto -22px 0!important;width:min(572px,100%)!important;height:auto!important;-webkit-mask:linear-gradient(90deg,transparent,#000 36px)!important;mask:linear-gradient(90deg,transparent,#000 36px)!important;}');
  if(look.fade?.color){
    const color=named(state,look.fade.color);
    out.push(scope+' > .rd-data-theme-band::after{content:"";position:absolute;left:0;right:0;bottom:0;height:46%;pointer-events:none;background:linear-gradient(180deg,'+rgba(color,0)+','+rgba(color,.92)+' 82%);}');
  }
  return out.join('');
 }
 // one canvas of pieces on the picture that shows; fed again only when something it draws from has changed
 function bandPieces(state){
  const shown=state.bandShown,look=state.bandNow,view=state.bandView;if(!K||!Pieces||!shown||!look||!view||!state.bandArt)return;
  if(!look.pieces?.length){if(state.pieces){state.pieces.destroy();state.pieces=null;state.piecesKey='';}bandRelease(state,[]);return;}
  if(state.pieces&&state.piecesHost!==shown){state.pieces.destroy();state.pieces=null;}
  if(!state.pieces){
    state.pieces=Pieces.mount(shown.node);
    state.piecesHost=shown;
    state.piecesKey='';
    if(!shown.source.animated)state.intersection?.observe(shown.node);
  }
  const moving=!!state.moving&&shown.intersecting!==false,graphics=state.container.getAttribute('data-graphics')||'high';
  const key=JSON.stringify([state.bandLookKey,state.bandArt,view,graphics,moving,state.bandQuiet,state.palette,state.bandImageCount||0]);
  if(key===state.piecesKey)return;state.piecesKey=key;bandRelease(state,look.pieces);
  state.pieces.set({
    pieces:look.pieces,
    art:state.bandArt,
    view,
    graphics,
    moving,
    quiet:state.bandQuiet?[state.bandQuiet]:[],
    colors:state.palette,
    image:id=>bandImage(state,id),
    box:look.box
  });
 }
 function bandUpdate(state){
  if(!K||!state.band||state.dead)return;
  const rd=state.container,look=state.bandNow=bandLook(state),shown=state.bandShown=bandEntry(state,look),view=state.bandView;let swapped=false;
  if(shown.node.parentNode!==rd){pauseEntry(shown);rd.insertBefore(shown.node,rd.firstChild);swapped=true;}
  for(const entry of bandEntries(state)){const off=entry!==shown;if(entry.node.hidden!==off){entry.node.hidden=off;swapped=true;}}
  // fade.left: how much of the fade into the page at the band's left end stays (1 = the usual fade, 0 = none)
  {
    const left=look.fade?.left,a=left===undefined?'':String(Math.round((1-left)*1000)/1000),b=left===undefined?'':String(Math.round((1-left*.5)*1000)/1000),st=shown.node.style;
    if((shown.leftFade||'')!==a){shown.leftFade=a;st.setProperty('--rd-band-left-a',a);st.setProperty('--rd-band-left-b',b);}
  }
  if(view){
   const placed=bandFit(state,shown,look,view);
   state.bandArt=placed.art;
   state.bandQuiet=look.pieces?.length||look.text==='auto'?bandQuiet(state):null;
   state.bandLookKey=look.pieces?.length?JSON.stringify(look.pieces):'';
   if(look.text==='auto'&&placed.seen?.grid){
    const a=placed.art,
      q=state.bandQuiet||{x:view.w*.015,y:view.h*.35,w:Math.min(340,view.w*.8),h:40},
      l=K.shadeOf(placed.seen.grid,clamp01((q.x-a.x)/a.w),clamp01((q.y-a.y)/a.h),clamp01((q.x+q.w-a.x)/a.w),clamp01((q.y+q.h-a.y)/a.h))??lum(placed.seen.left);
    // the band fades into the page over its left quarter: what is behind the words is part picture, part page
    const mid=(q.x+q.w/2)/view.w,fall=mid<.08?mid/.08*.5:mid<.25?.5+(mid-.08)/.17*.5:1,alpha=1-(1-fall)*(look.fade?.left??1);state.bandTone=lum(state.palette.bg)*(1-alpha)+l*alpha<.5?'light':'dark';
   }
  }
  if(state.theme&&state.bandWordsKey!==wordsKey(state,look)){const css=stylesheet(state,state.theme);if(state.style.textContent!==css)state.style.textContent=css;}
  if(state.syncing)return;
  if(swapped)syncMotion(state);else bandPieces(state);
 }
 function measureBand(state){
  const band=state.band;if(!band||state.dead)return;const rd=state.container;let px=0,wide=0;
  try{
    const box=rd.getBoundingClientRect?.(),top=box?.top;
    wide=box?.width||0;
    if(Number.isFinite(top)){
      let first=Infinity;
      for(const el of rd.querySelectorAll('.rd-main')){
        const r=el.getBoundingClientRect?.();
        if(!r||!(r.width>200))continue;
        let y=r.top-top;
        for(let p=el.parentElement;p&&p!==rd;p=p.parentElement)y+=p.scrollTop||0;
        if(y>80)first=Math.min(first,y);
      }
      if(Number.isFinite(first))px=Math.round(Math.max(200,Math.min(560,first)));
    }
  }catch{px=0;}
  if(px!==state.bandPx){state.bandPx=px;for(const {node} of bandEntries(state)){if(px)node.style.setProperty('--rd-pack-band',px+'px');else node.style.removeProperty('--rd-pack-band');}}
  if(!K)return;
  state.bandView=wide>0?{w:Math.round(wide),h:(px||330)+28}:null;
  // a fault in the band's extras must never cost the student the theme: the picture then shows as it always did
  try{bandUpdate(state);}catch{if(state.bandDark){const dark=state.mode==='dark';hide(state.band.node,dark);hide(state.bandDark.node,!dark);}}
 }
 function watchBand(state){
  const observer=state.bandResize;if(!observer)return;const rd=state.container,next=new Set(),own=new Set(bandEntries(state).map(entry=>entry.node));
  for(let el=rd.querySelector('.rd-main');el&&el!==rd;el=el.parentElement)
    for(let sib=el.previousElementSibling;sib;sib=sib.previousElementSibling)if(!own.has(sib)&&sib!==state.background?.node)next.add(sib);
  for(const el of [...state.bandWatched])if(!next.has(el)){observer.unobserve(el);state.bandWatched.delete(el);}
  for(const el of next)if(!state.bandWatched.has(el)){observer.observe(el);state.bandWatched.add(el);}
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
  rules.push(scope+
    '{'+
    Object.entries(vars).map(([key,value])=>'--rd-'+key+':'+value+'!important;').join('')+
    'color-scheme:'+
    mode+
    ';'+
    (state.background||state.band?'position:relative;isolation:isolate;':'')+
    '}');
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
  state.mode=mode;state.theme=theme;state.palette=p;
  if(state.band){
    rules.push(bandRules(scope,d.band,mode));
    if(K){const look=bandLook(state),words=bandWords(scope,state,look);state.bandWordsKey=wordsKey(state,look);if(words)rules.push(words);}
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
  if(state.bannerSource&&d.banner?.height){
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
  if(state.background||state.bannerSource||state.band)
    rules.push(scope+' .rd-data-theme-background > [hidden],'+scope+' .rd-data-theme-tile > [hidden],'+scope+' .rd-data-theme-banner > [hidden]'+(state.band?','+scope+' .rd-data-theme-band > [hidden]':'')+'{display:none!important;}');
  // The panel frame is for the modules and their tab panels; the workspace (also a tab panel) is the page itself.
  if(state.frames.panel){
    rules.push(frameRule(scope,'.rd-widget,.rd-course-information,.rd-work-column,.rd-information,[role="tabpanel"]:not(.rd-workspace)',state.frames.panel));
    rules.push(scope+' .rd-information:not(.ch-custom-frame) > .rd-reader,'+scope+' .rd-information:not(.ch-custom-frame) > .rd-assignment-empty{border:0!important;box-shadow:none!important;}');
  }
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
  if(kind==='background'||kind==='band')setAttr(node,'data-rd-keep','');
  const on=(target,event,fn)=>{target.addEventListener(event,fn);entry.disposers.push(()=>target.removeEventListener(event,fn));};
  for(let i=0;i<count;i++){
  const cell=count===1?node:doc.createElement('div');if(count>1){cell.className='rd-data-theme-tile';node.append(cell);}
  if(isVideo){
    const video=doc.createElement('video');
    video.muted=true;
    video.defaultMuted=true;
    video.volume=0;
    video.loop=!(source.loop||source.frame?.loop);
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
     const loop=source.loop||source.frame?.loop;
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
  state.moving=moving;
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
  if(state.pieces||state.bandNow?.pieces?.length){try{bandPieces(state);}catch{}}
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
  if(state.band){
   if(state.band.node.parentNode!==rd){pauseEntry(state.band);rd.insertBefore(state.band.node,rd.firstChild);}
   if(state.bandDark){
     if(state.bandDark.node.parentNode!==rd){pauseEntry(state.bandDark);rd.insertBefore(state.bandDark.node,rd.firstChild);}
     if(!K){const dark=state.mode==='dark';hide(state.band.node,dark);hide(state.bandDark.node,!dark);}
   }
   state.syncing=true;try{measureBand(state);}finally{state.syncing=false;}watchBand(state);
  }
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
  if(state.band){
   listen(state,state.win,'resize',()=>measureBand(state),{passive:true});
   if(typeof state.win.ResizeObserver==='function'){
     state.bandResize=new state.win.ResizeObserver(()=>{if(!state.dead)measureBand(state);});
     state.disposers.push(()=>{state.bandResize.disconnect();state.bandWatched.clear();});
   }
   // a band that follows the time of day looks at the clock once a minute; no other band has a timer
   const every=state.win.setInterval||global.setInterval,stop=state.win.clearInterval||global.clearInterval;
   if(K&&state.bandTimed&&typeof every==='function'){const id=every(()=>{if(!state.dead)try{bandUpdate(state);}catch{}},60000);state.disposers.push(()=>stop?.(id));}
  }
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
       observer.observe(el,{
         attributes:true,
         subtree:el===state.container,
         attributeFilter:['hidden','aria-hidden','class','style','data-motion-style','data-art-rest',...(state.bandPieces?['data-graphics']:[])]
       });
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
  if(state.pieces){try{state.pieces.destroy();}catch{}state.pieces=null;}state.bandMore?.clear();state.bandImages?.clear();
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
    bandPx:0,
    bandWatched:new Set(),
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
   if(data.band){
    state.band=mediaNode(state,bandSource(state,data.band),'band');state.band.key=pictureKey(data.band);state.band.sha=shaOf(state,data.band);
    if(data.band.dark?.asset){
      state.bandDark=mediaNode(state,bandSource(state,data.band.dark),'band');
      setAttr(state.bandDark.node,'data-rd-band','dark');
      state.bandDark.key=pictureKey(data.band.dark);
      state.bandDark.sha=shaOf(state,data.band.dark);
    }
    state.bandMore=new Map();state.bandImages=new Map();state.bandTimed=!!K?.timed(data.band);state.bandPieces=!!(K&&Pieces&&(bandRich(data.band)||state.bandTimed));
   }
   else if(data.banner)state.bannerSource=sourceFor(state,data.banner);
   for(const kind of ['panel','card'])if(data.frames[kind])state.frames[kind]={...data.frames[kind],url:assetURL(state,data.frames[kind].asset,true)};
   state.iconSources=data.icons.map(asset=>sourceFor(state,{asset}));
   if(data.title){
     const font=readAsset(state,data.title.asset),Face=win.FontFace||global.FontFace;
     if(typeof Face==='function'&&doc.fonts?.add)state.font=new Face(state.id,font.bytes.buffer,{weight:String(data.title.weight),display:'swap'});
   }
   state.animated=[...state.media].some(entry=>entry.source.animated)||!!state.bannerSource?.animated||state.iconSources.some(source=>source.animated)||
     !!state.bandPieces;
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
