// The personal appearance editor stays in the dashboard DOM; this controller only
// manages its nonmodal dock state and returns focus when the dock is dismissed.
(function(root){
 'use strict';

 function createDock({container,onOpen=()=>{},onChange=()=>{}}){
  if(root.ReserveSite?.vanillaPage(root.location))return null;
  let open=false,opener=null,destroyed=false;
  const panel=()=>container.querySelector('.rd-appearance.ch-settings-dock');
  const toolbarButton=()=>container.querySelector('.rd-toolbar [data-rd-action="settings"]');

  function sync(){
   container.dataset.settings=open?'open':'closed';
   container.getRootNode?.()?.host?.toggleAttribute?.('data-reserve-settings',open);
   toolbarButton()?.setAttribute('aria-expanded',String(open));
   const node=panel();
   if(!node)return;
   node.dataset.open=String(open);
   node.inert=!open;
   if(open)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden','true');
   const inner=node.querySelector('.t-acc-panel');
   if(inner){
    inner.inert=!open;
    if(open)inner.removeAttribute('aria-hidden');else inner.setAttribute('aria-hidden','true');
   }
  }

  function show(source){
   if(destroyed)return;
   const candidate=source||container.querySelector(':focus')||toolbarButton();
   if(!open||(candidate&&!panel()?.contains(candidate)))opener=candidate;
   if(!open){
    onOpen(); // Handoff: the parent closes Tools before Settings becomes active.
    open=true;
    onChange(true);
   }
   sync();
   panel()?.querySelector('[data-rd-action="settings-close"]')?.focus({preventScroll:true});
  }

  function close({restoreFocus=true}={}){
   if(destroyed||!open)return;
   open=false;
   onChange(false);
   sync();
   if(!restoreFocus)return;
   // A launcher inside the closed Tools dock or phone drawer may no longer be visible.
   const visible=opener?.checkVisibility?.({visibilityProperty:true})??
    (opener?root.getComputedStyle?.(opener)?.visibility!=='hidden':false);
   const valid=opener?.isConnected&&opener.getClientRects?.().length&&visible&&
    !opener.closest?.('[inert],.rd-utility-dialog');
   (valid?opener:toolbarButton())?.focus({preventScroll:true});
  }

  return {
   open:show,close,sync,
   toggle(source){if(open)close();else show(source);},
   handleKeydown(event){
    if(!open||event.defaultPrevented||event.key!=='Escape')return false;
    event.preventDefault();
    close();
    return true;
   },
   destroy(){
    if(destroyed)return;
    open=false;
    sync();
    destroyed=true;
    opener=null;
   }
  };
 }

 const api={createDock};
 root.ReserveSettingsDock=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
