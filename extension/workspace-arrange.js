/* Canvas Harness's personal workspace arrangement; no Canvas data or artwork is changed here. */
(function(root){
 'use strict';
 const PANELS=['context','work','reader'];
 const LABELS={context:'Course information',work:'Up next',reader:'Assignment details',rail:'Courses'};
 function controls(key){
  if(!LABELS[key])return '';
  return `<span class="rd-arrange-tools"><button type="button" class="rd-arrange-grip" data-arrange-grip aria-label="Move ${LABELS[key]}" aria-describedby="rd-move-help" title="Hold to move · Space for keyboard"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5.5" r="1.4"/><circle cx="8.5" cy="12" r="1.4"/><circle cx="15.5" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="18.5" r="1.4"/></svg></button></span>`;
 }
 const DEFAULT={order:[...PANELS],mode:'side-by-side',layout:{axis:'x',children:[...PANELS]},courseNavigation:'sidebar',showCourseInformation:true,showCourseStrip:true};
 const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 // A split remembers spatial relationships: a column can contain two stacked
 // panels while its neighbour remains full height. Leaves stay in DOM reading order.
 const leaves=tree=>typeof tree==='string'?[tree]:(tree?.children||[]).flatMap(leaves);
 function split(axis,children){
  children=children.filter(Boolean).flatMap(node=>node?.axis===axis?node.children:[node]);
  return children.length===1?children[0]:children.length?{axis,children}:null;
 }
 function cleanLayout(tree){
  let count=0;
  function visit(node,depth=0){
   if(++count>8||depth>3)throw Error('Invalid workspaceLayout setting in backup.');
   if(typeof node==='string'&&PANELS.includes(node))return node;
   if(!isObject(node)||!['x','y'].includes(node.axis)||!Array.isArray(node.children)||node.children.length<2||node.children.length>3)throw Error('Invalid workspaceLayout setting in backup.');
   return split(node.axis,node.children.map(child=>visit(child,depth+1)));
  }
  const result=visit(tree),keys=leaves(result);
  if(keys.length!==3||new Set(keys).size!==3)throw Error('Invalid workspaceLayout setting in backup.');
  return result;
 }
 const prune=(tree,key)=>typeof tree==='string'?(tree===key?null:tree):split(tree.axis,tree.children.map(child=>prune(child,key)));
 function swap(tree,key,target){
  if(!PANELS.includes(key)||!PANELS.includes(target)||key===target)return tree;
  const visit=node=>typeof node==='string'?(node===key?target:node===target?key:node):{axis:node.axis,children:node.children.map(visit)};
  return visit(tree);
 }
 function dock(tree,key,target,edge){
  if(!PANELS.includes(key)||!PANELS.includes(target)||key===target||!['left','right','top','bottom'].includes(edge))return tree;
  const axis=['left','right'].includes(edge)?'x':'y',before=['left','top'].includes(edge);
  const insert=node=>node===target?split(axis,before?[key,target]:[target,key]):typeof node==='string'?node:split(node.axis,node.children.map(insert));
  return insert(prune(tree,key));
 }
 function grid(tree,width=1500){
  const rects={};
  function place(node,x,y,w,h,pixels){
   if(typeof node==='string'){rects[node]={x,y,w,h};return;}
   const axis=node.axis==='x'&&pixels/node.children.length<285?'y':node.axis,n=node.children.length;
   node.children.forEach((child,i)=>place(child,x+(axis==='x'?w*i/n:0),y+(axis==='y'?h*i/n:0),axis==='x'?w/n:w,axis==='y'?h/n:h,axis==='x'?pixels/n:pixels));
  }
  if(tree)place(tree,0,0,1,1,width);
  const round=n=>Math.round(n*10000)/10000;
  const xs=[...new Set(Object.values(rects).flatMap(r=>[round(r.x),round(r.x+r.w)]))].sort((a,b)=>a-b);
  const ys=[...new Set(Object.values(rects).flatMap(r=>[round(r.y),round(r.y+r.h)]))].sort((a,b)=>a-b);
  const cells=Object.fromEntries(Object.entries(rects).map(([key,r])=>[key,{column:`${xs.indexOf(round(r.x))+1} / ${xs.indexOf(round(r.x+r.w))+1}`,row:`${ys.indexOf(round(r.y))+1} / ${ys.indexOf(round(r.y+r.h))+1}`} ]));
  return {columns:xs.slice(1).map((x,i)=>`minmax(0,${round(x-xs[i])}fr)`).join(' '),rows:ys.slice(1).map(()=>'auto').join(' '),cells};
 }
 function edgeAt(rect,x,y){
  const dx=(x-rect.left)/rect.width,dy=(y-rect.top)/Math.max(60,rect.height);
  if(dx>.3&&dx<.7&&dy>.28&&dy<.72)return null;
  const distances={left:Math.abs(dx),right:Math.abs(1-dx),top:Math.abs(dy),bottom:Math.abs(1-dy)};
  return Object.keys(distances).sort((a,b)=>distances[a]-distances[b])[0];
 }
 function legacyOrder(settings={}){return settings.deskOrder==='work-first'?['work','reader','context']:[...PANELS];}
 function cleanOrder(value,{strict=false,fallback=PANELS}={}){
  if(value===undefined)return [...fallback];
  if(!Array.isArray(value)||strict&&(value.length!==PANELS.length||new Set(value).size!==PANELS.length)||value.some(key=>!PANELS.includes(key)))throw Error('Invalid workspaceOrder setting in backup.');
  return [...new Set(value.concat(PANELS))];
 }
 function snapshot(settings={}){
  const mode=settings.workspaceMode||((settings.deskOrder==='stacked'||settings.dashboardLayout==='list')?'stacked':'side-by-side');
  const layout=settings.workspaceLayout?cleanLayout(settings.workspaceLayout):split(mode==='stacked'?'y':'x',cleanOrder(settings.workspaceOrder,{fallback:legacyOrder(settings)}));
  return {
   order:leaves(layout),mode,layout,
   courseNavigation:settings.courseNavigation||DEFAULT.courseNavigation,
   showCourseInformation:settings.showCourseInformation!==false,
   showCourseStrip:settings.showCourseStrip!==false
  };
 }
 function cleanSnapshot(value){
  if(!isObject(value)||!['stacked','side-by-side'].includes(value.mode)||!['sidebar','topbar'].includes(value.courseNavigation)||typeof value.showCourseInformation!=='boolean'||typeof value.showCourseStrip!=='boolean')throw Error('Invalid workspaceUndo setting in backup.');
  const order=cleanOrder(value.order,{strict:true});
  return {order,mode:value.mode,layout:value.layout?cleanLayout(value.layout):split(value.mode==='stacked'?'y':'x',order),courseNavigation:value.courseNavigation,showCourseInformation:value.showCourseInformation,showCourseStrip:value.showCourseStrip,...(Array.isArray(value.courseOrder)?{courseOrder:value.courseOrder.filter(x=>typeof x==='string').slice(0,500)}:{})};
 }
 function cleanSaved(settings={}){
  const order=cleanOrder(settings.workspaceOrder,{strict:settings.workspaceOrder!==undefined,fallback:legacyOrder(settings)});
  const mode=settings.workspaceMode===undefined?(settings.deskOrder==='stacked'||settings.deskOrder===undefined&&settings.dashboardLayout==='list'?'stacked':'side-by-side'):settings.workspaceMode;
  if(!['stacked','side-by-side'].includes(mode))throw Error('Invalid workspaceMode setting in backup.');
  return {workspaceOrder:order,workspaceMode:mode,workspaceLayout:settings.workspaceLayout==null?null:cleanLayout(settings.workspaceLayout),workspaceUndo:settings.workspaceUndo==null?null:cleanSnapshot(settings.workspaceUndo)};
 }
 function relocate(order,key,target,position='before'){
  if(!PANELS.includes(key)||!PANELS.includes(target)||key===target||!['before','after'].includes(position))return [...order];
  const next=cleanOrder(order),from=next.indexOf(key);next.splice(from,1);
  next.splice(next.indexOf(target)+(position==='after'?1:0),0,key);
  return next;
 }
 function nextState(current,command){
  const next={...current,order:[...current.order]};
  switch(command?.type){
   case 'swap':next.layout=swap(current.layout,command.key,command.target);next.order=leaves(next.layout);break;
   case 'dock':next.layout=dock(current.layout,command.key,command.target,command.edge);next.order=leaves(next.layout);next.mode=next.layout.axis==='y'&&next.layout.children.every(n=>typeof n==='string')?'stacked':'side-by-side';break;
   case 'move':next.order=relocate(current.order,command.key,command.target,command.position);break;
   case 'shift':{
    const index=next.order.indexOf(command.key),to=index+command.delta;
    if(index<0||![-1,1].includes(command.delta)||to<0||to>=next.order.length)break;
    const [item]=next.order.splice(index,1);next.order.splice(to,0,item);break;
   }
   case 'mode':if(['stacked','side-by-side'].includes(command.value))next.mode=command.value;break;
   case 'navigation':if(['sidebar','topbar'].includes(command.value))next.courseNavigation=command.value;break;
   case 'hide-context':next.showCourseInformation=false;break;
   case 'restore-context':next.showCourseInformation=true;break;
   case 'reset':return {...DEFAULT,order:[...DEFAULT.order]};
  }
  if(['move','shift','mode'].includes(command?.type))next.layout=split(next.mode==='stacked'?'y':'x',next.order);
  return next;
 }
 function writeSnapshot(settings,state){
  settings.workspaceOrder=[...state.order];settings.workspaceMode=state.mode;
  settings.workspaceLayout=state.layout;
  if(state.courseOrder)settings.courseOrder=[...state.courseOrder];
  settings.courseNavigation=state.courseNavigation;settings.showCourseInformation=state.showCourseInformation;settings.showCourseStrip=state.showCourseStrip;
  // Keep older customization controls and backups coherent with a new arrangement.
  settings.deskOrder=state.mode==='stacked'?'stacked':same(state.order,['work','reader','context'])?'work-first':'context-first';
  settings.dashboardLayout=state.mode==='stacked'?'list':'split';
 }
 function change(settings,command){
  if(!settings||!isObject(settings))return false;
  const before=snapshot(settings);
  if(command?.type==='course-move'){
   const order=[...new Set([...(settings.courseOrder||[]),...(command.ids||[])].map(String))];
   const key=String(command.key),target=String(command.target);
   if(key===target||!order.includes(key)||!order.includes(target)||!['before','after'].includes(command.position))return false;
   const next=order.filter(id=>id!==key);next.splice(next.indexOf(target)+(command.position==='after'?1:0),0,key);
   if(same(order,next))return false;
   settings.workspaceUndo={...before,courseOrder:[...(settings.courseOrder||[])]};settings.courseOrder=next;return true;
  }
  if(command?.type==='undo'){
   if(!settings.workspaceUndo)return false;
   const previous=cleanSnapshot(settings.workspaceUndo);writeSnapshot(settings,previous);settings.workspaceUndo=null;return true;
  }
  const after=nextState(before,command);
  if(same(before,after))return false;
  writeSnapshot(settings,after);settings.workspaceUndo=before;
  return true;
 }
 function createController(options){
  const gestures=root.ReserveWorkspaceGestures||(typeof module==='object'&&module.exports?require('./workspace-gestures.js'):null);
  return gestures.create(options,api);
 }
 const api={PANELS,LABELS,DEFAULT,leaves,split,prune,dock,swap,grid,edgeAt,cleanLayout,controls,legacyOrder,cleanOrder,cleanSaved,snapshot,relocate,change,createController};
 root.ReserveWorkspaceArrange=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
