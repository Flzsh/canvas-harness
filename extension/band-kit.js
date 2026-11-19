/* The band kit (band level 2): what a .chtheme may say inside "band", read tolerantly, as pure data.
   A band is one picture plus an ordered list of PIECES (back to front). A piece picks one small block from each slot:
     draw   WHAT    a built-in drawn shape, a rendered light, a colour wash, or a pack image ({asset})
     at     WHERE   a point, an area, a line, an edge, or "all"; always in the art's own pixel box ("box")
     count / density / spacing   HOW MANY
     move   HOW IT MOVES   a list of small motions that add up
     every / lasts / when        WHEN (when may follow the local clock: time names or hours, with a fade in minutes;
                                 months and weekdays)
     color, ink, size, opacity, look, scale, turn, pivot, react, variants   LOOK (depth is the list order;
                                 variants = [{when, opacity, color}] blends the look by the same conditions)
   A RECIPE is a named piece or group of pieces; the built-in ones below are nothing but data in the same blocks, and
   {use:"snow", ...} expands to them with every key beside "use" overriding that block. Nothing here is code from a
   pack: an unknown key is ignored, an unknown block or recipe skips that one piece, numbers are clamped, and only the
   picture's own basics can fail an install (theme-pack.js keeps those rules). No DOM, timers or network in this file. */
