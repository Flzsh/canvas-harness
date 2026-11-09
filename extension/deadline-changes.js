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
  async function reload(){
    const revision=++turn;
    try{
      const next=M.clean(await store.readDeadlineChanges());
      if(dead||revision!==turn)return;
      data={...next,history:next.history.filter(h=>Date.parse(h.observedAt)>=Date.now()-M.RETENTION)};
      error='';
    }catch{if(dead||revision!==turn)return;data=M.empty();error='Saved deadline changes could not be loaded. Try refreshing this list.';}
    loaded=true;
    onChange();
  }
  const unsubscribe=store.subscribeDeadlineChanges?.(()=>void reload())||(()=>{});
  const summary=()=>({loaded,error,count:data.history.filter(h=>!h.read).length,total:data.history.length});
  const when=value=>{
    if(value===null)return 'No due date';
    const d=new Date(value),year=d.getFullYear()!==new Date().getFullYear();
    try{
      const tz=getTimeZone(),
        day=new Intl.DateTimeFormat(undefined,{timeZone:tz,weekday:'short',month:'short',day:'numeric',...(year?{year:'numeric'}:{})}).format(d),
        time=new Intl.DateTimeFormat(undefined,{timeZone:tz,hour:'numeric',minute:'2-digit'}).format(d);
      return day+' · '+time;
    }catch{return d.toLocaleString();}
  };
  const seen=value=>{try{return 'Seen '+new Intl.DateTimeFormat(undefined,{timeZone:getTimeZone(),month:'short',day:'numeric'}).format(new Date(value));}catch{return '';}};
  const courseName=name=>{const c=root.ReserveCore?.courseLabel?.(name);return c?[c.title,c.teacher].filter(Boolean).join(' · '):String(name||'');};
  function fill(){
   dialog.replaceChildren();
   const head=node('div',undefined,'rd-deadline-head'),heading=node('h2','Deadline changes');
   heading.setAttribute('id','rd-deadline-title');
   head.append(heading);
   const fresh=data.history.filter(h=>!h.read).length;
   if(fresh&&!error)head.append(node('span',fresh+' new','rd-deadline-new'));
   dialog.append(head);
   if(error){
     dialog.append(node('p',error));
     const retry=node('button','Try again','rd-button');
     retry.type='button';
     listen(retry,'click',async()=>{await reload();if(!dead){fill();dialog.querySelector('[data-deadline-close]')?.focus();}});
     dialog.append(retry);
   }
   else if(!data.history.length)dialog.append(node('p',data.observedAt?'No changes yet.':'Refresh Canvas to start.','rd-deadline-empty'));
   else{
     const list=node('ul',undefined,'rd-deadline-list');
     for(const change of data.history){
       const item=node('li',undefined,'rd-deadline-entry'),title=node('a',change.title);
       if(!change.read)item.dataset.unread='true';
       title.href=store.owner.origin+'/courses/'+change.courseId+'/assignments/'+change.assignmentId;
       title.target='_blank';
       title.rel='noopener noreferrer';
     const top=node('div',undefined,'rd-deadline-top');top.append(node('span',courseName(change.course),'rd-deadline-course'),node('small',seen(change.observedAt),'rd-deadline-seen'));
     const move=node('p',undefined,'rd-deadline-move'),
       from=node('span',when(change.before),'rd-deadline-from'),
       arrow=node('span','','rd-deadline-arrow'),
       to=node('span',when(change.after),'rd-deadline-to');
     arrow.setAttribute('aria-label','changed to');
     if(change.before===null)from.dataset.none='true';
     if(change.after===null)to.dataset.none='true';
     move.append(from,arrow,to);
     item.append(top,title,move);list.append(item);}dialog.append(list);}
   const actions=node('div',undefined,'rd-deadline-actions'),ids=data.history.filter(h=>!h.read).map(h=>h.id);
   if(ids.length&&!error){
     const mark=node('button','Mark all read','rd-button rd-deadline-mark');
     mark.type='button';
     listen(mark,'click',async()=>{
       mark.disabled=true;
       try{
         await store.updateDeadlineChanges(raw=>M.acknowledge(raw,ids));
         await reload();
         if(!dead){fill();dialog.querySelector('[data-deadline-close]')?.focus();}
       }catch{mark.disabled=false;mark.textContent='Could not save. Try again.';}
     });
     actions.append(mark);
   }
   const close=node('button','','rd-deadline-close');
   close.type='button';
   close.dataset.deadlineClose='true';
   close.setAttribute('aria-label','Close');
   close.title='Close';
   listen(close,'click',()=>dialog.close());
   if(ids.length&&!error)dialog.append(actions);
   dialog.append(close);
  }
  function open(button){
    if(dead)return;
    trigger=button;
    if(!dialog){
      dialog=node('dialog',undefined,'rd-utility-dialog rd-deadline-dialog');
      dialog.setAttribute('aria-labelledby','rd-deadline-title');
      listen(dialog,'keydown',event=>event.stopPropagation());
      listen(dialog,'cancel',event=>event.stopPropagation());
      listen(dialog,'close',()=>trigger?.isConnected&&trigger.focus());
      container.append(dialog);
    }
    fill();
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('[data-deadline-close]')?.focus();
  }
  void reload();
  return {summary,open,destroy(){dead=true;turn++;unsubscribe();off.abort();dialog?.remove();}};
 }
 const api={record,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.ReserveDeadlineChanges=api;
})(globalThis);
