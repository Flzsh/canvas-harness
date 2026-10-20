/* Shared focus-room scenes. Built-ins render directly in the workspace as well as in the media frame, so
   extension-frame loading never leaves the room without its backdrop. No network or storage access.
   Painted scenes adapt the seeded layouts, regional brushwork, and cached-paper methods of
   alchaincyf/huashu-art-motion (MIT); see licenses/huashu-art-motion.txt. Compositions are original.
   Each scene also follows the session, slowly and without numbers (huashu's idea of a painting that tells a story):
   over a focus round the moon crosses the sky, the boat crosses the ink lake, the lilies open, the rain eases and the
   sun sets; a break shows the scene arrived, a little warmer. Going from focus to a break, or back, an ink wash
   blooms across the scene. Reduced motion keeps the arrival but drops the wash. */
(function(root){'use strict';
 function create(canvas){
  const document=canvas.ownerDocument,win=document.defaultView,window=win;
  const requestAnimationFrame=fn=>win.requestAnimationFrame(fn),cancelAnimationFrame=id=>win.cancelAnimationFrame(id);
 let g=canvas.getContext('2d');
 const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 let scene='plain',theme='light',still=false,raf=0,last=0,time=0,W=0,H=0,ratio=1,parts=null,base=null,seed=1,dead=false;
 // The session: how far the focus round has come (0-1), whether it is a break, whether it runs. Unknown until told.
 let sess=null,washAt=-1;
 // Where the story stands: null before a session starts (scenes keep their resting look); a break is the arrival.
 const arc=()=>!sess||!sess.running&&!sess.progress?null:sess.brk?1:Math.max(0,Math.min(1,sess.progress));
 const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
 const rnd=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+seed/4294967296*(b-a);};
 const quiet=()=>still||!!motion?.matches;
 function size(){
  W=Math.max(1,win.innerWidth);H=Math.max(1,win.innerHeight);
  ratio=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(2500000/(W*H)));
  canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);g.setTransform(ratio,0,0,ratio,0,0);parts=null;base=null;
 }
 function make(){
  // Every moving piece is placed once per size and scene, as fractions of the frame.
  const n=k=>Array.from({length:k});
  seed=[...scene].reduce((s,c)=>Math.imul(s,31)+c.charCodeAt(0),41)>>>0;
  return {
   bokeh:n(26).map(()=>({x:rnd(0,1),y:rnd(.3,1),r:rnd(18,70),c:['246,193,119','232,168,124','156,207,216','235,188,186'][Math.floor(rnd(0,4))],a:rnd(.06,.2),d:rnd(0,6.28)})),
   rain:n(150).map(()=>({x:rnd(0,1),y:rnd(0,1),l:rnd(10,26),v:rnd(.55,1),a:rnd(.12,.32)})),
   drops:n(46).map(()=>({x:rnd(0,1),y:rnd(0,1),r:rnd(1.4,3.8),v:rnd(0,1)<.25?rnd(.004,.02):0})),
   stars:n(230).map(()=>({x:rnd(0,1),y:rnd(0,.72),r:rnd(.4,1.5),p:rnd(0,6.28),s:rnd(.6,2)})),
   clouds:n(4).map((_,i)=>({x:rnd(0,1),y:rnd(.12,.42),w:rnd(.18,.34),v:rnd(.004,.01)*(i%2?1:.7)})),
   motes:n(60).map(()=>({x:rnd(.08,.6),y:rnd(.1,.8),r:rnd(.6,1.8),p:rnd(0,6.28),v:rnd(.004,.012)})),
   glints:n(40).map(()=>({x:rnd(-.08,.08),y:rnd(0,1),p:rnd(0,6.28)})),
   pads:n(32).map((_,i)=>({x:rnd(0,1),y:rnd(.48,.98),r:rnd(.012,.038),p:rnd(0,6.28),flower:i%4===0})),
   marks:n(1600).map(()=>({x:rnd(0,1),y:rnd(0,1),l:rnd(3,12),p:rnd(0,6.28),c:Math.floor(rnd(0,6))}))
  };
 }
 const hill=(base,amp,phase,t=0)=>x=>H*base+Math.sin(x/W*6.2+phase+t)*amp+Math.sin(x/W*13.1+phase*2)*amp*.35;
 function ridge(f,color){g.beginPath();g.moveTo(0,H);for(let x=0;x<=W+8;x+=8)g.lineTo(x,f(x));g.lineTo(W,H);g.closePath();g.fillStyle=color;g.fill();}
 function linear(stops,y0=0,y1=H){const gr=g.createLinearGradient(0,y0,0,y1);stops.forEach((c,i)=>gr.addColorStop(i/(stops.length-1),c));return gr;}
 function glow(x,y,r,color,alpha){const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(${color},${alpha})`);gr.addColorStop(1,`rgba(${color},0)`);g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
 // Static brushwork and paper are painted once; only the small living details run each frame.
 function ground(paint){
  if(!base){
   base=document.createElement('canvas');base.width=canvas.width;base.height=canvas.height;
   const screen=g;g=base.getContext('2d');g.setTransform(ratio,0,0,ratio,0,0);
   try{paint();}finally{g=screen;}
  }
  g.drawImage(base,0,0,W,H);
 }
 function dab(x,y,length,angle,color,width=2){
  g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(angle)*length,y+Math.sin(angle)*length);g.stroke();
 }
 function mountain(x,y,width,height,color){
  const wash=g.createLinearGradient(0,y-height,0,y+height*.35);wash.addColorStop(0,color);wash.addColorStop(1,'rgba(94,119,118,0)');g.fillStyle=wash;
  g.beginPath();g.moveTo(x-width*.65,y+height*.35);
  g.bezierCurveTo(x-width*.35,y-height*.4,x-width*.22,y-height*.2,x,y-height);
  g.bezierCurveTo(x+width*.13,y-height*.65,x+width*.3,y-height*.4,x+width*.65,y+height*.35);g.closePath();g.fill();
 }
 const DRAW={
  rain(t){
   g.fillStyle=linear(['#1b2430','#283341','#39404c']);g.fillRect(0,0,W,H);
   for(const b of parts.bokeh){const x=b.x*W+Math.sin(t*.05+b.d)*6;glow(x,b.y*H,b.r,b.c,b.a);}
   g.strokeStyle='rgba(200,215,230,1)';g.lineCap='round';
   const pour=arc()==null?1:sess.brk?.18:1-.55*ease(arc());
   for(const d of parts.rain){const y=((d.y+t*d.v*.9)%1.1-.05)*H,x=(d.x*W+y*.12)%W;g.globalAlpha=d.a*pour;g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+d.l*.12,y+d.l);g.stroke();}
   g.globalAlpha=1;
   for(const d of parts.drops){const y=((d.y+t*d.v)%1)*H,x=d.x*W;g.fillStyle='rgba(210,225,240,.22)';g.beginPath();g.arc(x,y,d.r,0,6.29);g.fill();g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.arc(x-d.r*.35,y-d.r*.35,d.r*.32,0,6.29);g.fill();}
   // the window: a frame and a cross bar, drawn a little loose
   g.strokeStyle='rgba(12,16,22,.75)';g.lineWidth=Math.max(10,W*.012);g.beginPath();g.moveTo(W*.5,-10);g.lineTo(W*.502,H+10);g.moveTo(-10,H*.46);g.lineTo(W+10,H*.458);g.stroke();
   g.lineWidth=Math.max(18,W*.02);g.strokeRect(0,0,W,H);
  },
  night(t){
   g.fillStyle=linear(['#0a0f24','#161d3c','#2a2847']);g.fillRect(0,0,W,H);
   for(const s of parts.stars){g.globalAlpha=.35+.65*Math.abs(Math.sin(t*s.s*.5+s.p));g.fillStyle='#f4f1e8';g.beginPath();g.arc(s.x*W,s.y*H,s.r,0,6.29);g.fill();}
   g.globalAlpha=1;
   const q=arc(),mx=q==null?W*.78:W*(.14+.72*ease(q)),my=q==null?H*.22:H*(.4-.24*Math.sin(Math.PI*(.15+.7*q))),mr=Math.max(22,Math.min(W,H)*.045);glow(mx,my,mr*5,'244,236,210',.16);
   g.fillStyle='#f3ecd6';g.beginPath();g.arc(mx,my,mr,0,6.29);g.fill();g.fillStyle='rgba(42,40,71,.18)';g.beginPath();g.arc(mx+mr*.3,my-mr*.15,mr*.28,0,6.29);g.arc(mx-mr*.35,my+mr*.3,mr*.18,0,6.29);g.fill();
   for(const c of parts.clouds){const x=((c.x+t*c.v)%1.4-.2)*W,y=c.y*H,w=c.w*W;g.fillStyle='rgba(120,130,170,.10)';g.beginPath();g.ellipse(x,y,w*.5,w*.09,0,0,6.29);g.ellipse(x+w*.18,y-w*.05,w*.28,w*.08,0,0,6.29);g.fill();}
   ridge(hill(.8,H*.03,1.2),'#131a31');ridge(hill(.88,H*.025,3.4),'#0b1021');
  },
  ocean(t){
   const horizon=H*.6;
   g.fillStyle=linear(['#4f5a92','#b9758a','#f1ae86'],0,horizon);g.fillRect(0,0,W,horizon);
   const q=arc(),sx=W*.62,sy=horizon-Math.min(W,H)*.06*(q==null?1:1.7-1.6*ease(q)),sr=Math.max(26,Math.min(W,H)*.06);glow(sx,sy,sr*4,'255,214,165',.35);
   g.fillStyle='#ffd9a4';g.beginPath();g.arc(sx,sy,sr,0,6.29);g.fill();
   g.fillStyle=linear(['#45507f','#26305a','#161d3b'],horizon,H);g.fillRect(0,horizon,W,H-horizon);
   for(const s of parts.glints){const y=horizon+s.y*(H-horizon)*.7+4,w=(1-s.y)*sr*1.6+6;g.globalAlpha=.25+.5*Math.abs(Math.sin(t*1.3+s.p));g.fillStyle='#ffd9a4';g.fillRect(sx+s.x*W*(.3+s.y)-w/2,y,w,1.6);}
   g.globalAlpha=1;
   for(let i=0;i<7;i++){const y=horizon+(H-horizon)*(.08+i*.14),a=.06+i*.035,amp=2+i*1.6,len=W/(2.5-i*.2);g.strokeStyle=`rgba(225,232,250,${a})`;g.lineWidth=1+i*.25;g.beginPath();for(let x=0;x<=W+10;x+=10)g.lineTo(x,y+Math.sin(x/len*6.28+t*(.5+i*.08)+i)*amp);g.stroke();}
  },
  lamp(t){
   g.fillStyle=linear(['#1a1411','#241b15','#2c2119']);g.fillRect(0,0,W,H);
   const lx=W*.3,ly=H*.33;glow(lx,ly+H*.12,Math.max(W,H)*.55,'255,200,130',.28);glow(lx,ly+H*.05,Math.max(W,H)*.2,'255,214,160',.35);
   const desk=H*.74;g.fillStyle=linear(['#3b2b1f','#2a1e16'],desk,H);g.fillRect(0,desk,W,H-desk);g.strokeStyle='rgba(255,210,150,.25)';g.lineWidth=2;g.beginPath();g.moveTo(0,desk);g.lineTo(W,desk-2);g.stroke();
   // the lamp: a weighted base, a jointed arm, and a shade that points its light down at the desk
   const bx=lx-W*.07,ex=lx-W*.1,ey=ly+H*.2,sw=Math.max(60,W*.07),sh=Math.max(34,H*.06);
   const cone=g.createLinearGradient(0,ly+sh*.5,0,desk);cone.addColorStop(0,'rgba(255,214,160,.22)');cone.addColorStop(1,'rgba(255,214,160,0)');
   g.fillStyle=cone;g.beginPath();g.moveTo(lx-sw*.48,ly+sh*.5);g.lineTo(lx+sw*.48,ly+sh*.5);g.lineTo(lx+sw*1.6,desk);g.lineTo(lx-sw*1.6,desk);g.closePath();g.fill();
   g.strokeStyle='#120d0a';g.fillStyle='#120d0a';g.lineWidth=Math.max(5,W*.005);g.lineCap='round';g.lineJoin='round';
   g.beginPath();g.ellipse(bx,desk-3,sw*.55,Math.max(5,H*.012),0,0,6.29);g.fill();
   g.beginPath();g.moveTo(bx,desk-6);g.lineTo(ex,ey);g.lineTo(lx,ly-sh*.35);g.stroke();
   g.beginPath();g.arc(ex,ey,g.lineWidth*.9,0,6.29);g.fill();
   g.beginPath();g.moveTo(lx-sw*.16,ly-sh*.5);g.lineTo(lx+sw*.16,ly-sh*.5);g.lineTo(lx+sw*.5,ly+sh*.5);g.lineTo(lx-sw*.5,ly+sh*.5);g.closePath();g.fill();
   g.fillStyle='rgba(255,226,180,.9)';g.beginPath();g.ellipse(lx,ly+sh*.5,sw*.42,Math.max(3,sh*.1),0,0,6.29);g.fill();
   // a mug, and steam
   const mx=W*.68,my=desk-H*.07,mw=Math.max(34,W*.035),mh=Math.max(40,H*.07);
   g.fillStyle='#4a3527';g.fillRect(mx,my,mw,mh);g.strokeStyle='#4a3527';g.lineWidth=Math.max(5,mw*.14);g.beginPath();g.arc(mx+mw,my+mh*.45,mh*.22,-1.4,1.4);g.stroke();
   g.strokeStyle=`rgba(255,236,210,${(.18*(arc()==null?1:1-.7*ease(arc()))).toFixed(3)})`;g.lineWidth=2.4;
   for(let k=0;k<3;k++){g.beginPath();for(let s=0;s<=1;s+=.05){const y=my-6-s*H*.16,x=mx+mw*(.25+k*.25)+Math.sin(s*7+t*1.2+k*2)*8*s;s?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
   for(const m of parts.motes){const x=(m.x*W+Math.sin(t*.3+m.p)*14),y=((m.y-t*m.v)%1+1)%1*desk;g.fillStyle=`rgba(255,224,170,${.25+.35*Math.abs(Math.sin(t*.7+m.p))})`;g.beginPath();g.arc(x,y,m.r,0,6.29);g.fill();}
  },
  starry(t){
   ground(()=>{
    g.fillStyle=linear(['#142443','#294a6c','#456c83']);g.fillRect(0,0,W,H);
    const palette=['#47728c','#668e9e','#315577','#8ca9b0','#203e61','#b2beb0'];
    for(const m of parts.marks){const x=m.x*W,y=m.y*H,dx=x-W*.22,dy=y-H*.3;
     dab(x,y,m.l,Math.atan2(dy,dx)+1.3,palette[m.c],1.5);}
    ridge(hill(.84,H*.04,2.1),'#1c3d4b');ridge(hill(.92,H*.025,4),'#152f3b');
    // A small cypress anchors the left edge and leaves the timer's centre quiet.
    g.fillStyle='#152f32';g.beginPath();g.moveTo(W*.07,H);g.bezierCurveTo(W*.03,H*.72,W*.09,H*.57,W*.09,H*.39);g.bezierCurveTo(W*.13,H*.65,W*.15,H*.82,W*.14,H);g.closePath();g.fill();
   });
   for(const [cx,cy,r] of [[.23,.29,.14],[.78,.34,.11]])for(let band=0;band<5;band++){
    g.strokeStyle=['#7b9ca9','#aebdad','#557f99','#90abb0','#3c6484'][band];g.lineWidth=1.6+band*.3;g.globalAlpha=.4;
    g.beginPath();for(let k=0;k<72;k++){const a=k*.115+t*.035,rad=Math.min(W,H)*r*(.12+k/80)+band*4;
     const x=cx*W+Math.cos(a)*rad,y=cy*H+Math.sin(a)*rad*.58;k?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
   }
   g.globalAlpha=1;
   {const q=arc()??.62,mx=W*(.1+.8*ease(q)),my=H*(.36-.22*Math.sin(Math.PI*q)),mr=Math.max(14,Math.min(W,H)*.026);
    glow(mx,my,mr*7,'241,226,170',.14);
    for(let k=0;k<4;k++){g.strokeStyle=k%2?'rgba(236,222,160,.55)':'rgba(214,203,150,.45)';g.lineWidth=2;g.beginPath();g.arc(mx,my,mr*(.55+k*.18),-.6+k*.3+t*.05,2.6+k*.3+t*.05);g.stroke();}
    g.fillStyle='#ede0a6';g.beginPath();g.arc(mx,my,mr*.48,0,6.29);g.fill();}
   for(const [i,x,y,r] of [[0,.11,.17,5],[1,.4,.16,4],[2,.64,.12,6],[3,.88,.2,7]]){
    glow(W*x,H*y,r*6,'242,219,148',.16+Math.sin(t*.4+i)*.02);g.fillStyle='#e7d69b';g.beginPath();g.arc(W*x,H*y,r,0,6.29);g.fill();
   }
  },
  lilies(t){
   ground(()=>{
    g.fillStyle=linear(['#d4ddd4','#b0c7c7','#8da9b1','#718e9f']);g.fillRect(0,0,W,H);
    const palette=['#a7bfc0','#b8c7c6','#8faeb3','#c8cecc','#a4b4c2','#7e9ca9'];
    for(const m of parts.marks)dab(m.x*W,m.y*H,m.l*2,Math.sin(m.p)*.12,palette[m.c],2.5);
    // Willow reflections stay on the edges, outside the reading area.
    for(let i=0;i<28;i++){const x=(i<14?.01+i*.011:.86+(i-14)*.011)*W;
     g.strokeStyle=i%2?'rgba(68,105,91,.28)':'rgba(87,119,104,.2)';g.lineWidth=4+i%4;g.beginPath();g.moveTo(x,0);g.bezierCurveTo(x-20,H*.1,x+24,H*.17,x-9,H*(.18+(i%6)*.03));g.stroke();}
   });
   for(const p of parts.pads){
    const x=p.x*W+Math.sin(t*.16+p.p)*4,y=p.y*H+Math.sin(t*.2+p.p)*1.8,r=p.r*Math.min(W,H);
    g.strokeStyle='rgba(233,234,213,.3)';g.lineWidth=1;g.beginPath();g.ellipse(x,y+6,r*1.65,r*.36,0,0,6.29);g.stroke();
    g.fillStyle=p.flower?'#6a887b':'#789787';g.beginPath();g.ellipse(x,y,r,r*.34,-.1,p.p+.18,p.p+6.05);g.lineTo(x,y);g.closePath();g.fill();
    dab(x-r*.55,y-1,r*.8,-.08,'rgba(184,199,159,.45)',1.5);
    if(p.flower){const open=arc()==null?1:.3+.7*ease(arc());for(let k=0;k<5;k++){const a=(k-2)*.43*open;g.fillStyle=k%2?'#d9afb9':'#ebccd0';g.beginPath();g.ellipse(x+Math.sin(a)*r*.23*open,y-r*.12,r*.13*(.6+.4*open),r*.26*(.7+.3*open),a,0,6.29);g.fill();}g.fillStyle='#ece1ad';g.beginPath();g.ellipse(x,y,r*.1,r*.06,0,0,6.29);g.fill();}
   }
  },
  ink(t){
   ground(()=>{
    g.fillStyle='#eeeade';g.fillRect(0,0,W,H);
    for(const m of parts.marks)dab(m.x*W,m.y*H,m.l,m.p,'rgba(124,112,87,.035)',.7);
    for(const [x,y,w,h,c] of [[.13,.67,.48,.43,'rgba(88,113,114,.32)'],[.83,.62,.45,.3,'rgba(110,133,132,.3)'],[.03,.87,.4,.43,'rgba(57,88,86,.52)'],[.99,.98,.48,.5,'rgba(57,83,81,.52)']])mountain(x*W,y*H,w*W,h*H,c);
    g.fillStyle='#b77362';g.beginPath();g.arc(W*.76,H*.22,Math.min(W,H)*.028,0,6.29);g.fill();
    // Small dry-brush ridges retain plenty of unpainted paper around the dial.
    for(let i=0;i<32;i++)dab(W*(.005+i*.004),H*(.72-Math.sin(i*.1)*.22),8+i%8,-.7,'rgba(49,76,74,.15)',1);
   });
   for(let i=0;i<3;i++){
    const y=H*(.6+i*.105)+Math.sin(t*.13+i)*4,x=W*(.2+i*.25)+Math.sin(t*.04+i)*W*.03;
    const mist=g.createRadialGradient(x,y,0,x,y,W*.42);mist.addColorStop(0,'rgba(241,239,229,.25)');mist.addColorStop(1,'rgba(241,239,229,0)');
    g.fillStyle=mist;g.fillRect(0,0,W,H);
   }
   // A small boat crosses the lake over the focus round, drawn after the mist so it reads as ink, not as weather.
   {const q=arc()??.28,bx=W*(.2+.6*ease(q)),by=H*.905+Math.sin(t*.5)*1.6,bw=Math.max(40,W*.04),ink='rgba(30,42,40,.82)';
    g.fillStyle=ink;g.beginPath();g.moveTo(bx-bw*.62,by-3);g.quadraticCurveTo(bx,by+bw*.2,bx+bw*.62,by-4);g.quadraticCurveTo(bx,by+bw*.06,bx-bw*.62,by-3);g.fill();
    g.strokeStyle=ink;g.lineCap='round';g.lineWidth=1.4;g.beginPath();g.moveTo(bx+bw*.34,by-2);g.lineTo(bx+bw*.78,by-bw*.62);g.stroke();
    g.beginPath();g.moveTo(bx-bw*.12,by-2);g.lineTo(bx-bw*.1,by-bw*.26);g.stroke();
    g.beginPath();g.moveTo(bx-bw*.28,by-bw*.24);g.lineTo(bx-bw*.1,by-bw*.4);g.lineTo(bx+bw*.08,by-bw*.24);g.closePath();g.fill();
    g.strokeStyle='rgba(30,42,40,.18)';g.lineWidth=1;for(let k=1;k<4;k++){g.beginPath();g.moveTo(bx-bw*(.6+k*.55),by+3+k*1.8);g.lineTo(bx-bw*(.2+k*.4),by+3+k*1.8);g.stroke();}}
  },
  plain(){g.fillStyle=theme==='dark'?'#16191f':'#F3F1EA';g.fillRect(0,0,W,H);}
 };
 const PAPER=['ink','lilies'];
 function after(t){
  if(scene==='plain')return;
  if(sess?.brk){g.fillStyle='rgba(255,212,160,.06)';g.fillRect(0,0,W,H);}
  // The ink wash: a soft ring that blooms out from the timer and fades, about two seconds.
  if(washAt>=0){
   const k=(t-washAt)/2;if(k<0||k>=1||quiet()){washAt=-1;return;}
   const cx=W/2,cy=H*.45,r=Math.hypot(W,H)*(.12+.8*(1-Math.pow(1-k,3))),a=.3*(1-k),c=PAPER.includes(scene)?'60,72,70':'8,10,14';
   const gr=g.createRadialGradient(cx,cy,r*.35,cx,cy,r);gr.addColorStop(0,`rgba(${c},${(a*.25).toFixed(3)})`);gr.addColorStop(.75,`rgba(${c},${a.toFixed(3)})`);gr.addColorStop(1,`rgba(${c},0)`);
   g.fillStyle=gr;g.fillRect(0,0,W,H);
  }
 }
 function frame(now){
  raf=0;
  if(dead||document.hidden||!DRAW[scene])return;
  if(!parts)parts=make();
  if(quiet()||scene==='plain'){DRAW[scene](time);after(time);return;}
  // Breaks move a little slower than focus.
  if(now-last>=33){time+=last?Math.min(.1,(now-last)/1000)*(sess?.brk?.6:1):0;last=now;DRAW[scene](time);after(time);}
  raf=requestAnimationFrame(frame);
 }
 function draw(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;g.clearRect(0,0,W,H);if(dead||!DRAW[scene]||document.hidden)return;if(!parts)parts=make();DRAW[scene](time);after(time);if(!quiet()&&scene!=='plain')raf=requestAnimationFrame(frame);}

  let look='';
  function show(value){
   if(dead)return;const next=JSON.stringify(value);if(next===look)return;look=next;
   const nextScene=DRAW[value.scene]?value.scene:'';if(nextScene!==scene){scene=nextScene;parts=null;base=null;time=0;}
   theme=value.theme==='dark'?'dark':'light';still=!!value.still;draw();
  }
  // Told by the room each second. A still scene is redrawn only when the story has visibly moved.
  function session(value){
   if(dead||!value)return;
   const next={progress:Number(value.progress)||0,brk:!!value.brk,running:!!value.running};
   if(sess&&sess.brk!==next.brk&&!quiet()&&scene!=='plain')washAt=time;
   const moved=!sess||sess.brk!==next.brk||sess.running!==next.running||Math.abs(sess.progress-next.progress)>.004;
   sess=next;
   if(moved&&(quiet()||scene==='plain'||!raf))draw();
  }
  const resize=()=>{size();draw();},visible=()=>draw();
  win.addEventListener('resize',resize);document.addEventListener('visibilitychange',visible);motion?.addEventListener?.('change',visible);size();
  function destroy(){dead=true;if(raf)cancelAnimationFrame(raf);raf=0;base=null;parts=null;win.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visible);motion?.removeEventListener?.('change',visible);}
  return {show,session,destroy,supports:name=>Object.hasOwn(DRAW,name)};
 }
 const api={create};root.ReserveFocusSceneRenderer=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