(function(root){
 'use strict';
 const level=2,
   own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),
   plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),
   fin=v=>typeof v==='number'&&Number.isFinite(v),
   clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 // ---- the blocks, one list per slot (a later level only ever adds names; "later" says which level added them)
 const shapes=['flake','drop','leaf','petal','dot','star','spark','feather','seed','bird','butterfly','cloud','puff','lantern','bubble','strip','fleck','bolt'],lights=['glow','ray','haze','ribbon','flash'],washes=['wash'];
 const edges=['top','bottom','left','right'],moves=['fall','rise','drift','cross','pan','sway','bob','float','spin','swing','flutter','flap','breathe','grow','pulse','twinkle','flicker','streak','none'];
 const flow=['fall','rise','drift','cross'],distance={amount:['fall','rise','drift','cross','sway','bob','float'],speed:['fall','rise','drift','cross','pan']};
 const times={dawn:[5,8],day:[8,17],dusk:[17,20],night:[20,5]},palette=['bg','surface','ink','muted','line','accent'],edgeModes=['fade','mirror','repeat'],texts=['light','dark','auto'];
 const pictureKeys=['asset','still','stillAsset','loop'],lookKeys=['focus','box','keep','narrow','narrowBelow','edge','text','shade','fade','pieces','effects'];
 // an hour of the local clock: a number (5.5) or "05:30"; a span is [from, to] and may wrap midnight
 const clock=v=>{
   if(fin(v))return clamp(v,0,24);
   if(typeof v!=='string')return null;
   const m=/^(\d{1,2}):(\d{2})$/.exec(v.trim());
   if(!m||+m[2]>59)return null;
   const h=+m[1]+(+m[2])/60;
   return h<=24?h:null;
 };
 const span=v=>{if(!Array.isArray(v)||v.length!==2)return null;const a=clock(v[0]),b=clock(v[1]);return a===null||b===null?null:[a,b];};
 // a weekday of the local clock: 0-6 (0 = Sunday, as the clock counts) or its name, "mon" or "monday" in any case
 const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],weekday=v=>{
   if(Number.isInteger(v))return v>=0&&v<=6?v:null;
   if(typeof v!=='string')return null;
   const s=v.trim().toLowerCase(),i=weekdays.findIndex(name=>name===s||name.slice(0,3)===s);
   return i<0?null:i;
 };
 /* what a motion does when a pack gives it no numbers (distances in art heights, periods in seconds, swing in degrees) */
 const motion={
   fall:{speed:.12},
   rise:{speed:.06},
   drift:{speed:.04},
   cross:{speed:.25},
   pan:{speed:.02},
   sway:{amount:.03,period:4},
   bob:{amount:.02,period:3},
   float:{amount:.03,period:6},
   spin:{speed:.2},
   swing:{amount:8,period:3},
   flutter:{amount:.8,period:.6},
   flap:{amount:.7,period:.35},
   breathe:{amount:.08,period:4},
   grow:{amount:1,period:4},
   pulse:{amount:.5,period:3},
   twinkle:{amount:.8,period:2.5},
   flicker:{amount:.35,period:.25},
   streak:{amount:3}
 };
 const later={},since=name=>later[name]||2;
 // ---- built-in recipes: plain data in the blocks above (sizes, distances and speeds in art heights; no box)
 const recipes={
  snow:{
    draw:'flake',
    at:'all',
    density:8,
    move:[{type:'fall',speed:[.07,.14]},{type:'sway',amount:[.015,.04],period:[3,7]},{type:'spin',speed:[-.08,.08]}],
    size:[.03,.075],
    color:'#ffffff',
    ink:'#8196b0',
    opacity:[.7,1]
  },
  rain:{draw:'drop',at:'all',density:13,move:[{type:'fall',speed:[1.1,1.6]},{type:'drift',speed:-.28},'streak'],size:[.035,.06],color:'#d6e8f8',ink:'#6f89a6',opacity:[.45,.75]},
  leaves:{
    draw:'leaf',
    at:'all',
    density:2,
    move:[{type:'fall',speed:[.09,.17]},{type:'sway',amount:[.04,.09],period:[3,6]},{type:'spin',speed:[-.22,.22]},{type:'flutter',period:[1.2,2.4],amount:.6}],
    size:[.08,.14],
    color:['#d9772b','#c4472d','#e2a93b','#8a5a2b']
  },
  petals:{
    draw:'petal',
    at:'all',
    density:3.2,
    move:[{type:'fall',speed:[.055,.11]},{type:'drift',speed:[.01,.05]},{type:'sway',amount:[.03,.07],period:[3,6]},{type:'spin',speed:[-.18,.18]},{type:'flutter',period:[1.4,2.8],amount:.55}],
    size:[.05,.09],
    color:['#f6c7d6','#fbe3ea','#eea9c2'],
    ink:'#a8607c'
  },
  feathers:{
    draw:'feather',
    at:'all',
    density:.8,
    move:[{type:'fall',speed:[.035,.065]},{type:'sway',amount:[.07,.12],period:[4,7]},{type:'swing',amount:[14,26],period:[4,7]}],
    size:[.12,.18],
    color:['#ffffff','#f1ead9']
  },
  confetti:{
    draw:'strip',
    at:'all',
    density:5,
    move:[{type:'fall',speed:[.13,.24]},{type:'sway',amount:[.03,.07],period:[2,4]},{type:'spin',speed:[-.5,.5]},{type:'flutter',period:[.5,1.1],amount:.9}],
    size:[.045,.08],
    color:['#f25c54','#f7b32b','#2ec4b6','#7d5ba6']
  },
  ash:{
    draw:'fleck',
    at:'all',
    density:7,
    move:[{type:'fall',speed:[.03,.06]},{type:'drift',speed:[.02,.06]},{type:'sway',amount:[.02,.05],period:[3,6]},{type:'spin',speed:[-.15,.15]},{type:'flutter',period:[1.6,3],amount:.5}],
    size:[.03,.06],
    color:['#4a3d38','#7a665b','#b9a493'],
    ink:'#2d2522',
    opacity:[.75,1]
  },
  seeds:{
    draw:'seed',
    at:'all',
    density:1.2,
    move:[{type:'drift',speed:[.05,.11]},{type:'rise',speed:[.004,.02]},{type:'bob',amount:[.02,.05],period:[3,6]},{type:'swing',amount:[6,14],period:[3,5]}],
    size:[.09,.13],
    color:'#ffffff'
  },
  bubbles:{
    draw:'bubble',
    at:'all',
    density:2.4,
    move:[{type:'rise',speed:[.05,.11]},{type:'sway',amount:[.015,.04],period:[2,4]},{type:'breathe',amount:.06,period:[2,3]}],
    size:[.09,.2],
    color:'#e8f7ff',
    ink:'#4f7596'
  },
  embers:{
    draw:'spark',
    at:'bottom',
    density:5,
    look:'light',
    move:[{type:'rise',speed:[.1,.22],amount:[.5,.95]},{type:'drift',speed:[-.03,.05]},{type:'sway',amount:[.01,.03],period:[1.5,3]},{type:'flicker',amount:.5}],
    size:[.03,.06],
    color:['#ffb347','#ff7a2f','#ffd98a']
  },
  fireflies:{draw:'glow',at:'all',density:2.4,move:[{type:'float',amount:[.04,.09],period:[5,9]},{type:'twinkle',period:[2.5,5],amount:.9}],size:[.1,.17],color:'#e9ff9a'},
  dust:{draw:'dot',at:'all',density:6,look:'light',move:[{type:'float',amount:[.03,.07],period:[7,13]},{type:'pulse',period:[4,8],amount:.6}],size:[.012,.028],color:'#fff3d0',opacity:[.45,.85]},
  sparkles:{draw:'spark',at:'all',density:2.4,look:'light',move:[{type:'twinkle',period:[1.6,3.4],amount:1},{type:'breathe',amount:.25,period:[1.6,3.4]}],size:[.05,.1],color:'#fff6d8'},
  stars:{draw:'spark',at:'top',density:8,look:'light',move:[{type:'twinkle',period:[2,6],amount:.7}],size:[.02,.05],color:['#fff6d8','#dfe9ff']},
  glints:{draw:'spark',at:'bottom',density:12,look:'light',move:[{type:'twinkle',period:[.9,2.2],amount:1}],size:[.028,.06],color:'#ffffff'},
  glows:{draw:'glow',at:'all',count:6,move:[{type:'float',amount:[.03,.08],period:[9,16]},{type:'pulse',period:[5,9],amount:.45}],size:[.4,.75],color:['#ffe6a8','#ffd0b0'],opacity:[.3,.5]},
  lights:{
    draw:'glow',
    at:[[.5,.1],[.62,.2],[.75,.11],[.88,.2],[1,.1]],
    spacing:.13,
    move:[{type:'pulse',period:[2.5,5],amount:.4},{type:'swing',amount:3,period:[3,5]}],
    size:.14,
    color:['#ffd27a','#ff9a6b','#a8e6c9','#9cc8ff']
  },
  rays:{draw:'ray',at:'top',count:4,move:[{type:'breathe',amount:.06,period:[7,12]},{type:'pulse',period:[6,11],amount:.5}],size:[1,1.3],turn:[8,24],color:'#fff1c4',opacity:[.42,.62]},
  aurora:{draw:'ribbon',at:'top',move:[{type:'pan',speed:.012},{type:'pulse',period:9,amount:.35}],size:.75,color:['#6df0c2','#7aa8ff','#c58cff'],opacity:.55},
  fog:{draw:'haze',at:'bottom',move:[{type:'pan',speed:.014}],size:.62,color:'#ffffff',opacity:.6},
  mist:{draw:'haze',at:'all',move:[{type:'pan',speed:-.008},{type:'pulse',period:14,amount:.3}],color:'#eef3f8',opacity:.26},
  clouds:{draw:'cloud',at:'top',count:4,move:[{type:'drift',speed:[.008,.02]},{type:'bob',amount:.008,period:[9,15]}],size:[.2,.34],color:'#ffffff',opacity:[.75,.95]},
  birds:{
    draw:'bird',
    at:{x:0,y:.06,w:1,h:.4},
    count:5,
    move:[{type:'cross',speed:[.2,.26]},{type:'flap',period:[.5,.7],amount:.6},{type:'bob',amount:.01,period:[2,3]}],
    every:[20,44],
    size:[.06,.09],
    color:'ink'
  },
  butterflies:{
    draw:'butterfly',
    at:'all',
    count:3,
    move:[{type:'float',amount:[.08,.16],period:[6,10]},{type:'drift',speed:[.01,.03]},{type:'flutter',period:[.22,.34],amount:.85},{type:'swing',amount:10,period:[1.5,3]}],
    size:[.09,.13],
    color:['#f4a340','#8fb8f0','#f2d14e']
  },
  lanterns:[
    {draw:'glow',at:'bottom',density:4,move:[{type:'rise',speed:[.02,.045]},{type:'sway',amount:[.01,.03],period:[5,9]},{type:'pulse',period:[2,4],amount:.3}],size:[.42,.58],color:'#ffb45a',opacity:.5},
   {draw:'lantern',at:'bottom',density:4,move:[{type:'rise',speed:[.02,.045]},{type:'sway',amount:[.01,.03],period:[5,9]}],size:[.16,.22],color:'#ffcf7a'}],
  smoke:{
    draw:'puff',
    at:{x:.8,y:.72},
    count:6,
    move:[{type:'rise',speed:[.035,.06],amount:.6},{type:'drift',speed:[.012,.03]},{type:'sway',amount:[.008,.02],period:[3,5]},{type:'grow',amount:1.6},{type:'swing',amount:8,period:[4,7]}],
    size:[.1,.15],
    color:['#efe8dd','#d9d0c4'],
    ink:'#6e655d',
    opacity:[.6,.85]
  },
  lightning:[{draw:'flash',at:'all',every:[16,36],lasts:.5,move:[{type:'flicker',amount:.6,period:.09}],color:'#eaf2ff',opacity:.34},
   {draw:'bolt',at:'top',count:1,every:[16,36],lasts:.3,look:'light',pivot:{x:.5,y:0},move:[{type:'flicker',amount:.5,period:.07}],size:[.5,.68],color:'#f4f8ff'}],
  'shooting-star':{
    draw:'spark',
    at:'top',
    count:1,
    look:'light',
    every:[9,24],
    move:[{type:'cross',speed:[1.3,1.8],amount:[1,1.7]},{type:'fall',speed:[.3,.5]},{type:'streak',amount:7}],
    size:[.05,.07],
    color:'#fffbe8'
  },
  dusk:{draw:'wash',at:'all',color:['#5a4a8a','#ff9a5a'],opacity:.24,when:{time:'dusk',fade:40}},
  night:{draw:'wash',at:'all',color:['#0b1030','#151a3a'],opacity:.34,when:{time:'night',fade:40}}
 };
 // ---- reading
 function hex(value){
   if(typeof value!=='string')return null;
   const v=value.trim().toLowerCase();
   if(/^#[0-9a-f]{6}$/.test(v))return v;
   if(/^#[0-9a-f]{3}$/.test(v))return '#'+[1,2,3].map(i=>v[i]+v[i]).join('');
   return palette.includes(v)?v:null;
 }
 function reader(hooks,names=times){
  const notes=[],uses=new Set(),note=(path,kind,message)=>{
    if(notes.length<200)notes.push({path:String(path).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,'\ufffd'),kind,message});
  },use=name=>uses.add(name);
  const ignore=(value,known,path)=>{for(const key of Object.keys(value))if(!known.includes(key))note(path+'.'+key,'ignored','unknown key, ignored');};
  function number(value,path,min,max){
    if(!fin(value)){note(path,'fallback','expected a number; the default is used');return undefined;}
    if(value<min||value>max){note(path,'clamped','kept between '+min+' and '+max);return clamp(value,min,max);}
    return value;
  }
  function range(value,path,min,max,scale=1){
   const list=Array.isArray(value)?value.slice(0,2):[value];if(!list.length||!list.every(fin)){note(path,'fallback','expected a number or [low, high]; the default is used');return undefined;}
   const out=list.map(n=>n*scale).map(n=>{if(n<min||n>max){note(path,'clamped','kept between '+min+' and '+max);return clamp(n,min,max);}return n;});
   return out.length===1?[out[0],out[0]]:[Math.min(out[0],out[1]),Math.max(out[0],out[1])];
  }
  function colour(value,path){
   const list=(Array.isArray(value)?value.slice(0,4):[value]).map(hex);
   if(!list.length||list.includes(null)){note(path,'fallback','expected #RRGGBB or a palette name ('+palette.join(', ')+'); the default is used');return undefined;}
   return list;
  }
  // units: with a box every position is in the art's pixels; without one positions are fractions and sizes are art heights
  const units=box=>box?{x:1/box[0],y:1/box[1],s:1/box[1]}:{x:1,y:1,s:1};
  function point(value,U,rel){
    const x=fin(value?.[0])?value[0]:value?.x,y=fin(value?.[1])?value[1]:value?.y;
    if(!fin(x)||!fin(y))return null;
    return rel?[clamp(x*U.s,-8,8),clamp(y*U.s,-8,8)]:[clamp(x*U.x,-1,2),clamp(y*U.y,-1,2)];
  }
  function where(value,path,U,rel){
   if(typeof value==='string'){if(value==='all')return {type:'all'};if(edges.includes(value)){use('at:'+value);return {type:'edge',edge:value};}return null;}
   if(Array.isArray(value)){
     const points=value.slice(0,24).map(p=>point(p,U,rel));
     if(points.length<2||points.includes(null))return null;
     use('at:line');
     return {type:'line',points,...(rel?{rel:true}:{})};
   }
   if(!plain(value))return null;ignore(value,['x','y','w','h'],path);const p=point(value,U,rel);if(!p)return null;
   if(fin(value.w)&&fin(value.h)&&value.w>0&&value.h>0){
     use('at:area');
     return {type:'area',x:p[0],y:p[1],w:clamp(value.w*(rel?U.s:U.x),.001,rel?8:3),h:clamp(value.h*(rel?U.s:U.y),.001,rel?8:3),...(rel?{rel:true}:{})};
   }
   use('at:point');return {type:'point',x:p[0],y:p[1],...(rel?{rel:true}:{})};
  }
  function drawing(value,path){
   const list=Array.isArray(value)?value.slice(0,4):[value],out=[];if(!list.length)return null;
   for(const item of list){
    if(typeof item==='string'){
      const kind=shapes.includes(item)?'shape':lights.includes(item)?'light':washes.includes(item)?'wash':null;
      if(!kind)return null;
      use('draw:'+item);
      out.push({kind,name:item});
    }
    else if(plain(item)&&typeof item.asset==='string'&&hooks.image?.(item.asset)){ignore(item,['asset'],path);use('draw:image');out.push({kind:'image',asset:item.asset});}
    else return null;
   }
   return out;
  }
  function motions(value,path,U){
   const list=(Array.isArray(value)?value:[value]).slice(0,6),out=[];
   for(let i=0;i<list.length;i++){
    const raw=typeof list[i]==='string'?{type:list[i]}:list[i],field=path+'['+i+']';
    if(!plain(raw)||!moves.includes(raw.type))return null;
    ignore(raw,['type','amount','speed','period'],field);
    if(raw.type==='none')continue;
    use('move:'+raw.type);
    const item={type:raw.type};
    if(own(raw,'amount')){const v=range(raw.amount,field+'.amount',-400,400,distance.amount.includes(raw.type)?U.s:1);if(v)item.amount=v;}
    if(own(raw,'speed')){const v=range(raw.speed,field+'.speed',-40,40,distance.speed.includes(raw.type)?U.s:1);if(v)item.speed=v;}
    if(own(raw,'period')){const v=range(raw.period,field+'.period',.05,600);if(v)item.period=v;}
    out.push(item);
   }
   return out;
  }
  function condition(value,path){
   if(!plain(value))return null;const out={};
   for(const key of Object.keys(value)){
    const v=value[key];
    if(key==='mode'){if(v!=='light'&&v!=='dark')return null;out.mode=v;}
    else if(key==='time'){
      const list=(Array.isArray(v)?v:[v]).slice(0,6);
      if(!list.length||!list.every(name=>typeof name==='string'&&own(names,name)))return null;
      out.time=list;
      out.spans=list.map(name=>names[name]);
    }
    else if(key==='hours'){const s=span(v);if(!s)return null;out.hours=s;}
    else if(key==='fade'){if(fin(v)&&v>=0)out.fade=Math.min(v,240);else note(path+'.fade','fallback','expected minutes; no fade');}
    else if(key==='months'){const list=Array.isArray(v)?v:[v];if(!list.length||!list.every(n=>Number.isInteger(n)&&n>=1&&n<=12))return null;out.months=list.slice(0,12);}
    else if(key==='days'){const list=(Array.isArray(v)?v:[v]).map(weekday);if(!list.length||list.includes(null))return null;out.days=[...new Set(list)].sort((a,b)=>a-b);}
    else if(key==='weeks'){if(v!=='odd'&&v!=='even')return null;out.weeks=v;}
    else if(key==='width'){if(v!=='narrow'&&v!=='wide')return null;out.width=v;}
    else return null;
    use('when:'+key);
   }
   return out;
  }
  const pieceKeys=['use','draw','at','count','density','spacing','move','every','lasts','when','color','ink','size','opacity','look','scale','turn','pivot','react','variants','seed','type'];
  // a piece's look by condition: [{when, opacity, color}]; an entry whose "when" is not known is left out, the piece stays
  function shifts(value,path){
   if(!Array.isArray(value)){note(path,'fallback','expected a list; none are used');return null;}const out=[];
   value.slice(0,6).forEach((item,i)=>{
    const at=path+'['+i+']',when=plain(item)?condition(item.when,at+'.when'):null;if(!when){note(at,'skipped','needs a "when" this version knows; this variant is left out');return;}
    ignore(item,['when','opacity','color'],at);const v={when};
    if(own(item,'opacity')){const o=range(item.opacity,at+'.opacity',0,1);if(o)v.opacity=o;}
    if(own(item,'color')){const c=colour(item.color,at+'.color');if(c)v.color=c;}
    out.push(v);
   });
   if(value.length>6)note(path,'clamped','only the first 6 variants are read');return out.length?out:null;
  }
  // the blocks one piece spells out (only the keys it gives, so they can override a recipe); null = skip this piece
  function blocks(raw,path,U,rel){
   const out={},skip=(key,why)=>{note(path+'.'+key,'skipped',why+'; this piece is left out');return null;};ignore(raw,pieceKeys,path);
   if(own(raw,'draw')){const v=drawing(raw.draw,path+'.draw');if(!v)return skip('draw','unknown thing to draw');out.draw=v;}
   if(own(raw,'at')){const v=where(raw.at,path+'.at',U,rel);if(!v)return skip('at','unknown place');out.at=v;}
   if(own(raw,'move')){const v=motions(raw.move,path+'.move',U);if(!v)return skip('move','unknown motion');out.move=v;}
   if(own(raw,'when')){const v=condition(raw.when,path+'.when');if(!v)return skip('when','unknown condition');out.when=v;}
   if(own(raw,'count')){const v=number(raw.count,path+'.count',1,400);if(v!==undefined){out.count=Math.round(v);use('count');}}
   if(own(raw,'density')){const v=number(raw.density,path+'.density',0,60);if(v!==undefined){out.density=v;use('density');}}
   if(own(raw,'spacing')){const v=number(raw.spacing*U.s,path+'.spacing',.005,4);if(v!==undefined){out.spacing=v;use('spacing');}}
   if(own(raw,'every')){const v=range(raw.every,path+'.every',1,3600);if(v){out.every=v;use('every');}}
   if(own(raw,'lasts')){const v=range(raw.lasts,path+'.lasts',.05,600);if(v)out.lasts=v;}
   if(own(raw,'color')){const v=colour(raw.color,path+'.color');if(v)out.color=v;}
   if(own(raw,'ink')){if(raw.ink===false)out.ink=false;else{const v=colour(raw.ink,path+'.ink');if(v)out.ink=v[0];}}
   if(own(raw,'size')){const v=range(raw.size,path+'.size',.002,4,U.s);if(v)out.size=v;}
   if(own(raw,'opacity')){const v=range(raw.opacity,path+'.opacity',0,1);if(v)out.opacity=v;}
   if(own(raw,'look')){if(raw.look==='drawn'||raw.look==='light')out.look=raw.look;else note(path+'.look','fallback','expected "drawn" or "light"; the default is used');}
   if(own(raw,'scale')){const v=number(raw.scale,path+'.scale',.05,20);if(v!==undefined)out.scale=v;}
   if(own(raw,'turn')){const v=range(raw.turn,path+'.turn',-360,360);if(v)out.turn=v;}
   if(own(raw,'pivot')){
     if(plain(raw.pivot))ignore(raw.pivot,['x','y'],path+'.pivot');
     const x=raw.pivot?.x,y=raw.pivot?.y;
     if(fin(x)&&fin(y))out.pivot={x:clamp(x,0,1),y:clamp(y,0,1)};else note(path+'.pivot','fallback','expected {x, y} from 0 to 1; the default is used');
   }
   if(own(raw,'variants')){const v=shifts(raw.variants,path+'.variants');if(v){out.variants=v;use('piece variants');}}
   if(own(raw,'react')){if(raw.react==='pointer'){out.react='pointer';use('react');}else note(path+'.react','fallback','unknown reaction; the piece does not react');}
   if(own(raw,'seed')&&fin(raw.seed))out.seed=Math.abs(Math.round(raw.seed))%100000;
   return out;
  }
  const scaled=(piece,k)=>{
    const q={...piece,scale:clamp((piece.scale||1)*k,.05,20)};
    if(q.at?.rel)q.at=q.at.type==='line'?{...q.at,points:q.at.points.map(p=>[p[0]*k,p[1]*k])}:{...q.at,x:q.at.x*k,y:q.at.y*k,...(q.at.type==='area'?{w:q.at.w*k,h:q.at.h*k}:{})};
    return q;
  };
  // a group's point: an offset inside another group adds up; a point on the art becomes the group's origin
  const moved=(piece,at)=>{
    const base=piece.at||{type:'point',x:0,y:0,rel:true};
    if(!base.rel)return piece;
    if(at.rel)return {...piece,at:base.type==='line'?{...base,points:base.points.map(p=>[p[0]+at.x,p[1]+at.y])}:{...base,x:base.x+at.x,y:base.y+at.y}};
    return {...piece,at:{...base,o:{x:at.x,y:at.y}}};
  };
  function book(own_,U){
   const cache=new Map(),busy=new Set();
   function get(name,depth){
    if(cache.has(name))return cache.get(name);
    const mine=own_&&own(own_,name),raw=mine?own_[name]:own(recipes,name)?recipes[name]:null;
    if(raw===null||depth>3||busy.has(name))return null;
    busy.add(name);const group=Array.isArray(raw),list=(group?raw.slice(0,12):[raw]),out=[],path=(mine?'$.band.recipes.':'recipe ')+name;
    let over=false;
    list.forEach((child,i)=>{
      const got=one(child,group?path+'['+i+']':path,mine?U:units(null),group,depth+1,get);
      if(got)for(const piece of got){if(out.length>=32){over=true;break;}out.push(piece);}
    });
    if(over)note(path,'clamped','a recipe gives at most 32 pieces');
    busy.delete(name);const value=out.length?{group,pieces:out}:null;cache.set(name,value);return value;
   }
   return get;
  }
  function one(raw,path,U,rel,depth,get){
   if(typeof raw==='string')raw={use:raw};if(!plain(raw)){note(path,'skipped','a piece is an object or a recipe name; this piece is left out');return null;}
   if(own(raw,'type')&&!own(raw,'use')&&!own(raw,'draw')&&typeof raw.type==='string')raw={...raw,use:raw.type};
   const given=blocks(raw,path,U,rel);if(!given)return null;
   if(!own(raw,'use')){if(!given.draw){note(path,'skipped','a piece needs "draw" or "use"; this piece is left out');return null;}return [given];}
   const recipe=typeof raw.use==='string'?get(raw.use,depth):null;if(!recipe){note(path+'.use','skipped','unknown recipe; this piece is left out');return null;}use('recipe:'+raw.use);
   const {at,scale,...rest}=given;
   return recipe.pieces.map(piece=>{
    let q={...piece,...rest};
    if(recipe.group){if(scale)q=scaled(q,scale);if(at){if(at.type==='point')q=moved(q,at);else note(path+'.at','fallback','a group is placed with a point {x, y}; this place is not used');}}
    else{if(at)q.at=at;if(scale)q.scale=clamp((q.scale||1)*scale,.05,20);}
    return q;
   });
  }
  function pieces(value,path,U,own_){
   if(!Array.isArray(value)){note(path,'fallback','expected a list of pieces; none are drawn');return [];}
   const get=book(own_,U),out=[];let group=0;
   value.slice(0,32).forEach((raw,i)=>{
     const got=one(raw,path+'['+i+']',U,false,0,get);
     if(!got)return;
     group++;
     for(const piece of got)out.push({...piece,seed:(piece.seed??0)+i*7919+13,sync:got.length>1?group*104729:undefined,index:out.length});
   });
   if(value.length>32)note(path,'clamped','only the first 32 pieces are read');if(out.length>32){note(path,'clamped','only the first 32 drawn pieces are kept');out.length=32;}return out;
  }
  return {notes,uses,note,use,ignore,number,colour,units,pieces,condition};
 }
 // One look: the fitting and text keys plus the pieces (the main band, band.dark, band.narrow and each variant).
 function look(raw,path,R,hooks,base,shared){
  const out={},src={},box=own(raw,'box')&&Array.isArray(raw.box)&&raw.box.length===2&&raw.box.every(n=>fin(n)&&n>=1&&n<=16384)?[raw.box[0],raw.box[1]]:null;
  if(own(raw,'box')){if(box){out.box=box;src.box=[box[0],box[1]];R.use('box');}else R.note(path+'.box','fallback','expected [width, height] of the art in pixels; positions are read as fractions');}
  const used=box||base||null,U=R.units(used);
  if(own(raw,'focus')){
    if(plain(raw.focus))R.ignore(raw.focus,['x','y'],path+'.focus');
    const x=raw.focus?.x,y=raw.focus?.y;
    if(fin(x)&&fin(y)){out.focus={x:clamp(x,0,1),y:clamp(y,0,1)};src.focus={...out.focus};if(x<0||x>1||y<0||y>1)R.note(path+'.focus','clamped','kept between 0 and 1');}
    else R.note(path+'.focus','fallback','expected {x, y} from 0 to 1; the default is used');
  }
  if(own(raw,'keep')){
    const k=raw.keep;
    if(plain(k))R.ignore(k,['x','y','w','h'],path+'.keep');
    const ok=plain(k)&&['x','y','w','h'].every(key=>fin(k[key]))&&k.w>0&&k.h>0;
    if(ok){const x=clamp(k.x*U.x,0,1),y=clamp(k.y*U.y,0,1);out.keep={x,y,w:clamp(k.w*U.x,.005,1-x),h:clamp(k.h*U.y,.005,1-y)};src.keep={x:k.x,y:k.y,w:k.w,h:k.h};R.use('keep');}
    else R.note(path+'.keep','fallback','expected {x, y, w, h} inside the art; the picture is fitted without it');
  }
  if(own(raw,'edge')){
    if(plain(raw.edge))
      R.ignore(raw.edge,['mode','color'],path+'.edge');
    else if(typeof raw.edge!=='string')R.note(path+'.edge','fallback','expected "fade", "mirror", "repeat" or {mode, color}; "fade" is used');
    const mode=typeof raw.edge==='string'?raw.edge:raw.edge?.mode,color=plain(raw.edge)&&own(raw.edge,'color')?R.colour(raw.edge.color,path+'.edge.color')?.[0]:undefined;
    out.edge={mode:edgeModes.includes(mode)?mode:'fade',...(color?{color}:{})};
    src.edge={...out.edge};
    if(mode!==undefined&&!edgeModes.includes(mode))R.note(path+'.edge','fallback','unknown edge; "fade" is used');
    R.use('edge');
  }
  if(own(raw,'text')){if(texts.includes(raw.text)){out.text=src.text=raw.text;R.use('text');}else R.note(path+'.text','fallback','expected "light", "dark" or "auto"; the default is used');}
  if(own(raw,'shade')){
    const s=raw.shade;
    if(plain(s))R.ignore(s,['color','strength'],path+'.shade');
    const color=R.colour(plain(s)?s.color:s,path+'.shade.color')?.[0];
    if(color){const strength=plain(s)&&own(s,'strength')?R.number(s.strength,path+'.shade.strength',0,1):undefined;out.shade={color,strength:strength??.7};src.shade={...out.shade};R.use('shade');}
  }
  if(own(raw,'fade')){
    const f=raw.fade;
    if(plain(f))R.ignore(f,['color','left'],path+'.fade');
    const color=plain(f)&&!own(f,'color')?undefined:R.colour(plain(f)?f.color:f,path+'.fade.color')?.[0],left=plain(f)&&own(f,'left')?R.number(f.left,path+'.fade.left',0,1):undefined;
    if(color||left!==undefined){out.fade={...(color?{color}:{}),...(left!==undefined?{left}:{})};src.fade={...out.fade};R.use('fade');if(left!==undefined)R.use('fade:left');}
  }
  if(own(raw,'narrowBelow')){const v=R.number(raw.narrowBelow,path+'.narrowBelow',1,12);if(v!==undefined)out.narrowBelow=src.narrowBelow=v;}
  const list=[...(own(raw,'pieces')&&Array.isArray(raw.pieces)?raw.pieces:[]),...(own(raw,'effects')&&Array.isArray(raw.effects)?raw.effects:[])];
  if(own(raw,'pieces')||own(raw,'effects')){
    if(own(raw,'pieces')&&!Array.isArray(raw.pieces))R.note(path+'.pieces','fallback','expected a list of pieces; none are drawn');
    out.pieces=R.pieces(list,path+'.pieces',U,shared);
    src.pieces=list;
    if(out.pieces.length)R.use('pieces');
  }
  return {out,box:used,src};
 }
 /* clean(raw band, hooks) -> {band, notes, needs, source}: band is what the renderer reads; source is the same band in
     the pack's own words with everything unknown or unusable left out (it reads back to the same band). hooks.picture(raw, path, strict) returns the placed picture
    ({asset, still, stillAsset, loop}) or null; hooks.image(id) says whether an asset is a still picture a piece may draw. */
 function clean(raw,hooks={}){
  const source={},
    names={...times},
    R=reader(hooks,names),
    top=[...pictureKeys,...lookKeys,'dark','variants','recipes','times'],
    pick=(value,keys)=>Object.fromEntries(keys.filter(key=>own(value,key)).map(key=>[key,value[key]]));
  R.ignore(raw,top,'$.band');
  // a pack's own names for parts of the day (they may also move dawn, day, dusk and night)
  if(own(raw,'times')){
   if(!plain(raw.times))R.note('$.band.times','fallback','expected {name: [from, to]}; the built-in times are used');
   else{
     let n=0;
     for(const key of Object.keys(raw.times)){
       const s=span(raw.times[key]);
       if(!s||!/^[a-z][a-z0-9-]{0,23}$/.test(key)||n>=12)R.note('$.band.times.'+key,'skipped','expected a short lower-case name and [from, to] hours; left out');else{names[key]=s;n++;}
     }
     if(n){R.use('times');source.times=raw.times;}
   }
  }
  const band={...(hooks.picture?.(pick(raw,pictureKeys),'$.band',true)||{})},shared=own(raw,'recipes')&&plain(raw.recipes)?raw.recipes:null;
  Object.assign(source,band);
   if(own(raw,'recipes')){if(shared){R.use('recipes');source.recipes=raw.recipes;}else R.note('$.band.recipes','fallback','expected {name: piece or [pieces]}; no own recipes');}
  const main=look(raw,'$.band',R,hooks,null,shared);Object.assign(band,main.out);Object.assign(source,main.src);
  // a second picture (dark, narrow, a variant): its own picture keys travel together; everything else overrides one by one
  function other(value,path,strict,keys){
   if(!plain(value)){if(strict)hooks.picture?.(value,path,true);else R.note(path,'skipped','expected an object; left out');return null;}
   R.ignore(value,keys,path);const out={},src={};
   if(own(value,'asset')||strict){
     const picture=hooks.picture?.(pick(value,pictureKeys),path,strict);
     if(!picture&&!strict){R.note(path,'skipped','its picture cannot be used; left out');return null;}
     Object.assign(out,picture||{});
     Object.assign(src,picture||{});
   }
   const seen=look(pick(value,keys),path,R,hooks,main.box,shared);Object.assign(out,seen.out);Object.assign(src,seen.src);
   if(own(value,'narrow')){
     const narrow=other(value.narrow,path+'.narrow',false,[...pictureKeys,'focus','box','keep','pieces','effects','edge']);
     if(narrow?.out.asset){out.narrow=narrow.out;src.narrow=narrow.src;R.use('narrow');}else if(narrow)R.note(path+'.narrow','skipped','a narrow picture needs "asset"; left out');
   }
   return {out,src};
  }
  if(own(raw,'narrow')){
    const narrow=other(raw.narrow,'$.band.narrow',false,[...pictureKeys,'focus','box','keep','pieces','effects','edge']);
    if(narrow?.out.asset){band.narrow=narrow.out;source.narrow=narrow.src;R.use('narrow');}else if(narrow)R.note('$.band.narrow','skipped','a narrow picture needs "asset"; left out');
  }
  if(own(raw,'dark')){
    const strict=!plain(raw.dark)||own(raw.dark,'asset'),dark=other(raw.dark,'$.band.dark',strict,[...pictureKeys,...lookKeys]);
    if(dark){band.dark=dark.out;source.dark=dark.src;if(Object.keys(dark.out).some(key=>!pictureKeys.includes(key)))R.use('dark look');}
  }
  if(own(raw,'variants')){
   if(!Array.isArray(raw.variants))R.note('$.band.variants','fallback','expected a list; no variants');
   else{
    const out=[],kept=[];raw.variants.slice(0,6).forEach((value,i)=>{
     const path='$.band.variants['+i+']';if(!plain(value)||!plain(value.when)){R.note(path,'skipped','a variant needs "when"; left out');return;}
     const when=R.condition(value.when,path+'.when');if(!when){R.note(path+'.when','skipped','unknown condition; this variant is left out');return;}
     const item=other(value,path,false,[...pictureKeys,...lookKeys,'when']);if(item){item.out.when=when;out.push(item.out);kept.push({...item.src,when:value.when});}
    });
    if(raw.variants.length>6)R.note('$.band.variants','clamped','only the first 6 variants are read');if(out.length){band.variants=out;source.variants=kept;R.use('variants');}
   }
  }
  const uses=[...R.uses].sort(),needs={level:uses.reduce((n,name)=>Math.max(n,since(name)),1),uses};
  return {band,notes:R.notes,needs,source:JSON.parse(JSON.stringify(source))};
 }
 // What a reader of an older level does with these uses (level 1 knows no block at all and refuses the pack).
 const older=(needs,at)=>needs.uses.filter(name=>since(name)>at);
 // ---- choosing what shows
 const inHours=(hour,from,to)=>from<=to?hour>=from&&hour<to:hour>=from||hour<to;
 /* How much a span of the clock is on at an hour: 1 all through the span, and with a fade (minutes) it comes in over
    that long before the span starts and leaves over that long after it ends, so two pictures listed for neighbouring
    spans cross-fade cleanly whichever is on top. */
 const soft=(hour,from,to,fade)=>{
   if(inHours(hour,from,to))return 1;
   if(!(fade>0)||from===to)return 0;
   const before=((from-hour)%24+24)%24,after=((hour-to)%24+24)%24;
   return Math.max(0,1-Math.min(before,after)*60/fade);
 };
 // presence(when, env) -> 0..1. env: {mode, hour (local, with minutes as a fraction), month, day (0-6, Sunday 0), narrow}
 // A weekday holds from midnight to midnight with no fade: after midnight it is the next day.
 function presence(when,env={}){
  if(!when)return 1;
  if(when.mode&&when.mode!==env.mode)return 0;
  if(when.months&&!when.months.includes(env.month??1))return 0;
  if(when.days&&!when.days.includes(env.day??0))return 0;
  if(when.weeks&&when.weeks!==((env.week??1)%2?'odd':'even'))return 0;
  if(when.width&&(when.width==='narrow')!==!!env.narrow)return 0;
  const hour=env.hour??12;let w=1;
  if(when.spans)w=Math.max(0,...when.spans.map(s=>soft(hour,s[0],s[1],when.fade)));
  if(when.hours)w=Math.min(w,soft(hour,when.hours[0],when.hours[1],when.fade));
  return Math.round(w*64)/64;
 }
 // a picture switches at the stated hour (no fade); pieces and their looks fade
 const matches=(when,env={})=>presence(when&&when.fade?{...when,fade:0}:when,env)>0;
 const clocked=when=>!!(when&&(when.time||when.hours||when.months||when.days||when.weeks));
 // the week of the year a date falls in, as ISO 8601 counts (weeks start on Monday; week 1 holds the year's first Thursday)
 const week=date=>{
   const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())),day=d.getUTCDay()||7;
   d.setUTCDate(d.getUTCDate()+4-day);
   return Math.ceil(((d-new Date(Date.UTC(d.getUTCFullYear(),0,1)))/864e5+1)/7);
 };
 const timed=band=>
   !!band&&
     [band,band.dark,band.narrow,band.dark?.narrow,...(band.variants||[]),...(band.variants||[]).map(item=>item.narrow)].some(item=>
       item&&(clocked(item.when)||(item.pieces||[]).some(piece=>clocked(piece.when)||(piece.variants||[]).some(v=>clocked(v.when)))));
 function over(base,item){
   const out={...base};
   if(own(item,'asset'))for(const key of pictureKeys)delete out[key];
   for(const key of Object.keys(item))if(key!=='when'&&key!=='narrow'&&key!=='dark'&&key!=='variants')out[key]=item[key];
   if(item.narrow)out.narrow=item.narrow;
   return out;
 }
 /* resolve(band, env) -> the one look to show. env: {mode, hour, month, ratio (band width / height)}.
    Order: the band, then band.dark in dark mode, then the first variant whose "when" holds, then the narrow picture. */
 function resolve(band,env={}){
  /* (the phone picture takes over below 2.5:1, a phone or a tablet held upright; it was 4, which also caught a 1366 laptop with Help open, 3.5:1) */const below=band.narrowBelow??2.5,
    narrow=fin(env.ratio)&&env.ratio<below,
    at={...env,narrow};
  let out={...band};delete out.dark;delete out.variants;
  if(env.mode==='dark'&&band.dark)out=over(out,band.dark);
  const variant=(band.variants||[]).find(item=>matches(item.when,at));if(variant)out=over(out,variant);
  const slim=fin(env.ratio)&&env.ratio<(out.narrowBelow??below)&&out.narrow;if(slim){const {narrow:n,...rest}=out;out=over(rest,n);out.narrowOn=true;}
  delete out.narrow;
  // a piece stays the same object while nothing about it follows the clock; otherwise it carries how present it is now
  out.pieces=(out.pieces||[]).flatMap(piece=>{
   const w=presence(piece.when,at);if(!w)return [];if(w===1&&!piece.variants)return [piece];
   const shift=(piece.variants||[]).map(v=>({w:presence(v.when,at),...(v.opacity?{opacity:v.opacity}:{}),...(v.color?{color:v.color}:{})})).filter(v=>v.w>0);
   return [w===1&&!shift.length?piece:{...piece,...(w<1?{presence:w}:{}),...(shift.length?{shift}:{})}];
  });
  return out;
 }
 // ---- fitting: where the art's box lands in a band of view.w x view.h (CSS object-fit: cover with a focus, then keep)
 function fit(art,view,options={}){
  const fx=options.focus?.x??1,fy=options.focus?.y??.5,k=options.keep,cover=Math.max(view.w/art.w,view.h/art.h);let s=cover;
  if(k)s=Math.min(cover,Math.max(Math.min(view.w/(k.w*art.w),view.h/(k.h*art.h)),cover*(options.floor??.5)));
  const w=art.w*s,h=art.h*s;let x=(view.w-w)*fx,y=(view.h-h)*fy;
  if(k){
    const lx=-k.x*w,hx=view.w-(k.x+k.w)*w,ly=-k.y*h,hy=view.h-(k.y+k.h)*h;
    x=hx>=lx?clamp(x,Math.max(lx,Math.min(0,view.w-w)),Math.min(hx,Math.max(0,view.w-w))):view.w/2-(k.x+k.w/2)*w;
    y=hy>=ly?clamp(y,Math.max(ly,Math.min(0,view.h-h)),Math.min(hy,Math.max(0,view.h-h))):view.h/2-(k.y+k.h/2)*h;
  }
  const gap={left:Math.max(0,x),right:Math.max(0,view.w-x-w),top:Math.max(0,y),bottom:Math.max(0,view.h-y-h)};let kept=1;
  if(k){
    const a=Math.max(0,Math.min(view.w,x+(k.x+k.w)*w)-Math.max(0,x+k.x*w)),b=Math.max(0,Math.min(view.h,y+(k.y+k.h)*h)-Math.max(0,y+k.y*h));
    kept=a*b/(k.w*w*k.h*h);
  }
  return {x,y,w,h,scale:s,cover,covers:s>=cover-1e-9,gap,kept};
 }
 // A picture that is not band shaped (under 5:1) and gives no keep gets one around its focus, so it sits whole at any width.
 const autoKeep=(art,focus)=>{
   if(!art||!(art.w>=240&&art.h>=120)||art.w/art.h>=5)return null;
   const h=.56,w=Math.min(1,h*art.h*1.9/art.w),cx=focus?.x??.5,cy=focus?.y??.5,x=clamp(cx-w/2,0,1-w),y=clamp(cy-h/2,0,1-h);
   return {x,y,w,h};
 };
 /* detail(rgba, w, h): where a small copy of the picture has its detail (the focus when a pack gives none), the colour of
    each side edge (what "edge: fade" fades into) and a coarse luminance grid (for "text: auto"). Deterministic. */
 function detail(data,w,h){
  const lum=i=>(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255,cols=new Float64Array(w),rows=new Float64Array(h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4,e=Math.abs(lum(i+4)-lum(i-4))+Math.abs(lum(i+w*4)-lum(i-w*4)),g=e*e;cols[x]+=g;rows[y]+=g;}
  const centre=(list,n)=>{let sum=0,at=0;for(let i=0;i<n;i++){const weight=list[i]*(1-.35*Math.abs((i+.5)/n-.5)*2);sum+=weight;at+=weight*(i+.5)/n;}return sum>1e-9?clamp(at/sum,.12,.88):.5;};
  const side=(x0,x1,y0,y1)=>{
    let r=0,g=0,b=0,n=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*4;r+=data[i];g+=data[i+1];b+=data[i+2];n++;}
    return '#'+[r,g,b].map(v=>Math.round(v/Math.max(1,n)).toString(16).padStart(2,'0')).join('');
  };
  const band=Math.max(1,Math.round(w*.05)),strip=Math.max(1,Math.round(h*.08)),gw=Math.min(16,w),gh=Math.min(8,h),grid=[];
  for(let gy=0;gy<gh;gy++)
    for(let gx=0;gx<gw;gx++){
      let sum=0,n=0;
      for(let y=Math.floor(gy*h/gh);y<Math.floor((gy+1)*h/gh);y++)for(let x=Math.floor(gx*w/gw);x<Math.floor((gx+1)*w/gw);x++){sum+=lum((y*w+x)*4);n++;}
      grid.push(n?sum/n:0);
    }
  return {x:centre(cols,w),y:centre(rows,h),left:side(0,band,0,h),right:side(w-band,w,0,h),top:side(0,w,0,strip),bottom:side(0,w,h-strip,h),grid:{w:gw,h:gh,l:grid}};
 }
 // mean luminance (0..1) of a part of the art given as fractions, from detail().grid
 function shadeOf(grid,x0,y0,x1,y1){
   let sum=0,n=0;
   for(let gy=0;gy<grid.h;gy++)for(let gx=0;gx<grid.w;gx++){const cx=(gx+.5)/grid.w,cy=(gy+.5)/grid.h;if(cx>=x0&&cx<=x1&&cy>=y0&&cy<=y1){sum+=grid.l[gy*grid.w+gx];n++;}}
   return n?sum/n:null;
 }
 /* The top of Home at five window sizes (Help closed): the band in px and the greeting's box in it. Measured on the
    bench; the checker uses them to warn when a keep box is cut or the greeting sits on low contrast. */
 const sizes=[
   {name:'390x844',w:390,h:540,greeting:{x:8,y:164,w:300,h:55}},
   {name:'1280x720',w:1280,h:314,greeting:{x:20,y:106,w:320,h:36}},
   {name:'1366x768',w:1366,h:276,greeting:{x:20,y:105,w:321,h:37}},
   {name:'1920x1080',w:1920,h:306,greeting:{x:24,y:133,w:334,h:38}},
   {name:'2560x1440',w:2560,h:344,greeting:{x:24,y:172,w:334,h:38}}
 ];
 function report(band,art){
  const out=[];if(!art?.w||!art?.h)return out;
  for(const size of sizes){
    const view={w:size.w,h:size.h},seen=resolve(band,{mode:'light',ratio:size.w/size.h});
    if(seen.narrowOn||!seen.keep)continue;
    const f=fit(art,view,{focus:seen.focus,keep:seen.keep});
    if(f.kept<.98)out.push({size:size.name,kept:f.kept});
  }
  return out;
 }
 const capabilities=()=>
   ({
     level,
     draw:[...shapes,...lights,...washes,'image'],
     at:['point','area','line',...edges,'all'],
     count:['count','density','spacing'],
     move:moves.filter(name=>name!=='none'),
     when:['every','lasts','mode','time','hours','fade','months','days','weeks','width','times'],
     look:['color','ink','size','opacity','look','scale','turn','pivot','react','variants'],
     fit:['focus','box','keep','narrow','narrowBelow','edge','text','shade','fade','dark','variants'],
     edge:edgeModes.slice(),
     recipes:Object.keys(recipes),
     companion:true
   });
 const api=Object.freeze({
   level,
   shapes,
   lights,
   washes,
   edges,
   moves,
   flow,
   motion,
   times,
   palette,
   pictureKeys,
   recipes,
   hex,
   clock,
   clean,
   older,
   since,
   presence,
   matches,
   timed,
   week,
   resolve,
   fit,
   autoKeep,
   detail,
   shadeOf,
   sizes,
   report,
   capabilities
 });
 root.ReserveBandKit=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
