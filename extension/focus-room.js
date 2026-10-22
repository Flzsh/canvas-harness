/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Adapted from Gary Wu's pull request #43 to Canvas Harness.
(function(root){
 'use strict';
 const enabled=()=>root.ReserveFeatures?.enabled('focus-room')===true;
 const blocked=()=>/\/quizzes\/[^/]+\/(?:take|resume)(?:\/|$)|\/assessment_sessions\//.test(root.location?.pathname||'');
 function create({container,store}){
  const doc=container.ownerDocument,hidden=new Map();let panel=null,previous=null,dead=false,opening=0;
  const full=()=>doc.fullscreenElement===container||container.getRootNode?.()?.fullscreenElement===container;
  function restore(){for(const [node,value]of hidden){node.hidden=value.hidden;node.inert=value.inert;if(value.display)node.style?.setProperty('display',value.display,value.priority);else node.style?.removeProperty('display');}hidden.clear();}
  function close(exit=true){opening++;const active=!!panel;panel?.remove();panel=null;restore();delete container.dataset.chRoom;if(exit&&full())Promise.resolve(doc.exitFullscreen?.()).catch(()=>{});if(active)previous?.focus?.({preventScroll:true});previous=null;}
  function sync(){
   if(!panel)return;if(dead||!enabled()||blocked()){close();return;}
   if(panel.parentNode!==container)container.append(panel);
   for(const node of container.children||[]){
    if(node===panel||node.classList?.contains('tk-sky')||node.classList?.contains('tk-starframes')||node.classList?.contains('rd-data-theme-background'))continue;
    if(!hidden.has(node))hidden.set(node,{hidden:node.hidden,inert:node.inert,display:node.style?.getPropertyValue('display')||'',priority:node.style?.getPropertyPriority('display')||''});
    node.hidden=true;node.inert=true;node.style?.setProperty('display','none','important');
   }
   const focus=store.get().focus,state=root.ReserveCore.focusState(focus,Date.now()),seconds=Math.max(0,Math.ceil(state.left)),text=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
   const time=panel.querySelector('[data-rd-timer-text]');if(time&&time.textContent!==text)time.textContent=text;
   const phase=panel.querySelector('[data-ch-room-phase]');if(phase)phase.textContent=state.phase==='break'?'Break':'Focus';
   const cycle=panel.querySelector('[data-ch-room-cycle]');if(cycle)cycle.textContent=focus?.cycles?`${focus.cycle||1} / ${focus.cycles}`:'';
   const toggle=panel.querySelector('[data-rd-action="timer-toggle"]');if(toggle)toggle.textContent=state.running?'Pause':state.paused?'Resume':'Start';
   for(const button of panel.querySelectorAll('[data-rd-action="focus-control"]'))button.disabled=!state.active;
  }
  async function open(){
   if(dead||panel||!enabled()||blocked())return false;
   previous=doc.activeElement;const version=++opening;panel=doc.createElement('section');panel.className='ch-room-view';panel.style.setProperty('position','relative');panel.style.setProperty('z-index','3');panel.dataset.rdKeep='true';panel.setAttribute('aria-label','Focus room');panel.setAttribute('role','region');
   panel.innerHTML='<header class="rd-widget-head"><h2>Focus room</h2><button type="button" class="rd-text-button" data-rd-action="room-close">Close</button></header><div class="rd-timer ch-room-timer" data-rd-timer><span data-ch-room-phase></span><h1 class="ch-room-time" data-rd-timer-text></h1><span data-ch-room-cycle></span><div class="rd-timer-actions"><button type="button" class="rd-button" data-rd-action="timer-toggle">Start</button><button type="button" class="rd-text-button" data-rd-action="focus-control" data-focus-action="stop">Stop</button><button type="button" class="rd-text-button" data-rd-action="focus-control" data-focus-action="adjust" data-minutes="-5">-5</button><button type="button" class="rd-text-button" data-rd-action="focus-control" data-focus-action="adjust" data-minutes="5">+5</button><button type="button" class="rd-text-button" data-rd-action="timer-reset">Reset</button></div></div><span class="ch-room-status" role="status"></span>';
   container.dataset.chRoom='open';container.append(panel);sync();panel.querySelector('[data-rd-action="room-close"]')?.focus?.({preventScroll:true});
   try{if(!container.requestFullscreen)throw Error('Full screen unavailable');await container.requestFullscreen();if(version!==opening){if(full())await doc.exitFullscreen?.();return false;}}
   catch{if(panel&&version===opening)panel.querySelector('[role="status"]').textContent='Full screen unavailable';}
   return !!panel;
  }
  function changed(){if(panel&&!full())close(false);}
  function keydown(event){if(panel&&event.key==='Escape'){event.preventDefault?.();close();return true;}return false;}
  function click(event){const action=event.target?.closest?.('[data-rd-action]')?.dataset.rdAction;if(action==='room-open'){void open();return true;}if(action==='room-close'){close();return true;}return false;}
  doc.addEventListener('fullscreenchange',changed);
  return {open,close,sync,click,keydown,isOpen:()=>!!panel,destroy(){dead=true;close();doc.removeEventListener('fullscreenchange',changed);}};
 }
 const api={create};root.ReserveFocusRoom=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
