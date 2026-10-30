/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// Split popup renderer. Drawings belong to ReserveAddonsArt; navigation and persistence belong to the popup.
// mount(box,{view:'features'|'addons',catalog:[{id,name,group,icon}],prefs:{preset,on},installed:[{id,name,kind}],packPending,onPreset,onToggle,onReset,onRemove,onMarket}) -> {update(next)}.
(() => {
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=(set,key)=>{const drawings=globalThis.ReserveAddonsArt?.[set];return drawings&&Object.prototype.hasOwnProperty.call(drawings,key)?drawings[key]:'';};
const PRESETS=[['full','Full'],['lite','Lite'],['custom','Custom']];
function mount(box,o){
  let state={view:'features',catalog:[],prefs:{preset:'full',on:{}},installed:[],packPending:[],changed:false,...o};
  const root=document.createElement('section');root.className='ap';box.append(root);
  const preset=([id,name])=>`<button type="button" class="ap-preset${state.prefs?.preset===id?' is-on':''}" data-preset="${id}" aria-pressed="${state.prefs?.preset===id}"><span class="ap-pot" aria-hidden="true">${art('presets',id)}</span><b>${name}</b></button>`;
  // A feature that lives somewhere else (a room, a workspace, a tray) gets "Open" while it is on in this page
  // (owner, 2026-10-27: "focus room, grade impact, review deck, I have no idea how to access them").
  const open=f=>
    state.onOpen&&state.opens?.includes(f.id)&&state.live?.includes(f.id)&&state.prefs?.on?.[f.id]?
      `<button type="button" class="rd-text-button ap-open" data-open-feature="${esc(f.id)}" aria-label="Open ${esc(f.name)}">Open</button>`:
      '';
  const row=f=>`<li class="ap-row"><span class="ap-ic" aria-hidden="true">${f.preview||art('icons',f.icon)}</span><span class="ap-t"><b>${esc(f.name)}</b></span>${open(f)}<button type="button" class="ap-toggle" role="switch" aria-checked="${!!state.prefs?.on?.[f.id]}" aria-label="${esc(f.name)}" data-id="${esc(f.id)}"><span class="ap-track" aria-hidden="true"></span></button></li>`;
  const features=()=>
    `<div class="segments ap-presets" role="group" aria-label="Preset">${PRESETS.map(preset).join('')}</div>${state.changed?'<p class="ap-reload" role="status">Reload Canvas to apply.</p>':''}`+
      [...new Set((state.catalog||[]).map(f=>f.group))].map(group=>`<h4 class="ap-group">${esc(group)}</h4><ul class="ap-list">${state.catalog.filter(f=>f.group===group).map(row).join('')}</ul>`).join('')+
      ((state.installed||[]).length?`<h4 class="ap-group">Installed features</h4><ul class="ap-list">${state.installed.map(pack).join('')}</ul>`:'')+
      (state.onMarket?'<button type="button" class="rd-text-button" data-market="open">Get more</button>':'');
  const pack=p=>`<li class="ap-row"><span class="ap-ic" aria-hidden="true">${p.preview||art('icons',p.kind)||art('icons','upload')}</span><span class="ap-t"><b>${esc(p.name)}</b><span class="ap-kind">${esc(p.kind)}${p.source==='market'?' · From the Market':p.source==='file'?' · From a file':''}${p.current?' · Current':''}</span></span>${state.onUse?`<button type="button" class="rd-text-button" data-use-pack="${esc(p.id)}" aria-label="Use ${esc(p.name)}" aria-pressed="${!!p.current}"${(state.packPending||[]).includes(p.id)?' disabled':''}>Use</button>`:''}<button type="button" class="rd-text-button" data-reset-pack="${esc(p.id)}" aria-label="Reset ${esc(p.name)}"${(state.packPending||[]).includes(p.id)?' disabled':''}>Reset to how it came</button><button type="button" class="ap-remove" data-remove-pack="${esc(p.id)}" aria-label="Remove ${esc(p.name)}"${(state.packPending||[]).includes(p.id)?' disabled':''}>Remove</button></li>`;
  const addons=()=>((state.installed||[]).length?`<ul class="ap-list ap-installed">${state.installed.map(pack).join('')}</ul>`:`<div class="ap-empty"><span class="ap-empty-art" aria-hidden="true">${art('presets','custom')||art('icons','upload')}</span><p>Nothing added yet</p></div>`)+`<button type="button" class="ap-market-open" data-market="open">Open the market</button>`;
  function render(){root.setAttribute('aria-label',state.view==='addons'?'Add-ons':'Features');root.innerHTML=state.view==='addons'?addons():features();}
  function update(next){
    const focus=root.contains(document.activeElement)?document.activeElement:null,
      kind=focus&&['id','preset','usePack','resetPack','removePack','openFeature','market'].find(key=>focus.dataset[key]!==undefined),
      key=kind&&focus.dataset[kind];
    state={...state,...next};render();
    if(kind){
      const buttons=[...root.querySelectorAll('button')],same=buttons.find(button=>button.dataset[kind]===key&&!button.disabled);
      (same||(['resetPack','removePack'].includes(kind)?buttons.find(button=>button.dataset.market!==undefined):null))?.focus();
    }
  }
  root.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t||!root.contains(t)||t.disabled)return;
    if(t.dataset.preset!==undefined){state.changed=true;const id=t.dataset.preset;update({});state.onPreset?.(id);return;}
    if(t.dataset.id!==undefined){
      const id=t.dataset.id,on=t.getAttribute('aria-checked')!=='true';
      state.changed=true;
      update({prefs:{...state.prefs,on:{...state.prefs?.on,[id]:on}}});
      state.onToggle?.(id,on);
      return;
    }
    if(t.dataset.resetPack!==undefined){state.onReset?.(t.dataset.resetPack);return;}
    if(t.dataset.removePack!==undefined){state.onRemove?.(t.dataset.removePack);return;}
    if(t.dataset.usePack!==undefined){state.onUse?.(t.dataset.usePack);return;}
    if(t.dataset.openFeature!==undefined){state.onOpen?.(t.dataset.openFeature);return;}
    if(t.dataset.market!==undefined)state.onMarket?.();
  });
  render();return {update};
}
globalThis.ReserveAddonsPanel={mount};
})();
