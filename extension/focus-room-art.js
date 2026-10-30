/* Canvas Harness Plus: the Focus room's four places, drawn in code by one hand. Each place is a whole world on a
   1440 x 900 stage (horizon at 560): a sky of flat washes, far ground, middle ground and near ground, with the small
   true things that belong there. Heavy drawing is returned as still layers; everything that ever moves is a small
   separate actor so the browser only repaints what moves. Colours are classes (f-* fills, s-* strokes) that
   focus-room.css maps to the day, night and theme-kit palettes, so one drawing serves every theme. No data. */
(function(root){
 'use strict';
 const W=1440,H=900,HZ=560,PLACES=['lake','stream','rain','fire','winter'],NAMES={lake:'Lake',stream:'Stream',rain:'Rain',fire:'Fire',winter:'Winter'};
 // The sun's arc. Its ends sit inside the trees that frame every place and just above the far ridge, so the sun is in
 // sight from the first minute to the last; its top stays on screen when a 16:9 screen crops the stage, and it passes
 // over the time, not through it. (The task tag is sized to stay left of it: focus-room.js tagWidth.)
 const ARC={x0:280,x1:1160,y:HZ-90,cx:720,cy:-330};
 let seed=1;
 const rnd=()=>(seed=(seed*48271)%2147483647)/2147483647,J=a=>(rnd()*2-1)*a,R=(a,b)=>a+rnd()*(b-a),RI=(a,b)=>Math.floor(R(a,b+1)),pick=list=>list[Math.floor(rnd()*list.length)];
 // far away a tenth of a pixel never shows: whole() draws in whole numbers, which also keeps the file small
 let INT=false;const f1=v=>String(INT?Math.round(v):Math.round(v*10)/10),whole=fn=>{const k=INT;INT=true;try{return fn();}finally{INT=k;}};
 // Draw with a seed of its own, so adding or moving one thing leaves the hand of everything after it unchanged.
 const alt=(n,fn)=>{const keep=seed;seed=n;try{return fn();}finally{seed=keep;}};
 // A drawing that is the same wherever and whenever it is used (it draws with its own seed) is drawn once.
 const once=fn=>{let v;return ()=>v??=fn();};
 // Where the main things of each place stand (stage pixels, [x0,y0,x1,y1]): tests keep them from touching.
 let BOX=null,RIDGE=null;const box=(name,x0,y0,x1,y1)=>{if(BOX)BOX.push([name,Math.round(x0),Math.round(y0),Math.round(x1),Math.round(y1)]);};
 // Biscuit (230 x 150 box, ground at y+140) and the kettle that sits 22 px past his nose, on the same ground.
 const biscuitBoxes=(bx,by)=>{box('biscuit',bx+4,by+84,bx+188,by+142);box('biscuit-head',bx+128,by,bx+198,by+84);box('biscuit-joy',bx+196,by-12,bx+220,by+36);};
 const kettleAt=(bx,by)=>[bx+198,by+88];
 const kettleBox=(kx,ky)=>box('kettle',kx+9,ky+8,kx+70,ky+56);
 // A hand line through points: quadratic joins with a little tremor; a closed line overshoots its start like a pen does.
 function pth(pts,close=false,j=1.2){
  let d='M'+f1(pts[0][0]+J(j))+' '+f1(pts[0][1]+J(j));
  for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x,y]=pts[i];d+='Q'+f1((x0+x)/2+J(j*1.4))+' '+f1((y0+y)/2+J(j*1.4))+' '+f1(x+J(j))+' '+f1(y+J(j));}
  if(close){const [x,y]=pts[0],l=pts[pts.length-1];d+='Q'+f1((l[0]+x)/2+J(j))+' '+f1((l[1]+y)/2+J(j))+' '+f1(x+2+J(.6))+' '+f1(y+J(.6));}
  return d;
 }
 function smooth(pts,j=.8){
  let d='M'+f1(pts[0][0])+' '+f1(pts[0][1]);
  for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
   d+='C'+f1(p1[0]+(p2[0]-p0[0])/6+J(j))+' '+f1(p1[1]+(p2[1]-p0[1])/6+J(j))+' '+f1(p2[0]-(p3[0]-p1[0])/6+J(j))+' '+f1(p2[1]-(p3[1]-p1[1])/6+J(j))+' '+f1(p2[0])+' '+f1(p2[1]);}
  return d;
 }
 const ring=(cx,cy,rx,ry=rx,n=14,k=.05)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return [cx+Math.cos(a)*rx*(1+J(k)),cy+Math.sin(a)*ry*(1+J(k))];});
 // A closed line drawn round, not ruled: a smooth curve through the points (living things, stones, hulls), its
 // handles a little unsteady, and it runs a few units past its start like a pen coming round.
 function loop(pts,j=.5,over=4){
  const n=pts.length,P=i=>pts[(i%n+n)%n];let d='M'+f1(P(0)[0])+' '+f1(P(0)[1]);
  for(let i=0;i<n;i++){const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2);
   d+='C'+f1(p1[0]+(p2[0]-p0[0])/6+J(j))+' '+f1(p1[1]+(p2[1]-p0[1])/6+J(j))+' '+f1(p2[0]-(p3[0]-p1[0])/6+J(j))+' '+f1(p2[1]-(p3[1]-p1[1])/6+J(j))+' '+f1(p2[0])+' '+f1(p2[1]);}
  if(over){
    const [x0,y0]=P(0),[x1,y1]=P(1),l=Math.hypot(x1-x0,y1-y0)||1,ux=(x1-x0)/l,uy=(y1-y0)/l;
    d+='Q'+f1(x0+ux*over*.5)+' '+f1(y0+uy*over*.5)+' '+f1(x0+ux*over+uy*.6)+' '+f1(y0+uy*over-ux*.6);
  }
  return d;
 }
 // A loose round wash (light, a puddle of glow): a loop through points at uneven distances round a centre.
 const lobe=(x,y,a,b,n=11)=>{const pts=[];for(let i=0;i<n;i++){const t=i/n*Math.PI*2;pts.push([x+Math.cos(t)*a*R(.8,1.12),y+Math.sin(t)*b*R(.74,1.14)]);}return loop(pts,.8,0);};
 // One drawn thing from a loop: its wash set a little off the line, then the line.
 const piece=(pts,tok,w=1.8,io=.9,j=.5,o=1)=>{const d=loop(pts,j);return wash(d,tok,o)+ink(d,w,io);};
 // A neck, a leg or a branch between two ends: its centre line bends (an S when bend is set), its sides taper from w0
 // at the start to w1 at the end. Returns the two sides: [left side start..end, right side start..end].
 function limb(c0,c1,w0,w1,bend=0,n=6,lobes=2,ease=1){
  const dx=c1[0]-c0[0],dy=c1[1]-c0[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,A=[],B=[];
  for(let i=0;i<=n;i++){const t=i/n,s=bend*Math.sin(t*Math.PI*lobes),ds=bend*Math.PI*lobes*Math.cos(t*Math.PI*lobes);
   // the side's normal follows the bend, so the width holds round the curve
   const tx=dx+nx*ds,ty=dy+ny*ds,tl=Math.hypot(tx,ty)||1,mx=-ty/tl,my=tx/tl,w=(w0+(w1-w0)*Math.pow(t,ease))/2,cx=c0[0]+dx*t+nx*s,cy=c0[1]+dy*t+ny*s;
   A.push([cx+mx*w,cy+my*w]);B.push([cx-mx*w,cy-my*w]);}
  return [A,B];
 }
 // Pieces of the drawing. k = ink line; f-x = a flat wash; m s-x = a coloured mark.
 const ink=(d,w=2.2,o=1)=>`<path class="k" d="${d}" stroke-width="${w}"${o<1?` stroke-opacity="${Math.round(o*100)/100}"`:''}/>`;
 const fill=(d,tok,o=1,dx=0,dy=0)=>`<path class="f-${tok}" d="${d}"${o<1?` fill-opacity="${o}"`:''}${dx||dy?` transform="translate(${f1(dx)} ${f1(dy)})"`:''}/>`;
 const wash=(d,tok,o=1)=>fill(d,tok,o,1.6,1.8);
 const mark=(d,tok,w=1.6,o=1)=>`<path class="m s-${tok}" d="${d}" stroke-width="${w}"${o<1?` stroke-opacity="${o}"`:''}/>`;
 const shape=(pts,tok,w=2.2,io=1,j=1.2,o=1)=>{const d=pth(pts,true,j);return wash(d,tok,o)+ink(d,w,io);};
 const blob=(cx,cy,rx,ry,tok,w=2,io=1,n=12)=>shape(ring(cx,cy,rx,ry,n),tok,w,io,.8);
 const g=(inner,attrs='')=>`<g${attrs?' '+attrs:''}>${inner}</g>`;
 // Marks of one kind are gathered into a single path: thousands of grass blades cost one element.
 function Batch(){
  const sets=new Map();
  const put=(key,d)=>{if(!sets.has(key))sets.set(key,[]);sets.get(key).push(d);};
  return {
   ink(d,w=1.4,o=1){put(`k|${w}|${o}`,d);},
   mark(tok,d,w=1.4,o=1){put(`m|${w}|${o}|${tok}`,d);},
   fill(tok,d,o=1){put(`f|${o}|${tok}`,d);},
   out(){let s='';for(const [key,list] of sets){const [kind,a,b,c]=key.split('|'),d=list.join('');
     if(kind==='k')s+=ink(d,+a,+b);else if(kind==='m')s+=mark(d,c,+a,+b);else s+=fill(d,b,+a);}
    sets.clear();return s;}
  };
 }
 // Shadows are offset washes. Morning shadows fall right (sun on the left), evening shadows fall left. At night a third
 // set falls away from the place's own light (the lantern, or the fire), longer the further a thing stands from it;
 // things beyond the light's reach cast none.
 function Shadows({light=null,reach=420}={}){
  const am=[],pm=[],nt=[];
  return {am,pm,nt,
   cast(x,y,len,h=6,lean=.25){
    const a=[[x,y-h*.4],[x+len*.4,y-h*.5-len*lean*.05],[x+len,y-h*.2],[x+len*.96,y+h*.3],[x+len*.3,y+h*.5],[x,y+h*.4]];
    am.push(pth(a,true,1.4));pm.push(pth(a.map(([px,py])=>[2*x-px,py]),true,1.4));
    if(light){const dx=x-light[0],dist=Math.hypot(dx,(y-light[1])*2);if(dist<reach){const dir=dx<0?-1:1,k=.5+Math.min(1.3,dist/620),l=len*k;
     const b=[[x,y-h*.4],[x+l*.4,y-h*.45],[x+l,y-h*.1],[x+l*.97,y+h*.35],[x+l*.3,y+h*.5],[x,y+h*.4]];nt.push(pth(b.map(([px,py])=>[x+(px-x)*dir,py]),true,1.4));}}
   },
   out(){return [`<path class="f-shadow" d="${am.join('')}"/>`,`<path class="f-shadow" d="${pm.join('')}"/>`,nt.length?`<path class="f-shadow fr-ntshadow" d="${nt.join('')}"/>`:''];}
  };
 }
 // ---------------------------------------------------------------- the sky
 function sky(kind){
  let s=`<rect class="f-sky0" x="-20" y="-20" width="${W+40}" height="${HZ+60}"/>`;
  const band=(y,tok,amp=12)=>fill(pth([[-20,y],[240,y-amp*.8],[520,y+amp*.4],[820,y-amp],[1100,y+amp*.6],[1460,y-amp*.3],[1460,HZ+40],[-20,HZ+40]],true,3),tok);
  s+=band(HZ-330,'sky1',16)+band(HZ-190,'sky2',12)+band(HZ-86,'sky3',8);
  // long thin streaks laid flat near the horizon; the middle of the sky stays quiet for the time
  const B=Batch();
  for(let i=0;i<7;i++){const y=R(HZ-150,HZ-40),x=R(-40,1300),w=R(160,420);B.fill('sky1',pth([[x,y],[x+w*.5,y-R(2,5)],[x+w,y],[x+w*.5,y+R(2,4)]],true,1.5),.55);}
  for(let i=0;i<5;i++){const y=R(60,200),x=pick([R(-40,260),R(1150,1420)]),w=R(120,260);B.fill('sky2',pth([[x,y],[x+w*.5,y-3],[x+w,y],[x+w*.5,y+3]],true,1.5),.45);}
  if(/overcast/.test(kind)){
   // a low grey lid of cloud over the hills: banks of billowed cloud of every length, overlapping, heavier
   // underneath, some trailing veils of rain in the distance
   whole(()=>{for(let i=0;i<7;i++){const y=HZ-232+i*26+R(-8,8),w=R(380,820),x=R(-160,W-w+160);cloudBank(B,x,y,w,R(22,34),.45+i*.06,i%3===1);}});
   for(let i=0;i<14;i++){const x=R(0,W),y=R(HZ-220,HZ-60),l=R(18,40);B.mark('rain',`M${f1(x)} ${f1(y)}l${f1(-l*.18)} ${f1(l)}`,1.1,.22);}
  }
  if(kind==='night'){
   // stars: dots, and a few brighter four-point stars; a soft band of the galaxy laid as two flat washes
   B.fill('sky2',pth([[-20,180],[300,140],[700,190],[1100,130],[1460,170],[1460,262],[1100,252],[700,274],[300,258],[-20,266]],true,8),.45);
   for(let i=0;i<230;i++){
     const x=R(0,W),y=R(8,HZ-70)*(rnd()<.6?.75:1);
     if(x>380&&x<1060&&y>150&&y<430&&rnd()<.75)continue;
     const r=R(.8,2.1);
     B.fill('star',`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(r*2)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-r*2)} 0`);
   }
   for(let i=0;i<16;i++){const x=pick([R(20,380),R(1060,1420)]),y=R(30,HZ-120),r=R(4,7);B.mark('star',`M${f1(x-r)} ${f1(y)}h${f1(r*2)}M${f1(x)} ${f1(y-r)}v${f1(r*2)}`,1.3,.9);}
  }
  return s+B.out()+(kind==='night'?starrySky():'');
 }
 // Starry Night (the scene theme): the sky turns in brush strokes, the way the Review deck's window and Grade impact's
 // paint it. A still layer, shown only under that scene (focus-room.css), kept outside the sun's arc and off the time:
 // a rolling spiral in the open sky at the right with long strokes flowing into it, a smaller one low on the left, and
 // haloed stars (a gold disc, a ring of light, a broken outer ring).
 function starrySky(){
  const keep=seed;seed=4417;const B=Batch();
  const spiral=(cx,cy,r,turns,dir)=>{
    const n=Math.round(turns*16),pts=[];
    for(let i=0;i<=n;i++){const a=dir*i/n*turns*Math.PI*2,k=1-i/n*.8;pts.push([cx+Math.cos(a)*r*k,cy+Math.sin(a)*r*k*.74]);}
    return smooth(pts,.5);
  };
  for(const [cx,cy,r,turns,dir] of [[1266,214,54,1.7,1],[130,352,30,1.5,-1]]){B.mark('swirl',spiral(cx,cy,r,turns,dir),3.4,.72);B.mark('swirl',spiral(cx+4,cy+5,r*.84,turns*.92,dir),1.4,.5);}
  for(const pts of [
    [[1012,126],[1084,104],[1162,116],[1206,148]],
    [[1048,152],[1118,168],[1176,196]],
    [[1150,302],[1232,286],[1322,298],[1430,278]],
    [[1168,334],[1262,322],[1352,336],[1436,322]],
    [[24,300],[66,290],[100,298]],
    [[18,402],[90,408],[168,394],[232,406]]
  ]){
    B.mark('swirl',smooth(pts,.8),2.4,.6);
    B.mark('swirl',smooth(pts.map(([x,y])=>[x+6,y+7]),.8),1.1,.4);
  }
  for(const [x,y,r] of [[1172,72,7],[1398,214,6],[1316,402,5],[462,50,6],[38,236,5]]){
    B.fill('star',pth(ring(x,y,r*.55,r*.55,8,.04),true,.3));
    B.mark('swirl',pth(ring(x,y,r*1.2,r*1.2,10,.05),true,.4),1.6,.75);
    B.mark('swirl',pth(ring(x,y,r*1.9,r*1.9,12,.06).slice(0,8),false,.5),1.2,.55);
  }
  const out=`<g class="fr-starry">${B.out()}</g>`;seed=keep;return out;
 }
 // A cloud drawn at its own origin, for the drifting actors.
 function cloud(w,kind='day'){
  const n=RI(4,6),h=w*.32;let d=`M0 ${f1(h)}`;const tops=[];
  for(let i=0;i<n;i++){const ex=w*(i+1)/n,r=w/n*R(.55,.8);d+=`A${f1(r)} ${f1(r*R(.75,.95))} 0 0 1 ${f1(ex)} ${f1(h+J(3))}`;tops.push(ex);}
  d+=`Q${f1(w*.5)} ${f1(h+10)} 2 ${f1(h+1)}`;
  let s=fill(d,'cloud',.95,1.6,1.8);
  // the shaded underside and a few inner curls
  s+=fill(pth([[w*.08,h-2],[w*.5,h+4],[w*.92,h-2],[w*.6,h+8],[w*.2,h+7]],true,1),'cloud2',.85);
  s+=ink(d,1.5,.32);
  for(let i=1;i<n-1;i++)s+=ink(`M${f1(tops[i-1]+6)} ${f1(h-8)}q${f1(w/n*.3)} -10 ${f1(w/n*.55)} -2`,1.1,.22);
  return s;
 }
 // A rain cloud: a long low band of stratus, heavier underneath, with thin rain hanging from its belly.
 function stratus(w){
  // a soft billowed top of low wide swells, heavier in the middle; a nearly flat belly
  const h=w*.12,n=RI(6,8);let d=`M0 ${f1(h*.82)}`;const tops=[];
  for(let i=0;i<n;i++){
    const ex=w*(i+1)/n,rx=w/n*R(.52,.62),ry=h*(.32+.4*Math.sin((i+.5)/n*Math.PI))*R(.85,1.1);
    d+=`A${f1(rx)} ${f1(ry)} 0 0 1 ${f1(ex)} ${f1(h*.82+J(2))}`;
    tops.push([ex-w/n/2,h*.82-ry]);
  }
  d+=`Q${f1(w*.75)} ${f1(h*1.04)} ${f1(w*.5)} ${f1(h*1.0)}Q${f1(w*.25)} ${f1(h*.98)} 0 ${f1(h*.82)}Z`;
  let s=fill(d,'raincloud',.92,1.6,1.8)+fill(pth([[w*.04,h*.84],[w*.5,h*.9],[w*.96,h*.84],[w*.78,h*1.02],[w*.42,h*1.04],[w*.12,h*.98]],true,1),'raincloud2',.9)+ink(d,1.4,.28);
  for(let i=1;i<tops.length-1;i++){const [x,y]=tops[i];s+=ink(`M${f1(x-w/n*.3)} ${f1(y+h*.28)}q${f1(w/n*.3)} ${f1(-h*.12)} ${f1(w/n*.6)} 0`,1,.18);}
  const B=Batch();for(let i=0;i<Math.round(w/22);i++){const x=R(w*.06,w*.94),l=R(14,36);B.mark('rain',`M${f1(x)} ${f1(h*.98)}l${f1(-l*.2)} ${f1(l)}`,1.1,.35);}
  return s+B.out();
 }
 function sunArt(){
  // the sun: an offset wash disc, a second smaller wash for its warm core, short drawn rays
  const d=pth(ring(40,40,24,24,16),true,.6);let s=fill(d,'sun',1,1.6,1.8)+fill(pth(ring(36,36,12,11,10),true,.5),'sun2',.9)+ink(d,2,.7);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2+J(.08),r0=31+J(1),r1=r0+R(5,9);s+=ink(`M${f1(40+Math.cos(a)*r0)} ${f1(40+Math.sin(a)*r0)}L${f1(40+Math.cos(a)*r1)} ${f1(40+Math.sin(a)*r1)}`,1.6,.5);}
  return `<g class="fr-sunbody">${s}</g>`;
 }
 // Behind rain: a pale disc with no rays, its lower half lost behind a drifting wash of cloud.
 function veiledSunArt(night=false){
  const d=pth(ring(40,40,23,23,16),true,.6);
  let s=fill(d,night?'moon':'sun2',.85,0,0)+ink(pth(ring(40,40,23,23,16).slice(9).concat(ring(40,40,23,23,16).slice(0,2)),false,.4),1.4,.35);
  s+=fill(pth([[-10,44],[14,38],[40,42],[66,36],[92,42],[90,58],[60,62],[24,60],[-8,56]],true,1.2),'raincloud',.92)+
    fill(pth([[-4,52],[30,55],[70,54],[88,56],[60,62],[20,61]],true,1),'raincloud2',.8)+
    ink(pth([[-10,44],[14,38],[40,42],[66,36],[92,42]],false,1),1.1,.25);
  return `<g class="fr-sunbody">${s}</g>`;
 }
 function moonArt(){
  const d=pth(ring(40,40,22,22,16),true,.5);
  let s=fill(d,'moon',1,0,0)+fill(pth(ring(49,34,19,19,14),true,.5),'sky1',1)+ink(pth(ring(40,40,22,22,16).slice(9).concat(ring(40,40,22,22,16).slice(0,4)),false,.4),1.6,.7);
  s+=fill(pth(ring(32,46,3,2.4,8),true,.3),'moon2',.8)+fill(pth(ring(28,36,2,1.6,7),true,.3),'moon2',.7);
  return `<g class="fr-moonbody">${s}</g>`;
 }
 // ---------------------------------------------------------------- ground and growing things
 function mountains(y,tok,io,{hatch=true,snow=false,peaks=[110,190],low=[60,120]}={}){
  const pts=[[-20,y+30]];let x=-20;const tops=[];
  while(x<W+20){x+=R(...peaks);const top=[x,y-R(40,120)];pts.push(top);tops.push(top);x+=R(...low);pts.push([x,y-R(0,30)]);}
  pts.push([W+20,y+30]);
  // the ridge line is kept with the place: the room's controls keep above it (focus-room.js layout())
  if(RIDGE)RIDGE.push(pts.map(([px,py])=>[Math.round(px),Math.round(py)]));
  const d=pth(pts,false,2);let s=fill(d+`L${W+20} ${HZ+40}L-20 ${HZ+40}Z`,tok)+ink(d,1.9,io);
  const B=Batch();
  for(const [px,py] of tops){
   if(snow&&py<y-70){const sd=pth([[px-22,py+22],[px-8,py+8],[px,py],[px+10,py+9],[px+26,py+24],[px+14,py+20],[px+4,py+28],[px-8,py+20]],true,.8);s+=fill(sd,'snow',.95)+ink(sd,1.2,io*.6);}
   if(hatch)for(let k=0;k<5;k++)B.ink(pth([[px+6+k*7,py+12+k*7],[px+20+k*7,py+36+k*8]],false,.6),1.1,io*.45);
   // a ridge line running down the face
   B.ink(pth([[px,py+4],[px-8+J(4),py+30],[px-20+J(6),py+64]],false,.8),1.1,io*.4);
  }
  return s+B.out();
 }
 function conifer(x,y,h,tok,io=.6,detail=1){
  const w=h*.32,tiers=detail>1?5:detail?4:3;let pts=[[x,y-h]];
  for(let i=1;i<=tiers;i++){const ty=y-h+h*i/tiers*.9,tw=w*(.35+.65*i/tiers);pts.push([x+tw,ty]);if(i<tiers)pts.push([x+tw*.42,ty-h*.035]);}
  const right=pts.slice(1),left=right.map(([a,b])=>[2*x-a,b]).reverse();
  const outline=[pts[0],...right,[x,y-h*.08],...left];
  const d=pth(outline,true,1.1);let s=wash(d,tok)+ink(d,1.6,io);
  // the shade side: a darker wash on the right of the trunk line
  if(detail)s+=fill(pth([[x+1,y-h*.92],...right.filter((_,i)=>i%2===0).map(([a,b])=>[x+(a-x)*.85,b]),[x+2,y-h*.1]],true,1),'treeshade',.55);
  s+=ink(pth([[x,y-h*.06],[x+J(1),y+h*.05]],false,.5),1.8,io);
  if(detail>1){for(let i=0;i<tiers*3;i++){const ty=y-h+R(.2,.9)*h,half=w*(ty-(y-h))/h*.8;const sx=x+R(-half,half);s+=ink(`M${f1(sx)} ${f1(ty)}l${f1(J(3))} ${f1(R(4,8))}`,1,io*.5);}}
  return s;
 }
 function broadleaf(x,y,r,tok,io=.6,detail=1){
  let s=ink(pth([[x,y],[x+J(2),y-r*.7],[x+J(3),y-r*1.1]],false,.8),2.4,io);
  if(detail){s+=ink(pth([[x,y-r*.7],[x-r*.35,y-r*1.15]],false,.6),1.6,io)+ink(pth([[x,y-r*.8],[x+r*.4,y-r*1.2]],false,.6),1.6,io);}
  const n=detail?RI(5,7):3;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2,cx=x+Math.cos(a)*r*.45,cy=y-r*1.35+Math.sin(a)*r*.32,rr=r*R(.5,.68);
    const d=pth(ring(cx,cy,rr,rr*.82,10),true,1);
    s+=wash(d,i%2&&detail?tok:tok)+ink(d,1.4,io*.8);
  }
  const top=pth(ring(x,y-r*1.45,r*.6,r*.5,10),true,1);s+=wash(top,tok)+ink(top,1.4,io*.8);
  if(detail){for(let i=0;i<7;i++){const lx=x+R(-r*.7,r*.7),ly=y-r*R(1,1.8);s+=ink(`M${f1(lx)} ${f1(ly)}q3 3 6 0`,1.1,io*.55);}
   s+=fill(pth([[x+r*.15,y-r*1.6],[x+r*.75,y-r*1.25],[x+r*.55,y-r*.85],[x+r*.1,y-r*1.05]],true,1.5),'treeshade',.4);}
  return s;
 }
 const leafPath=(x,y,len,ang,wid=.38)=>{
   const c=Math.cos(ang),sn=Math.sin(ang),ex=x+c*len,ey=y+sn*len,nx=-sn*len*wid,ny=c*len*wid;
   return `M${f1(x)} ${f1(y)}Q${f1((x+ex)/2+nx)} ${f1((y+ey)/2+ny)} ${f1(ex)} ${f1(ey)}Q${f1((x+ex)/2-nx)} ${f1((y+ey)/2-ny)} ${f1(x)} ${f1(y)}`;
 };
 // A birch with lenticels, scars, peeling bark, twigs and leaves drawn one by one.
 // reachL shortens the branches on the left side (a birch standing just past a roof keeps clear of it).
 function birch(x,y,h,{lean=0,leaves=140,io=.85,crown=1,reachL=1}={},SH){
  const top=[x+lean*h,y-h],wB=h*.026+3,wT=3;
  const L=[[x-wB,y],[x-wB*.92+lean*h*.33,y-h*.33],[x-wB*.7+lean*h*.66,y-h*.66],[top[0]-wT,top[1]]],Rt=[[top[0]+wT,top[1]],[x+wB*.7+lean*h*.66,y-h*.66],[x+wB*.92+lean*h*.33,y-h*.33],[x+wB,y]];
  const trunk=pth(L.concat(Rt),true,.8);let s='';
  // branches first, so the trunk overlaps their roots
  const B=Batch(),LB=Batch();
  const branches=[];
  for(let i=0;i<9;i++){
    const k=R(.42,.95),bx=x+lean*h*k,by=y-h*k,dir=i%2?1:-1,len=h*R(.1,.22)*(1.1-k*.4)*(dir<0?reachL:1);
    const ex=bx+dir*len,ey=by-len*R(.3,.7);
    branches.push([bx,by,ex,ey,dir]);
   B.ink(pth([[bx,by],[bx+dir*len*.5,by-len*.25+J(3)],[ex,ey]],false,.8),R(1.6,2.6),io);
   for(let t=0;t<3;t++){const tk=R(.4,.9),tx=bx+(ex-bx)*tk,ty=by+(ey-by)*tk;B.ink(`M${f1(tx)} ${f1(ty)}l${f1(dir*R(8,18))} ${f1(-R(4,14))}`,1,io*.8);}}
  s+=B.out()+fill(trunk,'birch',1)+ink(trunk,2.2,io);
  // lenticels: pairs of short dark dashes; scars: dark eye shapes; the warm wash of peeling bark
  for(let i=0;i<Math.round(h/16);i++){const k=R(.04,.92),cx=x+lean*h*k,cy=y-h*k,ww=(wB+(wT-wB)*k)*R(.5,.9),dx=R(-.4,.2)*ww;B.ink(`M${f1(cx+dx-ww*.45)} ${f1(cy)}h${f1(ww*R(.4,.8))}`,R(1.4,2.6),io*.85);}
  for(let i=0;i<4;i++){const k=R(.15,.85),cx=x+lean*h*k+J(2),cy=y-h*k;B.ink(`M${f1(cx-6)} ${f1(cy)}q6 -5 12 0q-6 4 -12 0`,1.6,io*.9);}
  for(let i=0;i<5;i++){const k=R(.1,.8),cx=x+lean*h*k+R(-2,2),cy=y-h*k;B.fill('bark',pth([[cx-3,cy],[cx+4,cy-2],[cx+5,cy+6],[cx-2,cy+7]],true,.5),.7);}
  B.ink(pth([[x-wB+3,y-6],[x-wB+5+lean*h*.2,y-h*.2]],false,.6),1,io*.35);
  s+=B.out();
  // leaves in loose clusters at the twig ends and up the crown
  const tones=['leaf','leaf2','leaf3'];
  for(let i=0;i<leaves;i++){const br=pick(branches),t=rnd();const cx=br[2]+J(34)*crown,cy=br[3]+J(26)*crown-t*8;const len=R(7,12),ang=R(-Math.PI,Math.PI);
   LB.fill(pick(tones),leafPath(cx,cy,len,ang));
   if(rnd()<.35)LB.ink(leafPath(cx,cy,len,ang),.9,.45);else if(rnd()<.3)LB.ink(`M${f1(cx)} ${f1(cy)}l${f1(Math.cos(ang)*len*.8)} ${f1(Math.sin(ang)*len*.8)}`,.7,.35);
  }
  s+=LB.out();
  SH?.cast(x,y,h*.45,10);
  return s;
 }
 function grassField(B,x0,x1,y0,y1,n,{tok='grass',h=[10,22],o=.75,skip=null}={}){
  for(let i=0;i<n;i++){const x=R(x0,x1),y=R(y0,y1),hh=R(...h)*(.6+(y-y0)/(y1-y0+1)*.6);if(skip&&skip(x,y))continue;
   for(let k=-1;k<=1;k++)B.mark(rnd()<.5?tok:'grass2',`M${f1(x+k*2)} ${f1(y)}q${f1(k*hh*.12)} ${f1(-hh*.5)} ${f1(k*hh*.3+J(2))} ${f1(-hh)}`,R(1.1,1.6),o);}
 }
 function fringe(B,{o=.85,from=0,to=W}={}){
  for(let x=from;x<to;x+=R(3,7)){const h=R(26,74)*(rnd()<.12?1.5:1),lean=J(h*.35),tok=rnd()<.5?'grass':'grass2',y=H+R(0,8);
   B.mark(tok,`M${f1(x)} ${f1(y)}q${f1(lean*.25)} ${f1(-h*.55)} ${f1(lean)} ${f1(-h)}`,R(1.4,2.4),o);
   if(rnd()<.1){const tx=x+lean,ty=y-h;B.fill('wood2',pth(ring(tx,ty-5,2.2,6,8),true,.3),.9);B.ink(`M${f1(tx)} ${f1(ty+2)}l0 -12`,.7,.5);}
   else if(rnd()<.04){
     const tx=x+lean,ty=y-h;
     for(let k=0;k<9;k++){const a=k/9*Math.PI*2;B.mark('seed',`M${f1(tx)} ${f1(ty)}l${f1(Math.cos(a)*7)} ${f1(Math.sin(a)*7)}`,.8,.8);}
     B.fill('fl1',`M${f1(tx-1.4)} ${f1(ty)}a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0`);
   }}
 }
 function tuft(B,x,y,h=18,tok='grass',o=.75){for(let k=-2;k<=2;k++)B.mark(k%2?tok:'grass2',`M${f1(x+k)} ${f1(y)}q${f1(k*h*.08)} ${f1(-h*.5)} ${f1(k*h*.22+J(2))} ${f1(-h*R(.65,1))}`,1.4,o);}
 function flowers(B,x0,x1,y0,y1,n,tones=['fl1','fl2','fl3','fl4']){
  for(let i=0;i<n;i++){const x=R(x0,x1),y=R(y0,y1),t=pick(tones),r=R(2.2,3.6);B.mark('grass',`M${f1(x)} ${f1(y+r)}q${f1(J(2))} 6 ${f1(J(3))} 12`,1.1,.7);
   if(t==='fl4'){for(let p=0;p<6;p++){const a=p/6*Math.PI*2;B.fill('fl4',leafPath(x,y,r*1.6,a,.45));}B.fill('fl1',`M${f1(x-1.4)} ${f1(y)}a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0`);}
   else{B.fill(t,`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(r*.85)} 0 1 0 ${f1(r*2)} 0a${f1(r)} ${f1(r*.85)} 0 1 0 ${f1(-r*2)} 0`);if(rnd()<.4)B.ink(`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(r*.85)} 0 1 0 ${f1(r*2)} 0`,.8,.4);}}
 }
 function clover(B,x,y){
   for(let p=0;p<3;p++){const a=-Math.PI/2+p*2.1;B.fill('leaf2',`M${f1(x)} ${f1(y)}a3.4 3.4 0 1 0 ${f1(Math.cos(a)*6)} ${f1(Math.sin(a)*6)}z`);}
   B.mark('grass',`M${f1(x)} ${f1(y)}v8`,1,.7);
 }
 function rock(x,y,w,h,{tok='rock',io=.8,moss=false,wet=false}={},SH){
  const pts=[[x,y],[x+w*.08,y-h*.55],[x+w*.3,y-h*.92],[x+w*.55,y-h],[x+w*.82,y-h*.78],[x+w,y-h*.18],[x+w*.97,y]];
  const d=pth(pts,true,1.2);let s=wash(d,tok)+ink(d,2,io);
  // the shaded face, a facet line, a crack and hatching
  s+=fill(pth([[x+w*.58,y-h*.95],[x+w*.82,y-h*.76],[x+w*.98,y-h*.16],[x+w*.95,y-2],[x+w*.62,y-2],[x+w*.66,y-h*.5]],true,1),'rock2',.85);
  s+=ink(pth([[x+w*.56,y-h*.96],[x+w*.6,y-h*.55],[x+w*.52,y-h*.1]],false,.8),1.2,io*.6);
  s+=ink(pth([[x+w*.22,y-h*.6],[x+w*.3,y-h*.45],[x+w*.27,y-h*.28]],false,.6),1,io*.5);
  const B=Batch();for(let k=0;k<5;k++)B.ink(`M${f1(x+w*.7+k*w*.05)} ${f1(y-h*.55+k*2)}l${f1(w*.06)} ${f1(h*.32)}`,1,io*.5);
  if(moss){
    B.fill('moss',pth([[x+w*.12,y-h*.62],[x+w*.32,y-h*.9],[x+w*.52,y-h*.98],[x+w*.42,y-h*.82],[x+w*.2,y-h*.55]],true,1),.9);
    for(let k=0;k<6;k++)B.mark('grass',`M${f1(x+w*R(.15,.45))} ${f1(y-h*R(.7,.9))}l${f1(J(2))} -3`,1.4,.7);
  }
  if(wet)B.mark('water3',`M${f1(x+w*.2)} ${f1(y-h*.75)}q${f1(w*.1)} -6 ${f1(w*.24)} -4`,2.2,.9);
  s+=B.out()+fill(pth([[x-6,y+1],[x+w+8,y+1],[x+w+4,y+5],[x-2,y+5]],true,1),'shade',.6);
  for(let k=0;k<3;k++)s+=blob(x+R(-8,w+6),y+R(1,5),R(2,4),R(1.5,2.6),tok,1,io*.6,7);
  SH?.cast(x+w*.5,y,w*.9+h*.6,h*.32);
  return s;
 }
 function reeds(B,x,y,n,io=.85){
  for(let i=0;i<n;i++){const rx=x+i*R(6,11),h=R(50,96),lean=J(10);B.mark('reed',`M${f1(rx)} ${f1(y)}q${f1(lean*.3)} ${f1(-h*.5)} ${f1(lean)} ${f1(-h)}`,1.7,io);
   if(rnd()<.55){const cx=rx+lean*.92,cy=y-h*.9;B.fill('cattail',`M${f1(cx-2.8)} ${f1(cy)}q0 -14 2.8 -16q2.8 2 2.8 16q-2.8 3 -5.6 0`);B.ink(`M${f1(cx-2.8)} ${f1(cy)}q0 -14 2.8 -16q2.8 2 2.8 16`,1,.6);B.mark('reed',`M${f1(cx)} ${f1(cy-16)}v-7`,1.1,io);}
   else B.mark('reed2',`M${f1(rx)} ${f1(y-h*.4)}q${f1(R(8,16))} ${f1(-h*.2)} ${f1(R(14,24))} ${f1(-h*.1)}`,1.3,io*.8);}
 }
 function fern(B,x,y,s=1,tok='fern',o=.85){
  for(let k=-2;k<=2;k++){const ex=x+k*R(20,30)*s,ey=y-R(40,58)*s*(1-Math.abs(k)*.12);B.mark(tok,`M${f1(x)} ${f1(y)}Q${f1(x+k*10*s)} ${f1(y-34*s)} ${f1(ex)} ${f1(ey)}`,1.5,o);
   for(let j=1;j<8;j++){
     const t=j/8,px=x+(ex-x)*t+k*4*s*(1-t),py=y+(ey-y)*t-6*s*Math.sin(t*3),l=7*s*(1-t*.6);
     B.mark(tok,`M${f1(px)} ${f1(py)}l${f1(-l)} ${f1(-l*.45)}M${f1(px)} ${f1(py)}l${f1(l)} ${f1(-l*.45)}`,1.1,o*.9);
   }}
 }
 function lily(x,y,r=16,flower=false){
  const n=10,pts=ring(x,y,r,r*.4,n,.03);pts.splice(2,1,[x+r*.15,y-r*.05]);
  const d=pth(pts,true,.5);let s=wash(d,'lily')+ink(d,1.3,.55);
  for(let k=0;k<4;k++){const a=k/4*Math.PI*2+.4;s+=ink(`M${f1(x)} ${f1(y)}l${f1(Math.cos(a)*r*.7)} ${f1(Math.sin(a)*r*.28)}`,.8,.3);}
  if(flower){
    for(let p=0;p<7;p++){const a=-Math.PI*.95+p*Math.PI*.95/6;s+=wash(leafPath(x+2,y-3,9,a,.42),'fl4')+ink(leafPath(x+2,y-3,9,a,.42),.8,.5);}
    s+=fill(`M${f1(x)} ${f1(y-4)}a2 2 0 1 0 4 0a2 2 0 1 0 -4 0`,'fl1');
  }
  return s;
 }
 // ---------------------------------------------------------------- built things
 function planks(B,x0,y0,x1,y1,depth,n,io){
  // a deck seen at a slight angle: planks with grain, gaps and nail heads
  for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,ax=x0+(x1-x0)*t0,ay=y0+(y1-y0)*t0,bx=x0+(x1-x0)*t1,by=y0+(y1-y0)*t1;
   const quad=[[ax,ay],[bx,by],[bx-depth*.18,by+depth],[ax-depth*.18,ay+depth]];B.fill(i%3?'wood':'wood2',pth(quad,true,.5));
   B.ink(`M${f1(bx)} ${f1(by)}l${f1(-depth*.18)} ${f1(depth)}`,1,io*.6);
   for(let k=0;k<2;k++){const gx=ax+(bx-ax)*R(.25,.75);B.ink(pth([[gx,ay+depth*.15],[gx-depth*.06+J(1.5),ay+depth*.5],[gx-depth*.14,ay+depth*.86]],false,.5),.7,io*.35);}
   B.fill('wood3',`M${f1(ax+(bx-ax)*.5-1)} ${f1(ay+2)}a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0`);B.fill('wood3',`M${f1(ax+(bx-ax)*.5-depth*.17)} ${f1(ay+depth-2.5)}a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0`);}
 }
 function post(x,y,h,w=7,io=.9,tok='wood2'){
  const d=pth([[x-w/2,y],[x-w/2+J(1),y-h],[x+w/2+J(1),y-h-2],[x+w/2,y]],true,.6);let s=wash(d,tok)+ink(d,1.8,io);
  for(let k=0;k<3;k++)s+=ink(pth([[x-w*.2+k*w*.2,y-h*.9],[x-w*.25+k*w*.2+J(1),y-h*.4],[x-w*.2+k*w*.2,y-h*.06]],false,.4),.7,io*.4);
  s+=ink(`M${f1(x-w/2)} ${f1(y-h)}q${f1(w/2)} -3 ${f1(w)} 0`,1.2,io*.7);
  return s;
 }
 function rope(x0,y0,x1,y1,sag=12,io=.7){return mark(`M${f1(x0)} ${f1(y0)}Q${f1((x0+x1)/2)} ${f1((y0+y1)/2+sag)} ${f1(x1)} ${f1(y1)}`,'rope',1.8,io)+ink(`M${f1(x0)} ${f1(y0)}Q${f1((x0+x1)/2)} ${f1((y0+y1)/2+sag)} ${f1(x1)} ${f1(y1)}`,.6,io*.5);}
 // The lantern post stays still; its lantern is an actor that can light.
 function lanternPost(x,y,h=118,io=.9){
  let s=post(x,y,h,7,io);
  s+=ink(pth([[x,y-h+6],[x+26,y-h+4]],false,.4),2.6,io)+ink(`M${f1(x+3)} ${f1(y-h+18)}l14 -12`,1.6,io*.8)+ink(`M${f1(x+24)} ${f1(y-h+4)}v8`,1.6,io);
  return s;
 }
 function lanternArt(){
  // local box 60 x 80; the hanging lantern at (30,10): cap, cage, glass, candle; glow and flame are separate groups
  let s='';
  // its glow: uneven flat washes, longer downward where the light falls, each a different shape, never rings
  s+=alt(611,()=>`<g class="fr-glow">`+[[30,47,54,46,.13,12],[31,44,34,31,.18,11],[30,41,18,17,.3,9]].map(([x,y,rx,ry,o,n])=>fill(lobe(x,y,rx,ry,n),'glow',o)).join('')+`</g>`);
  const cage=pth([[19,24],[41,24],[42,56],[18,56]],true,.4);
  s+=fill(cage,'glass',1,1.2,1.4)+`<g class="fr-lit">`+fill(pth([[21,27],[39,27],[40,53],[20,53]],true,.3),'glowcore',1)+`</g>`;
  s+=ink(cage,1.8,.95)+ink('M30 24v32M19 40h23',1,.55);
  s+=shape([[16,24],[22,16],[38,16],[44,24]],'iron',1.6,.95,.4)+ink('M30 16v-6',1.4,.9)+ink('M26 10q4 -6 8 0',1.4,.9);
  s+=shape([[17,56],[43,56],[41,61],[19,61]],'iron',1.4,.95,.3);
  s+=fill('M27.5 41h5v11h-5z','candle')+ink('M27.5 41h5v11h-5z',1,.6);
  s+=`<g class="fr-flame">${fill('M30 33q-4 5 0 8q4 -3 0 -8z','flame2')}${fill('M30 36q-2 3 0 5q2 -2 0 -5z','flame3')}</g>`;
  return s;
 }
 // A limb or tail of even pieces: a closed outline round a centre line, as wide as ws says at each point.
 function strand(pts,ws,j=.25){
   const L=[],Rr=[];
   pts.forEach((p,i)=>{
     const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,w=ws[i]/2;
     L.push([p[0]-dy/l*w,p[1]+dx/l*w]);
     Rr.push([p[0]+dy/l*w,p[1]-dx/l*w]);
   });
   return loop([...L,...Rr.reverse()],j,3);
 }
 // The kettle: a round-bellied enamel kettle drawn round, its lid and knob, the bail handle with a wooden grip, a
 // spout that curves up from the belly, the light on its shoulder. Local 70 x 60, sits on y=52.
 const kettleArt=once(()=>alt(3307,()=>{
  let s=fill(loop([[6,53],[34,50.6],[64,53],[52,56.6],[16,56.6]],.3,0),'shade',.6);
  const spout=strand([[51,41],[59.4,34],[65,27],[68.4,23.4]],[9.6,6.4,4.6,3.8]);s+=wash(spout,'kettle')+ink(spout,1.6,.9);
  const body=[[15,52],[10.4,44],[11,34.4],[17,27.4],[27,23.4],[34,22.8],[42,23.4],[51,27.4],[57,34.4],[57.6,44],[53,52],[34,53.6]];
  s+=piece(body,'kettle',1.9,.92,.4)+fill(loop([[42,26.4],[50,30],[54,38],[51,45],[47,36.4]],.3,0),'kettle2',.75)+fill(loop([[18,31],[24,26.4],[28,26],[22,31.4],[19.6,35.4]],.2,0),'steam',.42);
  s+=ink(smooth([[13,46],[34,49],[55,46]],.3),1,.5)+fill(loop([[14,52],[34,54.4],[54,52],[52,55],[16,55]],.2,0),'kettle2',.9);
  s+=piece([[24,24.6],[34,20.4],[44,24.6],[34,26.6]],'kettle2',1.4,.9,.2)+piece(ring(34,18.6,3.4,2.6,8,.05),'wood',1.2,.9,.2);
  s+=ink(smooth([[17.4,28],[18,14],[34,7.4],[50,14],[50.6,28]],.3),2,.92)+mark(smooth([[26,9.4],[34,7.6],[42,9.4]],.2),'wood',3.6,1)+ink(smooth([[26,9.4],[34,7.6],[42,9.4]],.2),.8,.6);
  s+=fill(dab(17.6,28.6,1.6),'iron')+fill(dab(50.4,28.6,1.6),'iron');
  return s;}));
 // Biscuit: three poses drawn to the same ground line (y=140) in a 230 x 150 box, each drawn round in one outline (the
 // neck grows out of the body, the head out of the neck), with jointed legs and hooves, a shaggy mane in locks, a
 // forelock, a tail of strands, his red blanket with its stitched border and his pink muzzle.
 const ponyArt=once(()=>alt(2203,()=>{
  const P=pts=>loop(pts,.35,4),sk=(pts,tok,w=2.4)=>{const d=P(pts);return wash(d,tok)+ink(d,w,.94);};
  const lock=(pts,w=3.4,tok='mane')=>mark(smooth(pts,.3),tok,w,1);
  const mane=(crest,depth,lean=-.3)=>{
    const top=crest.map(([x,y])=>[x+.6,y-2.2]),low=[];
    crest.forEach(([x,y],i)=>{const d=depth*(i%2?R(.62,.8):R(1,1.2))*(i===0||i===crest.length-1?.5:1);low.push([x+d*lean,y+d]);});
   const d=loop([...top,...low.reverse()],.3,3);let s=wash(d,'mane')+ink(d,1.6,.9);
   for(let i=1;i<crest.length-1;i+=2){const [x,y]=crest[i];s+=mark(`M${f1(x)} ${f1(y)}q${f1(depth*lean*.3)} ${f1(depth*.4)} ${f1(depth*lean*.7)} ${f1(depth*.85)}`,'mane2',1.4,.9);}
   return s;};
  const hoof=(x,y,a=0)=>{
    const d=loop([[x-5.4,y+1.6],[x-4.4,y-3.4],[x+4.6,y-3.6],[x+6,y+1.8],[x,y+2.8]].map(([px,py])=>[x+(px-x)*Math.cos(a)-(py-y)*Math.sin(a),y+(px-x)*Math.sin(a)+(py-y)*Math.cos(a)]),.2,2);
    return wash(d,'hoof')+ink(d,1.5,.9);
  };
  // a leg: from the body through the knee (or hock) and fetlock to the hoof, tapering, the joints a little knobbly
  const leg=(pts,tok='pony',far=false,ws=[17,12,9.8,9.2,8])=>{const d=strand(pts,ws.slice(0,pts.length));return wash(d,far?'pony2':tok)+ink(d,2,far?.8:.92);};
  const eyeClosed=(x,y)=>ink(`M${x-5} ${y}q5 3.4 10 0`,1.8,.95)+ink(`M${x-3} ${y+2.4}l-1 2.6M${x+.4} ${y+3.2}v2.8M${x+3.6} ${y+2.4}l1.2 2.4`,1,.75);
  const eyeOpen=(x,y)=>fill(dab(x,y,2.8,3),'eye')+fill(dab(x+1,y-1.2,.9),'eyeshine')+ink(`M${x-4} ${y-4}q4 -2.4 8 0`,1.1,.7);
  const blanket=(pts,stitch,band)=>{const d=P(pts);return wash(d,'blanket')+fill(loop(band,.2,0),'blanket2',.75)+ink(d,2,.92)+ink(loop(stitch,.2,2),1,.75).replace('class="k"','class="k fr-stitch"');};
  // sleeping: lying on folded legs, the head stretched out low on the boards, the tail along the ground
  let sleep=fill(loop([[8,141],[100,137.6],[196,141],[150,145.6],[40,145.4]],.4,0),'shade',.55);
  sleep+=mark(smooth([[34,108],[20,118],[12,130],[8,138],[20,141.4],[40,140]],.3),'mane',5.4)+
    mark(smooth([[32,110],[22,122],[16,134],[26,139.4]],.3),'mane2',2)+
    mark(smooth([[30,112],[18,126],[10,137.4]],.3),'mane',2.2);
  sleep+=leg([[56,124],[48,132],[36,136],[26,137.4]],'pony2',true,[16,11,9.4,8.4])+hoof(24,136.4,.1);
  sleep+=sk(
    [
      [38,136],
      [30,124],
      [32,108],
      [42,96],
      [58,89],
      [80,86.6],
      [100,87],
      [116,90],
      [128,96],
      [140,103.6],
      [150,106],
      [164,107],
      [176,112.4],
      [186,122],
      [188,131],
      [183,137.6],
      [170,139],
      [152,137.6],
      [138,131],
      [124,130],
      [112,137],
      [86,139.4],
      [58,139.6]
    ],
    'pony');
  sleep+=fill(loop([[34,124],[44,110],[58,106],[56,124],[66,136],[44,138]],.3,0),'pony2',.62)+
    fill(loop([[114,108],[130,108],[146,118],[140,130],[124,129],[114,124]],.3,0),'pony2',.5)+
    fill(loop([[70,128],[100,128],[118,132],[100,138],[66,138]],.3,0),'pony2',.55);
  sleep+=ink(smooth([[44,128],[50,116],[62,110]],.3),1.4,.6)+ink(smooth([[118,118],[124,126],[122,132]],.3),1.2,.55);
  sleep+=leg([[116,126],[126,134],[140,137],[150,137.6]],'pony',false,[16,11,9.4,8.4])+hoof(152,137.6,-.08);
  sleep+=blanket(
    [[56,92],[78,88],[102,88.6],[110,96],[108,116],[84,119],[58,118],[50,106]],
    [[59,95],[78,91.6],[100,92.4],[105,98],[104,113],[84,115.6],[61,114.4],[55,105]],
    [[52,110],[108,108],[108,116],[84,119],[58,118]]);
  sleep+=ink(`M80 89v28`,1,.45)+fill(loop([[86,100],[96,99.6],[96,107],[86,107.4]],.2,0),'fl1',.9)+ink(loop([[86,100],[96,99.6],[96,107],[86,107.4]],.2,1),.8,.6);
  sleep+=fill(loop([[172,115],[184,122],[187,131],[182,137],[172,136.6],[168,126]],.3,0),'muzzle',.9)+ink(`M180 126q2.6 1.6 4.4 .4`,1.4,.85)+ink(`M174 134.6q6 1.4 11 -1.4`,1.1,.7);
  sleep+=eyeClosed(158,116);
  sleep+=sk([[140,104],[141,90],[148,84],[152,96],[150,104]],'pony',2)+fill(loop([[143,100],[144.4,91],[148,90],[148.6,101]],.2,0),'muzzle',.7);
  // the mane in locks along the crest, falling on the near side; the forelock over his brow
  sleep+=mane([[86,87.6],[94,86.6],[102,87],[110,88.6],[118,91.4],[126,95.4],[134,100],[142,104]],12,-.15)+
    lock([[142,103],[150,105],[157,110],[161,108.4]],3.8)+
    lock([[144,104],[152,109],[154,114]],2.4,'mane2');
  sleep+=`<g class="fr-zz">${ink('M158 70h8l-8 9h8',1.6,.6)}${ink('M172 52h6l-6 7h6',1.4,.45)}</g>`;
  // standing: four legs with knees, hocks and fetlocks, head up, ears up, eye open
  let stand=fill(loop([[24,141],[104,137.6],[184,141],[150,145.4],[50,145.4]],.4,0),'shade',.55);
  stand+=mark(smooth([[44,72],[32,86],[28,106],[32,124],[38,132]],.3),'mane',6)+mark(smooth([[42,76],[34,92],[34,116],[40,128]],.3),'mane2',2.2);
  stand+=leg([[72,92],[68,108],[68,120],[71,130],[72,135]],'pony',true)+hoof(73,137.6)+leg([[128,92],[128,112],[128,124],[129,131],[130,135]],'pony',true)+hoof(131,137.6);
  stand+=leg([[60,92],[54,108],[54,120],[56,130],[57,135]],'pony',false,[19,13,10,9.2,8])+hoof(58,137.6)+leg([[140,92],[141,112],[141,124],[142,131],[143,135]],'pony')+hoof(144,137.6);
  stand+=sk(
    [
      [50,100],
      [40,86],
      [42,70],
      [54,62],
      [74,60.4],
      [98,62],
      [116,58],
      [126,47],
      [138,34.6],
      [150,25.4],
      [162,21],
      [172,22],
      [182,27],
      [191,38.6],
      [197,50],
      [197.4,59],
      [191,64.4],
      [180,63],
      [172,60],
      [166,61],
      [161,69],
      [157,80],
      [153,90],
      [146,99],
      [128,104],
      [100,106],
      [74,104.4],
      [58,103]
    ],
    'pony');
  stand+=fill(loop([[44,86],[52,72],[64,70],[62,92],[56,102],[46,98]],.3,0),'pony2',.55)+
    fill(loop([[132,70],[148,68],[150,86],[142,98],[130,96]],.3,0),'pony2',.5)+
    fill(loop([[76,98],[126,98],[130,104],[100,107],[74,104]],.3,0),'pony2',.5);
  stand+=blanket(
    [[74,63],[100,64],[118,61],[122,74],[120,92],[98,95],[76,93.4],[70,78]],
    [[77,66.6],[100,67.4],[115,65],[118,75],[116,88.6],[98,91.4],[78,90],[74,78]],
    [[72,86],[121,84],[120,92],[98,95],[76,93.4]]);
  stand+=fill(loop([[184,46],[195,51],[197,60],[190,64],[180,61.6],[181,52]],.3,0),'muzzle',.9)+ink(`M190 54q2.4 1.4 4.4 .4`,1.4,.85)+ink(`M184 61q6 1.6 11 -.8`,1.1,.7);
  stand+=eyeOpen(176,35);
  stand+=sk([[160,22],[160,6],[169,18]],'pony',2)+fill(loop([[162,18],[161.6,10],[166,17.4]],.2,0),'muzzle',.7)+sk([[154,25],[150,11],[158,21]],'pony2',1.8);
  stand+=mane([[114,58.6],[120,55],[126,49.6],[132,43.6],[138,37.4],[144,31.6],[150,27],[156,23.4]],14,-.38)+lock([[160,22],[169,26],[174,34]],4)+lock([[162,21],[167,29]],2,'mane2');
  // cheering: rearing a little on the hind legs, forelegs up and folded, head high, mouth open, joy marks
  let cheer=fill(loop([[20,141],[96,137.6],[170,141],[130,145.4],[40,145.4]],.4,0),'shade',.55);
  cheer+=mark(smooth([[46,94],[30,106],[24,124],[32,136]],.3),'mane',6)+mark(smooth([[44,98],[34,112],[34,128]],.3),'mane2',2.2);
  cheer+=leg([[66,104],[68,118],[70,126],[72,131],[74,135]],'pony',true)+hoof(75,137.6);
  cheer+=leg([[120,72],[136,78],[146,86],[148,94],[146,100]],'pony',true)+hoof(145,101,-1.2);
  cheer+=leg([[58,104],[54,118],[56,126],[58,131],[60,135]],'pony',false,[19,13,10,9.2,8])+hoof(61,137.6);
  cheer+=sk(
    [
      [52,118],
      [42,104],
      [46,88],
      [62,76],
      [86,64],
      [108,54],
      [124,46],
      [132,36],
      [142,24],
      [152,14],
      [164,10],
      [176,13],
      [186,22],
      [192,34],
      [192,44],
      [186,50],
      [176,49],
      [166,44],
      [160,50],
      [154,62],
      [146,72],
      [130,84],
      [104,98],
      [80,112],
      [64,118]
    ],
    'pony');
  cheer+=fill(loop([[46,104],[54,90],[66,86],[66,106],[58,116]],.3,0),'pony2',.55)+fill(loop([[84,104],[120,84],[128,86],[104,100],[82,112]],.3,0),'pony2',.5);
  cheer+=leg([[132,66],[148,70],[158,78],[162,86],[160,92]],'pony')+hoof(159,93,-1.3);
  cheer+=blanket(
    [[84,66],[108,55],[122,49],[130,62],[124,78],[104,90],[88,96],[78,82]],
    [[87,68],[108,58.6],[120,53.6],[126,62.6],[121,75],[104,86],[90,92],[82,82]],
    [[80,88],[126,70],[124,78],[104,90],[88,96]]);
  cheer+=fill(loop([[180,26],[191,32],[193,42],[188,46],[178,44],[177,34]],.3,0),'muzzle',.9)+
    fill(loop([[178,40],[190,41],[186,48],[180,47.4]],.2,0),'mouth')+
    ink(`M178 40q6 2 12 .6`,1.4,.85)+
    ink(`M186 34q2.4 1.4 4.4 .4`,1.4,.85);
  cheer+=ink('M163 24q3 -4 6 0',1.8,.95);
  cheer+=sk([[150,12],[151,-4],[160,8]],'pony',2)+fill(loop([[152.4,8],[152.6,0],[157,7.4]],.2,0),'muzzle',.7)+sk([[144,16],[141,2],[149,12]],'pony2',1.8);
  cheer+=mane([[116,50.6],[122,46],[128,40],[134,33],[140,26],[146,19.6],[152,14.4]],14,-.42)+lock([[154,12],[164,14],[168,22]],4)+lock([[156,12],[162,20]],2,'mane2');
  cheer+=`<g class="fr-joy">${ink('M200 18l12 -8M204 34l14 0M198 4l6 -12',2,.75)}</g>`;
  return `<g class="fr-pose p-sleep">${sleep}</g><g class="fr-pose p-stand">${stand}</g><g class="fr-pose p-cheer">${cheer}</g>`;
 }));
 // The heron, a grey heron drawn whole: one outline from the crown round the throat, down the neck (which grows out
 // of the body), under the breast and belly to the tail and back up the back; the folded wing over its side, with the
 // dark flight feathers at its tip, the black bend of the wing and long pale plumes over the back; a white face and
 // throat, the black stripe from the eye running back into two crest plumes, a streaked neck, a dagger bill; legs
 // that bend backward at the ankle, standing in shallow water. 150 x 170 box, feet at y=160; drawn facing right and
 // shown mirrored, so it faces into the lake and flies forward, to the left.
 const heronArt=once(()=>alt(1709,()=>{
  const rot=([x,y],a,[cx,cy])=>{const s=Math.sin(a),k=Math.cos(a);return [cx+x*k-y*s,cy+x*s+y*k];};
  const dot=([x,y],r,tok)=>fill(`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(r*.94)} 0 1 0 ${f1(r*2)} 0a${f1(r)} ${f1(r*.94)} 0 1 0 ${f1(-r*2)} 0`,tok);
  // the head round its centre c, facing along angle a: nape, crown, forehead, the bill's base, chin
  const HEAD=[[-8.6,-.4],[-6,-4.8],[-.5,-6.4],[5,-4.8],[8.2,-2.4],[8.2,2.6],[4.2,4.8]];
  const bill=(c,a,len=27)=>{const P=p=>rot(p,a,c),d=pth([P([7.4,-2.5]),P([7.4+len*.5,-1.3]),P([7.4+len,.3]),P([7.4+len*.52,1.7]),P([7.4,2.7])],true,.12),g=P([5.2,.4]),t=P([7.4+len*.6,.5]);
   return wash(d,'beak')+ink(d,1.5,.92)+ink(`M${f1(g[0])} ${f1(g[1])}L${f1(t[0])} ${f1(t[1])}`,.8,.6);};
  // the face: white, the black stripe from the eye back into two long crest plumes, a yellow eye with a dark pupil
  const face=(c,a)=>{const P=p=>rot(p,a,c);let s=fill(loop([P([-6.4,-.6]),P([-3,-5.2]),P([3,-5.2]),P([6.6,-2.2]),P([6.4,2.6]),P([1,4.4]),P([-5.2,2.8])],.15,0),'heronw',.96);
   s+=fill(loop([P([3.4,-2.8]),P([-2,-3.9]),P([-8.2,-2]),P([-7.8,.3]),P([-1.8,-1.1]),P([3.2,-1.1])],.15,0),'heronp',.95);
   s+=mark(smooth([P([-8,-1.2]),P([-15,-2.2]),P([-21,-.4]),P([-26,2.6])],.12),'heronp',1.9,.95)+mark(smooth([P([-8,.2]),P([-14,1.4]),P([-19,3.6])],.12),'heronp',1.1,.85);
   const e=P([3.3,-1.5]);return s+dot(e,1.7,'beak')+dot(e,.8,'eye');};
  // the outline: head, then the neck's front side down to the body, round the body, and the neck's back side up
  const outline=(Hc,a,c0,w0,bend,lobes,front,tail,back)=>{const c1=rot([-2.4,2.2],a,Hc),[A,B]=limb(c0,c1,w0,9,bend,7,lobes,.45);
   return {pts:[...HEAD.map(p=>rot(p,a,Hc)),...A.slice(0,-1).reverse(),...front,...tail,...back,...B.slice(0,-1)],A,B};};
  // the neck: a white throat stripe down its front with a line of dark streaks, a fringe of plumes at its foot
  const neck=(A,B)=>{const n=A.length,strip=[...A.slice(0,n-1),...A.slice(0,n-1).map((p,i)=>[p[0]*.6+B[i][0]*.4,p[1]*.6+B[i][1]*.4]).reverse()];let s=fill(loop(strip,.15,0),'heronw',.95);
   for(let i=1;i<n-2;i++){
     const p=[A[i][0]*.78+B[i][0]*.22,A[i][1]*.78+B[i][1]*.22],q=[A[i+1][0]*.78+B[i+1][0]*.22,A[i+1][1]*.78+B[i+1][1]*.22];
     s+=mark(`M${f1(p[0])} ${f1(p[1])}L${f1(p[0]+(q[0]-p[0])*.45)} ${f1(p[1]+(q[1]-p[1])*.45)}`,'heronp',1.4,.85);
   }
   return s;};
  const plumes=(pts)=>pts.map(([x,y,l,ang])=>{const d=leafPath(x,y,l,ang,.16);return fill(d,'heronw',.95)+ink(d,.75,.55);}).join('');
  // a leg from the hip through the ankle (bending backward) to the foot, tapering, with a knob at the joint and toes
  const leg=(hip,knee,foot,far=false,inWater=true)=>{const side=(p,q,w)=>{const dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1;return [-dy/l*w,dx/l*w];};
   const a=side(hip,knee,1.9),b=side(knee,foot,1.3),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   const d=pth([[hip[0]+a[0],hip[1]+a[1]],[knee[0]+m[0],knee[1]+m[1]],[foot[0]+b[0],foot[1]+b[1]],[foot[0]-b[0],foot[1]-b[1]],[knee[0]-m[0],knee[1]-m[1]],[hip[0]-a[0],hip[1]-a[1]]],true,.15);
   let s=fill(d,'heronleg',far?.8:.95,.8,.9)+ink(d,1.3,far?.7:.88)+dot([knee[0]+.3,knee[1]],1.9,'heronleg')+ink(`M${f1(knee[0]-1.6)} ${f1(knee[1]-1)}q1.8 1.4 3.6 0`,.9,.7);
   const [fx,fy]=foot;s+=ink(`M${f1(fx)} ${f1(fy)}l${f1(8.6)} ${f1(1.8)}M${f1(fx)} ${f1(fy)}l${f1(5.6)} ${f1(3.2)}M${f1(fx)} ${f1(fy)}l${f1(-4.6)} ${f1(1.4)}`,1.1,far?.32:.42);
   return s;};
  // the folded wing over the body: covert grey, the dark flight feathers at the tip, the black bend of the wing,
  // rows of covert edges and long pale plumes trailing over the back
  const foldedWing=(T=p=>p)=>{const W=[[90,78],[95.4,84.4],[93,91.4],[82,97.8],[64,101.8],[46,103.2],[31,104.6],[19.6,103.8],[26.6,99.6],[40,93.6],[56,87],[72,81.4],[84,78.2]].map(T);
   let s=piece(W,'heron2',1.6,.88,.4);
   s+=fill(loop([[52,102.8],[36,104.4],[20.4,103.8],[27,99.8],[38,95],[48,97.8]].map(T),.2,0),'heronp',.95);
   s+=ink([[36,104],[29.4,100.6],[44,103],[37.4,99.2],[28.6,104.2],[24.4,102.2]].reduce((d,p,i)=>{const q=T(p);return d+(i%2?'L':'M')+f1(q[0])+' '+f1(q[1]);},''),.9,.6);
   s+=fill(loop([[88.4,78.8],[93.6,83.8],[92.4,88.6],[88.4,85],[86.6,80.8]].map(T),.15,0),'heronp',.95);
   for(const [x,y] of [[58,92],[66,89.6],[74,87],[82,85],[62,97],[70,95],[78,92.6]]){
     const p=T([x,y]),q=T([x+6,y-.4]);
     s+=ink(`M${f1(p[0])} ${f1(p[1])}Q${f1((p[0]+q[0])/2+.6)} ${f1((p[1]+q[1])/2+2.6)} ${f1(q[0])} ${f1(q[1])}`,.8,.42);
   }
   s+=mark(smooth([[84,79.6],[67,85.4],[49,93.2],[33,99.6]].map(T),.2),'heron',2,.9)+
     mark(smooth([[80,81.6],[63,89],[45,97.4],[36,101]].map(T),.2),'heron',1.4,.85)+
     ink(smooth([[83,80.4],[66,86.6],[48,94.6],[34,100.4]].map(T),.2),.7,.35);
   return s;};
  // the waterline across the legs: only light marks, no wash (the actor's water would not take the session's light)
  const water=(x0,x1)=>{let s='';
   s+=mark(`M${f1(x0+4)} 152.4q${f1((x1-x0)*.2)} -1.6 ${f1((x1-x0)*.4)} -.2M${f1(x0+(x1-x0)*.55)} 152.6q${f1((x1-x0)*.16)} -1.2 ${f1((x1-x0)*.34)} 0`,'water3',1.6,.85);
   return s;};
  const rings=pts=>pts.map(([x,y])=>ink(pth(ring(x,y,6.4,1.6,10,.04).slice(0,7),false,.2),.9,.5)+ink(pth(ring(x,y+.4,11,2.6,12,.04).slice(1,7),false,.2),.8,.35)).join('');
  // standing: the body tilted up to the breast, the neck in an easy S, the bill level
  const SF=[[106,83],[99,92.4],[86,99.6],[69,103.6],[53,104.2],[39,102.8]],ST=[[27.4,101],[25.4,97.6]],SB=[[37,92],[53,85.2],[71,79.8],[84.6,76.8]];
  const standPose=()=>{const Hc=[104.6,29.6],a=.05,c0=[97.4,77.6],{pts,A,B}=outline(Hc,a,c0,17,-4.2,2,SF,ST,SB);const d=loop(pts,.35);
   let s=leg([80,101],[82.6,128.4],[80.6,155.6],true)+leg([72,102],[70.4,129],[72.6,156.2]);
   s+=water(52,102)+rings([[72.6,152.6],[80.6,152.2]]);
   s+=wash(d,'heron')+neck(A,B)+face(Hc,a)+ink(d,2,.92);
   s+=plumes([[104.6,78,13,1.86],[102.4,80.6,12,1.96],[100.4,83,10,2.1]]);
   s+=foldedWing()+bill(Hc,a);return s;};
  // the crouch before it lifts: the body tipped forward and lowered, the neck drawn in, the ankles bent back
  const tf=([x,y])=>{const a=.17,s=Math.sin(a),k=Math.cos(a),dx=x-70,dy=y-100;return [70+dx*k-dy*s,100+dx*s+dy*k+7];};
  const crouchPose=()=>{const Hc=[116,55.4],a=.2,c0=tf([97.4,77.6]),{pts,A,B}=outline(Hc,a,c0,17,-2.6,2,SF.map(tf),ST.map(tf),SB.map(tf));const d=loop(pts,.35);
   let s=leg(tf([80,101]),[73,132],[80.6,155.6],true)+leg(tf([72,102]),[64,132.6],[72.6,156.2]);
   s+=water(52,102)+rings([[72.6,152.6],[80.6,152.2]]);
   s+=wash(d,'heron')+neck(A,B)+face(Hc,a)+ink(d,2,.92);
   s+=foldedWing(tf)+bill(Hc,a);return s;};
  // In flight: the neck folded back into a pouch under the head, the bill level, the legs trailing past the tail,
  // broad wings: a pale leading edge, grey coverts, the dark hand of primaries spread like fingers. Three frames.
  const FF=[[104,88.6],[96,92.8],[80,94.8],[60,94.4],[44,91.8]],FT=[[30,87.6],[21.6,84],[27.6,79.6]],FBk=[[44,75.6],[62,72.2],[80,71],[92.6,72]];
  const flyBody=(wing)=>{const Hc=[118.4,65.6],a=-.02,c0=[97.6,80.8],{pts,A,B}=outline(Hc,a,c0,19,3.2,1,FF,FT,FBk);const d=loop(pts,.35);
   let s=wing.far||'';
   const trail=(y,l)=>{
     const dd=pth([[44,y-1.4],[10,y-.6],[44-l,y-.2],[44-l-.6,y+1.2],[10,y+1.4],[44,y+1.6]],true,.15);
     return fill(dd,'heronleg',.9)+ink(dd,1.1,.82)+ink(`M${f1(44-l)} ${f1(y)}l-7 -3M${f1(44-l)} ${f1(y+.4)}l-8 .6M${f1(44-l)} ${f1(y+.8)}l-6 3.6`,1,.75);
   };
   s+=trail(88.6,52)+trail(91.2,48);
   s+=wash(d,'heron')+neck(A,B)+face(Hc,a)+ink(d,2,.92);
   s+=wing.near+bill(Hc,a);return s;};
  // one wing, drawn raised (the upstroke) and mapped down for the other two frames: the arm in covert grey with a
  // pale leading edge and the scalloped trailing edge of the secondaries, the dark hand, and five primaries spread
  // like fingers past it
  const ARM=[[92,74],[95.4,60],[96.6,46],[91,39.4],[80,33.6],[70,29.4],[63,39],[58.6,53],[57.4,66],[61.4,74.4]],
    HAND=[[96.6,46],[94.4,33],[89,21],[82.4,11.4],[76,15.4],[71,22],[70,29.4],[80,33.6],[91,39.4]];
  const LEAD=[[92,74],[95.4,60],[96.6,46],[94.6,33.4],[92.6,34.4],[93.4,47],[92.4,60],[88.6,72.6]],FING=[[85,17,16,-1.72],[80.4,17.6,17.4,-1.96],[75.4,21,17,-2.2],[71.4,26.4,15,-2.46]];
  const wingArt=(map,far=false)=>{const T=p=>map(p),k=far?.82:1;let s='';
   for(const [x,y,l,ang] of FING){
     const [bx,by]=T([x,y]),[ex,ey]=T([x+Math.cos(ang)*l,y+Math.sin(ang)*l]),d=leafPath(bx,by,Math.hypot(ex-bx,ey-by),Math.atan2(ey-by,ex-bx),.16);
     s+=fill(d,'heronp',.95)+ink(d,.9,.7*k);
   }
   s+=piece(ARM.map(T),'heron2',1.7*k,.9*k,.4)+fill(loop(HAND.map(T),.2,0),'heronp',.95);
   if(far)return s;
   s+=fill(loop(LEAD.map(T),.2,0),'heron',.95);
   const te=[[70,29.4],[64.6,37.6],[60.6,46.6],[58.4,55.6],[57.6,64.6]].map(T);
   for(let i=0;i<te.length-1;i++){const [x0,y0]=te[i],[x1,y1]=te[i+1];s+=ink(`M${f1(x0)} ${f1(y0)}Q${f1((x0+x1)/2+(y1-y0)*.22)} ${f1((y0+y1)/2-(x1-x0)*.22)} ${f1(x1)} ${f1(y1)}`,.8,.5);}
   for(const [x,y] of [[72,44],[80,46],[86,50],[68,54],[76,56],[84,59],[70,64],[78,66]]){
     const [px,py]=T([x,y]),[qx,qy]=T([x+6,y+.2]);
     s+=ink(`M${f1(px)} ${f1(py)}Q${f1((px+qx)/2+.4)} ${f1((py+qy)/2+2.2)} ${f1(qx)} ${f1(qy)}`,.8,.4);
   }
   return s;};
  const up=p=>p,mid=([x,y])=>[x-(74-y)*.06,82+(74-y)*.36],down=([x,y])=>[x+(74-y)*.1,82+(74-y)*.9];
  const wingUp={far:wingArt(([x,y])=>[x-9,y+3],true),near:wingArt(up)},
    wingMid={far:wingArt(([x,y])=>[x-8,74-(74-y)*.3],true),near:wingArt(mid)},
    wingDown={far:wingArt(([x,y])=>{
    const [a,b]=down([x,y]);
    return [a-9,b-2];
  },true),near:wingArt(down)};
  const M=s=>`<g transform="translate(150 0) scale(-1 1)">${s}</g>`;
  return `<g class="fr-pose p-stand">${M(standPose())}</g><g class="fr-pose p-crouch">${M(crouchPose())}</g><g class="fr-pose p-fly1">${M(flyBody(wingUp))}</g><g class="fr-pose p-fly2">${M(flyBody(wingMid))}</g><g class="fr-pose p-fly3">${M(flyBody(wingDown))}</g>`;
 }));
 // The drops that fall from the heron's feet as it lifts off, and the small ring where they land.
 function heronDropsArt(){
  let s='';for(const [x,y,k] of [[14,8,1],[23,2,1.2],[31,10,.9],[19,16,.8]])s+=`<g class="fr-hdrop">${fill(`M${x} ${y}q${f1(-2.4*k)} ${f1(4*k)} 0 ${f1(5.4*k)}q${f1(2.4*k)} ${f1(-1.4*k)} 0 ${f1(-5.4*k)}z`,'water3')+ink(`M${x} ${y}q${f1(-2.4*k)} ${f1(4*k)} 0 ${f1(5.4*k)}q${f1(2.4*k)} ${f1(-1.4*k)} 0 ${f1(-5.4*k)}z`,.8,.6)}</g>`;
  return `<g class="fr-hdropfall">${s}</g><g class="fr-ripplering fr-hring">${ink(pth(ring(23,42,16,3.6,12),true,.4),1.2,.6)}${ink(pth(ring(23,42,8,1.8,10),true,.3),1,.6)}</g>`;
 }
 const puff=(r,tok='smoke')=>fill(pth(ring(r,r,r,r*.85,10),true,1),tok,.5)+ink(pth(ring(r,r,r,r*.85,10).slice(0,7),false,.8),1,.25);
 function steamArt(n=4,r=9){let s='';for(let i=0;i<n;i++)s+=`<g class="fr-puff" style="--i:${i}">${puff(r*(1+i*.12),'steam')}</g>`;return s;}
 // ---------------------------------------------------------------- the actors
 // Each actor is placed at stage pixels; the controller and CSS animate the box or its inner groups.
 const actor=(cls,x,y,w,h,inner,extra='')=>`<div class="fr-a ${cls}" style="left:${f1(x)}px;top:${f1(y)}px;width:${w}px;height:${h}px"${extra}><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false">${inner}</svg></div>`;
 // Drifting clouds; over rain they are long low bands of stratus, so each carries its own width for the drift.
 function cloudsLayer(list,kind='day'){
   return list.map(([y,w,dur,delay,o])=>{const id=rnd();seed=Math.floor(id*1e6)+7;const band=kind==='stratus',cw=band?Math.round(w*1.9):w,ch=Math.round(cw*(band?.24:.32)+24);
  return `<div class="fr-cloud" style="top:${y}px;--d:${dur}s;--dl:${delay}s;--cw:${cw+40}px;--x:${f1(-cw-40+(1440+cw+80)*(-delay/dur))}px;opacity:${o}"><svg viewBox="-4 -4 ${cw+12} ${ch}" width="${cw+12}" height="${ch}" aria-hidden="true" focusable="false">${band?stratus(cw):cloud(w)}</svg></div>`;}).join('');}
 // A chimney's smoke: three thin open wisps that leave the cap, lean with the air and thin out within a hand's height.
 // No outline closes and no disc is drawn; each wisp is a soft wash line under a fine ink one.
 function wispActor(x,y){return alt(5309,()=>actor('fr-smoke fr-wisps',x-30,y-92,72,96,Array.from({length:3},(_,i)=>{const pts=[[30,92]];let px=30,py=92;
  for(let k=1;k<6;k++){px+=R(1,5)+k*.6;py-=R(10,15);pts.push([px+(k%2?-3:3)*R(.6,1.4),py]);}const d=smooth(pts,.6);
  return `<g class="fr-wisp" style="--i:${i}">${mark(d,'mist',5.2-i*.6,.32)}${mark(d,'smoke',1.6,.5)}</g>`;}).join('')));}
 // The campfire's smoke: thin open wisps, not puffs. Three strokes leave the flames, lean with the air and thin out
 // within about 120 px (each drawn in three lengths, fainter the higher they go: flat washes, never a gradient), in a
 // warm smoke tone lit from below. No closed outlines, no growing discs.
 function fireWispActor(x,y){return alt(5323,()=>actor('fr-smoke fr-wisps fr-firewisps',x-40,y-126,96,130,Array.from({length:3},(_,i)=>{
  const pts=[[40+(i-1)*7,126]];let px=pts[0][0],py=126;for(let k=1;k<7;k++){px+=R(1.5,4.5)+k*.9;py-=R(15,19);pts.push([px+(k%2?-3.5:3.5)*R(.5,1.3),py]);}
  const part=(a,b)=>smooth(pts.slice(a,b),.5),w=4.6-i*.5;
  return `<g class="fr-wisp" style="--i:${i}">${mark(part(0,4),'firesmoke',w,.3)+mark(part(0,4),'firesmoke',1.5,.62)+mark(part(3,6),'firesmoke',w*.8,.18)+mark(part(3,6),'firesmoke',1.2,.4)+mark(part(5,7),'firesmoke',1,.22)}</g>`;}).join('')));}
 function shimmer(x,y,w,h,density=60,{lines='ripple',hi='water3',inside=null}={}){
  // two sets of ripple marks that take turns; each drifts a few pixels and back, forever, like water
  // each set is its own small layer, so the browser cross-fades them without repainting the water
  // inside(x0,x1,y) keeps every mark on the water (a stream between its banks), with room for the drift
  const set=k=>{const B=Batch();let n=0,tries=0;while(n<density&&tries++<density*12){const px=R(0,w),py=R(4,h-4),depth=py/h,l=R(10,26)*(.6+depth*.9);
    if(inside&&!inside(x+px-10,x+px+l+10,y+py))continue;n++;B.mark(rnd()<.35?hi:lines,`M${f1(px)} ${f1(py)}q${f1(l*.5)} ${f1(-1.5-depth)} ${f1(l)} 0`,1+depth*.9,.5+depth*.35);}
    return actor(`fr-shimmer s${k}`,x,y,w,h,B.out());
  };
  return set(1)+set(2);
 }
 // Where a bank line (points running down the screen) crosses height y.
 function bankX(pts,y){
   for(let i=0;i<pts.length-1;i++){const [ax,ay]=pts[i],[bx,by]=pts[i+1];if(y>=ay&&y<=by)return ax+(bx-ax)*(by===ay?0:(y-ay)/(by-ay));}
   return y<pts[0][1]?pts[0][0]:pts[pts.length-1][0];
 }
 // ---------------------------------------------------------------- small true things (still drawing)
 // An open notebook with ruled lines, a margin, a pencil laid across it: the work that came out here with you.
 function notebook(x,y,rot=-6){
  let s=fill(pth([[x-4,y+3],[x+76,y+1],[x+78,y+7],[x-2,y+9]],true,.4),'shade',.5);
  const L=[[x,y],[x+2,y-26],[x+36,y-30],[x+37,y-2]],Rp=[[x+37,y-2],[x+36,y-30],[x+72,y-28],[x+74,y]];
  s+=shape(L,'page',1.4,.85,.5)+shape(Rp,'page',1.4,.85,.5)+fill(pth([[x+34,y-30],[x+39,y-30],[x+39,y-2],[x+35,y-2]],true,.3),'page2',.8);
  const B=Batch();for(let i=0;i<5;i++){B.mark('rule',`M${f1(x+6)} ${f1(y-22+i*4.4)}l${f1(26)} ${f1(-.6)}`,.7,.8);B.mark('rule',`M${f1(x+41)} ${f1(y-23+i*4.4)}l${f1(28)} ${f1(.4)}`,.7,.8);}
  B.mark('fl2',`M${f1(x+8)} ${f1(y-25)}v22`,.7,.6);for(let i=0;i<3;i++)B.ink(`M${f1(x+44)} ${f1(y-21+i*4.4)}l${f1(R(10,22))} 0`,.8,.55);
  s+=B.out()+`<g transform="rotate(${rot} ${x+40} ${y-12})">${shape([[x+22,y-14],[x+26,y-17],[x+70,y-17],[x+70,y-12],[x+26,y-12]],'pencil',1,.85,.3)}${fill(`M${x+22} ${y-14.5}l4 -2.5v5z`,'wood')}${fill(`M${x+66} ${y-17}h4v5h-4z`,'eraser')}</g>`;
  return s;
 }
 // A fallen log lying along the ground, drawn round: its bark in long fissures with a lighter top where the light
 // catches it and a darker underside, a broken stub of a branch, the sawn end in rings with a crack, the far end
 // broken off ragged, moss on its top and three small mushrooms by its foot.
 function fallenLog(x,y,w,h=26,SH){
  const body=[[x+3,y-h*.86],[x+w*.3,y-h-1.4],[x+w*.7,y-h+.6],[x+w-3,y-h*.94],[x+w+1.4,y-h*.5],[x+w-3,y-.6],[x+w*.6,y+2],[x+w*.25,y+1.4],[x+2,y-1],[x-2.4,y-h*.3],[x+1.6,y-h*.52],[x-1.6,y-h*.7]];
  let s=fill(loop([[x-8,y+1],[x+w*.5,y-1],[x+w+10,y+1.6],[x+w*.6,y+6],[x,y+5.6]],.4,0),'shade',.55)+piece(body,'bark',2,.9,.4);
  s+=fill(loop([[x+4,y-h*.36],[x+w*.5,y-h*.3],[x+w-4,y-h*.36],[x+w-4,y-2],[x+w*.5,y+1],[x+4,y-1]],.4,0),'wood3',.45)+
    fill(loop([[x+8,y-h*.86],[x+w*.4,y-h*.98],[x+w*.8,y-h*.84],[x+w*.5,y-h*.74],[x+w*.12,y-h*.72]],.4,0),'wood',.5);
  const B=Batch();for(let i=0;i<9;i++){const yy=y-h*R(.18,.86),x0=x+R(8,w*.5),l=R(w*.18,w*.42);B.ink(smooth([[x0,yy],[x0+l*.5,yy+J(1.4)],[x0+l,yy+J(1.4)]],.4),R(.8,1.2),.5);}
  for(let i=0;i<7;i++){const xx=x+R(12,w-16),yy=y-h*R(.2,.8);B.ink(`M${f1(xx)} ${f1(yy)}l${f1(J(1.4))} ${f1(R(3,6))}`,.8,.45);}
  for(let i=0;i<5;i++)B.fill('moss',loop(ring(x+R(14,w-24),y-h+R(-.6,3),R(8,15),R(2.6,4.4),8,.12),.4,0),.9);
  for(let i=0;i<14;i++)B.mark('grass',`M${f1(x+R(12,w-20))} ${f1(y-h+R(0,3))}l${f1(J(2))} ${f1(-R(2,5))}`,1.1,.7);
  // a broken stub of a branch, the ragged far end
  B.ink(`M${f1(x+w*.42)} ${f1(y-h+1)}l${f1(-4)} ${f1(-10)}l${f1(5)} ${f1(-1)}l${f1(2)} ${f1(10)}`,1.6,.85);B.ink(`M${f1(x+1)} ${f1(y-h*.66)}l5 2l-3 4l6 3`,1.2,.7);
  s+=B.out();
  // the sawn end: the face in rings, a crack to the heart, the bark round it
  const ex=x+w+.4,ey=y-h*.48,rx=h*.3,ry=h*.52,face=ring(ex,ey,rx,ry,12,.04);
  s+=piece(face,'wood',1.6,.9,.3);for(const r of [.7,.44,.2])s+=ink(loop(ring(ex+J(.4),ey+J(.4),rx*r,ry*r,10,.05),.3,1),.8,.5);
  s+=ink(`M${f1(ex)} ${f1(ey)}l${f1(rx*.7)} ${f1(-ry*.5)}`,.9,.6)+mark(loop(face,.3,2),'bark',1.6,.8);
  for(let i=0;i<3;i++){const mx=x+w*.18+i*16,my=y+2-i,cap=R(7,10);s+=ink(`M${f1(mx)} ${f1(my)}v${f1(-R(6,10))}`,2.4,.85)+mark(`M${f1(mx)} ${f1(my)}v${f1(-R(6,9))}`,'page',1.2,.9);
   const cd=`M${f1(mx-cap)} ${f1(my-8)}q${f1(cap)} ${f1(-cap*1.3)} ${f1(cap*2)} 0q${f1(-cap)} 3 ${f1(-cap*2)} 0z`;s+=wash(cd,'cap')+ink(cd,1.3,.85)+ink(`M${f1(mx-cap*.6)} ${f1(my-8.6)}h${f1(cap*1.2)}`,.7,.5);
   for(let k=0;k<3;k++)s+=fill(`M${f1(mx-cap*.5+k*cap*.5)} ${f1(my-12)}a1.1 1 0 1 0 2.2 0a1.1 1 0 1 0 -2.2 0`,'page',.9);}
  SH?.cast(x+w*.5,y+2,w*.7,8);
  return s;
 }
 // Two ducks asleep on the water by the reeds, heads tucked; and a dragonfly resting on a reed tip.
 function duck(x,y,k=1,dir=1){
  const P=pts=>pts.map(([a,b])=>[x+a*k*dir,y+b*k]);
  let s=fill(pth(P([[-16,2],[18,2],[14,6],[-12,6]]),true,.4),'water2',.7);
  s+=shape(P([[-18,0],[-14,-10],[0,-14],[14,-10],[20,-2],[10,2],[-14,2]]),'duck',1.5,.85,.5)+fill(pth(P([[-6,-10],[10,-9],[14,-3],[0,-2]]),true,.4),'duck2',.8);
  s+=shape(P([[6,-12],[10,-20],[18,-20],[20,-13],[14,-9]]),'duckhead',1.4,.85,.4)+fill(pth(P([[19,-15],[25,-14],[20,-12]]),true,.3),'beak')+ink(`M${f1(x+15*k*dir)} ${f1(y-16*k)}q2 -1 3 0`,1,.8);
  return s+ink(pth(P([[-20,4],[22,4]]),false,.6),1,.4);
 }
 function dragonfly(x,y){return ink(`M${x} ${y}l18 -2`,1.8,.85)+fill(`M${x+2} ${y-1}l10 -9l3 2l-9 8zM${x+2} ${y}l11 8l2 -2l-10 -7z`,'wing',.75)+ink(`M${x+2} ${y-1}l10 -9l3 2M${x+2} ${y}l11 8l2 -2`,.8,.6)+fill(`M${x+15} ${y-3}a2.4 2.2 0 1 0 4.8 0a2.4 2.2 0 1 0 -4.8 0`,'kingfisher');}
 // A row of trees far off, paler: the air between you and them.
 function farTreeline(y,io=.22,tok='treefar'){
   const B=Batch();
   let x=-20;
   while(x<W+20){
     x+=R(6,13);
     const h=R(16,36);
     B.fill(tok,pth([[x,y-h],[x+h*.18,y-h*.55],[x+h*.12,y-h*.55],[x+h*.3,y],[x-h*.3,y],[x-h*.12,y-h*.55],[x-h*.18,y-h*.55]],true,.5));
     if(rnd()<.4)B.ink(`M${f1(x)} ${f1(y-h)}l${f1(h*.3)} ${f1(h)}`,.8,io);
   }
   return B.out();
 }
 function pinecone(B,x,y){B.fill('wood2',pth(ring(x,y,3.4,5.4,8),true,.3));for(let k=0;k<3;k++)B.ink(`M${f1(x-3)} ${f1(y-3+k*3)}l6 1.4`,.6,.6);}
 // A watering can, a clay pot with a fern, a garden snail on the wall.
 function pot(x,y,plant='fern'){
   let s=fill(pth(ring(x,y+2,20,4,8),true,.4),'shade',.5)+shape([[x-16,y-26],[x+16,y-26],[x+12,y],[x-12,y]],'clay',1.6,.9,.4)+shape([[x-19,y-30],[x+19,y-30],[x+18,y-24],[x-18,y-24]],'clay2',1.4,.9,.3);
  const B=Batch();
  if(plant==='fern'){
    for(let k=-3;k<=3;k++){
      const ex=x+k*9,ey=y-60+Math.abs(k)*6;
      B.mark('fern',`M${x} ${y-28}Q${f1(x+k*4)} ${f1(y-48)} ${f1(ex)} ${f1(ey)}`,1.3,.9);
      for(let j=1;j<6;j++){const t=j/6,px=x+(ex-x)*t,py=y-28+(ey-y+28)*t;B.mark('fern',`M${f1(px)} ${f1(py)}l-4 -2M${f1(px)} ${f1(py)}l4 -2`,1,.85);}
    }
  }
  else{for(let i=0;i<9;i++){const a=-Math.PI/2+J(1.1),l=R(12,22);B.fill(pick(['leaf','leaf2','leaf3']),leafPath(x+J(4),y-28,l,a,.45));}}
  return s+B.out();}
 // An enamel pot and two tin mugs on a flat stone, steam-free; a coil of rope and a small axe stand nearby.
 function campKit(x,y){let s=fill(pth(ring(x+40,y+2,48,6,10),true,.6),'shade',.55)+shape([[x,y],[x+6,y-12],[x+74,y-14],[x+82,y-2],[x+60,y+4],[x+14,y+4]],'rock',1.6,.85,.6);
  s+=shape([[x+12,y-12],[x+12,y-34],[x+42,y-34],[x+42,y-12]],'enamel',1.6,.9,.4)+
    ink(`M${x+10} ${y-34}h34`,2.4,.9)+
    ink(`M${x+42} ${y-28}h8`,2.2,.85)+
    fill(pth([[x+14,y-30],[x+20,y-30],[x+20,y-16],[x+14,y-16]],true,.3),'enamel2',.6);
  for(const mx of [x+54,x+66])s+=shape([[mx,y-12],[mx,y-24],[mx+9,y-24],[mx+9,y-12]],'tin',1.3,.9,.3)+ink(`M${mx+9} ${y-21}q5 1 0 6`,1.1,.85);
  return s;}
 // ---------------------------------------------------------------- the improved hand (Lake first)
 // Pieces drawn round rather than ruled: closed loops for living things and stones, tapering strokes for branches,
 // varied kinds for repeated things. Marks of one kind still go into batches, so the detail costs few elements.
 const shift=(pts,dx=1.6,dy=1.8)=>pts.map(([x,y])=>[x+dx,y+dy]);
 const jit=(pts,a)=>pts.map(([x,y])=>[x+J(a),y+J(a)]);
 const dab=(x,y,r,ry=r*.86)=>`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(ry)} 0 1 0 ${f1(r*2)} 0a${f1(r)} ${f1(ry)} 0 1 0 ${f1(-r*2)} 0`;
 // A mountain range of craggy ridges, not triangles: every peak climbs in steps to its summit and comes down in
 // others; its face away from the morning sun lies in a flat shade wash; snow follows the rock down in tongues; a few
 // gullies and a little hatching on the shade side only, different on every peak.
 function range(y,tok,io,opts={}){return whole(()=>range1(y,tok,io,opts));}
 function range1(y,tok,io,{snow=false,peaks=[150,230],low=[80,140],rise=[50,118],shade=.1,tall=null}={}){
  const pts=[[-20,y+30]],tops=[];let x=-20-R(0,60);
  while(x<W+20){const w=R(...peaks),x0=x,cx=x0+w*.5+J(w*.06),h=tall&&cx>tall[0]&&cx<tall[1]?Math.max(R(...rise),tall[2]):R(...rise);
   const n=RI(2,3);for(let i=1;i<=n;i++){const t=i/(n+1);pts.push([x0+(cx-x0)*t+J(5),y-h*Math.pow(t,1.1)*R(.8,1.04)]);}
   pts.push([cx,y-h]);const right=[];
   const m=RI(2,4);for(let i=1;i<=m;i++){const t=1-i/(m+1),p=[cx+(x0+w-cx)*(1-t)+J(5),y-h*Math.pow(t,1.15)*R(.78,1.05)];pts.push(p);right.push(p);}
   tops.push({cx,top:y-h,w,h,right,x1:x0+w});x=x0+w;const v=R(...low);pts.push([x+v*.5,y-R(4,28)]);x+=v;}
  pts.push([W+20,y+30]);
  if(RIDGE)RIDGE.push(pts.map(([px,py])=>[Math.round(px),Math.round(py)]));
  const d=pth(pts,false,1.1);let s=fill(d+`L${W+20} ${HZ+40}L-20 ${HZ+40}Z`,tok);
  const B=Batch();
  for(const {cx,top,w,h,right,x1} of tops){
   // the shade face: from the summit down the right-hand ridge to its foot, back along a gully
   B.fill('shadow',pth([[cx,top+1],...right,[x1,y+8],[cx+w*R(.04,.12),y+8],[cx+w*R(.02,.08),top+h*.5],[cx+2,top+h*.16]],true,1),shade);
   if(snow&&h>70){const r0=R(.18,.26),l0=R(.14,.22),cap=[[cx,top-1]];
    const rr=right.filter(p=>p[1]<top+h*r0+4);cap.push(...rr.map(([a,b])=>[a+1,b-1]));const ry=top+h*r0,ly=top+h*l0;
    const tongues=RI(3,5),xl=cx-(cx-(cx-w*.5))*l0*.95,xr=rr.length?rr[rr.length-1][0]:cx+w*.5*r0;
    cap.push([xr,ry]);for(let i=1;i<tongues*2;i++){const t=i/(tongues*2),tx=xr+(xl-xr)*t;cap.push([tx,(ry+(ly-ry)*t)+(i%2?R(6,14):R(-1,2))]);}
    cap.push([xl,ly],[cx-(cx-xl)*.5,top+h*l0*.45]);
    s+=fill(pth(cap,true,.6),'snow',.95);B.ink(pth(cap.slice(1),false,.5),1,io*.55);}
   // gullies down the face, and hatching on the shade side
   for(let k=0,g=RI(1,3);k<g;k++){const gx=cx+w*R(-.18,.22),gy=top+h*R(.16,.3);B.ink(pth([[gx,gy],[gx+J(4)-3,gy+h*R(.2,.3)],[gx+J(6)-6,gy+h*R(.42,.62)]],false,.6),R(.9,1.2),io*.42);}
   for(let k=0,n=RI(2,5);k<n;k++){const hx=cx+w*R(.06,.3),hy=top+h*R(.25,.7),l=R(7,13);B.ink(`M${f1(hx)} ${f1(hy)}l${f1(l*.45)} ${f1(l)}`,1,io*.4);}
  }
  return s+B.out()+ink(d,1.8,io);
 }
 // A far tree, one of several kinds so that no two neighbours match: a narrow spruce of many short drooping tiers,
 // a broad fir of a few wide ones, a pine with a bare trunk and tufted crown, a round leafy tree, now and then a
 // dead snag. Washes (set off the line) and lines go into batches: a whole band is a handful of elements.
 function farTree(B,x,y,h,tok,io,kind=pick(['spruce','spruce','spruce','fir','fir','round','round'])){
  const lw=h>50?1.3:1.1;
  if(kind==='round'){
    const r=h*.36,cy=y-h*.52,pts=[];
    for(let i=0,n=RI(8,10);i<n;i++){const a=i/n*Math.PI*2-Math.PI/2;pts.push([x+Math.cos(a)*r*R(.82,1.08),cy+Math.sin(a)*r*R(.78,1)*(Math.sin(a)>.3?.9:1.08)]);}
   B.ink(`M${f1(x)} ${f1(y)}l${f1(J(1))} ${f1(-h*.2)}`,lw+.4,io);
   const d=loop(pts,.6,3);
   B.fill(tok,loop(shift(pts),.6,0));
   B.fill('treeshade',loop([[x+r*.1,cy-r*.6],[x+r*.9,cy-r*.1],[x+r*.6,cy+r*.7],[x,cy+r*.5]],.5,0),.42);
   B.ink(d,lw,io);
   if(rnd()<.6){const lx=x+R(-r*.5,r*.3),ly=cy+R(-r*.2,r*.3);B.ink(`M${f1(lx)} ${f1(ly)}q${f1(r*.3)} ${f1(r*.22)} ${f1(r*.6)} ${f1(-r*.04)}`,.8,io*.6);}return;}
  if(kind==='pine'){const ty=y-h*.45;B.ink(pth([[x,y],[x+J(1.4),y-h*.5],[x+J(2),y-h*.85]],false,.4),lw+.5,io);
   const cy=y-h*.74,r=h*.26,pts=[];for(let i=0,n=9;i<n;i++){const a=i/n*Math.PI*2-Math.PI/2,up=Math.sin(a)<0;pts.push([x+Math.cos(a)*r*R(.9,1.12),cy+Math.sin(a)*r*(up?.5:.42)*R(.8,1.1)]);}
   B.fill(tok,loop(shift(pts),.5,0));B.fill('treeshade',loop([[x-r*.7,cy+r*.1],[x+r*.8,cy+r*.06],[x+r*.5,cy+r*.4],[x-r*.4,cy+r*.42]],.4,0),.45);B.ink(loop(pts,.5,2),lw*.9,io);
   B.ink(`M${f1(x-r*.5)} ${f1(cy-r*.05)}q${f1(r*.2)} ${f1(-r*.12)} ${f1(r*.4)} 0M${f1(x+r*.1)} ${f1(cy+r*.08)}q${f1(r*.2)} ${f1(-r*.12)} ${f1(r*.4)} 0`,.8,io*.7);
   B.ink(`M${f1(x)} ${f1(ty)}l${f1(-h*.1)} ${f1(-h*.1)}M${f1(x)} ${f1(ty-h*.08)}l${f1(h*.1)} ${f1(-h*.12)}`,.9,io*.8);return;}
  if(kind==='snag'){
    B.ink(pth([[x,y],[x+J(1),y-h*.5],[x+J(2),y-h*.9]],false,.4),lw+.6,io);
    B.ink(`M${f1(x)} ${f1(y-h*.6)}l${f1(-h*.14)} ${f1(-h*.1)}M${f1(x)} ${f1(y-h*.72)}l${f1(h*.12)} ${f1(-h*.08)}`,1,io);
    return;
  }
  if(kind==='haze'){
    const w=h*R(.2,.3),pts=[[x+J(1),y-h]];
    for(let i=1;i<=3;i++){const t=i/3;pts.push([x+w*t*R(.9,1.1),y-h+h*t*.9+h*.04],[x+w*t*.4,y-h+h*t*.9-h*.03]);}
    pts.push([x,y],[x-w*.9,y-h*.06]);
    for(let i=3;i>=1;i--){const t=i/3;pts.push([x-w*t*.4,y-h+h*t*.9-h*.03],[x-w*t*R(.9,1.1),y-h+h*t*.9+h*.04]);}
    B.fill(tok,pth(pts,true,.6));
    return;
  }
  const spruce=kind==='spruce',tiers=spruce?RI(4,6):RI(3,4),w=h*(spruce?R(.17,.24):R(.28,.38)),droop=spruce?R(.02,.05):R(.04,.08),skew=J(.12);
  const right=[],left=[];for(let i=1;i<=tiers;i++){const t=i/tiers,ty=y-h+h*t*.92,tw=w*(.22+.78*Math.pow(t,spruce?.9:.75))*R(.86,1.12);
   right.push([x+tw*(1+skew),ty+h*droop]);if(i<tiers)right.push([x+tw*.42,ty-h*.02]);left.push([x-tw*(1-skew),ty+h*droop*R(.6,1.2)]);if(i<tiers)left.push([x-tw*.4,ty-h*.025]);}
  const top=[x+J(1.2),y-h],out=[top,...right,[x+1.4,y-h*.05],[x-1.4,y-h*.05],...left.reverse()];
  B.fill(tok,pth(shift(out,1.4,1.6),true,.7));B.fill('treeshade',pth([[x+.6,y-h*.94],...right.filter((_,i)=>i%2===0).map(([a,b])=>[x+(a-x)*.82,b-1]),[x+1,y-h*.08]],true,.6),.5);
  B.ink(pth(out,true,.7),lw,io);B.ink(`M${f1(x)} ${f1(y-h*.05)}l${f1(J(.6))} ${f1(h*.08)}`,lw+.5,io);
 }
 // The far shore's woods: a pale back row in the haze, then the near row of mixed trees that breaks the skyline,
 // with a few tall ones standing out.
 function woods(y,opts={}){return whole(()=>woods1(y,opts));}
 function woods1(y,{gap=[9,19],h=[26,58],io=.42,back=true,skip=null}={}){
  const B=Batch(),F=Batch();
  if(back){let x=-20;while(x<W+20){x+=R(9,16);const hh=R(16,34);if(skip&&skip(x))continue;farTree(F,x,y-8+J(2),hh,'treefar',io*.5,rnd()<.75?'haze':'round');}}
  {const top=[];for(let x=-20;x<=W+20;x+=R(14,26))top.push([x,y-R(4,12)]);F.fill('tree3',pth([[-20,y+8],...top,[W+20,y+8]],true,1.5),.9);F.ink(pth(top,false,1.2),1,io*.4);}
  let x=-14;
  while(x<W+20){const tall=rnd()<.08,hh=R(...h)*(tall?1.5:1),k=tall?'spruce':rnd()<.02?'snag':undefined;if(!(skip&&skip(x)))farTree(B,x,y+J(3),hh,pick(['tree1','tree2','tree3']),io,k);x+=R(...gap);}
  return F.out()+B.out();
 }
 // A boulder drawn round: the shaded side and underside in a darker wash, one lighter lobe on top, a facet and a
 // crack, lichen and (when set) a cap of moss; pebbles at its foot and a contact shadow under it.
 function boulder(x,y,w,h,{tok='rock',io=.85,moss=false,wet=false}={},SH){
  const pts=jit([[x+w*.04,y+1],[x-w*.02,y-h*.38],[x+w*.12,y-h*.8],[x+w*.36,y-h],[x+w*.64,y-h*.95],[x+w*.88,y-h*.64],[x+w*1.02,y-h*.22],[x+w*.97,y+.5],[x+w*.52,y+2.2]],Math.min(3,w*.025));
  const d=loop(pts,.5);let s=fill(loop([[x-w*.06,y],[x+w*.5,y-3],[x+w*1.1,y],[x+w*.9,y+5],[x+w*.2,y+5.4]],.5,0),'shade',.55);
  s+=wash(d,tok)+fill(loop([[x+w*.56,y-h*.92],[x+w*.86,y-h*.62],[x+w*.98,y-h*.22],[x+w*.92,y],[x+w*.42,y+1.4],[x+w*.18,y-h*.12],[x+w*.48,y-h*.3],[x+w*.62,y-h*.62]],.4,0),'rock2',.85);
  s+=fill(loop([[x+w*.16,y-h*.72],[x+w*.34,y-h*.9],[x+w*.48,y-h*.86],[x+w*.3,y-h*.66]],.3,0),'snow',.38);
  s+=ink(d,2,io)+ink(smooth([[x+w*.55,y-h*.94],[x+w*.6,y-h*.6],[x+w*.5,y-h*.3],[x+w*.54,y-h*.04]],.6),1.1,io*.55);
  const B=Batch();B.ink(pth([[x+w*.2,y-h*.58],[x+w*.27,y-h*.46],[x+w*.24,y-h*.32],[x+w*.3,y-h*.2]],false,.5),.9,io*.55);
  for(let k=0;k<4;k++)B.ink(`M${f1(x+w*(.7+k*.055))} ${f1(y-h*(.6-k*.03))}l${f1(w*.05)} ${f1(h*.28)}`,1,io*.45);
  for(let k=0;k<RI(4,8);k++)B.fill(pick(['moss','sand2']),dab(x+w*R(.1,.5),y-h*R(.3,.8),R(.9,2)),.8);
  if(moss){B.fill('moss',loop([[x+w*.1,y-h*.66],[x+w*.3,y-h*.94],[x+w*.52,y-h*1.0],[x+w*.6,y-h*.9],[x+w*.42,y-h*.82],[x+w*.24,y-h*.6]],.4,0),.95);
   for(let k=0;k<7;k++)B.mark('grass',`M${f1(x+w*R(.14,.5))} ${f1(y-h*R(.74,.92))}l${f1(J(2))} ${f1(-R(2,4))}`,1.3,.75);}
  if(wet)B.mark('water3',`M${f1(x+w*.2)} ${f1(y-h*.75)}q${f1(w*.1)} -6 ${f1(w*.24)} -4`,2.2,.9);
  s+=B.out();
  for(let k=0;k<3;k++){const px=x+R(-10,w+8),py=y+R(1,5),r=R(2,4.4);s+=piece(ring(px,py,r,r*.62,7,.12),tok,1,io*.6,.3);}
  SH?.cast(x+w*.5,y,w*.9+h*.6,h*.32);
  return s;
 }
 // A weeping birch seen from nearby: the white trunk bends a little as it climbs and narrows, dark rough bark at its
 // foot, the black marks of birch bark in short broken bands of every length with a few dark knots under the eyebrow
 // scar of a lost branch. Its branches are fine brown wood, thinner than the trunk's line and tapering: they rise,
 // arch out and let fall long hanging twigs, and the foliage hangs from those twigs in curtains of small leaves in
 // several greens, with sky showing between the curtains. The top of the crown is leaves too, never a bare fork.
 // No washes of leaf without leaves: every green is a drawn leaf. reachL shortens the branches on the left.
 function birchTree(x,y,h,{lean=0,leaves=150,io=.9,crown=1,reachL=1}={},SH){
  const ph=R(0,6),C=t=>[x+lean*h*t+Math.sin(t*3.6+ph)*h*.012,y-h*t],wid=t=>(h*.028+4)*(1-t*.9)+(t<.06?(.06-t)*h*.25:0);
  const n=9,L=[],Rt=[];for(let i=0;i<=n;i++){const t=i/n,[cx,cy]=C(t),w=i===n?.4:wid(t)/2;L.push([cx-w,cy]);Rt.push([cx+w,cy]);}
  const trunk=[...L,...Rt.reverse()];const td=pth(trunk,true,.5);
  const B=Batch(),W=Batch(),LB=Batch();let s='';
  const along=(a,b,c,u)=>[(1-u)*(1-u)*a[0]+2*(1-u)*u*b[0]+u*u*c[0],(1-u)*(1-u)*a[1]+2*(1-u)*u*b[1]+u*u*c[1]];
  const curtains=[],caps=[];
  // a hanging twig from a point: it leaves the branch outward, then falls; its leaves hang along it
  const hang=(px,py,dir,len)=>{
    const sw=dir*R(3,8),c=[px+sw,py+len*.35],e=[px+sw*.6+J(3),py+len];
    W.mark('wood3',`M${f1(px)} ${f1(py)}Q${f1(c[0])} ${f1(c[1])} ${f1(e[0])} ${f1(e[1])}`,.75,.9);
    curtains.push([[px,py],c,e,dir,len]);
  };
  // a branch: rises from the trunk, arches out, tapers (three strokes, each finer), sheds hanging twigs
  const branch=(bx,by,dir,len,rise=R(.6,1.5))=>{const p1=[bx+dir*len*.34,by-len*R(.3,.48)*rise],p2=[bx+dir*len*.72,by-len*R(.3,.46)*rise],p3=[bx+dir*len,by-len*R(.1,.26)*rise];
   W.mark('wood3',smooth([[bx,by],[(bx+p1[0])/2,(by+p1[1])/2+1],p1],.3),1.9,1);W.mark('wood3',smooth([p1,[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2-1],p2],.3),1.3,1);W.mark('wood3',smooth([p2,p3],.3),.9,1);
   for(let k=0,m=RI(4,7);k<m;k++){const u=.2+k/m*.8+R(0,.08),q=u<.5?along([bx,by],p1,p2,u*2):along(p1,p2,p3,(u-.5)*2);hang(q[0],q[1],dir,R(18,70)*crown*(.7+u*.5));}
   if(rnd()<.4){
     const q=along([bx,by],p1,p2,.8),f=[q[0]+dir*len*.3,q[1]+len*R(-.1,.15)];
     W.mark('wood3',`M${f1(q[0])} ${f1(q[1])}Q${f1((q[0]+f[0])/2)} ${f1(Math.min(q[1],f[1])-len*.08)} ${f1(f[0])} ${f1(f[1])}`,.9,1);
     hang(f[0],f[1],dir,R(20,50)*crown);
   }
   return p3;};
  for(let i=0;i<17;i++){const t=.36+.58*(i/16)+J(.015),[bx,by]=C(Math.min(.96,t)),dir=i%2?1:-1,len=h*R(.09,.17)*(1.2-t*.55)*(dir<0?reachL:1);branch(bx,by,dir,len);}
  // the top of the crown: the leader runs on into fine arching twigs that fall on both sides
  {const [tx,ty]=C(1);W.mark('wood3',`M${f1(tx)} ${f1(ty+4)}q${f1(J(2))} ${f1(-h*.03)} ${f1(J(3))} ${f1(-h*.05)}`,1.2,1);
   for(const dir of [-1,1,-1,1])branch(tx+J(2),ty-h*R(-.02,.03),dir,h*R(.035,.06),R(1.6,2.2));caps.push([tx,ty-h*.035,h*.07]);}
  s+=W.out()+fill(td,'birch',1);
  // dark rough bark at the foot, with its cracks
  const fb=[];for(let i=0;i<=6;i++){const t=i/6;fb.push([L[0][0]+(Rt[0][0]-L[0][0])*t,y-h*R(.05,.13)]);}
  s+=fill(pth([[L[0][0]-1,y+1],...fb,[Rt[0][0]+1,y+1]],true,.6),'bark',.85);
  for(let k=0;k<5;k++){const bx=L[0][0]+(Rt[0][0]-L[0][0])*R(.1,.9);B.ink(`M${f1(bx)} ${f1(y-1)}l${f1(J(1.4))} ${f1(-h*R(.03,.09))}`,1,io*.7);}
  // the bark's horizontal marks: short broken bands, clustered, every length; knots with eyebrow scars
  for(let i=0;i<Math.round(h/13);i++){const t=R(.1,.93),[cx,cy]=C(t),w=wid(t);const parts=RI(1,3);let px=cx-w/2+R(0,w*.3);
   for(let k=0;k<parts&&px<cx+w/2-2;k++){const l=Math.min(R(2,w*.45),cx+w/2-px-1);B.ink(`M${f1(px)} ${f1(cy+J(.6))}h${f1(l)}`,R(1.3,2.6),io*R(.7,.95));px+=l+R(2,5);}}
  for(let i=0;i<RI(3,5);i++){
    const t=R(.16,.8),[cx,cy]=C(t),w=wid(t)*R(.3,.5);
    B.ink(`M${f1(cx-w)} ${f1(cy-1)}q${f1(w)} ${f1(-w*.5)} ${f1(w*2)} 0`,1.3,io*.9);
    B.fill('bark',`M${f1(cx-w*.5)} ${f1(cy+1.4)}q${f1(w*.5)} -2.6 ${f1(w)} 0q${f1(-w*.5)} 2 ${f1(-w)} 0z`,.95);
  }
  for(let i=0;i<4;i++){const t=R(.15,.7),[cx,cy]=C(t),w=wid(t);B.fill('bark',pth([[cx-w*.3,cy],[cx+w*.1,cy-2],[cx+w*.2,cy+5],[cx-w*.25,cy+6]],true,.5),.55);}
  s+=B.out()+ink(td,2.2,io)+ink(pth([[L[1][0]+2.4,L[1][1]],[L[4][0]+2,L[4][1]]],false,.5),1,io*.3);
  // the curtains: small leaves in pairs and threes down every hanging twig, thickest a little below the middle,
  // several greens (a few darker ones deep in the curtain), the odd leaf turned to show its line; catkins here and there
  const total=curtains.reduce((a,c)=>a+c[4],0),per=leaves/Math.max(1,total);
  for(const [a,b,c,dir,len] of curtains){const m=Math.max(4,Math.round(len*per));
   for(let j=0;j<m;j++){const u=.12+.88*Math.pow((j+R(0,1))/m,.85),[lx,ly]=along(a,b,c,Math.min(1,u)),side=j%2?1:-1,ang=Math.PI/2+side*R(.45,1.05)+dir*.12,l=R(5.4,8.2)*(1.1-u*.25);
    const tone=rnd()<.16?'tree3':rnd()<.12?'tree1':rnd()<.45?'leaf':rnd()<.6?'leaf2':'leaf3',d=leafPath(lx+side*.8,ly,l,ang,.46);LB.fill(tone,d);if(rnd()<.18)LB.ink(d,.6,.38);}
   if(rnd()<.14)LB.fill('wood2',leafPath(c[0],c[1]-2,R(6,9),Math.PI/2+J(.15),.22),.9);}
  for(const [cx,cy,r] of caps)
    for(let i=0;i<Math.round(r*3.2);i++){
      const a=R(0,Math.PI*2),d=Math.sqrt(rnd())*r,lx=cx+Math.cos(a)*d*1.1,ly=cy+Math.sin(a)*d*.8,ang=Math.PI/2+J(1.4),dd=leafPath(lx,ly,R(5.4,8),ang,.46);
      LB.fill(pick(['leaf','leaf2','leaf3','tree1']),dd);
      if(rnd()<.2)LB.ink(dd,.6,.38);
    }
  s+=LB.out();
  SH?.cast(x,y,h*.45,10);
  return s;
 }
 // Light through the trees: a few slender shafts with clean edges, flat and faint, each a little different, ending
 // where they reach the ground (morning, from the upper left); and the evening light lying long over the water.
 function shafts(list,o=.16){return list.map(([x0,w0,x1,w1,y1,k])=>fill(pth([[x0,-10],[x0+w0,-10],[x1+w1,y1],[x1,y1+J(4)]],true,1.5),'light',o*k)).join('');}
 // A worn path of bare ground, its edges ragged where the grass grows over them, a few stones pressed into it.
 function footpath(pts,w0,w1){const L=[],Rr=[];pts.forEach(([x,y],i)=>{const t=i/(pts.length-1),w=(w0+(w1-w0)*t)/2*R(.85,1.12);L.push([x-w,y]);Rr.push([x+w,y]);});
  let s=fill(pth([...L,...Rr.reverse()],true,2.5),'path',.9);const B=Batch();
  for(let i=0;i<14;i++){
    const k=R(0,pts.length-1.01),a=Math.floor(k),f=k-a,[x0,y0]=pts[a],[x1,y1]=pts[a+1],x=x0+(x1-x0)*f+J((w0+w1)/5),y=y0+(y1-y0)*f,r=R(1.4,3.4);
    B.fill(pick(['rock','sand2','rock2']),dab(x,y,r,r*.6));
  }
  for(let i=0;i<8;i++){
    const k=R(0,pts.length-1.01),a=Math.floor(k),f=k-a,[x0,y0]=pts[a],[x1,y1]=pts[a+1],x=x0+(x1-x0)*f,y=y0+(y1-y0)*f;
    B.mark('sand2',`M${f1(x-R(4,10))} ${f1(y)}q${f1(R(3,6))} ${f1(J(1))} ${f1(R(8,16))} ${f1(J(1))}`,1.2,.7);
  }
  return s+B.out();}
 // Two mallards asleep on the water, heads turned back and tucked into the back feathers: the drake with his green
 // head, white collar, chestnut breast and curled tail feathers, the hen in mottled brown; each with its blue wing
 // patch, a ring of ripples and its reflection broken under it.
 function mallard(x,y,k=1,dir=1,drake=true){
  const P=pts=>pts.map(([a,b])=>[x+a*k*dir,y+b*k]);
  let s=fill(loop(P([[-17,2.4],[0,3.4],[18,2.4],[10,6],[-10,6.2]]),.3,0),drake?'duckhead':'duck2',.3)+ink(pth(P(ring(1,3,25,3.4,12,.03)).slice(0,9),false,.3),.9,.4);
  const body=P([[-21,-7],[-17,-1],[-6,2],[9,2],[19,-2],[21,-8],[15,-13],[2,-14.6],[-10,-12.6],[-18,-10.4]]);
  s+=piece(body,drake?'seed':'duck',1.6,.88,.4);
  if(drake)s+=fill(loop(P([[13,-12.6],[20.4,-8],[19.4,-2],[13.4,1],[11,-6]]),.3,0),'mane2',.9);
  s+=fill(loop(P([[-14,-8.6],[-2,-11],[10,-9.6],[12,-5],[0,-3.4],[-13,-4.6]]),.3,0),'duck2',.9)+ink(loop(P([[-14,-8.6],[-2,-11],[10,-9.6],[12,-5],[0,-3.4],[-13,-4.6]]),.3,2),.9,.6);
  s+=fill(loop(P([[-6,-6.6],[1,-7.6],[2,-5.2],[-5,-4.4]]),.2,0),'blue',.95)+mark(pth(P([[-6.6,-7.6],[2,-8.4]]),false,.2),'fl4',.9,.9);
  if(drake)s+=ink(smooth(P([[-20,-9],[-23,-12.4],[-20.6,-14.2],[-19,-12]]),.2),1.2,.85);
  else for(const [a,b] of [[-12,-11],[-6,-12.6],[0,-13.2],[6,-12.6],[-9,-8],[-3,-9.4]]){
    const [px,py]=P([[a,b]])[0];
    s+=ink(`M${f1(px)} ${f1(py)}q${f1(1.6*k*dir)} ${f1(1.4*k)} ${f1(3.2*k*dir)} 0`,.7,.45);
  }
  const head=P([[2,-13],[6,-19.4],[13,-21],[18,-17.4],[17,-12.4],[10,-11]]);s+=piece(head,drake?'duckhead':'duck',1.4,.88,.3);
  if(drake)s+=mark(smooth(P([[3.4,-13.4],[9,-11.4],[15.4,-12.6]]),.2),'fl4',1.6,.95);else s+=mark(smooth(P([[8,-17.6],[14,-18]]),.2),'duck2',1.2,.9);
  s+=fill(loop(P([[6,-16],[0,-14.8],[-2.4,-13.6],[3,-13.8]]),.2,0),'beak',.95)+ink(`M${f1(x+12*k*dir)} ${f1(y-17.2*k)}q${f1(1.4*k*dir)} ${f1(-.8*k)} ${f1(2.8*k*dir)} 0`,1,.8);
  return s;
 }
 // A water-lily pad: round with its notch to the middle, its veins, the rim turned up a little on one side; a flower
 // (outer and inner petals round a gold heart) or a closed bud on its stalk.
 function pad(x,y,r=16,{flower=false,bud=false,rot=0}={}){
  const n=12,pts=[];for(let i=0;i<n;i++){const a=rot+i/n*Math.PI*2;pts.push([x+Math.cos(a)*r*R(.95,1.04),y+Math.sin(a)*r*.38*R(.95,1.05)]);}
  pts.splice(0,1,[x+Math.cos(rot+.18)*r*.96,y+Math.sin(rot+.18)*r*.37],[x+r*.04*Math.cos(rot),y],[x+Math.cos(rot-.18)*r*.96,y+Math.sin(rot-.18)*r*.37]);
  pts.push(pts.shift());const d=loop(pts,.3,2);let s=fill(loop(shift(pts,1,1.4),.3,0),'lily')+ink(d,1.2,.6);
  const B=Batch();for(let k=0;k<6;k++){const a=rot+.5+k/6*Math.PI*1.7;B.ink(`M${f1(x)} ${f1(y)}l${f1(Math.cos(a)*r*.72)} ${f1(Math.sin(a)*r*.27)}`,.7,.32);}
  B.mark('leaf3',pth([[x-r*.82,y+r*.12],[x-r*.4,y+r*.32],[x+r*.2,y+r*.36]],false,.3),1.5,.75);s+=B.out();
  if(bud)s+=mark(`M${f1(x+r*.3)} ${f1(y+1)}q2 -6 1 -12`,'lily',1.6,.9)+piece([[x+r*.3+1,y-11],[x+r*.3+3.6,y-16],[x+r*.3+1.4,y-21],[x+r*.3-1.4,y-16]],'fl4',1,.7,.2);
  if(flower){const fx=x+r*.1,fy=y-3;for(let p=0;p<8;p++){const a=-Math.PI*.98+p*Math.PI*.98/7;const dd=leafPath(fx,fy,R(8.6,10),a,.4);s+=wash(dd,'fl4')+ink(dd,.8,.5);}
   for(let p=0;p<5;p++){const a=-Math.PI*.86+p*Math.PI*.72/4;const dd=leafPath(fx,fy,6,a,.42);s+=fill(dd,'fl4')+ink(dd,.7,.45);}
   s+=fill(dab(fx,fy-1,2.4,1.6),'fl1');}
  return s;
 }
 // The rowboat, moored: a hull drawn round from the transom to the rising bow, two strakes along its side, the inside
 // showing over the near gunwale with its two thwarts, an oar shipped along the boat and one trailing in the water,
 // the painter sagging to its post, a rod over the stern with its line to a red float, and its broken reflection.
 function rowboat(x,y,k=1){
  const P=pts=>pts.map(([a,b])=>[x+a*k,y+b*k]),pt=(a,b)=>[x+a*k,y+b*k];
  let s='';const B=Batch();
  for(let i=0;i<5;i++){const yy=y+(24+i*5)*k,x0=x+(14+J(8))*k,x1=x+(150-i*12+J(8))*k;B.fill(i%2?'boat2':'boat',`M${f1(x0)} ${f1(yy)}h${f1(x1-x0)}v${f1(1.6)}h${f1(x0-x1)}z`,.22-i*.03);}
  s+=B.out();
  // the far gunwale and the inside of the hull, then the near side over it
  s+=fill(loop(P([[2,-1],[40,-5.4],[96,-6],[146,-6.4],[173,-10],[150,-1],[96,2.6],[40,2]]),.3,0),'boat2',.95);
  s+=ink(smooth(P([[3,-1.6],[40,-5.8],[96,-6.4],[146,-6.8],[172,-10.4]]),.3),1.3,.7);
  for(const tx of [62,108])s+=piece(P([[tx-5,-5.4],[tx+5,-5.6],[tx+5.6,1.4],[tx-4.4,1.6]]),'wood',1.1,.75,.2);
  // the shipped oar along the boat, its blade at the stern
  s+=mark(smooth(P([[24,-4],[90,-7.4],[150,-9.4]]),.2),'wood3',2.6,.95)+piece(P([[8,-1.4],[24,-4.6],[26,-1.6],[10,1]]),'wood',1,.8,.2);
  const hull=P([[0,-2],[38,2.6],[92,4],[140,1.4],[173,-9.4],[170,-3],[158,9],[132,18.6],[84,21.4],[34,19],[8,12.6],[1,6]]);
  s+=piece(hull,'boat',2,.88,.4);
  s+=ink(smooth(P([[4,5],[40,9.6],[92,11],[138,8.2],[164,-.4]]),.4),1,.5)+ink(smooth(P([[8,11.4],[42,15.2],[92,16.4],[132,14.2],[156,6.4]]),.4),1,.42);
  s+=fill(loop(P([[2,2],[36,6.4],[90,7.6],[138,5],[166,-5.4],[168,-3],[140,8.6],[90,10.6],[36,9.4],[3,5.4]]),.3,0),'boat2',.5);
  for(const ox of [72,118]){const [a,b]=pt(ox,3);s+=ink(`M${f1(a)} ${f1(b)}v${f1(-4*k)}M${f1(a-2*k)} ${f1(b-4*k)}h${f1(4*k)}`,1.2,.8);}
  // the trailing oar: shaft from its rowlock down into the water, the blade under the surface
  s+=mark(smooth(P([[72,-1],[46,18],[22,38]]),.2),'wood3',2.4,.95)+ink(smooth(P([[72,-1],[46,18],[22,38]]),.2),.6,.5);
  s+=fill(loop(P([[22,37],[12,43],[6,46.6],[10,48],[20,44],[25,39.4]]),.2,0),'wood',.55)+ink(loop(P([[22,37],[12,43],[6,46.6],[10,48],[20,44],[25,39.4]]),.2,2),1,.4);
  // water lapping along the hull and round the oar
  s+=fill(loop(P([[-6,19],[60,23],[150,16],[172,14],[150,26],[60,29],[-4,25]]),.4,0),'water',.85);
  for(let i=0;i<4;i++){const [a,b]=pt(R(10,160),R(18,24));s+=mark(`M${f1(a)} ${f1(b)}q${f1(6*k)} -1.6 ${f1(12*k)} 0`,'water3',1.4,.8);}
  s+=ink(pth(ring(x+16*k,y+41*k,12*k,2.4*k,12,.04).slice(0,8),false,.2),.9,.45);
  // the painter to the post, the post
  s+=rope(x+171*k,y-6*k,x+232*k,y+12,7)+post(x+234*k,y+30,36,6,.8);
  s+=fill(loop([[x+226*k,y+30],[x+234*k,y+28],[x+243*k,y+30],[x+234*k,y+32.4]],.3,0),'water',.8)+ink(pth(ring(x+234*k,y+30.4,10,2,10,.04).slice(0,7),false,.2),.9,.5);
  // the rod resting over the stern, its line, the float and its little ring
  s+=alt(5203,()=>{
    const tip=[x-34,y-30],b=[x+148*k,y-1];
    let r=ink(smooth([b,[x+58*k,y-12],tip],.3),1.8,.85)+mark(pth([b,[x+118*k,y-4]],false,.2),'wood3',3.4,.95)+ink(`M${f1(x+104*k)} ${f1(y-4.4)}a3 2.4 0 1 0 .1 0`,1.1,.7);
   const fy=y+30;r+=ink(`M${f1(tip[0])} ${f1(tip[1])}q-3 ${f1((fy-tip[1])*.5)} -1 ${f1(fy-tip[1]-3)}`,.7,.5)+fill(dab(tip[0]-1,fy-2.4,2.6,2.2),'blanket')+fill(`M${f1(tip[0]-3.6)} ${f1(fy-1.6)}h5.2q-2.6 3 -5.2 0z`,'fl4')+ink(dab(tip[0]-1,fy-2,2.8,2.6),.8,.7);
   r+=ink(pth(ring(tip[0]-1,fy+.4,9,1.8,10,.04).slice(0,7),false,.2),.9,.45);return r;});
  return s;
 }
 // The cabin on the far shore, small but whole: walls of logs with their round ends at the corners, a shingled
 // roof, a stone chimney, a door with its step, a four-pane window (lit at night), a woodpile under a lean-to and a
 // canoe turned over on the shore beside it.
 function logCabin(x,y,night){
  let s=fill(loop([[x-10,y+2],[x+30,y],[x+86,y+2],[x+80,y+6],[x-6,y+6]],.4,0),'shade',.5);
  s+=piece([[x,y],[x-.4,y-27],[x+44,y-27.4],[x+44.4,y]],'wood',1.5,.6,.3);
  const B=Batch();
  for(let k=1;k<6;k++){const ly=y-k*4.6;B.ink(`M${f1(x)} ${f1(ly)}q22 ${f1(J(.6))} 44 ${f1(J(.4))}`,.8,.4);B.fill('wood3',dab(x-1.4,ly+2.2,1.8,1.6),.8);B.fill('wood3',dab(x+45.6,ly+2.2,1.8,1.6),.8);}
  s+=B.out();
  s+=piece([[x-7,y-25],[x+22,y-47],[x+51,y-25],[x+22,y-26.4]],'roof',1.5,.62,.3);
  const S=Batch();for(let r=0;r<4;r++){const t=(r+1)/5,yy=y-47+(22*t),half=29*t;for(let c=-half+3;c<half-2;c+=5)S.ink(`M${f1(x+22+c)} ${f1(yy)}q2 1.6 4 0`,.7,.32);}
  s+=S.out()+piece([[x+31,y-37],[x+31,y-54],[x+38.6,y-54.4],[x+38.4,y-34.6]],'rock2',1.3,.6,.2)+ink(`M${x+31} ${y-49}h7.4M${x+31} ${y-44}h7.4M${x+34.6} ${y-54}v5M${x+33} ${y-49}v5`,.7,.4);
  s+=fill(`M${x+8} ${y-19}h11v10h-11z`,night?'glowcore':'glass')+ink(`M${x+8} ${y-19}h11v10h-11zM${x+13.5} ${y-19}v10M${x+8} ${y-14}h11`,1,.6)+ink(`M${x+7} ${y-8}h13`,1.4,.55);
  s+=piece([[x+26,y],[x+26,y-17],[x+34,y-17.4],[x+34,y]],'wood3',1,.6,.2)+ink(`M${x+24} ${y+1.4}h12`,1.2,.5)+fill(dab(x+32.4,y-8,.9),'iron');
  // the lean-to woodpile and the canoe on the shore
  s+=piece([[x+46,y],[x+46,y-15],[x+64,y-11],[x+64,y]],'wood2',1,.55,.2);
  const W2=Batch();for(let r=0;r<3;r++)for(let c=0;c<4;c++)W2.fill(pick(['wood','wood3']),dab(x+49+c*4.2+(r%2)*2,y-2.4-r*4,1.9,1.7));s+=W2.out();
  s+=piece([[x+68,y+1],[x+76,y-4],[x+96,y-4.6],[x+104,y+.4],[x+86,y+2.6]],'cap',1.2,.6,.2);
  return s;
 }
 // ---------------------------------------------------------------- the improved hand (Stream)
 // A leafy bush: a few overlapping crowns, each drawn round and inked, covered with drawn leaves, a darker one deep
 // in it, a few small flowers. tok is the main green.
 function bush(x,y,r,{tok='tree2',flowers='fl3',n=4}={}){
  let s='';const crowns=[];for(let i=0;i<n;i++){const a=-Math.PI*(.15+.7*i/(n-1||1)),cx=x+Math.cos(a)*r*.62,cy=y-r*.5+Math.sin(a)*r*.42;crowns.push([cx,cy,r*R(.5,.66)]);}
  crowns.sort((p,q)=>p[1]-q[1]);
  for(const [cx,cy,cr] of crowns){
    const pts=[];
    for(let i=0;i<11;i++){const a=i/11*Math.PI*2;pts.push([cx+Math.cos(a)*cr*R(.84,1.06),cy+Math.sin(a)*cr*.8*R(.84,1.06)]);}
    s+=piece(pts,pick([tok,'tree3','tree1']),1.5,.72,.6);
  }
  const B=Batch();
  for(let i=0;i<Math.round(r*1.6);i++){
    const [cx,cy,cr]=pick(crowns),a=R(0,Math.PI*2),d=Math.sqrt(rnd())*cr*.9,lx=cx+Math.cos(a)*d,ly=cy+Math.sin(a)*d*.8,ang=R(0,Math.PI*2),dd=leafPath(lx,ly,R(6,10),ang,.44);
    B.fill(pick(['leaf','leaf2','leaf3','tree3']),dd);
    if(i%3===0)B.ink(dd,.7,.4);
  }
  if(flowers)for(let i=0;i<Math.round(r/9);i++){const [cx,cy,cr]=pick(crowns);B.fill(flowers,dab(cx+R(-cr,cr)*.7,cy+R(-cr,cr)*.5,R(1.8,2.8)));}
  return s+B.out();
 }
 // A branch reaching in from the edge: bark-coloured, tapering, inked on both sides, with side twigs and sprays of
 // leaves along them. pts run from the thick end to the tip.
 function limbFrom(pts,w0,w1,{leaves=40,io=.85}={}){
  const [A,Bs]=[[],[]];
  pts.forEach((p,i)=>{
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,w=(w0+(w1-w0)*i/(pts.length-1))/2;
    A.push([p[0]-dy/l*w,p[1]+dx/l*w]);
    Bs.push([p[0]+dy/l*w,p[1]-dx/l*w]);
  });
  const d=loop([...A,...Bs.reverse()],.3,2);let s=wash(d,'bark')+ink(d,1.6,io);const B=Batch(),LB=Batch(),tips=[];
  for(let i=1;i<pts.length-1;i++){
    const [x,y]=pts[i],dir=i%2?-1:1,l=R(14,26),e=[x+R(-10,6),y+dir*l*R(.5,.9)-l*.3];
    B.mark('wood3',`M${f1(x)} ${f1(y)}Q${f1((x+e[0])/2+J(3))} ${f1((y+e[1])/2)} ${f1(e[0])} ${f1(e[1])}`,1.1,1);
    tips.push(e);
  }
  tips.push(pts[pts.length-1]);
  for(let i=0;i<leaves;i++){
    const [tx,ty]=pick(tips),lx=tx+J(10),ly=ty+J(7),ang=R(0,Math.PI*2),dd=leafPath(lx,ly,R(7,11),ang,.42);
    LB.fill(pick(['leaf','leaf2','leaf3','tree3']),dd);
    if(i%3===0)LB.ink(dd,.75,.42);
  }
  for(let k=0;k<3;k++)B.ink(`M${f1(pts[k][0]-4)} ${f1(pts[k][1]+J(1))}q4 1 8 0`,.8,.45);
  return s+B.out()+LB.out();
 }
 // The footbridge: a short span of planks arched a little over the stream, its stringer under the planks, stone
 // footings on both banks, a trestle of two legs standing in the water with their braces and rings, and a handrail on
 // posts at the ends and the middle. Nothing stands on the grass but the footings.
 function footbridge(x,y,w,SH){
  let s='';const B=Batch();
  const arc=u=>[x+w*u,y-Math.sin(u*Math.PI)*12-u*6];
  // the shade of the bridge on the water
  s+=fill(loop([[x+w*.24,y+12],[x+w*.5,y+4],[x+w*.76,y+10],[x+w*.74,y+22],[x+w*.5,y+20],[x+w*.26,y+24]],.4,0),'water2',.75);
  // the trestle in the water: two pairs of legs, braced, rings where they go in
  for(const u of [.36,.62]){const [px,py]=arc(u);for(const dx of [-5,5]){s+=post(px+dx,py+42,36,6,.85);}
   B.ink(`M${f1(px-5)} ${f1(py+12)}L${f1(px+5)} ${f1(py+34)}M${f1(px+5)} ${f1(py+12)}L${f1(px-5)} ${f1(py+34)}`,1.2,.6);
   s+=ink(pth(ring(px,py+42,13,2.6,12,.04).slice(0,8),false,.2),1,.5)+mark(`M${f1(px-12)} ${f1(py+41)}q6 -1.6 12 0`,'water3',1.4,.85);}
  // the stone footings on each bank
  for(const [u,dir] of [[.02,-1],[.98,1]]){const [fx,fy]=arc(u);s+=boulder(fx-22+dir*6,fy+16,40,16,{tok:'rock2',io:.8})+boulder(fx-8+dir*16,fy+18,26,12,{io:.8});}
  // planks across the deck, the stringer under them
  const n=22;
  for(let i=0;i<n;i++){
    const [ax,ay]=arc(i/n),[bx,by]=arc((i+1)/n),q=[[ax,ay],[bx-.6,by],[bx-2.6,by+9],[ax-2,ay+9]];
    B.fill(i%4?'wood':'wood2',pth(q,true,.3));
    B.ink(`M${f1(bx-.6)} ${f1(by)}l-2 9`,.8,.55);
   if(i%3===1)B.ink(`M${f1(ax+(bx-ax)*.3)} ${f1(ay+2.6)}l${f1(-.6)} 4`,.6,.35);}
  s+=B.out();const top=Array.from({length:9},(_,i)=>arc(i/8)),under=top.map(([px,py])=>[px-2.4,py+9]),low=top.map(([px,py])=>[px-2.6,py+16]);
  s+=ink(smooth(top,.4),2,.9)+fill(loop([...under,...low.reverse()],.3,0),'wood3',.95)+ink(smooth(under,.4),1.6,.85)+ink(smooth(top.map(([px,py])=>[px-2.6,py+16]),.4),1.6,.85);
  // the handrail: posts at the ends and the middle, a top rail that follows the arch, a lower rail
  const rails=[];for(const u of [.03,.5,.97]){const [px,py]=arc(u);s+=post(px,py+2,38,6,.85);rails.push([px,py-34]);}
  const rail=smooth([rails[0],[x+w*.25,arc(.25)[1]-34],rails[1],[x+w*.75,arc(.75)[1]-34],rails[2]],.4);
  s+=ink(rail,4,.9)+mark(rail,'wood',2,1)+ink(smooth([arc(.03),arc(.25),arc(.5),arc(.75),arc(.97)].map(([px,py])=>[px,py-17]),.4),1.6,.75);
  SH?.cast(x+w*.5,y+30,w*.3,8);
  return s;
 }
 // A mossy stump by the path with the work of a morning's fishing: a wicker creel with its lid and strap, a rod
 // leaning on the stump, its line looped back to the reel.
 function creelStump(x,y){
  let s=fill(loop([[x-6,y+1],[x+30,y-2],[x+92,y+1],[x+70,y+6],[x+4,y+6]],.4,0),'shade',.55);
  // the stump: its bark sides, the sawn top in rings, roots
  const side=[[x,y],[x+2,y-30],[x+40,y-32],[x+44,y-2],[x+48,y+3],[x+22,y+3],[x-4,y+3]];s+=piece(side,'bark',1.9,.9,.4);
  const tp=ring(x+21,y-31,20,5,12,.04);s+=piece(tp,'wood',1.6,.9,.2);for(const k of [.62,.3])s+=ink(loop(ring(x+21,y-31,20*k,5*k,10,.05),.2,1),.8,.5);
  const B=Batch();for(let i=0;i<6;i++){const bx=x+5+i*6.4;B.ink(`M${f1(bx)} ${f1(y-26)}l${f1(J(1))} ${f1(R(14,22))}`,.9,.5);}
  B.fill('moss',loop([[x+1,y-12],[x+8,y-22],[x+14,y-12],[x+8,y-2]],.3,0),.95);for(let k=0;k<5;k++)B.mark('grass',`M${f1(x+R(2,13))} ${f1(y-R(4,20))}l${f1(J(2))} -3`,1.2,.75);
  s+=B.out();
  // the creel: woven body, lid, strap
  const cx=x+52;const body=[[cx,y],[cx-2,y-22],[cx+30,y-24],[cx+31,y]];s+=piece(body,'wood2',1.7,.9,.3);
  const W=Batch();for(let r=1;r<5;r++)W.ink(`M${f1(cx-1)} ${f1(y-r*5)}q16 ${f1(J(.6))} 31 0`,.8,.5);for(let c=1;c<6;c++)W.ink(`M${f1(cx+c*5.2)} ${f1(y)}l${f1(J(.8))} -23`,.6,.35);s+=W.out();
  s+=piece([[cx-4,y-22],[cx+14,y-29],[cx+34,y-24],[cx+15,y-19]],'wood',1.5,.9,.2)+fill(dab(cx+14,y-24,1.4),'iron');
  s+=ink(smooth([[cx+1,y-18],[cx+14,y-44],[cx+30,y-20]],.3),2.4,.85)+mark(smooth([[cx+1,y-18],[cx+14,y-44],[cx+30,y-20]],.3),'blanket',1.2,.9);
  // the rod leaning on the stump, the reel, the line
  s+=ink(smooth([[x+30,y+2],[x+70,y-60],[x+118,y-128]],.3),1.8,.9)+mark(pth([[x+30,y+2],[x+40,y-14]],false,.2),'wood3',3.4,1)+piece(ring(x+42,y-10,4,4,8,.05),'iron',1.1,.9,.2);
  s+=ink(`M${f1(x+42)} ${f1(y-10)}Q${f1(x+90)} ${f1(y-70)} ${f1(x+118)} ${f1(y-128)}`,.6,.4);
  return s;
 }
 // The kingfisher, drawn whole: a big head and long dagger bill, a compact body, short tail; blue-green above with
 // the bright blue stripe down its back, rusty orange below and on the cheek, white at the throat and the side of the
 // neck, pale spots on the folded wing, small red feet. 70 x 50, perched at feet (34,40), facing right.
 const kingfisherArt=once(()=>alt(4421,()=>{
  const bird=(rot=0)=>{let s=`<g transform="rotate(${rot} 34 30)">`;
   const out=[[36,8.4],[43,8.2],[48,12],[49.6,15],[49.6,19.4],[45,22.4],[40,26],[37,32],[32,38.6],[26,41.4],[18.6,46],[12.4,47.4],[14.6,42.6],[21,36],[25.6,28],[30.6,17.6],[33,11]];
   s+=piece(out,'kingfisher',1.6,.92,.3);
   s+=fill(loop([[40.4,25.6],[37.4,32.6],[31.6,38.8],[26.4,41],[29,33.4],[34,27.6]],.2,0),'breast',.95)+fill(loop([[39,15],[45,15.6],[45.4,19],[40,19.4]],.2,0),'breast',.95);
   s+=fill(loop([[44.6,21],[48.6,19.6],[45,23.4],[41.6,25]],.2,0),'fl4',.95)+fill(loop([[34.4,19.4],[37.6,18],[37,22.4],[34,22.6]],.2,0),'fl4',.9);
   s+=mark(smooth([[31,17],[26,28],[21,36],[16,42]],.2),'kfback',2.4,.95);
   const wing=[[33,20],[36,26],[33,33],[25,40],[20,40],[24,32],[28,24]];s+=fill(loop(wing,.2,0),'kingfisher',.9)+ink(loop(wing,.2,2),1,.7);
   for(const [x,y] of [[31,25],[29,29],[27,33],[32,29],[30,33]])s+=fill(dab(x,y,.9),'kfback',.95);
   s+=fill(loop([[49,14.8],[64,18.4],[66.4,19.4],[64,20.2],[49,19.8]],.15,0),'iron')+ink(loop([[49,14.8],[64,18.4],[66.4,19.4],[64,20.2],[49,19.8]],.15,1),1.1,.9)+ink('M50 17.6L61 19',.6,.6);
   s+=fill(dab(43,13.6,1.5,1.4),'eye')+fill(dab(43.5,13,.5),'eyeshine');
   return s+'</g>';};
  const perch=bird()+mark('M30 40.6l-1.4 3M34 40.6l.6 3',  'blanket',1.6,1);
  const dive=`<g transform="translate(70 0) scale(-1 1)">${bird(70)}${ink('M30 40l-8 5M26 38l-9 2',1,.6)}</g>`;
  return `<g class="fr-pose p-perch">${perch}</g><g class="fr-pose p-dive">${dive}</g>`;
 }));
 // The rock face the stream falls from: a cliff of layered stone drawn round, its bedding lines, shaded clefts,
 // moss and hanging plants in its ledges.
 function cliff(pts,{io=.75}={}){
  let s=piece(pts,'rock2',1.8,io,.6);const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const B=Batch();for(let k=1;k<6;k++){const yy=y0+(y1-y0)*k/6+J(2);B.ink(smooth([[x0+8,yy],[x0+(x1-x0)*.3,yy-R(1,3)],[x0+(x1-x0)*.7,yy+R(-1,2)],[x1-8,yy-1]],.6),1,io*.42);}
  for(let k=0;k<5;k++){const xx=x0+(x1-x0)*R(.1,.9),yy=y0+(y1-y0)*R(.1,.8);B.fill('shadow',loop([[xx,yy],[xx+R(3,7),yy+R(4,8)],[xx+R(-2,2),yy+R(10,16)],[xx-R(2,5),yy+R(4,8)]],.3,0),.16);}
  for(let k=0;k<7;k++){
    const xx=x0+(x1-x0)*R(.05,.95),yy=y0+(y1-y0)*R(.05,.85);
    B.fill('moss',loop(ring(xx,yy,R(4,8),R(1.8,3),7,.1),.3,0),.9);
    B.mark('fern',`M${f1(xx)} ${f1(yy)}q${f1(J(3))} ${f1(R(4,9))} ${f1(J(4))} ${f1(R(8,14))}`,1.1,.8);
  }
  return s+B.out();
 }
 // ---------------------------------------------------------------- the improved hand (Rain)
 // A bank of rain cloud: a billowed top of arcs of every size (drawn as arcs, like the drifting clouds), a flatter
 // belly, the underside in a heavier grey, a fine line along the top only, and (when asked) a veil of rain hanging
 // under it in the distance.
 function billows(x,y,w,h){
   let d=`M${f1(x)} ${f1(y)}`,px=x;
   const top=[];
   while(px<x+w-4){const r=Math.min(x+w-px,R(h*.6,h*1.5));const ex=px+r;d+=`A${f1(r*.55)} ${f1(r*R(.34,.5))} 0 0 1 ${f1(ex)} ${f1(y+J(1.5))}`;top.push(ex);px=ex;}
   return d;
 }
 function cloudBank(B,x,y,w,h,o=.7,veil=false){
  const top=billows(x,y,w,h);
  B.fill('raincloud',top+`Q${f1(x+w+6)} ${f1(y+h*.36)} ${f1(x+w*.62)} ${f1(y+h*.44)}T${f1(x-4)} ${f1(y+h*.2)}Z`,o);
  B.fill('raincloud2',`M${f1(x+w*.1)} ${f1(y+h*.12)}Q${f1(x+w*.5)} ${f1(y+h*.26)} ${f1(x+w*.9)} ${f1(y+h*.1)}Q${f1(x+w*.8)} ${f1(y+h*.42)} ${f1(x+w*.5)} ${f1(y+h*.44)}T${f1(x+w*.1)} ${f1(y+h*.12)}Z`,o*.85);
  B.ink(top,1.1,.24);
  if(veil)for(let i=0,n=Math.round(w/18);i<n;i++){const vx=x+w*R(.1,.9),vy=y+h*.4,l=R(30,90);B.mark('rain',`M${f1(vx)} ${f1(vy)}l${f1(-l*.16)} ${f1(l)}`,1,.16);}
 }
 // Low cloud lying in the woods: long drawn wisps, each a billowed top over a level foot, finely inked on top, so the
 // trees behind them go soft by layers rather than under a slab of colour.
 function wisps(list){
   const B=Batch();
   for(const [x,y,w,h,o] of list){const top=billows(x,y,w,h*.8);B.fill('mist',top+`Q${f1(x+w+18)} ${f1(y+h*.5)} ${f1(x+w*.5)} ${f1(y+h*.6)}T${f1(x-18)} ${f1(y+h*.3)}Z`,o);B.ink(top,.9,.2);}
   return B.out();
 }
 // A dry-stone wall: two courses of stones of every size, laid without mortar, a row of cap stones on edge, moss on
 // some, an opening where the path goes through between two stone pillars with flat caps.
 function stoneWall(y,gap=null){return whole(()=>stoneWall1(y,gap));}
 function stoneWall1(y,gap=null){
  const B=Batch(),I=Batch();let s='';
  const stone=(x,yy,w,h,tok)=>{const pts=[[x,yy],[x+w*.1,yy-h*.92],[x+w*.5,yy-h-J(1)],[x+w*.92,yy-h*.86],[x+w,yy-h*.1],[x+w*.5,yy+1]],d=pth(pts,true,.5);B.fill(tok,d);I.ink(d,1.2,.62);};
  for(const [yy,hh] of [[y+18,10],[y+8,9.6]]){
    let x=-14+R(0,10);
    while(x<W+10){const w=R(18,40);if(!(gap&&x+w>gap[0]-12&&x<gap[1]+12))stone(x,yy,w,hh*R(.85,1.1),pick(['rock','rock2','rock']));x+=w+R(.5,2);}
  }
  {let x=-10;while(x<W+10){const w=R(9,16);if(!(gap&&x+w>gap[0]-12&&x<gap[1]+12))stone(x,y-1,w,R(7,10),pick(['rock2','rock']));x+=w+R(.5,1.6);}}
  for(let i=0;i<22;i++){const x=R(0,W);if(gap&&x>gap[0]-20&&x<gap[1]+20)continue;B.fill('moss',loop(ring(x,y-R(0,10),R(4,9),R(1.6,2.6),7,.1),.3,0),.9);}
  s+=B.out()+I.out();
  if(gap)for(const gx of [gap[0]-16,gap[1]+16]){for(let k=0;k<4;k++){const h=R(9,11),yy=y+18-k*h;s+=piece([[gx-12,yy],[gx-12.6,yy-h],[gx+12.4,yy-h-1],[gx+12,yy]],pick(['rock','rock2']),1.3,.7,.4);}
   s+=piece([[gx-15,y-24],[gx-14,y-31],[gx+15,y-32],[gx+16,y-24]],'rock2',1.4,.75,.3);}
  return s;
 }
 // A puddle on the gravel: an uneven pool drawn round, the grey sky lying in it as a paler streak, its near edge
 // darker where it is deeper, a line round only part of it.
 function puddle(x,y,r){const pts=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;pts.push([x+Math.cos(a)*r*R(.82,1.08),y+Math.sin(a)*r*.3*R(.8,1.12)]);}
  let s=fill(loop(pts,.4,0),'water',1)+
    fill(loop([[x-r*.6,y-r*.06],[x-r*.1,y-r*.14],[x+r*.5,y-r*.08],[x+r*.1,y+r*.02],[x-r*.5,y+r*.04]],.3,0),'sky3',.9)+
    fill(loop([[x-r*.7,y+r*.12],[x,y+r*.24],[x+r*.75,y+r*.12],[x+r*.4,y+r*.26],[x-r*.4,y+r*.27]],.3,0),'water2',.8);
  return s+ink(smooth(pts.slice(5,12),.3),1.2,.45);}
 // The blue umbrella left open on the grass to dry, lying on its back: its inside to the sky, the panels between the
 // ribs in two blues, the scalloped rim, the ribs running to the middle where the shaft comes up and away to the
 // hooked handle resting in the grass.
 function umbrellaDown(x,y){
  const cx=x+62,cy=y-26,tilt=-.16,P=(a,r=1)=>{
    const ex=Math.cos(a)*58*r,ey=Math.sin(a)*30*r;
    return [cx+ex*Math.cos(tilt)-ey*Math.sin(tilt),cy+ex*Math.sin(tilt)+ey*Math.cos(tilt)];
  };
  let s=fill(loop([[x-4,y-2],[x+60,y-8],[x+132,y-4],[x+108,y+6],[x+14,y+6]],.4,0),'shade',.55);
  const n=8,tips=Array.from({length:n},(_,i)=>P(i/n*Math.PI*2+.2)),rim=[];
  for(let i=0;i<n;i++){rim.push(tips[i]);rim.push(P((i+.5)/n*Math.PI*2+.2,1.1));}
  s+=piece(rim,'blue',2,.88,.25);
  for(let i=0;i<n;i+=2){const a=tips[i],b=tips[(i+1)%n],m=P((i+.5)/n*Math.PI*2+.2,1.1);s+=fill(loop([[cx,cy],a,m,b],.15,0),'blue2',.75);}
  for(const [tx,ty] of tips)s+=ink(`M${f1(cx)} ${f1(cy)}L${f1(tx)} ${f1(ty)}`,1,.6)+fill(dab(tx,ty,1.4),'iron',.9);
  s+=fill(dab(cx,cy,3.4,2.4),'iron')+
    ink(smooth([[cx,cy],[cx+26,cy+12],[cx+50,cy+22]],.2),2.4,.88)+
    mark(`M${f1(cx+50)} ${f1(cy+22)}q12 4 10 -7`,'wood',3.2,1)+
    ink(`M${f1(cx+50)} ${f1(cy+22)}q12 4 10 -7`,.8,.7);
  for(let k=0;k<5;k++){const [tx,ty]=tips[(k*3)%n];s+=fill(`M${f1(tx)} ${f1(ty+2)}q-1.4 2.6 0 3.4q1.4 -.8 0 -3.4z`,'rain',.9);}
  return s;
 }
 // Hydrangeas: lumpy heads made of four-petal florets in two tones with a pale heart, set among broad toothed
 // leaves with their veins; rain on the heads.
 function hydrangea(x,y,r,tok){
  let s='';
  for(let i=0;i<5;i++){
    const a=Math.PI*(.88+i*.31),bx=x+Math.cos(a)*r*.3,by=y+r*.3,d=leafPath(bx,by,r*R(.8,1),a,.46);
    s+=wash(d,i%2?'leaf2':'fern')+ink(d,1.2,.62);
    const ex=bx+Math.cos(a)*r*.8,ey=by+Math.sin(a)*r*.8;
    s+=ink(`M${f1(bx)} ${f1(by)}L${f1(ex)} ${f1(ey)}`,.8,.45);
   for(const k of [.35,.6])s+=ink(`M${f1(bx+(ex-bx)*k)} ${f1(by+(ey-by)*k)}l${f1(Math.cos(a+.7)*r*.16)} ${f1(Math.sin(a+.7)*r*.16)}`,.6,.4);}
  const pts=[];for(let i=0;i<16;i++){const a=i/16*Math.PI*2,k=i%2?R(.84,.92):R(1,1.08);pts.push([x+Math.cos(a)*r*k,y-r*.3+Math.sin(a)*r*.78*k]);}
  s+=piece(pts,tok,1.4,.55,.5);
  const B=Batch();for(let i=0;i<26;i++){const a=rnd()*Math.PI*2,rr=Math.sqrt(rnd())*r*.82,fx=x+Math.cos(a)*rr,fy=y-r*.3+Math.sin(a)*rr*.76,p=R(3.4,4.6),t=rnd()<.55?tok:'hyd3',b0=R(0,1.5);
   for(let k=0;k<4;k++)B.fill(t,leafPath(fx,fy,p,b0+k*Math.PI/2,.62));if(i%3===0)B.ink(`M${f1(fx-p)} ${f1(fy)}q${f1(p)} ${f1(-p*.6)} ${f1(p*2)} 0`,.6,.35);B.fill('fl4',dab(fx,fy,.8));}
  for(let i=0;i<8;i++){const a=rnd()*Math.PI*2,rr=R(.3,.9)*r;B.fill('water3',`M${f1(x+Math.cos(a)*rr)} ${f1(y-r*.3+Math.sin(a)*rr*.7)}q-1.4 2.6 0 3.4q1.4 -.8 0 -3.4z`,.9);}
  return s+B.out();
 }
 // A galvanised watering can drawn round: its body, the band and the seam, the long spout with the rose on its end,
 // the arched handle; water dripping from the rose.
 function wateringCan(x,y){
  let s=fill(loop([[x-6,y+1],[x+22,y-1],[x+52,y+1],[x+40,y+5],[x,y+5]],.3,0),'shade',.5);
  const sp=strand([[x+37,y-21],[x+51,y-33],[x+65,y-45]],[7,5,4]);s+=wash(sp,'can')+ink(sp,1.4,.9);
  s+=piece([[x+62,y-48],[x+72,y-53],[x+75,y-46],[x+68,y-40]],'can2',1.3,.9,.2);
  s+=piece([[x,y],[x-1,y-26],[x+4,y-30],[x+38,y-30],[x+42,y-26],[x+42,y]],'can',1.8,.9,.3)+
    fill(loop([[x+28,y-28],[x+39,y-28],[x+40,y-3],[x+30,y-3]],.2,0),'can2',.75)+
    fill(loop([[x+5,y-27],[x+12,y-27],[x+10,y-6],[x+5,y-8]],.2,0),'steam',.35);
  s+=ink(`M${x+1} ${y-14}q20 1.4 41 0`,.9,.5)+ink(`M${x} ${y-4}q21 1 42 0`,.9,.45)+ink(smooth([[x+6,y-30],[x+12,y-50],[x+28,y-50],[x+36,y-30]],.2),2.6,.88);
  for(let k=0;k<3;k++)s+=fill(`M${f1(x+73+k*2)} ${f1(y-38+k*6)}q-1.4 3 0 4q1.4 -1 0 -4z`,'rain',.9);
  return s;
 }
 // A garden snail on the wall: its body with the two tentacles and eyes, the shell drawn round with its spiral.
 function snail(x,y){
  let s=piece([[x,y],[x+6,y-3.6],[x+20,y-3],[x+25,y-6],[x+27,y-2],[x+22,y+1],[x+6,y+1.6]],'snail',1.3,.85,.2);
  s+=ink(`M${x+22} ${y-4.4}l2 -7M${x+24} ${y-4.4}l5 -5.4`,1,.8)+fill(dab(x+24,y-11.6,1),'eye')+fill(dab(x+29,y-10,1),'eye');
  s+=piece(ring(x+11,y-8,7.6,7,10,.04),'shell',1.4,.9,.2)+ink(`M${x+11} ${y-8}m-1 1a2.6 2.4 0 1 0 2 -3.6a4.6 4.4 0 1 0 3.6 6.4`,1,.75);
  return s;
 }
 // The frog: on the stone it sits upright with its eyes high on its head, golden irises with a dark slot, a smile,
 // the folded hind legs at its sides and its toes spread; it leaps with its hind legs thrown out behind; afterwards
 // only its eyes and the top of its head show above the water. 60 x 40, the stone top at y=34.
 const frogArt=once(()=>alt(4807,()=>{
  const eye=(x,y,r=4.6)=>piece(ring(x,y,r,r*.92,9,.04),'frog',1.3,.9,.2)+fill(dab(x,y-.2,r*.58,r*.5),'fl1')+fill(`M${f1(x-r*.42)} ${f1(y-.2)}q${f1(r*.42)} ${f1(-r*.3)} ${f1(r*.84)} 0q${f1(-r*.42)} ${f1(r*.3)} ${f1(-r*.84)} 0z`,'eye');
  let sit=fill(loop([[6,35],[30,33],[54,35],[40,38],[16,38]],.3,0),'shade',.5);
  sit+=piece([[5,32],[4,27],[9,24],[15,26],[14,33]],'frog2',1.3,.9,.3)+piece([[55,32],[56,27],[51,24],[45,26],[46,33]],'frog2',1.3,.9,.3);
  sit+=piece([[11,34],[9,27],[13,19],[21,14],[30,13],[39,14],[47,19],[51,27],[49,34],[40,36],[20,36]],'frog',1.6,.9,.3);
  sit+=fill(loop([[20,30],[30,27],[40,30],[37,35],[23,35]],.2,0),'leaf3',.85);for(const [px,py,r] of [[18,22,2],[42,22,1.8],[30,19,1.6],[24,28,1.4],[36,28,1.4]])sit+=fill(dab(px,py,r),'frog2',.9);
  sit+=eye(23,13)+eye(37,13)+ink(`M21 25q9 4.6 18 0`,1.2,.75)+ink(`M28 21.6l.6 .6M32 21.6l-.6 .6`,.9,.6);
  sit+=ink(`M16 34l-3 2.4M16 34l-.6 3M16 34l2 2.6M44 34l3 2.4M44 34l.6 3M44 34l-2 2.6`,1,.85);
  const leap=`<g transform="rotate(-24 30 24)">`+piece([[2,24],[4,30],[14,32],[24,30]],'frog2',1.3,.9,.2)+piece([[0,30],[2,36],[12,36],[22,31]],'frog2',1.3,.9,.2)
   +piece([[18,28],[16,22],[24,17],[38,15],[50,18],[54,23],[46,28],[30,30]],'frog',1.6,.9,.3)+eye(44,15,4.2)+ink('M48 24q3 1.4 6 0',1,.7)
   +ink('M46 27l8 6l3 -1M44 27l6 8l3 0',1.4,.88)+ink('M0 30l-6 1l-2 -2M0 30l-5 4M2 36l-6 2l-1 3M2 36l-4 5',1,.8)+`</g>`;
  const eyes=fill(loop([[18,31],[30,28],[42,31],[30,33.4]],.2,0),'frog',.95)+eye(24,29.6,4)+eye(36,29.6,4)+ink(pth(ring(30,32,16,2.4,12,.04).slice(0,8),false,.2),.9,.5);
  return `<g class="fr-pose p-sit">${sit}</g><g class="fr-pose p-leap">${leap}</g><g class="fr-pose p-eyes">${eyes}</g>`;
 }));
 // ---------------------------------------------------------------- the improved hand (Fire)
 // Light lying on the ground: uneven washes of different shapes, each set a little off the last and broken at its edge
 // into a few lit patches, so it reads as light thrown by a flame and never as a stack of rings. list = [rx,ry,o].
 function glowPool(cx,cy,list,tok='glow',patches=6){let s='';list.forEach(([rx,ry,o],i)=>{s+=fill(lobe(cx+J(rx*.06),cy+J(ry*.08)-i*2,rx,ry,13+i),tok,o);});
  const [rx,ry,o]=list[0];for(let i=0;i<patches;i++){const a=R(0,Math.PI*2);s+=fill(lobe(cx+Math.cos(a)*rx*R(.8,1.02),cy+Math.sin(a)*ry*R(.8,1.02),R(rx*.08,rx*.18),R(ry*.06,ry*.12),7),tok,o*.8);}
  return s;}
 // The clearing's edge: a row of firs of every kind and height, lower behind the fire, each touched by its light on
 // the side that faces it.
 function edgeFirs(y){const B=Batch(),G=Batch();let x=-40;while(x<W+40){x+=R(44,82);const g=(x-720)/280,hh=R(76,138)*(1-.38*Math.exp(-g*g)),yy=y+J(4);
   farTree(B,x,yy,hh,pick(['tree1','tree2','tree3']),.5,pick(['spruce','spruce','fir','fir','spruce']));
   }
  return B.out()+G.out();}
 // The fire: three drawn frames that take turns. Each is an outer flame of tongues of different heights, each tongue
 // full at its foot, drawn in at its neck and leaning into a curled tip; an inner flame, a hot core low down, and a
 // lick or two broken off above.
 const flameArt=once(()=>{const frame=k=>alt(900+k*17,()=>{
   const tongues=(x0,x1,base,hs)=>{const n=hs.length,w=(x1-x0)/n,pts=[[x0,base]];
    for(let i=0;i<n;i++){const cx=x0+w*(i+.5),h=hs[i],lean=(i%2?1:-1)*R(.5,1),top=[cx+lean*w*.5,base-h];
     pts.push([cx-w*.52,base-h*.26],[cx-w*.36+lean*w*.1,base-h*.56],[cx-w*.08+lean*w*.32,base-h*.82],top,[cx+w*.1+lean*w*.18,base-h*.72],[cx+w*.4,base-h*.44]);
     if(i<n-1)pts.push([cx+w*.5,base-Math.min(h,hs[i+1])*R(.2,.3)]);}
    pts.push([x1,base],[(x0+x1)/2,base+4]);return pts;};
   const L=tongues(16,96,116,[R(40,54),R(66,84),R(94,110),R(62,78),R(36,50)]),M=tongues(30,82,116,[R(34,46),R(58,72),R(38,50)]),C=tongues(44,70,116,[R(22,30),R(28,38)]);
   let s=fill(loop(L,.5,0),'flame',1)+fill(loop(M,.4,0),'flame2',.95)+fill(loop(C,.3,0),'flame3',1)+ink(loop(L,.5,2),1.3,.35);
   for(let i=0;i<RI(1,2);i++){const x=R(40,74),y=R(4,20),h=R(9,15);s+=fill(loop([[x,y+h],[x-3.6,y+h*.55],[x+J(1.5),y],[x+3.4,y+h*.6]],.3,0),'flame',.95);}
   return s;});
  return `<g class="fr-flames"><g class="fr-ff f1">${frame(0)}</g><g class="fr-ff f2">${frame(1)}</g><g class="fr-ff f3">${frame(2)}</g></g>`;});
 // A cast iron pot hung on its chain from a tripod of three wooden poles lashed at the top, over a bed of coals
 // ringed with stones. The poles are drawn as wood, tapering to their tops; the pot is round-bellied with a rim,
 // a lid and its bail, the fire's light on its side.
 function tripodPot(x,y){
  let s=fill(loop([[x-44,y+3],[x,y-1],[x+44,y+3],[x+20,y+8],[x-20,y+8]],.4,0),'shade',.5)+fill(lobe(x,y,24,5.4,11),'ash',.9);
  const B=Batch();for(let i=0;i<10;i++){const ex=x+R(-17,17),ey=y+R(-3,2.5);B.fill('ember',dab(ex,ey,2,1.3),.9);}s+=B.out();
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;s+=piece(ring(x+Math.cos(a)*26,y+Math.sin(a)*5.6+1,6,4,8,.12),'rock2',1.2,.85,.3);}
  const top=[x+2,y-104];
  for(const [lx,ly,far] of [[x+10,y+12,1],[x-40,y+6,0],[x+42,y+4,0]]){
    const d=strand([[lx,ly],[lx+(top[0]-lx)*.5,ly+(top[1]-ly)*.5],[top[0]+(lx-x)*.06,top[1]-6]],[5.4,4.2,3]);
    s+=wash(d,far?'wood3':'wood2')+ink(d,1.4,far?.7:.9);
  }
  s+=piece([[top[0]-8,top[1]+4],[top[0]+7,top[1]+1],[top[0]+8,top[1]+9],[top[0]-7,top[1]+12]],'rope',1.1,.9,.2)+ink(`M${top[0]-7} ${top[1]+7}l14 -3`,.7,.6);
  let c='';for(let k=0;k<6;k++)c+=`M${f1(top[0]-1.6)} ${f1(top[1]+16+k*7.2)}a1.6 3.4 0 1 0 3.2 0a1.6 3.4 0 1 0 -3.2 0`;s+=ink(c,1,.85);
  const py=top[1]+58;s+=ink(`M${x-18} ${py+12}Q${x+2} ${py-10} ${x+22} ${py+12}`,1.5,.9);
  s+=piece([[x-20,py+10],[x-24,py+22],[x-18,py+34],[x-6,py+40],[x+10,py+40],[x+22,py+34],[x+26,py+22],[x+22,py+10]],'iron',1.7,.9,.3);
  s+=piece([[x-24,py+8],[x+26,py+8],[x+25,py+13],[x-23,py+13]],'kettle2',1.2,.9,.2)+piece(ring(x+1,py+5,15,3,10,.04),'kettle2',1.1,.9,.2)+fill(dab(x+1,py+2,2.4,1.6),'iron');
  s+=fill(loop([[x+12,py+15],[x+22,py+18],[x+21,py+32],[x+12,py+37]],.3,0),'glow',.32)+ink(`M${x-15} ${py+22}q4 3 2 9M${x-7} ${py+26}q3 4 0 8`,.8,.4);
  return s;
 }
 // A woodpile of split logs: their sawn ends of every size (some halves and quarters where they were split), the
 // bark round each, rings and a crack or two, two logs lying across the top, the fire's light on the nearer ends.
 function woodpile(x,y,n=4){
  let s=fill(loop([[x-22,y+10],[x+n*30*.5,y+7],[x+n*30+6,y+10],[x+n*20,y+15],[x,y+15]],.4,0),'shade',.55);
  const B=Batch(),I=Batch(),G=Batch();
  for(let r=0;r<Math.min(3,n);r++)for(let c=0;c<n-r;c++){const cx=x+c*30+r*15+J(2),cy=y-r*24+J(1.5),rx=R(12,15.6),ry=rx*R(.74,.86),kind=rnd();
   let pts;
   if(kind<.2)
     pts=[[cx-rx,cy+ry*.6],[cx-rx*.8,cy-ry*.6],[cx,cy-ry],[cx+rx*.8,cy-ry*.6],[cx+rx,cy+ry*.6],[cx,cy+ry*.2]];
   else if(kind<.32)pts=[[cx-rx,cy+ry],[cx-rx,cy-ry*.4],[cx-rx*.2,cy-ry],[cx+rx*.7,cy-ry*.6],[cx+rx*.1,cy+ry*.4]];else pts=ring(cx,cy,rx,ry,9,.06);
   B.fill(pick(['wood','wood','wood2']),loop(shift(pts,1,1.2),.3,0));I.ink(loop(pts,.3,2),1.5,.88);I.mark('bark',loop(pts.map(([px,py])=>[cx+(px-cx)*.9,cy+(py-cy)*.9]),.3,1),1.6,.8);
   I.ink(loop(ring(cx,cy,rx*.5,ry*.5,8,.08),.3,1),.8,.5);I.ink(`M${f1(cx)} ${f1(cy)}l${f1(rx*R(.4,.8))} ${f1(-ry*R(.2,.6))}`,.7,.55);B.fill('wood3',dab(cx,cy,1.4,1.1));
   if(c===0)G.fill('glow',loop([[cx-rx,cy-ry*.3],[cx-rx*.4,cy-ry],[cx,cy-ry*.6],[cx-rx*.6,cy+ry*.4]],.3,0),.24);}
  s+=B.out()+I.out()+G.out();
  {
    const y0=y+6,x0=x+n*30-6,lg=[[x0,y0+4],[x0+2,y0-6],[x0+52,y0-8],[x0+54,y0+3]];
    s+=piece(lg,'bark',1.5,.88,.3)+ink(`M${f1(x0+8)} ${f1(y0-2)}q20 -1.4 40 -2.4`,.8,.45)+piece(ring(x0+54,y0-2.4,4.6,6,8,.05),'wood',1.1,.9,.2);
  }
  return s;
 }
 // A stump with the axe left in it: the stump drawn round with its bark in long cracks, roots into the ground, the
 // sawn top in rings; the axe's haft curving up out of the cut, its head bitten into the wood, the edge bright.
 function stump(x,y){
  let s=fill(loop([[x-10,y+1],[x+35,y-2],[x+82,y+1],[x+60,y+6],[x+4,y+6]],.4,0),'shade',.55);
  s+=piece([[x-6,y+2],[x+2,y-4],[x+4,y-40],[x+66,y-41],[x+67,y-4],[x+76,y+2],[x+50,y+3],[x+20,y+3]],'bark',2,.9,.4);
  const B=Batch();for(let k=0;k<6;k++)B.ink(smooth([[x+9+k*11,y-34],[x+10+k*11+J(2),y-20],[x+9+k*11,y-4]],.4),.9,.45);
  B.fill('glow',loop([[x+52,y-38],[x+66,y-38],[x+68,y-4],[x+56,y-4]],.3,0),.2);s+=B.out();
  s+=piece(ring(x+35,y-40,33,9,14,.03),'wood',1.8,.9,.2);for(const r of [.66,.4,.16])s+=ink(loop(ring(x+35,y-40,33*r,9*r,12,.05),.3,1),.85,.5);
  s+=ink(`M${x+35} ${y-40}l20 -4M${x+35} ${y-40}l-12 5`,.8,.55);
  const haft=strand([[x+40,y-46],[x+60,y-78],[x+86,y-110]],[5.2,4.4,4]);s+=wash(haft,'wood')+ink(haft,1.4,.9);
  s+=piece([[x+28,y-40],[x+33,y-56],[x+48,y-56],[x+52,y-46],[x+44,y-38]],'iron',1.6,.9,.2)+mark(`M${x+29} ${y-42}l4 -12`,'tin',1.6,.9);
  return s;
 }
 // A log to sit on: lying round on the ground, bark in long fissures, the sawn end with its rings, its top worn
 // smooth and lit by the fire.
 function logSeat(x,y,w,SH){
  const pts=[[x,y+4],[x+2,y-8],[x+w*.5,y-14],[x+w,y-16],[x+w+5,y-2],[x+w+2,y+10],[x+w*.5,y+20],[x+4,y+22]];
  let s=fill(loop([[x-8,y+20],[x+w*.5,y+16],[x+w+12,y+12],[x+w*.6,y+26],[x,y+28]],.4,0),'shade',.55)+piece(pts,'bark',2,.9,.4);
  const B=Batch();for(let k=0;k<5;k++){const yy=y-6+k*5;B.ink(smooth([[x+8,yy+k*.4],[x+w*.5,yy-4+k],[x+w-6,yy-8+k]],.4),.8,.42);}
  B.fill('glow',loop([[x+6,y-4],[x+w*.5,y-12],[x+w-4,y-14],[x+w*.5,y-6]],.3,0),warmth(x+w/2)*.9);s+=B.out();
  s+=piece(ring(x+w+2,y+1,8,14,10,.04),'wood',1.6,.9,.2)+ink(loop(ring(x+w+2,y+1,4,7,8,.05),.3,1),.8,.55);
  SH?.cast(x+w*.5,y+20,w*.6,8);
  return s;
 }
 // The fire's ring: stones of every size round it (rounded, each lit on the side toward the fire), grey ash, two logs
 // across one another with their sawn ends, embers.
 function campfireBase(x,y){
  let s=fill(lobe(x,y+6,82,20,15),'ash',.9);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2+J(.12),cx=x+Math.cos(a)*64,cy=y+6+Math.sin(a)*16,rx=R(11,16),ry=rx*R(.6,.74);
   s+=piece([[cx-rx,cy+ry*.5],[cx-rx*.8,cy-ry*.6],[cx-rx*.1,cy-ry],[cx+rx*.7,cy-ry*.7],[cx+rx,cy+ry*.3],[cx+rx*.2,cy+ry]],pick(['rock2','rock']),1.6,.9,.3)+
     fill(loop(ring(cx-Math.cos(a)*5,cy-3,6,3,7,.1),.3,0),'glow',.3);}
  for(const [a,b,tok] of [[[x-50,y+8],[x+42,y-12],'wood2'],[[x-44,y-12],[x+50,y+8],'wood3']]){
    const lg=strand([a,[(a[0]+b[0])/2,(a[1]+b[1])/2],b],[11,11,10]);
    s+=wash(lg,tok)+ink(lg,1.8,.92);
    s+=piece(ring(b[0],b[1],5.4,5.4,8,.05),'wood',1.2,.9,.2);
  }
  const B=Batch();for(let i=0;i<16;i++){const ex=x+R(-40,40),ey=y+R(-4,12);B.fill('ember',dab(ex,ey,2,1.4));}s+=B.out();
  return s;
 }
 // The owl on its branch: a round body drawn whole, the breast barred, the wings folded at its sides, the feet
 // gripping the branch; the head turns (front or side) with its ear tufts, the facial disc, round amber eyes and a
 // hooked beak. 70 x 80 on a branch at y=66.
 const owlArt=once(()=>alt(5303,()=>{
  const body=piece([[35,72],[22,68],[15,56],[15,42],[21,32],[35,28],[49,32],[55,42],[55,56],[48,68]],'owl',1.7,.9,.3)+fill(loop([[26,44],[35,40],[44,44],[46,60],[35,68],[24,60]],.3,0),'owl2',.85);
  let marks='';for(let r=0;r<4;r++)for(let c=0;c<3;c++)marks+=ink(`M${f1(27+c*6.4+(r%2)*3)} ${f1(47+r*5)}q2 1.8 4 0`,.8,.55);
  const wings=piece([[17,40],[13,52],[16,64],[22,66],[20,50]],'owl2',1.2,.8,.2)+piece([[53,40],[57,52],[54,64],[48,66],[50,50]],'owl2',1.2,.8,.2);
  const feet=ink('M29 67l-2 5M31 67v5M39 67v5M41 67l2 5',1.2,.9);
  const eyeR=(x,y)=>piece(ring(x,y,6,6,10,.04),'owleye',1.2,.85,.2)+fill(dab(x,y,2.6,2.6),'eye')+fill(dab(x+.9,y-1,.8),'eyeshine');
  const front=piece([[19,36],[16,18],[24,22],[35,19],[46,22],[54,18],[51,36],[35,40]],'owl',1.6,.9,.3)+
    fill(loop([[22,24],[35,22],[48,24],[48,34],[35,37],[22,34]],.3,0),'owl2',.6)+
    eyeR(28,28)+
    eyeR(42,28)+
    piece([[33,31],[37,31],[35,36.4]],'beak',1,.85,.1);
  const side=piece([[19,36],[18,18],[24,22],[36,20],[46,22],[53,17],[52,36],[35,40]],'owl',1.6,.9,.3)+
    fill(loop([[34,24],[48,24],[50,34],[36,36]],.3,0),'owl2',.6)+
    eyeR(43,28)+
    piece([[50,30],[57,32],[50,34]],'beak',1,.85,.1)+
    ink('M24 26q4 -3 8 0',1,.6);
  return body+wings+marks+feet+`<g class="fr-owlhead"><g class="fr-pose p-front">${front}</g><g class="fr-pose p-side">${side}</g></g>`;
 }));
 // ---------------------------------------------------------------- the four places
 function lake(night){
  seed=1101;const SH=Shadows({light:[1176,640]}),A=[],WA=[];let far='',mid='',mid2='',near='',front='';
  far+=range(HZ-26,'mtnfar',.3,{snow:true,peaks:[150,230],low:[80,140],rise:[56,124],shade:.09});
  far+=range(HZ-6,'mtn',.38,{peaks:[120,200],low:[60,110],rise:[34,86],shade:.12});
  // the far shore: a low hill, the woods in two rows (a pale back row, a mixed near row), the cabin with its chimney,
  // its woodpile and the canoe on the shore
  far+=fill(pth([[-20,HZ-4],[260,HZ-22],[600,HZ-10],[940,HZ-28],[1240,HZ-14],[1460,HZ-20],[1460,HZ+24],[-20,HZ+24]],true,2),'hill');
  far+=woods(HZ+10,{gap:[10,19],h:[24,58],skip:x=>x>1028&&x<1144});
  far+=logCabin(1036,HZ+8,night);
  // the lake: water, the far shore reflected and broken, a sun path and ripples
  mid+=fill(pth([[-20,HZ+14],[1460,HZ+14],[1460,746],[1180,758],[860,744],[520,756],[260,738],[-20,746]],true,2),'water');
  mid+=fill(pth([[-20,HZ+14],[1460,HZ+14],[1460,HZ+50],[1000,HZ+44],[600,HZ+52],[200,HZ+44],[-20,HZ+50]],true,2),'water2',.85);
  {const B=Batch();for(let i=0;i<90;i++){const x=R(-10,W),h=R(10,30),y=HZ+16;B.fill(pick(['tree1','tree2']),`M${f1(x)} ${f1(y)}l${f1(h*.18)} ${f1(h)}l${f1(-h*.36)} 0z`,.45);}
   for(let i=0;i<16;i++){const y=R(HZ+22,HZ+58),x=R(-20,1400);B.fill('water',`M${f1(x)} ${f1(y)}h${f1(R(60,200))}v${f1(R(1.5,3))}h${f1(-R(60,200))}z`,.9);}
   for(let i=0;i<70;i++){const x=R(20,1420),y=R(HZ+60,736),l=R(16,44)*(.6+(y-HZ)/200);B.mark('ripple',`M${f1(x)} ${f1(y)}q${f1(l*.5)} -2 ${f1(l)} 0`,1.3,.5);}
   for(let i=0;i<22;i++){const x=R(30,1400),y=R(HZ+70,730);B.mark('water3',`M${f1(x)} ${f1(y)}h${f1(R(8,22))}`,2.2,.7);}
   // wind lanes: long paler streaks where a breeze roughens the water, and calm darker ones between
   for(let i=0;i<6;i++){const y=R(HZ+64,700),x=R(-40,1200),w=R(220,460);B.fill(i%2?'water3':'water2',pth([[x,y],[x+w*.5,y-R(1.4,2.6)],[x+w,y],[x+w*.5,y+R(1.4,2.4)]],true,1),i%2?.22:.4);}
   mid+=B.out();}
  // the cabin lies upside down in the water too: its walls and roof as short wavering bands, broken by the water;
  // at night its lit window lays a warm broken streak toward you
  mid+=alt(5101,()=>{let s='';for(let k=0;k<8;k++){const y=HZ+18+k*5.6,roof=k>3,half=roof?28*(1-(k-4)/4.4):22,cx=1058+J(2.5),gap=R(3,7),cut=R(-.3,.3)*half;
   if(rnd()<.18)continue;const a=cx-half+J(2),b=cx+cut-gap/2,c=cx+cut+gap/2,d=cx+half+J(2),t=R(1.4,2.4);
   s+=fill(`M${f1(a)} ${f1(y)}H${f1(b)}v${f1(t)}H${f1(a)}zM${f1(c)} ${f1(y+J(.6))}H${f1(d)}v${f1(t)}H${f1(c)}z`,roof?'roof':'wood',roof?.2:.24);}
   if(night)for(let k=0;k<9;k++){const y=HZ+20+k*6.4,l=R(5,13)*(1-k/14),x=1049.5+J(3)-l/2;s+=fill(`M${f1(x)} ${f1(y)}h${f1(l)}v${f1(R(1.4,2.2))}h${f1(-l)}z`,'glow',.7-k*.05);}
   return s;});
  {const B=Batch();let x=-20;while(x<W){const w=R(140,260),d=R(26,58);B.fill('mtn',pth([[x,HZ+16],[x+w*.5,HZ+16+d],[x+w,HZ+16]],true,1.5),.22);x+=w*R(.7,1);}
   for(let i=0;i<26;i++){const y=R(HZ+24,HZ+70),x=R(-20,1420);B.fill('water',`M${f1(x)} ${f1(y)}h${f1(R(40,140))}v${f1(R(1.2,2.4))}h${f1(-R(40,140))}z`,.95);}mid+=B.out();}
  // what floats or stands in the water sits above its moving surface: ducks, pads, the boat, the reeds
  // a drake and a duck asleep in the open water between the lily pads and the boat, clear of the pier
  mid2+=mallard(388,730,.92,1,true)+mallard(436,741,.84,-1,false);box('ducks',362,712,456,746);
  // the lily pads in a loose raft round one flower and a bud, a dragonfly on the reeds where the heron stands
  mid2+=pad(258,700,17,{rot:.4})+
    pad(300,716,13,{flower:true,rot:-.9})+
    pad(222,722,15,{rot:2.2})+
    pad(330,694,10,{rot:1.2})+
    pad(186,708,11,{rot:-2.6,bud:true})+
    pad(282,730,8,{rot:3})+
    pad(160,724,7,{rot:.9});
  mid2+=rowboat(410,640,.95);
  {const B=Batch();reeds(B,1218,744,12);reeds(B,1330,746,6,.8);
   for(let i=0;i<9;i++){const x=1214+R(0,150),y=746,h=R(30,60),dir=rnd()<.5?-1:1;B.mark(pick(['reed','reed2']),`M${f1(x)} ${f1(y)}q${f1(dir*h*.08)} ${f1(-h*.6)} ${f1(dir*h*.34)} ${f1(-h)}`,2.2,.8);}
   mid2+=B.out();}
  mid2+=dragonfly(1300,668);
  A.push(actor('fr-heron',1240,578,150,170,heronArt()));
  A.push(actor('fr-hdrops',1286,698,50,50,heronDropsArt()));
  // the near shore: a pebble line, ground, the path down to the pier, the pier with Biscuit and the lantern
  near+=fill(pth([[-20,744],[260,736],[520,754],[860,742],[1180,756],[1460,746],[1460,920],[-20,920]],true,3),'ground');
  near+=fill(pth([[-20,744],[260,736],[520,754],[860,742],[1180,756],[1460,746],[1460,762],[1180,772],[860,758],[520,770],[260,752],[-20,760]],true,2),'sand');
  near+=ink(pth([[-20,746],[260,738],[520,756],[860,744],[1180,758],[1460,748]],false,2),2,.6);
  {
    const B=Batch();
    for(let i=0;i<120;i++){const x=R(0,W),y=R(748,770),r=R(1.2,3.6);B.fill(pick(['rock','rock2','sand2']),`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(r*.7)} 0 1 0 ${f1(r*2)} 0a${f1(r)} ${f1(r*.7)} 0 1 0 ${f1(-r*2)} 0`);}
   for(let i=0;i<40;i++){const x=R(0,W),y=R(744,752);B.mark('water3',`M${f1(x)} ${f1(y)}q6 -2 12 0`,1.4,.7);}
   // a stick of driftwood and a few shells left by the water
   B.ink(smooth([[598,758],[624,755],[652,757.4]],.4),2.4,.75);B.mark('sand2',smooth([[600,757],[624,754.4],[650,756.6]],.3),1.2,.9);B.ink(`M626 755l6 -5`,1.2,.7);
   for(const [x,y] of [[470,762],[690,760],[1240,768]]){B.fill('fl4',`M${x} ${y}q3 -4 6 0z`,.9);B.ink(`M${x} ${y}q3 -4 6 0z`,.7,.5);}
   near+=B.out();}
  near+=fill(pth([[-20,800],[400,786],[900,806],[1460,790],[1460,920],[-20,920]],true,3),'ground2',.7);
  near+=footpath([[660,904],[690,862],[732,826],[770,796],[786,768]],62,22);
  near+=pier(770,712,400,night,SH);
  // the shore boulders lie just past the birch trunks (they end at 170), never behind them
  near+=boulder(190,850,116,58,{moss:true},SH)+boulder(314,862,60,32,{},SH)+boulder(560,872,92,42,{},SH)+boulder(696,882,36,19,{},SH);box('boulder',186,792,308,852);box('stone',310,830,376,864);
  {
    const B=Batch();
    grassField(B,0,W,790,890,70,{skip:(x,y)=>Math.abs(x-(660+(904-y)*.95))<(y>840?26:16)&&y>772});
    flowers(B,300,620,812,872,22);
    flowers(B,860,1180,808,860,10,['fl1','fl3','fl4']);
    for(let i=0;i<10;i++)clover(B,R(380,620),R(820,880));
    for(let i=0;i<16;i++)tuft(B,R(0,W),R(790,894),R(14,24));
    for(let i=0;i<7;i++)pinecone(B,R(30,330),R(860,890));
    near+=B.out();
  }
  near+=notebook(404,842,-4)+fallenLog(760,890,190,28,SH);
  // a small white butterfly resting on a flower by the notebook, wings up
  near+=fill('M520 828q-6 -10 -1 -14q4 3 1 14zM520 828q8 -8 4 -13q-5 1 -4 13z','fl4')+ink('M520 828q-6 -10 -1 -14q4 3 1 14zM520 828q8 -8 4 -13q-5 1 -4 13z',.8,.7)+fill(dab(519.4,814.6,1.1),'fl2')+ink('M520 828l-1 -16M520 830q-1 4 0 8',.8,.7);
  near+=lanternPost(1150,712);
  A.push(actor('fr-lpool',1030,690,230,48,lanternPool(110,20,104,14)));
  A.push(actor('fr-lantern',1146,584,60,80,lanternArt()));
  // Biscuit asleep on the boards, the kettle by his nose, both clear of the lantern post
  {const bx=846,by=578,[kx,ky]=kettleAt(bx,by);
   A.push(actor('fr-kettle',kx,ky,70,60,kettleArt()+`<g class="fr-steam" transform="translate(58 -10)">${steamArt()}</g>`));
   A.push(actor('fr-biscuit',bx,by,230,150,ponyArt()));biscuitBoxes(bx,by);kettleBox(kx,ky);SH.cast(bx+104,716,170,12);}
  box('lanternpost',1146,594,1153,712);box('lantern',1162,594,1190,645);box('heron',1250,592,1390,748);box('boat',376,600,652,690);
  // the framing birches and the bush at the right edge
  front+=birchTree(64,900,560,{lean:.02,leaves:980},SH)+birchTree(152,890,420,{lean:-.03,leaves:640,io:.8},SH);box('birch-trunk',44,340,84,900);box('birch-trunk',134,470,172,890);
  front+=alt(5411,()=>{
    let s='';
    for(const [x,y,r,tok] of [[1384,872,40,'tree3'],[1426,862,46,'tree2'],[1404,834,36,'tree1'],[1446,892,40,'tree3']]){
      const pts=[];
      for(let i=0;i<11;i++){const a=i/11*Math.PI*2;pts.push([x+Math.cos(a)*r*R(.82,1.06),y+Math.sin(a)*r*.82*R(.82,1.06)]);}
      s+=piece(pts,tok,1.5,.7,.6);
    }
   const B=Batch();
   for(let i=0;i<46;i++){const x=R(1350,1440),y=R(800,900),a=R(0,Math.PI*2);B.fill(pick(['leaf','leaf2','leaf3']),leafPath(x,y,R(7,11),a,.44));if(i%3===0)B.ink(leafPath(x,y,8,a,.44),.8,.4);}
   for(let i=0;i<5;i++)B.fill('fl3',dab(R(1360,1430),R(820,880),R(2,3)));return s+B.out();});
  {const B=Batch();fern(B,1290,900,1.1);fern(B,40,904,.9);grassField(B,0,260,860,900,26,{h:[18,34]});grassField(B,1200,W,860,900,24,{h:[18,30]});fringe(B);front+=B.out();}
  // light: morning shafts through the birch crowns, slender and faint; evening light lying long over the water
  const light=[shafts([[150,40,520,90,744,1],[236,26,640,64,744,.8],[300,18,760,46,744,.62],[96,22,380,56,744,.7]],.22),
   fill(pth([[900,HZ+30],[1440,HZ+20],[1440,HZ+60],[760,HZ+70]],true,4),'light',.28)];
  WA.push(shimmer(0,HZ+16,W,724-HZ,140));
  // the sun's (or moon's) glitter on the far half of the lake: ten rows from just under the far shore, each its own group,
  // so focus-room.js can put out the rows that would lie on the boat, Biscuit and his 'z z', the kettle or the lantern
  WA.push(actor('fr-glint',0,HZ+18,160,104,Array.from({length:10},(_,i)=>{
    const y=6+i*10,l=R(14,60)*(1-i/16);
    return `<g class="fr-gl">${mark(`M${f1(80-l/2)} ${f1(y)}h${f1(l)}`,'glint',2.6,.8)}</g>`;
  }).join('')));
  WA.push(actor('fr-lrefl',1150,722,56,30,lanternRefl(56,30)));
  A.push(wispActor(1070,HZ-46));
  // in open water east of the boat, clear of its oars, rope and mooring post
  WA.push(actor('fr-ring fr-start-life',600,676,120,40,ringArt({place:'lake'})));
  // the clouds keep to the band above the time (visible on 16:10 and 16:9 screens alike), never behind the digits, and
  // drift clear above the task tag (its top edge is at stage y 110 on a 16:10 screen, lower on wider ones): a cloud that
  // dipped behind it showed only its top above the tag's edge, cut
  return finish('lake',night,{far,mid,mid2,near,front,SH,light,A,WA,clouds:[[16,170,260,-40,.9],[44,120,330,-190,.85],[28,150,300,-250,.8]]});
 }
 function cabin(x,y,night){
  let s=fill(pth([[x-8,y+2],[x+56,y+2],[x+52,y+6],[x-4,y+6]],true,.5),'shade',.5);
  s+=shape([[x,y],[x,y-26],[x+44,y-26],[x+44,y]],'wood',1.6,.55,.6);
  for(let k=1;k<5;k++)s+=ink(`M${x} ${f1(y-k*5.2)}h44`,.8,.35);
  s+=shape([[x-6,y-24],[x+22,y-46],[x+50,y-24]],'roof',1.6,.6,.6)+ink(`M${x+4} ${y-28}l18 -14M${x+12} ${y-26}l14 -12`,.8,.3);
  s+=shape([[x+30,y-36],[x+30,y-52],[x+37,y-52],[x+37,y-34]],'rock2',1.4,.6,.4);
  s+=fill(`M${x+8} ${y-18}h10v9h-10z`,night?'glowcore':'glass')+ink(`M${x+8} ${y-18}h10v9h-10zM${x+13} ${y-18}v9`,1,.55);
  s+=fill(`M${x+26} ${y-16}h8v16h-8z`,'wood3',.8);
  for(let k=0;k<4;k++)s+=blob(x+52+k*5,y-2,3,2.4,'wood2',.9,.5,7);
  return s;
 }
 function boat(x,y,k,night){
  let s=fill(pth([[x+10,y+22],[x+150*k,y+22],[x+130*k,y+40],[x+30,y+40]],true,2),'water2',.6);
  const hull=[[x,y],[x+40*k,y+20*k],[x+130*k,y+20*k],[x+170*k,y],[x+150*k,y+5*k],[x+20*k,y+5*k]];
  s+=shape(hull,'boat',2,.85)+fill(pth([[x+40*k,y+12*k],[x+130*k,y+12*k],[x+128*k,y+19*k],[x+44*k,y+19*k]],true,.6),'boat2',.8);
  s+=ink(pth([[x+14*k,y+5*k],[x+40*k,y+14*k],[x+130*k,y+14*k],[x+158*k,y+5*k]],false,.6),1,.5);
  for(const sx of [60,100])s+=ink(`M${f1(x+sx*k)} ${f1(y+5*k)}v${f1(13*k)}`,1.2,.6);
  s+=ink(pth([[x+50*k,y+3*k],[x+124*k,y+3*k]],false,.4),3,.7);
  s+=ink(pth([[x+60*k,y+4*k],[x+18*k,y+44*k]],false,.6),2,.75)+blob(x+16*k,y+46*k,6*k,2.6*k,'wood',1.2,.75,8);
  s+=rope(x+168*k,y+1,x+232*k,y+14,6);
  s+=post(x+234*k,y+30,34,5,.75);
  for(let i=0;i<6;i++)s+=ink(`M${f1(x+R(0,170*k))} ${f1(y+R(26,40))}q8 -2 16 0`,1.1,.35);
  s+=alt(5203,()=>ink(pth([[x+150*k,y+2],[x+60*k,y-8],[x-30,y-24]],false,.4),1.8,.8)+mark(pth([[x+150*k,y+2],[x+120*k,y-1]],false,.3),'wood3',3,.9)+ink(`M${f1(x-30)} ${f1(y-24)}q-5 18 -1 38`,.7,.5));
  return s;
 }
 function pier(x,y,w,night,SH){
  let s='';const B=Batch();
  // the posts stand in the sand at the water's edge (each with its contact shadow and a little sand heaped round its
  // foot), braced in pairs under the deck; then the deck in planks, then the things that live on a pier
  for(let i=0;i<7;i++){const px=x+12+i*(w-24)/6;s+=fill(loop([[px-9,y+52],[px,y+50],[px+10,y+52],[px+4,y+55],[px-6,y+55]],.3,0),'shade',.5);
   if(i<6){const qx=x+12+(i+1)*(w-24)/6;B.ink(`M${f1(px+3)} ${f1(y+16)}L${f1(qx-3)} ${f1(y+42)}M${f1(px+3)} ${f1(y+42)}L${f1(qx-3)} ${f1(y+16)}`,1.4,.5);}}
  s+=B.out();
  for(let i=0;i<7;i++){
    const px=x+12+i*(w-24)/6;
    s+=post(px,y+52,48,8,.85);
    s+=fill(loop([[px-8,y+52.4],[px-3,y+48.6],[px+4,y+48.4],[px+9,y+52.6],[px,y+53.6]],.3,0),'sand2',.9)+ink(`M${f1(px-9)} ${f1(y+52)}q9 -4 18 0`,1,.45);
  }
  s+=ink(pth([[x+12,y+30],[x+w*.5,y+24],[x+w-12,y+18]],false,.6),2,.6);
  planks(B,x,y,x+w,y-8,12,16,.9);s+=B.out();
  s+=ink(pth([[x,y],[x+w,y-8]],false,.5),2,.9)+ink(pth([[x-2,y+12],[x+w-2,y+4]],false,.5),2,.9)+fill(pth([[x-2,y+12],[x+w-2,y+4],[x+w-2,y+9],[x-2,y+17]],true,.5),'wood3',.9);
  s+=ink(`M${f1(x-2)} ${f1(y+12)}l2 -12M${f1(x+w-2)} ${f1(y+4)}l2 -12`,1.6,.9);
  // a mug and a coiled rope left at the shore end of the boards (the rod lies over the boat's stern)
  s+=[[x+50,y+2]].map(([cx,cy])=>
    [10,7,4].map(r=>ink(pth(ring(cx,cy,r,r*.38,10),true,.4),1.6,.8)).join('')+
      mark(pth(ring(cx,cy,10,3.8,10),true,.4),'rope',2.4,.8)+
      mark(`M${f1(cx+9)} ${f1(cy+1)}q8 3 14 1`,'rope',2.2,.85)+
      ink(`M${f1(cx+9)} ${f1(cy+1)}q8 3 14 1`,.6,.5)).join('');
  s+=shape([[x+8,y-4],[x+9,y-14],[x+18,y-14],[x+17,y-4]],'mug',1.4,.85,.3)+ink(`M${x+18} ${y-12}q5 1 0 6`,1.2,.8);
  box('mug',x+6,y-16,x+24,y-2);box('coil',x+39,y-4,x+61,y+8);
  SH?.cast(x+w*.5,y+16,w*.4,8);
  return s;
 }
 // The start of a session on water: a swirl and a dip where something moves under the surface, a fish breaks it in
 // an arc (hidden below the waterline by a clip), the ring spreads, and a smaller ring where it goes back in.
 function ringArt({fish=true,place='lake',drops=false}={}){
  let s=`<g class="fr-ripplering">${ink(pth(ring(60,20,40,9,16),true,.6),1.6,.7)}${ink(pth(ring(60,20,24,5.4,14),true,.5),1.4,.7)}</g>`;
  if(fish){
   s=`<g class="fr-swirl">${ink('M60 20m-9 0a9 2.8 0 1 1 18 .4a6 1.9 0 1 1 -12 -.2a3 1 0 1 1 6 0',1.2,.6)}</g>`+s;
   const body=pth([[44,18],[52,11],[64,8],[76,10],[84,16],[76,20],[60,21]],true,.4);
   s+=`<clipPath id="fr-fishclip-${place}"><rect x="-80" y="-90" width="280" height="110.5"/></clipPath><g clip-path="url(#fr-fishclip-${place})"><g class="fr-fish">${wash(body,'fish')}${ink(body,1.4,.85)}${fill(pth([[54,12],[68,9],[78,12],[66,14]],true,.3),'fish2',.85)}${ink('M44 17l-9 -7l2 7l-2 7z',1.2,.85)}${fill('M44 17l-9 -7l2 7l-2 7z','fish2')}${ink('M60 10q2 -5 8 -4M62 20q3 4 7 2',1,.7)}${fill('M77.4 13.6a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0','eye')}${ink('M58 12q2 4 0 8M66 11q2 4 0 8',.7,.4)}</g></g>`;
   s+=`<g class="fr-ripplering fr-ring2">${ink(pth(ring(92,21,22,5,14),true,.5),1.4,.65)}${ink(pth(ring(92,21,11,2.4,10),true,.4),1.1,.6)}</g>`;
  }
  if(drops)s+=`<g class="fr-splashdrops">${[[-14,-1],[-6,-1.4],[4,-1.5],[12,-1.1],[-2,-1.7]].map(([dx,k],i)=>`<g class="fr-sdrop" style="--i:${i};--dx:${dx}px;--k:${k}">${fill(`M${60+dx*.4} 18q-2 3 0 4.4q2 -1.4 0 -4.4z`,'water3')}${ink(`M${60+dx*.4} 18q-2 3 0 4.4q2 -1.4 0 -4.4z`,.7,.6)}</g>`).join('')}</g>`;
  return s;
 }
 // The lantern's light where it falls: a warm pool of flat washes on the boards or the grass, and on water a broken
 // column of its reflection. Both are dark by day and light with the lantern.
 function lanternPool(cx,cy,rx,ry){seed=Math.round(cx+cy);
  // an uneven pool, longer than it is deep, brightest under the lantern and breaking up at its edges into lit
  // patches: flat washes of different shapes, never a stack of rings
  let s=fill(lobe(cx,cy,rx,ry,13),'glow',.11)+fill(lobe(cx+J(rx*.08),cy+ry*.1,rx*.56,ry*.64,11),'glow',.15)+fill(lobe(cx+J(4),cy+ry*.12,rx*.24,ry*.38,9),'glowcore',.2);
  for(let i=0;i<5;i++)s+=fill(lobe(cx+R(-rx*.95,rx*.95),cy+R(-ry*.5,ry*.6),R(8,18),R(2.4,4),7),'glow',.09);
  return s;}
 function lanternRefl(w,h){
  const set=k=>{
    seed=440+k*7;
    let s='';
    for(let i=0;i<7;i++){const y=3+i*(h-6)/6,l=(w-8)*(1-i/9)*R(.55,1),x=w/2-l/2+J(4);s+=mark(`M${f1(x)} ${f1(y)}h${f1(l*.45)}M${f1(x+l*.58)} ${f1(y+J(.6))}h${f1(l*.42)}`,'glint',2.2-i*.12,.85-i*.06);}
    return `<g class="fr-shim s${k}">${s}</g>`;
  };
  return set(1)+set(2);
 }
 function stream(night){
  seed=2202;const SH=Shadows({light:[356,644]}),A=[],WA=[];let far='',mid='',mid2='',near='',front='';
  far+=range(HZ-40,'mtnfar',.3,{snow:true,peaks:[170,260],low:[80,140],rise:[52,120],shade:.09});
  far+=fill(pth([[-20,HZ-14],[300,HZ-60],[620,HZ-30],[880,HZ-70],[1160,HZ-34],[1460,HZ-56],[1460,HZ+70],[-20,HZ+70]],true,3),'hill')+
    ink(pth([[-20,HZ-14],[300,HZ-60],[620,HZ-30],[880,HZ-70],[1160,HZ-34],[1460,HZ-56]],false,2),1.6,.35);
  far+=woods(HZ+8,{gap:[10,20],h:[28,66]});
  // the ground, then the mossy ledge the fall steps down: a dark wet cleft, three lips at different heights, each set
  // a little aside from the one above, the middle one parted by a mossy stone; a heavy pile of boulders on the left,
  // under a root and a fern, and a lighter pair on the right (inked shapes on offset washes, shaded faces, hatching)
  mid+=fill(pth([[-20,HZ+70],[1460,HZ+60],[1460,920],[-20,920]],true,2),'ground');
  mid+=cliff([[848,HZ+72],[851,HZ+6],[870,HZ-9],[898,HZ-21],[934,HZ-17],[962,HZ-22],[985,HZ-9],[997,HZ+22],[1004,HZ+72]]);
  // [top, bottom, left, right, bow]: 20, 30 and 28 px tall; the middle lip sits left, the bottom one right and wider
  const STEPS=[[HZ-12,HZ+8,896,958,3],[HZ+6,HZ+36,870,944,5],[HZ+34,HZ+62,884,990,6]],STONE=[908,HZ+12];
  {const B=Batch();
   STEPS.forEach(([,y],i)=>{
     if(i<2){
       const nl=STEPS[i+1][2],nr=STEPS[i+1][3];
       B.ink(pth([[nl-6,y+1],[nl+24,y-1],[nr-22,y+1.5],[nr+6,y-.5]],false,.9),1.6,.7);
       B.fill('shadow',pth([[nl-2,y+2],[nr+2,y+2.5],[nr,y+7],[nl+2,y+6.5]],true,.6),.25);
     }
   });
   // moss along the lips and down the wet rock, never evenly: thick at the left of each lip, a few drips below
   for(const [mx,my,rx] of [[872,HZ-8,9],[886,HZ-14,7],[962,HZ-16,6],[858,HZ+8,8],[952,HZ+10,5],[866,HZ+36,7],[996,HZ+30,6],[860,HZ+52,5]])B.fill('moss',pth(ring(mx,my,rx,R(2.2,3.4),8),true,.5),.9);
   for(const [mx,my,l] of [[874,HZ-6,9],[882,HZ-4,6],[862,HZ+12,11],[869,HZ+40,8],[994,HZ+34,7]])B.mark('moss',`M${f1(mx)} ${f1(my)}q${f1(J(1.2))} ${f1(l*.5)} ${f1(J(1.6))} ${f1(l)}`,1.6,.8);
   mid+=B.out();}
  // the heavy left pile, back to front, and the lighter right pair (one boulder fewer, set lower)
  mid+=boulder(796,HZ+8,68,36,{moss:true})+boulder(770,HZ+44,94,46)+boulder(738,HZ+74,128,54,{moss:true})
   +boulder(1000,HZ+46,92,48,{moss:true})+boulder(992,HZ+76,132,56);
  // a root curls out of the top of the cleft and over the left pile, a fern stands on it
  mid+=ink(pth([[862,HZ-2],[846,HZ-6],[826,HZ-2],[812,HZ+8],[806,HZ+22],[796,HZ+30]],false,.7),3.2,.85)+mark(pth([[862,HZ-3],[846,HZ-7],[826,HZ-3],[812,HZ+7]],false,.6),'bark',1.6,.8)
   +ink(pth([[826,HZ-2],[818,HZ-12],[808,HZ-16]],false,.5),1.6,.75);
  {const B=Batch();fern(B,834,HZ-26,.5);fern(B,778,HZ+2,.36,'fern',.75);mid+=B.out();}
  // the fall: one tongue of water per lip (the middle one in two, around the stone). No closed outline: only the lip is
  // inked, a curve bulging forward where the water rolls over the edge; the sides swell a little past the lip, then draw
  // in, and the bottom breaks up raggedly into foam. Water blues with a deeper band down the middle, a pale crescent where
  // the water turns over, strands that follow the bulge and then drop (more at the edges, of every length), and a skirt
  // of foam where each tongue lands, over the lip below.
  const sheets=[];STEPS.forEach(([y0,y1,l,r,bow],i)=>{if(i===1)sheets.push([y0,y1,l,STONE[0]-9,bow,2],[y0,y1,STONE[0]+8,r,3,bow]);else sheets.push([y0,y1,l,r,bow,bow]);});
  const taper=(l,r)=>Math.min(4,(r-l)*.08);
  const skirt=(x0,x1,y)=>{const n=Math.max(5,Math.round((x1-x0)/6)),top=[];for(let i=0;i<=n;i++)top.push([x0+(x1-x0)*i/n,y-(i%2?R(3,5.5):R(.4,1.8))]);
   let out=fill(smooth(top,.3)+`L${f1(x1+2)} ${f1(y+2.6)}Q${f1((x0+x1)/2)} ${f1(y+4.4)} ${f1(x0-2)} ${f1(y+2.6)}Z`,'foam',.92);
   const B=Batch();
   for(let i=0,m=Math.max(2,Math.round((x1-x0)/8));i<m;i++){
     const x=R(x0+1,x1-7),yy=y+R(-3.4,1),rr=R(2.2,4);
     B.mark(i%2?'ripple':'fallline',`M${f1(x)} ${f1(yy)}a${f1(rr)} ${f1(rr*.7)} 0 0 1 ${f1(rr*1.8)} ${f1(J(.6))}`,1.1,.8);
   }
   return out+B.out();};
  for(const [y0,y1,l,r,bl,br] of sheets){
   const h=y1-y0,w=r-l,cx=(l+r)/2,tp=taper(l,r);
   const lip=[[l-bl*.4,y0+2],[l+w*.25,y0-1.2],[cx,y0-2.2],[r-w*.25,y0-1.2],[r+br*.4,y0+2]];
   const bottom=[];const nb=Math.max(4,Math.round(w/7));for(let i=0;i<=nb;i++){const x=r-tp-(w-2*tp)*i/nb;bottom.push([x+J(1.2),y1-(i%2?R(3.5,6):R(-1,1.5))]);}
   const body=[...lip,[r+br*.6,y0+h*.28],[r-tp*.4,y0+h*.7],...bottom,[l+tp*.4,y0+h*.7],[l-bl*.6,y0+h*.28]];
   mid+=wash(loop(body,.3,0),'water')+fill(loop([[l+w*.3,y0+3],[r-w*.3,y0+3],[r-w*.36,y1-4],[cx,y1-2],[l+w*.36,y1-4]],.3,0),'water2',.78);
   // the sheet's edges as the water falls away from the rock, and spray rising where it lands
   mid+=ink(smooth([[l-bl*.4,y0+2.4],[l-bl*.6,y0+h*.3],[l+tp*.5,y0+h*.72],[l+tp+1,y1-2]],.3),1,.42)+ink(smooth([[r+br*.4,y0+2.4],[r+br*.6,y0+h*.3],[r-tp*.5,y0+h*.72],[r-tp-1,y1-2]],.3),1,.42);
   {
     const S=Batch();
     for(let i=0,m=Math.max(4,Math.round(w/9));i<m;i++){
       const sx=R(l+tp,r-tp),sy=y1-R(3,9);
       S.fill('foam',dab(sx,sy,R(.9,1.8)),.9);
       if(i%2)S.mark('foam',`M${f1(sx-3)} ${f1(sy-1)}q3 ${f1(-R(2,4))} 6 0`,1,.8);
     }
     mid+=S.out();
   }
   mid+=fill(pth([[l-bl*.3,y0+2],[cx,y0-1.8],[r+br*.3,y0+2],[r-w*.12,y0+4.8],[cx,y0+3.4],[l+w*.12,y0+4.8]],true,.25),'foam',.9)+ink(smooth(lip,.3),1.5,.62);
   const B=Batch(),n=Math.max(6,Math.round(w/4.2));
   for(let i=0;i<n;i++){const u=R(-1,1),t=Math.sign(u)*Math.pow(Math.abs(u),.55),x=cx+t*(w/2-tp-1),side=t*(w*.06+1.5),len=h*R(.35,.95);
    B.mark(rnd()<.45?'ripple':'fallline',`M${f1(x)} ${f1(y0+1.5)}Q${f1(x+side)} ${f1(y0+3.5)} ${f1(x+side*.9)} ${f1(y0+Math.min(9,h*.35))}V${f1(Math.max(y0+Math.min(10,h*.4),Math.min(y1-3,y0+len)))}`,R(1,1.8),R(.6,.9));}
   mid+=B.out()+skirt(l+tp-2,r-tp+2,y1);}
  // the stone that parts the middle sheet, with its cap of moss
  mid+=piece([[STONE[0]-9,STONE[1]+6],[STONE[0]-8,STONE[1]-3],[STONE[0]-2,STONE[1]-8],[STONE[0]+6,STONE[1]-7],[STONE[0]+9,STONE[1]+1],[STONE[0]+6,STONE[1]+7]],'rock',1.6,.85,.3)+
    fill(loop([[STONE[0]-7,STONE[1]-3],[STONE[0]-1,STONE[1]-8.4],[STONE[0]+6,STONE[1]-7],[STONE[0]+2,STONE[1]-4]],.2,0),'moss',.95)+
    mark(`M${f1(STONE[0]-6)} ${f1(STONE[1]+2)}q3 -2 6 -1`,'water3',1.6,.9);
  // the plunge pool at its foot: broken short arcs of foam in two tones around where the water lands, and broken rings
  // spreading from it (no round blobs)
  {const P=ring(920,HZ+76,150,15,18,.04);mid+=fill(pth(P,true,1.2),'water')+fill(pth(ring(918,HZ+79,104,8,14,.06),true,1),'water2',.7)+ink(pth(P.slice(9).concat(P.slice(0,1)),false,1),1.4,.45);
   const B=Batch();
   for(let i=0;i<24;i++){
     const a=Math.PI*(1+i/23),rx=R(34,92),x=930+Math.cos(a)*rx,y=HZ+71+Math.sin(a)*-5+R(-2,5),l=R(6,15);
     B.mark(i%3?'foam':'fallline',`M${f1(x-l/2)} ${f1(y)}q${f1(l/2)} ${f1(-R(1.6,3.2))} ${f1(l)} ${f1(J(.8))}`,R(1.4,2.3),.88);
   }
   for(const [rx,ry,o] of [[24,4,.75],[42,6.5,.6],[64,9,.45]]){const Q=ring(936,HZ+70,rx,ry,16,.05);for(let k=0;k<16;k+=4)B.mark(k%8?'ripple':'foam',pth(Q.slice(k,k+3),false,.3),1.2,o);}
   for(let i=0;i<8;i++)B.mark('ripple',`M${f1(R(790,1040))} ${f1(R(HZ+80,HZ+88))}q8 -1.6 16 0`,1.1,.55);mid+=B.out();}
  const Lb=[[848,HZ+86],[800,HZ+124],[838,HZ+176],[712,HZ+236],[646,HZ+296],[600,HZ+340],[640,920]],Rb=[[994,HZ+86],[924,HZ+126],[968,HZ+180],[890,HZ+240],[870,HZ+300],[930,HZ+340],[1100,920]];
  const Ls=smooth(Lb,.6),Rs=smooth(Rb.slice().reverse(),.6);
  mid+=`<path class="f-water" d="${Ls}L${Rb[Rb.length-1][0]} ${Rb[Rb.length-1][1]}${Rs.replace(/^M[^C]*/,'')}Z"/>`;
  box('fall',742,HZ-14,1116,HZ+92);
  // banks: an ink edge, a wet dark line, pebbles and grass leaning over the water
  mid+=ink(Ls,2,.6)+ink(smooth(Rb,.6),2,.6)+mark(smooth(Lb.map(([x,y])=>[x+6,y+4]),.6),'water2',4,.7)+mark(smooth(Rb.map(([x,y])=>[x-6,y+4]),.6),'water2',4,.7);
  {
    const B=Batch();
    for(let i=0;i<70;i++){
      const t=rnd(),
        side=rnd()<.5?Lb:Rb,
        idx=Math.min(side.length-2,Math.floor(t*(side.length-1))),
        k=t*(side.length-1)-idx,
        [ax,ay]=side[idx],
        [bx,by]=side[idx+1],
        x=ax+(bx-ax)*k+(side===Lb?-R(2,14):R(2,14)),
        y=ay+(by-ay)*k,
        r=R(1.5,4.5);
      B.fill(pick(['rock','rock2']),`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(r*.7)} 0 1 0 ${f1(r*2)} 0a${f1(r)} ${f1(r*.7)} 0 1 0 ${f1(-r*2)} 0`);
    }
   // the current's marks, only between the banks
   for(let i=0,n=0;n<46&&i<600;i++){
     const y=R(HZ+96,912),l=R(14,30),x=R(560,1100);
     if(x<bankX(Lb,y)+6||x+l>bankX(Rb,y)-6)continue;
     n++;
     B.mark(rnd()<.4?'water3':'ripple',`M${f1(x)} ${f1(y)}q${f1(l*.4)} ${f1(R(2,5))} ${f1(l)} ${f1(R(3,7))}`,1.6,.6);
   }
   mid+=B.out();}
  // the plank footbridge downstream of the pool, where the stream has settled; stepping stones further down still
  mid2+=footbridge(716,HZ+206,300,SH);box('bridge',712,HZ+146,1022,HZ+226);box('bridge-legs',786,HZ+226,940,HZ+250);
  for(const [x,y,w] of [[676,HZ+284,48],[740,HZ+290,46],[802,HZ+282,44]]){
    mid2+=boulder(x,y,w,26,{tok:'rock',wet:true},null)+ink(pth([[x-6,y+3],[x+w+6,y+3]],false,.6),1.2,.5);
    box('stone',x-2,y-26,x+w+2,y+4);
  }
  // near ground: the nearer grass on both banks, never over the water
  {
    const at=(side,y,d)=>bankX(side,y)+d;
    near+=fill(pth([[-20,790],[300,776],[560,792],[at(Lb,800,-3),800],[at(Lb,850,-3),850],[at(Lb,920,-3),920],[-20,920]],true,1),'ground2',.7)+
      fill(pth([[at(Rb,786,3),786],[1100,784],[1460,780],[1460,920],[at(Rb,920,3),920],[at(Rb,850,3),850]],true,1),'ground2',.7);
  }
  // the near boulder sits just right of the two birch trunks (they end at 112), never behind them
  near+=boulder(122,866,128,70,{moss:true},SH)+boulder(1176,852,142,72,{moss:true},SH)+boulder(470,880,70,30,{},SH);box('boulder',120,796,252,866);
  {
    const B=Batch();
    fern(B,330,876,1.15);
    fern(B,1100,884,1.1);
    fern(B,292,806,.85);
    fern(B,1330,812,.8);
    grassField(B,0,W,780,890,70);
    flowers(B,200,620,820,880,22,['fl1','fl3','fl4']);
    for(let i=0;i<16;i++)tuft(B,R(0,W),R(780,894),R(14,24));
    for(let i=0;i<6;i++)pinecone(B,R(1180,1400),R(870,892));
    near+=B.out();
  }
  near+=notebook(428,816,5)+fallenLog(1006,830,146,24,SH);box('notebook',424,786,506,825);box('log',1004,804,1160,834);
  // on the left bank, clear of the birches: Biscuit, the kettle by his nose, then the lantern post
  near+=lanternPost(440,730);box('lanternpost',436,612,467,730);
  A.push(actor('fr-lpool',356,708,200,48,lanternPool(100,24,94,16)));
  A.push(actor('fr-lantern',436,602,60,80,lanternArt()));box('lantern',452,612,480,663);
  {const bx=150,by=604,[kx,ky]=kettleAt(bx,by);
   A.push(actor('fr-kettle',kx,ky,70,60,kettleArt()+`<g class="fr-steam" transform="translate(58 -10)">${steamArt()}</g>`));
   A.push(actor('fr-biscuit',bx,by,230,150,ponyArt()));biscuitBoxes(bx,by);kettleBox(kx,ky);SH.cast(bx+104,736,150,12);}
  // the meadow between the woods and the stream: bushes, tall flowers, tufts (never on the water)
  mid2+=bush(620,HZ+98,26,{tok:'tree1',flowers:'fl4',n:3})+bush(1182,HZ+112,30,{flowers:'fl1'})+bush(1334,HZ+98,24,{tok:'tree3',flowers:'fl3',n:3});
  {const B=Batch(),dry=(x,y)=>x<bankX(Lb,y)-18||x>bankX(Rb,y)+18;for(let i=0;i<40;i++){const x=R(180,1420),y=R(HZ+76,HZ+150);if(!dry(x,y)||(x>720&&x<1130&&y<HZ+100))continue;tuft(B,x,y,R(10,18));}
   for(let i=0;i<36;i++){
     const x=R(470,1420),y=R(HZ+80,HZ+150);
     if(!dry(x,y)||(x>720&&x<1130&&y<HZ+100))continue;
     const t=pick(['fl1','fl3','fl4','fl4']);
     B.mark('grass',`M${f1(x)} ${f1(y)}q${f1(J(2))} -8 ${f1(J(3))} -16`,1,.7);
     B.fill(t,dab(x+J(1),y-16,R(1.8,2.8)));
   }
   mid2+=B.out();
  }
  // by the path to the water, a mossy stump with the creel and the rod: someone fishes here
  near+=creelStump(520,772);box('stump',518,738,606,776);
  {const B=Batch();flowers(B,600,740,742,790,12,['fl1','fl3','fl4']);for(let i=0;i<4;i++)tuft(B,R(612,720),R(752,792),R(14,22));near+=B.out();}
  // the kingfisher's branch over the water at the right
  front+=limbFrom([[1466,520],[1404,537],[1344,550],[1290,558.6],[1236,562]],13,3,{leaves:52});
  A.push(actor('fr-kingfisher',1262,516,70,50,kingfisherArt()));
  // where the kingfisher goes in: the open water between the pool and the footbridge
  WA.push(actor('fr-splash fr-end-splash',812,652,120,50,ringArt({fish:false,drops:true})));box('water-life',826,660,930,688);
  front+=birchTree(40,900,560,{lean:.03,leaves:760},SH)+birchTree(96,886,440,{lean:-.02,leaves:480,io:.8},SH)+bush(1404,900,72);
  box('birch-trunk',22,330,58,900);box('birch-trunk',80,446,112,886);
  {const B=Batch();grassField(B,0,300,860,900,26,{h:[18,34]});grassField(B,1180,W,860,900,22,{h:[18,30]});fringe(B,{from:0,to:560});fringe(B,{from:1060,to:W});front+=B.out();}
  const light=[shafts([[120,36,520,84,780,1],[214,24,640,60,780,.8],[60,20,330,52,780,.7]],.22),fill(pth([[1000,HZ+60],[1440,HZ+30],[1440,HZ+90],[900,HZ+120]],true,4),'light',.24)];
  // the fall: falling strands over each sheet (each clipped to its own sheet) and the foam where it lands, always moving
  sheets.forEach(([y0,y1,l,r])=>{
    const tp=taper(l,r),w=Math.round(r-l-2*tp-2),h=Math.round(y1-y0-9);
    WA.push(actor('fr-fall',l+tp+1,y0+7,w,h,(()=>{
      const B=Batch(),n=Math.max(5,Math.round(w/5));
      for(let i=0;i<n;i++){
        const u=R(-1,1),t=Math.sign(u)*Math.pow(Math.abs(u),.6),x=w/2+t*(w/2-1),off=R(0,44);
        for(let k=-1;k<3;k++){const y=k*44+off;B.mark(i%3?'fallline':'ripple',`M${f1(x)} ${f1(y)}v${f1(R(8,22))}`,R(1.1,2),.8);}
      }
      return `<g class="fr-fallstrands">${B.out()}</g>`;
    })()));
  });
  // the foam where the falls land keeps moving: two sets of broken arcs that take turns
  const curls=()=>{
    const B=Batch();
    for(let i=0;i<20;i++){const x=R(14,166),y=R(10,30),l=R(6,13);B.mark(i%3?'foam':'fallline',`M${f1(x-l/2)} ${f1(y)}q${f1(l/2)} ${f1(-R(1.6,3))} ${f1(l)} ${f1(J(.8))}`,R(1.4,2.2),.9);}
    return B.out();
  };
  WA.push(actor('fr-foam',840,HZ+56,180,40,`<g class="fr-shim s1">${curls()}</g><g class="fr-shim s2">${curls()}</g>`));
  WA.push(shimmer(600,HZ+110,500,250,90,{inside:(x0,x1,y)=>x0>bankX(Lb,y)+4&&x1<bankX(Rb,y)-4}));
  // in the open water between the pool and the footbridge, so the leaping fish stays in sight
  WA.push(actor('fr-ring fr-start-life',812,652,120,40,ringArt({place:'stream'})));
  return finish('stream',night,{far,mid,mid2,near,front,SH,light,A,WA,clouds:[[26,160,280,-60,.9],[14,190,320,-200,.85],[44,120,260,-130,.75]]});
 }
 function bridge(x,y,w,night,SH){
  let s='';const B=Batch();
  for(let i=0;i<6;i++){const px=x+30+i*(w-60)/5,py=y+8-i*3;s+=post(px,py+36,48,8,.85);}
  planks(B,x,y,x+w,y-18,14,22,.85);s+=B.out();
  s+=ink(pth([[x,y],[x+w,y-18]],false,.5),2,.9)+fill(pth([[x,y+14],[x+w,y-4],[x+w,y+2],[x,y+20]],true,.5),'wood3',.9)+ink(pth([[x,y+14],[x+w,y-4]],false,.5),1.6,.8);
  for(let i=0;i<6;i++){const px=x+30+i*(w-60)/5,py=y-i*3.4;s+=post(px,py,40,6,.85);}
  s+=ink(pth([[x+20,y-40],[x+w*.5,y-52],[x+w-20,y-62]],false,1),3,.85)+mark(pth([[x+20,y-40],[x+w*.5,y-52],[x+w-20,y-62]],false,1),'wood',1.6,.9);
  s+=ink(pth([[x+20,y-22],[x+w*.5,y-32],[x+w-20,y-42]],false,1),1.8,.7);
  SH?.cast(x+w*.5,y+40,w*.3,8);
  return s;
 }
 function rain(night){
  seed=3303;const SH=Shadows({light:[1096,642]}),A=[],WA=[];let far='',mid='',near='',front='';
  // the gravel path's edges, so grass grows beside it and not across it
  const PL=[[700,HZ+78],[650,HZ+130],[540,920]],PR=[[764,HZ+78],[790,HZ+130],[910,920]],onPath=(x,y)=>y>HZ+70&&x>bankX(PL,y)-8&&x<bankX(PR,y)+8;
  far+=range(HZ-40,'mtnfar',.24,{peaks:[180,260],rise:[50,124],shade:.07,tall:[480,960,132]});
  // low cloud lying on the hills in long drawn wisps, layer over layer
  far+=wisps([[-40,HZ-66,520,22,.78],[380,HZ-84,560,26,.72],[860,HZ-62,640,24,.8],[200,HZ-40,420,18,.6],[980,HZ-44,500,18,.6]]);
  far+=fill(pth([[-20,HZ-8],[500,HZ-26],[1000,HZ-12],[1460,HZ-24],[1460,HZ+60],[-20,HZ+60]],true,2),'hill');
  far+=woods(HZ+8,{gap:[10,20],h:[26,60],io:.38});
  far+=wisps([[-60,HZ+10,460,16,.72],[330,HZ+4,520,18,.66],[800,HZ+12,700,16,.72]]);
  mid+=fill(pth([[-20,HZ+58],[1460,HZ+48],[1460,920],[-20,920]],true,2),'ground');
  // a low garden wall far back, then the gravel path leading in, with its puddles
  mid+=stoneWall(HZ+64,[692,772]);
  mid+=fill(loop([[540,924],[595,HZ+250],[650,HZ+130],[700,HZ+78],[764,HZ+78],[790,HZ+130],[852,HZ+250],[910,924]],.6,0),'path');
  mid+=whole(()=>{
    const B=Batch();
    for(const side of [PL,PR])
      for(let y=HZ+84;y<912;y+=R(14,24)){const x=bankX(side,y)+(side===PL?-1:1)*R(0,5),r=R(2.6,4.8),d=pth(ring(x,y,r,r*.62,6,.1),true,.3);B.fill(pick(['rock','rock2']),d);B.ink(d,.8,.4);}
    return B.out();
  });
  {
    const B=Batch();
    for(let i=0;i<180;i++){
      const t=rnd(),y=HZ+90+t*(920-HZ-90),half=34+t*170,x=732+R(-half,half),r=R(1,2.6)*(.6+t);
      B.fill(pick(['rock','rock2','sand2']),`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(r*.7)} 0 1 0 ${f1(r*2)} 0a${f1(r)} ${f1(r*.7)} 0 1 0 ${f1(-r*2)} 0`);
    }
    mid+=B.out();
  }
  mid+=ink(smooth([[540,920],[650,HZ+130],[700,HZ+78]],.6),1.6,.45)+ink(smooth([[764,HZ+78],[790,HZ+130],[910,920]],.6),1.6,.45);
  const puddles=[[648,826,78],[770,744,50],[706,692,36]];
  for(const [x,y,r] of puddles){mid+=puddle(x,y,r);
   WA.push(actor('fr-rings',x-r,y-r*.32,r*2,r*.64,[0,1,2].map(i=>`<g class="fr-pring" style="--i:${i};transform-origin:${f1(r*(.6+i*.35))}px ${f1(r*.32)}px">${ink(pth(ring(r*(.6+i*.35),r*.32,r*.3,r*.09,12),true,.3),1.1,.7)}</g>`).join('')));}
  // the hydrangeas: heads made of many small four-petal florets, leaves with veins
  {for(let i=0;i<6;i++){const hx=[70,150,230,120,300,40][i],hy=[812,836,808,872,858,872][i];mid+=hydrangea(hx,hy,R(32,44),i%2?'hyd2':'hyd1');}}
  mid+=boulder(372,832,96,46,{moss:true,wet:true},SH)+wateringCan(486,876)+snail(286,624);box('rock',368,786,470,834);box('can',484,822,562,880);
  A.push(actor('fr-frog',384,778,60,40,frogArt()));
  // the pavilion: tiled roof, beams, posts with grain, floor boards, the lantern on its beam, Biscuit asleep under it
  mid+=pavilion(860,780,night,SH,396)+notebook(1158,776,3);box('notebook',1154,746,1236,785);
  // the lantern hangs over Biscuit's back, clear of his head when he stands
  A.push(actor('fr-lpool',820,756,220,40,lanternPool(110,20,104,12)));
  A.push(actor('fr-lantern',900,600,60,80,lanternArt()));box('lantern',916,610,944,661);
  {const bx=872,by=632,[kx,ky]=kettleAt(bx,by);
   A.push(actor('fr-kettle',kx,ky,70,60,kettleArt()+`<g class="fr-steam" transform="translate(58 -10)">${steamArt()}</g>`));
   A.push(actor('fr-biscuit',bx,by,230,150,ponyArt()));biscuitBoxes(bx,by);kettleBox(kx,ky);}
  // the blue umbrella set down open on the grass beside the path, to dry
  mid+=umbrellaDown(476,780);box('umbrella',470,700,604,794);
  near+=fill(pth([[-20,860],[400,850],[900,866],[1460,852],[1460,920],[-20,920]],true,3),'ground2',.7);
  {
    const B=Batch();
    grassField(B,0,W,800,895,60,{skip:onPath});
    flowers(B,40,520,850,890,14,['fl3','fl4']);
    for(let i=0;i<12;i++){const x=R(0,W),y=R(800,894);if(!onPath(x,y))tuft(B,x,y,R(14,24));}
    near+=B.out();
  }
  front+=birchTree(1414,904,430,{lean:-.02,leaves:420,reachL:.45,crown:.8},SH);box('birch',1336,470,1440,904);
  {const B=Batch();fern(B,1220,904,1);grassField(B,0,360,866,900,22,{h:[18,30]});fringe(B,{from:0,to:520});fringe(B,{from:960,to:W});front+=B.out();}
  // a break in the cloud lets down two slender shafts in the afternoon
  const light=['',shafts([[1150,30,880,70,HZ-10,1],[1236,18,1010,46,HZ-10,.7]],.16)];
  // roof drips, the two depths of rain
  A.push(actor('fr-drips',852,590,430,200,[0,1,2,3,4,5].map(i=>`<g class="fr-drip" style="--i:${i};translate:${18+i*78}px 0">${fill('M0 0q-3 6 0 8q3 -2 0 -8z','rain')}</g>`).join('')));
  A.push(rainLayer('fr-rain fr-rain-far',300,1.1,.55,[16,24]));
  A.push(rainLayer('fr-rain fr-rain-near',150,1.6,.75,[22,34]));
  // centred on the big puddle at (648,826)
  WA.push(actor('fr-ring fr-start-life',588,806,120,40,ringArt({fish:false})));
  return finish('rain',night,{far,mid,near,front,SH,light,A,WA,overcast:true,clouds:[[8,300,240,-30,.95],[46,260,300,-160,.9],[392,320,260,-90,.85],[0,240,320,-240,.9],[430,240,220,-60,.8]]});
 }
 function pavilion(px,py,night,SH,w=250){
  const c=px+w/2+5,k=w/250;
  let s=fill(pth([[px-30,py+4],[px+w+40,py+4],[px+w+50,py+14],[px-24,py+16]],true,1),'shade',.6);
  // floor boards
  const B=Batch();planks(B,px-20,py-6,px+w+30,py-6,14,Math.round(14*k),.8);s+=B.out()+ink(pth([[px-20,py-6],[px+w+30,py-6]],false,.5),1.6,.8);
  for(const ox of [0,w])s+=post(px+ox,py,192,10,.9);
  // the back posts, further in and fainter
  for(const ox of [34,w-30])s+=post(px+ox,py-8,176,7,.55);
  s+=ink(pth([[px-14,py-120],[px+w+16,py-122]],false,.6),3,.85)+mark(pth([[px-14,py-120],[px+w+16,py-122]],false,.6),'wood2',1.6,.9);
  s+=ink(`M${px} ${py-150}l30 30M${px+w} ${py-150}l-30 30`,2.4,.8);
  // the roof: a curved hip roof with rows of tiles
  const roof=[[px-50,py-198],[c-90*k,py-238],[c,py-266],[c+90*k,py-238],[px+w+60,py-198],[px+w+40,py-186],[px-30,py-186]];
  s+=shape(roof,'roof',2.4,.9);
  const T=Batch();for(let r=0;r<4;r++){const y=py-196-r*16,half=(170-r*30)*k;for(let x=c-half;x<c+half;x+=16)T.ink(`M${f1(x)} ${f1(y)}q8 6 16 0`,1,.5);}
  T.fill('roof2',pth([[px-30,py-186],[px+w+40,py-186],[px+w+46,py-194],[px-36,py-194]],true,.6),.9);
  for(let x=px-24;x<px+w+36;x+=R(15,19)){T.fill('wood3',`M${f1(x)} ${f1(py-186)}h5v5h-5z`,.9);T.ink(`M${f1(x)} ${f1(py-186)}v5h5v-5`,.8,.6);}
  T.mark('roof2',pth([[c-88*k,py-239],[c,py-267],[c+88*k,py-239]],false,.5),3.4,.95);s+=T.out();
  s+=ink(pth([[c,py-266],[c,py-280]],false,.4),2,.8)+blob(c,py-284,5,5,'iron',1.4,.8,8);
  SH?.cast(c,py,180*k,12);
  box('pavilion-post',px-5,py-192,px+5,py);box('pavilion-post',px+w-5,py-192,px+w+5,py);box('roof',px-50,py-288,px+w+60,py-186);
  return s;
 }
 const RAIN_P=180;
 function rainLayer(cls,n,w,o,len){
  // the drops repeat every RAIN_P px down the sheet, and the sheet is only that much taller than the screen: it falls
  // RAIN_P px a loop instead of a whole screen, so each sheet is 1440 x 1080, not 1440 x 1800 (the compositor moved
  // two 2.6 Mpx sheets every frame, the one place that dropped frames standing still); the same drops per screen
  const B=Batch(),per=Math.round(n*RAIN_P/H);for(let i=0;i<per;i++){const x=R(-60,W),y=R(0,RAIN_P),l=R(...len);B.mark('rain',`M${f1(x)} ${f1(y)}l${f1(-l*.22)} ${f1(l)}`,w,o);}
  const tile=B.out(),rows=Math.ceil(H/RAIN_P)+1;return `<div class="${cls}"><svg viewBox="0 0 ${W} ${rows*RAIN_P}" width="${W}" height="${rows*RAIN_P}" aria-hidden="true" focusable="false">${Array.from({length:rows},(_,k)=>k?`<g transform="translate(0 ${k*RAIN_P})">${tile}</g>`:tile).join('')}</svg></div>`;
 }
 function fire(){
  seed=4404;const SH=Shadows({light:[720,800],reach:1800}),A=[];let far='',mid='',near='',front='';
  far+=range(HZ-34,'mtnfar',.36,{peaks:[150,240],rise:[40,110],shade:.08});
  far+=fill(pth([[-20,HZ-4],[1460,HZ-12],[1460,HZ+60],[-20,HZ+60]],true,2),'hill');
  far+=woods(HZ+12,{gap:[8,16],h:[40,96],io:.5});
  // the clearing's edge: a nearer row of firs, lower behind the fire, each touched by its light on the side facing it
  far+=edgeFirs(HZ+58);
  mid+=fill(pth([[-20,HZ+50],[1460,HZ+44],[1460,920],[-20,920]],true,2),'ground');
  // the ground the camp has worn: a ring of trodden earth around the fire, ash nearer in
  mid+=fill(lobe(720,814,330,92,22),'path',.5)+fill(lobe(712,812,236,62,18),'path',.45)+fill(lobe(726,810,150,36,16),'ash',.3);
  {const B=Batch();
   // fallen needles, twigs and cones scattered over everything
   for(let i=0;i<420;i++){const x=R(-10,W+10),y=R(HZ+52,900),l=R(4,9),a=R(0,Math.PI);B.mark(rnd()<.5?'wood3':'wood2',`M${f1(x)} ${f1(y)}l${f1(Math.cos(a)*l)} ${f1(Math.sin(a)*l*.4)}`,.9,.55);}
   for(let i=0;i<26;i++){
     const x=R(20,W-20),y=R(HZ+70,896),l=R(14,32),d=rnd()<.5?1:-1,dy=J(4);
     B.mark('wood2',`M${f1(x)} ${f1(y)}l${f1(d*l)} ${f1(dy)}`,1.8,.9);
     B.ink(`M${f1(x)} ${f1(y)}l${f1(d*l)} ${f1(dy)}`,.6,.5);
     const t=R(.3,.7);
     B.mark('wood2',`M${f1(x+d*l*t)} ${f1(y+dy*t)}l${f1(d*R(5,9))} ${f1(-R(3,7))}`,1.1,.85);
   }
   for(let i=0;i<9;i++)pinecone(B,R(1180,1420),R(860,894));for(let i=0;i<5;i++)pinecone(B,R(20,200),R(860,894));for(let i=0;i<10;i++)pinecone(B,R(200,1240),R(HZ+80,780));
   for(let i=0;i<16;i++){const x=R(0,W),y=R(HZ+60,800);if(Math.abs(x-720)<300&&y>720)continue;tuft(B,x,y,R(10,18),'grass',.55);}
   mid+=B.out();}
  // the firelight lying on the clearing: uneven flat washes of different shapes, never rings and never a gradient
  A.push(`<div class="fr-firelight" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" focusable="false">`+glowPool(720,800,[[700,230,.07],[470,160,.08],[300,100,.11],[150,52,.15]],'glow',9)+`</svg></div>`);
  // the camp's things stand over the firelight lying on the ground, so they keep their own colour and line
  near+=tent(110,764,SH);
  // a woodpile with kindling split ready, a stump with an axe, a pot hanging from its tripod over a few coals
  near+=woodpile(1187,800,3)+kindling(472,814)+stump(436,746)+tripodPot(588,812)+campKit(286,826);
  box('woodpile',1172,728,1262,812);box('kindling',456,766,534,823);box('stump',434,634,524,748);box('tripod',546,706,632,820);box('campkit',284,812,370,832);box('tent',40,600,390,782);box('peg',434,762,446,782);
  SH.cast(1216,800,90,10);SH.cast(502,814,60,6);SH.cast(471,748,70,8);SH.cast(588,814,70,8);SH.cast(326,828,80,6);
  near+=campfireBase(720,800);
  A.push(actor('fr-flame-a',665,682,110,130,flameArt()));
  A.push(actor('fr-sparks',640,560,160,160,Array.from({length:7},(_,i)=>`<g class="fr-spark" style="--i:${i};translate:${f1(40+R(0,80))}px 0">${fill('M0 150a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0','ember')}</g>`).join('')));
  A.push(fireWispActor(724,684));
  A.push(actor('fr-kettle fr-kettle-fire',776,744,70,60,kettleArt()+`<g class="fr-steam" transform="translate(58 -10)">${steamArt()}</g><g class="fr-jet" transform="translate(66 22)">${steamArt(5,6)}</g>`));
  near+=logSeat(470,850,140,SH)+logSeat(862,866,136,SH);
  near+=lanternPost(1116,800);box('lanternpost',1112,682,1143,800);
  A.push(actor('fr-lpool',1042,778,200,44,lanternPool(100,22,76,13)));
  A.push(actor('fr-lantern',1112,672,60,80,lanternArt()));box('lantern',1128,682,1156,733);
  A.push(actor('fr-biscuit',892,640,230,150,ponyArt()));biscuitBoxes(892,640);kettleBox(776,744);
  {const B=Batch();grassField(B,0,W,800,895,46,{tok:'grass',o:.6,skip:(x,y)=>Math.abs(x-720)<250&&y<860});for(let i=0;i<10;i++)tuft(B,R(0,W),R(800,894),R(12,20),'grass',.6);near+=B.out();}
  // tall pines framing the clearing, an owl on a branch
  front+=pine(1430,904,440,SH)+pine(62,890,380,SH)+pine(-30,900,300,SH);box('pine',1278,464,1440,904);
  {const B=Batch();fringe(B,{o:.7});front+=B.out();}
  front+=ink(pth([[1426,530],[1356,534],[1302,526]],false,.6),4,.85)+mark(pth([[1426,532],[1356,536]],false,.6),'bark',1.6,.7);
  {const B=Batch();for(let i=0;i<9;i++){const x=R(1306,1416),y=528+J(3);B.mark('tree1',`M${f1(x)} ${f1(y)}l${f1(J(5))} ${f1(R(6,12))}`,1.4,.85);}front+=B.out();}
  A.push(actor('fr-owl',1328,466,70,80,owlArt()));
  const light=[glowPool(720,790,[[260,90,.12]],'glow',4),glowPool(716,792,[[196,66,.1]],'glow',3)];
  A.push(actor('fr-ring fr-start-life',650,560,160,160,Array.from({length:6},(_,i)=>`<g class="fr-burst" style="--i:${i};translate:${f1(60+R(0,40))}px 0">${fill('M0 150a2 2 0 1 0 4 0a2 2 0 1 0 -4 0','ember')}</g>`).join('')));
  return finish('fire',true,{far,mid,near,front,SH,light,A,clouds:[[10,220,360,-80,.4],[30,160,420,-260,.35]]});
 }
 // How much of the fire's warmth reaches a thing at x (flat wash opacity), and which side faces it.
 const warmth=x=>Math.max(.06,.3-Math.abs(x-720)/3000),facing=x=>x<720?1:-1;
 // A canvas tent seen three-quarters on, its door toward the fire: a ridge sagging between the poles, folds hanging
 // across the side, the ground sheet's edge, pegs and cord loops, the door flap rolled and tied, a sleeping bag in the
 // lamplit inside.
 function tent(x,y,SH){
  const A=[x+180,y-120],BL=[x+112,y],BR=[x+248,y],Ra=[x+56,y-110],RL=[x-10,y-6];
  let s=fill(pth([[x-60,y+4],[x+270,y+4],[x+280,y+14],[x-50,y+16]],true,1),'shade',.6);
  s+=fill(pth([[x+130,y+4],[x+260,y+6],[x+300,y+46],[x+120,y+50]],true,2),'glow',.16);
  // the ground sheet, showing a hand's width in front
  s+=shape([[x+100,y-1],[x+258,y-1],[x+266,y+7],[x+94,y+8]],'tent2',1.3,.85,.6);
  // the side panel, shaded, with the sag of the ridge and the folds between the poles
  const ridge=`M${A[0]} ${A[1]}Q${f1((A[0]+Ra[0])/2)} ${f1((A[1]+Ra[1])/2+12)} ${Ra[0]} ${Ra[1]}`;
  const side=pth([A,[(A[0]+Ra[0])/2,(A[1]+Ra[1])/2+6],Ra,RL,[x+50,y-3],BL],true,1);s+=wash(side,'tent')+fill(side,'tent2',.55)+ink(side,2.2,.95);
  s+=ink(ridge,2.4,.95);
  const B=Batch();
  for(const [t,dip] of [[.25,10],[.5,14],[.75,10]]){const rx=A[0]+(Ra[0]-A[0])*t,ry=A[1]+(Ra[1]-A[1])*t+Math.sin(t*Math.PI)*6,bx=BL[0]+(RL[0]-BL[0])*t,by=BL[1]+(RL[1]-BL[1])*t;
   B.ink(`M${f1(rx)} ${f1(ry+2)}Q${f1((rx+bx)/2-dip)} ${f1((ry+by)/2)} ${f1(bx)} ${f1(by-1)}`,1.1,.55);B.fill('tent2',`M${f1(rx)} ${f1(ry+2)}Q${f1((rx+bx)/2-dip)} ${f1((ry+by)/2)} ${f1(bx)} ${f1(by-1)}l-6 0Q${f1((rx+bx)/2-dip-8)} ${f1((ry+by)/2)} ${f1(rx-3)} ${f1(ry+4)}z`,.7);}
  for(let k=1;k<4;k++){const t=k/4;B.ink(`M${f1(A[0]+(BL[0]-A[0])*t)} ${f1(A[1]+(BL[1]-A[1])*t)}Q${f1((A[0]+Ra[0])/2+(BL[0]+RL[0]-A[0]-Ra[0])/2*t)} ${f1((A[1]+Ra[1])/2+12+(BL[1]+RL[1]-A[1]-Ra[1])/2*t+8)} ${f1(Ra[0]+(RL[0]-Ra[0])*t)} ${f1(Ra[1]+(RL[1]-Ra[1])*t)}`,.8,.32);}
  // a patch sewn on the side, stitched round
  B.fill('tent',pth([[x+60,y-40],[x+82,y-42],[x+83,y-26],[x+61,y-24]],true,.4),.95);B.ink(pth([[x+60,y-40],[x+82,y-42],[x+83,y-26],[x+61,y-24]],true,.4),1,.7);
  for(let k=0;k<6;k++)B.ink(`M${f1(x+62+k*3.4)} ${f1(y-38-k*.1)}l1.4 0`,.7,.6);
  s+=B.out();
  // the front, lit by the fire on its right half
  const front=pth([A,BR,BL],true,.8);s+=wash(front,'tent')+fill(pth([A,BR,[x+200,y],[A[0]+6,A[1]+30]],true,.8),'glow',.2)+ink(front,2.4,.95);
  s+=ink(`M${BL[0]+4} ${BL[1]-4}L${A[0]-1} ${A[1]+6}M${BR[0]-4} ${BR[1]-4}L${A[0]+1} ${A[1]+6}`,1,.4);
  // the door open on the lamplight, a sleeping bag lying inside
  const door=pth([[A[0],A[1]+20],[A[0]+34,y],[A[0]-34,y]],true,.6);s+=wash(door,'tentlit')+fill(pth([[A[0],A[1]+44],[A[0]+22,y],[A[0]-22,y]],true,.6),'glowcore',.75)+ink(door,1.8,.9);
  const bag=pth([[A[0]-26,y-14],[A[0]+18,y-20],[A[0]+30,y-2],[A[0]-30,y-1]],true,.6);s+=wash(bag,'bag')+ink(bag,1.3,.85);
  for(let k=1;k<4;k++)s+=ink(`M${f1(A[0]-26+k*13)} ${f1(y-15-k*1.5)}q-2 7 -1 13`,.8,.55);
  s+=blob(A[0]+22,y-12,7,5,'bagend',1.1,.8,8);
  // the flap rolled up the door's left edge and tied twice
  const roll=pth([[A[0]-3,A[1]+18],[A[0]+3,A[1]+22],[A[0]-30,y-2],[A[0]-40,y-3]],true,.5);s+=wash(roll,'tent')+fill(roll,'tent2',.35)+ink(roll,1.6,.9)+ink(pth(ring(A[0]-35,y-3,5,3,8),true,.3),1,.7);
  for(const t of [.35,.7]){const tx=A[0]-1+(-36)*t,ty=A[1]+20+(y-2-A[1]-20)*t;s+=mark(`M${f1(tx-6)} ${f1(ty-3)}l12 5`,'rope',2.2,.95)+ink(`M${f1(tx+6)} ${f1(ty+2)}q5 4 2 9M${f1(tx+6)} ${f1(ty+2)}q7 1 8 7`,1,.75);}
  // the seam down the front, the poles' tips above the ridge
  for(let k=0;k<5;k++)s+=ink(`M${f1(A[0]+.3)} ${f1(A[1]+3+k*3.4)}v1.6`,.8,.55);
  s+=ink(`M${A[0]} ${A[1]}l1 -16M${Ra[0]} ${Ra[1]}l-1 -14`,2.6,.95)+blob(A[0]+1,A[1]-17,2.4,2.2,'iron',1,.8,7);
  // guy lines out to pegs, a cord loop round each; small pegs along the side's foot
  const peg=(px,py)=>shape([[px-2.4,py-6],[px+2.4,py-6],[px+.8,py+5],[px-.8,py+5]],'wood',1.1,.9,.2)+ink(pth(ring(px,py-3,4.6,2,8),true,.3),1,.75);
  s+=ink(pth([[A[0]+1,A[1]-14],[x+330,y+6]],false,.6),1.2,.65)+peg(x+330,y+8)+ink(pth([[Ra[0]-1,Ra[1]-12],[x-80,y+4]],false,.6),1.2,.65)+peg(x-80,y+6);
  for(const t of [.12,.5,.88]){const px=RL[0]+(BL[0]-RL[0])*t,py=RL[1]+(BL[1]-RL[1])*t;s+=ink(`M${f1(px)} ${f1(py)}l-6 7`,1,.7)+peg(px-8,py+11);}
  SH?.cast(x+120,y+4,150,10);
  return s;
 }
 // Kindling split thin and stacked crosswise, ready to go on.
 function kindling(x,y){
  let s=fill(pth(ring(x+30,y+4,42,5,10),true,.6),'shade',.5);
  for(let r=0;r<4;r++){const yy=y-r*7;
   if(r%2===0){for(const dz of [0,1]){const by=yy-dz*2.6,d=pth([[x-2,by],[x+62,by-2],[x+62,by+4],[x-2,by+5]],true,.4);s+=wash(d,dz?'wood':'wood2')+ink(d,1,.85);}}
   else for(const cx of [x+5,x+30,x+55]){const d=pth(ring(cx,yy+1,4.4,3.2,7),true,.3);s+=wash(d,'wood')+ink(d,.9,.85)+ink(`M${f1(cx-1.6)} ${f1(yy+1)}h3.2`,.6,.5);}}
  s+=ink(`M${x-6} ${y-30}l-10 -16M${x-4} ${y-28}l-4 -18`,1.1,.7)+fill(pth([[x+40,y-26],[x+62,y-26],[x+60,y-22],[x+42,y-22]],true,.3),'glow',.25);
  return s;
 }
 // A tall pine: roots gripping the ground, the trunk showing between drooping, uneven layers of boughs, needles
 // hatched along their undersides, and the fire's warmth washed on the side that faces it.
 function pine(x,y,h,SH){
  const d0=facing(x),warm=warmth(x),tw=Math.max(5,h*.016),top=y-h;let s='';const B=Batch(),N=Batch();
  for(const [d,l] of [[-1,30],[1,34],[-.6,18],[.5,22]])B.ink(pth([[x+d*tw*.6,y-10],[x+d*l*.45,y-2+J(1)],[x+d*l+J(4),y+4]],false,.6),2.2,.8);
  const trunk=pth([[x-tw,y],[x-tw*.35,top+h*.04],[x+tw*.35,top+h*.04],[x+tw,y]],true,.6);s+=wash(trunk,'bark')+ink(trunk,1.8,.85);
  for(let i=0;i<Math.round(h/12);i++){const ty=y-R(4,h*.92),k=(y-ty)/h,ww=tw*(1-k*.65);B.ink(`M${f1(x-ww*.8)} ${f1(ty)}q${f1(ww*.8)} ${f1(R(1,3))} ${f1(ww*1.6)} 0`,.8,.5);}
  s+=fill(pth([[x+d0*tw*.2,y-4],[x+d0*tw,y-4],[x+d0*tw*.4,top+h*.1],[x+d0*tw*.1,top+h*.1]],true,.4),'glow',warm);
  s+=B.out();
  const tiers=Math.max(8,Math.round(h/30));
  for(let i=tiers-1;i>=0;i--){const k=i/(tiers-1),ty=top+h*(.06+.78*k),w=h*(.05+.27*k)*R(.85,1.15);
   for(const d of [-1,1]){if(k>.22&&k<.95&&rnd()<.16)continue;const droop=w*R(.28,.44),n=RI(4,6),lower=[];
    for(let j=1;j<=n;j++){const t=1-j/n;lower.push([x+d*w*t+J(2),ty+droop*t+7+(j%2?R(3,7):-1)]);}
    const pts=[[x,ty-4],[x+d*w*.35,ty-6-w*.04],[x+d*w*.75,ty+droop*.35],[x+d*w,ty+droop],...lower,[x+d*tw*.4,ty+6]];
    const dd=pth(pts,true,1);s+=wash(dd,pick(['tree1','tree2','tree3']))+ink(dd,1.3,.72);
    s+=fill(pth([...lower.slice(0,-1).map(([px,py])=>[px,py-1]),...lower.slice(0,-1).reverse().map(([px,py])=>[px+d*2,py-6])],true,.5),'treeshade',.5);
    if(d===d0)s+=fill(pth([[x+d*w*.25,ty-5],[x+d*w*.75,ty+droop*.3],[x+d*w,ty+droop],[x+d*w*.6,ty+droop*.6+2],[x+d*w*.2,ty]],true,.6),'glow',warm);
    for(let j=0;j<lower.length;j++){const [px,py]=lower[j];for(let q=0;q<2;q++)N.ink(`M${f1(px+J(3))} ${f1(py-3)}l${f1(d*R(1,4))} ${f1(R(3,7))}`,.8,.5);}
    N.ink(`M${f1(x)} ${f1(ty-2)}Q${f1(x+d*w*.5)} ${f1(ty-3)} ${f1(x+d*w*.92)} ${f1(ty+droop*.9)}`,.9,.42);}}
  s+=N.out()+ink(`M${x} ${f1(top+h*.08)}l${f1(J(1))} ${f1(-h*.08-6)}`,1.6,.85)+ink(`M${x} ${f1(top-2)}l-4 6M${x} ${f1(top-2)}l4 6`,1.1,.7);
  SH?.cast(x,y,h*.4,12);
  return s;
 }
 // ---------------------------------------------------------------- Winter
 // A far fir carrying snow, one of two kinds (a narrow spruce of many short tiers, a broader fir of a few wide ones),
 // the snow lying unevenly on its tiers (thick on some, gone from others), drawn in whole numbers.
 function snowFir(B,S,x,y,h,tok,io=.6){
  const narrow=rnd()<.6,tiers=narrow?RI(5,6):RI(3,4),w=h*(narrow?R(.2,.26):R(.3,.38)),skew=J(.1),pts=[[x+J(1),y-h]];const caps=[];
  for(let i=1;i<=tiers;i++){
    const t=i/tiers,ty=y-h+h*t*.92,tw=w*(.2+.8*Math.pow(t,.8))*R(.86,1.12);
    pts.push([x+tw*(1+skew),ty+h*.03]);
    if(i<tiers)pts.push([x+tw*.4,ty-h*.02]);
    caps.push([ty,tw]);
  }
  const right=pts.slice(1),left=right.map(([a,b])=>[2*x-a+J(1.5),b]).reverse(),out=[pts[0],...right,[x+2,y-h*.04],[x-2,y-h*.04],...left];
  B.fill(tok,pth(shift(out,1.4,1.6),true,.6));B.ink(pth(out,true,.6),1.2,io);B.ink(`M${f1(x)} ${f1(y-h*.04)}l${f1(J(.6))} ${f1(h*.07)}`,1.8,io);
  for(const [ty,tw] of caps){if(rnd()<.3)continue;const th=h*R(.03,.07),a=ty-th,l=R(.6,.95),r=R(.6,.98);
   const cap=[[x-tw*l,ty+h*.02],[x-tw*l*.5,a+h*.01],[x,a-h*.015],[x+tw*r*.5,a+h*.01],[x+tw*r,ty+h*.03],[x+tw*r*.5,ty-h*.004],[x,ty-h*.03],[x-tw*l*.5,ty]];
   S.fill('snowf',pth(cap,true,.4));
   S.ink(pth(cap.slice(0,5),false,.4),.9,io*.7);
  }
  S.fill('snowf',pth([[x-3,y-h-1],[x+3,y-h+4],[x,y-h+7],[x-4,y-h+4]],true,.3));
 }
 function snowWoods(y,{gap=[10,20],h=[26,60],io=.45}={}){return whole(()=>{const B=Batch(),S=Batch(),F=Batch();
  let x=-20;
  while(x<W+20){
    x+=R(9,16);
    const hh=R(14,30),w=hh*.24;
    F.fill('treefar',pth([[x,y-8-hh],[x+w,y-8],[x-w,y-8]],true,.6));
    F.fill('snowf',pth([[x-w*.4,y-8-hh*.6],[x,y-8-hh-1],[x+w*.4,y-8-hh*.6]],true,.3),.9);
  }
  x=-20;while(x<W+20){x+=R(...gap);snowFir(B,S,x,y+J(3),R(...h)*(rnd()<.08?1.4:1),pick(['tree1','tree3','treeshade']),io);}
  return F.out()+B.out()+S.out();});}
 // A great spruce seen near: roots in a mound of snow, the trunk showing between drooping, uneven layers of boughs,
 // needles hatched along their undersides, and snow lying in clumps along the top of each bough, hanging off its tip.
 function spruce(x,y,h,SH,{io=.85,bare=.16}={}){
  const tw=Math.max(5,h*.016),top=y-h;let s='';const B=Batch(),N=Batch(),S=Batch(),SI=Batch();
  for(const [d,l] of [[-1,30],[1,34],[-.6,18],[.5,22]])B.ink(pth([[x+d*tw*.6,y-10],[x+d*l*.45,y-2+J(1)],[x+d*l+J(4),y+4]],false,.6),2.2,io*.9);
  const trunk=pth([[x-tw,y],[x-tw*.35,top+h*.04],[x+tw*.35,top+h*.04],[x+tw,y]],true,.6);s+=wash(trunk,'bark')+ink(trunk,1.8,io);
  for(let i=0;i<Math.round(h/12);i++){const ty=y-R(4,h*.92),k=(y-ty)/h,ww=tw*(1-k*.65);B.ink(`M${f1(x-ww*.8)} ${f1(ty)}q${f1(ww*.8)} ${f1(R(1,3))} ${f1(ww*1.6)} 0`,.8,.5);}
  s+=B.out();
  // the crown's dark heart behind the boughs, so the upper trunk never shows as a bare pole
  s+=fill(loop([[x,top-2],[x+h*.025,top+h*.2],[x+h*.045,top+h*.5],[x+h*.03,top+h*.68],[x-h*.03,top+h*.68],[x-h*.045,top+h*.5],[x-h*.025,top+h*.2]],.6,0),'treeshade',.95);
  {
    const Hn=Batch();
    for(let i=0;i<Math.round(h/7);i++){const yy=top+h*R(.04,.66),k=(yy-top)/h,hw=h*.04*Math.min(1,k*2.4);Hn.ink(`M${f1(x+R(-hw,hw))} ${f1(yy)}l${f1(J(3))} ${f1(R(4,8))}`,.8,.45);}
    s+=Hn.out();
  }
  const tiers=Math.max(8,Math.round(h/30));
  for(let i=tiers-1;i>=0;i--){const k=i/(tiers-1),ty=top+h*(.06+.78*k),w=h*(.05+.27*k)*R(.85,1.15);
   for(const d of [-1,1]){if(k>.22&&k<.95&&rnd()<bare)continue;const droop=w*R(.28,.44),n=RI(4,6),lower=[];
    for(let j=1;j<=n;j++){const t=1-j/n;lower.push([x+d*w*t+J(2),ty+droop*t+7+(j%2?R(3,7):-1)]);}
    const upper=[[x,ty-4],[x+d*w*.35,ty-6-w*.04],[x+d*w*.75,ty+droop*.35],[x+d*w,ty+droop]];
    const dd=pth([...upper,...lower,[x+d*tw*.4,ty+6]],true,1);s+=wash(dd,pick(['tree1','tree2','tree3']))+ink(dd,1.3,io*.85);
    s+=fill(pth([...lower.slice(0,-1).map(([px,py])=>[px,py-1]),...lower.slice(0,-1).reverse().map(([px,py])=>[px+d*2,py-6])],true,.5),'treeshade',.5);
    for(let j=0;j<lower.length;j++){const [px,py]=lower[j];for(let q=0;q<2;q++)N.ink(`M${f1(px+J(3))} ${f1(py-3)}l${f1(d*R(1,4))} ${f1(R(3,7))}`,.8,.5);}
    // the snow along the top of the bough: lumpy clumps, thickest in the middle, sometimes reaching the tip and
    // hanging over it
    if(rnd()<.88){const u0=R(.08,.3),u1=R(.62,1),th=R(4,9)*(1.1-k*.3),edge=[];
     for(let m=0;m<=8;m++){
       const u=u0+(u1-u0)*m/8,
         p=u<.35?[x+d*w*.35*u/.35,ty-4-(2+w*.04)*u/.35]:u<.75?[x+d*w*(.35+.4*(u-.35)/.4),ty-6-w*.04+(droop*.35+6+w*.04)*(u-.35)/.4]:[x+d*w*(.75+.25*(u-.75)/.25),ty+droop*.35+droop*.65*(u-.75)/.25];
       edge.push(p);
     }
     const crest=edge.map(([px,py],m)=>[px+J(1.2),py-th*Math.sin(m/8*Math.PI)*R(.7,1.15)-1]);
     S.fill('snowf',loop([...crest,...edge.slice().reverse().map(([px,py])=>[px,py+1.6])],.4,0));SI.ink(smooth(crest,.4),.9,io*.7);
     if(u1>.92){
       const [ex,ey]=edge[8];
       S.fill('snowf',loop([[ex-d*4,ey-2],[ex+d*3,ey-1],[ex+d*2,ey+R(6,10)],[ex-d*1,ey+R(4,7)]],.3,0));
       SI.ink(`M${f1(ex+d*3)} ${f1(ey-1)}q${f1(d*1)} 5 ${f1(-d*1)} 8`,.7,io*.6);
     }}}}
  // the tip: a last small tuft of boughs with its cap of snow
  {
    const tip=[[x,top-8],[x+7,top+6],[x+3,top+5],[x+11,top+20],[x,top+17],[x-11,top+21],[x-3,top+6],[x-7,top+7]];
    s+=piece(tip,'tree3',1.2,io*.85,.3);
    S.fill('snowf',loop([[x-6,top+3],[x,top-8],[x+6,top+3],[x,top+1]],.3,0));
  }
  s+=N.out()+S.out()+SI.out();
  // the mound of snow round its foot
  const mound=[[x-60,y+6],[x-30,y-6],[x,y-10],[x+34,y-6],[x+66,y+6],[x+30,y+12],[x-30,y+12]];
  s+=fill(loop(mound,.5,0),'snowf')+ink(smooth(mound.slice(0,5),.4),1,io*.45)+fill(loop([[x-40,y+6],[x+44,y+6],[x+24,y+11],[x-20,y+11]],.4,0),'snow2',.6);
  SH?.cast(x,y,h*.4,12);
  return s;
 }
 // A split-rail fence: posts leaning a little, two rails between each pair, a cap of snow on every post and lying
 // unevenly along the rails, an icicle or two.
 function railFence(pts){let s='';const B=Batch(),S=Batch(),SI=Batch();
  for(let i=0;i<pts.length-1;i++){
    const [x0,y0]=pts[i],[x1,y1]=pts[i+1];
    for(const h of [16,34]){const a=[x0,y0-h],b=[x1,y1-h-2],m=[(x0+x1)/2,(y0+y1)/2-h+J(1.5)],d=pth([a,m,b],false,.5);B.ink(d,4.8,.85);B.mark('wood2',d,2.8,1);
   const n=8,crest=[],base=[];
   for(let j=0;j<=n;j++){
     const t=j/n,px=a[0]+(b[0]-a[0])*t,py=a[1]+(b[1]-a[1])*t+Math.sin(t*Math.PI)*(m[1]-(a[1]+b[1])/2);
     base.push([px,py-1.6]);
     crest.push([px,py-2-R(1.2,4.2)*(t>.06&&t<.94?1:.3)]);
   }
   S.fill('snowf',loop([...crest,...base.reverse()],.3,0));SI.ink(smooth(crest,.3),.8,.55);
   if(rnd()<.35){const t=R(.2,.8),px=a[0]+(b[0]-a[0])*t,py=a[1]+(b[1]-a[1])*t+2;S.fill('snowf',`M${f1(px-1.2)} ${f1(py)}l1.2 ${f1(R(5,9))}l1.2 ${f1(-R(5,9))}z`);}}}
  s+=B.out();
  for(const [x,y] of pts){s+=post(x,y,48,6,.85);S.fill('snowf',loop([[x-5,y-47],[x-2,y-52],[x+3,y-53],[x+6,y-48],[x,y-46]],.3,0));SI.ink(`M${f1(x-5)} ${f1(y-47)}q${f1(5)} -7 ${f1(11)} -1`,.8,.6);}
  return s+S.out()+SI.out();}
 // The sled, leaning on the fence: a slatted wooden deck on its knees, two runners curling up at the front, its rope
 // trailing into the snow. Drawn lying flat (front to the right) and tilted up against the rail.
 function sled(x,y,ang=-18){
  let g='';const R1=[[0,0],[46,1.6],[92,1],[104,-3],[112,-13],[110,-24],[101,-23],[104,-14]],off=[13,-15],far=R1.map(([a,b])=>[a+off[0],b+off[1]]);
  const runner=(pts,tok,o=1)=>{const d=strand(pts.slice(0,5),[4.6,4.6,4.6,4.2,3.8]);return wash(d,tok,o)+ink(d,1.3,.9)+ink(smooth(pts.slice(4),.3),3.2,.9)+mark(smooth(pts.slice(4),.3),tok,1.8,1);};
  g+=runner(far,'clay2',.9);
  for(const kx of [14,50,86])g+=piece([[kx+off[0]-1.6,off[1]-1],[kx+off[0]+1.6,off[1]-1],[kx+off[0]+1.4,off[1]-9],[kx+off[0]-1.4,off[1]-9]],'wood3',1,.8,.2);
  // the deck: a stringer under each edge, the slats across
  for(let i=0;i<7;i++){
    const a=4+i*13.4,b=a+10.4,q=[[a,-10],[b,-10.4],[b+off[0],-10.4+off[1]],[a+off[0],-10+off[1]]];
    g+=piece(q,i%2?'wood':'wood2',1.1,.88,.15);
    g+=ink(`M${f1(a+2)} ${f1(-11)}l${f1(off[0]*.9)} ${f1(off[1]*.9)}`,.6,.35);
  }
  g+=piece([[0,-7],[96,-8],[96,-11],[0,-10]],'wood3',1.2,.9,.15);
  for(const kx of [14,50,86])g+=piece([[kx-1.8,-1],[kx+1.8,-1],[kx+1.6,-9],[kx-1.6,-9]],'wood3',1.1,.85,.2);
  g+=runner(R1,'clay2');
  g+=fill(loop([[20,-11.4],[60,-12],[78,-12.6],[74,-14.6],[30,-14.4]].map(([a,b])=>[a+off[0]*.5,b+off[1]*.5]),.3,0),'snowf',.95);
  let s=fill(loop([[x-14,y+3],[x+40,y-2],[x+92,y+3],[x+50,y+8]],.3,0),'snow2',.75)+`<g transform="rotate(${ang} ${x} ${y}) translate(${x} ${y})">${g}</g>`;
  const a=ang*Math.PI/180,front=[x+110*Math.cos(a)+24*Math.sin(a),y+110*Math.sin(a)-24*Math.cos(a)];
  s+=ink(smooth([front,[front[0]+12,front[1]+22],[front[0]+4,y+2],[front[0]-22,y+8],[front[0]-40,y+4]],.3),2.6,.85)+
    mark(smooth([front,[front[0]+12,front[1]+22],[front[0]+4,y+2],[front[0]-22,y+8],[front[0]-40,y+4]],.3),'rope',1.4,1);
  return s;}
 // Tracks in the snow: the sled's two runner grooves, a pony's hoofprints, a hare's bounding fours.
 function grooves(B,line,gap=13){for(const k of [0,1]){const l=line.map(([x,y])=>[x+k*gap,y+k*2]);B.mark('snow2',smooth(l,.6),3.2,.9);B.ink(smooth(l.map(([x,y])=>[x-1.4,y-.8]),.6),.8,.25);}}
 function hoofprints(B,pts){
   for(let i=0;i<pts.length;i++){
     const [x,y]=pts[i],side=i%2?6:-6,k=.7+(y-700)/600;
     const d=`M${f1(x+side-5*k)} ${f1(y)}q${f1(5*k)} ${f1(-6*k)} ${f1(10*k)} 0q${f1(-1.6*k)} ${f1(2.4*k)} ${f1(-5*k)} ${f1(2.4*k)}q${f1(-3.4*k)} 0 ${f1(-5*k)} ${f1(-2.4*k)}z`;
     B.fill('snow2',d,.95);
     B.ink(`M${f1(x+side-5*k)} ${f1(y)}q${f1(5*k)} ${f1(-6*k)} ${f1(10*k)} 0`,.8,.35);
   }
 }
 function hareTracks(B,pts){for(const [x,y] of pts){const k=.6+(y-660)/500;for(const [dx,dy,r] of [[-4,0,2.4],[4,-1,2.4],[-1,9,1.6],[1,15,1.6]]){B.fill('snow2',dab(x+dx*k,y+dy*k,r*k,r*k*1.5),.9);}}}
 // Dry grass and seed heads standing through the snow.
 function dryTuft(B,x,y,h=18){
   for(let k=-2;k<=2;k++){const tx=x+k*1.6,l=h*R(.6,1.1),lean=k*h*.12+J(2);B.mark(rnd()<.5?'wood2':'grass2',`M${f1(tx)} ${f1(y)}q${f1(lean*.3)} ${f1(-l*.5)} ${f1(lean)} ${f1(-l)}`,1.1,.85);
  if(rnd()<.35){const [sx,sy]=[tx+lean,y-l];B.fill('wood',leafPath(sx,sy+1,R(4,6),-Math.PI/2+J(.4),.4),.95);}}
  B.fill('snowf',loop([[x-9,y+1],[x,y-3],[x+9,y+1],[x,y+3]],.3,0));}
 // A rose bush in winter: bare dark stems arching from the snow, snow along some of them, red hips here and there.
 function roseHips(x,y,r){let s='';const B=Batch(),S=Batch(),Hb=Batch();
  for(let i=0;i<11;i++){const a=-Math.PI*(.12+.76*i/10)+J(.08),l=r*R(.7,1.15),ex=x+Math.cos(a)*l,ey=y+Math.sin(a)*l*.9,c=[x+Math.cos(a)*l*.5+J(4),y+Math.sin(a)*l*.6-r*.12];
   B.mark('wood3',`M${f1(x)} ${f1(y)}Q${f1(c[0])} ${f1(c[1])} ${f1(ex)} ${f1(ey)}`,1.6,1);B.ink(`M${f1(x)} ${f1(y)}Q${f1(c[0])} ${f1(c[1])} ${f1(ex)} ${f1(ey)}`,.6,.5);
   for(let k=0;k<2;k++){const u=R(.4,.9),hx=(1-u)*(1-u)*x+2*(1-u)*u*c[0]+u*u*ex,hy=(1-u)*(1-u)*y+2*(1-u)*u*c[1]+u*u*ey;B.mark('wood3',`M${f1(hx)} ${f1(hy)}l${f1(J(6))} ${f1(-R(3,8))}`,.8,1);}
   if(rnd()<.6){
     const u=R(.5,.95),hx=(1-u)*(1-u)*x+2*(1-u)*u*c[0]+u*u*ex,hy=(1-u)*(1-u)*y+2*(1-u)*u*c[1]+u*u*ey;
     Hb.fill('blanket',dab(hx,hy+2.6,2.8,3.2));
     Hb.ink(dab(hx,hy+2.6,2.8,3.2),.7,.6);
     Hb.ink(`M${f1(hx)} ${f1(hy-.4)}l0 -1.6`,.7,.7);
   }
   if(rnd()<.5)S.fill('snowf',loop([[c[0]-5,c[1]-1],[c[0],c[1]-4],[c[0]+5,c[1]-1],[c[0],c[1]+1]],.3,0));}
  s+=B.out()+S.out()+Hb.out()+fill(loop([[x-r*.9,y+4],[x,y-4],[x+r*.9,y+4],[x,y+8]],.4,0),'snowf')+ink(smooth([[x-r*.9,y+4],[x,y-4],[x+r*.9,y+4]],.4),.9,.4);
  return s;}
 // A stone under snow: a boulder with a cap of snow on its top, the cap's edge inked.
 function snowStone(x,y,w,h){const cap=[[x-2,y-h*.55],[x+w*.18,y-h*.92],[x+w*.45,y-h-3],[x+w*.75,y-h*.9],[x+w+2,y-h*.4],[x+w*.7,y-h*.55],[x+w*.4,y-h*.62],[x+w*.12,y-h*.42]];
  return boulder(x,y,w,h,{tok:'rock2',io:.8})+fill(loop(cap,.4,0),'snowf')+ink(smooth(cap.slice(0,5),.4),1,.6)+fill(loop([[x-10,y+1],[x+w*.5,y-4],[x+w+12,y+1],[x+w*.5,y+5]],.4,0),'snowf');}
 // A robin on a fence post: brown back, orange breast and face, pale belly, a dark eye, thin legs. 24 x 20, facing left.
 function robin(x,y){let s=piece([[x+10,y-2],[x+3,y-6],[x-1,y-12],[x+2,y-17],[x+8,y-18],[x+15,y-14],[x+20,y-10],[x+26,y-12],[x+22,y-6],[x+16,y-2]],'wood2',1.3,.9,.2);
  s+=fill(loop([[x+1,y-12],[x+3,y-16],[x+8,y-15],[x+11,y-9],[x+8,y-4],[x+3,y-6]],.2,0),'breast',.95)+fill(loop([[x+9,y-6],[x+14,y-8],[x+16,y-3],[x+11,y-2]],.2,0),'fl4',.85);
  s+=fill(dab(x+4.6,y-14.6,.9),'eye')+fill('M'+f1(x+.4)+' '+f1(y-14)+'l-4 1l4 1z','iron')+ink(`M${f1(x+9)} ${f1(y-2)}l-1 4M${f1(x+12)} ${f1(y-2)}l1 4`,.8,.85);return s;}
 // Snowfall: flakes on a sheet that repeats every RAIN_P px down, two depths, the far one finer and slower.
 function snowLayer(cls,n,r,o){const B=Batch(),per=Math.round(n*RAIN_P/H);for(let i=0;i<per;i++){const x=R(-20,W),y=R(0,RAIN_P),rr=R(r*.6,r*1.3);B.fill('flake',dab(x,y,rr,rr),o);}
  const tile=B.out(),rows=Math.ceil(H/RAIN_P)+1;return `<div class="${cls}"><svg viewBox="0 0 ${W} ${rows*RAIN_P}" width="${W}" height="${rows*RAIN_P}" aria-hidden="true" focusable="false">${Array.from({length:rows},(_,k)=>k?`<g transform="translate(0 ${k*RAIN_P})">${tile}</g>`:tile).join('')}</svg></div>`;}
 // Powder sliding off a bough at the start of a session: a falling veil of fine snow under the bough's tip.
 function powderArt(){
   let s='';
   for(let i=0;i<6;i++){const B=Batch();for(let k=0;k<6;k++)B.fill('flake',dab(R(4,40),R(0,26),R(.9,2)),.95);s+=`<g class="fr-pfall" style="--i:${i}">${B.out()}</g>`;}
   return s;
 }
 function winter(night){
  seed=5505;const SH=Shadows({light:[712,760]}),A=[],WA=[];let far='',mid='',mid2='',near='',front='';
  // a low winter sun: a warm pink-gold band lying along the horizon under the cold sky (by day)
  if(!night)
    far+=whole(()=>
      fill(pth([[-20,HZ-74],[400,HZ-86],[900,HZ-70],[1460,HZ-84],[1460,HZ-40],[900,HZ-36],[400,HZ-46],[-20,HZ-38]],true,3),'lowsun',.55)+
        fill(pth([[-20,HZ-52],[600,HZ-60],[1460,HZ-56],[1460,HZ-30],[600,HZ-30],[-20,HZ-28]],true,3),'lowsun',.45));
  far+=range(HZ-30,'mtnfar',.3,{snow:true,peaks:[160,240],low:[70,120],rise:[60,130],shade:.1});
  far+=fill(pth([[-20,HZ-2],[300,HZ-18],[700,HZ-8],[1100,HZ-22],[1460,HZ-10],[1460,HZ+30],[-20,HZ+30]],true,2),'snow2');
  far+=snowWoods(HZ+10,{gap:[11,21],h:[26,60]});
  // the cabin at the woods' edge, snow on its roof and its woodpile; at night its window lights the snow
  far+=logCabin(196,HZ+14,night)+
    whole(()=>
      fill(pth([[189,HZ-11],[218,HZ-33],[247,HZ-11],[218,HZ-29]],true,.6),'snowf')+
        ink(pth([[189,HZ-11],[218,HZ-34],[247,HZ-11]],false,.5),1,.5)+
        fill(pth([[240,HZ+1],[260,HZ-4],[262,HZ+1]],true,.4),'snowf')+
        fill(pth([[262,HZ+13],[282,HZ+10],[300,HZ+13],[282,HZ+15]],true,.4),'snowf'));
  if(night)far+=fill(lobe(212,HZ+24,30,6,11),'glow',.4)+fill(lobe(214,HZ+22,14,3,9),'glowcore',.4);
  // the snowfield, its drifts drawn with a shaded side and a fine line along their crests
  mid+=fill(pth([[-20,HZ+12],[1460,HZ+8],[1460,920],[-20,920]],true,2),'snowf');
  {
    const B=Batch();
    for(const [x,y,w] of [[-60,HZ+46,520],[380,HZ+64,460],[760,HZ+40,240],[1120,HZ+56,380],[-40,HZ+150,420],[560,HZ+176,380],[1180,HZ+200,320],[200,HZ+260,520],[760,HZ+300,420],[1240,HZ+290,260]]){
      const crest=[];
      for(let k=0;k<=6;k++)crest.push([x+w*k/6,y-R(2,7)*Math.sin(k/6*Math.PI)]);
   B.fill('snow2',loop([...crest,[x+w*.8,y+R(6,11)],[x+w*.4,y+R(8,14)],[x+w*.1,y+R(4,8)]],.6,0),.62);B.ink(smooth(crest,.5),.9,.22);}mid+=B.out();}
  // the creek, frozen: grey-blue ice with cracks and a dusting of snow, lips of snow overhanging both banks, the one
  // open run by its stone, dark, rimmed with ice, a breath of steam over it
  const CL=[[946,HZ+14],[912,HZ+60],[960,HZ+110],[1040,HZ+170],[1010,HZ+250],[1120,920]],CR=[[968,HZ+14],[944,HZ+60],[1002,HZ+110],[1098,HZ+170],[1086,HZ+250],[1250,920]];
  const dense=pts=>{
    const out=[];
    for(let i=0;i<pts.length-1;i++){for(let k=0;k<6;k++){const t=k/6,a=pts[Math.max(0,i-1)],b=pts[i],c=pts[i+1],d=pts[Math.min(pts.length-1,i+2)],t2=t*t,t3=t2*t;
   out.push([.5*(2*b[0]+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-d[0])*t2+(-a[0]+3*b[0]-3*c[0]+d[0])*t3),.5*(2*b[1]+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-d[1])*t2+(-a[1]+3*b[1]-3*c[1]+d[1])*t3)]);}}
   out.push(pts[pts.length-1]);
   return out;
  };
  const DL=dense(CL),DR=dense(CR);
  mid+=fill(smooth(CL,.4)+'L'+CR.slice().reverse().map(([x,y])=>f1(x)+' '+f1(y)).join('L')+'Z','ice');
  {const B=Batch();for(let i=2;i<DL.length-2;i+=3){const [lx,ly]=DL[i],[rx,ry]=DR[i],w=rx-lx;B.fill('ice2',loop([[lx+w*.2,ly],[lx+w*.6,ly-2],[lx+w*.8,ly+6],[lx+w*.4,ly+8]],.4,0),.5);}
   for(let i=0;i<9;i++){
     const k=RI(3,DL.length-4),[lx,ly]=DL[k],[rx]=DR[k],x0=lx+(rx-lx)*R(.15,.5),l=R(14,34);
     B.ink(`M${f1(x0)} ${f1(ly)}l${f1(l*.3)} ${f1(R(2,6))}l${f1(l*.3)} ${f1(-R(1,4))}l${f1(l*.4)} ${f1(R(2,5))}`,.8,.42);
   }
   for(let i=0;i<26;i++){
     const k=RI(1,DL.length-2),[lx,ly]=DL[k],[rx]=DR[k],x=lx+(rx-lx)*R(.15,.85);
     B.fill('snowf',dab(x,ly+R(-3,3),R(1.2,3),R(.6,1.2)),.85);
     if(i%3===0)B.mark('snowf',`M${f1(x-6)} ${f1(ly)}q6 -1.4 12 0`,1.6,.8);
   }
   mid+=B.out();
  }
  // the lips: snow overhanging each bank, its shadow lying blue on the ice under it
  for(const [D,side] of [[DL,1],[DR,-1]]){
    const over=D.map(([x,y],i)=>[x+side*(4+Math.sin(i*1.7)*2.4+R(0,2)),y]),back=D.map(([x,y])=>[x-side*16,y]).reverse(),shade=D.map(([x,y],i)=>[over[i][0]+side*5,y+1]).reverse();
   mid+=fill(loop([...over,...shade],.4,0),'snow2',.75)+fill(loop([...over,...back],.4,0),'snowf')+ink(smooth(over,.4),1.3,.6);}
  mid+=fill(loop([[1038,HZ+197],[1066,HZ+187],[1094,HZ+199],[1078,HZ+213],[1046,HZ+212]],.4,0),'ripple',.95)+
    fill(loop([[1046,HZ+200],[1068,HZ+193],[1086,HZ+201],[1072,HZ+208],[1052,HZ+207]],.3,0),'blue2',.55);
  mid+=ink(loop([[1036,HZ+197],[1066,HZ+186],[1096,HZ+199],[1078,HZ+214],[1044,HZ+213]],.4,2),1.4,.55)+
    mark(smooth([[1040,HZ+196],[1066,HZ+185],[1094,HZ+197]],.3),'snowf',2.4,.95)+
    boulder(1060,HZ+197,28,12,{tok:'rock2'});
  mid+=mark(smooth([[1050,HZ+192],[1046,HZ+178],[1054,HZ+166],[1050,HZ+150]],.3),'mist',3.6,.5)+mark(smooth([[1078,HZ+194],[1082,HZ+180],[1076,HZ+168]],.3),'mist',2.6,.45);
  // the fence with the robin on a post, the sled leaning on it, the tracks
  mid2+=railFence([[-10,722],[110,716],[230,708],[350,702],[470,696],[590,690],[710,686]])+robin(348,654);box('robin',345,634,376,656);
  mid2+=sled(546,714,-20);box('sled',532,630,676,722);
  {
    const B=Batch();
    grooves(B,[[566,716],[540,770],[500,830],[470,912]]);
    hoofprints(B,[[150,912],[176,884],[204,858],[232,834],[262,812],[286,792]]);
    hareTracks(B,[[780,912],[812,872],[846,834],[872,796],[904,760],[938,724],[962,688]]);
    mid2+=B.out();
  }
  // the bush with its red hips, stones under snow, dry grass through the snow
  mid2+=roseHips(880,792,40);box('rose',838,748,924,800);
  mid2+=snowStone(1176,710,40,18)+snowStone(800,866,62,26)+snowStone(400,890,48,20);box('stone',798,836,864,870);
  {
    const B=Batch();
    for(const [x,y,h] of [
      [34,736,20],
      [160,728,16],
      [300,722,14],
      [630,712,18],
      [760,700,16],
      [690,860,22],
      [600,890,24],
      [980,860,20],
      [1170,820,18],
      [1260,760,16],
      [860,700,14],
      [120,860,22],
      [260,880,20],
      [1000,700,14]
    ])
      dryTuft(B,x,y,h);
    mid2+=B.out();
  }
  // Biscuit asleep in the snow under his blanket, the kettle by his nose, the lantern lighting the snow at night
  near+=lanternPost(700,800);
  box('lanternpost',696,682,727,800);
  A.push(actor('fr-lpool',600,778,200,44,lanternPool(100,22,84,13)));
  A.push(actor('fr-lantern',696,672,60,80,lanternArt()));
  box('lantern',712,682,740,733);
  {
    const bx=300,by=640,[kx,ky]=kettleAt(bx,by);
    A.push(actor('fr-kettle',kx,ky,70,60,kettleArt()+`<g class="fr-steam" transform="translate(58 -10)">${steamArt()}</g>`));
    A.push(actor('fr-biscuit',bx,by,230,150,ponyArt()));
    biscuitBoxes(bx,by);
    kettleBox(kx,ky);
    SH.cast(bx+104,778,150,12);
   near+=fill(loop([[bx-6,782],[bx+90,774],[bx+206,782],[bx+150,790],[bx+40,790]],.4,0),'snow2',.7);}
  // the great spruces framing the place, laden with snow; a smaller one by the creek
  front+=spruce(70,904,560,SH)+spruce(1390,906,500,SH)+spruce(1284,884,250,SH,{io:.8,bare:.1});box('fir',40,344,100,904);box('fir',1360,406,1420,906);
  {const B=Batch();for(let i=0;i<14;i++)dryTuft(B,R(160,1240),R(880,900),R(18,28));front+=B.out();}
  // at the start: a ring on the open water and powder sliding off a bough of the near spruce
  WA.push(actor('fr-ring fr-start-life',1004,HZ+184,120,40,ringArt({fish:false,place:'winter'})));
  A.push(actor('fr-powder fr-start-life',1290,566,48,90,powderArt()));
  const light=[fill(pth([[0,HZ+30],[1440,HZ+14],[1440,HZ+44],[0,HZ+60]],true,4),'lowsun',.22),fill(pth([[0,HZ+30],[1440,HZ+14],[1440,HZ+44],[0,HZ+60]],true,4),'lowsun',.22)];
  A.push(snowLayer('fr-rain fr-snow fr-snow-far',220,1.6,.7));A.push(snowLayer('fr-rain fr-snow fr-snow-near',90,2.8,.9));
  A.push(wispActor(230,HZ-38));
  return finish('winter',night,{far,mid,mid2,near,front,SH,light,A,WA,clouds:[[26,180,300,-60,.85],[12,140,340,-210,.8]]});
 }
 // Assemble the stage: still layers, shadow layers, actors; everything sized to the 1440 x 900 stage.
 function layerSvg(cls,inner){return `<svg class="fr-l ${cls}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">${inner}</svg>`;}
 // The stage is five depths, back to front, so the room can come in (and change place) one ground at a time:
 // the sky with its sun and clouds; the far ground; the middle ground with its water, what moves on the water, then
 // what floats or stands in it; the near ground with its shadows, the creatures and the things in use; the front.
 function finish(id,night,{far,mid,mid2='',near,front,SH,light,A,WA=[],clouds,overcast}){
  const isNight=!!night||id==='fire',[am,pm,nt]=SH.out(),kind=isNight?'night':overcast?'overcast':'day';
  const skyKind=isNight?(overcast?'night-overcast':'night'):overcast?'overcast':'day';
  seed=7700+id.length*13;
  const depth=(n,inner)=>`<div class="fr-depth fr-d${n}">${inner}</div>`;
  const shadows=id==='fire'?layerSvg('fr-glowl',nt+light.join('')):isNight?(nt?layerSvg('fr-sh fr-nt',nt):''):layerSvg('fr-sh fr-am',am+(light[0]||''))+layerSvg('fr-sh fr-pm',pm+(light[1]||''));
  const sun=overcast?veiledSunArt(isNight):isNight?moonArt():sunArt();
  return {id,night:!!night,
   html:depth(0,layerSvg('fr-skyl',sky(skyKind)+`<path class="fr-arcline" d="M${ARC.x0} ${ARC.y}Q${ARC.cx} ${ARC.cy} ${ARC.x1} ${ARC.y}"/>`)+
     `<div class="fr-sun" aria-hidden="true"><svg viewBox="0 0 80 80" width="80" height="80" focusable="false">${sun}</svg></div>`+
     `<div class="fr-clouds">${cloudsLayer(clouds,overcast?'stratus':'day')}</div>`)+
    depth(1,layerSvg('fr-far',far))+
    depth(2,layerSvg('fr-mid',mid)+(WA.length?`<div class="fr-actors fr-onwater">${WA.join('')}</div>`:'')+(mid2?layerSvg('fr-mid2',mid2):'')+A.filter(a=>/fr-firelight/.test(a)).join(''))+
    depth(3,shadows+layerSvg('fr-near',near)+`<div class="fr-actors">${A.filter(a=>!/fr-rain|fr-firelight/.test(a)).join('')}</div>`)+
    depth(4,layerSvg('fr-front',front)+A.filter(a=>/fr-rain/.test(a)).join('')),
   kind};
 }
 const cache=new Map();
 function stage(place,{night=false}={}){
  const id=PLACES.includes(place)?place:'lake',key=id+(night||id==='fire'?':n':':d');
  if(!cache.has(key)){
    BOX=[];
    RIDGE=[];
    const built=id==='lake'?lake(night):id==='stream'?stream(night):id==='rain'?rain(night):id==='winter'?winter(night):fire();
    built.boxes=BOX;
    built.ridge=RIDGE;
    BOX=null;
    RIDGE=null;
    cache.set(key,built);
  }
  return cache.get(key);
 }
 // Small pictures: a place card for the picker and the module's thumbnail. A few strokes each.
 function thumb(place){
  seed=50+PLACES.indexOf(place)*11;const night=place==='fire';
  let s=`<rect class="f-sky0" width="120" height="76"/>`+
    fill(pth([[0,38],[30,26],[56,34],[86,22],[120,32],[120,48],[0,48]],true,.8),'mtnfar')+
    fill(pth([[0,44],[120,42],[120,76],[0,76]],true,.6),place==='lake'?'water':'ground');
  for(let i=0;i<9;i++){const x=6+i*13+J(2);s+=fill(`M${f1(x)} 34l5 12h-10z`,'tree2');}
  if(place==='lake')s+=fill(pth([[0,62],[120,58],[120,76],[0,76]],true,.6),'ground')+ink('M64 54h34',2.4,.85)+ink('M70 54v8M92 54v8',1.2,.8)+mark('M20 50h12M44 52h10',  'ripple',1.2,.8);
  if(place==='stream')s+=fill('M54 44q-10 10 4 16q-20 6 -14 16h28q-4 -10 12 -16q-16 -6 -6 -16z','water')+ink('M40 52h40',2,.8);
  if(place==='rain'){s+=fill('M50 76l8 -30h8l8 30z','path')+shape([[80,44],[96,34],[112,44]],'roof',1.4,.8,.4);for(let i=0;i<14;i++)s+=mark(`M${f1(R(0,120))} ${f1(R(0,70))}l-1.5 6`,'rain',1,.8);}
  if(place==='winter'){
    s=s.replace(/class="f-(water|ground)"/g,'class="f-snowf"');
    for(let i=0;i<5;i++){const x=10+i*25+J(3);s+=fill(`M${f1(x)} 30l7 16h-14z`,'tree3')+fill(`M${f1(x)} 30l3 6h-6z`,'snowf');}
    s+=fill('M70 76q6 -14 26 -32h8q-14 20 -18 32z','ice')+ink('M36 60l40 -6M36 66l40 -6',2,.8)+ink('M40 52v16M58 50v16M76 47v16',1.4,.85);
    for(let i=0;i<16;i++)s+=fill(`M${f1(R(0,120))} ${f1(R(0,70))}a1 1 0 1 0 2 0a1 1 0 1 0 -2 0`,'flake');
  }
  if(place==='fire'){
    for(let i=0;i<16;i++)s+=fill(`M${f1(R(0,120))} ${f1(R(2,30))}a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0 -1.8 0`,'star');
    s+=fill(pth(ring(60,62,22,6,10),true,.6),'glow',.3)+fill('M54 64q2 -14 6 -16q4 6 6 16z','flame')+fill('M57 64q1 -7 3 -9q2 4 3 9z','flame3')+shape([[20,64],[32,46],[44,64]],'tentlit',1.2,.8,.4);
  }
  return {svg:s,night};
 }
 // The wax seal (the main button), drawn once per size: drips, a pressed inner ring, a bevel of two flat washes.
 function seal(size=100){
  seed=31;const c=size/2,r=size*.42;
  const p=ring(c,c,r,r,18,.02).map(([x,y],i)=>[x+(i%2?r*.06:-r*.04),y+(i%3?r*.04:-r*.04)]);
  const d=pth(p,true,.6);
  let s=fill(d,'sealshadow',.55,size*.03,size*.045)+fill(d,'seal')+ink(d,size*.024,1).replace('class="k"','class="k s-sealink"');
  s+=fill(pth([[c-r*.62,c-r*.42],[c-r*.2,c-r*.78],[c+r*.3,c-r*.78],[c-r*.1,c-r*.6],[c-r*.5,c-r*.2]],true,.5),'seallight',.55);
  s+=fill(pth([[c+r*.7,c+r*.2],[c+r*.4,c+r*.72],[c-r*.1,c+r*.82],[c+r*.3,c+r*.5]],true,.5),'sealdark',.6);
  s+=mark(pth(ring(c,c,r*.7,r*.7,14,.02),true,.4),'sealring',size*.018,.75);
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2;s+=mark(`M${f1(c+Math.cos(a)*r*.74)} ${f1(c+Math.sin(a)*r*.74)}l${f1(Math.cos(a)*r*.06)} ${f1(Math.sin(a)*r*.06)}`,'sealring',size*.012,.5);}
  s+=fill(pth([[c+r*.62,c+r*.7],[c+r*.78,c+r*.92],[c+r*.68,c+r*1.04],[c+r*.56,c+r*.86]],true,.3),'seal')+fill(pth([[c-r*.9,c+r*.36],[c-r*1.08,c+r*.5],[c-r*.96,c+r*.6]],true,.3),'seal');
  return `<svg class="fr-seal-art" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false">${s}</svg>`;
 }
 // A hanging paper tag (for +5, Finish, lengths and the place), with a punched hole and a short string.
 function tagArt(w=96,h=44,{night=false,string=true}={}){
  seed=Math.round(w*3+h);const pts=[[12,4],[w-2,4],[w-1,h-2],[2,h-1],[1,14]];const d=pth(pts,true,.7);
  let s=fill(d,'tagshade',.5,2,2.6)+fill(d,'tag')+ink(d,1.8,.95).replace('class="k"','class="k s-tagink"')+fill(`M8 12.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0`,'taghole')+ink(`M8 12.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0`,1.2,.85).replace('class="k"','class="k s-tagink"');
  if(string)s+=mark(`M11.5 12.5q-8 -10 -10 -14`,'string',1.4,.9);
  for(let i=0;i<3;i++)s+=mark(`M${f1(R(w*.3,w*.9))} ${f1(R(8,h-6))}l${f1(R(4,10))} ${f1(J(.6))}`,'tagfiber',.7,.5);
  return `<svg class="fr-tag-art" viewBox="-6 -4 ${w+10} ${h+10}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${s}</svg>`;
 }
 // The big task tag: kraft card, string to a pin, a reinforced hole, a small notebook in the course colour.
 function bigTag(w=420,h=128){
  seed=77;const pts=[[16,0],[w,0],[w+2,h],[0,h-2],[0,16]];const d=pth(pts,true,1);
  let s=fill(d,'tagshade',.45,3,4)+fill(d,'bigtag')+ink(d,2.2,.95).replace('class="k"','class="k s-tagink"');
  s+=fill(pth(ring(20,18,8,8,10),true,.4),'tag2')+ink(pth(ring(20,18,8,8,10),true,.4),1.4,.8).replace('class="k"','class="k s-tagink"')+fill('M16.5 18a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0','taghole');
  s+=mark(`M20 18q60 -60 ${f1(w*.48)} -46`,'string',1.6,.9)+fill(`M${f1(w*.48-4)} -32a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`,'seal')+ink(`M${f1(w*.48-4)} -32a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`,1,.7);
  for(let i=0;i<7;i++)s+=mark(`M${f1(R(40,w-10))} ${f1(R(10,h-8))}l${f1(R(6,16))} ${f1(J(.8))}`,'tagfiber',.8,.45);
  s+=ink(pth([[w*.08,h-14],[w*.94,h-16]],false,.6),.8,.25).replace('class="k"','class="k s-tagink"');
  s+=`<g class="fr-notebook" transform="translate(42 34)">${shape([[0,4],[26,0],[30,36],[4,40]],'course',1.6,.9,.5)}${ink('M7 12l16 -2M8 20l16 -2M9 28l10 -1.4',1,.6)}${ink('M4 4l2 36',2.4,.75)}</g>`;
  return `<svg class="fr-bigtag-art" viewBox="-8 -42 ${w+16} ${h+52}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${s}</svg>`;
 }
 // The place picker's ground: a wooden plank the four cards, the knob and Quiet stand on, so nothing of the place shows
 // between or under their names. Grain along it, a darker front edge, two nails and a drawn shadow; by night the same
 // plank in the fire's warm browns (never white).
 function pickerArt(w=700,h=130){
  seed=41;const pts=[[4,10],[180,6],[420,9],[w-4,4],[w-2,h*.5],[w-5,h-6],[w*.66,h-3],[w*.32,h-7],[3,h-4],[6,h*.5]],d=pth(pts,true,1);
  let s=fill(d,'tagshade',.32,3,4)+wash(d,'wood');
  s+=fill(pth([[6,h-16],[w*.32,h-18],[w*.66,h-14],[w-5,h-17],[w-5,h-6],[w*.66,h-3],[w*.32,h-7],[3,h-4]],true,.6),'wood3',.55);
  for(let i=0;i<5;i++){const y=18+i*(h-40)/4+J(3),pts2=[];for(let x=14;x<=w-14;x+=R(60,110))pts2.push([x,y+J(2.4)]);pts2.push([w-14,y+J(2)]);s+=mark(smooth(pts2,.6),i%2?'wood2':'wood3',1.1,.45);}
  for(const [kx,ky] of [[w*.27,h*.38],[w*.71,h*.62]])s+=ink(pth(ring(kx,ky,7,3.2,9),true,.3),1,.35).replace('class="k"','class="k s-tagink"');
  s+=ink(d,2,.9).replace('class="k"','class="k s-tagink"');
  for(let i=0;i<3;i++)s+=ink(`M${f1(w-48+i*7)} ${f1(h-24)}l9 -9`,1,.3).replace('class="k"','class="k s-tagink"');
  for(const nx of [16,w-16]){const nd=pth(ring(nx,h*.5,3.4,3.4,8),true,.2);s+=fill(nd,'iron')+ink(nd,1,.8).replace('class="k"','class="k s-tagink"');}
  return `<svg viewBox="-4 -4 ${w+12} ${h+12}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${s}</svg>`;
 }
 function closeArt(){seed=5;return `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">${ink(pth([[8,8],[20,19],[32,31]],false,.8),3,1)}${ink(pth([[32,8],[21,20],[9,32]],false,.8),3,1)}</svg>`;}
 function pencilArt(){return `<svg viewBox="0 0 70 18" aria-hidden="true" focusable="false">${shape([[2,9],[12,4],[60,4],[66,9],[60,14],[12,14]],'pencil',1.4,.9,.3)}${fill('M2 9l10 -5v10z','wood')}${fill('M2 9l3.4 -1.6v3.2z','iron')}${fill('M60 4h4l2 5l-2 5h-4z','eraser')}${ink('M12 9h48',.8,.4)}</svg>`;}
 function knobArt(){
   seed=9;
   let s=fill(pth(ring(30,30,26,26,16),true,.5),'tagshade',.5,2,3)+fill(pth(ring(30,30,26,26,16),true,.5),'knob')+ink(pth(ring(30,30,26,26,16),true,.5),2,.9).replace('class="k"','class="k s-tagink"');
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2;s+=ink(`M${f1(30+Math.cos(a)*22)} ${f1(30+Math.sin(a)*22)}l${f1(Math.cos(a)*4)} ${f1(Math.sin(a)*4)}`,1,.45).replace('class="k"','class="k s-tagink"');}
  s+=fill(pth(ring(30,30,15,15,12),true,.4),'knob2')+ink(pth(ring(30,30,15,15,12),true,.4),1.2,.6).replace('class="k"','class="k s-tagink"');
  return `<svg viewBox="0 0 60 60" aria-hidden="true" focusable="false">${s}<g class="fr-knob-pointer">${ink('M30 30V10',3,1).replace('class="k"','class="k s-tagink"')}</g></svg>`;}
 function tallyArt(n){
   seed=13;
   let s='';
   const shown=Math.min(n,12);
   for(let i=0;i<shown;i++){const g=Math.floor(i/5),k=i%5,x=4+g*30+k*5;s+=k===4?`<path class="k fr-tally-mark" d="${pth([[x-21,20],[x+1,6]],false,.5)}" stroke-width="1.8"/>`:`<path class="k fr-tally-mark" d="${pth([[x,4],[x+J(1),22]],false,.4)}" stroke-width="2"/>`;}
  // as wide as its marks: one mark is one mark, not a mark and a gap before "today"
  const last=Math.max(0,shown-1),w=shown?Math.max(10,4+Math.floor(last/5)*30+(last%5)*5+6):10;
  return `<svg viewBox="0 0 ${w} 26" width="${w}" height="26" aria-hidden="true" focusable="false">${s}</svg>`;
 }
 // The wash that carries the room from one place to the next: one wet brush stroke, drawn moving to the right. Its
 // leading edge is darker where the pigment pools, beaded along the rim; three washes lie staggered over the body;
 // the trailing edge breaks into dry-brush streaks and a few drips. The body is solid paper from x 218 to 1982 of
 // 2304, so at the hold (the element shifted -14% of its 160% width) it covers the whole screen.
 function washArt(){
  seed=21;const WW=2304;
  const edge=(x,amp,step=28)=>{const pts=[];for(let y=-30;y<=H+30;y+=step+R(-6,6))pts.push([x+J(amp)+(rnd()<.12?R(-amp,amp)*1.6:0),y]);return pts;};
  const band=(l,r)=>{const right=r.slice().reverse();return 'M'+l.map(p=>f1(p[0])+' '+f1(p[1])).join('L')+'L'+right.map(p=>f1(p[0])+' '+f1(p[1])).join('L')+'Z';};
  const L0=edge(200,18),R0=edge(2000,18);
  let s=`<path class="f-paper" d="${band(L0,R0)}"/>`;
  // three washes, each a little short of the last at the back and running a little further at the front
  s+=`<path class="f-paper2" fill-opacity=".55" d="${band(edge(250,22),edge(1960,16))}"/>`;
  s+=`<path class="f-paper" fill-opacity=".6" d="${band(edge(330,26),edge(1900,20))}"/>`;
  s+=`<path class="f-washedge" fill-opacity=".14" d="${band(edge(420,30),edge(1985,14))}"/>`;
  const B=Batch();
  // brush-hair streaks through the body
  for(let i=0;i<46;i++){const y=R(0,H),x=R(240,1700),l=R(160,620);B.mark(rnd()<.5?'paper2':'washedge',`M${f1(x)} ${f1(y)}q${f1(l*.5)} ${f1(J(3))} ${f1(l)} ${f1(J(2))}`,R(1,2.6),rnd()<.5?.18:.1);}
  // the leading edge: pigment pooled in a darker rim, beaded where it gathered
  const rim=R0.map(([x,y])=>[x,y]),inner=R0.map(([x,y])=>[x-R(8,18),y]);
  s+=`<path class="f-washedge" fill-opacity=".55" d="${band(inner,rim)}"/>`;
  for(let i=0;i<R0.length-1;i++){
    const [ax,ay]=R0[i],[bx,by]=R0[i+1];
    for(let k=0;k<2;k++){
      const t=rnd(),x=ax+(bx-ax)*t-R(1,4),y=ay+(by-ay)*t,r=R(2.2,5.5);
      B.fill('washedge',`M${f1(x-r)} ${f1(y)}a${f1(r)} ${f1(r*.9)} 0 1 0 ${f1(r*2)} 0a${f1(r)} ${f1(r*.9)} 0 1 0 ${f1(-r*2)} 0`,.75);
    }
  }
  B.ink(rim.map((p,i)=>(i?'L':'M')+f1(p[0])+' '+f1(p[1])).join(''),1.2,.22);
  // the trailing edge: dry-brush streaks breaking away to the left, and drips running down from the edge
  for(let i=0;i<70;i++){const y=R(-10,H+10),x1=L0[Math.min(L0.length-1,Math.max(0,Math.round((y+30)/28)))][0]+R(10,40),l=R(40,190);
   for(let k=0,x=x1;k<RI(2,4)&&x>x1-l;k++){const seg=R(14,60);B.mark(rnd()<.6?'paper':'paper2',`M${f1(x)} ${f1(y+J(1))}h${f1(-seg)}`,R(1.4,3.6),R(.55,.95));x-=seg+R(6,22);}}
  for(let i=0;i<7;i++){
    const p=L0[RI(2,L0.length-3)],x=p[0]+R(2,10),y=p[1],l=R(26,70);
    B.fill('paper',`M${f1(x-3)} ${f1(y)}q${f1(-1)} ${f1(l*.6)} ${f1(1)} ${f1(l)}a4 4.6 0 1 0 6 0q2 ${f1(-l*.4)} 1 ${f1(-l)}z`,.95);
  }
  s+=B.out();
  return `<svg viewBox="0 0 ${WW} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${s}</svg>`;
 }
 // The sun as it shows through the paper of the task tag when it passes behind it: a pale disc, no rays.
 function tagSunArt(night=false){seed=17;const d=pth(ring(30,30,24,24,16),true,.6);return `<svg viewBox="0 0 60 60" aria-hidden="true" focusable="false">${fill(d,night?'moon':'sun',.42)}${ink(d,1.4,.22).replace('class="k"','class="k s-tagink"')}</svg>`;}
 function cardArt(place){
   const t=thumb(place);
   seed=60+PLACES.indexOf(place);
   const d=pth([[0,0],[120,0],[120,76],[0,76]],true,.8);
   return `<svg viewBox="-8 -8 136 94" aria-hidden="true" focusable="false"${t.night?' class="fr-nightart"':''}>`+
     fill(pth([[-6,-6],[126,-6],[126,82],[-6,82]],true,1),'tagshade',.5,2.4,3)+
     fill(pth([[-6,-6],[126,-6],[126,82],[-6,82]],true,1),'tag')+
     ink(pth([[-6,-6],[126,-6],[126,82],[-6,82]],true,1),1.4,.8).replace('class="k"','class="k s-tagink"')+
     t.svg+
     ink(d,1.4,.9)+
     '</svg>';
 }
 function miniArc(){return `<path class="fr-arc-line" d="M8 52Q80 -14 152 52" fill="none"/>`;}
 // The sheet of sky the module grows into (and folds back into): a hand-drawn edge round the room's own paper.
 function sheetArt(){
   seed=33;
   const d=pth([[0,0],[720,-3],[1440,0],[1443,450],[1440,900],[720,903],[0,900],[-3,450]],true,2);
   return `<svg viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="f-sky0" d="${d}"/><path class="k" d="${d}" stroke-width="3"/></svg>`;
 }
 const memo=fn=>{
   const m=new Map();
   return (...args)=>{const key=JSON.stringify(args);if(!m.has(key)){if(m.size>64)m.clear();m.set(key,fn(...args));}return m.get(key);};
 };
 const api={
   W,
   H,
   HZ,
   PLACES,
   NAMES,
   stage,
   thumb:memo(thumb),
   cardArt:memo(cardArt),
   seal:memo(seal),
   tagArt:memo(tagArt),
   bigTag:memo(bigTag),
   closeArt:memo(closeArt),
   pencilArt:memo(pencilArt),
   knobArt:memo(knobArt),
   pickerArt:memo(pickerArt),
   tallyArt:memo(tallyArt),
   washArt:memo(washArt),
   tagSunArt:memo(tagSunArt),
   sheetArt:memo(sheetArt),
   miniArc,
  // The sun's arc on the stage (t = 0..1, from the left end to the right end), as the top-left of its 80 px box. Values
  // a little outside 0..1 carry on along the same curve below the ridge: where the sun rises from and sets into.
  arc(t){const {x0,x1,cx,cy,y}=ARC,u=Math.max(-.08,Math.min(1.08,t));return [(1-u)*(1-u)*x0+2*(1-u)*u*cx+u*u*x1-40,(1-u)*(1-u)*y+2*(1-u)*u*cy+u*u*y-40];},
  miniPoint(t){const u=Math.max(0,Math.min(1,t));return [(1-u)*(1-u)*8+2*(1-u)*u*80+u*u*152,(1-u)*(1-u)*52+2*(1-u)*u*(-14)+u*u*52];}};
 root.ReserveFocusRoomArt=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
