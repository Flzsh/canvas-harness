/* Canvas Harness's personal workspace arrangement; no Canvas data or artwork is changed here. */
(function(root){
 'use strict';
 // The three panels every workspace has, and the modules a student may add beside them. The layout is one tree:
 // any module can sit beside or below any other. Up next and Assignment details always stay; the rest can go.
 const PANELS=['context','work','reader'];
 const EXTRA=['handin','week','timer','clock','notes','bookmarks','grades','impact','messages','pet','review'];
 // Help (the daily AI help band) is a module too since 4.2: placed, sized and taken off like the others. Until a student
 // moves it, it is not in the saved layout and sits where the band always sat, on top across the whole width (drawn()).
 const HELP='help';
 const ALL=[...PANELS,...EXTRA,HELP];
 const LABELS={
   context:'Course information',
   work:'Up next',
   reader:'Assignment details',
   rail:'Courses',
   handin:'To hand in',
   help:'Help',
   week:'This week',
   timer:'Focus timer',
   clock:'Clock',
   notes:'Notes',
   bookmarks:'Bookmarks',
   grades:'Grades',
   impact:'Grade impact',
   messages:'Messages',
   pet:'Paddock',
   review:'Review'
 };
 // How much of a row a module asks for beside its neighbours, and the narrowest it can usefully be.
 const WEIGHT={context:1,work:1.12,reader:1.12,help:1.5,week:.95,timer:.58,clock:.58,notes:.8,bookmarks:.8,grades:.8,impact:1.05,messages:.9,pet:.66,review:1};
 const MIN_WIDTH={context:260,work:300,reader:300,help:400,week:250,timer:170,clock:170,notes:210,bookmarks:210,grades:210,impact:240,messages:230,pet:190,review:260};
 const dynamic=key=>typeof key==='string'&&/^ai-[A-Za-z0-9_-]{1,36}$/.test(key),
   isKey=key=>ALL.includes(key)||dynamic(key),
   isExtra=key=>EXTRA.includes(key)||key===HELP||dynamic(key),
   label=key=>LABELS[key]||(dynamic(key)?'Your AI':'');
 const removable=key=>isExtra(key)||key==='context';
 const ROOT='*',SIZES={s:.68,m:1,l:1.5},STEPS=['s','m','l'];
 // The owner's open question (4.0.165): is picking a width a step of its own for Undo move? NOT decided; this one line is the
 // switch. false (as since 4.0.165): a width is not a step; Undo move takes back the last move, with the widths Home had then.
 // true: every width picked (menu, edge, corner, keyboard) is a step, and Undo move first takes back that width.
 const WIDTH_IS_UNDO_STEP=false;
 function controls(key){
  if(!LABELS[key]||root.ReserveFeatures?.enabled('arrange')===false)return '';
  return `<span class="rd-arrange-tools"><button type="button" class="rd-arrange-grip" data-arrange-grip aria-label="Move ${LABELS[key]}" aria-describedby="rd-move-help" title="Hold to move · Space for keyboard"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5.5" r="1.4"/><circle cx="8.5" cy="12" r="1.4"/><circle cx="15.5" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="18.5" r="1.4"/></svg></button>${(PANELS.includes(key)||EXTRA.includes(key)||key===HELP)&&root.ReserveFeatures?.enabled('planner')!==false?`<button type="button" class="rd-arrange-more" data-rd-action="module-menu" data-widget="${key}" aria-haspopup="menu" aria-label="${LABELS[key]}: size and place" title="Size and place"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12.3" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg></button>`:''}${EXTRA.includes(key)||key===HELP?`<button type="button" class="rd-arrange-remove" data-rd-action="widget-remove" data-widget="${key}" aria-label="Remove ${LABELS[key]} from Home" title="Remove from Home"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 7.4l10 9.4M17 7l-10 10.2"/></svg></button>`:''}</span>`;
 }
 const DEFAULT={
   order:[...PANELS],
   mode:'side-by-side',
   layout:{axis:'x',children:[...PANELS]},
   courseNavigation:'sidebar',
   dockSize:'medium',
   showCourseInformation:true,
   showCourseStrip:true,
   showHelp:true
 };
 const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 // A split remembers spatial relationships: a column can contain two stacked
 // panels while its neighbour remains full height. Leaves stay in DOM reading order.
 const leaves=tree=>typeof tree==='string'?[tree]:(tree?.children||[]).flatMap(leaves);
 function split(axis,children){
  children=children.filter(Boolean).flatMap(node=>node?.axis===axis?node.children:[node]);
  return children.length===1?children[0]:children.length?{axis,children}:null;
 }
 // Each move beside or below another module can nest the layout one level, so a real arrangement of every module
 // (14, plus 3 AI modules) can be 16 levels deep; 40 nodes in all bounds any backup. (A limit of 5 levels refused
 // real arrangements: the drop was not saved and Home snapped back.)
 function cleanLayout(tree){
  let count=0;
  function visit(node,depth=0){
   if(++count>40||depth>20)throw Error('Invalid workspaceLayout setting in backup.');
   if(node==='today')return null; // Retired Home module; collapse its split without moving its neighbours.
   if(typeof node==='string'&&isKey(node))return node;
   if(!isObject(node)||!['x','y'].includes(node.axis)||!Array.isArray(node.children)||node.children.length<2||node.children.length>ALL.length+4)throw Error('Invalid workspaceLayout setting in backup.');
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
 // The narrowest a subtree can be: side by side its modules' narrowest widths and the gaps between them (until 4.0.194 the gaps
 // were left out, so a row "fitted" that was up to three gaps too wide and its modules were squeezed below their width).
 const minOf=(node,gap=0)=>
   typeof node==='string'?
     (MIN_WIDTH[node]||240):
     node.axis==='x'?node.children.reduce((n,child)=>n+minOf(child,gap),0)+gap*(node.children.length-1):Math.max(...node.children.map(child=>minOf(child,gap)));
 // A row's width shared out in pixels: each module its weighted share of the room left after the gaps, but never less
 // than its narrowest useful width (a Narrow module stops there; its neighbours give up the difference).
 function shares(children,room,sizes={},gap=0){
  const weights=children.map(child=>weightOf(child,sizes)),mins=children.map(child=>minOf(child,gap)),out=new Array(children.length).fill(null);
  let left=Math.max(0,room-gap*(children.length-1));
  if(mins.reduce((a,b)=>a+b,0)>left+.5){const total=weights.reduce((a,b)=>a+b,0)||1;return weights.map(w=>left*w/total);}
  for(let changed=true;changed;){changed=false;const open=out.map((v,i)=>v===null?i:-1).filter(i=>i>=0),total=open.reduce((n,i)=>n+weights[i],0)||1;
   for(const i of open){const w=left*weights[i]/total;if(w<mins[i]){out[i]=mins[i];changed=true;}}
   if(changed)left=Math.max(0,room-gap*(children.length-1)-out.reduce((n,v)=>n+(v||0),0));else for(const i of open)out[i]=left*weights[i]/total;}
  return out;
 }
 // A row too narrow for all its modules is broken into the fewest rows that fit, as even as they can be (until 4.0.194 it kept as
 // many as fitted on the first row and left the last module alone on a row of its own, stretched across the page).
 function wrapRows(children,pixels,gap=0){
  const need=children.map(child=>minOf(child,gap)),n=children.length,cost=(a,b)=>need.slice(a,b).reduce((x,y)=>x+y,0)+gap*(b-a-1);
  for(let k=2;k<=n;k++){
   // best[i][j]: the widest row's need when the first i modules make j rows; the narrowest such widest row wins, and of two
   // as even, the one with more on the earlier rows (as the student's own row reads, left to right)
   const best=Array.from({length:n+1},()=>new Array(k+1).fill(Infinity)),cut=Array.from({length:n+1},()=>new Array(k+1).fill(0));best[0][0]=0;
   for(let j=1;j<=k;j++)for(let i=j;i<=n;i++)for(let a=j-1;a<i;a++){const v=Math.max(best[a][j-1],cost(a,i));if(v<=best[i][j]){best[i][j]=v;cut[i][j]=a;}}
   if(best[n][k]<=pixels){const rows=[];for(let i=n,j=k;j>0;j--){const a=cut[i][j];rows.unshift(children.slice(a,i));i=a;}return rows;}
  }
  return children.map(child=>[child]);
 }
 // The tree as it is laid out at a width: a row that cannot give each module its narrowest useful width wraps into as
 // few rows as fit. Nothing here is saved: at a wider window the student's own arrangement comes back as it was.
 function resolve(node,pixels,sizes={},gap=0){
  if(typeof node==='string'||!node)return node;
  if(node.axis==='y')return {axis:'y',children:node.children.map(child=>resolve(child,pixels,sizes,gap))};
  if(pixels<minOf(node,gap)){
   const rows=wrapRows(node.children,pixels,gap);
   if(rows.length>1)return {axis:'y',children:rows.map(r=>resolve(r.length===1?r[0]:{axis:'x',children:r},pixels,sizes,gap))};
   if(node.children.length===1)return resolve(node.children[0],pixels,sizes,gap);
  }
  const widths=shares(node.children,pixels,sizes,gap);
  return {axis:'x',children:node.children.map((child,i)=>resolve(child,widths[i],sizes,gap))};
 }
 // The desk is one CSS grid. Every module's box is worked out in pixels, gaps included, then the grid's columns are cut
 // where the boxes' edges fall. (until 4.0.194 the boxes were fractions of the desk and every edge of every row became a column with a
 // gap of its own, so a module's width depended on how many edges of OTHER rows fell inside it: picking Wide for a module
 // in one row, or moving one, changed the widths of the modules in the rows below, by 30 px and more.) Edges of different
 // rows that fall closer than a gap are cut once, where they meet, and each module is set to its own box inside its columns by
 // a few pixels of margin (`inset`, left and right): what is drawn is exactly the module's share of its own row.
 function grid(tree,width=1500,sizes={},gap=0){
  const rects={},resolved=tree?resolve(tree,width,sizes,gap):null,W=Math.max(1,width);
  function place(node,x,y,w,h){
   if(typeof node==='string'){rects[node]={x,y,w,h};return;}
   const n=node.children.length,widths=node.axis==='x'?shares(node.children,w,sizes,gap):null;let at=x;
   node.children.forEach((child,i)=>{if(node.axis==='x'){place(child,at,y,widths[i],h);at+=widths[i]+gap;}else place(child,x,y+h*i/n,w,h/n);});
  }
  if(resolved)place(resolved,0,0,W,1);
  const round=n=>Math.round(n*10000)/10000;
  // the column lines: where a box ends (its right edge, unless it is the desk's), the next one starting a gap later
  const ends=[...new Set(Object.values(rects).map(r=>r.x+r.w).filter(e=>e<W-.5))].sort((a,b)=>a-b),lines=[];
  for(const e of ends){const last=lines.at(-1);if(last&&e-last.at<gap+8){last.sum+=e;last.n++;last.at=last.sum/last.n;}else lines.push({at:e,sum:e,n:1});}
  const line=edge=>{let best=-1,d=Infinity;lines.forEach((l,i)=>{const v=Math.abs(l.at-edge);if(v<d){d=v;best=i;}});return best;};
  const startLine=r=>r.x<.5?1:line(r.x-gap)+2,endLine=r=>r.x+r.w>W-.5?lines.length+2:line(r.x+r.w)+2;
  const tracks=[];let from=0;for(const l of lines){tracks.push(Math.max(1,l.at-from));from=l.at+gap;}tracks.push(Math.max(1,W-from));
  const ys=[...new Set(Object.values(rects).flatMap(r=>[round(r.y),round(r.y+r.h)]))].sort((a,b)=>a-b);
  const lineAt=n=>n<=1?0:n>lines.length+1?W:lines[n-2].at,px=n=>Math.round(n*10)/10;
  const cells=Object.fromEntries(Object.entries(rects).map(([key,r])=>{const a=startLine(r),b=endLine(r),from=a<=1?0:lineAt(a)+gap,to=lineAt(b);
   return [key,{column:`${a} / ${b}`,row:`${ys.indexOf(round(r.y))+1} / ${ys.indexOf(round(r.y+r.h))+1}`,inset:[px(r.x-from),px(to-(r.x+r.w))]}];}));
  // (each column's share of the room left after the gaps: shares that add up to less than 1 fr would leave the rest of the
  // desk empty, as CSS grid gives a total under 1 fr only that part of the free space)
  const room=tracks.reduce((a,b)=>a+b,0)||1;
  return {
    columns:Object.keys(rects).length?tracks.map(t=>`minmax(0,${round(t/room)}fr)`).join(' '):'',
    rows:ys.slice(1).map(()=>'auto').join(' '),
    fitRows:ys.slice(1).map((y,i)=>`minmax(0,${round(y-ys[i])}fr)`).join(' '),
    cells,
    resolved,
    boxes:rects
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
 // Help's place is kept beside the layout, as the layout with Help in it (settings.helpLayout); workspaceLayout never names
 // Help, because a build before 4.2 knows no Help module and refuses to load a record whose layout names one. A helpLayout
 // that no longer matches the layout (changed meanwhile in such a build) is let go: Help is then drawn where it always was.
 const strip=tree=>tree&&leaves(tree).includes(HELP)?prune(tree,HELP):tree;
 function placed(value,layout){
   if(value==null)return null;
   let tree;
   try{tree=cleanLayout(value);}catch{return null;}
   return leaves(tree).includes(HELP)&&same(strip(tree),layout)?tree:null;
 }
 // the same arrangement as it is saved: the layout without Help, and Help's place beside it while it has one
 function stored(state){
   const layout=strip(state.layout),help=leaves(state.layout).includes(HELP)?state.layout:null,{helpLayout:_,...rest}=state;
   return {...rest,order:leaves(layout),layout,...(help?{helpLayout:help}:{})};
 }
 const undoCopy=state=>stored(state);
 // The layout as Home draws it: Help on top across the whole width while it is shown and has no place of its own yet.
 function drawn(settings={}){const layout=snapshot(settings).layout;return settings.showHelp!==false&&!leaves(layout).includes(HELP)?split('y',[HELP,layout]):layout;}
 function legacyOrder(settings={}){return ['work-first','stacked'].includes(settings.deskOrder)?['work','reader','context']:[...PANELS];}
 function cleanOrder(value,{strict=false,fallback=PANELS}={}){
  if(value===undefined)return [...fallback];
  if(Array.isArray(value))value=value.filter(key=>key!=='today');
  if(!Array.isArray(value)||strict&&(value.length!==PANELS.length||new Set(value).size!==PANELS.length)||value.some(key=>!PANELS.includes(key)))throw Error('Invalid workspaceOrder setting in backup.');
  return [...new Set(value.concat(PANELS))];
 }
 function snapshot(settings={}){
  const mode=settings.workspaceMode||((settings.deskOrder==='stacked'||settings.dashboardLayout==='list')?'stacked':'side-by-side');
  const base=settings.workspaceLayout?cleanLayout(settings.workspaceLayout):split(mode==='stacked'?'y':'x',cleanOrder(settings.workspaceOrder,{fallback:legacyOrder(settings)}));
  const layout=placed(settings.helpLayout,strip(base))||base;
  return {
   order:leaves(layout),mode,layout,
   courseNavigation:settings.courseNavigation||DEFAULT.courseNavigation,
   dockSize:settings.dockSize===undefined?DEFAULT.dockSize:settings.dockSize,
   showCourseInformation:settings.showCourseInformation!==false,
   showCourseStrip:settings.showCourseStrip!==false,showHelp:settings.showHelp!==false
  };
 }
 function cleanSnapshot(value){
  if(isObject(value))value={...value,order:Array.isArray(value.order)?value.order.filter(key=>key!=='today'):value.order};
  if(value?.showHelp!==undefined&&typeof value.showHelp!=='boolean')throw Error('Invalid workspaceUndo setting in backup.');
  if(!isObject(value)||
    !['stacked','side-by-side'].includes(value.mode)||
    !['sidebar','topbar','dock'].includes(value.courseNavigation)||
    value.dockSize!==undefined&&!['small','medium','large'].includes(value.dockSize)||
    typeof value.showCourseInformation!=='boolean'||
    typeof value.showCourseStrip!=='boolean')
    throw Error('Invalid workspaceUndo setting in backup.');
  if(!Array.isArray(value.order)||new Set(value.order).size!==value.order.length||value.order.some(key=>key!=='today'&&!isKey(key)))throw Error('Invalid workspaceOrder setting in backup.');
  const order=cleanOrder(core(value.order),{strict:true}),
    layout=value.layout?strip(cleanLayout(value.layout)):split(value.mode==='stacked'?'y':'x',order),
    help=placed(value.helpLayout,layout);
  return {
    order:leaves(layout),
    mode:value.mode,
    layout,
    ...(help?{helpLayout:help}:{}),
    courseNavigation:value.courseNavigation,
    dockSize:value.dockSize===undefined?DEFAULT.dockSize:value.dockSize,
    showCourseInformation:value.showCourseInformation,
    showCourseStrip:value.showCourseStrip,
    showHelp:value.showHelp!==false,
    ...(Array.isArray(value.courseOrder)?{courseOrder:value.courseOrder.filter(x=>typeof x==='string').slice(0,500)}:{}),
    ...(value.moduleSize!=null?cleanWidths(value.moduleSize,value.helpSize):{})
  };
 }
 function cleanSizes(value){
  if(value===undefined||value===null)return {};
  if(!isObject(value))throw Error('Invalid moduleSize setting in backup.');
  const out={};
  for(const [key,size] of Object.entries(value)){if(key==='today')continue;if(!isKey(key)||!Object.hasOwn(SIZES,size))throw Error('Invalid moduleSize setting in backup.');if(size!=='m')out[key]=size;}
  return out;
 }
 // Help's width is kept on its own, as its place is (settings.helpSize, 's' or 'l'; Normal is no entry): a build before
 // 4.2 refuses a whole record whose moduleSize names a module it does not know. sizes() gives every module's width as
 // Home draws it, setSize() sets one. A record that still has Help in moduleSize (a 4.2 preview wrote it there) is read
 // with that width, and cleaning moves it over, so a saved record never carries it in moduleSize again.
 const ownWidth=value=>value==='s'||value==='l'?value:undefined;
 function sizes(settings={}){
  const own=isObject(settings?.moduleSize)?settings.moduleSize:{},out={};
  for(const [key,size] of Object.entries(own))if(key!==HELP)out[key]=size;
  const help=ownWidth(Object.hasOwn(own,HELP)?own[HELP]:settings?.helpSize);if(help)out[HELP]=help;
  return out;
 }
 // widths as a record keeps them: the other modules' in moduleSize, Help's beside them
 function apart(widths={}){const {[HELP]:help,...moduleSize}=widths,width=ownWidth(help);return {moduleSize,...(width?{helpSize:width}:{})};}
 function setSize(settings,key,size){
  if(!isObject(settings)||!isKey(key)||!Object.hasOwn(SIZES,size))return false;
  const widths=sizes(settings);if(size==='m')delete widths[key];else widths[key]=size;
  const kept=apart(widths);settings.moduleSize=kept.moduleSize;if(kept.helpSize)settings.helpSize=kept.helpSize;else delete settings.helpSize;
  return true;
 }
 // (cleaning: a width this build does not know for Help is dropped, never a reason to refuse the record)
 function cleanWidths(moduleSize,helpSize){
   const widths=cleanSizes(moduleSize),help=isObject(moduleSize)&&Object.hasOwn(moduleSize,HELP)?widths[HELP]:ownWidth(helpSize);
   delete widths[HELP];
   return apart({...widths,...(help?{[HELP]:help}:{})});
 }
 function cleanSaved(settings={}){
  const order=cleanOrder(settings.workspaceOrder,{strict:settings.workspaceOrder!==undefined,fallback:legacyOrder(settings)});
  const mode=settings.workspaceMode===undefined?(settings.deskOrder==='stacked'||settings.deskOrder===undefined&&settings.dashboardLayout==='list'?'stacked':'side-by-side'):settings.workspaceMode;
  if(!['stacked','side-by-side'].includes(mode))throw Error('Invalid workspaceMode setting in backup.');
  const layout=settings.workspaceLayout==null?null:strip(cleanLayout(settings.workspaceLayout)),help=placed(settings.helpLayout,layout||split(mode==='stacked'?'y':'x',order));
  return {
    ...cleanWidths(settings.moduleSize,settings.helpSize),
    workspaceOrder:order,
    workspaceMode:mode,
    workspaceLayout:layout,
    ...(help?{helpLayout:help}:{}),
    workspaceUndo:settings.workspaceUndo==null?null:cleanSnapshot(settings.workspaceUndo)
  };
 }
 // A preset or the panel-order choice lays the three panels out afresh; modules a student added keep their row.
 function resetCore(settings,previous){
  settings.workspaceLayout=null;settings.workspaceOrder=legacyOrder(settings);settings.workspaceMode=settings.deskOrder==='stacked'?'stacked':'side-by-side';delete settings.helpLayout;
  const kept=previous?extras(previous).filter(key=>key!==HELP):[];
  if(kept.length)settings.workspaceLayout=withExtras(snapshot(settings).layout,strip(previous));
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
   // (Help added back goes where it always was, on top; dropped on a place it goes there)
   case 'add':
     if(command.key===HELP){
       next.showHelp=true;
       if(command.target&&command.edge){next.layout=dock(current.layout,HELP,command.target,command.edge);next.order=leaves(next.layout);}
       break;
     }
    next.layout=add(current.layout,command.key);
    if(command.target&&command.edge)next.layout=dock(next.layout,command.key,command.target,command.edge);
    next.order=leaves(next.layout);
    break;
   case 'remove':
     if(command.key===HELP)next.showHelp=false;
     if(isExtra(command.key)&&leaves(current.layout).includes(command.key)){next.layout=prune(current.layout,command.key);next.order=leaves(next.layout);}
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
   case 'help':
     if(typeof command.value==='boolean'){
       next.showHelp=command.value;
       if(!command.value&&leaves(current.layout).includes(HELP)){next.layout=prune(current.layout,HELP);next.order=leaves(next.layout);}
     }
     break;
   // "Reset this widget": back where it goes by itself. Help: on top across the width (no place of its own); an added module:
   // the row of added modules (add); one of the three panels: beside its neighbour in the first arrangement.
   case 'reset-module':{
    const key=command.key;if(!isKey(key)||!leaves(current.layout).includes(key))break;
    const rest=prune(current.layout,key);if(!rest)break;
    if(key===HELP)next.layout=rest;
    else if(PANELS.includes(key)){
      const at=PANELS.indexOf(key),there=k=>leaves(rest).includes(k),left=PANELS.slice(0,at).reverse().find(there),right=PANELS.slice(at+1).find(there);
      next.layout=left?dock(rest,key,left,'right'):right?dock(rest,key,right,'left'):split('x',[rest,key]);
    }
    else{
      const top=current.layout?.axis==='y'?current.layout.children[0]:null,inRow=top&&leaves(top).every(k=>isExtra(k))&&leaves(top).includes(key);
      next.layout=inRow?current.layout:add(rest,key);
    }
    next.order=leaves(next.layout);break;
   }
   case 'reset':return {...DEFAULT,order:[...DEFAULT.order]};
  }
  if(['move','shift','mode'].includes(command?.type)){next.layout=withExtras(split(next.mode==='stacked'?'y':'x',core(next.order)),current.layout);next.order=leaves(next.layout);}
  return next;
 }
 function writeSnapshot(settings,state){
  settings.workspaceOrder=core(state.order);settings.workspaceMode=state.mode;
  const help=state.helpLayout||(leaves(state.layout).includes(HELP)?state.layout:null);
  settings.workspaceLayout=strip(state.layout);if(help)settings.helpLayout=help;else delete settings.helpLayout;
  if(state.courseOrder)settings.courseOrder=[...state.courseOrder];
  // Widths (Narrow / Normal / Wide) come back with the places, for the modules in the layout given back. A module not in
  // it keeps whatever width it has now (a removed module's remembered width, an expired AI module's none).
  if(state.moduleSize){
    const kept=new Set([...leaves(state.layout),...(state.showHelp!==false?[HELP]:[])]),out={};
    for(const [key,size] of Object.entries(sizes(settings)))if(!kept.has(key))out[key]=size;
    for(const [key,size] of Object.entries(sizes(state)))if(kept.has(key))out[key]=size;
    const widths=apart(out);
    settings.moduleSize=widths.moduleSize;
    if(widths.helpSize)settings.helpSize=widths.helpSize;else delete settings.helpSize;
  }
  settings.courseNavigation=state.courseNavigation;
  settings.dockSize=state.dockSize;
  settings.showCourseInformation=state.showCourseInformation;
  settings.showCourseStrip=state.showCourseStrip;
  settings.showHelp=state.showHelp;
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
   settings.workspaceUndo={...stored(before),courseOrder:[...(settings.courseOrder||[])],...apart(sizes(settings))};settings.courseOrder=next;return true;
  }
  // A width (Narrow, Normal, Wide), from the menu, a drag of a module's edge or corner, or the keyboard.
  if(command?.type==='size'){
   const key=command.key,value=command.value;if(!isKey(key)||!Object.hasOwn(SIZES,value))return false;
   // (join-42c: widths read and written through sizes()/setSize(), so Help's stays in helpSize, fix-42)
   const widths=sizes(settings);if((widths[key]||'m')===value)return false;
   if(WIDTH_IS_UNDO_STEP)settings.workspaceUndo={...stored(before),...apart(widths)};
   return setSize(settings,key,value);
  }
  // "Reset this widget": its own place and Normal width again, in one step that Undo move takes back.
  if(command?.type==='reset-module'){
   const key=command.key;if(!isKey(key))return false;
   const help=key===HELP&&before.showHelp&&!before.order.includes(HELP),after=help?before:nextState(before,command),widths=sizes(settings);
   if(same(before,after)&&!Object.hasOwn(widths,key))return false;
   writeSnapshot(settings,after);settings.workspaceUndo={...stored(before),...apart(widths)};setSize(settings,key,'m');return true;
  }
  if(command?.type==='undo'){
   if(!settings.workspaceUndo)return false;
   const previous=cleanSnapshot(settings.workspaceUndo);
   writeSnapshot(settings,previous.helpLayout?{...previous,layout:previous.helpLayout,order:leaves(previous.helpLayout)}:previous);
   settings.workspaceUndo=null;
   return true;
  }
  // A move that names Help while it has no place yet starts from where it is drawn (on top across the width), so a drop
  // beside it or onto it lands where the student saw it. Taking it off needs no place. So does a whole row or column of the
  // desk (until 4.0.194 "A row across the top" went in BELOW Help, and a column on the left or right began under Help, while the
  // preview, which is drawn with Help, showed them beside or above it).
  // (The module menu's Top / Bottom / Left / Right do the same as the drag: owner, 2026-11-23. In the join they had kept
  // their meaning before 4.2, the row or column going in under Help.)
  let from=before;
  if(before.showHelp&&
    !before.order.includes(HELP)&&
    (['dock','swap'].includes(command?.type)&&[command?.key,command?.target].includes(HELP)||command?.type==='dock'&&command?.target===ROOT)){
    const layout=split('y',[HELP,before.layout]);
    from={...before,layout,order:leaves(layout)};
  }
  const after=nextState(from,command);
  if(same(before,after))return false;
  // The undo copy holds the widths as they are now, so Undo move gives back the whole earlier arrangement.
  const widths=apart(sizes(settings));writeSnapshot(settings,after);settings.workspaceUndo={...stored(before),...widths};
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
   HELP,
   ROOT,
   SIZES,
   STEPS,
   WIDTH_IS_UNDO_STEP,
   shares,
   wrapRows,
   drawn,
   undoCopy,
   strip,
   sizes,
   setSize,
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
