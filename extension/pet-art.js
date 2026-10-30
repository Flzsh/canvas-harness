/* Canvas Harness companion: the drawing. A small pony in a red harness, drawn as one rigged SVG whose pose is chosen
   by data-pose on its wrapper and moved by the stylesheet (pet.css). No Canvas data is read here. Creator: Flzsh. */
(function(root){
 'use strict';
 // Coats are plain paint: body, shade under the belly, mane and tail, muzzle.
 const COATS={
  oat:{label:'Oat',coat:'#F1DEC0',shade:'#DDC49C',mane:'#C96442',muzzle:'#F6C9B4'},
  chestnut:{label:'Chestnut',coat:'#C98B5E',shade:'#A86E46',mane:'#5A3A28',muzzle:'#E8B796'},
  dapple:{label:'Dapple grey',coat:'#D9DEE2',shade:'#B8C1C9',mane:'#6F7F8C',muzzle:'#EFD5CF'},
  ink:{label:'Ink',coat:'#4A4744',shade:'#33312F',mane:'#1F1E1D',muzzle:'#8A7E77'},
  sage:{label:'Sage',coat:'#C9D4B4',shade:'#A9B890',mane:'#5E7F45',muzzle:'#F0D6C8'},
  rose:{label:'Rose',coat:'#F3D3D0',shade:'#E0B3B0',mane:'#A84A5C',muzzle:'#F8E3DC'}
 };
 const HARNESS={red:'#E2463B',clay:'#D97757',gold:'#E2B865',forest:'#5E7F45',ocean:'#3F8FCC',iris:'#8E63B8'};
 const POSES=['stand','walk','trot','lie','sleep','read','eat','cheer','flag','fall','held'];
 const INK='var(--pet-ink,#141413)';
 const ink=(d,w=2.1,extra='')=>`<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
 const fill=(d,paint,w=2.1,extra='')=>`<path d="${d}" fill="${paint}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
 const leg=(cls,x,top,foot,bend)=>`<g class="pet-leg ${cls}" style="transform-origin:${x}px ${top}px"><path d="M${x} ${top}C${x+bend} ${top+6} ${foot-bend*.4} ${top+11} ${foot} 57.4" fill="none" stroke="${INK}" stroke-width="4.8" stroke-linecap="round"/><path d="M${x} ${top}C${x+bend} ${top+6} ${foot-bend*.4} ${top+11} ${foot} 57.4" fill="none" stroke="var(--pet-coat)" stroke-width="2.3" stroke-linecap="round"/><path d="M${foot-1.9} 58.6h4.2" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/></g>`;
 function svg({title='Your companion'}={}){
  // 72 x 64 box; the ground is y = 60; the pony faces right. Mirroring is done by the wrapper, never here.
  return `<svg class="pet-svg" viewBox="0 0 72 64" role="img" aria-label="${String(title).replace(/[<>&"]/g,'')}" focusable="false">
<path class="pet-shadow" d="M14 60.6C24 62.6 44 62.6 54 60.4C44 59.2 24 59.2 14 60.6z" fill="${INK}" opacity=".13"/>
<g class="pet-all">
 <g class="pet-up">
  <g class="pet-legs">${leg('lf2',38.6,43,38.2,.8)}${leg('lh2',26.4,43,26.8,-.8)}</g>
  <g class="pet-tuck2"><path d="M40 43.1C44 45.1 48 45.7 52 45.5" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M40 43.1C44 45.1 48 45.7 52 45.5" fill="none" stroke="var(--pet-coat)" stroke-width="2.2" stroke-linecap="round"/></g>
  <g class="pet-tail" style="transform-origin:17px 33px">${fill('M18 31.6C10.4 32.6 7.2 40.6 9.4 50.4C11.6 46.4 14.2 42.6 19.6 38.8z','var(--pet-mane)',2.2)}${ink('M12.4 38.6C11.6 41.4 11.4 44 11.8 46.4',1.1,' opacity=".55"')}</g>
  <g class="pet-body">
   ${fill('M20 30.2C27.6 27 38 27 45 29C49.4 31 50.4 37 47.2 41.2C43 46.4 30 47.2 23 45.2C15.8 43 14 35 20 30.2z','var(--pet-coat)')}
   <path d="M22.6 43.6C29 46 40 45.6 45.6 41.6C42 46 30.4 46.8 23.4 44.9z" fill="var(--pet-shade)"/>
   <path class="pet-blanket" d="M26.6 29.2C30.6 28.2 35 28.2 38.6 29L37.4 36.4C33.6 37.4 30.6 37.2 27.8 36.2z" fill="var(--pet-harness)" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
   <path class="pet-blanket" d="M29.4 31.4h6.4M29.8 33.8h5.4" fill="none" stroke="#FFFFFF" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>
  </g>
  <g class="pet-legs">${leg('lf',43,42.6,43.4,.9)}${leg('lh',21.6,42.6,21,-.9)}</g>
  <g class="pet-tuck"><path d="M43.6 43.1C47 45.5 51.4 46.5 56 46.3" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/><path d="M43.6 43.1C47 45.5 51.4 46.5 56 46.3" fill="none" stroke="var(--pet-coat)" stroke-width="2.3" stroke-linecap="round"/><path d="M21 42.9C17.6 44.9 17.2 46.5 21.4 46.9" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/><path d="M21 42.9C17.6 44.9 17.2 46.5 21.4 46.9" fill="none" stroke="var(--pet-coat)" stroke-width="2.3" stroke-linecap="round"/></g>
  <g class="pet-neck" style="transform-origin:45px 33px">
   ${fill('M40.6 31.4C42.4 24.4 46.6 18.6 51 14.6L58 20.4C53.6 24.6 50.6 30.4 48.6 37.6C46 37.4 42.6 35 40.6 31.4z','var(--pet-coat)')}
   <path class="pet-collar" d="M41.6 29.4C44.6 31.4 47.4 34 49.2 36.8" fill="none" stroke="${INK}" stroke-width="6.6" stroke-linecap="round"/><path class="pet-collar" d="M41.6 29.4C44.6 31.4 47.4 34 49.2 36.8" fill="none" stroke="var(--pet-harness)" stroke-width="3.6" stroke-linecap="round"/>
   <circle class="pet-collar" cx="45.6" cy="33" r="1.5" fill="#E2B865" stroke="${INK}" stroke-width=".9"/>
   <g class="pet-head" style="transform-origin:53px 16px">
    ${fill('M50.4 10.6L51.2 3.8L55.4 8.8z','var(--pet-coat)',2)}
    ${fill('M49 12.2C52.6 7.8 61 9.4 63.4 14.4C65.4 18.8 62.2 23.4 57 23.2C51.8 23 46.6 18 49 12.2z','var(--pet-coat)')}
    <path d="M58.6 16.6C61.6 15.2 64.4 16.6 64 19.4C63.4 22 60.4 23.4 57.6 23z" fill="var(--pet-muzzle)"/>
    ${ink('M49 12.2C52.6 7.8 61 9.4 63.4 14.4C65.4 18.8 62.2 23.4 57 23.2C51.8 23 46.6 18 49 12.2z')}
    ${fill('M53.2 9.4L55.2 3.2L58.4 8.6z','var(--pet-coat)',2)}
    <g class="pet-eye"><circle cx="56.2" cy="14.8" r="1.45" fill="${INK}"/><circle cx="56.7" cy="14.3" r=".45" fill="#FFFFFF"/></g>
    <path class="pet-lid" d="M54.4 15.2C55.4 16.2 57 16.2 58 15.2" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="62" cy="18.6" r=".8" fill="${INK}"/>
    <path class="pet-smile" d="M58.8 21.2C60 21.8 61.2 21.6 62.2 20.8" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>
    ${fill('M51.6 8.4C49 10.4 47.4 13 47.6 16.4C49.8 15 51.6 12.6 52.6 9.6z','var(--pet-mane)',1.8)}
    <g class="pet-flag"><path d="M62.6 20.4L67.6 3.6" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M67.6 3.6L71.4 6.6L66.4 9.4z" fill="var(--pet-note,#E2B865)" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/></g>
   </g>
   ${fill('M50.6 12.6C46.6 15.4 43 20.6 41.2 27.6C38.6 24.6 39.4 17.6 43.6 12.8C46 10.2 49.4 9.8 50.6 12.6z','var(--pet-mane)',2.2)}
   ${ink('M44.4 15.4C42.8 18 42 20.8 41.8 23.4',1.1,' opacity=".55"')}
  </g>
 </g>
 <g class="pet-book"><path d="M52 55.6L59 53.6L66 55.6L66 59.4L59 57.6L52 59.4z" fill="#FBF6EA" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M59 53.6V57.6M54 56.6l3.4-.9M61 55.8l3.4.9" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/></g>
 <g class="pet-oats"><path d="M54 57.4C54 54.6 64 54.6 64 57.4L62.6 60H55.4z" fill="#D4A27F" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M56 55.4c1.4-1.4 4.6-1.4 6 0" fill="none" stroke="#E2B865" stroke-width="1.8" stroke-linecap="round"/></g>
 <g class="pet-zz" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path class="z1" d="M60 40h4l-4 4.4h4"/><path class="z2" d="M65.4 31.4h3l-3 3.4h3"/></g>
 <g class="pet-sparks" fill="#E2B865" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"><path class="s1" d="M10 14l1.6 3.4L15 19l-3.4 1.6L10 24l-1.6-3.4L5 19l3.4-1.6z"/><path class="s2" d="M66 26l1.1 2.3L69.4 29.4L67.1 30.5L66 32.8L64.9 30.5L62.6 29.4L64.9 28.3z"/><path class="s3" d="M30 6l1 2.1L33.1 9.1L31 10.1L30 12.2L29 10.1L26.9 9.1L29 8.1z"/></g>
</g></svg>`;
 }
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},
   text=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,120):'',
   escape=v=>String(v).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
 const FALLBACKS={trot:'walk',lie:'sleep',read:'stand',eat:'stand',cheer:'stand',flag:'stand',fall:'stand',held:'stand'},
   media=new WeakMap(),
   hydrations=new WeakMap(),
   effective=new WeakMap(),
   originals=new WeakMap();
 const original=pack=>originals.get(pack)||pack;
 function selectedLayer(own,id){const layers=object(own.adjustments),key='pack:'+id;return Object.hasOwn(layers,key)?object(layers[key]):{};}
 function effectivePack(pack,layer){
  const flags=object(layer.poses),
    disabled=POSES.filter(pose=>pose!=='stand'&&Object.hasOwn(flags,pose)&&flags[pose]===false&&Object.hasOwn(pack.poses,pose)),
    key=disabled.join('|');
  if(!key)return pack;
  const cached=effective.get(pack);if(cached?.key===key)return cached.pack;
  const poses={...pack.poses};for(const pose of disabled)delete poses[pose];
  const value={...pack,poses};originals.set(value,pack);effective.set(pack,{key,pack:value});return value;
 }
 function identity(data={},hydratedPack=null){
  const d=object(data),
    pet=object(d.pet&&typeof d.pet==='object'?d.pet:d),
    settings=object(d.settings),
    own=object(settings.makeYourOwn),
    active=object(own.pet),
    installed=object(own.installed),
    row=Object.hasOwn(installed,active.id)?object(installed[active.id]):{},
    wrapped=object(hydratedPack),
    candidate=object(original(object(wrapped.pack||hydratedPack))),
    scoped=Object.hasOwn(d,'settings'),
    layer=scoped?selectedLayer(own,active.id):{};
  const selected=scoped?
    typeof active.id==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(active.id)&&!['__proto__','constructor','prototype'].includes(active.id)&&row.kind==='pet'&&row.id===active.id&&!!text(row.name):
    candidate.format==='chpet',
    valid=selected&&
      candidate.format==='chpet'&&
      Array.isArray(candidate.size)&&
      candidate.size.length===2&&
      candidate.size.every(n=>Number.isFinite(n)&&n>0)&&
      !!object(candidate.assets)[object(candidate.poses).stand]&&
      (!wrapped.id||!scoped||wrapped.id===row.id)&&
      (!scoped||text(candidate.name)===text(row.name)),
    pack=valid?candidate:null;
  const sourceName=selected?text(scoped?row.name:candidate.name):'',name=selected?text(object(layer.pet).name)||sourceName||'Biscuit':active.id?'Biscuit':text(pet.name)||'Biscuit';
  return {
    name,
    sourceName,
    id:selected&&scoped?row.id:null,
    kind:selected?'companion':'pony',
    custom:!!pack,
    pack:pack?effectivePack(pack,layer):null,
    motion:selected&&['gentle','still','off'].includes(layer.motion)?layer.motion:'gentle',
    enabled:pet.enabled!==false,
    coat:Object.hasOwn(COATS,pet.coat)?pet.coat:'oat',
    harness:Object.hasOwn(HARNESS,pet.harness)?pet.harness:'red',
    gear:['full','collar','none'].includes(pet.gear)?pet.gear:'full'
  };
 }
 function customPose(pack,value='stand'){
   const poses=object(pack?.poses);
   return Object.hasOwn(poses,value)?value:Object.hasOwn(FALLBACKS,value)&&Object.hasOwn(poses,FALLBACKS[value])?FALLBACKS[value]:'stand';
 }
 function customDrawing(pack,value='stand',face='right',still=false){
  if(!pack||!Array.isArray(pack.size)||pack.size.length!==2||!pack.size.every(n=>Number.isFinite(n)&&n>0))return null;
  let pose=customPose(pack,value),asset=object(pack.assets)[object(pack.poses)[pose]];if(!asset||typeof asset!=='object')return null;
  if(still&&asset.animated&&!asset.svg){pose='stand';asset=object(pack.assets)[object(pack.poses).stand];if(!asset||typeof asset!=='object')return null;}
  let urls=media.get(asset);
  if(!urls){
    let moving;
    if(typeof asset.svg==='string'&&asset.svg)
      moving='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(asset.svg);
    else if(/^image\/(?:png|webp|gif)$/.test(asset.type)&&typeof asset.data==='string'&&/^[A-Za-z0-9+/=\s]+$/.test(asset.data))moving='data:'+asset.type+';base64,'+asset.data;else return null;
    urls={
      moving,
      still:asset.svg?
        'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(asset.still||asset.svg):
        (/^(?:data:image\/(?:png|webp|gif);base64,[A-Za-z0-9+/=\s]+|data:image\/svg\+xml;charset=utf-8,%3[cC]svg(?:%20|%3[eE])[^\s]*)$/.test(asset.firstFrame||''))?asset.firstFrame:moving
    };
    media.set(asset,urls);
  }
  return {pose,src:still?urls.still:urls.moving,width:pack.size[0],height:pack.size[1],ground:pack.ground,mirror:face!==pack.faces};
 }
 function drawing(data={},hydratedPack=null,{pose='stand',face='right',still=true}={}){
  const p=identity(data,hydratedPack),custom=customDrawing(p.pack,pose,face,still||p.motion!=='gentle');
  if(custom)return `<img class="pet-svg" src="${escape(custom.src)}" width="${custom.width}" height="${custom.height}" alt="${escape(p.name)}" draggable="false" decoding="async" style="width:100%;height:100%;object-fit:contain;transform:scaleX(${custom.mirror?-1:1})">`;
  if(p.kind==='companion')return placeholder();
  const coat=COATS[p.coat],paint=Object.entries(coat).filter(([key])=>key!=='label').map(([key,value])=>'--pet-'+key+':'+value).join(';')+';--pet-harness:'+HARNESS[p.harness];
  return svg({title:p.name}).replace('<svg ',`<svg style="${paint}" `);
 }
 function placeholder(){return '<svg class="pet-svg" viewBox="0 0 72 64" role="img" aria-label="Companion" focusable="false"><circle cx="36" cy="30" r="22" fill="#E5E3DE" stroke="#8A8880" stroke-width="1.5"/><g fill="#8A8880"><circle cx="27" cy="30" r="2"/><circle cx="36" cy="30" r="2"/><circle cx="45" cy="30" r="2"/></g></svg>';}
 function lookMode(state={},preferred='light'){
  const ready=state.lookStatus==='ready',
    look=object(state.look),
    wanted=preferred==='dark'?'dark':'light',
    custom=look.kind==='theme',
    modes=!ready?[]:custom?[...new Set((Array.isArray(look.modes)?look.modes:[]).filter(value=>['light','dark'].includes(value)))]:['light','dark'];
  return {
    ready,
    modes,
    mode:!ready?null:!custom?wanted:modes.includes(wanted)?wanted:modes.includes(look.mode)?look.mode:modes[0]||(['light','dark'].includes(look.mode)?look.mode:null)
  };
 }
 const clearHydration=store=>{if(store&&typeof store==='object')hydrations.delete(store);};
 async function hydrate(data,{store,read=root.ReservePacks?.readLocal,runtime=root.chrome?.runtime}={}){
  const p=identity(data);
  if(!p.id||!store?.owner){clearHydration(store);return null;}
  const key=JSON.stringify([store.owner.origin,store.owner.accountId,p.id,p.sourceName]),current=()=>{
    const selected=identity(store.get?store.get():data);
    return selected.id===p.id&&selected.sourceName===p.sourceName&&JSON.stringify([store.owner?.origin,store.owner?.accountId,p.id,p.sourceName])===key;
  };
  let cached=hydrations.get(store);
  if(!cached||cached.key!==key){
    cached={key,pending:null};
    hydrations.set(store,cached);
    cached.pending=(async()=>{
      let pack;
      if(typeof read==='function'){const result=await read(p.id,{store});pack=result?.id===p.id&&result?.kind==='pet'?identity(data,result).pack:null;}
      else if(typeof runtime?.sendMessage==='function'){
        const reply=await runtime.sendMessage({type:'ch-companion',op:'read',owner:store.owner}),selected=reply?.ok===true?identity(reply.data,reply.pack):null;
        pack=selected?.id===p.id?identity(data,reply.pack).pack:null;
      }
      return pack||null;
    })();
  }
  let pack;
  try{pack=await cached.pending;}catch(error){if(hydrations.get(store)===cached)hydrations.delete(store);throw error;}
  if(!pack||!current()||hydrations.get(store)!==cached){if(hydrations.get(store)===cached)hydrations.delete(store);return null;}
  return original(pack);
 }
 function observe(listener,{runtime=root.chrome?.runtime,events=root.chrome?.storage?.onChanged,look=false}={}){
  let dead=false,revision=0;const emit=value=>{if(!dead)listener(value);};
  async function refresh(){
   const turn=++revision,empty={status:'loading',lookStatus:look?'loading':'idle',data:null,pack:null,look:null};emit(empty);
   if(typeof runtime?.sendMessage!=='function'){emit({...empty,status:'error',lookStatus:look?'error':'idle'});return;}
   const replies=await Promise.allSettled([
     Promise.resolve().then(()=>runtime.sendMessage({type:'ch-companion',op:'read'})),
     ...(look?[Promise.resolve().then(()=>runtime.sendMessage({type:'ch-look',op:'read'}))]:[])
   ]);
   if(dead||turn!==revision)return;
   const reply=replies[0].status==='fulfilled'?replies[0].value:null,result={...empty,status:'error',lookStatus:look?'error':'idle'};
   if(reply?.ok===true&&reply.data?.pet&&typeof reply.data.pet==='object'&&!Array.isArray(reply.data.pet)){
     const p=identity(object(reply.data),reply.pack),
       row=p.id?{id:p.id,name:p.sourceName,kind:'pet'}:null,
       flags=object(selectedLayer(object(object(reply.data.settings).makeYourOwn),p.id).poses),
       poses={};
     for(const pose of POSES)if(pose!=='stand'&&Object.hasOwn(flags,pose)&&flags[pose]===false)poses[pose]=false;
     result.status='ready';
     result.data={
       pet:{name:p.name,enabled:p.enabled,coat:p.coat,harness:p.harness,gear:p.gear},
       settings:{makeYourOwn:{pet:row,installed:row?{[row.id]:row}:{},adjustments:row?{['pack:'+row.id]:{pet:{name:p.name},poses,motion:p.motion}}:{}}}
     };
     result.pack=p.pack?original(p.pack):null;
   }
   const label=replies[1]?.status==='fulfilled'?replies[1].value:null;
   if(label?.ok===true&&Object.hasOwn(label,'look')&&(label.look===null||label.look&&typeof label.look==='object'&&!Array.isArray(label.look)&&['builtin','theme','scene'].includes(label.look.kind))){
     result.lookStatus='ready';
     if(label.look)
       result.look={
         id:text(label.look.id),
         name:text(label.look.name),
         kind:label.look.kind,
         preview:typeof label.look.preview==='string'?label.look.preview:'',
         modes:[...new Set((Array.isArray(label.look.modes)?label.look.modes:[]).filter(mode=>['light','dark'].includes(mode)))],
         mode:['light','dark'].includes(label.look.mode)?label.look.mode:null
       };
   }
   emit(result);
  }
  const changed=(changes,area)=>{
    if(area==='local'&&Object.keys(changes).some(key=>key.startsWith('reserve:v1:')||['reserve:packs','reserve:packs:receipts',...(look?['reserve:appearance']:[])].includes(key)))void refresh();
  },message=value=>{if(value?.type==='ch-companion-changed')void refresh();};
  events?.addListener(changed);runtime?.onMessage?.addListener(message);void refresh();
  return {refresh,destroy(){dead=true;revision++;events?.removeListener(changed);runtime?.onMessage?.removeListener(message);}};
 }
 const api={COATS,HARNESS,POSES,svg,identity,drawing,placeholder,lookMode,customPose,customDrawing,hydrate,clearHydration,observe};
 root.ReservePetArt=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
