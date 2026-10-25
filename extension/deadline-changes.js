// Adapted from Gary Wu's pull request #52 to Canvas Harness.
/*! Canvas Harness · Deadline changes · Original creator Flzsh · GPL-3.0-only. */
(function(root){'use strict';
 const M=root.ReserveDeadlineModel||(typeof module==='object'&&module.exports?require('./deadline-model.js'):null);
 const enabled=()=>!root.ReserveFeatures||root.ReserveFeatures.enabled('deadline-changes');
 async function record(store,snapshot,{current=()=>true}={}){
  if(!enabled()||!current()||!store?.updateDeadlineChanges)return;
  if(store.owner?.origin!==snapshot.origin||String(store.owner?.accountId)!==String(snapshot.user?.id))throw Error('Deadline observations belong to another Canvas account.');
  return store.updateDeadlineChanges(previous=>current()&&enabled()?M.observe(previous,snapshot):undefined);
 }
 function create({container,store,onChange=()=>{},getTimeZone=()=>undefined}){
  if(!enabled()||!store.readDeadlineChanges||!store.updateDeadlineChanges)return null;
  const doc=container.ownerDocument||root.document,off=new AbortController();let dead=false,turn=0,data=M.empty(),loaded=false,error='',dialog=null,trigger=null;
  const listen=(node,type,fn)=>node.addEventListener(type,fn,{signal:off.signal});
  function node(tag,text,cls){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
  async function reload(){const revision=++turn;try{const next=M.clean(await store.readDeadlineChanges());if(dead||revision!==turn)return;data={...next,history:next.history.filter(h=>Date.parse(h.observedAt)>=Date.now()-M.RETENTION)};error='';}catch{if(dead||revision!==turn)return;data=M.empty();error='Saved deadline changes could not be loaded. Try refreshing this list.';}loaded=true;onChange();}
  const unsubscribe=store.subscribeDeadlineChanges?.(()=>void reload())||(()=>{});
  const summary=()=>({loaded,error,count:data.history.filter(h=>!h.read).length,total:data.history.length});
  const when=value=>{if(value===null)return 'No due date';try{return new Intl.DateTimeFormat(undefined,{timeZone:getTimeZone(),year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));}catch{return new Date(value).toLocaleString();}};
  function fill(){
   dialog.replaceChildren();const heading=node('h2','Deadline changes');heading.setAttribute('id','rd-deadline-title');dialog.append(heading,node('p','Changes observed during successful Canvas refreshes. The first refresh establishes a baseline. Up to 100 changes from the past 30 days are kept on this device.'));
   if(error){dialog.append(node('p',error));const retry=node('button','Try again','rd-button');retry.type='button';listen(retry,'click',async()=>{await reload();if(!dead){fill();dialog.querySelector('[data-deadline-close]')?.focus();}});dialog.append(retry);}
   else if(!data.history.length)dialog.append(node('p',data.observedAt?'No deadline changes observed yet.':'Refresh Canvas to start tracking deadline changes.'));
   else{const list=node('ul',undefined,'rd-deadline-list');for(const change of data.history){const item=node('li',undefined,'rd-deadline-entry'),title=node('a',change.title);title.href=store.owner.origin+'/courses/'+change.courseId+'/assignments/'+change.assignmentId;title.target='_blank';title.rel='noopener noreferrer';item.append(node('p',change.course+(change.read?'':' · New'),'rd-deadline-course'),title,node('p','Previously: '+when(change.before)),node('p','Now: '+when(change.after)),node('small','Observed '+when(change.observedAt)));list.append(item);}dialog.append(list);}
   const actions=node('div',undefined,'rd-deadline-actions'),ids=data.history.filter(h=>!h.read).map(h=>h.id);
   if(ids.length&&!error){const mark=node('button','Mark shown changes as read','rd-button');mark.type='button';listen(mark,'click',async()=>{mark.disabled=true;try{await store.updateDeadlineChanges(raw=>M.acknowledge(raw,ids));await reload();if(!dead){fill();dialog.querySelector('[data-deadline-close]')?.focus();}}catch{mark.disabled=false;mark.textContent='Could not save. Try again.';}});actions.append(mark);}
   const close=node('button','Close','rd-button');close.type='button';close.dataset.deadlineClose='true';listen(close,'click',()=>dialog.close());actions.append(close);dialog.append(actions);
  }
  function open(button){if(dead)return;trigger=button;if(!dialog){dialog=node('dialog',undefined,'rd-utility-dialog rd-deadline-dialog');dialog.setAttribute('aria-labelledby','rd-deadline-title');listen(dialog,'keydown',event=>event.stopPropagation());listen(dialog,'cancel',event=>event.stopPropagation());listen(dialog,'close',()=>trigger?.isConnected&&trigger.focus());container.append(dialog);}fill();if(!dialog.open)dialog.showModal();dialog.querySelector('[data-deadline-close]')?.focus();}
  void reload();
  return {summary,open,destroy(){dead=true;turn++;unsubscribe();off.abort();dialog?.remove();}};
 }
 const api={record,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.ReserveDeadlineChanges=api;
})(globalThis);
