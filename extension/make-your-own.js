/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Local pack review. No downloads, account discovery or background work. */
(function(root){
 'use strict';
 const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const codecs={chtheme:'ReserveThemePack',chpet:'ReservePetPack',chpreset:'ReservePresetPack'};
 const button=(action,label,id='',disabled=false)=>`<button type="button" class="rd-text-button" data-rd-action="make-${action}"${id?` data-id="${E(id)}"`:''}${disabled?' disabled':''}>${E(label)}</button>`;
 function image(asset,label='',size=[96,80]){
  if(!asset)return '';
  const dimensions=size.every(n=>Number.isFinite(n)&&n>=1&&n<=2400)?size:[96,80];
  if(asset.svg)return `<img alt="${E(label)}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.still||asset.svg)}" width="${dimensions[0]}" height="${dimensions[1]}">`;
  if(!/^image\/(?:png|jpeg|webp|gif|svg\+xml)$/.test(asset.type)||typeof asset.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data))return '';
  return `<img alt="${E(label)}" src="data:${asset.type};base64,${asset.data}" width="${dimensions[0]}" height="${dimensions[1]}">`;
 }
 function preview(pack){
  if(!pack)return '';
  if(pack.format==='chpet')
    return `<div class="cz-row ch-make-poses">${['stand','walk','sleep','trot','lie','read','eat','cheer','flag','fall','held'].map(pose=>{
      const id=pack.poses[pose]||pack.poses[{trot:'walk',lie:'sleep'}[pose]||'stand'],asset=pack.assets[id],rest=asset.animated&&!asset.svg?pack.assets[pack.poses.stand]:asset;
      let art=image(asset,pose,pack.size);
      if(!asset.svg){
        const url=rest.svg?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(rest.still||rest.svg):rest.firstFrame||'data:'+rest.type+';base64,'+rest.data;
        art=`<picture><source media="(prefers-reduced-motion: reduce)" srcset="${E(url)}">${art}</picture>`;
      }
      return `<figure>${art}<figcaption>${E(pose)}</figcaption></figure>`;
    }).join('')}</div>`;
  if(pack.format==='chpreset')return `<ul>${(root.ReservePresetPack?.describe(pack)||[pack.kind]).map(label=>`<li>${E(label)}</li>`).join('')}</ul>`;
  if(pack.format!=='chtheme')return '';
  return Object.entries(pack.colors).map(([mode,colors])=>{
   const valid=Object.values(colors).every(c=>/^#[a-f\d]{6}$/i.test(c));if(!valid)return '';
   return `<section class="ch-make-preview" style="background:${colors.bg};color:${colors.ink}"><h4>${E(mode)}</h4>${pack.background?`<figure>${image(pack.assets?.[pack.background.still||pack.background.asset])}<figcaption>Background</figcaption></figure>`:''}${image(pack.assets?.[pack.banner?.still||pack.banner?.asset])}<div style="background:${colors.surface};color:${colors.ink};border:1px solid ${colors.line}"><h5>${E(pack.name)}</h5>${pack.title?`<span>${E(pack.title.family)}</span>`:''}<span style="color:${colors.muted}">Planner</span> <span style="color:${colors.accent}">Courses</span>${(pack.icons||[]).map(id=>image(pack.assets?.[id])).join('')}</div>${Object.entries(pack.frames||{}).map(([kind,frame])=>`<figure>${image(pack.assets?.[frame.asset])}<figcaption>${E(kind)}</figcaption></figure>`).join('')}</section>`;
  }).join('');
 }
 // Show each installed item where it belongs. Preset kinds are read from their
 // validated saved packs by the existing local controller, not guessed by name.
 function picker(state,settings={},options={}){
  const kinds=options.kinds||['theme','pet','preset'];
  const rows=Object.values(settings.makeYourOwn?.installed||{}).filter(row=>
   kinds.includes(row.kind)&&(!options.presetKinds||row.kind!=='preset'||options.presetKinds.includes(state?.presetKinds?.[row.id])));
  return `<div class="ch-make-list" role="group" aria-label="${E(options.label||'Saved choices')}">${rows.map(row=>`<div class="cz-row"><span>${E(row.name)}</span>${button('review','Preview',row.id,state?.busy)}${button('use','Use',row.id,state?.busy)}${button('remove','Remove',row.id,state?.busy)}</div>`).join('')}</div>`;
 }
 function render(state,settings={},extras={}){
  if(!state)return '';
  const rows=Object.values(settings.makeYourOwn?.installed||{}),draft=state.draft,pack=draft?.pack;
  if(extras.add===false&&extras.list===false&&!pack&&!state.status)return '';
  return `<section class="cz-group ch-make-files" data-make-drop aria-busy="${!!state.busy}" aria-label="Files">${extras.add===false?'':`<label class="rd-button ch-upload ch-make-add">Add from a file<input type="file" accept=".chpack,.chkit,.chtheme,.chpet,.chpreset" data-rd-field="make-file"${state.busy?' disabled':''}></label>`}${state.status?`<p role="status">${E(state.status)}</p>`:''}${pack?`<section class="ch-make-review"><h3>${E(pack.name)}</h3>${preview(pack)}${pack.format==='chpreset'&&pack.kind==='planner'?`<label class="rd-field"><span>Week</span><input type="date" data-rd-field="make-week" value="${E(state.week)}" required></label>`:''}${button('apply','Apply','',state.busy)}${button('cancel','Cancel','',state.busy)}</section>`:''}${extras.list===false?'':`<div class="ch-make-list">${rows.map(row=>`<div class="cz-row"><span>${E(row.name)}</span>${button('review','Preview',row.id,state.busy)}${button('use','Use',row.id,state.busy)}${button('remove','Remove',row.id,state.busy)}</div>`).join('')}</div>${(extras.kits||[]).map(kit=>`<div class="cz-row"><span>${E(kit.name)}</span><button type="button" class="rd-text-button" data-rd-action="kit-use" data-kit="${E(kit.id)}" data-id="all">Use</button><button type="button" class="rd-text-button" data-rd-action="kit-remove" data-kit="${E(kit.id)}">Remove</button></div>`).join('')}${extras.quickUpload?.phase==='applied'?`<div class="cz-row"><span>${E(extras.quickUpload.name||'Artwork pack')}</span><button type="button" class="rd-text-button" data-rd-action="quick-pack-undo">Remove</button></div>`:''}`}</section>`;
 }
 function create({store,quickPack,kitImport,onChange=()=>{}}){
  let dead=false,revision=0,hydration=0,signature='';
  const state={busy:false,draft:null,status:'',week:'',theme:null,pet:null,presetKinds:{}};
  const notify=()=>{if(!dead)onChange();};
  async function read(id){const result=await root.ReservePacks.readLocal(id,{store});return result.pack||result;}
  function sync(){
   if(dead)return;
   const own=store.get().settings?.makeYourOwn||{},
     presets=Object.values(own.installed||{}).filter(row=>row.kind==='preset'),
     next=JSON.stringify([own.theme?.id||null,own.pet?.id||null,presets.map(row=>row.id)]);
   if(next===signature)return;signature=next;
   const token=++hydration;state.theme=state.pet=null;state.presetKinds={};
   if(!own.theme&&!own.pet&&!presets.length){notify();return;}
   Promise.all([...['theme','pet'].map(kind=>own[kind]?read(own[kind].id):null),...presets.map(row=>read(row.id).catch(()=>null))]).then(([theme,pet,...saved])=>{
    if(dead||token!==hydration)return;
    state.theme=theme;state.pet=pet;
    state.presetKinds=Object.fromEntries(saved.map((pack,i)=>[presets[i].id,pack?.kind]).filter(([,kind])=>kind));
    notify();
   },error=>{if(dead||token!==hydration)return;state.status=error?.message||'Could not load pack';notify();});
  }
  async function choose(file){
   if(dead||state.busy||!file)return;
   const ext=String(file.name||'').split('.').at(-1).toLowerCase();
   if(ext==='chpack'){if(!quickPack){state.status='Quick upload is unavailable';notify();return;}return quickPack(file);}
   if(ext==='chkit'){if(!kitImport){state.status='Kits are unavailable';notify();return;}return kitImport(file);}
   const codec=root[codecs[ext]];if(!codec){state.status='Choose .chpack, .chkit, .chtheme, .chpet or .chpreset';notify();return;}
   const token=++revision;state.busy=true;state.status='Checking';state.draft=null;notify();
   try{const result=await codec.importPack(file);if(dead||revision!==token)return;state.draft={file,pack:result.pack};state.status='';}
   catch(error){if(!dead&&revision===token)state.status=error?.message||'Invalid file';}
   finally{if(!dead&&revision===token){state.busy=false;notify();}}
  }
  async function action(name,id){
   if(dead||state.busy)return;
   if(name==='cancel'){++revision;state.draft=null;state.status='';notify();return;}
   const P=root.ReservePacks;if(!P){state.status='Pack storage is unavailable';notify();return;}
   if(name==='review'||name==='use'){
    const row=store.get().settings?.makeYourOwn?.installed?.[id];
    if(!row)return;
    state.busy=true;
    notify();
    try{const pack=row.pack||await read(id);if(dead)return;state.draft={id,pack};}catch(error){state.status=error?.message||'Could not load pack';}finally{state.busy=false;notify();}
    return;
   }
   if(name==='apply'&&!state.draft)return;
   state.busy=true;state.status='';notify();
   try{
    if(name==='remove')await P.removeLocal(id,{store});
    else if(name==='apply'){
      if(state.draft.id&&P.useLocal)await P.useLocal(state.draft.id,{store,week:state.week});else await P.installLocal(state.draft.file,{store,week:state.week});
      state.draft=null;
    }
    else return;
    state.status=name==='remove'?'Removed':'Added';
   }catch(error){state.status=error?.message||'Could not save';}
   finally{state.busy=false;notify();}
  }
  const unsubscribe=store.subscribe?.(sync);sync();
  return {state,choose,action,sync,week(value){
    state.week=value;
  },destroy(){dead=true;++revision;++hydration;unsubscribe?.();state.draft=null;state.theme=state.pet=null;}};
 }
 const api={render,preview,picker,create};root.ReserveMakeYourOwn=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
