/* The band's pieces: one renderer for every piece a theme pack's band lists (see band-kit.js for the blocks).
   plan(state) turns the pieces into layers of items, pose(layer, i, t) says where one item is at time t (both pure,
   no DOM), and mount(host) owns the one canvas that draws them. Nothing here knows a recipe by name: a look is only
   the blocks a piece picked. Matter is drawn (ink outline over an offset colour wash), light is rendered (soft,
   additive). The canvas never takes the pointer, and no frame is asked for unless something is moving and visible. */
(function(root){
 'use strict';
 const K=root.ReserveBandKit||(typeof module==='object'&&typeof require==='function'?require('./band-kit.js'):null);
 const TAU=Math.PI*2,clamp=(n,a,b)=>Math.min(b,Math.max(a,n)),lerp=(a,b,t)=>a+(b-a)*t,frac=n=>n-Math.floor(n),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 function hash(a,b,c){
   let h=Math.imul((a|0)^0x9E3779B9,0x85EBCA6B)^Math.imul((b|0)+0x7F4A7C15,0xC2B2AE35)^Math.imul((c|0)^0x165667B1,0x27D4EB2F);
   h^=h>>>15;
   h=Math.imul(h,0x2C1B3C6D);
   h^=h>>>12;
   h=Math.imul(h,0x297A2D39);
   h^=h>>>15;
   return (h>>>0)/4294967296;
 }
 const code=name=>{let h=7;for(let i=0;i<name.length;i++)h=(Math.imul(h,31)+name.charCodeAt(i))|0;return h;};
 const pick=(range,r,fallback)=>range?lerp(range[0],range[1],r):fallback;
 // Graphics: Low is a still of what a pack placed (pictures, washes, one thing at a point, a row along a line) with
 // nothing scattered or passing; Medium half the scatter at half the frames; Extra high richer.
 const budgets={
   low:{still:true,sparse:true,many:1,items:60,dpr:1,skip:1},
   medium:{many:.5,items:90,dpr:1,skip:2},
   high:{many:1,items:220,dpr:1.5,skip:1},
   xhigh:{many:1.5,items:360,dpr:2,skip:1}
 };
 const sheets=['haze','ribbon','flash'];
 // ---- where: a piece's place in band pixels (art = where the picture's box sits in the band, view = the band)
 function place(at,art,view){
  const H=art.h,o=at?.o||{x:0,y:0},ox=art.x+o.x*art.w,oy=art.y+o.y*art.h,px=p=>at.rel?[ox+p[0]*H,oy+p[1]*H]:[art.x+p[0]*art.w,art.y+p[1]*art.h];
  if(!at||at.type==='all')return {type:'all',x:0,y:0,w:view.w,h:view.h};
  if(at.type==='edge'){
    const side=Math.min(view.w*.18,view.h*1.2),strip=view.h*.32;
    return at.edge==='top'?
      {type:'edge',edge:'top',x:0,y:0,w:view.w,h:strip}:
      at.edge==='bottom'?
        {type:'edge',edge:'bottom',x:0,y:view.h-strip,w:view.w,h:strip}:
        at.edge==='left'?{type:'edge',edge:'left',x:0,y:0,w:side,h:view.h}:{type:'edge',edge:'right',x:view.w-side,y:0,w:side,h:view.h};
  }
  if(at.type==='line'){
    const points=at.points.map(px),lengths=[0];
    for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
    return {type:'line',points,lengths,length:lengths[lengths.length-1],x:0,y:0,w:0,h:0};
  }
  const p=px([at.x,at.y]);if(at.type==='area')return {type:'area',x:p[0],y:p[1],w:at.w*(at.rel?H:art.w),h:at.h*(at.rel?H:art.h)};
  return {type:'point',x:p[0],y:p[1],w:0,h:0};
 }
 function along(region,f){
   const d=clamp(f,0,1)*region.length,L=region.lengths;
   let i=1;
   while(i<L.length-1&&L[i]<d)i++;
   const span=L[i]-L[i-1]||1,t=(d-L[i-1])/span,a=region.points[i-1],b=region.points[i];
   return [lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
 }
 /* plan(state) -> {layers, still, budget}. state: {pieces, art:{x,y,w,h}, view:{w,h}, graphics, moving, quiet:[rects]}.
    A layer is one piece with its items laid out; every number an item needs is fixed here from the piece's seed. */
 function plan(state){
  const B=budgets[state.graphics]||budgets.high,still=!!B.still||!state.moving,art=state.art,view=state.view,H=art.h,layers=[];
  for(const piece of state.pieces||[]){
   const draw=piece.draw||[],
     first=draw[0]||{},
     sheet=first.kind==='wash'||(first.kind==='light'&&sheets.includes(first.name)),
     moves=piece.move||[],
     flows=moves.filter(m=>K.flow.includes(m.type)),
     event=!!piece.every;
   if(!draw.length||(still&&(flows.length||event))||(B.sparse&&sheet&&first.kind==='light'))continue;
   const scale=piece.scale||1,
     region=place(piece.at,art,view),
     seed=piece.seed|0,
     image=first.kind==='image',
     whole=image&&!piece.size&&region.type==='all'&&piece.count===undefined&&piece.density===undefined,
     fill=image&&!piece.size&&region.type==='area'&&piece.count===undefined&&piece.density===undefined;
   let n=1,scatter=false;
   if(sheet||whole||fill)n=1;
   else if(region.type==='line')n=piece.count??Math.floor(region.length/((piece.spacing??.12)*H*scale))+1;
   else if(piece.count!==undefined)n=piece.count>2&&B.many<1?Math.ceil(piece.count*B.many):piece.count;
   else if(region.type==='point')n=1;
   else{scatter=true;n=Math.round((piece.density??(image?0:4))*B.many*(region.w*region.h)/(H*H));}
   n=clamp(n,scatter&&piece.density===0?0:1,400);if(!n||(B.sparse&&(scatter||(n>1&&region.type!=='line'))))continue;
   // a flow that leaves the edge it starts on crosses the whole band; along the edge it stays in the strip
   const mean=m=>m.speed?(m.speed[0]+m.speed[1])/2:(K.motion[m.type]?.speed??0),
     fx=flows.reduce((s,m)=>s+(m.type==='drift'||m.type==='cross'?mean(m):0),0),
     fy=flows.reduce((s,m)=>s+(m.type==='fall'?mean(m):m.type==='rise'?-mean(m):0),0),
     tall=Math.abs(fy)>=Math.abs(fx),
     e=region.type==='edge'?region.edge:'';
   const away=e==='bottom'?tall&&fy<0:e==='top'?tall&&fy>0:e==='left'?!tall&&fx>0:e==='right'?!tall&&fx<0:false,reach=away?(tall?view.h:view.w):0;
   const emit=flows.some(m=>m.amount)||away||(flows.length&&(region.type==='point'||region.type==='line')),mode=!flows.length?'rest':emit?'emit':flows.some(m=>m.type==='cross')?'flock':'through';
   layers.push({
     piece,
     draw,
     sheet,
     whole,
     fill,
     region,
     reach,
     presence:piece.presence??1,
     shift:piece.shift||null,
     seed,
     sync:(piece.sync??seed)|0,
     n,
     scatter,
     mode,
     moves,
     flows,
     scale,
     H,
     view,
     light:first.kind==='light'||piece.look==='light',
     pan:moves.find(m=>m.type==='pan')||null,
     streak:moves.find(m=>m.type==='streak')||null,
     react:piece.react==='pointer'&&!still&&!B.still&&state.graphics!=='medium',
     quiet:!sheet&&!image?state.quiet||[]:[],
     items:null
   });
  }
  // thin, never refuse. Loose items (scattered, or more than one of a thing) are first held to the paint one layer
  // may ask for (the band four times over), then share the count budget in proportion, then the paint of all of them
  // together (the band twelve times over). A single placed thing is not counted.
  const loose=layers.filter(l=>l.scatter||l.n>1),room=view.w*view.h,thinTo=k=>{for(const l of loose)l.n=Math.max(1,Math.floor(l.n*k));};
  const paint=l=>{const s=l.piece.size,mid=s?(s[0]+s[1])/2:0;let most=0;for(const d of l.draw){let w,h;
   if(d.kind==='image'){
     const img=state.image?.(d.asset),nw=img?.naturalWidth||img?.width||1,nh=img?.naturalHeight||img?.height||1;
     h=(s?mid*H:state.box?nh*art.w/state.box[0]:.2*H)*l.scale;
     w=h*nw/nh;
   }
   else w=h=(s?mid:d.kind==='light'&&d.name==='glow'?.12:.05)*H*l.scale;
   most=Math.max(most,Math.min(w,view.w)*Math.min(h,view.h));}return most;};
  for(const l of loose){const a=paint(l);if(l.n*a>room*4)l.n=Math.max(1,Math.floor(room*4/a));}
  const count=loose.reduce((sum,l)=>sum+l.n,0);if(count>B.items)thinTo(B.items/count);
  const cover=loose.reduce((sum,l)=>sum+l.n*paint(l),0);if(cover>room*12)thinTo(room*12/cover);
  for(const layer of layers)layer.items=Array.from({length:layer.n},(_,i)=>item(layer,i));
  return {layers,still,budget:B};
 }
 function item(layer,i){
  const p=layer.piece,s=layer.seed,r=name=>hash(s,i,code(name)),H=layer.H,size=pick(p.size,r('size'),layer.draw[0].kind==='light'&&layer.draw[0].name==='glow'?.12:.05)*H*layer.scale;
  // the look by condition: later entries first, so the first listed one that is fully on has the last word
  let alpha=pick(p.opacity,r('opacity'),1);
  if(layer.shift)for(let j=layer.shift.length-1;j>=0;j--){const v=layer.shift[j];if(v.opacity)alpha=lerp(alpha,pick(v.opacity,r('opacity'),alpha),v.w);}
  const it={
    v:Math.floor(r('draw')*layer.draw.length)%layer.draw.length,
    size,
    cr:r('color'),
    color:Math.floor(r('color')*(p.color?.length||1)),
    shape:Math.floor(r('shape')*3),
    alpha:alpha*layer.presence,
    turn:pick(p.turn,r('turn'),0)*Math.PI/180,
   hx:frac(i*.7548776662+hash(s,0,code('hx'))),hy:frac(i*.5698402910+hash(s,0,code('hy'))),phase:frac(i*.6180339887+hash(s,0,code('phase'))),m:[],vx:0,vy:0,T:0,dist:0};
  for(const m of layer.moves){
   const d=K.motion[m.type]||{},
     far=K.flow.includes(m.type)||['sway','bob','float'].includes(m.type),
     amount=pick(m.amount,r(m.type+'a'),(d.amount??0))*(far?H*layer.scale:1),
     speed=pick(m.speed,r(m.type+'s'),d.speed??0),
     period=pick(m.period,r(m.type+'p'),d.period??0);
   it.m.push({type:m.type,amount,speed,period,phase:r(m.type+'f')});
   if(m.type==='fall')it.vy+=speed*H;else if(m.type==='rise')it.vy-=speed*H;else if(m.type==='drift'||m.type==='cross')it.vx+=speed*H;
   if(K.flow.includes(m.type)&&m.amount&&!it.dist)it.dist=amount;
  }
  return it;
 }
 // ---- when: the event a layer is in at time t (shared by a group through "sync"), or null
 function eventAt(layer,t){
  const e=layer.piece.every;if(!e)return {k:0,tau:t,D:0};
  const P=(e[0]+e[1])/2,jit=(e[1]-e[0])/2,key=layer.sync,tt=t+P*(.4+.5*hash(key,0,code('first')));
  for(let k=Math.floor(tt/P),n=0;n<2&&k>=0;k--,n++){
    const start=k*P+hash(key,k,code('every'))*jit,tau=tt-start;
    if(tau>=0)return {k,tau,D:pick(layer.piece.lasts,hash(layer.seed,k,code('lasts')),0)};
  }
  return null;
 }
 const ends=(u,a,b)=>smooth(u/a)*smooth((1-u)/b);
 /* pose(layer, i, t, out, pointer) -> out {x, y, size, rot, sx, sy, alpha, heading, tail} or null when the item is not
    on stage. Stateless: the same t always gives the same picture, so a still frame and a paused band cost nothing. */
 function pose(layer,i,t,out={},pointer=null){
  const it=layer.items[i],R=layer.region,view=layer.view,ev=eventAt(layer,t);if(!ev)return null;
  const timed=!!layer.piece.every,margin=it.size*.75;let x,y,alpha=it.alpha,rot=it.turn,sx=1,sy=1,u=0,k=ev.k,heading=null,vx=it.vx,vy=it.vy;
  const home=cycle=>{
    if(R.type==='line')return layer.mode==='rest'?along(R,layer.n>1?i/(layer.n-1):.5):along(R,hash(layer.seed+i*131,cycle,code('lane')));
    if(R.type==='point')return [R.x,R.y];
    const jx=cycle?hash(layer.seed+i*131,cycle,code('lane')):0,jy=cycle?hash(layer.seed+i*131,cycle,code('lane2')):0;
    return [R.x+frac(it.hx+jx)*R.w,R.y+frac(it.hy+jy)*R.h];
  };
  if(layer.mode==='rest'){
   [x,y]=home(timed?k+1:0);if(timed){const D=ev.D||1.2;u=ev.tau/D;if(u>=1)return null;alpha*=layer.draw[0].name==='flash'?ends(u,.05,.7):ends(u,.12,.35);}
  }else{
   const speed=Math.hypot(vx,vy)||1;
   if(layer.mode==='emit'){
    const dist=it.dist||layer.reach||.5*layer.H*layer.scale,T=dist/speed;if(timed){u=ev.tau/T;if(u>=1)return null;}else{const c=t/T+it.phase;k=Math.floor(c);u=c-k;}
    const start=home(k+1);x=start[0]+vx*u*T;y=start[1]+vy*u*T;alpha*=ends(u,.1,.3);
   }else{
    const flock=layer.mode==='flock',lead=flock?layer.items[0]:it;
    vx=lead.vx;
    vy=lead.vy;
    const wide=Math.abs(vx)>=Math.abs(vy),spread=flock?lead.size*9:0,L=(wide?R.w:R.h)+margin*2+spread,T=L/Math.max(1,Math.abs(wide?vx:vy));
    if(timed){u=ev.tau/T;if(u>=1)return null;}else{const c=t/T+(flock?hash(layer.seed,0,code('phase')):it.phase);k=Math.floor(c);u=c-k;}
    const lane=flock?hash(layer.seed,k,code('lane')):hash(layer.seed+i*131,k,code('lane')),
      ox=flock?(hash(layer.seed,i,code('fx'))-.5)*spread:0,
      oy=flock?(hash(layer.seed,i,code('fy'))-.5)*lead.size*4:0;
    if(wide){
      x=(vx>0?R.x-margin-spread/2:R.x+R.w+margin+spread/2)+vx*u*T+ox;
      const cross=Math.abs(vy)*T;
      y=R.y+lane*(R.h+cross)-(vy>0?cross:0)+vy*u*T+oy;
      if(flock)y=R.y+R.h*(.15+.7*lane)+vy*u*T+oy;
    }
    else{y=(vy>0?R.y-margin:R.y+R.h+margin)+vy*u*T;const cross=Math.abs(vx)*T;x=R.x+lane*(R.w+cross)-(vx>0?cross:0)+vx*u*T;}
    if((wide?R.w<view.w-1:R.h<view.h-1))alpha*=ends(u,.14,.14);
   }
   if(layer.streak)heading=Math.atan2(vy,vx);
  }
  const bx=x,by=y;let grow=1;
  for(const m of it.m){
   const w=m.period?TAU*(t/m.period+m.phase):0;
   switch(m.type){
    case 'sway':x+=m.amount*Math.sin(w);break;
    case 'bob':y+=m.amount*Math.sin(w);break;
    case 'float':x+=m.amount*Math.sin(w);y+=m.amount*.7*Math.sin(w*.73+m.phase*9);break;
    case 'spin':rot+=TAU*(m.speed*t+m.phase);break;
    case 'swing':rot+=m.amount*Math.PI/180*Math.sin(w);break;
    case 'flutter':sx*=Math.max(.08,1-m.amount*(.5-.5*Math.cos(w)));break;
    case 'flap':sy*=Math.max(.08,1-m.amount*(.5-.5*Math.cos(w)));break;
    case 'breathe':grow*=1+m.amount*Math.sin(w);break;
    case 'grow':grow*=1+m.amount*(layer.mode==='rest'&&!timed?frac(t/m.period+m.phase):u);break;
    case 'pulse':alpha*=1-m.amount*(.5-.5*Math.sin(w));break;
    case 'twinkle':alpha*=1-m.amount*(1-Math.pow(.5+.5*Math.sin(w),3));break;
    case 'flicker':{const c=t/m.period+m.phase*17,n=Math.floor(c),a=hash(layer.seed+i,n,code('flicker')),b=hash(layer.seed+i,n+1,code('flicker'));alpha*=1-m.amount*lerp(a,b,smooth(c-n));break;}
   }
  }
  const mx=x-bx,my=y-by;
  if(layer.pan&&!layer.sheet&&layer.mode==='rest'&&R.w>0){
    const span=R.w+margin*2;
    x=R.x-margin+frac((x-R.x+margin+layer.items[i].m.find(m=>m.type==='pan').speed*layer.H*t)/span)*span;
  }
  if(pointer&&layer.react){
    const dx=x-pointer.x,dy=y-pointer.y,d=Math.hypot(dx,dy),reach=view.h*.3;
    if(d<reach&&d>.01){const push=(1-d/reach)*(1-d/reach)*reach*.5;x+=dx/d*push;y+=dy/d*push;}
  }
  for(const q of layer.quiet){const dx=Math.max(q.x-x,0,x-q.x-q.w),dy=Math.max(q.y-y,0,y-q.y-q.h),d=Math.hypot(dx,dy);if(d<48)alpha*=lerp(.2,1,smooth((d-10)/38));}
  out.x=x;
  out.y=y;
  out.dx=mx;
  out.dy=my;
  out.grow=grow;
  out.size=it.size*grow;
  out.rot=rot;
  out.sx=sx;
  out.sy=sy;
  out.alpha=clamp(alpha,0,1);
  out.heading=heading;
  out.u=u;
  out.tail=layer.streak?it.size*(pick(layer.streak.amount,.5,K.motion.streak.amount)):0;
  return out.alpha>.004?out:null;
 }
 const pure={hash,place,plan,pose,eventAt,budgets};
 // ---- drawing. Colours are #rrggbb or a palette name the theme resolves; nothing else reaches the canvas.
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),
   mix=(a,b,t)=>a.map((v,i)=>Math.round(lerp(v,b[i],t))),
   css=(c,a=1)=>'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')',
   INK=[34,28,24],
   WHITE=[255,255,255];
 const S=text=>text.split(' ').map(p=>{const c=p.endsWith('!'),[x,y]=(c?p.slice(0,-1):p).split(',').map(Number);return [x,y,c];});
 const ring=(n,r1,r2,sharp)=>Array.from({length:n},(_,i)=>{const a=TAU*i/n-Math.PI/2,r=i%2?r2:r1;return [50+r*Math.cos(a),50+r*Math.sin(a),!!sharp&&!(i%2)];});
 /* The drawn shapes, each a few control outlines in a 100 box: f = washed and inked outlines, d = pen-filled parts,
    l = pen lines, h = hairs (a pale line with a pen edge). "!" marks a sharp tip. */
 const arms=(n,spec)=>Array.from({length:n},(_,k)=>spec.map(([r,d])=>{const a=TAU*k/n-Math.PI/2+d*Math.PI/180;return [50+r*Math.cos(a),50+r*Math.sin(a),true];})).flat();
 const shapes={
  dot:{f:[ring(8,45,45)]},flake:{f:[arms(6,[[12,-30],[25,-9],[38,-19],[36,-6],[49,0],[36,6],[38,19],[25,9]])]},star:{f:[ring(10,49,21,true)]},spark:{f:[ring(8,50,11,true)]},
  drop:{f:[S('50,3! 70,46 77,68 65,90 50,96 35,90 23,68 30,46')]},
  leaf:{f:[S('50,2! 82,28 85,58 67,84 50,95! 33,84 15,58 18,28')],l:[S('50,12 50,99'),S('50,42 69,31'),S('50,42 31,31'),S('50,64 70,54'),S('50,64 30,54')]},
  petal:{f:[S('50,97! 20,70 12,38 30,10 46,7 50,21! 54,7 70,10 88,38 80,70')],l:[S('50,90 50,62')]},
  feather:{f:[S('50,2 72,18 76,50 65,78 52,90! 35,78 24,50 28,18')],l:[S('50,8 50,99'),S('50,30 69,21'),S('50,50 71,43'),S('50,68 65,65'),S('50,30 31,21'),S('50,50 29,43'),S('50,68 35,65')]},
  seed:{h:[S('50,44 20,16'),S('50,44 34,6'),S('50,44 50,2'),S('50,44 66,6'),S('50,44 80,16'),S('50,44 12,34'),S('50,44 88,34')],l:[S('50,44 50,84')],d:[S('50,80 56,88 50,98 44,88')]},
  bird:{f:[S('2,40! 26,29 44,43 50,52 56,43 74,29 98,40! 76,39 58,54 50,67! 42,54 24,39')]},
  butterfly:{f:[S('52,48 63,13 92,9 97,40 74,53'),S('48,48 37,13 8,9 3,40 26,53'),S('53,52 76,56 89,78 68,93 54,70'),S('47,52 24,56 11,78 32,93 46,70')],d:[S('50,28 54,40 53,72 50,78 47,72 46,40')],l:[S('50,32 41,14'),S('50,32 59,14')]},
  cloud:{f:[S('12,70 4,52 22,42 28,24 50,16 64,28 78,24 94,42 96,62 86,72 50,74')]},
  lantern:{f:[S('32,22 68,22 82,50 68,80 32,80 18,50')],d:[S('36,13! 64,13! 64,22! 36,22!'),S('38,80! 62,80! 62,88! 38,88!')],l:[S('50,23 50,79'),S('37,25 31,50 37,77'),S('63,25 69,50 63,77'),S('50,13 50,3'),S('50,88 50,99')]},
  bubble:{f:[ring(10,46,46)],h:[S('24,40 29,26 43,18'),S('70,72 75,66')],glass:true},puff:{f:[ring(14,47,36)]},
  strip:{f:[S('18,34! 80,26! 84,62! 22,70!')]},fleck:{f:[S('26,14! 66,8 90,40! 72,82 36,92! 10,56')]},
  bolt:{f:[S('58,0! 28,46! 47,47! 32,100! 74,38! 54,37! 72,0!')]}
 };
 function trace(g,points,closed,wob){
  const P=points.map((p,i)=>[p[0]+wob(i,0),p[1]+wob(i,1),p[2]]),n=P.length,mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];g.beginPath();
  if(!closed){
    g.moveTo(P[0][0],P[0][1]);
    if(n===2)g.lineTo(P[1][0],P[1][1]);
    for(let i=1;i<n-1;i++){const m=i===n-2?P[n-1]:mid(P[i],P[i+1]);g.quadraticCurveTo(P[i][0],P[i][1],m[0],m[1]);}
    return;
  }
  const start=mid(P[n-1],P[0]);g.moveTo(start[0],start[1]);
  for(let i=0;i<n;i++){const m=mid(P[i],P[(i+1)%n]);if(P[i][2]){g.lineTo(P[i][0],P[i][1]);g.lineTo(m[0],m[1]);}else g.quadraticCurveTo(P[i][0],P[i][1],m[0],m[1]);}
  g.closePath();
 }
 const blank=(doc,w,h)=>{const c=doc.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c;};
 // one drawn or lit shape at px size, in a padded square (pad on every side as a share of px)
 const PAD={drawn:.2,light:.45};
 function sprite(doc,name,fill,ink,light,variant,px){
  const def=shapes[name],pad=light?PAD.light:PAD.drawn,side=px*(1+pad*2),c=blank(doc,side,side),g=c.getContext('2d');if(!g||!def)return null;
  const k=px/100,wob=(i,axis)=>(hash(code(name),variant*97+i,axis+11)-.5)*3.6,pen=Math.max(6.2,1.15/k);
  g.translate(px*pad,px*pad);g.scale(k,k);g.lineJoin=g.lineCap='round';
  if(light){
   const reach=50*(1+pad*1.9),halo=g.createRadialGradient(50,50,0,50,50,reach);
   halo.addColorStop(0,css(fill,.6));
   halo.addColorStop(.3,css(fill,.24));
   halo.addColorStop(.62,css(fill,.07));
   halo.addColorStop(1,css(fill,0));
   g.fillStyle=halo;
   g.fillRect(-100*pad,-100*pad,100*(1+pad*2),100*(1+pad*2));
   const hot=css(mix(fill,WHITE,.6));g.shadowColor=css(fill,.95);g.shadowBlur=px*.24;g.fillStyle=g.strokeStyle=hot;
   for(const path of [...(def.f||[]),...(def.d||[])]){trace(g,path,true,wob);g.fill();g.fill();}
   g.lineWidth=pen*.6;for(const path of [...(def.l||[]),...(def.h||[])]){trace(g,path,false,wob);g.stroke();}
   return c;
  }
  g.fillStyle=css(fill,def.glass?.2:1);for(const path of def.f||[]){g.save();g.translate(3.2,2.8);trace(g,path,true,wob);g.fill();g.restore();}
  const line=ink||mix(fill,INK,.25);g.strokeStyle=g.fillStyle=css(line);
  if(ink){g.lineWidth=def.glass?pen*.55:pen;for(const path of def.f||[]){trace(g,path,true,wob);g.stroke();}}
  for(const path of def.d||[]){trace(g,path,true,wob);g.fill();if(ink){g.lineWidth=pen*.5;g.stroke();}}
  g.lineWidth=pen*.6;for(const path of def.l||[]){trace(g,path,false,wob);g.stroke();}
  for(const path of def.h||[]){
    if(ink&&!def.glass){g.strokeStyle=css(line);g.lineWidth=pen*1.5;trace(g,path,false,wob);g.stroke();}
    g.strokeStyle=css(def.glass?WHITE:fill);
    g.lineWidth=pen*(def.glass?1.25:.7);
    trace(g,path,false,wob);
    g.stroke();
  }
  return c;
 }
 function glow(doc,fill){
   const px=128,c=blank(doc,px,px),g=c.getContext('2d'),r=px/2;
   if(!g)return null;
   const grad=g.createRadialGradient(r,r,0,r,r,r);
   for(const [stop,a] of [[0,1],[.16,.7],[.4,.27],[.68,.07],[1,0]])grad.addColorStop(stop,css(stop<.1?mix(fill,WHITE,.55):fill,a));
   g.fillStyle=grad;
   g.fillRect(0,0,px,px);
   return c;
 }
 // a beam: narrow and bright at its source (top), wide and gone at the far end
 function ray(doc,fill){
   const W=96,Hh=256,c=blank(doc,W,Hh),g=c.getContext('2d');
   if(!g)return null;
   const side=g.createLinearGradient(-W/2,0,W/2,0);
   for(const [stop,a] of [[0,0],[.3,.5],[.5,1],[.7,.5],[1,0]])side.addColorStop(stop,css(fill,a));
   g.fillStyle=side;
   for(let y=0;y<Hh;y++){const u=y/(Hh-1);g.globalAlpha=Math.pow(1-u,1.4)*smooth(u/.06);g.setTransform(lerp(.22,1,u),0,0,1,W/2,y);g.fillRect(-W/2,0,W,1.05);}
   return c;
 }
 function tail(doc,fill){
   const c=blank(doc,8,64),g=c.getContext('2d');
   if(!g)return null;
   const grad=g.createLinearGradient(0,0,0,64);
   grad.addColorStop(0,css(fill,0));
   grad.addColorStop(1,css(fill,.9));
   g.fillStyle=grad;
   g.beginPath();
   g.moveTo(4,0);
   g.lineTo(7,64);
   g.lineTo(1,64);
   g.closePath();
   g.fill();
   return c;
 }
 const noise=(x,y,wrap,seed)=>{
   const xi=Math.floor(x),yi=Math.floor(y),fx=smooth(x-xi),fy=smooth(y-yi),h=(a,b)=>hash(seed,((a%wrap)+wrap)%wrap,b);
   return lerp(lerp(h(xi,yi),h(xi+1,yi),fx),lerp(h(xi,yi+1),h(xi+1,yi+1),fx),fy);
 };
 // a sheet of haze that tiles sideways; profile says where it is thick: 'bottom', 'top' or 'mid'
 function haze(doc,fill,profile){
  const W=512,Hh=128,c=blank(doc,W,Hh),g=c.getContext('2d');if(!g||!g.createImageData)return null;const image=g.createImageData(W,Hh),d=image.data;
  for(let y=0;y<Hh;y++){const v=y/(Hh-1),shape=profile==='bottom'?Math.pow(smooth(v),1.3):profile==='top'?Math.pow(smooth(1-v),1.3):Math.sin(Math.PI*v);
   for(let x=0;x<W;x++){
     const n=.55*noise(x/128,y/30,4,1)+.3*noise(x/64,y/15,8,2)+.15*noise(x/32,y/8,16,3),i=(y*W+x)*4;
     d[i]=fill[0];
     d[i+1]=fill[1];
     d[i+2]=fill[2];
     d[i+3]=Math.round(255*smooth((n-.26)/.5)*shape);
   }}
  g.putImageData(image,0,0);return c;
 }
 // a curtain of light: a bright wavy lower border that fades upward, in up to three colours by height
 function ribbon(doc,colors){
  const W=512,Hh=192,c=blank(doc,W,Hh),g=c.getContext('2d');
  if(!g||!g.createImageData)return null;
  const image=g.createImageData(W,Hh),d=image.data,at=t=>{
    const n=colors.length-1,f=clamp(t,0,1)*n,i=Math.min(Math.max(n-1,0),Math.floor(f));
    return n?mix(colors[i],colors[i+1],f-i):colors[0];
  };
  for(let x=0;x<W;x++){const edge=(.62+.3*(noise(x/128,0,4,5)-.5)+.08*(noise(x/32,0,16,6)-.5))*Hh,streak=.4+.6*noise(x/7.111,0,72,7)*(.6+.4*noise(x/64,0,8,8));
   for(let y=0;y<Hh;y++){
     const up=(edge-y)/Hh,a=up<0?smooth(1+up*16):Math.exp(-up*3.4)*smooth((y/Hh)/.12),col=at(up/.6),i=(y*W+x)*4;
     d[i]=col[0];
     d[i+1]=col[1];
     d[i+2]=col[2];
     d[i+3]=Math.round(255*clamp(a*streak,0,1));
   }}
  g.putImageData(image,0,0);return c;
 }
 const BUCKETS=[10,14,20,28,40,56,80,112,160,224,320,448];
 /* mount(host) -> {set(state), frame(t), destroy(), canvas}. state adds to plan()'s: colors (the theme's resolved
    palette), image(id) (a loaded picture of the pack, or null) and box ([w, h], the art's own pixels). */
 function mount(host){
  const doc=host.ownerDocument||root.document,win=doc.defaultView||root,canvas=doc.createElement('canvas');
  canvas.className='rd-data-theme-pieces';
  canvas.setAttribute('aria-hidden','true');
  canvas.setAttribute('data-rd-keep','');
  canvas.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
  host.appendChild(canvas);
  const g=typeof canvas.getContext==='function'?canvas.getContext('2d'):null,cache=new Map(),out={};
  let state=null,laid=null,raf=0,dead=false,tick=0,dpr=1,pointer=null,listening=false,thin=1,slow=1,cost=0,seen=-180,last=0,streak=0,hold=4,wait=0,fresh=0;const gaps=[];
  // the drawn sprites, tiles and glows kept for reuse: at most 480 of them and 48 MB of pixels, the least recently drawn
  // going first, but never one the frame being drawn uses (so a band that needs more than that does not redraw them)
  let held=0,stamp=0;const bytes=v=>v?(v.width*v.height*4)||0:0;
  const cached=(key,make)=>{
    let e=cache.get(key);
    if(e){cache.delete(key);e.at=stamp;cache.set(key,e);return e.v;}
    e={v:make(),at:stamp};
    cache.set(key,e);
    held+=bytes(e.v);
    for(const [k,old] of cache){if(old.at===stamp||(cache.size<=480&&held<=48e6))break;cache.delete(k);held-=bytes(old.v);}
    return e.v;
  };
  const tone=value=>{const v=value&&value[0]==='#'?value:state.colors?.[value];return rgb(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:'#ffffff');};
  // colours by condition blend toward each variant by how present it is (worked out once per item, not per frame)
  const blend=(layer,base,at)=>{
    if(layer.shift)for(let j=layer.shift.length-1;j>=0;j--){const v=layer.shift[j];if(v.color)base=mix(base,tone(v.color[at(v.color.length)]),v.w);}
    return base;
  };
  const fillOf=(layer,it)=>it.fill||(it.fill=blend(layer,tone(layer.piece.color?.[it.color]||'#ffffff'),n=>Math.min(n-1,Math.floor(it.cr*n))));
  const tones=layer=>layer.tones||(layer.tones=(layer.piece.color||['#ffffff']).map((c,i)=>blend(layer,tone(c),n=>i%n)));
  const onMove=event=>{
    const r=canvas.getBoundingClientRect();
    pointer=event.clientY>=r.top-40&&event.clientY<=r.bottom+40?{x:event.clientX-r.left,y:event.clientY-r.top}:null;
  };
  const live=()=>!!(g&&laid&&!laid.still&&state.moving&&state.clock===undefined&&laid.layers.some(l=>l.mode!=='rest'||l.moves.length||l.piece.every));
  function sheet(layer,p,t){
   const R=layer.region,d=layer.draw[0],piece=layer.piece,it=layer.items[0],H=layer.H,pan=it.m.find(m=>m.type==='pan'),shift=pan?pan.speed*H*t:0;g.globalAlpha=p.alpha;
   if(d.kind==='image'){
    const img=state.image?.(d.asset);
    if(!img)return;
    const base=layer.whole?state.art:R,k=p.grow,a={x:base.x+p.dx-base.w*(k-1)/2,y:base.y+p.dy-base.h*(k-1)/2,w:base.w*k,h:base.h*k};
    if(!pan){g.drawImage(img,a.x,a.y,a.w,a.h);return;}
    g.save();g.beginPath();g.rect(a.x,a.y,a.w,a.h);g.clip();for(let x=a.x-frac(-shift/a.w)*a.w;x<a.x+a.w;x+=a.w)g.drawImage(img,x,a.y,a.w+.5,a.h);g.restore();return;
   }
   const colors=tones(layer),edge=R.type==='edge'?R.edge:null;
   if(d.kind==='wash'||d.name==='flash'){
    if(edge){
      const grad=edge==='top'?
        g.createLinearGradient(0,R.y,0,R.y+R.h):
        edge==='bottom'?g.createLinearGradient(0,R.y+R.h,0,R.y):edge==='left'?g.createLinearGradient(R.x,0,R.x+R.w,0):g.createLinearGradient(R.x+R.w,0,R.x,0);
      grad.addColorStop(0,css(colors[0],1));
      grad.addColorStop(1,css(colors[colors.length-1],0));
      g.fillStyle=grad;
    }
    else if(colors.length>1){const grad=g.createLinearGradient(0,R.y,0,R.y+R.h);colors.forEach((c,i)=>grad.addColorStop(i/(colors.length-1),css(c)));g.fillStyle=grad;}
    else g.fillStyle=css(colors[0]);
    g.fillRect(R.x,R.y,R.w,R.h);return;
   }
   // haze and ribbon: a tile as tall as the sheet, repeated sideways, sliding with "pan"
   const tall=piece.size?Math.min(layer.view.h*1.5,it.size):R.h,top=edge==='bottom'?R.y+R.h-tall:R.y,where=edge==='top'?'top':edge==='bottom'?'bottom':'mid';
   const tile=d.name==='haze'?cached('haze|'+colors[0]+'|'+where,()=>haze(doc,colors[0],where)):cached('ribbon|'+colors.join(';'),()=>ribbon(doc,colors));
   if(!tile)return;const wide=tall*tile.width/tile.height,clip=R.type==='area';if(clip){g.save();g.beginPath();g.rect(R.x,R.y,R.w,R.h);g.clip();}
   const snap=v=>Math.round(v*dpr)/dpr,step=Math.max(1/dpr,snap(wide),R.w/128);
   for(let x=snap(R.x-frac(-shift/wide+hash(layer.seed,0,3))*wide);x<R.x+R.w;x+=step)g.drawImage(tile,x,top+p.dy,step,tall);
   if(clip)g.restore();
  }
  function one(layer,it,p){
   const d=layer.draw[it.v],piece=layer.piece,fill=fillOf(layer,it),pivot=piece.pivot;let rot=p.rot;
   if(p.tail>0&&p.heading!==null){
     const tip=cached('tail|'+fill,()=>tail(doc,fill)),a=p.heading-Math.PI/2,cos=Math.cos(a)*dpr,sin=Math.sin(a)*dpr,w=Math.max(1.2,p.size*.2);
     if(tip){g.globalAlpha=p.alpha*.85;g.setTransform(cos,sin,-sin,cos,p.x*dpr,p.y*dpr);g.drawImage(tip,-w/2,-p.tail,w,p.tail);}
     rot+=a;
   }
   const cos=Math.cos(rot)*dpr,sin=Math.sin(rot)*dpr;g.setTransform(cos*p.sx,sin*p.sx,-sin*p.sy,cos*p.sy,p.x*dpr,p.y*dpr);g.globalAlpha=p.alpha;
   if(d.kind==='image'){
     const img=state.image?.(d.asset);
     if(!img)return;
     const nw=img.naturalWidth||img.width||1,
       nh=img.naturalHeight||img.height||1,
       h=piece.size?p.size:state.box?nh*state.art.w/state.box[0]*p.grow*layer.scale:p.size*4,
       w=h*nw/nh;
     g.drawImage(img,-w*(pivot?.x??.5),-h*(pivot?.y??.5),w,h);
     return;
   }
   if(d.kind==='light'){
    if(d.name==='ray'){const beam=cached('ray|'+fill,()=>ray(doc,fill));if(beam){const w=p.size*.42;g.drawImage(beam,-w*(pivot?.x??.5),-p.size*(pivot?.y??0),w,p.size);}return;}
    const spot=cached('glow|'+fill,()=>glow(doc,fill));if(spot)g.drawImage(spot,-p.size*(pivot?.x??.5),-p.size*(pivot?.y??.5),p.size,p.size);return;
   }
   const light=piece.look==='light',
     need=p.size*dpr,
     px=BUCKETS.find(b=>b>=need)||BUCKETS[BUCKETS.length-1],
     ink=piece.ink===false||light?null:piece.ink?tone(piece.ink):mix(fill,INK,.72);
   const s=cached(d.name+'|'+fill+'|'+ink+'|'+light+'|'+it.shape+'|'+px,()=>sprite(doc,d.name,fill,ink,light,it.shape,px));if(!s)return;
   const pad=light?PAD.light:PAD.drawn,full=p.size*(1+pad*2);g.drawImage(s,-p.size*(pivot?.x??.5)-p.size*pad,-p.size*(pivot?.y??.5)-p.size*pad,full,full);
  }
  // draw the band's pieces as they are at time t (seconds); returns how many things were drawn
  function frame(t){
   if(!g||!laid||dead)return 0;
   stamp++;
   const view=state.view;
   let count=0;
   g.setTransform(dpr,0,0,dpr,0,0);
   g.globalAlpha=1;
   g.globalCompositeOperation='source-over';
   g.clearRect(0,0,view.w,view.h);
   for(const layer of laid.layers){
    g.globalCompositeOperation=layer.light?'lighter':'source-over';
    if(layer.sheet||layer.whole||layer.fill){const p=pose(layer,0,t,out,null);if(p){g.setTransform(dpr,0,0,dpr,0,0);sheet(layer,p,t);count++;}continue;}
    const loose=thin<1&&(layer.scatter||layer.n>1);
    for(let i=0;i<layer.n;i++){
      if(loose&&i&&(i*.6180339887)%1>=thin)continue;
      const p=pose(layer,i,t,out,layer.react?pointer:null);
      if(!p)continue;
      const m=p.size+p.tail;
      if(p.x<-m||p.x>view.w+m||p.y<-m||p.y>view.h+m)continue;
      one(layer,layer.items[i],p);
      count++;
    }
   }
   g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';return count;
  }
  /* The governor. A budget is a guess about the machine; this is the measurement, taken in windows of 45 frames once the
     page has had three seconds to settle. Two signs say the pieces are too much here: drawing them takes more than about
     7 ms of script time, or frames arrive late (a gap of more than one and a half of the window's own quick pace, the
     lower quartile of its gaps: a screen that is slow but steady, or one that changes its rate between 120, 60 and 30 a
     second, has no late frames and is not mistaken for a slow machine). Two such windows in a row and a fifth of the
     loose items are left out (evenly, the same ones every frame), down to three in ten; after that
     every other frame is drawn. When things are easy again they come back one step at a time, and a step that did not
     hold doubles the wait before the next try, so nothing flickers in and out. A piece is never refused, a single placed
     thing is never left out, and a still (reduced motion, Graphics Low) is not touched. */
  const clock=()=>win.performance?.now?.()??0;
  function govern(ms,now){
   if(ms>=0)cost=cost?cost+(ms-cost)*.1:ms;
   const gap=last?now-last:0;last=now;
   if(gap>0&&gap<250&&seen>=0)gaps.push(gap);
   if(++seen<45)return;
   let late=0;if(gaps.length>=8){const pace=gaps.slice().sort((a,b)=>a-b)[gaps.length>>2];for(const each of gaps)if(each>pace*1.5)late++;}
   const heavy=cost>7||late>=4,light=cost<5.5&&late<=1;
   gaps.length=0;seen=0;
   if(heavy){
    if(++streak<2)return;
    if(fresh)hold=Math.min(64,hold*2);
    fresh=0;wait=hold;
    if(thin>.3)thin=Math.max(.3,thin*.8);else slow=2;
    return;
   }
   streak=0;if(fresh&&++fresh>5)fresh=0;
   if(!light)return;
   if(thin>=1&&slow===1){if(!fresh)hold=4;return;}
   if(wait>0){wait--;return;}
   if(slow>1)slow=1;else thin=Math.min(1,thin*1.12);
   fresh=1;wait=hold;
  }
  function loop(now){
    raf=0;
    if(dead||!live())return;
    let ms=-1;
    if(tick++%(laid.budget.skip*slow)===0){const from=clock();frame(now/1000);ms=clock()-from;}
    govern(ms,now);
    raf=win.requestAnimationFrame(loop);
  }
  function set(next){
   if(dead)return;state=next;const ok=state&&state.view?.w>0&&state.view?.h>0&&state.art?.h>0&&state.art?.w>0;laid=ok?plan(state):null;
   if(!g)return;
   if(!laid||!laid.layers.length){
     if(raf){win.cancelAnimationFrame?.(raf);raf=0;}
     g.setTransform(1,0,0,1,0,0);
     g.clearRect(0,0,canvas.width,canvas.height);
     canvas.hidden=true;
     return;
   }
   canvas.hidden=false;const want=Math.min(win.devicePixelRatio||1,laid.budget.dpr),cap=Math.sqrt(2600000/(state.view.w*state.view.h));dpr=Math.max(.5,Math.min(want,cap));
   const w=Math.round(state.view.w*dpr),h=Math.round(state.view.h*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   const react=laid.layers.some(l=>l.react);
   if(react&&!listening){win.addEventListener?.('pointermove',onMove,{passive:true});listening=true;}
   else if(!react&&listening){win.removeEventListener?.('pointermove',onMove);listening=false;pointer=null;}
   if(live()){if(!raf)raf=win.requestAnimationFrame(loop);}else{if(raf){win.cancelAnimationFrame?.(raf);raf=0;}frame(state.clock??0);}
  }
  function destroy(){
    dead=true;
    if(raf)win.cancelAnimationFrame?.(raf);
    raf=0;
    if(listening)win.removeEventListener?.('pointermove',onMove);
    listening=false;
    cache.clear();
    held=0;
    canvas.remove?.();
  }
  return {set,frame,destroy,canvas,get layers(){
    return laid?.layers||[];
  },get running(){return !!raf;},get cacheBytes(){return held;},get cacheSize(){return cache.size;},get thin(){return thin;},get everyOther(){return slow>1;}};
 }
 const api=Object.freeze({...pure,mount,shapes:Object.keys(shapes)});
 root.ReserveBandPieces=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
