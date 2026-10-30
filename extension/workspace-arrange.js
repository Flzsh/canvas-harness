/* Canvas Harness's personal workspace arrangement; no Canvas data or artwork is changed here. */
(function(root){
 'use strict';
 // The three panels every workspace has, and the modules a student may add beside them. The layout is one tree:
 // any module can sit beside or below any other. Up next and Assignment details always stay; the rest can go.
 const PANELS=['context','work','reader'];
 const EXTRA=['today','handin','week','timer','clock','notes','bookmarks','grades','messages','pet'];
 const ALL=[...PANELS,...EXTRA];
 const LABELS={
   context:'Course information',
   work:'Up next',
   reader:'Assignment details',
   rail:'Courses',
   today:'Today',
   handin:'To hand in',
   week:'This week',
   timer:'Focus timer',
   clock:'Clock',
   notes:'Notes',
   bookmarks:'Bookmarks',
   grades:'Grades',
   messages:'Messages',
   pet:'Paddock'
 };
 // How much of a row a module asks for beside its neighbours, and the narrowest it can usefully be.
 const WEIGHT={context:1,work:1.12,reader:1.12,today:.82,handin:.9,week:.95,timer:.58,clock:.58,notes:.8,bookmarks:.8,grades:.8,messages:.9,pet:.66};
 const MIN_WIDTH={context:260,work:300,reader:300,today:220,handin:230,week:250,timer:170,clock:170,notes:210,bookmarks:210,grades:210,messages:230,pet:190};
 const isKey=key=>ALL.includes(key),isExtra=key=>EXTRA.includes(key),label=key=>LABELS[key]||'';
 const removable=key=>EXTRA.includes(key)||key==='context';
 const ROOT='*',SIZES={s:.68,m:1,l:1.5};
 function controls(key){
  if(!LABELS[key]||root.ReserveFeatures?.enabled('arrange')===false)return '';
  return `<span class="rd-arrange-tools"><button type="button" class="rd-arrange-grip" data-arrange-grip aria-label="Move ${LABELS[key]}" aria-describedby="rd-move-help" title="Hold to move · Space for keyboard"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5.5" r="1.4"/><circle cx="8.5" cy="12" r="1.4"/><circle cx="15.5" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="18.5" r="1.4"/></svg></button>${(PANELS.includes(key)||EXTRA.includes(key))&&root.ReserveFeatures?.enabled('planner')!==false?`<button type="button" class="rd-arrange-more" data-rd-action="module-menu" data-widget="${key}" aria-haspopup="menu" aria-label="${LABELS[key]}: size and place" title="Size and place"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12.3" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg></button>`:''}${EXTRA.includes(key)?`<button type="button" class="rd-arrange-remove" data-rd-action="widget-remove" data-widget="${key}" aria-label="Remove ${LABELS[key]} from Home" title="Remove from Home"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 7.4l10 9.4M17 7l-10 10.2"/></svg></button>`:''}</span>`;
 }
 const DEFAULT={order:[...PANELS],mode:'side-by-side',layout:{axis:'x',children:[...PANELS]},courseNavigation:'sidebar',dockSize:'medium',showCourseInformation:true,showCourseStrip:true};
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
   if(++count>40||depth>5)throw Error('Invalid workspaceLayout setting in backup.');
   if(typeof node==='string'&&ALL.includes(node))return node;
   if(!isObject(node)||!['x','y'].includes(node.axis)||!Array.isArray(node.children)||node.children.length<2||node.children.length>ALL.length)throw Error('Invalid workspaceLayout setting in backup.');
   return split(node.axis,node.children.map(child=>visit(child,depth+1)));
  }
  const result=visit(tree),keys=leaves(result);
  if(new Set(keys).size!==keys.length||PANELS.some(key=>!keys.includes(key)))throw Error('Invalid workspaceLayout setting in backup.');
  return result;
 }
 const prune=(tree,key)=>typeof tree==='string'?(tree===key?null:tree):split(tree.axis,tree.children.map(child=>prune(child,key)));
 function swap(tree,key,target){
  if(!ALL.includes(key)||!ALL.includes(target)||key===target)return tree;
  const visit=node=>typeof node==='string'?(node===key?target:node===target?key:node):{axis:node.axis,children:node.children.map(visit)};
  return visit(tree);
 }
 function dock(tree,key,target,edge){
  if(!ALL.includes(key)||!(ALL.includes(target)||target===ROOT)||key===target||!['left','right','top','bottom'].includes(edge))return tree;
  const axis=['left','right'].includes(edge)?'x':'y',before=['left','top'].includes(edge);
  if(target===ROOT){const rest=prune(tree,key);return rest?split(axis,before?[key,rest]:[rest,key]):tree;}
  const insert=node=>node===target?split(axis,before?[key,target]:[target,key]):typeof node==='string'?node:split(node.axis,node.children.map(insert));
  return insert(prune(tree,key));
 }
 // What a subtree asks for: side by side adds up, stacked takes its widest. A module's chosen size scales its share.
 const weightOf=(node,sizes={})=>
   typeof node==='string'?
     (WEIGHT[node]||1)*(SIZES[sizes[node]]||1):
     node.axis==='x'?node.children.reduce((n,child)=>n+weightOf(child,sizes),0):Math.max(...node.children.map(child=>weightOf(child,sizes)));
 const minOf=node=>typeof node==='string'?(MIN_WIDTH[node]||240):node.axis==='x'?node.children.reduce((n,child)=>n+minOf(child),0):Math.max(...node.children.map(minOf));
 // The tree as it is laid out at a width: a row that cannot give each module its narrowest useful width wraps, as
 // many as fit staying side by side and the rest going to the next row.
 function resolve(node,pixels,sizes={}){
  if(typeof node==='string'||!node)return node;
  if(node.axis==='y')return {axis:'y',children:node.children.map(child=>resolve(child,pixels,sizes))};
  if(pixels<minOf(node)){
   const rows=[];let row=[],sum=0;
   for(const child of node.children){const need=minOf(child);if(row.length&&sum+need>pixels){rows.push(row);row=[];sum=0;}row.push(child);sum+=need;}
   rows.push(row);
   if(rows.length>1)return {axis:'y',children:rows.map(r=>resolve(r.length===1?r[0]:{axis:'x',children:r},pixels,sizes))};
   if(node.children.length===1)return resolve(node.children[0],pixels,sizes);
  }
  const weights=node.children.map(child=>weightOf(child,sizes)),total=weights.reduce((a,b)=>a+b,0);
  return {axis:'x',children:node.children.map((child,i)=>resolve(child,pixels*weights[i]/total,sizes))};
 }
 function grid(tree,width=1500,sizes={}){
  const rects={},resolved=tree?resolve(tree,width,sizes):null;
  function place(node,x,y,w,h){
   if(typeof node==='string'){rects[node]={x,y,w,h};return;}
   const n=node.children.length,weights=node.children.map(child=>weightOf(child,sizes)),total=weights.reduce((a,b)=>a+b,0);let used=0;
   node.children.forEach((child,i)=>{const share=node.axis==='x'?weights[i]/total:1/n;
    place(child,x+(node.axis==='x'?w*used:0),y+(node.axis==='y'?h*i/n:0),node.axis==='x'?w*share:w,node.axis==='y'?h/n:h);used+=share;});
  }
  if(resolved)place(resolved,0,0,1,1);
  const round=n=>Math.round(n*10000)/10000;
  const xs=[...new Set(Object.values(rects).flatMap(r=>[round(r.x),round(r.x+r.w)]))].sort((a,b)=>a-b);
  const ys=[...new Set(Object.values(rects).flatMap(r=>[round(r.y),round(r.y+r.h)]))].sort((a,b)=>a-b);
  const cells=Object.fromEntries(Object.entries(rects).map(([key,r])=>
    [key,{column:`${xs.indexOf(round(r.x))+1} / ${xs.indexOf(round(r.x+r.w))+1}`,row:`${ys.indexOf(round(r.y))+1} / ${ys.indexOf(round(r.y+r.h))+1}`} ]));
  return {
    columns:xs.slice(1).map((x,i)=>`minmax(0,${round(x-xs[i])}fr)`).join(' '),
    rows:ys.slice(1).map(()=>'auto').join(' '),
    fitRows:ys.slice(1).map((y,i)=>`minmax(0,${round(y-ys[i])}fr)`).join(' '),
    cells,
    resolved
  };
 }
 // Rows from real heights. Each module starts where the things above it in its own stack end, so a short module
 // beside a tall one never leaves a hole under itself. Heights are in pixels; rows are counted in `unit` pixels.
 function rows(resolved,heights,{gap=18,unit=6,slack=240}={}){
  const out={},fill={};
  const natural=node=>
    typeof node==='string'?Math.max(0,heights[node]||0):node.axis==='y'?node.children.reduce((n,child,i)=>n+natural(child)+(i?gap:0),0):Math.max(0,...node.children.map(natural));
  // `room` is the height of the row a node sits in. The last module of a stack that ends a little short of its
  // neighbours takes up the difference, so a row of modules ends on one line; a much shorter one keeps its height.
  function place(node,top,room){
   if(typeof node==='string'){
     const h=natural(node),grow=room-h;
     out[node]={top,height:grow>0&&grow<=slack&&h>0?room:h};
     if(grow>0&&grow<=slack&&h>0)fill[node]=Math.round(room);
     return;
   }
   if(node.axis==='y'){
     let y=top;
     node.children.forEach((child,i)=>{const last=i===node.children.length-1,h=natural(child);place(child,y,last?Math.max(h,room-(y-top)):h);y+=h+gap;});
     return;
   }
   const h=Math.max(natural(node),room);for(const child of node.children)place(child,top,h);
  }
  const total=resolved?natural(resolved):0;if(resolved)place(resolved,0,total);
  const cells=Object.fromEntries(Object.entries(out).map(([key,r])=>[key,`${Math.round(r.top/unit)+1} / span ${Math.max(1,Math.ceil(r.height/unit))}`]));
  return {cells,fill,total,unit};
 }
 // Added modules live in the tree only; the saved order names the three original panels, as it always has.
 const core=keys=>keys.filter(key=>PANELS.includes(key));
 const extras=tree=>leaves(tree).filter(key=>EXTRA.includes(key));
 // Rebuilding the three panels (a preset, the older Before/After commands) keeps added modules in a row above them.
 function withExtras(tree,previous){
  const kept=extras(previous);
  return kept.length?split('y',[split('x',kept),tree]):tree;
 }
 // Where a new module goes when it is not dropped somewhere: into the row of added modules across the top if there
 // is room, otherwise a new row above everything.
 function add(tree,key){
  if(!EXTRA.includes(key)||leaves(tree).includes(key))return tree;
  const top=tree?.axis==='y'?tree.children[0]:null,row=top&&leaves(top).every(k=>EXTRA.includes(k))?top:null;
  if(row&&leaves(row).length<4&&(typeof row==='string'||row.axis==='x'))return {axis:'y',children:[split('x',[row,key]),...tree.children.slice(1)]};
  return split('y',[key,tree]);
 }
 function edgeAt(rect,x,y){
  const dx=(x-rect.left)/rect.width,dy=(y-rect.top)/Math.max(60,rect.height);
  if(dx>.3&&dx<.7&&dy>.28&&dy<.72)return null;
  const distances={left:Math.abs(dx),right:Math.abs(1-dx),top:Math.abs(dy),bottom:Math.abs(1-dy)};
  return Object.keys(distances).sort((a,b)=>distances[a]-distances[b])[0];
 }
 function legacyOrder(settings={}){return ['work-first','stacked'].includes(settings.deskOrder)?['work','reader','context']:[...PANELS];}
 function cleanOrder(value,{strict=false,fallback=PANELS}={}){
  if(value===undefined)return [...fallback];
  if(!Array.isArray(value)||strict&&(value.length!==PANELS.length||new Set(value).size!==PANELS.length)||value.some(key=>!PANELS.includes(key)))throw Error('Invalid workspaceOrder setting in backup.');
  return [...new Set(value.concat(PANELS))];
 }
 function snapshot(settings={}){
  const mode=settings.workspaceMode||((settings.deskOrder==='stacked'||settings.dashboardLayout==='list')?'stacked':'side-by-side');
  const layout=settings.workspaceLayout?
    cleanLayout(settings.workspaceLayout):
    split(mode==='stacked'?'y':'x',cleanOrder(settings.workspaceOrder,{fallback:legacyOrder(settings)}));
  return {
   order:leaves(layout),mode,layout,
   courseNavigation:settings.courseNavigation||DEFAULT.courseNavigation,
   dockSize:settings.dockSize===undefined?DEFAULT.dockSize:settings.dockSize,
   showCourseInformation:settings.showCourseInformation!==false,
   showCourseStrip:settings.showCourseStrip!==false
  };
 }
 function cleanSnapshot(value){
  if(!isObject(value)||
    !['stacked','side-by-side'].includes(value.mode)||
    !['sidebar','topbar','dock'].includes(value.courseNavigation)||
    value.dockSize!==undefined&&!['small','medium','large'].includes(value.dockSize)||
    typeof value.showCourseInformation!=='boolean'||
    typeof value.showCourseStrip!=='boolean')
    throw Error('Invalid workspaceUndo setting in backup.');
  if(!Array.isArray(value.order)||new Set(value.order).size!==value.order.length||value.order.some(key=>!ALL.includes(key)))throw Error('Invalid workspaceOrder setting in backup.');
  const order=cleanOrder(core(value.order),{strict:true});
  return {
    order:value.layout?leaves(cleanLayout(value.layout)):order,
    mode:value.mode,
    layout:value.layout?cleanLayout(value.layout):split(value.mode==='stacked'?'y':'x',order),
    courseNavigation:value.courseNavigation,
    dockSize:value.dockSize===undefined?DEFAULT.dockSize:value.dockSize,
    showCourseInformation:value.showCourseInformation,
    showCourseStrip:value.showCourseStrip,
    ...(Array.isArray(value.courseOrder)?{courseOrder:value.courseOrder.filter(x=>typeof x==='string').slice(0,500)}:{})
  };
 }
 function cleanSizes(value){
  if(value===undefined||value===null)return {};
  if(!isObject(value))throw Error('Invalid moduleSize setting in backup.');
  const out={};for(const [key,size] of Object.entries(value)){if(!ALL.includes(key)||!Object.hasOwn(SIZES,size))throw Error('Invalid moduleSize setting in backup.');if(size!=='m')out[key]=size;}
  return out;
 }
 function cleanSaved(settings={}){
  const order=cleanOrder(settings.workspaceOrder,{strict:settings.workspaceOrder!==undefined,fallback:legacyOrder(settings)});
  const mode=settings.workspaceMode===undefined?(settings.deskOrder==='stacked'||settings.deskOrder===undefined&&settings.dashboardLayout==='list'?'stacked':'side-by-side'):settings.workspaceMode;
  if(!['stacked','side-by-side'].includes(mode))throw Error('Invalid workspaceMode setting in backup.');
  return {
    moduleSize:cleanSizes(settings.moduleSize),
    workspaceOrder:order,
    workspaceMode:mode,
    workspaceLayout:settings.workspaceLayout==null?null:cleanLayout(settings.workspaceLayout),
    workspaceUndo:settings.workspaceUndo==null?null:cleanSnapshot(settings.workspaceUndo)
  };
 }
 // A preset or the panel-order choice lays the three panels out afresh; modules a student added keep their row.
 function resetCore(settings,previous){
  settings.workspaceLayout=null;settings.workspaceOrder=legacyOrder(settings);settings.workspaceMode=settings.deskOrder==='stacked'?'stacked':'side-by-side';
  const kept=previous?extras(previous):[];
  if(kept.length)settings.workspaceLayout=withExtras(snapshot(settings).layout,previous);
 }
 function relocate(order,key,target,position='before'){
  if(!PANELS.includes(key)||!PANELS.includes(target)||key===target||!['before','after'].includes(position))return [...order];
  const next=cleanOrder(core(order)),from=next.indexOf(key);next.splice(from,1);
  next.splice(next.indexOf(target)+(position==='after'?1:0),0,key);
  return next;
 }
 function nextState(current,command){
  const next={...current,order:[...current.order]};
  switch(command?.type){
   case 'swap':next.layout=swap(current.layout,command.key,command.target);next.order=leaves(next.layout);break;
   case 'dock':
     next.layout=dock(current.layout,command.key,command.target,command.edge);
     next.order=leaves(next.layout);
     next.mode=next.layout.axis==='y'&&next.layout.children.every(n=>typeof n==='string')?'stacked':'side-by-side';
     break;
   case 'move':next.order=relocate(current.order,command.key,command.target,command.position);break;
   case 'add':
     next.layout=add(current.layout,command.key);
     if(command.target&&command.edge)next.layout=dock(next.layout,command.key,command.target,command.edge);
     next.order=leaves(next.layout);
     break;
   case 'remove':
     if(EXTRA.includes(command.key)&&leaves(current.layout).includes(command.key)){next.layout=prune(current.layout,command.key);next.order=leaves(next.layout);}
     break;
   case 'shift':{
    next.order=core(next.order);
    const index=next.order.indexOf(command.key),to=index+command.delta;
    if(index<0||![-1,1].includes(command.delta)||to<0||to>=next.order.length)break;
    const [item]=next.order.splice(index,1);next.order.splice(to,0,item);break;
   }
   case 'mode':if(['stacked','side-by-side'].includes(command.value))next.mode=command.value;break;
   case 'navigation':if(['sidebar','topbar','dock'].includes(command.value))next.courseNavigation=command.value;break;
   case 'hide-context':next.showCourseInformation=false;break;
   case 'restore-context':next.showCourseInformation=true;break;
   case 'reset':return {...DEFAULT,order:[...DEFAULT.order]};
  }
  if(['move','shift','mode'].includes(command?.type)){next.layout=withExtras(split(next.mode==='stacked'?'y':'x',core(next.order)),current.layout);next.order=leaves(next.layout);}
  return next;
 }
 function writeSnapshot(settings,state){
  settings.workspaceOrder=core(state.order);settings.workspaceMode=state.mode;
  settings.workspaceLayout=state.layout;
  if(state.courseOrder)settings.courseOrder=[...state.courseOrder];
  settings.courseNavigation=state.courseNavigation;
  settings.dockSize=state.dockSize;
  settings.showCourseInformation=state.showCourseInformation;
  settings.showCourseStrip=state.showCourseStrip;
  // Keep older customization controls and backups coherent with a new arrangement.
  settings.deskOrder=state.mode==='stacked'?'stacked':same(core(state.order),['work','reader','context'])?'work-first':'context-first';
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
 const api={
   isKey,
   isExtra,
   label,
   PANELS,
   EXTRA,
   ALL,
   ROOT,
   SIZES,
   LABELS,
   WEIGHT,
   MIN_WIDTH,
   removable,
   extras,
   add,
   resetCore,
   resolve,
   rows,
   cleanSizes,
   DEFAULT,
   leaves,
   split,
   prune,
   dock,
   swap,
   grid,
   edgeAt,
   cleanLayout,
   controls,
   legacyOrder,
   cleanOrder,
   cleanSaved,
   snapshot,
   relocate,
   change,
   createController
 };
 root.ReserveWorkspaceArrange=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
