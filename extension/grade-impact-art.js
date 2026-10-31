/* Grade impact drawings: the weighing room (a course opened on Grades) and the Home module. House style:
   wobbly ink from a seeded pen (the same line on every render, so nothing boils), offset washes, hatching,
   paper, kraft and brass. Colours are classes, so light, dark, the scene themes and Market kits repaint them.
   The heavy room is cached per size and drawn once; motion lives in stage() and only moves transform/opacity.
   Nothing here reads Canvas or decides a number: grade-impact.js hands over the escaped view. Creator: Flzsh. */
(function(root){
 'use strict';
 const R=n=>Math.round(n*10)/10;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Scores move in the points a teacher gives (grade-impact.js rounds the same way): a drag in tenths of a point under 10
 // points, halves to 200, whole points above; the arrows a point at a time (5 over 50, a twentieth over 200) and, with
 // Shift, a tenth, for a teacher's decimals.
 const ptsText=(f,pts)=>`${Math.round(f*pts*100)/100}/${pts}`;
 const pctText=f=>`${Math.round(f*1000)/10}%`;
 // (a knob's figure is smaller when it carries a tenth: 87.4%)
 const knobSize=label=>String(label).length>4?9.8:11;
 const onGrid=(f,pts,u)=>clamp(Math.round(Math.round(f*pts/u)*u*100)/100/pts,0,1);
 const snapF=(f,pts)=>pts>0?onGrid(f,pts,pts<10?.1:pts<=200?.5:1):Math.round(f*100)/100;
 const keyUnit=(pts,fine)=>fine?.1:pts<10?.5:pts<=50?1:pts<=200?5:Math.max(1,Math.round(pts/20));
 const keyStep=(pts,fine)=>pts>0?keyUnit(pts,fine)/pts:fine?.01:.05;
 const keySnap=(f,pts,fine)=>pts>0?onGrid(f,pts,keyUnit(pts,fine)):clamp(Math.round(f*100)/100,0,1);
 function rng(seed){let s=(seed>>>0)%2147483646+1;return ()=>(s=s*48271%2147483647)/2147483647;}
 function pen(seed){
  const r=rng(seed),J=a=>(r()*2-1)*a,pt=(x,y,a=.4)=>`${R(x+J(a))} ${R(y+J(a))}`;
  const seg=(x1,y1,x2,y2,a)=>`Q${pt((x1+x2)/2,(y1+y2)/2,a)} ${pt(x2,y2)}`;
  const o={r,J,pt,
   line(x1,y1,x2,y2,a=1){return `M${pt(x1,y1)}`+seg(x1,y1,x2,y2,a);},
   path(pts,close=false,a=.9){
     let d=`M${pt(pts[0][0],pts[0][1])}`;
     for(let i=1;i<pts.length;i++)d+=seg(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],a);
     if(close){const l=pts[pts.length-1];d+=seg(l[0],l[1],pts[0][0],pts[0][1],a)+'Z';}
     return d;
   },
   rect(x,y,w,h,a=.9){return o.path([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],true,a);},
   fill(pts,ox=0,oy=0,a=.8){return 'M'+pts.map(([x,y])=>pt(x+ox,y+oy,a)).join('L')+'Z';},
   box(x,y,w,h,ox=3,oy=4,a=1){return o.fill([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],ox,oy,a);},
   ell(cx,cy,rx,ry,a=.4){const k=.5523,P=(x,y)=>pt(x,y,a);return `M${P(cx+rx,cy)}C${P(cx+rx,cy+ry*k)} ${P(cx+rx*k,cy+ry)} ${P(cx,cy+ry)}C${P(cx-rx*k,cy+ry)} ${P(cx-rx,cy+ry*k)} ${P(cx-rx,cy)}C${P(cx-rx,cy-ry*k)} ${P(cx-rx*k,cy-ry)} ${P(cx,cy-ry)}C${P(cx+rx*k,cy-ry)} ${P(cx+rx,cy-ry*k)} ${P(cx+rx+J(a*1.5),cy+J(a*1.5))}`;},
   hatch(a0,a1,b0,b1,n,a=.5){let d='';for(let i=0;i<n;i++){const t=(i+.5)/n;d+=`M${pt(a0[0]+(a1[0]-a0[0])*t,a0[1]+(a1[1]-a0[1])*t,a)}L${pt(b0[0]+(b1[0]-b0[0])*t,b0[1]+(b1[1]-b0[1])*t,a)}`;}return d;},
   wave(x1,y,x2,amp=1.4,step=26){let d=`M${pt(x1,y)}`;for(let x=x1+step;x<x2+step;x+=step){const e=Math.min(x,x2);d+=`Q${pt(e-step/2,y+(r()<.5?-amp:amp),.3)} ${pt(e,y,.3)}`;}return d;}
  };
  return o;
 }
 const S=(d,c='gi-k',w=2)=>d?`<path class="${c}" d="${d}" stroke-width="${w}"/>`:'';
 const F=(d,c)=>d?`<path class="${c}" d="${d}"/>`:'';
 const T=(x,y,t,s=14,c='gi-t',a='start',w=600,extra='')=>`<text class="${c}" x="${R(x)}" y="${R(y)}" font-size="${s}" text-anchor="${a}" font-weight="${w}"${extra}>${t}</text>`;
 const G=(cls,body,extra='')=>`<g class="${cls}"${extra}>${body}</g>`;
 const at=(x,y,body,cls='',extra='')=>`<g${cls?` class="${cls}"`:''} transform="translate(${R(x)} ${R(y)})"${extra}>${body}</g>`;

 // ---------------------------------------------------------------- the room, by size
 // Every place on the bench is reserved here, so nothing drawn later can land on anything else: the window, the bar
 // and its lanes, the bench props (left to right), and the free stretch where the slips and the resting poise go.
 function layout(W,H){
  W=Math.max(640,Math.round(W||1200));H=Math.max(780,Math.round(H||820));
  const wide=W>=1360,mid=W>=980,bt=H-178;
  const wx=wide?64:mid?44:28,wy=150,ww=wide?224:mid?184:150,wh=Math.round(clamp(bt-196-wy,210,340));
  const by=Math.round(Math.min(330,260+Math.max(0,H-800)*.4)),bx=wx+ww+(mid?72:62);
  const right=wide?292:mid?72:52,bw=Math.max(280,W-right-bx);
  // Bench props: the ledger and lamp always; the pencil tin and inkwell from 820; the weights case and loupe from 1100.
  const tools=W>=820,kit=W>=1100,books=!wide&&mid;
  const slipX=kit?712:tools?470:356,slipR=wide?W-284:books?W-176:W-24;
  // Tall props (the lamp's chimney, the pencils and the ruler) stand no higher than lets a weight of 80 px hang its tag
  // clear of them (they shrink in a short room); anything heavier makes room() scale every weight down together.
  const ry=by+70,propH=Math.round(clamp(bt-ry-206,56,110)),lampS=Math.min(1,propH/112),tinS=Math.min(1,propH/140);
  const props=[{kind:'ledger',x0:38,x1:296,top:bt-62},{kind:'lamp',x0:302,x1:342,top:bt-Math.round(112*lampS)}];
  if(tools)props.push({kind:'tin',x0:350,x1:420,top:bt-Math.round(140*tinS)},{kind:'ink',x0:412,x1:446,top:bt-46});
  if(kit)props.push({kind:'case',x0:468,x1:600,top:bt-64},{kind:'loupe',x0:604,x1:674,top:bt-26});
  if(books)props.push({kind:'books',x0:W-160,x1:W-36,top:bt-62});
  // The middle ground where the cabinet has no wall (under 1360): the balance under its glass bell stands on the sill,
  // left of the plant's runners, and a ledge of brass bell weights and short books rests on the bar board's top edge
  // (its objects stay below the head's buttons and above the board's label row).
  const balance=wide?null:{x0:wx-18,x1:wx+ww-84,base:wy+wh};if(balance)balance.s=Math.min(.86,(balance.x1-balance.x0)/124);
  const lx1=Math.round(bx+bw+12),ledge=wide?null:{x0:Math.round(Math.max(bx+bw*.42,lx1-212)),x1:lx1,y:by-143};
  return {W,H,wide,mid,bt,wx,wy,ww,wh,by,bx,bw,ry,dado:bt-150,tools,kit,books,slipX,slipR,rest:slipX+56,lampS,tinS,props,balance,ledge};
 }
 // Where the sun stands in the day view at an hour (the window's own coordinates); the room moves it, it is never redrawn.
 function sunAt(L,hour){const {wx:x,wy:y,ww:w,wh:h}=L,t=clamp((hour-7)/11,0,1);return [R(x+w*(.18+.64*t)),R(y+h*(.46-.28*Math.sin(Math.PI*t)))];}

 // Far ground: plaster, cornice, wainscot.
 function wall(p,L){
  const {W,bt}=L;let s=F(`M0 0H${W}V${bt}H0Z`,'gi-wall');
  let d='';for(let i=0;i<Math.round(W/12);i++){const x=p.r()*W,y=34+p.r()*(bt-60),l=5+p.r()*13,a=p.r()-.5;d+=`M${R(x)} ${R(y)}q${R(l/2)} ${R(a*5-1)} ${R(l)} ${R(a*7)}`;}
  s+=S(d,'gi-kf',1.1);
  // A crack in the plaster runs out from the cornice, the kind every old room keeps.
  s+=S(p.path([[W*.58,26],[W*.585,40],[W*.578,52],[W*.59,66],[W*.586,74]],false,.6),'gi-kf',1);
  s+=F(`M0 0H${W}V20H0Z`,'gi-wall2')+S(p.line(0,20,W,20,1),'gi-k',1.7)+S(p.line(0,27,W,27,.8),'gi-ks',1.1)+S(p.line(0,4,W,4,.6),'gi-kl',1);
  let den='';for(let x=8;x<W;x+=22)den+=`M${R(x)} 20v6.5h10v-6.5`;s+=S(den,'gi-ks',1);
  const top=L.dado;s+=F(`M0 ${top}H${W}V${bt}H0Z`,'gi-wall2');
  s+=F(p.box(0,top-9,W,11,0,0,.5),'gi-oat')+S(p.line(0,top-9,W,top-9,1),'gi-k',1.8)+S(p.line(0,top+2,W,top+2,.8),'gi-k',1.3)+S(p.line(0,top-5,W,top-5,.6),'gi-kl',1);
  const pw=172;let o='',b='',h='';
  for(let x0=10;x0<W;x0+=pw){const x=x0+12,w=pw-24,y=top+20,hh=bt-top-34,ix=x+13,iy=y+12,iw=w-26,ih=hh-24;
   o+=p.rect(x,y,w,hh,.7)+p.rect(ix,iy,iw,ih,.5);b+=p.line(x,y,ix,iy,.2)+p.line(x+w,y,ix+iw,iy,.2)+p.line(x,y+hh,ix,iy+ih,.2)+p.line(x+w,y+hh,ix+iw,iy+ih,.2);
   h+=p.hatch([ix+iw+2,iy+3],[ix+iw+2,iy+ih-3],[x+w-2,y+6],[x+w-2,y+hh-6],7,.3);}
  s+=S(o,'gi-ks',1.2)+S(b,'gi-ks',.9)+S(h,'gi-kf',.9);
  return s;
 }

 // The window: casing, sash, a rolled blind, the sill with its plant, and six views (CSS shows the theme's one).
 function cloud(p,cx,cy,k,cls,x,w,dur){
  const pts=[[-46,4,24,14],[-20,-8,26,20],[10,-12,24,18],[36,0,22,14],[0,6,44,12]];let f='',o='';
  for(const [dx,dy,rx,ry]of pts){f+=p.ell(cx+dx*k,cy+dy*k,rx*k,ry*k,.6);}
  o+=p.path([[cx-66*k,cy+12*k],[cx+56*k,cy+12*k]],false,.6)+`M${R(cx-66*k)} ${R(cy+12*k)}C${R(cx-70*k)} ${R(cy-6*k)} ${R(cx-46*k)} ${R(cy-12*k)} ${R(cx-34*k)} ${R(cy-6*k)}C${R(cx-30*k)} ${R(cy-26*k)} ${R(cx+2*k)} ${R(cy-32*k)} ${R(cx+12*k)} ${R(cy-20*k)}C${R(cx+26*k)} ${R(cy-30*k)} ${R(cx+54*k)} ${R(cy-20*k)} ${R(cx+46*k)} ${R(cy-4*k)}C${R(cx+60*k)} ${R(cy-4*k)} ${R(cx+64*k)} ${R(cy+8*k)} ${R(cx+56*k)} ${R(cy+12*k)}`;
  // the clouds stand still in the window (the room never idles: a drift of 150-260 s was too slow to see and repainted
  // the whole drawing every frame)
  return `<g class="gi-cloudg ${cls}">${F(f,'gi-cloud')}${S(o,'gi-ks',1.1)}</g>`;
 }
 function trees(p,x0,x1,base,n,cls='gi-tree',ink='gi-ks'){
  let f='',o='',t='';for(let i=0;i<n;i++){const x=x0+(x1-x0)*(i+.3+p.r()*.4)/n,hh=10+p.r()*12,round=p.r()<.55;
   if(round){f+=p.ell(x,base-hh*.7,hh*.42,hh*.5,.4);o+=p.ell(x,base-hh*.7,hh*.42,hh*.5,.3);}
   else{f+=p.fill([[x,base-hh*1.15],[x+hh*.32,base-hh*.2],[x-hh*.32,base-hh*.2]]);o+=p.path([[x-hh*.32,base-hh*.2],[x,base-hh*1.15],[x+hh*.32,base-hh*.2]],true,.3);}
   t+=p.line(x,base-hh*.25,x,base,.2);}
  return F(f,cls)+S(o,ink,1)+S(t,ink,1.1);
 }
 function smoke(x,y,cls='gi-smoke'){let s='';for(let i=0;i<3;i++)s+=`<circle class="gi-loop ${cls}" cx="${R(x)}" cy="${R(y)}" r="${2.6+i*.4}" style="animation-delay:${-i*1.4}s"/>`;return s;}
 function dayView(p,x,y,w,h){
  let s=F(`M${x} ${y}h${w}v${h}h${-w}Z`,'gi-sky');
  // the sky's band of warmer light low down (a second wash, no gradient)
  s+=F(`M${x} ${y+h*.42}C${x+w*.4} ${y+h*.38} ${x+w*.7} ${y+h*.44} ${x+w} ${y+h*.4}V${y+h}H${x}Z`,'gi-sky2');
  // The sun is drawn once at the origin and stood at its hour by the svg's --gi-sx/--gi-sy, so the hour moving on slides
  // it instead of redrawing the room. No halo: a ring of short drawn rays, still lines.
  let rays='';for(let i=0;i<14;i++){const a=i/14*Math.PI*2+p.J(.08),r0=23+p.r()*2,r1=r0+(i%2?4:7);rays+=`M${R(Math.cos(a)*r0)} ${R(Math.sin(a)*r0)}L${R(Math.cos(a)*r1)} ${R(Math.sin(a)*r1)}`;}
  s+=`<g class="gi-sun-g">${S(rays,'gi-ksun',1.3)}${F(p.ell(0,0,18,18,.4),'gi-sun')}${S(p.ell(0,0,18,18,.3),'gi-ks',1)}${S(`M-9 -6q4 -5 10 -5`,'gi-kl',1.2)}</g>`;
  s+=cloud(p,x+w*.25,y+h*.18,.9,'gi-c1',x,w,150)+cloud(p,x+w*.72,y+h*.3,.62,'gi-c2',x,w,190)+cloud(p,x+w*.48,y+h*.08,.48,'gi-c3',x,w,240);
  const hz=y+h*.6;
  s+=F(`M${x} ${hz}C${x+w*.18} ${hz-34} ${x+w*.42} ${hz-14} ${x+w*.58} ${hz-26}S${x+w*.88} ${hz-36} ${x+w} ${hz-16}V${y+h}H${x}Z`,'gi-hill1');
  s+=S(p.hatch([x+w*.6,hz-22],[x+w*.92,hz-30],[x+w*.62,hz-8],[x+w*.94,hz-16],9,.3),'gi-kf',.9);
  const hz2=y+h*.7;
  s+=F(`M${x} ${hz2}C${x+w*.25} ${hz2-22} ${x+w*.5} ${hz2+4} ${x+w*.75} ${hz2-12}S${x+w*.95} ${hz2-6} ${x+w} ${hz2-4}V${y+h}H${x}Z`,'gi-hill2');
  s+=trees(p,x+4,x+w*.46,hz2-8,7)+trees(p,x+w*.7,x+w-2,hz2-6,4,'gi-tree2');
  // A farmhouse on the far hill; its chimney smokes (smoke is one of the things that never stops).
  const fx=x+w*.6,fy=hz2-14;
  s+=F(p.box(fx-10,fy-12,22,13,0,0,.3),'gi-house')+
    F(p.fill([[fx-13,fy-12],[fx+1,fy-22],[fx+15,fy-12]],0,0,.3),'gi-roof')+
    S(p.rect(fx-10,fy-12,22,13,.3)+p.path([[fx-13,fy-12],[fx+1,fy-22],[fx+15,fy-12]],false,.3)+p.line(fx-2,fy-5,fx-2,fy+1,.1)+p.rect(fx+4,fy-8,4,4,.1),'gi-ks',1)+
    F(p.box(fx+6,fy-25,4,8,0,0,.2),'gi-roof')+
    smoke(fx+8,fy-28);
  const lz=y+h*.82;
  s+=F(`M${x} ${lz}C${x+w*.3} ${lz-5} ${x+w*.65} ${lz+4} ${x+w} ${lz-3}V${y+h}H${x}Z`,'gi-water');
  s+=S(p.line(x,lz-1,x+w,lz-2,.8),'gi-ks',1);
  let sh='';for(let i=0;i<9;i++){const yy=lz+5+(i%3)*(h*.05),xx=x+((i*53)%Math.max(30,w-30))+8;sh+=p.line(xx,yy,xx+10+p.r()*14,yy,.3);}
  s+=`<g class="gi-loop gi-shimmer">${S(sh,'gi-kw',1.3)}</g>`;
  // Reeds at the near shore: individual blades.
  let rd='';for(let i=0;i<14;i++){const xx=x+6+i*5+p.r()*3,hh=10+p.r()*14;rd+=`M${R(xx)} ${R(y+h)}q${R(p.J(3))} ${R(-hh/2)} ${R(p.J(5))} ${R(-hh)}`;}
  s+=S(rd,'gi-kreed',1.2);
  // A bird crosses once when the room opens (the stage plays it).
  s+=`<g class="gi-bird" transform="translate(${R(x-30)} ${R(y+h*.3)})"><g class="gi-bird-in">${S('M-7 0q3.5 -5 7 0q3.5 -5 7 0','gi-k',1.6)}</g></g>`;
  return `<g class="gi-view gi-view-day">${s}</g>`;
 }
 function nightView(p,x,y,w,h){
  let s=F(`M${x} ${y}h${w}v${h}h${-w}Z`,'gi-nsky')+F(`M${x} ${y+h*.5}C${x+w*.4} ${y+h*.46} ${x+w*.7} ${y+h*.52} ${x+w} ${y+h*.48}V${y+h}H${x}Z`,'gi-nsky2');
  let st='';for(let i=0;i<34;i++){const sx=x+((i*61)%w),sy=y+((i*97)%Math.round(h*.55));st+=p.ell(sx,sy,i%6?.9:1.6,i%6?.9:1.6,.1);}s+=F(st,'gi-star');
  // The moon is the crescent the Focus room and the Review deck draw: a lit disc with the night sky over its far side,
  // inked along its lit edge, two pits on the lit part. (The pen still takes the draws the old rayed moon took, so the
  // hills, trees and water after it keep their lines.)
  const mx=x+w*.68,my=y+h*.24;for(let i=0;i<10;i++)p.r();
  const disc=p.ell(mx,my,17,17,.3),pits=p.ell(mx-8,my+4,3.4,3,.2)+p.ell(mx-3,my+10,2.2,2,.2)+p.ell(mx-11,my-5,1.6,1.4,.2);
  const arc=(cx,cy,r,a0,a1,n,wob,shut)=>{
    let d='';
    for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n,rr=r+Math.sin(i*2.3+cx*.01)*wob;d+=(i?'L':'M')+R(cx+Math.cos(a)*rr)+' '+R(cy+Math.sin(a)*rr);}
    return shut?d+'Z':d;
  };
  s+=F(disc,'gi-moon')+F(arc(mx+7,my-5,14.6,0,Math.PI*2,20,.25,true),'gi-nsky')+S(arc(mx,my,17.3,Math.PI*.13,Math.PI*1.45,16,.35),'gi-ks',1.1)+S(pits,'gi-ks',.9);
  s+=cloud(p,x+w*.3,y+h*.32,.55,'gi-c2 gi-nightcloud',x,w,220);
  const hz=y+h*.62;s+=F(`M${x} ${hz}C${x+w*.2} ${hz-30} ${x+w*.45} ${hz-12} ${x+w*.6} ${hz-24}S${x+w*.9} ${hz-32} ${x+w} ${hz-14}V${y+h}H${x}Z`,'gi-nhill')+trees(p,x+4,x+w*.5,y+h*.7,6,'gi-nhill2','gi-kf');
  const fx=x+w*.62,fy=y+h*.7-12;s+=F(p.box(fx-9,fy-10,18,11,0,0,.2),'gi-nhill2')+F(p.box(fx-4,fy-6,5,4,0,0,.1),'gi-lit');
  const lz=y+h*.8;s+=F(`M${x} ${lz}C${x+w*.3} ${lz-5} ${x+w*.65} ${lz+4} ${x+w} ${lz-3}V${y+h}H${x}Z`,'gi-nwater');
  let gl='';for(let i=0;i<8;i++){const yy=lz+5+i*(h*.022),xx=mx-14+p.J(10);gl+=p.line(xx,yy,xx+10+p.r()*12,yy,.2);}
  s+=`<g class="gi-loop gi-shimmer">${S(gl,'gi-kmoon',1.4)}</g>`;
  return `<g class="gi-view gi-view-night">${s}</g>`;
 }
 function seaView(p,x,y,w,h){
  let s=F(`M${x} ${y}h${w}v${h}h${-w}Z`,'gi-sea')+F(`M${x} ${y+h*.45}C${x+w*.4} ${y+h*.42} ${x+w*.7} ${y+h*.48} ${x+w} ${y+h*.44}V${y+h}H${x}Z`,'gi-sea2');
  for(let i=0;i<3;i++){const rx=x+w*(.2+i*.28);s+=F(p.fill([[rx,y],[rx+18,y],[rx+48,y+h*.8],[rx+22,y+h*.8]],0,0,.5),'gi-ray');}
  s+=F(`M${x} ${y+h*.84}C${x+w*.3} ${y+h*.8} ${x+w*.6} ${y+h*.88} ${x+w} ${y+h*.82}V${y+h}H${x}Z`,'gi-sand');
  let rp='';for(let i=0;i<6;i++){const xx=x+10+i*w/6;rp+=`M${R(xx)} ${R(y+h*.92)}q6 -3 12 0`;}s+=S(rp,'gi-ks',1);
  let kp='';for(let k=0;k<4;k++){const kx=x+w*(.1+k*.25),kh=h*(.32+p.r()*.18);let d=`M${R(kx)} ${R(y+h*.86)}`;for(let j=1;j<=5;j++)d+=`q${R((j%2?8:-8))} ${R(-kh/10)} 0 ${R(-kh/5)}`;kp+=d;}
  s+=S(kp,'gi-kelp',2.2);
  s+=F(p.ell(x+w*.78,y+h*.86,20,10,.5)+p.ell(x+w*.3,y+h*.9,14,7,.4),'gi-rock')+S(p.ell(x+w*.78,y+h*.86,20,10,.4),'gi-ks',1);
  for(let i=0;i<6;i++)s+=`<circle class="gi-loop gi-bubble" cx="${R(x+w*(.15+i*.14))}" cy="${R(y+h*.86)}" r="${R(2+(i%3))}" style="--gi-rise:${R(-h*.8)}px;animation-delay:${R(-i*1.3)}s"/>`;
  s+=`<g class="gi-bird gi-fish" transform="translate(${R(x-30)} ${R(y+h*.5)})"><g class="gi-bird-in">${F('M-12 0q8 -8 18 0q-10 8 -18 0zM6 0l8 -6v12z','gi-fishf')}${S('M-12 0q8 -8 18 0q-10 8 -18 0zM6 0l8 -6v12z','gi-k',1.2)}</g></g>`;
  return `<g class="gi-view gi-view-sea">${s}</g>`;
 }
 function starryView(p,x,y,w,h){
  let s=F(`M${x} ${y}h${w}v${h}h${-w}Z`,'gi-ssky');
  let sw='';for(let i=0;i<5;i++){const cy=y+h*(.12+i*.1),cx=x+w*(.1+(i%2)*.3);sw+=`M${R(cx)} ${R(cy)}c${R(w*.15)} -14 ${R(w*.3)} 14 ${R(w*.45)} 0s${R(w*.3)} -12 ${R(w*.42)} 4`;}
  s+=S(sw,'gi-swirl',4)+S(`M${R(x+w*.45)} ${R(y+h*.3)}c14 -14 32 -2 22 12c-8 10 -24 2 -16 -8`,'gi-swirl',4);
  for(const [a,b,r]of [[.2,.16,13],[.62,.12,10],[.8,.34,15],[.4,.42,9]]){s+=`<circle class="gi-sstar-ring" cx="${R(x+w*a)}" cy="${R(y+h*b)}" r="${r}" stroke-width="4" stroke-dasharray="6 4"/>`+F(p.ell(x+w*a,y+h*b,r*.45,r*.45,.3),'gi-sstar');}
  s+=F(`M${R(x+w*.86)} ${R(y+h*.1)}a16 16 0 1 0 12 26a13 13 0 1 1 -12 -26z`,'gi-sstar');
  s+=F(`M${x} ${y+h*.82}C${x+w*.3} ${y+h*.76} ${x+w*.6} ${y+h*.84} ${x+w} ${y+h*.78}V${y+h}H${x}Z`,'gi-village');
  for(let i=0;i<6;i++){const vx=x+w*(.35+i*.1),vy=y+h*.84;s+=F(p.fill([[vx-7,vy],[vx,vy-8],[vx+7,vy],[vx+7,vy+9],[vx-7,vy+9]],0,0,.2),'gi-village2')+F(p.box(vx-2,vy+2,3,3,0,0,.1),'gi-lit');}
  s+=F(`M${R(x+w*.14)} ${R(y+h)}C${R(x+w*.02)} ${R(y+h*.6)} ${R(x+w*.16)} ${R(y+h*.42)} ${R(x+w*.18)} ${R(y+h*.22)}C${R(x+w*.22)} ${R(y+h*.44)} ${R(x+w*.34)} ${R(y+h*.62)} ${R(x+w*.24)} ${R(y+h)}Z`,'gi-cypress');
  s+=cloud(p,x+w*.55,y+h*.55,.4,'gi-c3 gi-nightcloud',x,w,260);
  return `<g class="gi-view gi-view-starry">${s}</g>`;
 }
 function starsView(p,x,y,w,h){
  let s=F(`M${x} ${y}h${w}v${h}h${-w}Z`,'gi-space')+F(p.ell(x+w*.3,y+h*.4,w*.32,h*.12,.6),'gi-nebula')+F(p.ell(x+w*.62,y+h*.62,w*.28,h*.1,.6),'gi-nebula2');
  let st='';for(let i=0;i<60;i++){const sx=x+((i*53)%w),sy=y+((i*97)%h);st+=p.ell(sx,sy,i%7?.8:1.8,i%7?.8:1.8,.1);}s+=F(st,'gi-star');
  const px=x+w*.7,py=y+h*.24;s+=F(p.ell(px,py,16,16,.3),'gi-planet')+S(p.ell(px,py,28,6,.3),'gi-kring',1.6)+S(p.ell(px,py,16,16,.3),'gi-ks',1);
  return `<g class="gi-view gi-view-stars">${s}</g>`;
 }
 function blueView(p,x,y,w,h){
  let s=F(`M${x} ${y}h${w}v${h}h${-w}Z`,'gi-bp');let g='';
  for(let i=1;i<10;i++)g+=`M${R(x+i*w/10)} ${y}V${y+h}`;for(let i=1;i<14;i++)g+=`M${x} ${R(y+i*h/14)}H${x+w}`;
  s+=S(g,'gi-bpg',.7);const cx=x+w/2,cy=y+h*.42;
  s+=S(
    p.line(cx-w*.36,cy,cx+w*.36,cy,.3)+
      p.path([[cx-10,cy+16],[cx,cy],[cx+10,cy+16]],true,.2)+
      p.line(cx-w*.36,cy,cx-w*.36,cy+40,.2)+
      p.line(cx+w*.36,cy,cx+w*.36,cy+40,.2)+
      `M${R(cx-w*.36-20)} ${R(cy+40)}q20 14 40 0M${R(cx+w*.36-20)} ${R(cy+40)}q20 14 40 0`,
    'gi-bpl',
    1.6);
  s+=S(`M${R(cx-w*.36)} ${R(cy-24)}H${R(cx+w*.36)}M${R(cx-w*.36)} ${R(cy-30)}v12M${R(cx+w*.36)} ${R(cy-30)}v12`,'gi-bpl',1)+`<circle class="gi-bpl" cx="${R(cx)}" cy="${R(cy+h*.3)}" r="${R(w*.18)}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
  return `<g class="gi-view gi-view-blue">${s}</g>`;
 }
 function plant(p,x,y){
  // A terracotta pot on the sill with a pothos: individual heart leaves, two runners trailing over the rim.
  let s=F(p.fill([[x-16,y-30],[x+16,y-30],[x+12,y],[x-12,y]],0,0,.4),'gi-pot')+F(p.fill([[x+4,y-30],[x+16,y-30],[x+12,y],[x+3,y]],0,0,.3),'gi-potd');
  s+=F(p.box(x-19,y-36,38,8,0,0,.3),'gi-pot')+
    S(p.rect(x-19,y-36,38,8,.3)+p.path([[x-16,y-28],[x-12,y],[x+12,y],[x+16,y-28]],false,.3),'gi-k',1.6)+
    S(p.hatch([x+6,y-24],[x+5,y-4],[x+13,y-24],[x+11,y-4],5,.2),'gi-ks',.9);
  s+=F(p.ell(x,y-36,16,3,.2),'gi-soil');
  const leaf=(lx,ly,ang,k=1)=>{
    const c=Math.cos(ang),sn=Math.sin(ang),P=(u,v)=>[lx+(u*c-v*sn)*k,ly+(u*sn+v*c)*k];
    const a=P(0,0),b=P(-7,-5),e=P(-6,-13),f=P(0,-17),g=P(6,-13),h=P(7,-5);
   return {f:`M${R(a[0])} ${R(a[1])}C${R(b[0])} ${R(b[1])} ${R(e[0])} ${R(e[1])} ${R(f[0])} ${R(f[1])}C${R(g[0])} ${R(g[1])} ${R(h[0])} ${R(h[1])} ${R(a[0])} ${R(a[1])}Z`,v:`M${R(a[0])} ${R(a[1])}L${R(P(0,-13)[0])} ${R(P(0,-13)[1])}`};};
  let lf='',lo='',lv='',st='';
  const upright=[[-6,-40,-.5],[4,-42,.3],[-12,-50,-.9],[10,-52,.7],[0,-56,0],[-4,-64,-.2],[8,-62,.5]];
  for(const [dx,dy,a]of upright){const L=leaf(x+dx,y+dy,a,.95);lf+=L.f;lo+=L.f;lv+=L.v;st+=p.line(x,y-36,x+dx,y+dy,.6);}
  // Runners: down the pot's face, a leaf every few px.
  for(const side of [-1,1]){
    let rx=x+side*14,ry=y-36,d=`M${R(rx)} ${R(ry)}`;
    for(let i=0;i<5;i++){const nx=rx+side*(3+p.r()*3),ny=ry+9;d+=`Q${R(rx+side*7)} ${R(ry+4)} ${R(nx)} ${R(ny)}`;const L=leaf(nx,ny,side*(1.8+p.J(.3)),.62);lf+=L.f;lo+=L.f;lv+=L.v;rx=nx;ry=ny;}
    st+=d;
  }
  s+=S(st,'gi-kleaf',1.2)+F(lf,'gi-leaf')+S(lo,'gi-k',1.1)+S(lv,'gi-kleaf',.8);
  return s;
 }
 function windowArt(p,L){
  const {wx:x,wy:y,ww:w,wh:h}=L;let s='';
  s+=F(p.box(x-14,y-14,w+28,h+30,7,8),'gi-shadow');
  s+=`<defs><clipPath id="gi-glass"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#gi-glass)">${dayView(p,x,y,w,h)}${nightView(p,x,y,w,h)}${seaView(p,x,y,w,h)}${starryView(p,x,y,w,h)}${starsView(p,x,y,w,h)}${blueView(p,x,y,w,h)}`;
  // Old glass: two soft streaks per pane and a small bubble in one.
  let gl='';for(const [px,py]of [[x+8,y+h*.1],[x+w/2+8,y+h*.1],[x+8,y+h*.6],[x+w/2+8,y+h*.6]])gl+=p.line(px,py+30,px+22,py,.3)+p.line(px+8,py+36,px+26,py+12,.3);
  s+=S(gl,'gi-kglass',1.6)+`</g>`;
  const mx=x+w/2,r1=y+h*.5;let bars=F(p.box(mx-4,y,8,h,0,0,.3),'gi-oat')+F(p.box(x,r1-5,w,10,0,0,.3),'gi-oat');
  bars+=F(p.box(x,y+h*.25-3,w,6,0,0,.3),'gi-oat')+F(p.box(x,y+h*.75-3,w,6,0,0,.3),'gi-oat');
  bars+=S(
    p.line(mx-4,y,mx-4,y+h,.4)+
      p.line(mx+4,y,mx+4,y+h,.4)+
      p.line(x,r1-5,x+w,r1-5,.4)+
      p.line(x,r1+5,x+w,r1+5,.4)+
      p.line(x,y+h*.25-3,x+w,y+h*.25-3,.3)+
      p.line(x,y+h*.25+3,x+w,y+h*.25+3,.3)+
      p.line(x,y+h*.75-3,x+w,y+h*.75-3,.3)+
      p.line(x,y+h*.75+3,x+w,y+h*.75+3,.3),
    'gi-k',
    1.3);
  // The sash lock on the meeting rail.
  bars+=F(p.box(mx-7,r1-8,14,5,0,0,.2),'gi-brass')+S(p.rect(mx-7,r1-8,14,5,.2),'gi-k',1);
  s+=bars;
  const fr=`M${x-14} ${y-14}H${x+w+14}V${y+h}H${x-14}ZM${x} ${y}V${y+h}H${x+w}V${y}Z`;
  s+=`<path class="gi-oat" fill-rule="evenodd" d="${fr}"/>`+
    S(p.rect(x-14,y-14,w+28,h+14,.7),'gi-k',2.2)+
    S(p.rect(x,y,w,h,.5),'gi-k',1.7)+
    S(p.line(x-14,y-14,x,y,.2)+p.line(x+w+14,y-14,x+w,y,.2),'gi-ks',1);
  s+=S(p.hatch([x+w+2,y+4],[x+w+2,y+h-4],[x+w+12,y-8],[x+w+12,y+h-4],16,.3),'gi-kf',.9);
  // The roller blind, rolled up: a cloth cylinder with its folds, a short drop, a hem bar and a pull cord with a ring.
  const by=y+2;s+=F(p.box(x+4,by,w-8,12,0,0,.3),'gi-cloth')+S(p.rect(x+4,by,w-8,12,.4),'gi-k',1.5)+S(p.line(x+8,by+4,x+w-8,by+4,.4)+p.line(x+8,by+8,x+w-10,by+8,.4),'gi-kcloth',1);
  s+=F(`M${x+6} ${by+12}H${x+w-6}L${x+w-8} ${by+26}Q${x+w*.5} ${by+30} ${x+8} ${by+26}Z`,'gi-cloth')+S(`M${x+6} ${by+12}L${x+8} ${by+26}Q${R(x+w*.5)} ${by+30} ${x+w-8} ${by+26}L${x+w-6} ${by+12}`,'gi-k',1.4);
  let folds='';for(let i=1;i<6;i++){const fx=x+i*w/6;folds+=`M${R(fx)} ${by+13}q${R(p.J(2))} 7 ${R(p.J(2))} ${R(13+p.r()*3)}`;}s+=S(folds,'gi-kcloth',1);
  s+=F(p.box(x+6,by+25,w-12,4,0,0,.2),'gi-benchd')+`<g class="gi-pull" style="transform-origin:${R(x+w*.5)}px ${by+29}px">${S(`M${R(x+w*.5)} ${by+29}v22`,'gi-k',1.1)}${F(p.ell(x+w*.5,by+55,3.6,3.6,.2),'gi-brass')}${S(p.ell(x+w*.5,by+55,3.6,3.6,.2),'gi-k',1.5)}</g>`;
  // The sill, its apron and two small brackets; the plant stands on it.
  const sy=y+h;s+=F(p.box(x-24,sy,w+48,13,0,0,.3),'gi-oat')+S(p.rect(x-24,sy,w+48,13,.5),'gi-k',2)+S(p.line(x-22,sy+3,x+w+22,sy+3,.4),'gi-kl',1);
  s+=F(p.box(x-8,sy+13,w+16,10,0,0,.3),'gi-oat')+S(p.rect(x-8,sy+13,w+16,10,.3),'gi-k',1.5)+S(`M${x+6} ${sy+23}q0 12 10 14M${x+w-6} ${sy+23}q0 12 -10 14`,'gi-k',1.4);
  s+=plant(p,x+w-32,sy);
  return s;
 }
 function lightShaft(p,L,hour){
  const {wx,wy,ww,wh,bt}=L,t=clamp((hour-7)/11,0,1),reach=300+300*t,x=wx+ww;
  let s=F(p.fill([[x,wy+10],[x+reach,bt],[x+reach*.42,bt],[x,wy+wh]],0,0,1.5),'gi-light');
  s+=F(p.fill([[x,wy+wh*.25],[x+reach*.82,bt],[x+reach*.58,bt],[x,wy+wh*.78]],0,0,1.2),'gi-light2');
  // The sash bars' shadow inside the patch of light.
  s+=F(p.fill([[x,wy+wh*.5-3],[x+reach*.72,bt-2],[x+reach*.68,bt-2],[x,wy+wh*.5+3]],0,0,.6),'gi-lightbar');
  let m='';for(let i=0;i<18;i++){const u=p.r(),v=.15+p.r()*.7,px=x+reach*(.25+.6*v)*u+8,py=wy+40+(bt-wy-60)*v;m+=`<circle class="gi-mote" cx="${R(px)}" cy="${R(py)}" r="${R(.9+p.r()*1.3)}"/>`;}
  return s+`<g class="gi-motes">${m}</g>`;
 }
 // Where the shaft lands: a lighter parallelogram on the bench top (it leans further right as the top comes toward the
 // eye), with the meeting rail's dark bar across it.
 function landing(p,L,hour){
  const {wx,ww,bt}=L,t=clamp((hour-7)/11,0,1),reach=300+300*t,x=wx+ww,dx=R(22-8*t),a=x+reach*.42,b=x+reach,c=x+reach*.58,d=x+reach*.82,m=x+reach*.7;
  return F(p.fill([[a,bt+1],[b,bt+1],[b+dx,bt+23],[a+dx,bt+23]],0,0,.7),'gi-light')+
    F(p.fill([[c,bt+1],[d,bt+1],[d+dx,bt+23],[c+dx,bt+23]],0,0,.5),'gi-light2')+
    F(p.fill([[m-2.5,bt+1],[m+2.5,bt+1],[m+2.5+dx,bt+23],[m-2.5+dx,bt+23]],0,0,.3),'gi-lightbar');
 }
 function thermometer(p,x,y){
  let s=F(p.box(x,y,26,156,4,5),'gi-shadow')+F(p.box(x,y,26,156,0,0,.3),'gi-oat')+S(p.rect(x,y,26,156,.4),'gi-k',1.8);
  s+=F(p.box(x+10,y+14,6,118,0,0,.1),'gi-glassf')+
    S(p.rect(x+10,y+14,6,118,.2),'gi-k',1.2)+
    F(p.box(x+11,y+72,4,64,0,0,.1),'gi-red')+
    F(p.ell(x+13,y+138,6.5,6.5,.2),'gi-red')+
    S(p.ell(x+13,y+138,6.5,6.5,.2),'gi-k',1.4);
  let tk='';for(let i=0;i<12;i++){const yy=y+20+i*9.5;tk+=`M${x+4} ${R(yy)}h${i%4?3:5}`;}s+=S(tk,'gi-ks',1);
  s+=S(p.ell(x+13,y+6,2,2,.1)+p.ell(x+13,y+150,2,2,.1),'gi-k',1)+S(p.line(x+12,y+5,x+14,y+7,.1),'gi-k',.8);
  return s;
 }
 function bellWeight(p,cx,base,wd,cls='gi-brass',shade='gi-brassd',knob=true){
  const h=wd*1.05,
    y0=base-h,
    pts=[[cx-wd*.2,y0],[cx+wd*.2,y0],[cx+wd*.18,y0+h*.14],[cx+wd*.4,y0+h*.36],[cx+wd*.5,y0+h*.88],[cx+wd*.52,base],[cx-wd*.52,base],[cx-wd*.5,y0+h*.88],[cx-wd*.4,y0+h*.36],[cx-wd*.18,y0+h*.14]];
  let s=F(p.fill(pts,0,0,.25),cls)+
    F(p.fill([[cx+wd*.06,y0],[cx+wd*.2,y0],[cx+wd*.18,y0+h*.14],[cx+wd*.4,y0+h*.36],[cx+wd*.5,y0+h*.88],[cx+wd*.52,base],[cx+wd*.18,base],[cx+wd*.16,y0+h*.36],[cx+wd*.06,y0+h*.14]],0,0,.2),shade);
  s+=S(p.path(pts,true,.3),'gi-k',1.3)+S(p.line(cx-wd*.5,y0+h*.88,cx+wd*.5,y0+h*.88,.2),'gi-k',1)+S(p.path([[cx-wd*.12,y0+h*.16],[cx-wd*.3,y0+h*.4],[cx-wd*.38,y0+h*.84]],false,.2),'gi-kl',1.2);
  if(knob)s+=F(p.ell(cx,y0-wd*.12,wd*.13,wd*.12,.15),cls)+S(p.ell(cx,y0-wd*.12,wd*.13,wd*.12,.15),'gi-k',1.1);
  return s;
 }
 function shelf(p,L){
  const x0=L.W-262,x1=L.W-62,y=L.by-34;let s=F(p.box(x0,y,x1-x0,11,4,5),'gi-shadow');
  s+=F(p.box(x0,y,x1-x0,11,0,0,.3),'gi-bench')+S(p.rect(x0,y,x1-x0,11,.4),'gi-k',1.8)+S(p.wave(x0+6,y+5,x1-6,.8,30),'gi-kg',.9);
  for(const bx of [x0+22,x1-22])
    s+=F(p.fill([[bx-3,y+11],[bx+3,y+11],[bx+3,y+48],[bx-3,y+48]],0,0,.2),'gi-benchd')+
      F(p.fill([[bx+3,y+11],[bx+3,y+20],[bx+26,y+11]],0,0,.2),'gi-benchd')+
      S(p.path([[bx-3,y+11],[bx-3,y+48],[bx+3,y+48],[bx+3,y+20],[bx+26,y+11]],false,.3),'gi-k',1.4)+
      S(p.ell(bx,y+40,1.6,1.6,.1),'gi-k',1);
  let x=x0+16;for(const wd of [12,16,21]){s+=bellWeight(p,x+wd/2,y,wd);x+=wd+8;}
  // The assay tables: cloth-bound volumes against a bookend, the last one leaning.
  s+=books(p,x+10,y,5);
  return s;
 }
 function cabinet(p,L){
  const w=190,x=L.W-250,h=236,y=L.bt-h;let s=F(p.box(x,y,w,h,7,6),'gi-shadow');
  s+=F(p.fill([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],0,0,.4),'gi-cab')+F(p.fill([[x-12,y+8],[x,y],[x,y+h],[x-12,y+h-4]],0,0,.3),'gi-cabd');
  s+=S(p.rect(x,y,w,h,.5)+p.path([[x,y],[x-12,y+8],[x-12,y+h-4],[x,y+h]],false,.3),'gi-k',2);
  s+=F(p.box(x-16,y-12,w+22,12,0,0,.3),'gi-cab')+S(p.rect(x-16,y-12,w+22,12,.3),'gi-k',1.8)+S(p.line(x-14,y-8,x+w+4,y-8,.3),'gi-kl',1);
  s+=F(p.box(x-4,y+h-14,w+8,14,0,0,.2),'gi-cabd')+S(p.rect(x-4,y+h-14,w+8,14,.2),'gi-k',1.5);
  let dr='',pl='',kb='',cards='';const cw=(w-24)/2,rh=(h-34)/5;
  for(let r=0;r<5;r++)
    for(let c=0;c<2;c++){
      const dx=x+8+c*(cw+8),dy=y+8+r*rh,dw=cw,dh=rh-6;
      dr+=p.rect(dx,dy,dw,dh,.4);
      pl+=p.box(dx+dw/2-14,dy+6,28,11,0,0,.2);
      cards+=`M${R(dx+dw/2-10)} ${R(dy+10)}h${R(12+p.r()*6)}M${R(dx+dw/2-10)} ${R(dy+14)}h${R(8+p.r()*6)}`;
      kb+=p.ell(dx+dw/2,dy+dh-8,3.6,3.6,.2);
    }
  s+=S(dr,'gi-k',1.4)+F(pl,'gi-brass')+S(pl,'gi-k',1)+S(cards,'gi-ks',.8)+F(kb,'gi-brass')+S(kb,'gi-k',1.1);
  s+=S(p.hatch([x-11,y+14],[x-11,y+h-10],[x-1,y+8],[x-1,y+h-6],22,.3),'gi-kf',.9);
  return s+balanceArt(p,x+w/2,y-12);
 }
 // A balance under a glass bell: base, pillar, beam, two pans on their threads. It feels a weight land on the rail.
 function balanceArt(p,cx,b){
  let s=F(p.box(cx-58,b-8,124,8,4,-3,.2),'gi-shadow')+F(p.box(cx-62,b-8,124,8,0,0,.2),'gi-benchd')+S(p.rect(cx-62,b-8,124,8,.2),'gi-k',1.4)+S(p.wave(cx-58,b-4,cx+58,.5,16),'gi-kg',.8);
  s+=S(p.line(cx,b-8,cx,b-76,.2),'gi-k',1.6)+F(p.box(cx-3,b-80,6,8,0,0,.1),'gi-brassd');
  let beam=S(p.line(cx-44,b-75,cx+44,b-77,.3)+p.path([[cx-6,b-78],[cx,b-86],[cx+6,b-78]],false,.1)+`M${cx} ${b-76}v18`,'gi-k',1.6);
  for(const side of [-1,1]){const px=cx+side*44,py=b-76;beam+=`<g class="gi-pan" style="transform-origin:${R(px)}px ${R(py)}px">${S(`M${R(px)} ${R(py)}L${R(px-12)} ${R(py+42)}M${R(px)} ${R(py)}L${R(px+12)} ${R(py+42)}`,'gi-ks',.9)}${F(`M${R(px-15)} ${R(py+42)}q15 9 30 0z`,'gi-brass')}${S(`M${R(px-15)} ${R(py+42)}q15 9 30 0z`,'gi-k',1.2)}${side<0?F(p.box(px-5,py+34,10,7,0,0,.1),'gi-brass')+S(p.rect(px-5,py+34,10,7,.1),'gi-k',1):''}</g>`;}
  s+=`<g class="gi-beam" style="transform-origin:${cx}px ${b-76}px">${beam}</g>`;
  s+=F(`M${cx-58} ${b-8}C${cx-62} ${b-120} ${cx+62} ${b-120} ${cx+58} ${b-8}Z`,'gi-glassf')+S(`M${cx-58} ${b-8}C${cx-62} ${b-120} ${cx+62} ${b-120} ${cx+58} ${b-8}`,'gi-k',1.6)+S(`M${cx-44} ${b-24}C${cx-48} ${b-80} ${cx-20} ${b-98} ${cx-6} ${b-100}`,'gi-kglass',2.2)+F(p.ell(cx,b-98,6,4,.2),'gi-glassf')+S(p.ell(cx,b-98,6,4,.2),'gi-k',1.3);
  // The window, small and bent, on the bell's shoulder; the bell's rim where it sits in its groove.
  s+=S(`M${cx+26} ${b-74}l7 -3l1 6l-7 3zM${cx+29.5} ${b-75.5}l1 6M${cx+26.5} ${b-71}l7 -3`,'gi-kl',.9)+S(p.line(cx-58,b-10,cx+58,b-10,.3),'gi-ks',1);
  return s;
 }
 // Under 1360 the balance stands on the window sill, scaled to the room left of the plant.
 function sillBalance(p,L){const B=L.balance;if(!B)return '';const cx=(B.x0+B.x1)/2,s=R(B.s*1000)/1000;
  return `<g transform="translate(${R(cx)} ${R(B.base)}) scale(${s}) translate(${R(-cx)} ${R(-B.base)})">${balanceArt(p,cx,B.base)}</g>`;}
 // A ledge resting on the bar board's top edge: three brass bell weights, a squat assay cup and short cloth books.
 function ledgeArt(p,L){
  const E=L.ledge;if(!E)return '';const {x0,x1,y}=E;let s=F(p.box(x0,y,x1-x0,11,5,4),'gi-shadow');
  s+=F(p.box(x0,y,x1-x0,11,0,0,.3),'gi-bench')+S(p.rect(x0,y,x1-x0,11,.4),'gi-k',1.7)+S(p.wave(x0+6,y+5,x1-6,.7,26),'gi-kg',.9)+S(p.line(x0+3,y+2,x1-3,y+2,.4),'gi-kl',1);
  let x=x0+14;for(const wd of [12,16,21]){s+=F(p.fill([[x+wd*.2,y],[x+wd+3,y],[x+wd+6,y-wd*.6],[x+wd*.5+4,y-wd*.9]],0,0,.2),'gi-shadow')+bellWeight(p,x+wd/2,y,wd);x+=wd+9;}
  // the assay cup: a squat brass crucible on its three feet
  const cx=x+12;
  s+=F(p.fill([[cx-11,y-4],[cx+11,y-4],[cx+8,y-19],[cx-8,y-19]],0,0,.2),'gi-brass')+
    F(p.fill([[cx+3,y-4],[cx+11,y-4],[cx+8,y-19],[cx+3,y-19]],0,0,.1),'gi-brassd')+
    S(p.path([[cx-11,y-4],[cx-8,y-19],[cx+8,y-19],[cx+11,y-4]],true,.2)+`M${R(cx-8)} ${y-4}v4M${R(cx)} ${y-4}v4M${R(cx+8)} ${y-4}v4`,'gi-k',1.2)+
    S(p.ell(cx,y-19,8,2,.1),'gi-k',1)+
    S(`M${R(cx-6)} ${y-15}l2 7`,'gi-kl',1);
  x=cx+22;const nb=Math.min(5,Math.floor((x1-x-24)/19));if(nb>=2)s+=books(p,x+8,y,nb,true,22,14);
  return s;
 }
 function ledger(p,x,y){
  let s=F(p.fill([[x-6,y],[x-6,y-9],[x+6,y-50],[x+60,y-60],[x+120,y-56],[x+180,y-60],[x+234,y-50],[x+246,y-9],[x+246,y]],12,-4,.7),'gi-shadow')+F(p.ell(x+122,y+2,128,3,.3),'gi-shadow');
  s+=F(p.box(x-6,y-9,252,9,0,0,.3),'gi-cover')+S(p.rect(x-6,y-9,252,9,.3),'gi-k',1.6);
  const left=`M${x} ${y-8}C${x+40} ${y-14} ${x+90} ${y-12} ${x+118} ${y-10}L${x+120} ${y-56}C${x+92} ${y-62} ${x+40} ${y-58} ${x+6} ${y-50}Z`;
  const right=`M${x+122} ${y-10}C${x+150} ${y-12} ${x+200} ${y-14} ${x+240} ${y-8}L${x+234} ${y-50}C${x+200} ${y-58} ${x+150} ${y-62} ${x+120} ${y-56}Z`;
  s+=F(left,'gi-page')+F(right,'gi-page')+S(left+right,'gi-k',1.7);
  s+=S(`M${x+2} ${y-6}C${x+40} ${y-11} ${x+90} ${y-9} ${x+118} ${y-7}M${x+122} ${y-7}C${x+150} ${y-9} ${x+200} ${y-11} ${x+238} ${y-5}`,'gi-ks',.9);
  let rl='',hw='';for(let i=0;i<6;i++){const t=(i+1)/7;rl+=`M${R(x+6+2*t)} ${R(y-50+42*t)}C${R(x+40)} ${R(y-57+44*t)} ${R(x+90)} ${R(y-60+48*t)} ${R(x+118)} ${R(y-56+44*t)}`;rl+=`M${R(x+122)} ${R(y-56+44*t)}C${R(x+150)} ${R(y-60+48*t)} ${R(x+200)} ${R(y-57+44*t)} ${R(x+234-2*t)} ${R(y-50+42*t)}`;
   const yy=y-52+44*t;hw+=p.wave(x+14,yy-2,x+56+p.r()*40,1.1,7)+p.wave(x+132,yy-2,x+170+p.r()*44,1.1,7);hw+=`M${R(x+100)} ${R(yy-3)}h8M${R(x+214)} ${R(yy-3)}h10`;}
  s+=S(rl,'gi-kf',.9)+S(hw,'gi-kink',1);
  s+=F(`M${x+119} ${y-56}l4 0l6 60l-4 4l-4 -4z`,'gi-clay')+S(`M${x+119} ${y-56}l4 0l6 60l-4 4l-4 -4`,'gi-k',1);
  // The page that turns when Canvas sends new numbers (the stage plays it).
  s+=`<g class="gi-ledger-turn" style="transform-origin:${x+120}px ${y-10}px">${F(right,'gi-page')}${S(right,'gi-k',1.4)}</g>`;
  // A fountain pen lies across the near page.
  s+=F(p.fill([[x+150,y-14],[x+246,y-34],[x+250,y-29],[x+154,y-9]],0,0,.2),'gi-inkf')+
    F(p.fill([[x+224,y-29],[x+232,y-31],[x+234,y-26],[x+226,y-24]],0,0,.1),'gi-brass')+
    S(p.path([[x+150,y-14],[x+246,y-34],[x+250,y-29],[x+154,y-9]],true,.2),'gi-k',1.2)+
    S(`M${x+150} ${y-14}l-12 5l14 -1`,'gi-k',1.2);
  return s;
 }
 function lamp(p,x,y){
  // An oil lamp: brass foot, a glass font with oil in it, the collar, a wick knob and a tall chimney. At night it is lit.
  // Its shadow on the wainscot (away from the window) and where its foot meets the bench; its light is lampLight().
  let s=F(p.fill([[x-20,y],[x-20,y-10],[x-15,y-30],[x-12,y-62],[x-6,y-86],[x-6,y-104],[x+6,y-104],[x+6,y-86],[x+12,y-62],[x+16,y-30],[x+20,y-10],[x+20,y]],12,-4,.6),'gi-shadow')+
    F(p.ell(x+2,y+2,22,2.6,.2),'gi-shadow');
  s+=F(`M${x-20} ${y}C${x-20} ${y-10} ${x-8} ${y-14} ${x-6} ${y-18}H${x+6}C${x+8} ${y-14} ${x+20} ${y-10} ${x+20} ${y}Z`,'gi-brass')+S(`M${x-20} ${y}C${x-20} ${y-10} ${x-8} ${y-14} ${x-6} ${y-18}H${x+6}C${x+8} ${y-14} ${x+20} ${y-10} ${x+20} ${y}Z`,'gi-k',1.5);
  s+=F(p.ell(x,y-32,16,14,.3),'gi-glassf')+F(`M${x-15} ${y-28}Q${x} ${y-20} ${x+15} ${y-28}Q${x+14} ${y-20} ${x} ${y-18}Q${x-14} ${y-20} ${x-15} ${y-28}Z`,'gi-oil')+S(p.ell(x,y-32,16,14,.3),'gi-k',1.4)+S(`M${x-9} ${y-38}q3 -6 8 -6`,'gi-kglass',1.6);
  s+=F(p.box(x-9,y-50,18,5,0,0,.1),'gi-brass')+S(p.rect(x-9,y-50,18,5,.1),'gi-k',1.2)+F(p.ell(x+12,y-47,3,3,.1),'gi-brass')+S(p.ell(x+12,y-47,3,3,.1),'gi-k',1);
  s+=F(`M${x-7} ${y-50}C${x-14} ${y-62} ${x-14} ${y-76} ${x-6} ${y-86}V${y-104}H${x+6}V${y-86}C${x+14} ${y-76} ${x+14} ${y-62} ${x+7} ${y-50}Z`,'gi-glassf')+S(`M${x-7} ${y-50}C${x-14} ${y-62} ${x-14} ${y-76} ${x-6} ${y-86}V${y-104}H${x+6}V${y-86}C${x+14} ${y-76} ${x+14} ${y-62} ${x+7} ${y-50}`,'gi-k',1.4)+S(`M${x-8} ${y-58}q-3 -10 1 -20`,'gi-kglass',1.8);
  // A brass wick key's knurling, and the chimney's soot ring just under its lip.
  s+=S(`M${x+10.5} ${y-48.5}h3M${x+10.5} ${y-46}h3`,'gi-k',.7)+S(`M${x-5.5} ${y-100}h11`,'gi-ks',1.6);
  return s;
 }
 // The lamp's light, drawn where it lands, over the night's dusk: a flattened pool on the bench top only, a narrow fan
 // on the wainscot above the chimney, and warm re-strokes on the near edges of the ledger, the tin and the inkwell.
 // The flame and the chimney's smoke ride here too, so the dusk never dims them. Shown at night and in the dark look.
 function lampLight(p,L){
  const {bt}=L,x=322,k=L.lampS,yc=bt-104*k,fan=`M${R(x-5)} ${R(yc+2)}L${R(x+5)} ${R(yc+2)}L${R(x+25)} ${R(yc-62)}Q${x} ${R(yc-70)} ${R(x-25)} ${R(yc-62)}Z`;
  let s=F(fan,'gi-pool')+F(p.ell(x+16,bt+12,92,10,.4),'gi-pool');
  let edges=`M${44+240} ${bt-8}L${44+234} ${bt-50}`;
  if(L.tools){const t=L.tinS,tx=376-20*t;edges+=`M${R(tx)} ${bt}V${R(bt-52*t)}`+`M414 ${bt}V${bt-20}Q414 ${bt-28} 422 ${bt-30}`;}
  s+=S(edges,'gi-klamp',1.6);
  const flame=`<g class="gi-flame" style="transform-origin:${x}px ${bt-52}px"><g class="gi-loop gi-flame-in" style="transform-origin:${x}px ${bt-52}px">${F(`M${x} ${bt-52}c-6 -4 -5 -12 0 -20c5 8 6 16 0 20z`,'gi-flame-f')}${F(`M${x} ${bt-53}c-3 -2 -2 -7 0 -11c2 4 3 9 0 11z`,'gi-flame-c')}</g></g><g class="gi-lamp-smoke">${smoke(x,bt-110,'gi-smoke gi-lampsmoke')}</g>`;
  return `<g class="gi-lamplight gi-lamp-pool">${s}</g>`+(k>=.999?flame:`<g transform="translate(${x} ${bt}) scale(${R(k*1000)/1000}) translate(${-x} ${-bt})">${flame}</g>`);
 }
 // Books: cloth spines of different heights and widths, two bands and a title mark on each, the last one leaning on
 // an iron bookend.
 function books(p,x,base,n,lean=true,hMin=36,hRange=24){
  let s='',o='',bands='',marks='',xx=x;const tones=['gi-book1','gi-book2','gi-book3','gi-book4'],eh=Math.min(30,hMin-4);
  s+=F(p.fill([[x-8,base],[x-8,base-eh],[x-3,base-eh],[x-3,base-4],[x+4,base-4],[x+4,base]],0,0,.2),'gi-iron')+S(p.path([[x-8,base],[x-8,base-eh],[x-3,base-eh],[x-3,base-4]],false,.2),'gi-k',1.2);
  s=F(p.fill([[x+2,base],[x+2,base-hMin-hRange*.7],[x+14*n,base-hMin-hRange*.8],[x+14*n+hMin*.3,base-hMin*.6],[x+14*n+8,base]],11,-4,.6),'gi-shadow')+F(p.ell(x+7*n,base+2,7*n+6,2.4,.2),'gi-shadow')+s;
  for(let i=0;i<n;i++){const w=9+Math.round(p.r()*8),h=hMin+Math.round(p.r()*hRange),last=lean&&i===n-1,t=tones[(i*3+Math.round(p.r()*2))%4];
   const pts=last?[[xx,base],[xx+w,base],[xx+w+h*.32,base-h*.95],[xx+h*.32,base-h*.95]]:[[xx,base],[xx+w,base],[xx+w,base-h],[xx,base-h]];
   s+=F(p.fill(pts,0,0,.2),t);o+=p.path(pts,true,.25);
   const at=(u,v)=>last?[xx+u+(h*v)*.32/1,base-h*v*.95]:[xx+u,base-h*v];
   for(const v of [.14,.2,.8,.86]){const a=at(1.5,v),b=at(w-1.5,v);bands+=`M${R(a[0])} ${R(a[1])}L${R(b[0])} ${R(b[1])}`;}
   const m0=at(w/2,.34),m1=at(w/2,.68);marks+=`M${R(m0[0])} ${R(m0[1])}L${R(m1[0])} ${R(m1[1])}`;
   xx+=w+(last?0:1);}
  return s+S(o,'gi-k',1.3)+S(bands,'gi-kbook',1)+S(marks,'gi-kbook',1.8);
 }
 // The corner of the cornice keeps an old cobweb: radials and a few sagging rings.
 function cobweb(p,x,y,r){
  let d='';const n=5;for(let i=0;i<=n;i++){const a=Math.PI/2*i/n;d+=p.line(x,y,x-Math.cos(a)*r,y+Math.sin(a)*r,.4);}
  for(const k of [.35,.6,.85]){
    let ring='';
    for(let i=0;i<n;i++){
      const a0=Math.PI/2*i/n,a1=Math.PI/2*(i+1)/n,p0=[x-Math.cos(a0)*r*k,y+Math.sin(a0)*r*k],p1=[x-Math.cos(a1)*r*k,y+Math.sin(a1)*r*k],m=[(p0[0]+p1[0])/2+2,(p0[1]+p1[1])/2-2];
      ring+=`M${R(p0[0])} ${R(p0[1])}Q${R(m[0])} ${R(m[1])} ${R(p1[0])} ${R(p1[1])}`;
    }
    d+=ring;
  }
  return S(d,'gi-kf',.8);
 }
 function props(p,L){
  const {W,bt}=L;let s=ledger(p,44,bt);
  const scaleAt=(body,x,y,k)=>k>=.999?body:`<g transform="translate(${x} ${y}) scale(${R(k*1000)/1000}) translate(${-x} ${-y})">${body}</g>`;
  s+=`<g class="gi-lamp">${scaleAt(lamp(p,322,bt),322,bt,L.lampS)}</g>`;
  if(L.books)s+=books(p,W-150,bt,7);
  if(!L.tools)return s;
  // The pencil tin: a label band, four pencils with sharpened points, one eraser and its ferrule, and a ruler.
  const jx=356,t0=s.length;
  s+=F(p.fill([[jx,bt],[jx,bt-52],[jx+2,bt-112],[jx+22,bt-124],[jx+50,bt-140],[jx+60,bt-138],[jx+44,bt-52],[jx+40,bt]],12,-4,.6),'gi-shadow')+F(p.ell(jx+21,bt+2,24,2.4,.2),'gi-shadow');
  s+=F(p.box(jx,bt-52,40,52,0,0,.3),'gi-tin')+
    F(p.box(jx,bt-38,40,18,0,0,.2),'gi-manila')+
    S(p.rect(jx,bt-52,40,52,.3)+p.rect(jx,bt-38,40,18,.2),'gi-k',1.5)+
    S(p.ell(jx+20,bt-52,20,4,.2),'gi-k',1.2)+
    S(`M${jx+8} ${bt-30}h22M${jx+8} ${bt-25}h14`,'gi-ks',.9)+
    S(p.hatch([jx+30,bt-50],[jx+30,bt-40],[jx+38,bt-50],[jx+38,bt-40],3,.1),'gi-ks',.8);
  const pencils=[[jx+8,-8,64,'gi-pencil'],[jx+16,-2,72,'gi-pencil2'],[jx+25,6,60,'gi-pencil'],[jx+33,12,68,'gi-pencil2']];
  for(const [px,ang,len,c]of pencils){const a=ang*Math.PI/180,tx=px+Math.sin(a)*len,ty=bt-52-Math.cos(a)*len,nx=Math.cos(a)*3,ny=Math.sin(a)*3;
   s+=F(p.fill([[px-nx,bt-52-ny],[px+nx,bt-52+ny],[tx+nx,ty+ny],[tx-nx,ty-ny]],0,0,.1),c)+S(p.path([[px-nx,bt-52-ny],[tx-nx,ty-ny],[tx+nx,ty+ny],[px+nx,bt-52+ny]],false,.1),'gi-k',1.1);
   const ex=tx+Math.sin(a)*9,ey=ty-Math.cos(a)*9;
   s+=c==='gi-pencil2'?
     F(p.fill([[tx-nx,ty-ny],[tx+nx,ty+ny],[ex+nx,ey+ny],[ex-nx,ey-ny]],0,0,.1),'gi-eraser')+
       F(p.fill([[tx-nx,ty-ny],[tx+nx,ty+ny],[tx+nx+Math.sin(a)*3,ty+ny-Math.cos(a)*3],[tx-nx+Math.sin(a)*3,ty-ny-Math.cos(a)*3]],0,0,.1),'gi-brass'):
     F(p.fill([[tx-nx,ty-ny],[tx+nx,ty+ny],[ex,ey]],0,0,.1),'gi-wood')+F(p.ell(ex,ey,1.2,1.2,.05),'gi-inkf');
  }
  s+=F(p.fill([[jx+36,bt-52],[jx+52,bt-140],[jx+60,bt-138],[jx+44,bt-50]],0,0,.2),'gi-oat')+
    S(p.path([[jx+36,bt-52],[jx+52,bt-140],[jx+60,bt-138],[jx+44,bt-50]],true,.2),'gi-k',1.1)+
    S(p.hatch([jx+40,bt-58],[jx+52,bt-130],[jx+43,bt-58],[jx+55,bt-130],12,.05),'gi-ks',.8);
  s=s.slice(0,t0)+scaleAt(s.slice(t0),jx+20,bt,L.tinS);
  // The inkwell: thick glass, the ink inside, a cork.
  const ix=414;s+=F(p.fill([[ix,bt],[ix,bt-20],[ix+8,bt-30],[ix+8,bt-44],[ix+22,bt-44],[ix+22,bt-30],[ix+30,bt-20],[ix+30,bt]],10,-4,.4),'gi-shadow')+F(p.ell(ix+15,bt+2,17,2.2,.2),'gi-shadow');
  s+=F(`M${ix} ${bt}V${bt-20}Q${ix} ${bt-28} ${ix+8} ${bt-30}V${bt-36}H${ix+22}V${bt-30}Q${ix+30} ${bt-28} ${ix+30} ${bt-20}V${bt}Z`,'gi-glassf')+F(`M${ix+2} ${bt-2}V${bt-14}H${ix+28}V${bt-2}Z`,'gi-inkf')+S(`M${ix} ${bt}V${bt-20}Q${ix} ${bt-28} ${ix+8} ${bt-30}V${bt-36}H${ix+22}V${bt-30}Q${ix+30} ${bt-28} ${ix+30} ${bt-20}V${bt}Z`,'gi-k',1.4)+F(p.box(ix+9,bt-44,12,8,0,0,.1),'gi-wood')+S(p.rect(ix+9,bt-44,12,8,.1),'gi-k',1.1)+S(`M${ix+4} ${bt-22}q0 -4 4 -6`,'gi-kglass',1.6);
  if(!L.kit)return s;
  // A wooden case of small brass weights, lid open, felt lining, with its tweezers; a loupe beside it.
  const kx=470;
  s+=F(p.fill([[kx,bt],[kx,bt-26],[kx+10,bt-62],[kx+128,bt-62],[kx+118,bt-26],[kx+118,bt]],12,-4,.6),'gi-shadow')+F(p.ell(kx+60,bt+2,64,2.6,.3),'gi-shadow');
  s+=F(p.fill([[kx,bt-26],[kx+118,bt-26],[kx+128,bt-62],[kx+10,bt-62]],0,0,.3),'gi-benchd')+
    F(p.fill([[kx+6,bt-30],[kx+114,bt-30],[kx+121,bt-56],[kx+13,bt-56]],0,0,.2),'gi-felt')+
    S(p.path([[kx,bt-26],[kx+118,bt-26],[kx+128,bt-62],[kx+10,bt-62]],true,.3),'gi-k',1.5);
  s+=F(p.box(kx,bt-26,118,26,0,0,.3),'gi-bench')+S(p.rect(kx,bt-26,118,26,.3),'gi-k',1.6)+S(p.wave(kx+4,bt-13,kx+114,.8,18),'gi-kg',.8);
  let cx=kx+10;
  for(const wd of [16,13,11,9,7,6]){
    s+=F(p.ell(cx+wd/2,bt-27,wd/2+1,2.6,.1),'gi-felt')+
      F(p.box(cx,bt-27-wd*.8,wd,wd*.8,0,0,.1),'gi-brass')+
      S(p.rect(cx,bt-27-wd*.8,wd,wd*.8,.1),'gi-k',1)+
      F(p.ell(cx+wd/2,bt-29-wd*.8,wd*.16+1,wd*.12+1,.05),'gi-brass');
    cx+=wd+5;
  }
  s+=S(`M${kx+82} ${bt-30}l26 -8M${kx+82} ${bt-30}l26 -4`,'gi-k',1.2);
  const lx=kx+150;
  s+=F(p.ell(lx+10,bt-16,13,12,.2),'gi-shadow')+
    F(p.ell(lx+22,bt+1.5,30,2,.2),'gi-shadow')+
    F(p.fill([[lx+12,bt-6],[lx+52,bt-4],[lx+52,bt-1],[lx+12,bt-1]],0,0,.1),'gi-wood')+
    S(p.rect(lx+12,bt-6,40,5,.1),'gi-k',1.1)+
    F(p.ell(lx,bt-12,13,12,.2),'gi-glassf')+
    S(p.ell(lx,bt-12,13,12,.2),'gi-kbrass',2.6)+
    S(p.ell(lx,bt-12,13,12,.2),'gi-k',1)+
    S(`M${lx-6} ${bt-16}q3 -4 7 -4`,'gi-kglass',1.4);
  return s;
 }
 function bench(p,L){
  const {W,H,bt}=L,top=24,ap=46,fl=H-26;let s='';
  s+=F(`M0 ${fl}H${W}V${H}H0Z`,'gi-floor');
  let fb='';
  for(let y=fl+8;y<H;y+=9)fb+=p.line(0,y,W,y,.6);
  let fs='';
  for(let x=60;x<W;x+=150+p.r()*60)fs+=`M${R(x)} ${fl+((x|0)%2?8:17)}v9`;
  s+=S(fb+fs,'gi-ks',.9);
  s+=F(p.box(0,bt+top+ap,W,fl-bt-top-ap,0,0,1),'gi-shade');
  // Legs, the stretcher shelf, and what lives under the bench: a crate of spare iron and a coil of rope.
  const legs=[40,Math.round(W*.5)-17,W-74];let lg='',lgo='',lgr='';
  for(const x of legs){
    lg+=p.box(x,bt+top+ap,34,fl-bt-top-ap,0,0,.4);
    lgo+=p.rect(x,bt+top+ap,34,fl-bt-top-ap,.4)+p.line(x+5,bt+top+ap+4,x+5,fl-4,.3);
    lgr+=p.wave(x+14,bt+top+ap+20,x+14,.6,10)+`M${x+20} ${bt+top+ap+16}q2 30 -1 60q-2 30 1 ${R(fl-bt-top-ap-100)}`;
  }
  const sy=fl-46;s+=F(p.box(0,sy,W,12,0,0,.5),'gi-benchf')+S(p.line(0,sy,W,sy,.8)+p.line(0,sy+12,W,sy+12,.8),'gi-k',1.6);
  const cx=Math.round(W*.22);
  s+=F(p.box(cx,sy-58,110,58,0,0,.3),'gi-crate');
  let sl='';
  for(let i=1;i<4;i++)sl+=p.line(cx,sy-58+i*14.5,cx+110,sy-58+i*14.5,.3);
  s+=S(p.rect(cx,sy-58,110,58,.3)+sl+p.line(cx+6,sy-58,cx+6,sy,.2)+p.line(cx+104,sy-58,cx+104,sy,.2),'gi-k',1.5);
  s+=F(p.fill([[cx+18,sy-58],[cx+28,sy-72],[cx+44,sy-72],[cx+52,sy-58]],0,0,.2),'gi-iron')+
    F(p.fill([[cx+58,sy-58],[cx+64,sy-68],[cx+76,sy-68],[cx+82,sy-58]],0,0,.2),'gi-irond')+
    S(p.path([[cx+18,sy-58],[cx+28,sy-72],[cx+44,sy-72],[cx+52,sy-58]],false,.2)+p.path([[cx+58,sy-58],[cx+64,sy-68],[cx+76,sy-68],[cx+82,sy-58]],false,.2),'gi-k',1.3)+
    S(`M${cx+20} ${sy-36}h22M${cx+64} ${sy-22}h18`,'gi-kink',1.2);
  const rx=Math.round(W*.66);
  let rp='';
  for(let i=0;i<5;i++)rp+=p.ell(rx,sy-8-i*3.2,34-i*1.5,7-i*.3,.5);
  s+=F(p.ell(rx,sy-14,34,14,.4),'gi-rope')+S(rp,'gi-k',1.3)+S(`M${rx+30} ${sy-6}q14 4 22 0`,'gi-k',1.3);
  s+=F(lg,'gi-benchd')+S(lgo,'gi-k',1.8)+S(lgr,'gi-kg',.9);
  // The top slab and its apron: plank seams with nails, grain and knots; a lighter worn edge along the front.
  s+=F(`M0 ${bt}H${W}V${bt+top}H0Z`,'gi-bench')+F(`M0 ${bt+top}H${W}V${bt+top+ap}H0Z`,'gi-benchf');
  let gr='';for(let i=0;i<3;i++)gr+=p.wave(0,bt+6+i*6,W,1,40+i*8);for(let i=0;i<4;i++)gr+=p.wave(0,bt+top+8+i*9,W,1.2,48+i*6);
  let seams='',nails='';for(let x=210;x<W;x+=240+p.r()*60){seams+=p.line(x,bt+1,x+p.J(2),bt+top-1,.3);nails+=p.ell(x-8,bt+12,1.5,1.5,.05)+p.ell(x+8,bt+12,1.5,1.5,.05);}
  // (an apron joint never runs through the gradebook caption, "As Canvas reports it", x 90-242: that one stands over the
  // left leg's outer edge instead)
  for(let x=130;x<W;x+=310+p.r()*80){const jx=x>=80&&x<=256?72:x;seams+=p.line(jx,bt+top+1,jx,bt+top+ap-1,.3);nails+=p.ell(jx-7,bt+top+10,1.5,1.5,.05)+p.ell(jx-7,bt+top+ap-10,1.5,1.5,.05);}
  let kn='';for(let i=0;i<4;i++){const kx=80+p.r()*(W-160),ky=bt+top+16+p.r()*16;kn+=p.ell(kx,ky,7,3,.2)+p.ell(kx,ky,3.5,1.4,.1);}
  s+=S(gr,'gi-kg',.9)+S(seams,'gi-k',1.2)+F(nails,'gi-inkf')+S(kn,'gi-kg',1);
  s+=S(p.line(0,bt,W,bt,1)+p.line(0,bt+top,W,bt+top,.8)+p.line(0,bt+top+ap,W,bt+top+ap,.8),'gi-k',2.2)+S(p.line(0,bt+3,W,bt+3,.6),'gi-kl',1.4);
  return s;
 }
 // The room's layers. Everything that does not change with the hour is drawn once per size from one pen (so the hour
 // turning never redraws a line); each layer carries data-rd-own, so a render keeps its subtree instead of re-checking
 // thousands of paths. Only the shaft of light and where it lands belong to an hour: they cross-fade when it turns.
 // Order: far (wall, window, view), the shaft, mid (cabinet or sill balance, ledge), near (bench and its things), the
 // landing, the night's dusk over all of those, the lamp's light; the apparatus and the bench things come after.
 const envCache=new Map(),hourCache=new Map();
 const layer=(name,key,body)=>`<g class="gi-env gi-l-${name}" data-rd-key="gi-${name}-${key}" data-rd-own="${name}-${key}" aria-hidden="true">${body}</g>`;
 function environment(L){
  const key=`${L.W}x${L.H}`;let hit=envCache.get(key);if(hit)return hit;
  const p=pen(911+L.W*7+L.H*3);
  // The thermometer and the shelf hang where there is wall for them (wide rooms); narrower rooms keep a ledge on the board.
  const far=wall(p,L)+cobweb(p,L.W-2,28,46)+windowArt(p,L)+(L.wide?thermometer(p,14,L.wy+40)+shelf(p,L):'');
  const mid=L.wide?cabinet(p,L):sillBalance(p,L)+ledgeArt(p,L);
  hit={far:layer('far',key,far),mid:layer('mid',key,mid),near:layer('near',key,bench(p,L)+props(p,L)),
   dusk:layer('dusk',key,`<path class="gi-dusk" d="M0 0H${L.W}V${L.H}H0Z"/>`),lamp:layer('lamp',key,lampLight(p,L))};
  envCache.set(key,hit);if(envCache.size>3)envCache.delete(envCache.keys().next().value);
  return hit;
 }
 function hourLight(L,hour){
  const key=`${L.W}x${L.H}h${hour}`;let hit=hourCache.get(key);if(hit)return hit;
  const p=pen(373+L.W*5+L.H+hour*17);
  hit={shaft:layer('shaft',key,lightShaft(p,L,hour)),land:layer('land',key,landing(p,L,hour))};
  hourCache.set(key,hit);if(hourCache.size>4)hourCache.delete(hourCache.keys().next().value);
  return hit;
 }

 // ---------------------------------------------------------------- the apparatus (shared by room and module)
 const BAND_CLASS={A:'gi-band-a',B:'gi-band-b',C:'gi-band-c',D:'gi-band-d',F:'gi-band-f'};
 function scaleX(v,lo,hi,bx,bw){return bx+bw*(v-lo)/(hi-lo);}
 function bar(p,vm,bx,bw,by,o){
  // o: {k (scale), board, figures, interactive}
  const k=o.k||1,X=v=>scaleX(v,vm.lo,vm.hi,bx,bw),th=16*k;let s='';
  if(o.board){s+=F(p.box(bx-26*k,by-132*k,bw+52*k,116*k,5,6),'gi-shadow')+F(p.box(bx-26*k,by-132*k,bw+52*k,116*k,0,0,.4),'gi-board')+S(p.rect(bx-26*k,by-132*k,bw+52*k,116*k,.6),'gi-k',1.3);
   for(const [sx,sy]of [[bx-18*k,by-124*k],[bx+bw+18*k,by-124*k],[bx-18*k,by-24*k],[bx+bw+18*k,by-24*k]])
     s+=F(p.ell(sx,sy,3.2,3.2,.1),'gi-brass')+S(p.ell(sx,sy,3.2,3.2,.1)+p.line(sx-2,sy+1.5,sx+2,sy-1.5,.1),'gi-k',1);
   // The backing board is a planed plank: a bevel just inside its edge, long grain, two knots, and a small brass
   // maker's plate with its engraving (lines, no words).
   const x0=bx-26*k,y0=by-132*k,w0=bw+52*k,h0=116*k;s+=S(p.rect(x0+5,y0+5,w0-10,h0-10,.4),'gi-kl',1.2);
   let grain='';for(let i=0;i<5;i++)grain+=p.wave(x0+10,y0+16+i*h0/5.6,x0+w0-10,1.3,60+i*9);s+=S(grain,'gi-kg',.8);
   for(const t of [.31,.77]){const kx=x0+w0*t,ky=y0+h0*(t<.5?.3:.62);s+=S(p.ell(kx,ky,9,3.4,.2)+p.ell(kx,ky,4,1.4,.1),'gi-kg',.9);}
   const mx=x0+w0-96,my=y0+h0-22;
   s+=F(p.box(mx,my,64,13,0,0,.15),'gi-brass')+
     S(p.rect(mx,my,64,13,.2)+p.ell(mx+5,my+6.5,1.3,1.3,.05)+p.ell(mx+59,my+6.5,1.3,1.3,.05),'gi-k',1)+
     S(`M${R(mx+12)} ${R(my+5)}h${R(30)}M${R(mx+12)} ${R(my+9)}h${R(40)}`,'gi-kbrass',.9);
  }
  // The bands: one per letter, the band's wash, its letter; each band is a button (what you need). The room writes the
  // letter above its band; the module writes it small in the band's left inner corner and leaves it out where the
  // poise, the ghost or a figure stands (o.clear says), so a letter never sits under anything.
  let bands='';const out=o.out||[];
  for(const b of vm.bands){const x1=X(Math.max(b.lo,vm.lo)),x2=X(Math.min(b.hi,vm.hi));if(x2-x1<6)continue;
   const sel=!!vm.need&&vm.need.low===b.lo,top=o.bandTop??by-62*k,h=o.bandH??44*k;let letter='';
   if(o.letters===false){
     const lb={kind:'letter',key:'l'+b.letter,x0:x1+6,y0:top+3,x1:x1+6+7,y1:top+11.5};
     if(!o.clear||o.clear(lb)){letter=T(x1+6,top+11,b.letter,10,'gi-ts gi-lit gi-band-letter','start',650);out.push(lb);}
   }
   else{const cx=(x1+x2)/2;letter=T(cx,top-10*k,b.letter,22*k,'gi-ts gi-lit','middle',650);out.push({kind:'letter',key:'l'+b.letter,x0:cx-8*k,y0:top-26*k,x1:cx+8*k,y1:top-9*k});}
   if(sel)
     for(const [x0,y0,x9,y9]of [[x1+.4,top-1,x1+3.6,top+h+1],[x2-3.6,top-1,x2-.4,top+h+1],[x1+2,top-1.6,x2-2,top+1.6],[x1+2,top+h-1.6,x2-2,top+h+1.6]])out.push({kind:'edge',key:'edge',x0,y0,x1:x9,y1:y9});
   const inner=F(p.box(x1+2,top,x2-x1-4,h,0,0,.6),BAND_CLASS[b.letter]||'gi-band-f')+(sel?S(p.rect(x1+2,top,x2-x1-4,h,.6),'gi-kc',2.2):'')+letter;
   bands+=o.interactive&&b.lo>0&&b.lo<100?`<g class="gi-band" data-gi-band="${b.lo}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="${b.lo} and up" style="transform-origin:${R((x1+x2)/2)}px ${R(top+h)}px">${inner}</g>`:`<g class="gi-band-static">${inner}</g>`;}
  s+=`<g class="gi-bands">${bands}</g>`;
  // Brackets, then the brass bar with its bevel, end knobs and engraved ticks.
  const x0=bx-30*k,x9=bx+bw+30*k;
  for(const x of [x0,x9]){
    s+=F(p.box(x-8*k,by-24*k,16*k,8*k,0,0,.2),'gi-iron')+F(p.box(x-3*k,by-16*k,6*k,48*k,0,0,.2),'gi-iron')+S(p.rect(x-3*k,by-16*k,6*k,48*k,.2)+p.rect(x-8*k,by-24*k,16*k,8*k,.2),'gi-k',1.4);
   if(k>=1)
     s+=S(`M${R(x)} ${R(by+32)}c-12 0 -16 -10 -10 -16c4 -4 10 0 7 4`,'gi-k',1.6)+
       F(p.box(x-16,by+28,32,8,0,0,.2),'gi-iron')+
       S(p.rect(x-16,by+28,32,8,.2)+p.ell(x-10,by+32,1.6,1.6,.05)+p.ell(x+10,by+32,1.6,1.6,.05),'gi-k',1.2);}
  s+=F(p.box(x0,by-14*k,x9-x0,th,0,0,.3),'gi-brass')+
    F(p.box(x0,by-3*k,x9-x0,5*k,0,0,.2),'gi-brassd')+
    S(p.line(x0+4,by-11*k,x9-4,by-11*k,.4),'gi-kl',1.4*k)+
    S(p.line(x0,by-14*k,x9,by-14*k,.6)+p.line(x0,by+2*k,x9,by+2*k,.6),'gi-k',2*k);
  // The window, reflected small on the bar's bevel at the end nearest it, and a worn patch where hands lift the bar.
  {
    const a=x0+20*k,b=by-12.5*k,w=8*k,h=4.6*k;
    s+=S(`M${R(a)} ${R(b)}h${R(w)}v${R(h)}h${R(-w)}zM${R(a+w/2)} ${R(b)}v${R(h)}M${R(a)} ${R(b+h/2)}h${R(w)}`,'gi-kl',.8)+
      S(p.hatch([x0+44*k,by-10*k],[x0+44*k,by-4*k],[x0+64*k,by-10*k],[x0+64*k,by-4*k],4,.1),'gi-kl',.7);
  }
  for(const x of [x0,x9])s+=F(p.ell(x,by-6*k,6*k,9*k,.2),'gi-brassd')+S(p.ell(x,by-6*k,6*k,9*k,.2)+`M${R(x-3*k)} ${R(by-12*k)}v12M${R(x)} ${R(by-14*k)}v16M${R(x+3*k)} ${R(by-12*k)}v12`,'gi-k',1.1);
  let ticks='',big='',figs='';const step=vm.hi-vm.lo>60?5:2;
  for(let v=Math.ceil(vm.lo/step)*step;v<=vm.hi;v+=step){const x=X(v),major=v%10===0;if(major)big+=`M${R(x)} ${R(by-14*k)}v${R(12*k)}`;else ticks+=`M${R(x)} ${R(by-14*k)}v${R(6*k)}`;
   if(major&&o.figures){
     const fy=by+(o.figY||30)*k,fs=(o.figS||15)*k,fw=.6*fs*String(v).length/2;
     figs+=T(x,fy,String(v),fs,'gi-ts gi-fig','middle',600);
     out.push({kind:'fig',key:'f'+v,x0:x-fw,y0:fy-.74*fs,x1:x+fw,y1:fy+.06*fs});
   }}
  s+=S(ticks,'gi-k',1.1)+S(big,'gi-k',1.8)+`<g class="gi-figs">${figs}</g>`;
  return s;
 }
 // Where the poise's own figure is written, so it never sits under a line. Faded (a what-if shows a ghost): beside the
 // poise on the right, else the left, else up in the label row beside the ghost's figure. Plain: above the poise, else
 // slid along that row, else up. A place is taken only when its box clears the chosen band's outline, the ghost (body,
 // stem, figure), the poise itself and the ends of the bar. Returns the place relative to the poise, and its box.
 function labelPlan(vm,X,by,k,mode,lo,hi){
  const room=mode==='room',faded=!!vm.ghost,text=String(vm.currentText||''),size=(faded?18:24)*k,w=.6*size*text.length+2,px=X(vm.current),blocks=[];
  const box=(x,y,anchor)=>{const x0=anchor==='start'?x:anchor==='end'?x-w:x-w/2;return {x0,y0:y-.74*size,x1:x0+w,y1:y+.08*size};};
  const sel=vm.need&&vm.bands.find(b=>b.lo===vm.need.low);
  if(sel){
    const x1=X(Math.max(sel.lo,vm.lo)),x2=X(Math.min(sel.hi,vm.hi)),top=room?by-62*k:by-24,h=room?44*k:13;
    blocks.push({x0:x1,y0:top-2,x1:x1+4,y1:top+h+2},{x0:x2-4,y0:top-2,x1:x2,y1:top+h+2},{x0:x1,y0:top-2,x1:x2,y1:top+2},{x0:x1,y0:top+h-2,x1:x2,y1:top+h+2});
  }
  const gy=room?-104*k:-30,gs=24*k;let gx=null,gw=0;
  if(vm.ghost){
    gx=X(vm.ghost.value);
    gw=.6*gs*String(vm.ghost.label).length+4;
    blocks.push({x0:gx-22*k-3,y0:by-36*k-2,x1:gx+22*k+3,y1:by+4*k},{x0:gx-gw/2,y0:by+gy-.74*gs,x1:gx+gw/2,y1:by+gy+.08*gs});
    if(room)blocks.push({x0:gx-2,y0:by-96*k,x1:gx+2,y1:by-36*k});
  }
  blocks.push({x0:px-22*k-2,y0:by-36*k-1,x1:px+22*k+2,y1:by+6*k});
  const side=room?-38*k:-28,above=room?-40*k:-28,row=room?-104*k:-30,cands=[];
  if(faded){cands.push([px+22*k+7,by+side,'start'],[px-22*k-7,by+side,'end']);if(gx!=null)cands.push([gx+gw/2+8,by+row,'start'],[gx-gw/2-8,by+row,'end']);}
  else{cands.push([px,by+above,'middle'],[px-10,by+above,'start'],[px+10,by+above,'end']);if(room)cands.push([px,by+row,'middle']);}
  const hit=b=>blocks.some(q=>b.x0<q.x1&&q.x0<b.x1&&b.y0<q.y1&&q.y0<b.y1),inside=b=>b.x0>=lo&&b.x1<=hi;
  const pick=cands.find(c=>{const b=box(...c);return inside(b)&&!hit(b);})||cands.find(c=>inside(box(...c)))||cands[0];
  const b=box(...pick);
  return {
    dx:R(pick[0]-px),
    dy:R(pick[1]-by),
    anchor:pick[2],
    size,
    box:{kind:'plabel',key:'plabel',...b},
    ghostBox:gx!=null?{kind:'glabel',key:'glabel',x0:gx-gw/2+2,y0:by+gy-.74*gs,x1:gx+gw/2-2,y1:by+gy+.08*gs}:null
  };
 }
 function poise(p,k,label,letter,cls='',faded=false,place=null){
  const w=22*k,top=-36*k,bot=-10*k;
  let s=F(p.box(-w,top,w*2,bot-top,0,0,.3),'gi-clay')+
    F(p.fill([[-w,top],[w,top],[w-3*k,top+4*k],[-w+3*k,top+4*k]],0,0,.1),'gi-clayl')+
    F(p.fill([[w,top],[w,bot],[w-3*k,bot-2*k],[w-3*k,top+4*k]],0,0,.1),'gi-clayd');
  s+=S(p.hatch([w-2.6*k,top+6*k],[w-2.6*k,bot-4*k],[w-.6*k,top+6*k],[w-.6*k,bot-4*k],4,.1),'gi-k',.8)+S(p.rect(-w,top,w*2,bot-top,.3),'gi-k',2*k);
  s+=S(`M${R(-14*k)} ${R(bot)}V${R(6*k)}H${R(14*k)}V${R(bot)}M0 ${R(6*k)}l${R(-3*k)} ${R(4*k)}h${R(6*k)}z`,'gi-k',1.6*k);
  if(letter)s+=T(0,top+17*k,letter,12*k,'gi-tc gi-lit','middle',700);
  if(label){
    const at=place||(faded?{dx:w+8*k,dy:-38*k,anchor:'start',size:18*k}:{dx:0,dy:-46*k,anchor:'middle',size:24*k});
    s+=T(at.dx,at.dy,label,at.size,faded?'gi-t gi-lit gi-faded':'gi-t gi-lit',at.anchor,700);
  }
  return `<g class="gi-poise-in${cls}">${s}</g>`;
 }
 // At rest (grades hidden) the clay rider lies on the bench top, notch up, on its own small drawn shadow: no stand, so
 // nothing hangs down over the bench's front.
 function poiseRest(p,k=1){
  const w=22*k,h=24*k,n=5*k,body=[[-w,0],[-w+2*k,-h],[-n,-h],[0,-h+n],[n,-h],[w-2*k,-h],[w,0]];
  let s=F(p.fill([[-w+2*k,1.5*k],[w+7*k,1.5*k],[w+5*k,4.5*k],[-w+4*k,4.5*k]],0,0,.2),'gi-cast');
  s+=F(p.fill(body,1.2,1.4,.2),'gi-clay')+
    F(p.fill([[-w+3*k,-h+1*k],[-n-1*k,-h+1*k],[-n+1*k,-h+4*k],[-w+3.5*k,-h+5*k]],0,0,.1),'gi-clayl')+
    F(p.fill([[w-2.4*k,-h+1*k],[w-.4*k,-1*k],[w-4*k,-1*k],[w-5*k,-h+5*k]],0,0,.1),'gi-clayd');
  s+=S(p.hatch([w-4.6*k,-h+8*k],[w-4.6*k,-4*k],[w-2*k,-h+8*k],[w-2*k,-4*k],3,.1),'gi-k',.8)+S(p.path(body,true,.3),'gi-k',2*k)+S(p.line(-w+1*k,-1.5*k,w-1*k,-1.5*k,.2),'gi-k',1);
  return `<g class="gi-poise-in">${s}</g>`;
 }
 function ghost(p,k,label,ly=-104){
  const w=22*k,top=-36*k,bot=-10*k;
  return `<g class="gi-ghost-in">${S(p.rect(-w,top,w*2,bot-top,.3),'gi-kc',2.2*k).replace('/>',' stroke-dasharray="6 5"/>')}${S(`M0 ${R(bot)}v${R(14*k)}`,'gi-kc',2*k)}${ly<-60?S(`M0 ${R(-96*k)}v${R(54*k)}`,'gi-kc',1.3).replace('/>',' stroke-dasharray="3 4"/>'):''}${T(0,ly*k,label,(ly<-60?24:24)*k,'gi-tc gi-lit gi-ghost-label','middle',700)}</g>`;
 }
 // A coming graded item: S-hook, cord, ring, a cast-iron bell weight sized by its whole 0-100% swing, a manila tag.
 function weight(p,row,o){
  const k=o.k||1,wd=row.wd*k,wh=wd*.62,cl=26*k,ring=14*k+cl+5*k,y0=ring+5*k,yb=y0+wh,tw=o.tw,th=o.th,yt=yb+12*k;
  // (a pretend weight is pencilled in: a paper wash under a dashed outline until it has a score, then clay like any what-if)
  const clay=row.f!=null,pretend=row.pretend===true,iron=clay?'gi-clay':pretend?'gi-pw':'gi-iron',dark=clay?'gi-clayd':pretend?'gi-pwd':'gi-irond',light=clay?'gi-clayl':pretend?'gi-pwl':'gi-ironl';
  const dash=d=>pretend?d.replace('/>',' stroke-dasharray="5 3.5"/>'):d;
  const pts=[[-wd*.17,y0],[wd*.17,y0],[wd*.15,y0+wh*.12],[wd*.36,y0+wh*.32],[wd*.48,y0+wh*.86],[wd*.5,yb],[-wd*.5,yb],[-wd*.48,y0+wh*.86],[-wd*.36,y0+wh*.32],[-wd*.15,y0+wh*.12]];
  // Its shadow on the wall behind (away from the window): it rides with the weight, so it swings and lifts with it.
  const cast=F(p.fill(pts,16*k,8*k,.5),'gi-cast');
  let body=F(p.fill(pts,3,4,.3),'gi-shadow')+
    F(p.fill(pts,0,0,.25),iron)+
    F(p.fill([[wd*.04,y0],[wd*.17,y0],[wd*.15,y0+wh*.12],[wd*.36,y0+wh*.32],[wd*.48,y0+wh*.86],[wd*.5,yb],[wd*.14,yb],[wd*.12,y0+wh*.32],[wd*.04,y0+wh*.12]],0,0,.2),dark);
  body+=S(p.hatch([wd*.16,y0+wh*.36],[wd*.18,yb-3*k],[wd*.36,y0+wh*.36],[wd*.46,yb-3*k],Math.max(3,Math.round(wd/9)),.2),pretend?'gi-kp':'gi-k',.8)+
    dash(S(p.path(pts,true,.3),pretend?'gi-kp':'gi-k',2*k))+
    S(p.line(-wd*.48,y0+wh*.86,wd*.48,y0+wh*.86,.2),pretend?'gi-kp':'gi-k',1.1)+
    S(p.path([[-wd*.1,y0+wh*.16],[-wd*.28,y0+wh*.38],[-wd*.36,y0+wh*.8]],false,.2),light==='gi-ironl'?'gi-kiron':'gi-kl',1.5*k);
  // Wear: a few pits, and the points stamped into the face like a real denomination (a pretend one has never been cast).
  if(!pretend)body+=F(p.ell(-wd*.2,y0+wh*.6,.9,.9,.05)+p.ell(wd*.05,y0+wh*.72,.7,.7,.05)+p.ell(-wd*.05,y0+wh*.45,.6,.6,.05),'gi-inkf');
  // The window, caught small on the shoulder that faces it.
  {const gw=clamp(wd*.11,3.4,7),gh=gw*.7,a=-wd*.27,b=y0+wh*.24;body+=S(`M${R(a)} ${R(b)}h${R(gw)}v${R(gh)}h${R(-gw)}zM${R(a+gw/2)} ${R(b)}v${R(gh)}`,'gi-kl',.8);}
  if(row.stamp&&wd>40)body+=T(-wd*.08,y0+wh*.7,row.stamp,Math.max(8,wd*.15),'gi-stamp','middle',700);
  const ringS=S(p.ell(0,ring,6*k,5*k,.15),'gi-k',2*k);
  const handle=o.live?`<g class="gi-handle ch-impact-row" role="slider" tabindex="0" aria-label="${row.aria}" aria-valuemin="0" aria-valuemax="100"${row.f!=null?` aria-valuenow="${Math.round(row.f*100)}" aria-valuetext="${row.valueText}"`:` aria-valuetext="${row.valueText}"`}>${ringS}${body}</g>`:`<g class="gi-handle-static${o.hidden?'':' ch-impact-row'}"${o.hidden?'':` role="img" aria-label="${row.aria}"`}>${ringS}${body}</g>`;
  // The tag, and its dial face (the what-if) behind it.
  const tag=tagFaces(p,row,o,tw,th,yt,o.ts||k);
  const hook=S(`M-1 -2C6 -4 7 5 1 6C-5 7 -5 13 1 14`.replace(/(-?\d+(?:\.\d+)?)/g,m=>R(Number(m)*k)),'gi-kbrass',2.4*k);
  const taut=`M${R(k)} ${R(14*k)}L0 ${R(ring-5*k)}`,slack=`M${R(k)} ${R(14*k)}Q${R(10*k)} ${R((14*k+ring)/2-4*k)} 0 ${R(ring-15*k)}`;
  let twist='';for(let y=16*k;y<ring-7*k;y+=5*k)twist+=`M${R(-1.6*k)} ${R(y)}l${R(3*k)} ${R(2.4*k)}`;
  return `<g class="gi-wt${clay?' gi-wt-if':''}${pretend?' gi-wt-p':''}" data-rd-key="gi-wt-${row.key}" data-gi-weight="${row.key}" data-gi-pts="${row.points||0}" data-gi-live="${o.live?1:0}" data-gi-k="${R(k*100)/100}" data-gi-f="${row.f!=null?Math.round(row.f*1e4)/1e4:''}"${row.f!=null||o.dial?' data-gi-dial="1"':''} transform="translate(${R(o.cx)} ${R(o.ry)})">${hook}<g class="gi-swing" style="transform-origin:0px ${R(14*k)}px"><g class="gi-cordg" style="transform-origin:0px ${R(14*k)}px"><path class="gi-cord gi-k" d="${taut}" data-taut="${taut}" data-slack="${slack}" stroke-width="${R(1.7*k)}"/>${S(twist,'gi-ks',.8)}</g><g class="gi-lift"><g class="gi-drop">${cast}${handle}${S(`M0 ${R(yb)}V${R(yt+10*(o.ts||k))}`,'gi-k',1.1)}${tag}</g></g></g></g>`;
 }
 // The dial's figure: the score in points with its per cent beside it, smaller, and the grade it gives, sized to the tag.
 function dialText(row,f,tw,k,yt){
  // (out of 100 the points are the per cent, so it is not said twice)
  const pts=row.points||0,
    a=pts>0?ptsText(f,pts):'',
    both=a&&pts!==100,
    pct=pctText(f),
    to=row.dialTo||'',
    chars=(a?a.length+(both?1+pct.length*.8:0):pct.length)+(to?to.length+2.6:0),
    size=Math.min(17*k,(tw-18*k)/(chars*.6));
  const head=a?`<tspan class="gi-dial-pts">${a}</tspan>${both?` <tspan class="gi-ts gi-dial-pct" font-size="${R(size*.78)}">${pct}</tspan>`:''}`:`<tspan class="gi-dial-pct">${pct}</tspan>`;
  return T(0,yt+79*k,`${head}${to?` <tspan class="gi-ts" font-size="${R(size*.76)}">→</tspan> <tspan class="gi-dial-to">${to}</tspan>`:''}`,size,'gi-t gi-lit','middle',700);
 }
 function tagFaces(p,row,o,tw,th,yt,k){
  const x=-tw/2,pretend=row.pretend===true,edge=S(p.path([[x+8,yt],[x+tw-8,yt],[x+tw,yt+8],[x+tw,yt+th],[x,yt+th],[x,yt+8]],true,.3),pretend?'gi-kp':'gi-k',1.7*k);
  let paper=F(p.fill([[x+8,yt],[x+tw-8,yt],[x+tw,yt+8],[x+tw,yt+th],[x,yt+th],[x,yt+8]],3,4,.4),'gi-shadow')+
    F(p.fill([[x+8,yt],[x+tw-8,yt],[x+tw,yt+8],[x+tw,yt+th],[x,yt+th],[x,yt+8]],0,0,.3),'gi-tag')+
    (pretend?edge.replace('/>',' stroke-dasharray="5 3.5"/>'):edge);
  // a pretend weight's tag carries its ×, in the corner away from the eye
  if(pretend&&o.course!=null){const cx=x+tw-14*k,cy=yt+15*k;paper+=`<g class="gi-x" role="button" tabindex="0" data-gi-action="unpretend" data-gi-course="${o.course}" data-gi-pid="${row.key}" aria-label="${row.removeLabel||'Remove'}"><path class="gi-hit" d="M${R(cx-9)} ${R(cy-9)}h18v18h-18z"/>${S(p.line(cx-3.8,cy-4,cx+4,cy+3.8,.3)+p.line(cx+3.9,cy-3.9,cx-3.8,cy+4,.3),'gi-k',1.5)}</g>`;}
  const eye=F(p.ell(0,yt+10*k,5*k,5*k,.1),'gi-manila')+S(p.ell(0,yt+10*k,5*k,5*k,.1),'gi-ks',1)+S(p.ell(0,yt+10*k,2.4*k,2.4*k,.1),'gi-k',1.3);
  const nm=typeof row.name==='function'?row.name(Math.max(6,Math.floor((tw-16)/(16*k*.56)))):row.name;
  let face=T(0,yt+32*k,nm,16*k,'gi-t','middle',700)+T(0,yt+50*k,row.meta,12.5*k,'gi-ts','middle',500);
  if(row.line)face+=T(0,yt+72*k,row.line,15*k,row.need?'gi-tc gi-lit gi-need-line':'gi-tc gi-lit','middle',700);
  let dial='';
  if(o.live){const tx=x+16*k,tl=tw-32*k,f=row.f!=null?row.f:row.dialF??.85,kx=tx+tl*f;
   dial=`<g class="gi-dial" data-gi-track="${R(tx)},${R(tl)}">${T(0,yt+30*k,nm,15*k,'gi-t','middle',700)}${S(p.line(tx,yt+50*k,tx+tl,yt+50*k,.3),'gi-k',2*k)}<path class="gi-dial-fill gi-brass" d="M${R(tx)} ${R(yt+47*k)}h${R(tl*f)}v${R(6*k)}h${R(-tl*f)}z"/>${[0,.25,.5,.75,1].map(t=>S(`M${R(tx+tl*t)} ${R(yt+56*k)}v${R(4*k)}`,'gi-ks',1)).join('')}<g class="gi-knob" style="transform:translateX(${R(kx)}px)">${F(p.ell(0,yt+50*k,9*k,9*k,.1),'gi-tag')}${S(p.ell(0,yt+50*k,9*k,9*k,.1),'gi-k',2*k)}${S(`M${R(-2.5*k)} ${R(yt+46*k)}v${R(8*k)}M${R(2.5*k)} ${R(yt+46*k)}v${R(8*k)}`,'gi-ks',1)}</g>${dialText(row,f,tw,k,yt)}</g>`;}
  const link=row.url?`<a class="gi-tag-link" href="${row.url}" aria-label="${row.linkLabel}">`:'<g>';
  return `<g class="gi-tagg" style="transform-origin:0px ${R(yt)}px">${paper}${eye}${link}<g class="gi-face">${face}</g>${row.url?'</a>':'</g>'}${dial}</g>`;
 }
 function moreTag(p,cx,ry,n,k=1){
  const yt=40*k;return `<g class="gi-wt gi-more" transform="translate(${R(cx)} ${R(ry)})">${S(`M-1 -2C6 -4 7 5 1 6C-5 7 -5 13 1 14`,'gi-kbrass',2.4)}${S(`M1 14V${R(yt+10)}`,'gi-k',1.2)}${F(p.fill([[-34,yt],[34,yt],[38,yt+46],[-38,yt+46]],0,0,.3),'gi-tag')}${S(p.path([[-34,yt],[34,yt],[38,yt+46],[-38,yt+46]],true,.3),'gi-k',1.6)}${S(p.ell(0,yt+10,3,3,.1),'gi-k',1.2)}${T(0,yt+32,`+${n} more`,14*k,'gi-t','middle',650)}</g>`;
 }
 function rail(p,x0,x1,ry,k=1,brackets=true){
  let s=F(p.box(x0,ry-8*k,x1-x0,14*k,4,5),'gi-shadow')+F(p.box(x0,ry-8*k,x1-x0,14*k,0,0,.3),'gi-bench')+S(p.rect(x0,ry-8*k,x1-x0,14*k,.4),'gi-k',1.8*k)+S(p.wave(x0+6,ry-1*k,x1-6,.7,34),'gi-kg',.9);
  if(brackets)for(const x of [x0+10,x1-10])s+=S(p.line(x,ry-8,x,ry-62,.3),'gi-k',1.6)+F(p.box(x-6,ry-66,12,8,0,0,.1),'gi-iron')+S(p.rect(x-6,ry-66,12,8,.1)+p.ell(x,ry-62,1.4,1.4,.05),'gi-k',1.1);
  return s;
 }
 const txt=(v,n)=>typeof v==='function'?v(n):v;
 // A paper slip propped on the bench against a little brass weight. Each part (the what-if, what you need) is its own
 // keyed group, so a part can be torn off or written in without the slip itself moving. Parts sit side by side when
 // the bench has the width, else one above the other; their boxes are planned by room().
 function slip(p,x,y,w,h,parts,key,course,side){
  const top=y-h;
  let s=F(p.box(x,top,w,h,4,5),'gi-shadow')+F(p.fill([[x,top],[x+w,top+2],[x+w-2,y],[x+2,y-1]],0,0,.4),'gi-slip')+S(p.path([[x,top],[x+w,top+2],[x+w-2,y],[x+2,y-1]],true,.4),'gi-k',1.7);
  // A dog-ear and two pin pricks; ruled faint lines like a page torn from the ledger.
  s+=F(p.fill([[x+w-14,top+1],[x+w,top+2],[x+w-1,top+15]],0,0,.1),'gi-page')+
    S(p.path([[x+w-14,top+1],[x+w-12,top+13],[x+w-1,top+15]],false,.1),'gi-k',1.1)+
    S(`M${x+12} ${top+5}l3 -3M${x+w-40} ${top+4}l-4 -2`,'gi-ks',.9);
  let rules='';for(let yy=top+20;yy<y-6;yy+=14)rules+=p.line(x+8,yy,x+w-8,yy+.6,.2);s+=S(rules,'gi-kf',.7);
  let body='';
  parts.forEach((part,i)=>{
   if(i)s+=(side?S(p.line(part.x-5,top+8,part.x-6,y-8,.3),'gi-ks',1):S(p.line(x+10,part.y-2,x+w-10,part.y-1,.3),'gi-ks',1)).replace('/>',' stroke-dasharray="5 4"/>');
   let inner=part.body(part.x,part.y,part.w);
   const a=part.action;if(a){const bx=part.x+part.w-a.w-10,by=part.y+4;inner+=`<g class="gi-btn" role="button" tabindex="0" data-gi-action="${a.name}" data-gi-course="${a.course}" aria-label="${a.label}">${F(p.box(bx,by,a.w,22,2,3,.2),'gi-shadow')}${F(p.box(bx,by,a.w,22,0,0,.2),'gi-manila')}${S(p.rect(bx,by,a.w,22,.3),'gi-k',1.4)}${T(bx+a.w/2,by+15.5,a.text,12.5,'gi-t','middle',650)}</g>`;}
   body+=`<g class="gi-slip-part" data-rd-key="gi-part-${part.name}" data-gi-part="${part.name}" style="transform-origin:${R(part.x+part.w/2)}px ${R(part.y)}px">${inner}</g>`;});
  s+=bellWeight(p,x+w+10,y,14,'gi-brass','gi-brassd',true);
  return `<g class="gi-slip-g" data-rd-key="${key}" data-gi-slip="${key}" data-gi-course="${course}" style="transform-origin:${R(x+w/2)}px ${R(y)}px">${s}${body}</g>`;
 }

 // ---------------------------------------------------------------- the room
 // A note tacked to the bench's front (the apron) by two brass tacks: where "what you need" goes when the bench slip
 // cannot hold it without a weight touching it. The apron is never under a lane, so nothing has to shrink for it.
 function apronNote(p,x,y,w,h,need,key,course){
  const pts=[[x,y+1],[x+w,y],[x+w-1,y+h],[x+1,y+h-1]];
  let s=F(p.fill(pts,3,4,.4),'gi-shadow')+F(p.fill(pts,0,0,.4),'gi-slip')+S(p.path(pts,true,.4),'gi-k',1.6)+F(p.fill([[x+w-12,y+h-1],[x+w-1,y+h-12],[x+w-1,y+h]],0,0,.1),'gi-page');
  for(const tx of [x+9,x+w-9])s+=F(p.ell(tx,y+6,3,3,.1),'gi-brass')+S(p.ell(tx,y+6,3,3,.1)+p.line(tx-1.5,y+7,tx+1.5,y+5,.05),'gi-k',1);
  const body=T(x+18,y+16,txt(need.title,Math.floor((w-36)/6.6)),11.5,'gi-ts','start',500)+T(x+14,y+35,txt(need.text,Math.floor((w-26)/9.8)),17,'gi-t gi-lit','start',700);
  return `<g class="gi-slip-g gi-note" data-rd-key="${key}" data-gi-slip="${key}" data-gi-note="1" data-gi-course="${course}" style="transform-origin:${R(x+9)}px ${R(y+6)}px">${s}<g class="gi-slip-part" data-rd-key="gi-part-need" data-gi-part="need" style="transform-origin:${R(x+w/2)}px ${R(y+h/2)}px">${body}</g></g>`;
 }
 const pin=(p,x,y)=>at(x,y,F(p.ell(0,0,3.4,3.4,.1),'gi-brass')+S(p.ell(0,0,3.4,3.4,.1)+p.line(-1.6,.8,1.6,-.8,.05),'gi-k',1));
 function room(vm){
  const L=layout(vm.W,vm.H),env=environment(L),lit=hourLight(L,vm.hour),p=pen(4049+L.W),{W,H,bx,bw,by,ry,bt}=L;
  const X=v=>scaleX(v,vm.lo,vm.hi,bx,bw),ready=vm.state==='ready',live=ready&&!vm.hidden;
  // Every drawn thing's box is kept (labels, figures, the chosen band's outline, the thread, weights, tags, the slip,
  // the props), so the tests can prove that nothing overlaps at any size.
  const boxes=[];
  let app=bar(p,vm,bx,bw,by,{board:true,figures:live,interactive:live,out:boxes});
  const plan=live?labelPlan(vm,X,by,1,'room',bx-22,bx+bw+22):null;if(plan){boxes.push(plan.box);if(plan.ghostBox)boxes.push(plan.ghostBox);}
  if(L.ledge)boxes.push({kind:'ledge',x0:L.ledge.x0,y0:L.ledge.y-40,x1:L.ledge.x1,y1:L.ledge.y+11});
  // Poise and ghost: the ghost is always present (hidden when nothing projects), so a drag can show it at once.
  let poises='';
  if(live){const g=vm.ghost;poises+=`<g class="gi-ghost" data-gi-on="${g?1:0}" data-gi-v="${R(g?g.value:vm.current)}" transform="translate(${R(X(g?g.value:vm.current))} ${by})">${ghost(p,1,g?g.label:vm.currentText)}</g>`;
   poises+=`<g class="gi-poise" data-gi-v="${R(vm.current)}" transform="translate(${R(X(vm.current))} ${by})">${poise(p,1,vm.currentText,vm.letter,'',!!g,plan)}</g>`;}
  // The rail and the weights, each in its own lane: as many lanes as fit at 168 px, the rest wait on one "+N more"
  // tag, hung past the rail's end when the wall has room for it, else in the last lane.
  const n=vm.rows.length,
    fit=Math.max(1,Math.min(6,Math.floor(bw/168))),
    outside=!L.wide&&W-(bx+bw)>=70,
    lanes=n>fit&&!outside?fit:Math.max(1,Math.min(n,fit)),
    shown=n>fit?(outside?fit:fit-1):n,
    lane=bw/lanes;
  let weights='';const tw=Math.min(176,lane-24),th=vm.hidden?62:86;
  // The bench slip is planned before the weights: a weight hanging above it may only reach down to the slip's top.
  // Side by side when the free bench is wide enough; else stacked; else stacked with the what-if on one line (its
  // figures and Clear in one row); and if even that would make a weight touch it, the slip keeps the what-if and what
  // you need is tacked to the bench's front instead (never left on a tag face the dial hides).
  const want=[];if(live&&vm.whatIf)want.push('if');if(live&&vm.need)want.push('need');
  const PH={if:62,need:58},free=L.slipR-34-L.slipX,side=want.length===2&&free>=330,pw=Math.round(clamp(side?(free-10)/2:free,150,side?230:300));
  const sw=side?pw*2+10:pw,sx=Math.round(Math.max(L.slipX,L.slipR-34-sw)),over=i=>{const cx=bx+lane*(i+.5);return cx+tw/2>sx-8&&cx-tw/2<sx+sw+24;};
  const hang=k=>(bt-(side?Math.max(...k.map(x=>PH[x])):k.reduce((sum,x)=>sum+PH[x],0))-12-10-ry-(62+th))/.62;
  let order=want,note=false;
  if(order.length===2&&!side&&Array.from({length:shown},(_,i)=>i).some(over)&&hang(order)<30){PH.if=34;if(hang(order)<30){PH.if=62;order=['if'];note=true;}}
  const cap=order.length?hang(order):Infinity;
  const under=cx=>L.props.filter(q=>cx+tw/2>q.x0-4&&cx-tw/2<q.x1+4).reduce((m,q)=>Math.min(m,(q.top-8-ry-62-th)/.62),Infinity);
  for(const q of L.props)boxes.push({kind:'prop',key:q.kind,x0:q.x0,y0:q.top,x1:q.x1,y1:bt});
  // A weight's size is its whole swing, so when one weight has to be smaller to clear the slip or a prop below it, all
  // of them shrink by the same share above the smallest size: the heaviest still looks heaviest, in the same proportion.
  const limit=i=>Math.max(30,Math.min(over(i)&&order.length?cap:Infinity,under(bx+lane*(i+.5))));
  let share=1;for(let i=0;i<shown;i++){const want=Math.min(vm.rows[i].wd,lane-40),most=limit(i);if(want>most)share=Math.min(share,want>30?(most-30)/(want-30):1);}
  for(let i=0;i<shown;i++){
    const row=vm.rows[i],cx=bx+lane*(i+.5),want=Math.min(row.wd,lane-40);
    row.wd=Math.min(30+Math.max(0,want-30)*share,limit(i));
    weights+=weight(p,row,{cx,ry,tw,th,live,hidden:vm.hidden,course:vm.course.id});
   // the weight's box takes in its shadow on the wall (16 right, 8 down)
   const wh=row.wd*.62;boxes.push({kind:'weight',key:row.key,x0:cx-row.wd/2,y0:ry+50,x1:cx+row.wd/2+16,y1:ry+58+wh},{kind:'tag',key:row.key,x0:cx-tw/2,y0:ry+62+wh,x1:cx+tw/2,y1:ry+62+wh+th});}
  const moreX=outside?bx+bw+30:bx+lane*(lanes-.5);
  if(n>shown){weights+=moreTag(p,moreX,ry,n-shown);boxes.push({kind:'more',x0:moreX-38,y0:ry+40,x1:moreX+38,y1:ry+86});}
  const hooks=ready||vm.hidden?'':Array.from({length:Math.max(1,Math.min(4,fit))},(_,i)=>at(bx+bw/Math.min(4,fit)*(i+.5),ry,S(`M-1 -2C6 -4 7 5 1 6C-5 7 -5 13 1 14`,'gi-kbrass',2.4))).join('');
  // The need thread, from a pin on the chosen band, runs only through the gap that is always clear between the bar's
  // figures and the rail: down from the band, level to the heaviest lane, down onto that lane's hook on the rail, with
  // a pin. It never enters another lane. Its pin goes at the band's middle, or where in the band the poise, the ghost
  // and the figures leave it clear.
  let thread='';
  if(live)
    boxes.push(
      {kind:'body',key:'body',x0:X(vm.current)-24,y0:by-37,x1:X(vm.current)+24,y1:by+11},
      ...(vm.ghost?[{kind:'body',key:'body',x0:X(vm.ghost.value)-24,y0:by-37,x1:X(vm.ghost.value)+24,y1:by+5}]:[]));
  if(live&&vm.need&&vm.rows.length){const b=vm.bands.find(b=>b.lo===vm.need.low);if(b){
   const x1=X(Math.max(b.lo,vm.lo)),x2=X(Math.min(b.hi,vm.hi)),stands=[X(vm.current),...(vm.ghost?[X(vm.ghost.value)]:[])],figs=[];
   for(let v=Math.ceil(vm.lo/10)*10;v<=vm.hi;v+=10)figs.push([X(v),.3*15*String(v).length+5]);
   const ok=x=>stands.every(sx=>Math.abs(sx-x)>32)&&figs.every(([fx,fw])=>Math.abs(fx-x)>fw);
   const mx=R([.5,.25,.75,.12,.88].map(t=>x1+(x2-x1)*t).find(ok)??(x1+x2)/2),tx=R(bx+lane*.5),ly=by+48,ey=ry-8,dir=tx>mx?1:-1,r=Math.min(5,Math.abs(tx-mx)/2);
   const d=Math.abs(tx-mx)<1?`M${mx} ${by-18}V${ey}`:`M${mx} ${by-18}V${R(ly-r)}Q${mx} ${ly} ${R(mx+dir*r)} ${ly}H${R(tx-dir*r)}Q${tx} ${ly} ${tx} ${R(ly+r)}V${ey}`;
   thread=`<g class="gi-threadg"><path class="gi-thread gi-kc" pathLength="1" d="${d}" stroke-width="1.4"/>${pin(p,mx,by-18)}${pin(p,tx,ey)}</g>`;
   // (the pin itself sits on the band's lower edge, which it is fastened to; the thread's box starts under it)
   boxes.push(
     {kind:'thread',key:'thread',x0:mx-3.5,y0:by-14,x1:mx+3.5,y1:ly+1.5},
     {kind:'thread',key:'thread',x0:Math.min(mx,tx)-1.5,y0:ly-1.5,x1:Math.max(mx,tx)+1.5,y1:ly+1.5},
     {kind:'thread',key:'thread',x0:tx-3.5,y0:ly,x1:tx+3.5,y1:ey+3.5});}}
  app+=rail(p,bx-40,n>shown&&outside?Math.min(W-4,moreX+46):bx+bw+40,ry)+hooks+thread+poises+`<g class="gi-weights">${weights}</g>`;
  // On the bench: the hidden poise, the slips, and the ledger as the way to Canvas's own gradebook.
  let bench='';
  if(vm.hidden){bench+=`<g class="gi-poise gi-poise-rest" transform="translate(${R(L.rest)} ${bt+5})">${poiseRest(p,.8)}</g>`;boxes.push({kind:'rest',x0:L.rest-18,y0:bt-16,x1:L.rest+24,y1:bt+9});}
  // The slip itself, on the free stretch of bench planned above. It never runs past the stretch.
  if(order.length){
   const sh=side?Math.max(...order.map(k=>PH[k]))+12:order.reduce((sum,k)=>sum+PH[k],0)+12,top=bt-sh;let yy=top+6;
   const BODY={
    if:PH.if<40?
      (x,y,w)=>T(x+14,y+24,txt(vm.whatIf.change,Math.floor((w-94)/10.6)),19,'gi-t gi-lit','start',700):
      (x,y,w)=>T(x+14,y+19,txt(vm.whatIf.title,Math.floor((w-96)/6.8)),12.5,'gi-ts','start',500)+T(x+14,y+49,txt(vm.whatIf.change,Math.floor((w-24)/12.5)),23,'gi-t gi-lit','start',700),
    need:(x,y,w)=>T(x+14,y+19,txt(vm.need.title,Math.floor((w-24)/6.8)),12.5,'gi-ts','start',500)+T(x+14,y+45,txt(vm.need.text,Math.floor((w-26)/10.6)),19,'gi-t gi-lit','start',700)};
   const parts=order.map((name,i)=>{
     const part={name,x:side?sx+i*(pw+10):sx,y:side?top+6:yy,w:pw,h:PH[name],body:BODY[name]};
     if(!side)yy+=PH[name];
     if(name==='if')part.action={name:'clear',course:vm.course.id,label:vm.whatIf.clearLabel,text:'Clear',w:56};
     return part;
   });
   bench+=slip(p,sx,bt,sw,sh,parts,`gi-slip-${vm.course.id}`,vm.course.id,side);boxes.push({kind:'slip',x0:sx,y0:top,x1:sx+sw+18,y1:bt});}
  if(note){
    const nw=Math.round(clamp(sw,200,268)),nx=sx,ny=bt+29,nh=40;
    bench+=apronNote(p,nx,ny,nw,nh,vm.need,`gi-note-${vm.course.id}`,vm.course.id);
    boxes.push({kind:'note',x0:nx-2,y0:ny-4,x1:nx+nw+3,y1:ny+nh+4});
  }
  bench+=`<a class="gi-ledger-link" href="${vm.gradebook}" aria-label="${vm.gradebookLabel}"><path class="gi-hit" d="M40 ${bt-64}h250v64h-250z"/>${T(166,bt+52,vm.ledgerText,15,'gi-ts','middle',500)}</a>`;
  boxes.push({kind:'ledger-label',x0:90,y0:bt+38,x1:242,y1:bt+56});
  const appKey=`${vm.course.id}-${vm.hidden?'h':vm.state}`;
  // Night is the dark look, as in the Focus room and the Review deck (never the clock): the hour only moves the sun.
  const night=vm.dark===true,[sx0,sy0]=sunAt(L,vm.hour),[sxp,syp]=sunAt(L,Math.max(6,vm.hour-.7));
  // The sun stands at its hour through two custom properties: the far layer never changes with the hour.
  const svg=`<svg class="gi-svg" data-gi-ww="${L.ww}" data-gi-night="${night?1:0}" data-gi-sun="${sx0},${sy0}" data-gi-sun0="${sxp},${syp}" style="--gi-sx:${sx0}px;--gi-sy:${sy0}px" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${vm.roomLabel}">${env.far}${lit.shaft}${env.mid}${env.near}${lit.land}${env.dusk}${env.lamp}<g class="gi-app" data-rd-key="gi-app-${appKey}" data-gi-app="${appKey}" data-gi-course="${vm.course.id}" data-gi-hidden="${vm.hidden?1:0}" data-gi-lo="${vm.lo}" data-gi-hi="${vm.hi}" data-gi-bx="${R(bx)}" data-gi-bw="${R(bw)}" data-gi-by="${by}" data-gi-bt="${bt}" data-gi-rest="${R(L.rest)}"><g class="gi-app-in" style="transform-origin:${R(bx+bw/2)}px ${by}px">${app}</g></g><g class="gi-bench-things" data-rd-key="gi-bench-${appKey}">${bench}</g></svg>`;
  return {svg,L,boxes,slipParts:order,note};
 }

 // ---------------------------------------------------------------- the Grades list's strips (no room)
 // The apparatus at strip size (the Home module drew this before it put the answer first). out: an optional array that
 // receives the drawn boxes (labels, letters, the chosen band's outline, figures, the box), so the tests can prove
 // nothing on the bar overlaps either.
 function stripArt(vm,out=[]){
  const W=Math.max(200,Math.round(vm.W||420)),size=vm.size,p=pen(77+W),ready=vm.state==='ready',live=ready&&!vm.hidden,pad=20;
  const k=size==='s'?.66:.6,ts=.84,by=size==='s'?0:50,bx=pad+12,bw=W-2*pad-24,X=v=>scaleX(v,vm.lo,vm.hi,bx,bw);
  const th=Math.round((vm.hidden?62:88)*ts),ry=size==='s'?12:by+34;let H=Math.round(ry+(14+30+10+5)*k+vm.maxWd*.62*k+12*k+th+14),s='';
  if(size!=='s'){
   // The bands sit 2 px clear of the bar; each letter is written in its band's left inner corner and left out where the
   // poise, the ghost or a figure written above the bar would cover it.
   const plan=live?labelPlan(vm,X,by,k,'module',4,W-4):null,spans=[],labs=[plan?.box,plan?.ghostBox].filter(Boolean);
   if(live){spans.push([X(vm.current)-(22*k+4),X(vm.current)+22*k+4]);if(vm.ghost)spans.push([X(vm.ghost.value)-(22*k+4),X(vm.ghost.value)+22*k+4]);}
   const clear=b=>!spans.some(([a,c])=>b.x0<c&&a<b.x1)&&!labs.some(q=>b.x0<q.x1&&q.x0<b.x1&&b.y0<q.y1&&q.y0<b.y1);
   s+=bar(p,vm,bx,bw,by,{k,figures:live,interactive:live,bandTop:by-24,bandH:13,letters:false,figY:28,figS:19,out,clear});
   out.push(...labs);
   if(live){const g=vm.ghost;s+=`<g class="gi-ghost" data-gi-on="${g?1:0}" data-gi-v="${R(g?g.value:vm.current)}" transform="translate(${R(X(g?g.value:vm.current))} ${by})">${ghost(p,k,g?g.label:vm.currentText,-50)}</g>`;
    s+=`<g class="gi-poise" data-gi-v="${R(vm.current)}" transform="translate(${R(X(vm.current))} ${by})">${poise(p,k,vm.currentText,'','',!!g,plan)}</g>`;}
  }
  const lanes=size==='l'?Math.min(3,Math.max(1,vm.rows.length)):1,laneW=size==='l'?(W-2*pad)/lanes:size==='m'?(W-2*pad)*.46:(W*.5-pad);
  s+=rail(p,pad,size==='l'?W-pad:pad+laneW,ry,.55,false);
  for(let i=0;i<Math.min(lanes,vm.rows.length);i++){
    const row=vm.rows[i];
    row.wd=Math.min(row.wd,(laneW-30)/k);
    s+=weight(p,row,{cx:pad+laneW*(i+.5),ry,tw:Math.min(158,laneW-10),th,k,ts,live,hidden:vm.hidden});
  }
  if(!vm.rows.length&&vm.empty)s+=T(pad+laneW/2,ry+40,vm.empty,13,'gi-ts','middle',500);
  if(size!=='l'&&vm.box){
    const gap=size==='s'?8:14,bx0=pad+laneW+gap,by0=ry+(size==='s'?30:22),bw0=W-pad-bx0;
    s+=modBox(p,bx0,by0,bw0,vm.box);
    out.push({kind:'box',x0:bx0,y0:by0,x1:bx0+bw0+3,y1:by0+62});
  }
  // The large module has no box: when the heaviest weight's tag is turned to its dial, what you need is written under
  // the weights, so it is never left on a face the dial hides.
  if(size==='l'&&live&&vm.need&&vm.rows[0]?.f!=null){
    H+=26;
    const n=Math.floor((W-2*pad)/7.4);
    s+=T(pad,H-12,`<tspan class="gi-ts" font-weight="500">${txt(vm.need.title,Math.min(22,n))}</tspan> ${txt(vm.need.text,Math.max(8,n-22))}`,13.5,'gi-t gi-lit gi-need-line','start',700);
  }
  const appKey=`${vm.course.id}-${vm.hidden?'h':vm.state}`;
  return `<svg class="gi-svg gi-mod-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${vm.roomLabel}"><g class="gi-app" data-rd-key="gi-mapp-${appKey}" data-gi-app="${appKey}" data-gi-course="${vm.course.id}" data-gi-hidden="${vm.hidden?1:0}" data-gi-lo="${vm.lo}" data-gi-hi="${vm.hi}" data-gi-bx="${R(bx)}" data-gi-bw="${R(bw)}" data-gi-by="${by}"><g class="gi-app-in" style="transform-origin:${R(W/2)}px ${R(H/2)}px">${s}</g></g></svg>`;
 }
 function modBox(p,x,y,w,box){
  const h=58;return `<g class="gi-box" data-rd-key="gi-box">${F(p.box(x,y,w,h,3,4),'gi-shadow')}${F(p.box(x,y,w,h,0,0,.3),'gi-slip')}${S(p.rect(x,y,w,h,.4),'gi-k',1.4)}${T(x+12,y+21,txt(box.title,Math.floor((w-24)/6.3)),11.5,'gi-ts','start',500)}${T(x+12,y+45,txt(box.text,Math.floor((w-24)/9.2)),16,'gi-t gi-lit','start',700)}</g>`;
 }
 // ---------------------------------------------------------------- the Home module, answer first
 // Under the answer line (HTML): a drawn ruler from the course's low end to 100 with the letter bands as paper tabs under
 // it (the chosen one pressed in), two pins in it (now: clay, solid; if: ink, hollow, only while a score is set), each
 // with its number beside it; then a row per coming assignment: its name (the link to Canvas), its category on a small
 // paper tag, a drawn slider track with its knob, the day and the points. A pretend row is pencilled in: a dashed outline,
 // a dashed track, its name in pencil, and an × to take it away. out receives every drawn box, for the overlap tests.
 // An estimate of a line's width in px (the module's text is short: names, figures, categories).
 const textW=(t,size,bold=false)=>{
   let w=0;
   for(const ch of String(t).replace(/&(?:#\d+|[a-z]+);/gi,'x'))w+=/[ilj.,:;'’|!1Itfr()\[\] ·-]/.test(ch)?.3:/[mwMW@%]/.test(ch)?.86:/[A-Z0-9]/.test(ch)?.64:.54;
   return w*size*(bold?1.07:1);
 };
 const RULER={labelY:14.5,headY:10,top:19,h:20,tabH:16,rows:66};
 function moduleRuler(p,vm,W,pad,out){
  const {top,h,tabH,headY,labelY}=RULER,rx0=pad+1,rx1=W-pad-1,vx0=rx0+11,vx1=rx1-11,lo=vm.lo,hi=vm.hi,X=v=>vx0+(vx1-vx0)*(v-lo)/(hi-lo),bot=top+h;
  let s=F(p.box(rx0,top,rx1-rx0,h,2.6,3.2,.5),'gi-shadow')+
    F(p.fill([[rx0,top],[rx1,top],[rx1,bot],[rx0,bot]],1.1,1.3,.4),'gi-ruler')+
    S(p.rect(rx0,top,rx1-rx0,h,.5),'gi-k',1.5)+
    S(p.line(rx0+3,top+2.4,rx1-3,top+2.2,.3),'gi-kl',1.1);
  // the ruler's grain, and three short hatch strokes in its lower right
  s+=S(p.wave(rx0+8,bot-5,rx1-40,.5,38),'gi-kg',.7)+S(p.hatch([rx1-26,bot-7],[rx1-22,bot-7],[rx1-20,bot-2],[rx1-16,bot-2],3,.15),'gi-kf',.8);
  const unit=(vx1-vx0)/(hi-lo),step=unit>=3.6?1:unit>=1.8?2:5;let minor='',major='',figs='';
  for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step){const x=R(X(v)),ten=v%10===0,five=v%5===0;if(ten)major+=`M${x} ${top+.6}v7.2`;else minor+=`M${x} ${top+.6}v${five?5.6:3.4}`;
   if(ten){const t=String(v),fw=textW(t,9.5,true),fx=v===hi?x+4-fw/2:x;figs+=T(fx,bot-3,t,9.5,'gi-ts gi-fig','middle',650);out.push({kind:'fig',key:'f'+v,x0:fx-fw/2,y0:bot-10,x1:fx+fw/2,y1:bot-2});}}
  s+=S(minor,'gi-k',.9)+S(major,'gi-k',1.4)+`<g class="gi-figs">${figs}</g>`;
  // the letter bands: paper tabs hung under the ruler; each is a button (the answer's target); the chosen one is pressed in
  let tabs='';
  for(const b of vm.bands){const x1=X(Math.max(b.lo,lo)),x2=X(Math.min(b.hi,hi));if(x2-x1<5)continue;
   const on=!!vm.need&&vm.need.low===b.lo,dy=on?1.4:0,pts=[[x1+1.2,bot+dy],[x2-1.2,bot+dy],[x2-3.6,bot+tabH+dy],[x1+3.6,bot+tabH+dy]];
   const letter=x2-x1>=13?T((x1+x2)/2,bot+tabH-4.4+dy,b.letter,10.5,on?'gi-tc gi-lit gi-tab-letter':'gi-t gi-lit gi-tab-letter','middle',700):'';
   const inner=F(p.fill(pts,.9,1.1,.2),on?'gi-tab-on':BAND_CLASS[b.letter]||'gi-band-f')+S(p.path(pts,true,.25),on?'gi-kc':'gi-k',on?1.9:1.15)+letter;
   out.push({kind:'tab',key:'t'+b.letter,x0:x1+1.2,y0:bot,x1:x2-1.2,y1:bot+tabH+dy});
   tabs+=b.lo>0&&b.lo<100?`<g class="gi-band gi-tab" data-gi-band="${b.lo}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${b.lo} and up" style="transform-origin:${R((x1+x2)/2)}px ${R(bot)}px">${inner}</g>`:`<g class="gi-band-static">${inner}</g>`;}
  s+=`<g class="gi-bands">${tabs}</g>`;
  // the pins: their numbers beside their heads, on the sides away from each other, inside the module
  const px=X(vm.current),g=vm.ghost,gx=g?X(g.value):px,nowW=textW(vm.currentText,12.5,true)+2,ifW=g?textW(g.label,12.5,true)+2:0;
  let nowSide=g?(gx>=px?-1:1):1,ifSide=-nowSide;const fits=(x,side,w)=>side>0?x+7+w<=W-2:x-7-w>=2;
  if(!fits(px,nowSide,nowW))nowSide=-nowSide;if(g&&!fits(gx,ifSide,ifW))ifSide=-ifSide;
  // both on one side (the pins are near an edge): the outer pin's number stands beside it, the inner one's past that
  let nowDx=nowSide*7,ifDx=ifSide*7;
  const span=(x,dx,side,w)=>side>0?[x+dx,x+dx+w]:[x+dx-w,x+dx],meets=(a,b)=>a[0]<b[1]+4&&b[0]<a[1]+4;
  if(g&&nowSide===ifSide){
    const n=span(px,nowDx,nowSide,nowW),i=span(gx,ifDx,ifSide,ifW);
    if(meets(n,i)||meets(n,[gx-6,gx+6])||meets(i,[px-6,px+6])){
      const dir=nowSide;
      if(dir>0?px>=gx:px<=gx)ifDx=(dir>0?px+7+nowW+6:px-7-nowW-6)-gx;else nowDx=(dir>0?gx+7+ifW+6:gx-7-ifW-6)-px;
    }
  }
  const box=(x,dx,side,w,kind)=>({kind,key:kind,x0:side>0?x+dx:x+dx-w,y0:labelY-9.4,x1:side>0?x+dx+w:x+dx,y1:labelY+.8});
  out.push(box(px,nowDx,nowSide,nowW,'plabel'),{kind:'pin',key:'pnow',x0:px-5,y0:headY-5,x1:px+5,y1:headY+5});
  if(g)out.push(box(gx,ifDx,ifSide,ifW,'glabel'),{kind:'pin',key:'pif',x0:gx-5,y0:headY-5,x1:gx+5,y1:headY+5});
  const lab=(dx,side,cls,text)=>T(dx,labelY,text,12.5,cls,side>0?'start':'end',700);
  const ghostPin=`<g class="gi-ghost-in">${S(`M0 ${headY+4.6}V${top+7.5}`,'gi-k',1.3)}${F(p.ell(0,headY,4.7,4.7,.15),'gi-hollow')}${S(p.ell(0,headY,4.7,4.7,.2),'gi-k',1.8)}${lab(ifDx,ifSide,'gi-t gi-lit gi-ghost-label gi-pin-if',g?g.label:vm.currentText)}</g>`;
  const nowPin=`<g class="gi-poise-in">${S(`M0 ${headY+4.4}V${top+7.5}`,'gi-k',1.4)}${F(p.ell(.9,headY+1.1,4.8,4.8,.15),'gi-clay')}${S(p.ell(0,headY,4.8,4.8,.2),'gi-k',1.6)}${S(`M-2.2 ${headY-1.6}q1.2 -1.4 3 -1.2`,'gi-kl',1)}${lab(nowDx,nowSide,'gi-t gi-lit gi-pin-now',vm.currentText)}</g>`;
  s+=`<g class="gi-ghost" data-gi-on="${g?1:0}" data-gi-v="${R(g?g.value:vm.current)}" data-gi-side="${ifSide}" transform="translate(${R(gx)} 0)">${ghostPin}</g><g class="gi-poise" data-gi-v="${R(vm.current)}" data-gi-side="${nowSide}" transform="translate(${R(px)} 0)">${nowPin}</g>`;
  return {s,vx0,vx1};
 }
 // wide (a module of 500 px and up): one line per row, the name, the slider, the category's tag, the day and points; else
 // two lines, the name and the tag over the slider with the day and points at its right.
 const ROW_H={wide:36,two:48,hidden:28};
 // (the column is planned for the widest the figure gets, 50/50 pts, so setting or moving a score never shifts the tracks)
 const metaOf=(row,widest)=>{const p=widest&&row.ptsMax||row.pts;return row.pretend?p:`${row.day} · ${p}`;};
 // The columns every row shares, so the tracks stand one under another on one 0-100 scale: the day and points (as wide
 // as the widest), the category tags (one line: the whole tag, else the name alone, else none, the same for every row)
 // and the ×'s place when a pretend row is among them.
 function rowColumns(rows,W,pad,wide){
  const mw=Math.max(0,...rows.map(r=>textW(metaOf(r,true),11))),xR=W-pad-(rows.some(r=>r.pretend)?20:0),nameCol=wide?Math.round(clamp(W*.28,130,250)):0;
  if(!wide)return {wide,mw,xR,nameCol};
  const track=t=>xR-mw-12-(t?t+10:0)-(pad+1+nameCol+6);let mode='cat',tag=Math.max(0,...rows.map(r=>r.cat?textW(r.cat,10.5)+14:0));
  if(track(tag)<120){mode='catName';tag=Math.max(0,...rows.map(r=>r.catName?textW(r.catName,10.5)+14:0));}
  if(track(tag)<120){mode='';tag=0;}
  return {wide,mw,xR,nameCol,mode,tag};
 }
 function moduleRow(p,row,i,y0,W,pad,course,out,cols){
  const wide=cols.wide,pretend=row.pretend===true,named=row.named===true,ty=wide?y0+11:y0+33,nameY=wide?y0+15.5:y0+13.5,xR=wide?cols.xR:W-pad-(pretend?20:0);
  const meta=metaOf(row),mw=textW(meta,11);let cat=wide?(cols.mode?row[cols.mode]||'':''):row.cat||'',tagW=cat?textW(cat,10.5)+14:0;
  // two lines: what is left for the name decides how much of the category's tag is shown
  const nameCol=cols.nameCol,room_=w=>xR-(w?w+10:0)-(pad+1);
  if(!wide&&cat&&room_(tagW)<70){cat=row.catName||'';tagW=cat?textW(cat,10.5)+14:0;}
  if(!wide&&cat&&room_(tagW)<70){cat='';tagW=0;}
  const nameSpace=wide?nameCol-6:room_(tagW),nm=typeof row.name==='function'?row.name(Math.max(6,Math.floor(nameSpace/(13.5*.58)))):row.name,nw=Math.min(nameSpace,textW(nm,13.5,true));
  let s='';
  // a pretend row's name is pencilled on a slip of paper: a wash off the line, under a dashed pencil outline
  if(pretend){
    const x0=pad-4,x1=pad+1+nw+7,t=nameY-13.5,u=nameY+5,sl=[[x0,t+.6],[x1,t],[x1+.5,u-.4],[x0+.3,u]];
    s+=F(p.fill(sl,1.4,1.6,.2),'gi-pwd')+F(p.fill(sl,0,0,.2),'gi-pw')+S(p.path(sl,true,.25),'gi-kp',1).replace('/>',' stroke-dasharray="4 3"/>');
  }
  const nameText=T(pad+1,nameY,nm,13.5,pretend?'gi-t gi-pencil-t gi-row-n':'gi-t gi-row-n','start',650);
  s+=row.url?`<a class="gi-tag-link gi-row-link" href="${row.url}" aria-label="${row.linkLabel}">${nameText}</a>`:nameText;
  if(named)s+=S(p.wave(pad+1,nameY+3.4,pad+1+Math.max(24,nw),.7,Math.max(18,nw/3)),'gi-kc gi-named-line',1.7);
  out.push({kind:'name',key:'n'+i,x0:pad+1,y0:nameY-10,x1:pad+1+nw,y1:nameY+(named?4.5:3)});
  // the day and the points: at the right end of the line (one line) or of the slider (two lines)
  const my=wide?nameY-1:ty+4,mx=wide?xR:W-pad;s+=T(mx,my,meta,11,'gi-ts gi-row-meta','end',550);out.push({kind:'meta',key:'m'+i,x0:mx-mw,y0:my-9,x1:mx,y1:my+1});
  if(tagW){const tx=wide?xR-cols.mw-12-cols.tag:xR-tagW,t0=wide?y0+3.4:y0+1.6,pts=[[tx,t0],[tx+tagW,t0-.5],[tx+tagW-.4,t0+14.8],[tx+.4,t0+15.2]];
   s+=`<g class="gi-cat-tag" transform="rotate(${i%2?.8:-.9} ${R(tx+tagW/2)} ${R(t0+7.4)})">${F(p.fill(pts,1.2,1.5,.15),'gi-shadow')}${F(p.fill(pts,0,0,.15),'gi-tag')}${S(p.path(pts,true,.2),'gi-ks',1)}${T(tx+tagW/2,t0+11,cat,10.5,'gi-ts','middle',600)}</g>`;
   out.push({kind:'cat',key:'c'+i,x0:tx-1,y0:t0-1.2,x1:tx+tagW+1.5,y1:t0+16.6});}
  if(pretend){
    const cx=W-pad-7,cy=wide?y0+11:y0+8.5;
    s+=`<g class="gi-x" role="button" tabindex="0" data-gi-action="unpretend" data-gi-course="${course}" data-gi-pid="${row.key}" aria-label="${row.removeLabel}"><path class="gi-hit" d="M${R(cx-9)} ${R(cy-9)}h18v18h-18z"/>${S(p.line(cx-4.2,cy-4.4,cx+4.4,cy+4.2,.3)+p.line(cx+4.3,cy-4.3,cx-4.2,cy+4.4,.3),'gi-k',1.6)}</g>`;
    out.push({kind:'x',key:'x'+i,x0:cx-6,y0:cy-6,x1:cx+6,y1:cy+6});
  }
  // the slider: its track, five ticks, the clay fill to the knob once a score is set, and the knob (a small paper tab)
  const tx0=wide?pad+1+nameCol+6:pad+1,
    tx1=wide?xR-cols.mw-12-(cols.tag?cols.tag+10:0):W-pad-cols.mw-10,
    a=tx0+18,
    b=Math.max(a+40,tx1-18),
    on=row.f!=null,
    f=on?row.f:row.rest??.5,
    kx=a+(b-a)*f;
  let ticks='';for(const t of [0,.25,.5,.75,1])ticks+=`M${R(a+(b-a)*t)} ${R(ty+(t%.5?3.2:4.4))}v${t%.5?-6.4:-8.8}`;
  const groove=S(p.line(a,ty,b,ty,.35),pretend?'gi-kp':'gi-ks',1.6)+S(ticks,pretend?'gi-kp':'gi-kf',1);
  const shape=[[-17.5,ty-9],[17.5,ty-9.4],[17.9,ty+9],[-17.7,ty+9.4]];
  const knob=`<g class="gi-knob2${on?' gi-knob-on':' gi-knob-rest'}${row.restLabel&&!on?' gi-knob-need':''}" style="transform:translateX(${R(kx)}px)">${F(p.fill(shape,1.4,1.8,.2),'gi-shadow')}${F(p.fill(shape,0,0,.15),'gi-knob-paper')}${S(p.path(shape,true,.2),'gi-knob-ink',1.5)}${S(`M-2.2 ${R(ty-4)}v8M2.2 ${R(ty-4)}v8`,'gi-ks gi-knob-grip',1.1)}${T(0,ty+3.9,on?pctText(row.f):row.restLabel||'',knobSize(on?pctText(row.f):row.restLabel||''),'gi-t gi-knob-t','middle',700)}</g>`;
  s+=`<g class="gi-slide${pretend?' gi-slide-p':''}" role="slider" tabindex="0" aria-label="${row.aria}" aria-valuemin="0" aria-valuemax="100"${on?` aria-valuenow="${Math.round(row.f*100)}"`:''} aria-valuetext="${row.valueText}" data-gi-id="${row.key}" data-gi-pts="${row.points||0}" data-gi-day="${row.pretend?'':row.day}" data-gi-f="${on?Math.round(row.f*1e4)/1e4:''}" data-gi-rest="${R(f*100)/100}" data-gi-a="${R(a)}" data-gi-b="${R(b)}" data-gi-ty="${R(ty)}"><path class="gi-hit" d="M${R(a-18)} ${R(ty-12)}H${R(b+18)}V${R(ty+12)}H${R(a-18)}Z"/>${groove}<path class="gi-slide-fill" d="M${R(a)} ${R(ty)}H${R(on?kx:a)}" stroke-width="3.2"${on?'':' data-gi-off="1"'}/>${knob}</g>`;
  out.push({kind:'track',key:'k'+i,x0:a-18,y0:ty-10,x1:b+18,y1:ty+10});
  return `<g class="gi-row${pretend?' gi-row-p':''}${named?' gi-row-named':''}" data-rd-key="gi-row-${row.key}" data-gi-row="${row.key}">${s}</g>`;
 }
 // Grades hidden: a name (the link) and, at the right, its day and category. No number anywhere.
 function hiddenRow(p,row,i,y0,W,pad,out){
  const meta=[row.day,row.cat].filter(Boolean).join(' · '),
    mw=textW(meta,11),
    space=W-2*pad-2-(meta?mw+12:0),
    nm=typeof row.name==='function'?row.name(Math.max(6,Math.floor(space/(13*.58)))):row.name;
  out.push({kind:'name',key:'n'+i,x0:pad+1,y0:y0+3,x1:pad+1+Math.min(space,textW(nm,13,true)),y1:y0+17});if(meta)out.push({kind:'meta',key:'m'+i,x0:W-pad-mw,y0:y0+5,x1:W-pad,y1:y0+16});
  return `<g class="gi-row gi-row-h" data-rd-key="gi-row-${row.key}" data-gi-row="${row.key}"><a class="gi-tag-link gi-row-link" href="${row.url}" aria-label="${row.linkLabel}">${T(pad+1,y0+14,nm,13,'gi-t gi-row-n','start',620)}</a>${meta?T(W-pad,y0+14,meta,11,'gi-ts gi-row-meta','end',550):''}${S(p.line(pad+1,y0+22.5,W-pad,y0+22.3,.3),'gi-kf',.8)}</g>`;
 }
 function moduleArt(vm,out=[]){
  const W=Math.max(200,Math.round(vm.W||420)),p=pen(77+W),live=vm.state==='ready'&&!vm.hidden,pad=W<300?8:10;let s='',lo0=0,lo1=W;
  if(live){const r=moduleRuler(p,vm,W,pad,out);s+=r.s;lo0=r.vx0;lo1=r.vx1;}
  const top=live?RULER.rows:4,wide=W>=500&&!vm.hidden,rowH=vm.hidden?ROW_H.hidden:wide?ROW_H.wide:ROW_H.two,rows=vm.rows||[],cols=rowColumns(rows,W,pad,wide);let body='';
  rows.forEach((row,i)=>{body+=vm.hidden?hiddenRow(p,row,i,top+i*rowH,W,pad,out):moduleRow(p,row,i,top+i*rowH,W,pad,vm.course.id,out,cols);});
  const H=Math.round(top+rows.length*rowH+(rows.length?(vm.hidden?2:0):4));
  const appKey=`${vm.course.id}-${vm.hidden?'h':vm.state}`;
  return `<svg class="gi-svg gi-mod-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${vm.roomLabel}"><g class="gi-app" data-rd-key="gi-mapp-${appKey}" data-gi-app="${appKey}" data-gi-course="${vm.course.id}" data-gi-hidden="${vm.hidden?1:0}" data-gi-lo="${vm.lo}" data-gi-hi="${vm.hi}" data-gi-bx="${R(lo0)}" data-gi-bw="${R(lo1-lo0)}" data-gi-by="0" data-gi-mod="1" data-gi-w="${W}"><g class="gi-app-in" style="transform-origin:${R(W/2)}px ${R(H/2)}px">${s}<g class="gi-rows">${body}</g></g></g></svg>`;
 }
 // The controls' own drawings: Add assignment (a sheet and a pencil), Clear (an eraser), the add row's tick and ×, and
 // the line drawn under a field. Small inline SVGs whose colours are classes; the same lines on every render.
 const icons=new Map();
 function icon(name){
  let hit=icons.get(name);if(hit!==undefined)return hit;const p=pen(911+[...name].reduce((n,c)=>n+c.charCodeAt(0),0));let body='',vb='0 0 28 22';
  if(name==='add'){
   const sheet=[[4.2,3.6],[15.4,2.4],[18.6,5.6],[19.4,19.2],[5.4,20.2]];
   body=F(p.fill(sheet,1.2,1.4,.2),'gi-ico-wash')+
     F(p.fill(sheet,0,0,.15),'gi-ico-paper')+
     S(p.path(sheet,true,.2),'gi-ico-k',1.3)+
     S('M15.4 2.6l.5 3.4l2.7-.3','gi-ico-k',1)+
     S(p.line(7.4,9,15,8.4,.2)+p.line(7.6,12.4,14.2,12,.2)+p.line(7.8,15.8,12,15.6,.2),'gi-ico-soft',.9);
   const pen_=[[26.4,6.6],[24.2,4.6],[13.8,15.6],[16,17.6]];
   body+=F(p.fill(pen_,.8,1,.1),'gi-ico-pencil')+
     F(p.fill([[26.4,6.6],[24.2,4.6],[25.6,3.2],[27.6,5.2]],0,0,.05),'gi-ico-eraser')+
     S(p.path(pen_,true,.15)+'M24.2 4.6l1.4-1.4l2 2l-1.2 1.4','gi-ico-k',1.15);
   body+=F('M13.8 15.6l-1.6 4l4-2z','gi-ico-wood')+S('M13.8 15.6l-1.6 4l4-2','gi-ico-k',1.1)+F('M12.6 18.6l-.4 1l1-.4z','gi-ico-lead');
  }else if(name==='eraser'){
   const block=[[3.2,14.6],[13.4,4.4],[24.6,9.8],[14.4,20]],sleeve=[[8.6,9.2],[13.4,4.4],[24.6,9.8],[19.8,14.6]];
   body=F(p.fill(block,1.2,1.4,.2),'gi-ico-wash')+
     F(p.fill(block,0,0,.15),'gi-ico-eraser')+
     F(p.fill(sleeve,0,0,.15),'gi-ico-sleeve')+
     S(p.path(block,true,.2)+p.line(8.6,9.2,19.8,14.6,.15),'gi-ico-k',1.3)+
     S(p.line(5.6,15.4,13.8,19.2,.15),'gi-ico-soft',.9);
   body+=S('M2.4 19.6h2.2M6 20.6h1.4M9.4 20.2h.8','gi-ico-soft',1.2);
  }else if(name==='tick'){vb='0 0 20 20';body=S('M3.6 10.6C5.2 12 6.4 13.6 7.6 15.6C9.8 10.6 12.8 6.6 16.8 3.8','gi-ico-clay',2.3);}
  else if(name==='cross'){vb='0 0 20 20';body=S(p.line(5,5.2,15,14.8,.3)+p.line(15.2,5,4.8,15,.3),'gi-ico-k',1.8);}
  else if(name==='line')return icons.set(name,`<svg class="gi-line" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="gi-line-ink" vector-effect="non-scaling-stroke" d="M1 3.6C20 2.4 40 3.9 60 2.9S88 3.5 99 2.6"/></svg>`).get(name);
  hit=`<svg class="gi-ico gi-ico-${name}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;icons.set(name,hit);return hit;
 }
 // A small weight for other doors (Up next, the reader), sized like its full swing.
 function mini(wd){const w=clamp(wd*.32,9,22),h=w*.62,p=pen(5);return `<svg class="gi-mini" viewBox="-14 -2 28 26" width="28" height="26" aria-hidden="true">${S('M0 0v5','gi-k',1.1)}${S(p.ell(0,7,2.4,2,.05),'gi-k',1.1)}${F(p.fill([[-w*.17,9],[w*.17,9],[w*.36,9+h*.3],[w*.5,9+h],[-w*.5,9+h],[-w*.36,9+h*.3]],0,0,.1),'gi-iron')}${S(p.path([[-w*.17,9],[w*.17,9],[w*.36,9+h*.3],[w*.5,9+h],[-w*.5,9+h],[-w*.36,9+h*.3]],true,.1),'gi-k',1.2)}</svg>`;}
 // A control's own drawing, stretched behind its words: an offset wash, the paper, and an ink edge whose line keeps
 // its weight at any size. The same seed draws the same edge every time.
 const chips=new Map();
 function chip(seed=1){
  let hit=chips.get(seed);if(hit)return hit;const p=pen(700+seed),pts=[[3,3],[50,2.2],[97,3.4],[97.6,18],[96.8,33],[50,33.8],[2.6,32.6],[2.2,18]];
  hit=`<svg class="gi-chip-art" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="gi-chip-wash" d="${p.fill(pts,2.4,3.2,.5)}"/><path class="gi-chip-paper" d="${p.fill(pts,0,0,.4)}"/><path class="gi-chip-ink" vector-effect="non-scaling-stroke" d="${p.path(pts,true,.6)}"/></svg>`;
  chips.set(seed,hit);return hit;
 }
 // The drawn edge of the paper that grows from the module into the room.
 function flyEdge(){const p=pen(31);return `<svg class="gi-fly-edge" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${S(p.rect(1,1,98,98,.4),'gi-k',2).replace('/>',' vector-effect="non-scaling-stroke"/>')}</svg>`;}

 // ---------------------------------------------------------------- motion
 // Every action: anticipation, action, overshoot and settle, rest. Only water, smoke, fire and drifting cloud
 // keep moving (CSS, paused when hidden). Reduced motion and Motion off: no movement at all.
 function stage({container,api}){
  const doc=container.ownerDocument,win=doc.defaultView||root;
  const media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const host=()=>container.closest?.('.rd')||container;
  const off=()=>!!media?.matches||host().dataset?.motionStyle==='off'||host().dataset?.featureMotion==='off';
  let pageDir=0;const watched=new Set();
   const seen=new WeakSet(),
     arrived=new WeakSet(),
     outside=new WeakMap(),
     slips=new Map(),
     values=new WeakMap(),
     clays=new WeakMap(),
     hiddenRoom=new WeakMap(),
     memo=new WeakMap(),
     stale=[];
   let drag=null,raf=0,dead=false,io=null,ro=null,lastApp=new Map(),revision=null,pending=0,hourTimer=0,hourDue=0;
  // Still (the house meaning, motion.js): things fade in where they land and nothing travels.
  const still=()=>!off()&&host().dataset?.motionStyle==='still';
  // a move stamps the dashboard with when it ends, so the companion keeps still meanwhile (pets.js)
  const busyFor=ms=>{try{const t=Date.now()+ms,h=host();if(!(Number(h.dataset.chMoving)>=t))h.dataset.chMoving=String(t);}catch{}};
  // The house curves: settle for what arrives, letgo for what leaves, fade for opacity, pen for a travel.
  const EZ=()=>root.ReserveMotion?.easings||{},
    SETTLE=()=>EZ().settle||'cubic-bezier(.2,.75,.25,1)',
    LETGO=()=>EZ().letgo||'cubic-bezier(.2,0,.4,1)',
    FADE=()=>EZ().fade||'cubic-bezier(.2,.65,.3,1)',
    PEN=()=>EZ().pen||'cubic-bezier(.45,.05,.25,1)';
  // every move the room starts is kept until it ends, so a leave can take each one over from where it is
  const moving=new Set();
  function play(el,frames,opts={}){if(!el||off()||typeof el.animate!=='function')return null;
   if(still()){
     const a=frames[0]?.opacity,b=frames[frames.length-1]?.opacity;
     if(a===undefined&&b===undefined||+(a??1)===+(b??1))return null;
     try{return el.animate([{opacity:+(a??1)},{opacity:+(b??1)}],{duration:180,delay:Math.min(opts.delay||0,160),easing:FADE(),fill:opts.fill||'backwards'});}catch{return null;}
   }
   try{
     const a=el.animate(frames,{fill:'backwards',easing:SETTLE(),...opts});
     moving.add(a);
     const drop=()=>moving.delete(a);
     a.finished.then(drop,drop);
     return a;
   }catch{return null;}}
  // Take over every move still under way inside a room (an arrival, a weight still dropping, the lamp catching): what
  // it shows now is written on the element and the move is let go, so the leave starts from there, never from the end.
  function takeOver(scope){
    for(const a of [...moving]){
      const el=a.effect?.target;
      if(!el||!scope.contains(el))continue;
      if(a.playState==='running'||a.playState==='pending'){try{a.commitStyles?.();}catch{}}
      try{a.cancel();}catch{}
      moving.delete(a);
    }
  }
  const all=(scope,sel)=>scope?Array.from(scope.querySelectorAll(sel)):[];
  const done=a=>a?a.finished.then(()=>true,()=>true):Promise.resolve(true);
  function swing(wt,deg=6,delay=0){
    const g=wt.querySelector('.gi-swing');
    return play(
      g,
      [
        {transform:'rotate(0deg)'},
        {transform:`rotate(${deg}deg)`,offset:.22},
        {transform:`rotate(${-deg*.55}deg)`,offset:.48},
        {transform:`rotate(${deg*.25}deg)`,offset:.7},
        {transform:`rotate(${-deg*.08}deg)`,offset:.86},
        {transform:'rotate(0deg)'}
      ],
      {duration:1200,delay,easing:PEN()});
  }
  function cord(wt,to,dur=220,delay=0){
    const c=wt.querySelector('.gi-cord');
    if(!c)return null;
    const a=c.dataset.taut,b=c.dataset.slack;
    return play(c,to==='slack'?[{d:`path('${a}')`},{d:`path('${b}')`}]:[{d:`path('${b}')`},{d:`path('${a}')`,offset:.7},{d:`path('${a}')`}],{duration:dur,delay,fill:to==='slack'?'forwards':'backwards'});
  }
  // A weight is lowered, never dropped through the rail: it starts reeled up under its hook (the cord's full length
  // above where it rests, so its ring sits just below the plank), the cord pays out with it, stretches a little at the
  // bottom of the fall and takes it back, then the weight swings to rest.
  function reel(wt){const k=+wt.dataset.giK||1,len=26*k;return {k,len,at:ty=>`scaleY(${R(clamp((len+ty)/len,.02,1.4)*1000)/1000})`};}
  function dropIn(wt,i,base=0){
   const d=wt.querySelector('.gi-drop'),c=wt.querySelector('.gi-cordg'),{len,at}=reel(wt),o={duration:640,delay:base+i*60,easing:PEN()};
   const steps=[[-len,0,0],[-len,1,.08],[5,1,.62],[-2,1,.8],[0,1,1]];
   const a=play(d,steps.map(([ty,op,offset])=>({transform:`translateY(${R(ty)}px)`,opacity:op,offset})),o);
   play(c,steps.map(([ty,,offset])=>({transform:at(ty),offset})),o);
   swing(wt,4+i%3,base+i*60+450);return a;}
  function figures(app,delay){all(app,'.gi-fig').forEach((f,i)=>play(f,[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:240,delay:delay+i*45}));}
  function poiseSlide(app,delay){
    const pz=app.querySelector('.gi-poise:not(.gi-poise-rest) .gi-poise-in');
    if(!pz)return;
    const lo=+app.dataset.giLo,hi=+app.dataset.giHi,bw=+app.dataset.giBw,v=+app.querySelector('.gi-poise').dataset.giV,dx=-(bw*(v-lo)/(hi-lo));
    play(
      pz,
      [{transform:`translateX(${dx}px)`},{transform:`translateX(${dx}px)`,offset:.1},{transform:'translateX(2.5px)',offset:.78},{transform:'translateX(-.8px)',offset:.9},{transform:'translateX(0)'}],
      {duration:900,delay,easing:SETTLE()});
  }
  function appArrive(app,base=0){
   if(!app)return;
   play(app.querySelector('.gi-bands'),[{opacity:0,transform:'scaleY(.9)'},{opacity:1,transform:'none'}],{duration:320,delay:base});
   figures(app,base+200);poiseSlide(app,base+260);
   all(app,'.gi-wt').forEach((wt,i)=>dropIn(wt,i,base+320));
   const g=app.querySelector('.gi-ghost[data-gi-on="1"] .gi-ghost-in');play(g,[{opacity:0},{opacity:0,offset:.5},{opacity:1}],{duration:900,delay:base});
  }
  // The slip is slid onto the bench from the right and tipped against its weight; a new part on a slip already there
  // is written in (the paper stretches up to make room, then the ink appears), never re-dealt.
  function benchThings(svg,base=0){
   const live=new Set();
   for(const s of all(svg,'[data-gi-slip]:not(.gi-out *)')){
     const key=s.dataset.giSlip,parts=all(s,'[data-gi-part]').map(x=>x.dataset.giPart),had=slips.get(key);
     live.add(key);
     slips.set(key,new Set(parts));
    if(!had){(s.dataset.giNote?noteIn:slipIn)(s,base);continue;}
    for(const part of all(s,'[data-gi-part]'))
      if(!had.has(part.dataset.giPart)){
        play(s,[{transform:'scaleY(.9)'},{transform:'scaleY(1.02)',offset:.6},{transform:'none'}],{duration:360});
        play(part,[{opacity:0,transform:'translateY(-6px)'},{opacity:0,transform:'translateY(-6px)',offset:.35},{opacity:1,transform:'translateY(1px)',offset:.8},{opacity:1,transform:'none'}],{duration:520});
      }}
   for(const key of [...slips.keys()])if(!live.has(key))slips.delete(key);
  }
  // The note on the bench's front is hung on its left tack: it swings in, overshoots, settles.
  function noteIn(s,delay=0){
    play(
      s,
      [
        {transform:'translateY(-8px) rotate(-8deg)',opacity:0},
        {transform:'translateY(-8px) rotate(-8deg)',opacity:1,offset:.12},
        {transform:'rotate(2.2deg)',offset:.55},
        {transform:'rotate(-.9deg)',offset:.76},
        {transform:'rotate(.3deg)',offset:.9},
        {transform:'none'}
      ],
      {duration:720,delay,easing:'ease-out'});
  }
  function tear(el,delay=0){
    return play(
      el,
      [{transform:'none',opacity:1},{transform:'translate(-3px,2px) rotate(-1deg)',opacity:1,offset:.22},{transform:'translate(46px,-22px) rotate(9deg)',opacity:0}],
      {duration:340,delay,fill:'forwards',easing:LETGO()});
  }
  function slipIn(s,delay=0){
    play(
      s,
      [
        {transform:'translate(44px,-6px) rotate(4deg)',opacity:0},
        {transform:'translate(-4px,0) rotate(-1.2deg)',opacity:1,offset:.7},
        {transform:'translate(1px,0) rotate(.3deg)',offset:.86},
        {transform:'none'}
      ],
      {duration:560,delay});
  }
  function motes(roomEl,delay=0){
    all(roomEl,'.gi-mote').forEach((m,i)=>
      play(
        m,
        [{opacity:0,transform:'translateY(-26px)'},{opacity:.9,transform:'translateY(-14px)',offset:.35},{opacity:.45,transform:'translateY(0)'}],
        {duration:1800+(i%5)*240,delay:delay+(i%7)*90,easing:'ease-out'}));
  }
  // The balance under its glass bell feels a weight land on the rail: its beam tips, the pans counter-swing, it rests.
  function tremor(roomEl,delay=0,deg=1.8){const beam=roomEl?.querySelector('.gi-beam');if(!beam)return;
   play(
     beam,
     [{transform:'rotate(0deg)'},{transform:`rotate(${deg}deg)`,offset:.2},{transform:`rotate(${-deg*.6}deg)`,offset:.45},{transform:`rotate(${deg*.25}deg)`,offset:.7},{transform:'rotate(0deg)'}],
     {duration:1500,delay,easing:'ease-in-out'});
   all(beam,'.gi-pan').forEach(pan=>
     play(
       pan,
       [{transform:'rotate(0deg)'},{transform:`rotate(${-deg*1.4}deg)`,offset:.25},{transform:`rotate(${deg*.8}deg)`,offset:.5},{transform:`rotate(${-deg*.3}deg)`,offset:.75},{transform:'rotate(0deg)'}],
       {duration:1500,delay:delay+60,easing:'ease-in-out'}));}
  function sunXY(svg,key){const v=String(svg?.dataset?.[key]||'').split(',').map(Number);return v.length===2&&v.every(Number.isFinite)?v:null;}
  // The sun moves along its arc (it is never redrawn): from where it stood to the hour's place, 2 px past it, back.
  function sunTravel(svg,from,to,dur=1600,delay=0){
    const g=svg?.querySelector?.('.gi-view-day .gi-sun-g');
    if(!g||!from||!to)return;
    const dx=to[0]-from[0],dy=to[1]-from[1],n=Math.hypot(dx,dy);
    if(n<.5)return;
   play(
     g,
     [{transform:`translate(${from[0]}px,${from[1]}px)`},{transform:`translate(${R(to[0]+2*dx/n)}px,${R(to[1]+2*dy/n)}px)`,offset:.82},{transform:`translate(${to[0]}px,${to[1]}px)`}],
     {duration:dur,delay,easing:PEN()});}
  // The lamp clicks on: the flame catches small, flares past its size, settles; its light comes up where it lands.
  function lampOn(roomEl,delay){
   play(
     roomEl.querySelector('.gi-flame'),
     [{transform:'scale(0)',opacity:0},{transform:'scale(0)',opacity:0,offset:.3},{transform:'scale(1.3,1.45)',opacity:1,offset:.62},{transform:'scale(.9)',offset:.8},{transform:'none'}],
     {duration:760,delay});
   play(roomEl.querySelector('.gi-lamplight'),[{opacity:0},{opacity:0,offset:.45},{opacity:1}],{duration:900,delay});}
  function life(roomEl,base){
   play(
     roomEl.querySelector('.gi-pull'),
     [
       {transform:'rotate(0deg)'},
       {transform:'rotate(7deg)',offset:.18},
       {transform:'rotate(-4.5deg)',offset:.42},
       {transform:'rotate(2deg)',offset:.66},
       {transform:'rotate(-.6deg)',offset:.84},
       {transform:'rotate(0deg)'}
     ],
     {duration:1900,delay:base+80,easing:'ease-in-out'});
   tremor(roomEl,base+900,1.2);
   const svg=roomEl.querySelector('.gi-svg');sunTravel(svg,sunXY(svg,'giSun0'),sunXY(svg,'giSun'),1700,base);
   play(roomEl.querySelector('.gi-l-shaft'),[{opacity:0,transform:'skewX(-3deg)'},{opacity:1,transform:'skewX(.4deg)',offset:.8},{opacity:1,transform:'none'}],{duration:1400,delay:base+120});
   if(svg?.dataset?.giNight==='1')play(svg.querySelector('.gi-l-dusk'),[{opacity:0},{opacity:1}],{duration:1200,delay:base,easing:'ease-in-out'});
   lampOn(roomEl,base+700);
   for(const b of all(roomEl,'.gi-view .gi-bird')){
     if(!b.getBoundingClientRect().width)continue;
     const w=+(roomEl.querySelector('.gi-svg')?.getAttribute('data-gi-ww')||260);
     play(
       b,
       [{transform:'translate(0,0)',opacity:1},{transform:`translate(${w*.5}px,-10px)`,opacity:1,offset:.5},{transform:`translate(${w+70}px,-4px)`,opacity:1}],
       {duration:3200,delay:base+1500,easing:'linear',fill:'none'});
     play(b.querySelector('.gi-bird-in'),[{transform:'scaleY(1)'},{transform:'scaleY(-.6)'},{transform:'scaleY(1)'}],{duration:320,delay:base+1500,iterations:10,fill:'none'});
   }
   motes(roomEl,base+1300);
  }
  // The room arrives: when it was opened from Home a sheet of its wall has already grown over Home (Home stayed painted
  // under it) and the room was drawn under that sheet; the sheet lifts off while the room washes in, one ground at a
  // time (250-300 ms each), the figures ink in, then what lies on the bench, then its life. All on the house curves.
  function roomArrive(roomEl){
   const svg=roomEl.querySelector('.gi-svg'),sheet=liftSheet(roomEl),soon=sheet?0:60;
   play(svg?.querySelector('.gi-l-far'),[{opacity:0},{opacity:1}],{duration:250,delay:soon,easing:FADE()});
   play(svg?.querySelector('.gi-l-mid'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:300,delay:soon+40});
   // The bench and what lies on or over it (where the light lands, the lamp's light) come up together, as one ground.
   for(const sel of ['.gi-l-near','.gi-l-land','.gi-l-lamp'])
     play(svg?.querySelector(sel),[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(-1.5px)',offset:.8},{opacity:1,transform:'none'}],{duration:300,delay:soon+80});
   play(roomEl.querySelector('.gi-head'),[{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'none'}],{duration:250,delay:soon+100});
   const app=svg?.querySelector('.gi-app');appArrive(app,soon+160);benchThings(svg,soon+420);life(roomEl,soon+500);
   if(app){lastApp.set(roomEl,app.dataset.giApp);hiddenRoom.set(roomEl,app.dataset.giHidden==='1');}
  }
  // ---- the sheet: a piece of the room's own wall, with a drawn edge, that grows out of the module over Home, is what
  // the room is drawn under, and folds back into the module over Home once Home has been drawn under it
  let sheet=null,lastFrom=null;
  function sheetLayer(){
    let layer=container.querySelector(':scope > .gi-flylayer');
    if(!layer){layer=doc.createElement('div');layer.className='gi gi-flylayer';layer.setAttribute('aria-hidden','true');layer.setAttribute('data-rd-keep','');container.append(layer);}
    return layer;
  }
  const box=r=>({left:r.left,top:r.top,width:r.width,height:r.height});
  const toward=(from,at)=>`translate(${R(from.left-at.left)}px,${R(from.top-at.top)}px) scale(${R(from.width/at.width*1000)/1000},${R(from.height/at.height*1000)/1000})`;
  function makeSheet(at){
    const el=doc.createElement('div');
    el.className='gi-flysheet';
    el.style.cssText=`left:${R(at.left)}px;top:${R(at.top)}px;width:${R(at.width)}px;height:${R(at.height)}px`;
    el.innerHTML=root.ReserveGradeImpactArt.flyEdge();
    sheetLayer().append(el);
    return el;
  }
  // where the room will stand: the workspace under the toolbar, down to the bottom of the window
  function roomTarget(){
    const main=container.querySelector('.rd-workspace')||container,r=main.getBoundingClientRect(),vh=win.innerHeight||900,top=Math.max(8,Math.min(r.top,vh*.4));
    return {left:r.left,top,width:r.width||(win.innerWidth||1440),height:Math.max(200,vh-top-12)};
  }
  function grow(from,course,origin,dip=null,box=null,dipTimer=0){
   busyFor(700);const at=roomTarget(),el=makeSheet(at),a=el.animate?.([{transform:toward(from,at),opacity:.9},{transform:'none',opacity:1}],{duration:300,easing:SETTLE(),fill:'both'});
   const mine=sheet={el,anim:a,from,at,course,origin,state:'growing',dip,box,dipTimer};lastFrom=from;
   // (the page swap is part of the move: busy again from it, however late it comes on a slow machine)
   const open=()=>{if(sheet!==mine||mine.state!=='growing')return;mine.state='over';busyFor(700);if(!api.open(course,from,origin)){drop(mine);}};
   if(a)a.finished.then(open,()=>{});else open();
  }
  function drop(s){if(sheet===s)sheet=null;try{s.anim?.cancel();}catch{}s.el?.remove();}
  // the room is drawn: the sheet over it lifts off (and slides the last pixels onto the room's own box as it goes)
  // (named apart from lift(wt), the weight taken in the hand: two declarations of one name in this scope and the later
  // one wins, so the sheet was never lifted)
  function liftSheet(roomEl){
   const s=sheet;if(!s||s.state!=='over'||!s.el?.isConnected)return null;sheet=null;
   const r=roomEl.getBoundingClientRect(),
     at=s.el.getBoundingClientRect(),
     moveTo=r.width?`translate(${R(r.left-at.left)}px,${R(r.top-at.top)}px) scale(${R(r.width/at.width*1000)/1000},${R(Math.min(r.height,(win.innerHeight||900)-r.top)/at.height*1000)/1000})`:'none';
   try{s.anim?.commitStyles?.();s.anim?.cancel();}catch{}
   const a=s.el.animate?.([{opacity:1},{transform:moveTo,opacity:0}],{duration:250,easing:FADE(),fill:'forwards'});
   const gone=()=>s.el.remove();
   if(a)a.finished.then(gone,gone);else gone();
   return s;
  }
  // Escape while the sheet is still growing (the room not drawn yet): it shrinks back into the module from where it is.
  function retreat(){const s=sheet;if(!s||s.state!=='growing')return false;sheet=null;s.state='back';try{s.anim?.commitStyles?.();s.anim?.cancel();}catch{}
   // the module's dip is let go as the sheet comes back to it (it stayed pressed until a timer gave it up, then popped)
   if(s.dip){win.clearTimeout?.(s.dipTimer);if(s.box?.isConnected)play(s.box,[{transform:'scale(.978)'},{transform:'none'}],{duration:220,easing:SETTLE()});try{s.dip.cancel();}catch{}}
   const a=s.el.animate?.([{transform:toward(s.from,s.at),opacity:.9}],{duration:220,easing:SETTLE(),fill:'forwards'});
   const gone=()=>s.el.remove();
   if(a)a.finished.then(gone,gone);else gone();
   return true;
  }
  // Turning a page in the module: the page on show is copied as it looks this moment (a turn still under way included)
  // before the redraw replaces it; the copy slides off to the other side and fades while the next page comes in, so the
  // module is never empty and a quick second turn never blinks back to nothing.
  let leaving=null;
  function leavingPage(mod,dir){
   const inner=mod.querySelector('.gi-app-in');if(!inner||off()||still())return null;
   for(const a of inner.getAnimations?.()||[]){try{a.commitStyles?.();}catch{}try{a.cancel();}catch{}}
   const copy=inner.cloneNode(true);copy.removeAttribute?.('data-rd-key');copy.setAttribute?.('aria-hidden','true');copy.setAttribute?.('inert','');copy.classList?.add('gi-app-out');
   for(const n of copy.querySelectorAll?.('[data-rd-key],[id]')||[]){n.removeAttribute('data-rd-key');n.removeAttribute('id');}
   inner.style?.removeProperty?.('transform');inner.style?.removeProperty?.('opacity');
   return {copy,dir,from:{transform:copy.style?.transform||'none',opacity:copy.style?.opacity||'1'},at:Date.now()};
  }
  function moduleArrive(mod,dir=0){
   const app=mod.querySelector('.gi-app');if(!app)return;
   const out=leaving;leaving=null;
   if(out&&dir&&Date.now()-out.at<1500){const host=app.querySelector('.gi-app-in')?.parentNode||app;host.insertBefore(out.copy,app.querySelector('.gi-app-in'));
    const a=play(out.copy,[{transform:out.from.transform,opacity:+out.from.opacity},{transform:`translateX(${-dir*22}px)`,opacity:0}],{duration:170,easing:LETGO(),fill:'forwards'});
    const gone=()=>out.copy.remove();
    if(a)a.finished.then(gone,gone);else gone();
   }
   if(dir)
     play(
       app.querySelector('.gi-app-in'),
       [{transform:`translateX(${dir*34}px)`,opacity:0},{transform:`translateX(${dir*10}px)`,opacity:.55,offset:.3},{transform:`translateX(${-dir*3}px)`,opacity:1,offset:.75},{transform:'none'}],
       {duration:420});
   else play(mod,[{transform:'scale(.97)',opacity:.4},{transform:'scale(1.006)',opacity:1,offset:.7},{transform:'none'}],{duration:420});
   figures(app,120);poiseSlide(app,160);all(app,'.gi-wt').forEach((wt,i)=>dropIn(wt,i,200));
   // the answer-first module: the answer comes in with the page, then its rows, one after another
   play(mod.querySelector('.gi-ans-t'),[{opacity:0,transform:`translateX(${dir*14}px)`},{opacity:1,transform:'none'}],{duration:300,delay:40});
   all(app,'.gi-row').forEach((r,i)=>play(r,[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:280,delay:160+i*45}));
  }
  // The weight in the hand: anticipation, lift, the cord goes slack, the tag turns into the dial.
  // The tag turns over on its string: it narrows with a slight lean (the far edge away), shows its other face, overshoots.
  function flip(tag,swap,dir=1){
    const a=play(tag,[{transform:'scaleX(1) skewY(0deg)'},{transform:`scaleX(.04) skewY(${-7*dir}deg)`}],{duration:120,easing:'ease-in',fill:'forwards'});
    const back=()=>{
      swap();
      a?.cancel();
      play(
        tag,
        [{transform:`scaleX(.04) skewY(${7*dir}deg)`},{transform:`scaleX(1.07) skewY(${-1*dir}deg)`,offset:.68},{transform:'scaleX(.99)',offset:.86},{transform:'none'}],
        {duration:260,easing:'ease-out'});
    };
    if(a)a.finished.then(back,back);else swap();
  }
  function lift(wt){
    const held=[];
    held.push(play(
      wt.querySelector('.gi-lift'),
      [{transform:'none'},{transform:'translateY(3px)',offset:.25},{transform:'translateY(-13px)',offset:.75},{transform:'translateY(-10px)'}],
      {duration:340,fill:'forwards'}));
    held.push(cord(wt,'slack',280));
   if(wt.getAttribute('data-gi-dial')!=='1')flip(wt.querySelector('.gi-tagg'),()=>wt.setAttribute('data-gi-dial','1'));return held.filter(Boolean);}
  function letGo(wt,held,keepDial){held.forEach(a=>{try{a.cancel();}catch{}});
   play(
     wt.querySelector('.gi-lift'),
     [{transform:'translateY(-10px)'},{transform:'translateY(3px)',offset:.45},{transform:'translateY(-1px)',offset:.7},{transform:'none'}],
     {duration:440,easing:SETTLE()});
   cord(wt,'taut',380);
   swing(wt,7,200);
   if(!keepDial)flip(wt.querySelector('.gi-tagg'),()=>wt.removeAttribute('data-gi-dial'),-1);
   const roomEl=wt.closest('.gi-room');if(roomEl){motes(roomEl,320);tremor(roomEl,260);}}
  function geometry(app){return {lo:+app.dataset.giLo,hi:+app.dataset.giHi,bx:+app.dataset.giBx,bw:+app.dataset.giBw};}
  function scaleOf(svg){const r=svg.getBoundingClientRect(),vb=svg.viewBox?.baseVal;return vb&&vb.width&&r.width?r.width/vb.width:1;}
  function setDial(d){
    const pct=Math.round(d.f*100),
      knob=d.wt.querySelector('.gi-knob'),
      fill=d.wt.querySelector('.gi-dial-fill'),
      [tx,tl]=String(d.wt.querySelector('.gi-dial')?.dataset.giTrack||'0,1').split(',').map(Number);
   if(knob)knob.style.transform=`translateX(${R(tx+tl*d.f)}px)`;
   if(fill){
     const y=fill.getAttribute('d').match(/^M[\d.-]+ ([\d.-]+)/)?.[1]||0,h=fill.getAttribute('d').match(/v([\d.]+)/)?.[1]||6;
     fill.setAttribute('d',`M${R(tx)} ${y}h${R(tl*d.f)}v${h}h${R(-tl*d.f)}z`);
   }
   const t=d.wt.querySelector('.gi-dial-pct');
   if(t)t.textContent=pctText(d.f);
   const pp=+d.wt.dataset.giPts||0,tp=pp?d.wt.querySelector('.gi-dial-pts'):null;
   if(tp)tp.textContent=ptsText(d.f,pp);
   const handle=d.wt.querySelector('.gi-handle');
   handle?.setAttribute('aria-valuenow',String(pct));
  }
  function tick(now){
   raf=0;const d=drag;if(!d||dead)return;const dt=Math.min(64,now-(d.t||now));d.t=now;
   d.gv+=(d.target-d.gv)*(off()?1:1-Math.exp(-dt/120));
   const gh=d.app.querySelector('.gi-ghost'),inner=gh?.querySelector('.gi-ghost-in');
   if(gh&&inner){
     gh.setAttribute('data-gi-on','1');
     const base=+gh.dataset.giV,g=geometry(d.app),dx=g.bw*(d.gv-base)/(g.hi-g.lo);
     inner.style.transform=`translateX(${R(dx)}px)`;
     const lab=inner.querySelector('.gi-ghost-label');
     if(lab)lab.textContent=d.gv.toFixed(1);
   }
   const to=d.wt.querySelector('.gi-dial-to');if(to)to.textContent=d.gv.toFixed(1);
   // (the answer line is a page layout of its own: it is rewritten some eleven times a second, the knob and the pin every frame)
   if(d.kind==='slide'){
     pinSides(d.app,d.gv);
     if(d.sayDue&&d.ans&&now-(d.sayAt||-1e9)>=90){
       d.sayDue=false;
       d.sayAt=now;
       const line=api.sayIf?.(d.course,d.id,d.f);
       if(line&&d.ans.textContent!==line)d.ans.textContent=line;
     }
   }
   if(Math.abs(d.target-d.gv)>.01||d.sayDue)raf=win.requestAnimationFrame(tick);
  }
  function kick(){if(!raf&&drag)raf=win.requestAnimationFrame(tick);}
  // The module's pins keep their numbers on the sides away from each other (and inside the module) while the if pin moves.
  function pinSides(app,gv){
   if(app?.dataset?.giMod!=='1')return;const g=geometry(app),W=+app.dataset.giW||0,pz=app.querySelector('.gi-poise'),gh=app.querySelector('.gi-ghost');if(!pz||!gh||!(g.hi>g.lo))return;
   const X=v=>g.bx+g.bw*(v-g.lo)/(g.hi-g.lo),px=X(+pz.dataset.giV),gx=X(gv),fits=(x,s)=>s>0?x+7+34<=W-2:x-7-34>=2;
   let ns=gx>=px?-1:1,is=-ns;
   if(!fits(px,ns))ns=-ns;
   if(!fits(gx,is))is=-is;
   for(const [el,side]of [[pz,ns],[gh,is]]){
     if(+el.dataset.giSide===side)continue;
     el.dataset.giSide=String(side);
     const t=el.querySelector('text');
     if(t){t.setAttribute('x',String(side*7));t.setAttribute('text-anchor',side>0?'start':'end');}
   }
  }
  // A module row's slider: the knob follows the pointer (pressed on the track it jumps there first), the fill and the
  // knob's figure with it; the if pin glides after it and the answer line says the result as it goes.
  function setSlide(d){
   const s=d.slide,a=+s.dataset.giA,b=+s.dataset.giB,kx=a+(b-a)*d.f,knob=s.querySelector('.gi-knob2'),fill=s.querySelector('.gi-slide-fill'),t=s.querySelector('.gi-knob-t'),pct=Math.round(d.f*100);
   if(knob){knob.style.transform=`translateX(${R(kx)}px)`;if(!knob.classList.contains('gi-knob-on')){knob.classList.add('gi-knob-on');knob.classList.remove('gi-knob-rest','gi-knob-need');}}
   if(fill){fill.setAttribute('d',`M${R(a)} ${s.dataset.giTy}H${R(kx)}`);fill.removeAttribute('data-gi-off');}
   if(t){const label=pctText(d.f);t.textContent=label;t.setAttribute('font-size',String(knobSize(label)));}s.setAttribute('aria-valuenow',String(pct));
   // the points beside it follow too: Sun · 45.5/50 pts
   const pp=+s.dataset.giPts||0,meta=pp?s.closest('.gi-row')?.querySelector('.gi-row-meta'):null;if(meta){const day=s.dataset.giDay||'';meta.textContent=`${day?day+' · ':''}${ptsText(d.f,pp)} pts`;}
  }
  function downSlide(e,slide){
   const app=slide.closest('.gi-app'),svg=slide.closest('.gi-svg');if(!app||!svg)return;
   // (the pointer is held by the drawing itself: a group inside it lost the capture on the first move, and every move
   // was then hit-tested against the whole module)
   e.preventDefault();try{svg.setPointerCapture?.(e.pointerId);}catch{}
   const r=svg.getBoundingClientRect(),
     vb=svg.viewBox?.baseVal,
     scale=vb&&vb.width&&r.width?r.width/vb.width:1,
     a=+slide.dataset.giA,
     b=+slide.dataset.giB,
     at=x=>clamp(((x-r.left)/scale-a)/Math.max(1,b-a),0,1);
   const f0=slide.dataset.giF!==''?+slide.dataset.giF:(+slide.dataset.giRest||.5),
     onKnob=!!e.target.closest?.('.gi-knob2'),
     fp=at(e.clientX),
     course=app.dataset.giCourse,
     id=slide.dataset.giId;
   const mod=slide.closest('.gi-mod'),ans=mod?.querySelector('.gi-ans-t')||null;
   // the answer line keeps its height while it is rewritten under the moving knob
   const line=ans?.parentNode;if(line?.style&&line.offsetHeight)line.style.minHeight=line.offsetHeight+'px';
   drag={
     kind:'slide',
     wt:slide,
     slide,
     svg,
     app,
     course,
     id,
     f0,
     f:onKnob?f0:snapF(fp,+slide.dataset.giPts||0),
     offset:onKnob?f0-fp:0,
     at,
     moved:!onKnob,
     pointer:e.pointerId,
     held:[],
     gv:+(app.querySelector('.gi-ghost')?.dataset.giV||0),
     target:0,
     t:0,
     ans,
     line,
     sayDue:!onKnob
   };
   drag.target=api.preview(course,id,drag.f)??drag.gv;
   slide.classList.add('gi-held');setSlide(drag);api.setDrag(course,id,drag.f);kick();slide.focus?.({preventScroll:true});
  }
  function down(e){
   const slide=e.target.closest?.('.gi-slide');if(slide&&!(e.button>0)&&!drag&&container.contains(slide)){downSlide(e,slide);return;}
   const handle=e.target.closest?.('.gi-handle');if(!handle||e.button>0||drag)return;const wt=handle.closest('.gi-wt'),app=wt?.closest('.gi-app');if(!wt||!app||wt.dataset.giLive!=='1')return;
   e.preventDefault();try{handle.setPointerCapture?.(e.pointerId);}catch{}
   const course=app.dataset.giCourse,
     id=wt.dataset.giWeight,
     f0=wt.dataset.giF!==''?+wt.dataset.giF:.85,
     svg=wt.closest('.gi-svg'),
     [,tl]=String(wt.querySelector('.gi-dial')?.dataset.giTrack||'0,140').split(',').map(Number);
   const start=api.preview(course,id,f0);
   drag={
     wt,
     app,
     handle,
     course,
     id,
     f0,
     f:f0,
     x0:e.clientX,
     moved:false,
     pointer:e.pointerId,
     scale:scaleOf(svg),
     span:Math.max(80,tl),
     held:lift(wt),
     gv:+(app.querySelector('.gi-ghost')?.dataset.giV||start||0),
     target:start??0,
     t:0
   };
   api.setDrag(course,id,f0);setDial(drag);kick();handle.focus?.({preventScroll:true});
  }
  function move(e){const d=drag;if(!d||e.pointerId!==d.pointer)return;
   // (a held knob's moves are the slider's own: the page's hover and arrange work need none of them)
   if(d.kind==='slide'){
     e.stopPropagation();
     const f=snapF(clamp(d.at(e.clientX)+d.offset,0,1),+d.slide.dataset.giPts||0);
     if(f===d.f)return;
     d.f=f;
     d.moved=true;
     setSlide(d);
     api.setDrag(d.course,d.id,f);
     const v=api.preview(d.course,d.id,f);
     if(v!=null)d.target=v;
     d.sayDue=true;
     kick();
     return;
   }
   const dx=(e.clientX-d.x0)/d.scale;if(Math.abs(dx)>3)d.moved=true;if(!d.moved)return;
   d.f=snapF(clamp(d.f0+dx/d.span,0,1),+d.wt.dataset.giPts||0);
   setDial(d);
   api.setDrag(d.course,d.id,d.f);
   const v=api.preview(d.course,d.id,d.f);
   if(v!=null)d.target=v;
   kick();
  }
  function up(e,cancel=false){const d=drag;if(!d||e&&e.pointerId!==d.pointer)return;drag=null;if(raf){win.cancelAnimationFrame(raf);raf=0;}
   if(d.kind==='slide'){try{d.svg.releasePointerCapture?.(d.pointer);}catch{}d.slide.classList.remove('gi-held');api.setDrag(null);if(d.line?.style)d.line.style.minHeight='';
    const gh=d.app.querySelector('.gi-ghost');if(gh)values.set(gh,d.gv);
    // the knob settles where it was let go: a small press and release
    play(d.slide.querySelector('.gi-knob2 > path:nth-child(2)'),[{opacity:1},{opacity:.82,offset:.4},{opacity:1}],{duration:220});
    if(!cancel&&d.moved)api.setWhatIf(d.course,d.id,d.f);else api.touch();return;}
   try{d.handle.releasePointerCapture?.(d.pointer);}catch{}
   const keep=!cancel&&d.moved||d.wt.dataset.giF!=='';letGo(d.wt,d.held,keep);api.setDrag(null);
   const gh=d.app.querySelector('.gi-ghost');if(gh)values.set(gh,d.gv);
   if(!cancel&&d.moved)api.setWhatIf(d.course,d.id,d.f);else api.touch();}
  // Heard on the document (capture), so a key aimed at the page body (after a click on the room's paper or wall) still
  // reaches the room; the real target comes from the composed path. The Focus room open over the room owns its keys.
  function keydown(e){
   const t=e.composedPath?.()[0]||e.target;if(dead||host().dataset?.chRoom)return;
   if(t!==doc.body&&t!==doc.documentElement&&!container.contains(t))return;
   if(e.key==='Escape'&&drag){e.preventDefault();e.stopPropagation();up(null,true);return;}
   // The add row: Escape closes it (never the room under it), Enter in a field adds, the arrows move between categories.
   const form=t?.closest?.('[data-gi-add-form]');
   if(form){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();api.addCancel?.();return;}
    if(e.key==='Enter'&&t.matches?.('input[data-gi-draft]')){e.preventDefault();commitAdd(form);return;}
    if(t.matches?.('.gi-cat')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){
      e.preventDefault();
      const cats=[...form.querySelectorAll('.gi-cat')],i=cats.indexOf(t),n=e.key==='Home'?0:e.key==='End'?cats.length-1:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+cats.length)%cats.length;
      if(cats[n])api.addDraft?.('group',cats[n].dataset.giGroup);
      return;
    }
    return;
   }
   // A module row's slider: the arrows move it a point or so (Shift: a tenth), Home and End go to 0 and 100%, Delete
   // lets it go.
   const slide=t?.closest?.('.gi-slide');
   if(slide){
     const app=slide.closest('.gi-app');
     if(!app)return;
     const cur=slide.dataset.giF!==''?+slide.dataset.giF:(+slide.dataset.giRest||.5),pts=+slide.dataset.giPts||0,step=keyStep(pts,e.shiftKey);
     let f=null;
    if(['ArrowRight','ArrowUp'].includes(e.key))
      f=cur+step;
    else if(['ArrowLeft','ArrowDown'].includes(e.key))f=cur-step;else if(e.key==='Home')f=0;else if(e.key==='End')f=1;else if(e.key==='PageUp')f=cur+.1;else if(e.key==='PageDown')f=cur-.1;
    else if(['Delete','Backspace'].includes(e.key)){e.preventDefault();api.removeWhatIf(app.dataset.giCourse,slide.dataset.giId);return;}
    if(f!==null){e.preventDefault();api.setWhatIf(app.dataset.giCourse,slide.dataset.giId,keySnap(f,pts,e.shiftKey));}return;}
   if(e.key==='Escape'&&!e.defaultPrevented&&retreat()){e.preventDefault();e.stopPropagation();return;}
   if(e.key==='Escape'&&!e.defaultPrevented){
     const roomEl=container.querySelector(ROOM);
     if(roomEl&&(roomEl.contains(t)||t===doc.body||t===doc.documentElement||t===container)&&api.canNavigate()){
       e.preventDefault();
       e.stopPropagation();
       void fold(roomEl);
       return;
     }
   }
   const handle=t?.closest?.('.gi-handle');
   if(handle){
     const wt=handle.closest('.gi-wt'),app=wt?.closest('.gi-app');
     if(!wt||!app||wt.dataset.giLive!=='1')return;
     const cur=wt.dataset.giF!==''?+wt.dataset.giF:.85,pts=+wt.dataset.giPts||0,step=keyStep(pts,e.shiftKey);
     let f=null;
    if(['ArrowRight','ArrowUp'].includes(e.key))
      f=cur+step;
    else if(['ArrowLeft','ArrowDown'].includes(e.key))f=cur-step;else if(e.key==='Home')f=0;else if(e.key==='End')f=1;else if(e.key==='PageUp')f=cur+.1;else if(e.key==='PageDown')f=cur-.1;
    else if(['Delete','Backspace'].includes(e.key)){e.preventDefault();swing(wt,4);api.removeWhatIf(app.dataset.giCourse,wt.dataset.giWeight);return;}
    if(f!==null){e.preventDefault();swing(wt,3);api.setWhatIf(app.dataset.giCourse,wt.dataset.giWeight,keySnap(f,pts,e.shiftKey));}return;}
   if((e.key==='Enter'||e.key===' ')&&t?.matches?.('.gi-band,.gi-btn,.gi-x')){e.preventDefault();t.dispatchEvent(new win.MouseEvent('click',{bubbles:true,composed:true}));}
  }
  // Folding back: the room itself, with its drawing, starts folding into the module at once, on the compositor
  // (transform and opacity only). Home is drawn a frame later; the long render that swaps the page runs while the fold
  // keeps moving, and a sheet of the room's wall, folding in step under the room, takes its place the moment the render
  // removes it. When Home is in, the sheet is aimed at the module's real box if that moved, and melts into the module.
  const FOLD_MS=460,ROOM='.gi-room:not([data-gi-away])';
  const foldFrames=(at,to,from=null)=>
    [{transform:from?.transform||'none',opacity:from?.opacity??1,easing:SETTLE()},{transform:toward(to,at),opacity:1,offset:.74,easing:'linear'},{transform:toward(to,at),opacity:0}];
  async function fold(roomEl){if(pending)return;pending++;try{
   // A room that floats over its page (dashboard.js) folds by itself: the page is there under it from the first frame,
   // so the room shrinks into the module (or the course's strip) it grew from and fades as it lands, on the compositor
   // (transform and opacity only), and nothing is drawn again for it. Where it lands was read when it grew: the page
   // under it has not moved since.
   if(roomEl.closest?.('.rd-roomlayer')){
    const r=roomEl.getBoundingClientRect(),at={left:r.left,top:r.top,width:r.width,height:r.height},target=api.foldTarget?.()||lastFrom;
    if(!off()){takeOver(roomEl);for(const a of roomEl.getAnimations?.({subtree:true})||[]){try{a.commitStyles?.();}catch{}try{a.cancel();}catch{}}busyFor(FOLD_MS+500);}
    api.fold();if(off())return;
    if(still()||!(at.width>0&&at.height>0)||!target?.width){play(roomEl,[{opacity:1},{opacity:0}],{duration:200,easing:FADE(),fill:'forwards'});return;}
    roomEl.style?.setProperty?.('transform-origin','0 0');lastFrom={left:target.left,top:target.top,width:target.width,height:target.height};
    play(roomEl,foldFrames(at,lastFrom),{duration:FOLD_MS,easing:'linear',fill:'forwards'});
    // the module takes the landing with a small settle
    const home=api.foldHome?.(),o2='50% 100%';
    if(home?.animate)
      home.animate(
        [{transform:'none',transformOrigin:o2},{transform:'scaleY(1.015)',transformOrigin:o2,offset:.35},{transform:'scaleY(.995)',transformOrigin:o2,offset:.7},{transform:'none',transformOrigin:o2}],
        {duration:240,delay:FOLD_MS-90,easing:SETTLE()});
    return;
   }
   if(off()||still()){if(still())await done(play(roomEl,[{opacity:1},{opacity:0}],{fill:'forwards'}));api.fold();return;}
   const r=roomEl.getBoundingClientRect(),at={left:r.left,top:r.top,width:r.width,height:r.height};
   if(!(at.width>0&&at.height>0)||typeof win.requestAnimationFrame!=='function'||typeof doc.createElement!=='function'){api.fold();return;}
   takeOver(roomEl);for(const a of roomEl.getAnimations?.({subtree:true})||[]){try{a.commitStyles?.();}catch{}try{a.cancel();}catch{}}busyFor(FOLD_MS+500);
   roomEl.style?.setProperty?.('transform-origin','0 0');roomEl.style?.setProperty?.('pointer-events','none');
   let target=lastFrom?.width?lastFrom:{left:at.left+at.width*.36,top:Math.max(at.top,0)+300*.32,width:at.width*.28,height:Math.min(at.height,600)*.28};
   // The room folds into the module and stays there, whole, until Home is in (on a slow machine the swap can come well
   // after the fold has landed: a room that had faded out left an empty wall and a white sheet). The sheet under it shows
   // the moment the room is gone (the same commit), exactly where it had folded to, and melts into the module from there.
   const cover=makeSheet(at);cover.style.visibility='hidden';const o={duration:FOLD_MS,easing:'linear',fill:'forwards'},frames=foldFrames(at,target),last=frames[frames.length-1].transform;
   let anim=play(cover,frames,o),landed=false;const roomAnim=play(roomEl,frames.map((f,i)=>i===frames.length-1?{...f,opacity:1}:f),o);
   const gone=()=>{watch?.disconnect();cover.remove();};
   const melt=()=>{
     const a=play(cover,[{transform:last,opacity:1},{transform:last,opacity:0}],{duration:180,easing:FADE(),fill:'forwards'});
     if(a)a.finished.then(gone,gone);else gone();
   };
   const watch=win.MutationObserver&&roomEl.parentNode?new win.MutationObserver(()=>{
     if(!roomEl.isConnected){cover.style.visibility='';watch.disconnect();if(landed)melt();}
   }):null;
   watch?.observe(roomEl.parentNode,{childList:true});
   const land=()=>{landed=true;if(!roomEl.isConnected)gone();};if(anim)anim.finished.then(land,()=>{});else gone();
   // Home is drawn once the fold's first frame is on screen
   // (a frame that never comes, a hidden tab, does not hold the way back: a short timer stands in for it)
   const later=(fn,ms)=>(typeof win.setTimeout==='function'?win.setTimeout.bind(win):setTimeout)(fn,ms),frame=(gap=0)=>new Promise(res=>{
     let ok=false;
     const go=()=>{if(!ok){ok=true;res();}};
     win.requestAnimationFrame(()=>later(go,gap));
     later(go,gap+70);
   });
   await frame();
   if(dead)return;busyFor(700);api.fold();
   await frame();
   const home=api.foldHome?.(),t=home?.getBoundingClientRect?.();
   if(!t?.width){if(roomEl.isConnected){cover.remove();try{roomAnim?.cancel();}catch{}roomEl.style?.removeProperty?.('pointer-events');}return;}
   lastFrom={left:t.left,top:t.top,width:t.width,height:t.height};
   if(anim&&
     cover.isConnected&&
     anim.playState!=='finished'&&
     (Math.abs(t.left-target.left)>2||Math.abs(t.top-target.top)>2||Math.abs(t.width-target.width)>2||Math.abs(t.height-target.height)>2)){
    const spent=Number(anim.currentTime)||0,left=Math.max(140,FOLD_MS-spent);
    let from=null;
    try{anim.commitStyles();from={transform:cover.style.transform||'none',opacity:Number(cover.style.opacity||1)};}catch{}
    try{anim.cancel();}catch{}
    target=lastFrom;
    anim=play(cover,foldFrames(at,target,from),{duration:left,easing:'linear',fill:'forwards'});
    if(anim)anim.finished.then(land,()=>{});else gone();
   }
   // the module takes the landing with a small settle
   const o2='50% 100%',wait=Math.max(0,FOLD_MS-(Number(anim?.currentTime)||0));
   if(home.animate)
     home.animate(
       [{transform:'none',transformOrigin:o2},{transform:'scaleY(1.015)',transformOrigin:o2,offset:.35},{transform:'scaleY(.995)',transformOrigin:o2,offset:.7},{transform:'none',transformOrigin:o2}],
       {duration:240,delay:Math.max(0,wait-90),easing:SETTLE()});
  }finally{pending--;}}
  function click(e){
   if(dead)return;const t=e.target.closest?.('[data-gi-action],[data-gi-band]');if(!t||!container.contains(t))return;
   if(t.dataset.giBand){
     const app=t.closest('.gi-app');
     if(app){
       play(t,[{transform:'scaleY(1)'},{transform:'scaleY(.9)',offset:.3},{transform:'scaleY(1.04)',offset:.7},{transform:'none'}],{duration:320});
       api.setNeed(app.dataset.giCourse,+t.dataset.giBand);
     }
     return;
   }
   const name=t.dataset.giAction;
   // (these redraw the module or the room under the press, so the press goes no further: nothing else may read a
   // control the redraw has just turned into another)
   if(['add','add-cat','add-ok','add-cancel','unpretend'].includes(name)){e.preventDefault();e.stopPropagation();}
   if(name==='add'){api.addOpen?.(t.dataset.giCourse);return;}
   if(name==='add-cat'){api.addDraft?.('group',t.dataset.giGroup,'press');return;}
   if(name==='add-ok'){commitAdd(t.closest('[data-gi-add-form]'));return;}
   if(name==='add-cancel'){api.addCancel?.();return;}
   if(name==='unpretend'){removeRow(t);return;}
   // (a course's row in the Grades table is a way in of its own: the room grows out of the row and folds back into it)
   if(name==='open'){if(!api.canNavigate())return;e.preventDefault();e.stopPropagation();const box=t.closest('.rd-widget,.gi-strip,.gi-mod,.rd-grade-table tr')||t,rect=box.getBoundingClientRect();
    // the box dips (on the compositor) and the room opens a frame later: the page swap is a long render, and the move
    // starts with its anticipation instead of a still frame
    const from={left:rect.left,top:rect.top,width:rect.width,height:rect.height},
      origin=t.closest('.gi-strip')?'strip':t.closest('.rd-grade-table tr')?'row':'module',
      go=()=>api.open(t.dataset.giOpen,from,origin);
    if(off()||still()||typeof win.requestAnimationFrame!=='function'||typeof doc.createElement!=='function'||sheet){go();return;}
    // a 70 ms dip of the module, and a sheet of the room's wall grows out of it over Home (Home stays painted under it)
    const dip=play(box,[{transform:'none'},{transform:'scale(.978)'}],{duration:70,easing:PEN(),fill:'forwards'});
    const dipTimer=win.setTimeout(()=>{if(box.isConnected)try{dip?.cancel();}catch{}},900);grow(from,t.dataset.giOpen,origin,dip,box,dipTimer);return;}
   if(name==='fold'){const roomEl=t.closest('.gi-room');if(!roomEl||!api.canNavigate())return;e.preventDefault();e.stopPropagation();void fold(roomEl);return;}
   if(name==='clear'){
    // The what-if part is torn off the slip and flicked away (the whole slip when it was all there was), the ghost
    // fades, every clay weight swings as it turns back to iron; then the course forgets its what-ifs.
    const scope=t.closest('.gi-svg')||t.closest('.gi-mod')||t.closest('.gi-strip')||container,out=[],course=t.dataset.giCourse;
    for(const s of all(scope,'[data-gi-slip]:not([data-gi-note])')){const only=all(s,'[data-gi-part]').length<2,el=only?s:s.querySelector('[data-gi-part="if"]');if(!el)continue;
     out.push(tear(el));if(only)slips.delete(s.dataset.giSlip);}
    for(const g of all(scope,'.gi-ghost[data-gi-on="1"] .gi-ghost-in'))out.push(play(g,[{opacity:1},{opacity:0,transform:'translateY(-6px)'}],{duration:260,fill:'forwards',easing:'ease-in'}));
    for(const wt of all(scope,'.gi-wt-if'))swing(wt,5);
    for(const pill of all(scope,'.gi-pill'))
      out.push(play(pill,[{transform:'none',opacity:1},{transform:'scale(.92)',opacity:1,offset:.3},{transform:'scale(.6)',opacity:0}],{duration:240,fill:'forwards'}));
    // where the key goes once the course has forgotten them: the room's first weight, the strip's name, the module's first weight
    const mod='.rd-widget[data-widget="impact"]',back=t.closest('.gi-room')?'.gi-room .gi-handle||.gi-room [data-gi-action="fold"]':t.closest('.gi-strip')?`[data-gi-open="${course}"]`:`${mod} .gi-slide||${mod} .gi-handle||${mod} .gi-pg[data-gi-step="1"]||${mod} [data-gi-open]`;
    // the eraser rubs once
    out.push(play(
      t.querySelector?.('.gi-ico'),
      [{transform:'none'},{transform:'translate(-2px,1px) rotate(-8deg)',offset:.3},{transform:'translate(2px,-1px) rotate(6deg)',offset:.65},{transform:'none'}],
      {duration:260}));
    Promise.all(out.map(done)).then(()=>{stale.push(...out);api.clear(course,back);});return;}
   if(name==='page'){const mod=t.closest('.gi-mod'),step=+t.dataset.giStep||1;if(mod)leaving=leavingPage(mod,step>0?1:-1);busyFor(600);api.page(step);}
  }
  // Add: what the fields hold now (a value typed a moment ago included) is the draft, then it is added.
  function commitAdd(form){
    if(!form)return;
    for(const i of form.querySelectorAll?.('input[data-gi-draft]')||[])api.addDraft?.(i.dataset.giDraft,i.value);
    api.addConfirm?.(form.dataset.giAddForm);
  }
  // A pretend assignment's ×: its row slides off (a weight is reeled up to its hook), then it is gone.
  function removeRow(t){
   const course=t.dataset.giCourse,pid=t.dataset.giPid,row=t.closest('.gi-row'),wt=t.closest('.gi-wt');
   const a=row?
     play(row,[{opacity:1,transform:'none'},{opacity:0,transform:'translateX(14px)'}],{duration:200,easing:LETGO(),fill:'forwards'}):
     wt?play(wt.querySelector('.gi-drop'),[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-30px)'}],{duration:260,easing:LETGO(),fill:'forwards'}):null;
   done(a).then(()=>{if(a)stale.push(a);api.removePretend?.(course,pid);});
  }
  function input(e){const t=e.composedPath?.()[0]||e.target;if(dead||!t?.matches?.('input[data-gi-draft]')||!container.contains(t))return;api.addDraft?.(t.dataset.giDraft,t.value);}
  function visibility(){
    const hide=doc.visibilityState==='hidden';
    for(const el of watched){if(!el.isConnected)continue;const v=hide||outside.get(el)===true;if(el.hasAttribute('data-gi-paused')!==v)el.toggleAttribute('data-gi-paused',v);}
    scheduleHour();
  }
  function watch(el){
   if(!io&&win.IntersectionObserver)
     io=new win.IntersectionObserver(entries=>{
       let changed=false;
       for(const en of entries){const out=!en.isIntersecting;if(outside.get(en.target)!==out){outside.set(en.target,out);changed=true;}}
       if(changed)visibility();
     });
   // an element the dashboard has replaced is no longer watched (each render used to add one more to both observers)
   for(const old of [...watched])if(!old.isConnected){io?.unobserve?.(old);ro?.unobserve?.(old);watched.delete(old);}
   watched.add(el);io?.observe(el);if(!ro&&win.ResizeObserver)ro=new win.ResizeObserver(entries=>measure(entries));ro?.observe(el);}
  // Sizes come from the ResizeObserver's own entries (their border boxes): reading boxes in its callback forced a layout
  // of the whole page whenever another observer had just written styles (a page turn in the module laid out 3,346
  // objects for it). The room's top is read once, and again only when the window changes size.
  let roomTop=null;
  function measure(entries=null){
   const roomEl=container.querySelector(ROOM);
   if(entries){
    const sizes=[];
    for(const en of entries){
      const el=en.target,w=Math.round(en.borderBoxSize?.[0]?.inlineSize??en.contentRect?.width??0);
      if(w>0&&el.isConnected!==false)sizes.push([el,w]);
    }
    for(const [el,w] of sizes){
     if(el===roomEl){if(roomTop===null)roomTop=Math.max(0,roomEl.getBoundingClientRect().top);api.measure('room',w,Math.round(clamp((win.innerHeight||900)-roomTop-12,780,1100)));}
     else if(el.classList?.contains('gi-mod'))api.measure('module',w,0,el.dataset.giSize);}
    return;
   }
   // every box is read first and reported after: a report can redraw, and a box read after a redraw forced a layout
   const r=roomEl?.getBoundingClientRect(),mods=all(container,'.gi-mod').map(m=>[m.getBoundingClientRect().width,m.dataset.giSize]);
   if(r)roomTop=Math.max(0,r.top);
   if(r&&r.width>0){const h=Math.round(clamp((win.innerHeight||900)-Math.max(0,r.top)-12,780,1100));api.measure('room',Math.round(r.width),h);}
   for(const [w,size] of mods)if(w>0)api.measure('module',Math.round(w),0,size);
  }
  function sync(){
   if(dead)return;
   // Animations held at their last frame until the render that removes their element (a torn-off slip) let go now.
   for(const a of stale.splice(0))try{a?.cancel();}catch{}
   const roomEl=container.querySelector(ROOM),mods=all(container,'.gi-mod'),events=api.takeEvents();
   for(const el of [roomEl,...mods])if(el&&!seen.has(el)){seen.add(el);watch(el);}
   // Sizes are read by the ResizeObserver, after the browser has laid the page out; reading them here, straight after
   // every render, forced a whole extra layout into the first frame of each move.
   visibility();if(!ro)measure();
   const open=events.find(e=>e.type==='open'),arrive=events.find(e=>e.type==='arrive'),paged=events.find(e=>e.type==='page');
   if(roomEl&&!arrived.has(roomEl)){arrived.add(roomEl);roomTop=null;roomArrive(roomEl);}
   else if(roomEl){const svg=roomEl.querySelector('.gi-svg'),app=roomEl.querySelector('.gi-app'),prev=lastApp.get(roomEl),st=memo.get(roomEl)||{};
    // Show / Hide grades: the clay poise is carried between the bar and its resting place on the bench, even when the
    // grades took a moment to load in between, and every weight is re-hung with its tag turned to the new face; on
    // Hide the old figures, ghost, thread and slip are put away. Another course or a first arrival deals it all in.
    if(app&&prev!==app.dataset.giApp){
      lastApp.set(roomEl,app.dataset.giApp);
      const nowHidden=app.dataset.giHidden==='1',
        state=app.dataset.giApp.split('-').pop(),
        same=!!prev&&prev.split('-')[0]===app.dataset.giCourse,
        wasLoading=!!prev&&prev.endsWith('-loading');
     if(nowHidden){if(same&&!hiddenRoom.get(roomEl)){poiseCarry(app,true);rehang(app,120);putAway(svg,st);}else if(!same)appArrive(app,0);hiddenRoom.set(roomEl,true);}
     else if(state==='ready'){
       if(same&&hiddenRoom.get(roomEl)){
         poiseCarry(app,false);
         if(wasLoading)all(app,'.gi-wt').forEach((wt,i)=>dropIn(wt,i,200));else rehang(app,120);
         play(app.querySelector('.gi-ghost[data-gi-on="1"] .gi-ghost-in'),[{opacity:0},{opacity:0,offset:.5},{opacity:1}],{duration:900,delay:200});
       }
       else appArrive(app,0);
       hiddenRoom.set(roomEl,false);
     }}
    benchThings(svg,0);relight(roomEl,svg,st);}
   if(roomEl)remember(roomEl);
   if(paged)pageDir=paged.dir;
   for(const m of mods){
     const app=m.querySelector('.gi-app'),prev=lastApp.get(m);
     if(!arrived.has(m)){arrived.add(m);if(arrive&&!api.foldHome)moduleArrive(m,0);if(app)lastApp.set(m,app.dataset.giApp);continue;}
    // a page turned before its course's figures are in arrives once they are, from the side it was turned to
    if(app&&prev!==app.dataset.giApp){lastApp.set(m,app.dataset.giApp);moduleArrive(m,pageDir);pageDir=0;}}
   for(const ev of events)
     if(ev.type==='need'){
       const svg=(roomEl||mods[0])?.querySelector?.('.gi-svg');
       const th=svg?.querySelector('.gi-thread');
       play(th,[{strokeDashoffset:1,strokeDasharray:'1 1'},{strokeDashoffset:0,strokeDasharray:'1 1'}],{duration:520,delay:80,easing:SETTLE()});
       const wt=svg?.querySelector('.gi-wt');
       if(wt){swing(wt,5,420);play(wt.querySelector('.gi-need-line'),[{opacity:0},{opacity:0,offset:.5},{opacity:1}],{duration:600});}
       const box=(mods[0]||roomEl)?.querySelector('.gi-box');
       play(box,[{transform:'translateY(8px)',opacity:0},{transform:'translateY(-2px)',opacity:1,offset:.7},{transform:'none'}],{duration:380});
     }
   moduleLife(mods,events,roomEl);
   if(roomEl){
     const rev=roomEl.dataset.giRevision||'';
     if(revision!==null&&rev!==revision){
       play(
         roomEl.querySelector('.gi-ledger-turn'),
         [{transform:'scaleX(1)',opacity:1},{transform:'scaleX(-1) skewY(-4deg)',opacity:1,offset:.7},{transform:'scaleX(-1)',opacity:0}],
         {duration:820,fill:'none',easing:PEN()});
     }
     revision=rev;
   }
   for(const app of all(container,'.gi-app'))settle(app);
   const focus=api.takeFocus();
   if(focus){
     const el=focus.split('||').map(sel=>{try{return container.querySelector(sel);}catch{return null;}}).find(Boolean);
     if(el){el.focus?.({preventScroll:false});if(el.matches?.('input'))try{el.select();}catch{}}
   }
  }
  // The answer-first module's own small moves, after each render: a pretend assignment just added is written in (a row
  // drops into place; in the room its weight is lowered onto its hook), the add row opens down from where Add was, a
  // refused Add shakes once, a new answer line comes up in place, and a knob that a key or Clear moved slides there.
  const answers=new WeakMap(),forms=new WeakSet(),knobs=new Map();
  function moduleLife(mods,events,roomEl){
   for(const ev of events){
    if(ev.type==='pretend-add'){
      const id=String(ev.id).replace(/[^a-z0-9-]/g,'');
      const row=container.querySelector(`.gi-mod [data-gi-row="${id}"]`);
      if(row)play(row,[{opacity:0,transform:'translateY(-8px)'},{opacity:1,transform:'translateY(1.5px)',offset:.7},{opacity:1,transform:'none'}],{duration:380});
     const wt=roomEl?.querySelector(`[data-gi-weight="${id}"]`);if(wt)dropIn(wt,0,80);}
    if(ev.type==='add-refused')
      play(
        container.querySelector('[data-gi-add-form]'),
        [{transform:'none'},{transform:'translateX(-4px)',offset:.25},{transform:'translateX(3px)',offset:.5},{transform:'translateX(-1.5px)',offset:.75},{transform:'none'}],
        {duration:320});
   }
   for(const f of all(container,'[data-gi-add-form]'))if(!forms.has(f)){forms.add(f);play(f,[{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'none'}],{duration:260});}
   for(const m of mods){
     const a=m.querySelector('.gi-ans-t');
     if(!a)continue;
     const text=a.textContent,was=answers.get(a);
     answers.set(a,text);
     if(was!=null&&was!==text&&!drag)play(a,[{opacity:.2,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:260,easing:FADE()});
   }
   const live=new Set();
   for(const sl of all(container,'.gi-slide')){
     const app=sl.closest('.gi-app'),
       key=(app?.dataset.giCourse||'')+':'+sl.dataset.giId,
       a=+sl.dataset.giA,
       b=+sl.dataset.giB,
       f=sl.dataset.giF!==''?+sl.dataset.giF:+sl.dataset.giRest,
       x=a+(b-a)*f;
     live.add(key);
    const was=knobs.get(key);knobs.set(key,x);if(was==null||Math.abs(was-x)<.5||drag?.slide===sl||!Number.isFinite(x))continue;
    play(sl.querySelector('.gi-knob2'),[{transform:`translateX(${R(was)}px)`},{transform:`translateX(${R(x)}px)`}],{duration:Math.round(clamp(200+Math.abs(x-was)*1.2,240,520)),easing:SETTLE()});}
   for(const key of [...knobs.keys()])if(!live.has(key))knobs.delete(key);
  }
  // When Canvas sends a new grade, or a what-if is set from the keyboard, the poise (or its ghost) slides from where it
  // was: a small step back, the slide, a 2 px overshoot and rest, while its figure counts the way there.
  // one count per figure: a new one takes over from the one under way
  const counting=new WeakMap();
  function count(el,from,to,dur,delay=0){
    if(!el||off()||!Number.isFinite(from)||!Number.isFinite(to))return;
    const final=el.textContent,t0=(win.performance?.now?.()||Date.now())+delay,token={};
    counting.set(el,token);
   const step=now=>{
     if(dead||!el.isConnected||counting.get(el)!==token)return;
     const k=clamp((now-t0)/dur,0,1);
     if(k>0)el.textContent=(from+(to-from)*(1-Math.pow(1-k,3))).toFixed(1);
     if(k<1)win.requestAnimationFrame(step);else el.textContent=final;
   };
   win.requestAnimationFrame(step);
  }
  function slideFrom(el,inner,from,to,label){
   const app=el.closest('.gi-app');if(!app||!inner)return;const g=geometry(app),unit=g.bw/(g.hi-g.lo);
   // A slide still under way (a second what-if a moment after the first) hands over where the poise is now: no jump
   // back to its last resting place, no second step back, the figure counts on from what it shows.
   let carry=0,moving=false;
   for(const a of inner.getAnimations?.()||[])
     if(a.id==='gi-slide'&&a.playState==='running'){moving=true;try{carry=new win.DOMMatrixReadOnly(win.getComputedStyle(inner).transform).e||0;}catch{}a.cancel();}
   const dx=unit*(from-to)+carry;if(!Number.isFinite(dx)||Math.abs(dx)<.5)return;const back=moving?0:Math.sign(dx)*Math.min(6,Math.abs(dx)*.08);
   const a=play(
     inner,
     [
       {transform:`translateX(${R(dx)}px)`},
       {transform:`translateX(${R(dx+back)}px)`,offset:.14},
       {transform:`translateX(${R(-Math.sign(dx)*2)}px)`,offset:.8},
       {transform:`translateX(${R(Math.sign(dx)*.6)}px)`,offset:.9},
       {transform:'translateX(0)'}
     ],
     {duration:Math.round(clamp(420+Math.abs(dx)*1.6,480,1100)),easing:PEN()});
   if(a)a.id='gi-slide';
   count(label,moving?to+dx/unit:from,to,600,moving?0:90);}
  function settle(app){
   for(const wt of all(app,'.gi-wt[data-gi-weight]')){const clay=wt.classList.contains('gi-wt-if'),was=clays.get(wt);clays.set(wt,clay);
    if(was===false&&clay)
      play(wt.querySelector('.gi-handle'),[{transform:'scale(1,1)'},{transform:'scale(1.06,.9)',offset:.25},{transform:'scale(.97,1.04)',offset:.6},{transform:'none'}],{duration:420,easing:'ease-out'});}
   // (the ghost a drag moved by hand stands at its new place now: the drag's own offset on it is let go, or it would be
   // added to the new place)
   if(!drag)app.querySelector('.gi-ghost .gi-ghost-in')?.style?.removeProperty?.('transform');
   for(const sel of ['.gi-poise:not(.gi-poise-rest)','.gi-ghost']){
     const el=app.querySelector(sel);
     if(!el)continue;
     const v=+el.dataset.giV,on=sel==='.gi-poise:not(.gi-poise-rest)'||el.dataset.giOn==='1',prev=values.get(el);
     values.set(el,on?v:null);
    if(prev==null||!on||!Number.isFinite(v)||Math.abs(prev-v)<.05)continue;
    slideFrom(el,el.querySelector(sel==='.gi-ghost'?'.gi-ghost-in':'.gi-poise-in'),prev,v,el.querySelector(sel==='.gi-ghost'?'.gi-ghost-label':'.gi-poise-in > text.gi-t'));}
  }
  function poiseCarry(app,toBench){
   const pz=app.closest('.gi-svg')?.querySelector(toBench?'.gi-poise-rest .gi-poise-in':'.gi-poise:not(.gi-poise-rest) .gi-poise-in');if(!pz)return;
   const g=pz.closest('.gi-poise'),
     bt=+app.dataset.giBt,
     by=+app.dataset.giBy,
     rest=+app.dataset.giRest,
     {lo,hi,bx,bw}=geometry(app),
     v=+(g.dataset.giV||lo),
     x=bx+bw*(v-lo)/(hi-lo);
   const dx=toBench?x-rest:rest-x,dy=toBench?by-(bt+5):(bt+5)-by;
   play(
     pz,
     [
       {transform:`translate(${dx}px,${dy}px)`},
       {transform:`translate(${dx}px,${dy+4}px)`,offset:.12},
       {transform:`translate(${dx*.5}px,${Math.min(dy,0)-80}px)`,offset:.5},
       {transform:'translate(0,-5px)',offset:.8},
       {transform:'translate(0,1.5px)',offset:.9},
       {transform:'none'}
     ],
     {duration:980,easing:PEN()});
   if(!toBench)figures(app,500);
  }
  // Show / Hide grades re-hangs every weight, one lane after another: a 3 px dip, a lift with the cord gone slack, the
  // drop with a small overshoot and a swing to rest; meanwhile its tag turns over on its string to the new face.
  function rehang(app,base=0){all(app,'.gi-wt[data-gi-weight]').forEach((wt,i)=>{const d=base+i*60;
   play(
     wt.querySelector('.gi-lift'),
     [
       {transform:'none'},
       {transform:'translateY(3px)',offset:.16},
       {transform:'translateY(-8px)',offset:.46},
       {transform:'translateY(3px)',offset:.74},
       {transform:'translateY(-1px)',offset:.88},
       {transform:'none'}
     ],
     {duration:760,delay:d});
   const c=wt.querySelector('.gi-cord'),a=c?.dataset?.taut,b=c?.dataset?.slack;
   if(a&&b)play(c,[{d:`path('${a}')`},{d:`path('${a}')`,offset:.2},{d:`path('${b}')`,offset:.46},{d:`path('${a}')`,offset:.7},{d:`path('${a}')`}],{duration:760,delay:d});
   swing(wt,4,d+560);
   play(
     wt.querySelector('.gi-tagg'),
     [{transform:'scaleX(.04) skewY(7deg)'},{transform:'scaleX(1.07) skewY(-1deg)',offset:.68},{transform:'scaleX(.99)',offset:.86},{transform:'none'}],
     {duration:300,delay:d+300,easing:'ease-out'});});}
  // Hiding grades: the figures, the ghost, the thread and the slips of the bar that just left are hung back for a moment
  // and put away (the slips torn off as Clear does, the figures fading down 4 px), then removed.
  function putAway(svg,st){
   if(off()||!svg||typeof doc.createElementNS!=='function')return;
   const olds=[st.figs,st.ghost,st.thread,...(st.slips||[])].filter(el=>el&&el.isConnected===false);if(!olds.length)return;
   const g=doc.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','gi-out');g.setAttribute('aria-hidden','true');svg.appendChild(g);const out=[];
   for(const el of olds){g.appendChild(el);for(const f of el.querySelectorAll?.('[tabindex]')||[])f.setAttribute('tabindex','-1');
    if(el.matches?.('[data-gi-slip]'))out.push(tear(el,0));
    else if(el.classList?.contains('gi-figs'))out.push(play(el,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(4px)'}],{duration:280,fill:'forwards',easing:'ease-in'}));
    else out.push(play(el,[{opacity:1},{opacity:0}],{duration:260,fill:'forwards'}));}
   Promise.all(out.map(done)).then(()=>g.remove());}
  // What the next render is compared with: the size, the sun, day or night, the hour's light layers, and the bar's
  // figures, ghost, thread and slips (so Hide can put them away).
  function remember(roomEl){const svg=roomEl.querySelector('.gi-svg'),app=svg?.querySelector?.('.gi-app');
   memo.set(roomEl,{vb:svg?.getAttribute?.('viewBox')||'',sun:sunXY(svg,'giSun'),night:svg?.dataset?.giNight||'0',shaft:svg?.querySelector?.('.gi-l-shaft'),land:svg?.querySelector?.('.gi-l-land'),
    figs:app?.querySelector?.('.gi-figs'),ghost:app?.querySelector?.('.gi-ghost[data-gi-on="1"]'),thread:app?.querySelector?.('.gi-threadg'),slips:all(svg,'[data-gi-slip]:not(.gi-out *)')});}
  // The hour turned (or day became night) while the room was open: the sun slides to its new place, the old light
  // cross-fades into the new, and at nightfall the dusk comes down over 1.2 s and the lamp clicks on.
  function relight(roomEl,svg,st){
   if(!svg||!st?.vb||st.vb!==svg.getAttribute?.('viewBox'))return;
   const to=sunXY(svg,'giSun');if(st.sun&&to)sunTravel(svg,st.sun,to,1600,0);
   for(const [old,sel]of [[st.shaft,'.gi-l-shaft'],[st.land,'.gi-l-land']]){
     const now=svg.querySelector(sel);
     if(!old||!now||old===now||old.isConnected!==false||off()||!now.parentNode)continue;
    now.parentNode.insertBefore(old,now);
    const a=play(old,[{opacity:1},{opacity:0}],{duration:1200,fill:'forwards',easing:'ease-in-out'});
    play(now,[{opacity:0},{opacity:1}],{duration:1200,easing:'ease-in-out'});
    done(a).then(()=>old.remove());
   }
   const night=svg.dataset?.giNight||'0';if(st.night==='0'&&night==='1'){play(svg.querySelector('.gi-l-dusk'),[{opacity:0},{opacity:1}],{duration:1200,easing:'ease-in-out'});lampOn(roomEl,300);}}
  // While the room is shown, one timeout waits for the next half hour (half-hour time zones included) and asks for a
  // render, so the sun and the light follow the clock; it stops while the room is hidden, off screen or gone.
  function scheduleHour(){
   const roomEl=container.querySelector(ROOM),on=!dead&&!!roomEl&&!roomEl.hasAttribute?.('data-gi-paused')&&typeof win.setTimeout==='function';
   if(!on){if(hourTimer){win.clearTimeout?.(hourTimer);hourTimer=0;}return;}
   const now=Date.now();if(hourDue&&now>=hourDue&&!hourTimer){hourDue=0;api.touch();return;}
   if(hourTimer)return;const step=18e5;if(!hourDue)hourDue=Math.floor(now/step)*step+step+1000;
   hourTimer=win.setTimeout(()=>{hourTimer=0;hourDue=0;if(!dead)api.touch();},Math.max(1000,hourDue-now));}
  container.addEventListener('pointerdown',down,true);
  container.addEventListener('pointermove',move,true);
  container.addEventListener('pointerup',up,true);
  container.addEventListener('pointercancel',e=>up(e,true),true);
  container.addEventListener('click',click,true);container.addEventListener('input',input,true);doc.addEventListener('keydown',keydown,true);doc.addEventListener('visibilitychange',visibility);
  // A taller or shorter window changes the room's height without changing its box: read it once the frame is laid out.
  let resizeFrame=0;
  const resized=()=>{
    roomTop=null;
    if(resizeFrame||dead)return;
    resizeFrame=win.requestAnimationFrame?.(()=>win.setTimeout(()=>{resizeFrame=0;if(!dead)measure();},0))||0;
  };
  win.addEventListener?.('resize',resized);
  return {sync,destroy(){
    dead=true;
    drag=null;
    if(sheet)drop(sheet);
    container.querySelector?.(':scope > .gi-flylayer')?.remove?.();
    if(raf)win.cancelAnimationFrame?.(raf);
    if(hourTimer){win.clearTimeout?.(hourTimer);hourTimer=0;}
    io?.disconnect();
    ro?.disconnect();
    container.removeEventListener('pointerdown',down,true);
    container.removeEventListener('pointermove',move,true);
    container.removeEventListener('pointerup',up,true);
    container.removeEventListener('click',click,true);
    container.removeEventListener('input',input,true);
    doc.removeEventListener('keydown',keydown,true);
    doc.removeEventListener('visibilitychange',visibility);
    win.removeEventListener?.('resize',resized);
  },get dragging(){return !!drag;}};
 }

 const api={layout,room,module:moduleArt,strip:stripArt,icon,mini,flyEdge,chip,stage,pen};
 root.ReserveGradeImpactArt=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
