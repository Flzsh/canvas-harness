/*! Canvas Harness — the Train Cabin's land painter (engine 2). Original creator: Flzsh. */
// The land outside the Train Cabin as a living painting, drawn with WebGL2 in the land's own page (page.html), under the band: the
// land in the window and the land under the room, from the same pictures as before, each layer where the journey has slid it and
// riding against the room on the rail (scene-themes.js bandRide: probe), and on top of the plain sliding what the land's own
// live-<land>.json asks for: water and sand that flow, leaves and cloth that sway in a wind with gusts, heat that shimmers, glints
// and twinkles, lamps that breathe, lights that glow, particles of every kind carried back by the train's own speed, small painted
// things that travel, light shafts, and a true motion blur at speed. Only the viewport is drawn. A governor halves the frame rate or
// drops effects before frames are missed. Nothing runs while the land rests (a hidden tab, a page at rest, Motion off). Without
// WebGL2, at Graphics Low, or once the context is lost twice, the land is laid as before (page.js falls back to roomPage).
(function(global){
 'use strict';
 const STAGES=['morning','noon','sunset','dusk','night'],PI2=Math.PI*2;
 const KINDS=['dust','sand','rain','snow','leaves','petals','fireflies','embers','meteor','bubbles','spray','lanterns','birds'];
 // ------------------------------------------------------------------ shaders
 const VS=`#version 300 es
 in vec2 aPos;uniform vec4 uRect;uniform vec2 uView;out vec2 vPx;
 void main(){vec2 p=uRect.xy+aPos*uRect.zw;vPx=p;gl_Position=vec4(p.x/uView.x*2.-1.,1.-p.y/uView.y*2.,0.,1.);}`;
 // a land layer: screen px -> the layer's own place (its ride: translate t, tilt r about o) -> art px -> the picture
 const FS=`#version 300 es
 precision highp float;
 in vec2 vPx;out vec4 outColor;
 uniform sampler2D uTex,uFlow,uGlow,uAlt,uIds;
 uniform float uLampOn;uniform vec4 uLampT;uniform vec2 uLamp;uniform vec2 uLampS;   // lights: (shortest, longest period, a dark window's lit share, a lit one's dark share); (bulbs, beacons: how much they play)
 uniform vec2 uOrigin;      // the layer's place on the canvas: where art x 0 / art row 0 lie
 uniform float uK;          // canvas px per art px
 uniform vec2 uShake;       // the ride (canvas px)
 uniform vec3 uTilt;        // tilt: radians, about (x, y) on the canvas
 uniform vec4 uMap;         // art row of the picture's first row, art rows the picture covers, art px the picture's width covers (0: no repeat), art px it has slid
 uniform vec2 uStretch;     // rows: the picture is drawn from art row a to b (the window's 264 over 256)
 uniform vec2 uClip;        // art rows that show (from, to)
 uniform vec2 uTexSize;
 uniform float uTileRow;    // the row of the 2250-row tile this layer's art row 0 is (window 0, page 512)
 uniform float uHit;        // a sprite's hit (live hit.flash): the whole land's flash now, 0 without one
 uniform vec4 uCut[6];uniform float uCuts;uniform vec2 uCutEdge;uniform vec4 uRings;uniform vec3 uRipple;   // ripples: (art px, turns a second, the tile row the water begins at)
uniform float uTime,uSpeed,uFlowMax,uFlowOn,uSwayAmp,uSwayHz,uShimKind,uShimAmt,uGlowOn,uBlurPx,uBobAmp,uBobHz,uLod,uXLevels,uXLod,uScale,uCover,uSwayKind;
 float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 vec4 pic(vec2 art,float lod){
  // art (x along the tile, row) -> the picture, as the page laid it (repeat across x when it travels)
  float y=(art.y-uStretch.x)/(uStretch.y-uStretch.x);
  if(y<0.||y>1.)return vec4(0);
  float x=art.x;
  if(uMap.z>0.){x=mod(x+uMap.w,uMap.z)/4096.;}else{x=x/4096.;if(x<0.||x>1.)return vec4(0);}
  return textureLod(uTex,vec2(x,y),lod);
 }
 // the lights (a live layer's lights): the same place in the picture with every light in its other state, and in the map of the lights
 vec4 lamps(vec4 col,vec2 art,float lod,float t){
  float y=(art.y-uStretch.x)/(uStretch.y-uStretch.x);
  if(y<0.||y>1.)return col;
  float x=art.x;
  if(uMap.z>0.){x=mod(x+uMap.w,uMap.z)/4096.;}else{x=x/4096.;if(x<0.||x>1.)return col;}
  vec4 L=textureLod(uIds,vec2(x,y),0.);
  if(L.a<.3)return col;
  float h=L.r*.99609375+L.g*.00389099,h1=fract(h*443.897+.371),h2=fract(h*91.173+h1*7.31),m=0.;
  if(L.a>.9){
   // a window: in its other state for a share of its own long period (a lit one dark, a dark one lit); the switch is quick, and a
   // pane that comes ON stutters twice first, as a tube does
   float P=mix(uLampT.x,uLampT.y,h1*h1),u=fract(t/P+h2)*P,lit=step(.5,L.b),d=mix(uLampT.z,uLampT.w,lit)*P*(.6+.8*h1);
   // (uLampS: how many seconds the switch takes; whether a pane may stutter: a lamp behind paper or a candle does not)
   m=smoothstep(0.,uLampS.x,u)*(1.-smoothstep(d,d+uLampS.x,u));
   // (since it came ON: a dark window on its way into its other state, a lit one on its way back out of it)
   float since=u-d*lit;
   if(uLampS.y>.5&&h1>.72&&since>0.&&since<.4){float k=floor(since/.07),f=k>3.5?1.:1.-mod(k,2.);m=lit>.5?1.-f:f;}
  }else if(L.a>.7){
   // a beacon: lit for a part of every 2.6 s, all of one building at once
   float u=fract(t/2.6+h2);m=uLamp.y*(1.-smoothstep(0.,.05,u)*(1.-smoothstep(.34,.5,u)));
  }else{
   // a bulb: lit while the run that travels along its string passes it (four of every eight)
   float way=h1>.5?1.:-1.,u=fract(t*way*(.22+.2*h2)-L.b*.99609375);m=uLamp.x*(1.-smoothstep(0.,.1,u)*(1.-smoothstep(.5,.62,u)));
  }
  if(m<=0.)return col;
  return mix(col,textureLod(uAlt,vec2(x,y),lod),m);
 }
 // RAIN RINGS: where the rain lands on water a ring widens and fades, seen flat (wide and low). The water is in patches (their grid
 // closes across the tile's two ends); each has a drop now and then, at a place of its own each time. xy: how the picture under the
 // ring is bent (art px), z: its crest's light.
 vec3 rings(vec2 tile,float t){
  float d=tile.y-uRings.y;if(uRings.x<=0.||d<4.)return vec3(0);
  float R=uRings.z,per=1./max(uRings.w,.05),sq=.34,N=max(4.,floor(4096./(R*2.6)+.5));vec2 g=vec2(4096./N,R*2.6*sq),q=vec2(tile.x,d)/g,b=floor(q-.5);vec3 acc=vec3(0);
  for(float j=0.;j<2.;j++)for(float i=0.;i<2.;i++){
   vec2 c=b+vec2(i,j),cw=vec2(mod(c.x,N),c.y);float h=hash(cw*1.37+3.1),n=floor(t/per+h),age=(t/per+h-n)*per,life=.9+.7*hash(cw+n*7.13);
   if(age>life)continue;
   vec2 o=c+.5+(vec2(hash(cw+n*3.7),hash(cw.yx+n*5.3))-.5)*.5,v=(q-o)*g;v.y/=sq;
   // (the ring, and a second smaller one after it once the first has gone a little way)
   float u=age/life,r=R*pow(u,.75),w=1.8+r*.09,l=length(v),e=(l-r)/w,e2=(l-r*.55)/(w*.8),f=(1.-u)*(1.-u)*smoothstep(0.,.08,u),k=(exp(-e*e)+.55*exp(-e2*e2)*smoothstep(.2,.4,u))*f;
   acc+=vec3(normalize(v+1e-4)*vec2(1.,sq)*k,k);
  }
  return acc*uRings.x*smoothstep(4.,40.,d);
 }
 void main(){
  vec2 p=vPx/uScale-uShake;
  if(uTilt.x!=0.){vec2 q=p-uTilt.yz;float c=cos(-uTilt.x),s=sin(-uTilt.x);p=vec2(c*q.x-s*q.y,s*q.x+c*q.y)+uTilt.yz;}
  vec2 art=(p-uOrigin)/uK;
  if(art.y<uClip.x||art.y>=uClip.y){outColor=vec4(0);return;}
  float t=uTime;
  // where this place is on the whole tile (for the maps: 1024 x 563 over 4096 x 2250)
  vec2 tile=vec2(mod(art.x+uMap.w,4096.),art.y*(uStretch.y>0.?1.:1.)+uTileRow);
  vec2 fuv=vec2(tile.x/4096.,clamp(tile.y/2250.,0.,1.));
  vec4 fl=uFlowOn>.5?texture(uFlow,fuv):vec4(.5,.5,0.,0.);
  vec2 shift=vec2(0);
  // sway: leaves, grass, cloth move with the wind (layered noise with gusts; B is how much)
  // (kind water: a slow bend that travels through the layer, two waves across each other, no flutter)
  if(uSwayAmp>0.&&fl.b>0.&&uSwayKind>.5){float w=sin(PI2X*uSwayHz*t+tile.x/420.+tile.y/300.)*.7+sin(PI2X*uSwayHz*.61*t+tile.x/190.-tile.y/260.+1.7)*.3,v=cos(PI2X*uSwayHz*.83*t+tile.y/350.+tile.x/510.+.6);shift+=vec2(w,v*.3)*uSwayAmp*fl.b;}
  else if(uSwayAmp>0.&&fl.b>0.){float gust=noise(vec2(tile.x/900.-t*.35,.5))*1.4+.3,w=sin(PI2X*uSwayHz*t+tile.x/240.+tile.y/180.)*.55+sin(PI2X*uSwayHz*1.73*t+tile.x/97.+1.3)*.3+(noise(vec2(tile.x/60.+t*1.7,tile.y/60.))-.5)*.5;shift+=vec2(w*gust,abs(w)*.18)*uSwayAmp*fl.b;}
  // bob: the layer rises and falls (a moored boat, a floating thing)
  if(uBobAmp>0.)shift.y+=sin(PI2X*uBobHz*t+tile.x/700.)*uBobAmp;
  // ripples: under the waterline every row wavers sideways, three waves through each other; calm at the shore, fuller further out
  if(uRipple.x>0.&&tile.y>uRipple.z){float d=tile.y-uRipple.z,g=smoothstep(0.,30.,d)*min(1.,.45+d/260.),w=PI2X*uRipple.y*t;
   shift.x+=(sin(tile.y/7.3+w)+.6*sin(tile.y/3.1-w*1.63+tile.x/47.)+.5*sin(tile.y/17.-w*.71+tile.x/130.))*uRipple.x*g*.6;}
  // rain rings: the picture under a ring is bent along the ring's own way out
  vec3 rg=rings(tile,t);shift+=rg.xy*3.4;
  // shimmer: heat (fine rising distortion)
  if(uShimKind==1.&&fl.a>0.)shift+=vec2((noise(vec2(tile.x/7.,tile.y/3.+t*9.))-.5)*1.6,(noise(vec2(tile.x/5.+3.,tile.y/4.+t*7.))-.5)*.8)*uShimAmt*fl.a;
  vec2 a0=art-shift;
  vec4 col;
  // flow: the picture streams along the map, two phases cross-faded so it never jumps or stretches into smear
  vec2 fv=(fl.rg*255.-128.)/127.*uFlowMax;
  if(uFlowOn>.5&&dot(fv,fv)>.0001){
   float T=clamp(24./max(uFlowMax,1.),.6,3.),j=noise(tile/180.)*.5,ph0=fract(t/T+j),ph1=fract(t/T+j+.5),w0=1.-abs(2.*ph0-1.);
   vec2 q0=a0-fv*(ph0-.5)*T,q1=a0-fv*(ph1-.5)*T;vec4 c0=pic(q0,uLod),c1=pic(q1,uLod);
   // (water that streams has lights in it too: a window's streak in the canal switches with its window)
   if(uLampOn>.5){c0=lamps(c0,q0,uLod,t);c1=lamps(c1,q1,uLod,t);}
   col=mix(c1,c0,w0);
  }else if(uBlurPx>1.){
   // a true motion blur along the way it moves: taps over the distance passed in a sixtieth of a second, from columns averaged x-wise
   // (16 taps with a small jitter: one soft streak, its edges smooth; 4.0.170)
   float n=16.,L=uBlurPx/uK,jit=hash(vPx+fract(t))-.5;col=vec4(0);
   for(float i=0.;i<16.;i++){col+=pic(a0+vec2(((i+.5+jit*.35)/n-.5)*L,0.),min(uLod+uXLod,6.));}col/=n;
  }else{col=pic(a0,uLod);if(uLampOn>.5)col=lamps(col,a0,uLod,t);}
  if(col.a<=0.){outColor=vec4(0);return;}
  // (a ring's crest: pale, by what light the water has there)
  if(rg.z>0.)col.rgb+=(vec3(.75,.85,1.)*.2+col.rgb/max(col.a,.001)*.6)*min(rg.z,1.)*col.a*.9;
  // shimmer: glints (sparkles that come and go), twinkle (bright pixels one by one), flicker (lamps breathe)
  if(uShimKind>1.&&fl.a>0.){
   vec2 cell=floor(tile/vec2(5.,3.));float lum=dot(col.rgb/max(col.a,.001),vec3(.2126,.7152,.0722));
   if(uShimKind==2.){float g=pow(max(0.,noise(cell*.37+vec2(t*.9,t*.4))-.62)/.38,3.)*smoothstep(.45,.85,lum);col.rgb+=vec3(g*.9)*col.a*fl.a*uShimAmt;}
   else if(uShimKind==3.){float s=hash(cell)*PI2X,f=.5+.5*sin(t*(1.3+hash(cell+7.)*2.6)+s);col.rgb*=1.+(f-.5)*.9*uShimAmt*fl.a*smoothstep(.5,.9,lum);}
   else if(uShimKind==4.){float b=noise(vec2(floor(tile.x/90.)*1.7,t*.6))*.7+noise(vec2(floor(tile.x/90.)+9.,t*2.1))*.3;col.rgb*=1.+(b-.5)*.35*uShimAmt*fl.a;}
   else {float cellx=floor(tile.x/700.),slot=floor(t/2.3),seed=hash(vec2(cellx,slot)),at=hash(vec2(slot,cellx+3.))*1.6,u=t-slot*2.3-at;
    float f=seed>.72?(exp(-max(u,0.)*22.)*step(0.,u)+.6*exp(-max(u-.16,0.)*18.)*step(.16,u)+.25*step(.3,u)*step(u,.55)*hash(vec2(floor(t*30.),cellx))):0.;
    col.rgb+=vec3(.78,.84,1.)*f*1.6*uShimAmt*fl.a*col.a;}
  }
  // what gives light at this hour, with a slow flicker
  if(uGlowOn>.5){vec3 g=texture(uGlow,fuv).rgb;float f=.86+.14*noise(vec2(floor(tile.x/60.),t*.8));col.rgb+=g*f*col.a;}
  // (a hit's flash: the layer's own light and as much again toward white, by the flash's share)
  if(uHit>0.)col.rgb+=(col.rgb+vec3(col.a))*.5*uHit;
  for(int i=0;i<6;i++){if(float(i)>=uCuts)break;vec4 c=uCut[i];float e=min(min(tile.x-c.x,c.z-tile.x),min(tile.y-c.y,c.w-tile.y));col*=1.-smoothstep(uCutEdge.x,uCutEdge.x+uCutEdge.y,e);}
  outColor=uCover>.5?vec4(0,0,0,col.a):col;
 }`.replace(/PI2X/g,'6.2831853');
 // the second stage of a fade: its own picture (drawn alone), laid over the first at its share
 // rain on the cabin's glass (live.glass): art px in the window -> the light a drop adds (rgb, already times its cover) and the
 // shade it lays (a). A drop lands with a ring, sits and swells, lets go and runs down and back, leaving beads; small beads stand.
 const FS_GLASS=`#version 300 es
 precision highp float;
 in vec2 vPx;out vec4 o;
 uniform vec2 uOrigin;uniform float uK,uTime,uAmt,uV;uniform vec3 uTint;
 float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 vec2 drop(vec2 q,float r){
  float d=length(q)/r;if(d>=1.)return vec2(0.);
  float aa=smoothstep(1.,1.-1.6/max(r*uK,1.7),d);vec2 hq=q-r*vec2(-.34,-.4),nq=normalize(q+vec2(1e-4));
  float spec=exp(-dot(hq,hq)/(r*r*.05))*.85;
  float body=(1.-d*d)*.07+smoothstep(.5,1.,d)*max(0.,dot(nq,vec2(.25,.97)))*.16;
  float shade=smoothstep(.45,1.,d)*max(0.,dot(nq,vec2(-.2,-.98)))*.5+(1.-d)*.05;
  return vec2((spec+body)*aa,shade*aa);
 }
 vec2 lay(vec2 a,float c,float seed,float t,vec2 dir){
  vec2 acc=vec2(0.),id0=floor(a/c);
  for(int j=0;j<2;j++)for(int i=0;i<3;i++){
   vec2 id=id0+vec2(float(j),-float(i));
   float ha=h1(id+seed),hb=h1(id*1.37+seed+3.1),hc=h1(id*2.11+seed+7.7);
   if(ha>uAmt*.62)continue;
   float T=5.+9.*hb,ph=fract(t/T+hc);
   vec2 p0=(id+.2+.6*vec2(hb,hc))*c;float r=c*(.085+.11*h1(id+seed+11.));
   float run=ph<.6?0.:(ph-.6)/.4,len=c*(1.2+1.3*ha/.62),rr2=run*run;
   vec2 p=p0+dir*len*rr2;
   float grow=ph<.6?(.72+.28*ph/.6):1.,fade=1.-smoothstep(.9,1.,ph);
   vec2 q=a-p;
   if(run>0.)q-=dir*clamp(dot(q,dir),-r*1.6*run,0.);
   acc+=drop(q,r*grow)*fade;
   for(int k=1;k<=3;k++){float s=float(k)/3.5;if(rr2>s){vec2 qb=a-(p0+dir*len*s+vec2(h1(id+float(k))-.5,0.)*r);acc+=drop(qb,r*(.34-.06*float(k)))*fade*(1.-smoothstep(0.,.5,rr2-s));}}
   if(ph<.035){float e=ph/.035,ring=r*(1.+2.6*e),dd=abs(length(a-p0)-ring);acc.x+=smoothstep(1.4/uK+r*.12,0.,dd)*(1.-e)*.5;}
  }
  return acc;
 }
 void main(){
  vec2 a=(vPx-uOrigin)/uK;
  vec2 dir=normalize(vec2(-.55*clamp(uV,0.,2.),1.));
  vec2 s=lay(a,64.,1.,uTime,dir)+lay(a+vec2(13.,7.),36.,5.,uTime*1.13,dir)*.9;
  vec2 id=floor(a/11.);float hb=h1(id+31.);
  if(hb<uAmt*.3){vec2 q=a-(id+.25+.5*vec2(h1(id+2.),h1(id+5.)))*11.;s+=drop(q,1.3+1.9*h1(id+9.))*.8;}
  o=vec4(uTint*min(s.x,1.),min(s.y,.6));
 }`;
 const FS_COPY=`#version 300 es
 precision highp float;in vec2 vPx;out vec4 o;uniform sampler2D uTex;uniform vec2 uView;uniform float uShare;
 void main(){o=texture(uTex,vec2(vPx.x/uView.x,1.-vPx.y/uView.y))*uShare;}`;
 // x-wise halving for the motion blur's columns
 const FS_HALF=`#version 300 es
 precision highp float;in vec2 vPx;out vec4 o;uniform sampler2D uTex;uniform vec2 uSrc;
 void main(){float x=floor(vPx.x)*2.+1.;o=texture(uTex,vec2(x/uSrc.x,1.-vPx.y/uSrc.y));}`;
 // particles: one quad per particle, everything worked out from its seed, the clock and the journey
 const VS_P=`#version 300 es
 in vec2 aPos;in float aSeed;uniform vec2 uView;uniform float uK,uTime,uFar,uV,uSlide,uKind,uWind;uniform vec4 uBox;uniform vec2 uSize,uVel,uOrigin,uShake,uStretch;uniform float uWin,uEvery0,uEvery1,uShare;
 out vec2 vQ;out float vSeed,vAlpha;out vec2 vDir;
 float h(float n){return fract(sin(n*91.345+7.13)*43758.5453);}
 void main(){
  float s=aSeed,K=uKind,t=uTime;vec2 box0=uBox.xy,box1=uBox.zw,size=box1-box0;
  float sz=mix(uSize.x,uSize.y,h(s+1.)),life=1.;vec2 pos,vel=uVel*(.7+.6*h(s+2.));
  // carried back by the train itself: in proportion to the speed, so it slants and streams more as the train speeds up
  float drift=uWind*90.*uFar,back=uWind*90.*uV;
  if(K==8.){ // meteor: now and then one crosses the sky
   float every=mix(uEvery0,uEvery1,h(floor(t/uEvery1)+s)),n=floor(t/every),ph=(t-n*every)/1.2;life=step(ph,1.)*step(0.,ph);
   pos=box0+size*vec2(h(n+s*3.),h(n+s*5.)*.6)+vec2(-380.,160.)*ph;vel=vec2(-380.,160.);sz=mix(uSize.x,uSize.y,.5);
  }else if(K==12.){ // birds: a loose flock crossing the tile
   float c=t*(14.+6.*h(s));pos=box0+vec2(mod(c*-1.+h(s+3.)*size.x+80.*sin(t*.2+s),size.x),size.y*(.25+.5*h(s+4.))+14.*sin(t*.7+s*3.));vel=vec2(-14.,0.);
  }else{
   float fall=(K==2.||K==3.||K==4.||K==5.||K==10.)?1.:0.,rise=(K==7.||K==9.||K==11.)?1.:0.;
   vec2 v=vel;if(fall>0.&&v.y==0.)v.y=K==2.?620.:K==3.?38.:24.;if(rise>0.&&v.y==0.)v.y=K==11.?-9.:-26.;
   vec2 p0=vec2(h(s+5.),h(s+6.))*size;
   vec2 p=p0+v*t-vec2(drift,0.);
   if(K==3.||K==4.||K==5.)p.x+=sin(t*(.6+h(s)*.8)+s*6.)*(K==3.?9.:16.);
   if(K==0.||K==6.){p+=vec2(sin(t*(.21+.2*h(s))+s*4.),cos(t*(.17+.2*h(s+1.))+s*2.))*vec2(26.,14.);}
   pos=box0+mod(p,size);vel=v-vec2(back,0.);
   // (a particle that leaves its box comes back at the other side: it fades out and in there, it never pops)
   vec2 e=min(pos-box0,box1-pos)/max(vec2(1.),size*.07);life*=clamp(min(e.x,e.y),0.,1.);
   if(K==6.)life*=.5+.5*sin(t*(1.1+h(s)*1.6)+s*9.);
   if(K==10.){float ph=fract(t*.8+h(s));life*=1.-ph;}
  }
  // the layer it lives in slides with the journey; in the window the rows are drawn 264 over 256
  float x=pos.x-uSlide;x=mod(x,4096.);
  vec2 art=vec2(x,pos.y);
  vec2 scr;
  if(uWin>.5)scr=uOrigin+vec2(art.x,uStretch.x+(art.y)*(uStretch.y-uStretch.x)/256.)*uK+uShake;
  else scr=uOrigin+vec2(art.x,art.y-512.)*uK+uShake;
  // a streak is long along the way it moves (rain, sand, meteors, spray); the rest are round
  float speed=length(vel);vec2 dir=speed>0.?vel/speed:vec2(1,0);float len=(K==1.||K==2.||K==8.||K==10.)?max(1.,speed/60.):1.;
  vec2 q=aPos*2.-1.;vec2 off=(K==1.||K==2.||K==8.||K==10.)?dir*q.x*sz*len*.5+vec2(-dir.y,dir.x)*q.y*sz*.5:q*sz*(K==6.||K==7.||K==11.?2.6:1.);
  vec2 P=scr+off*uK;
  vQ=q;vSeed=s;vAlpha=life*uShare;vDir=dir;
  gl_Position=vec4(P.x/uView.x*2.-1.,1.-P.y/uView.y*2.,0.,1.);
 }`;
 const FS_P=`#version 300 es
 precision highp float;in vec2 vQ;in float vSeed,vAlpha;in vec2 vDir;out vec4 o;uniform float uKind,uTime,uPAlpha;uniform vec3 uTint;
 float h(float n){return fract(sin(n*91.345+7.13)*43758.5453);}
 void main(){
  float K=uKind,r=length(vQ),a=0.;vec3 c=uTint;
  if(K==0.){a=smoothstep(1.,.1,r)*.55;c=vec3(1.,.97,.88);}
  else if(K==1.){a=smoothstep(1.,.2,abs(vQ.y))*smoothstep(1.,.3,abs(vQ.x))*.5;c=vec3(.86,.72,.52);}
  else if(K==2.){a=smoothstep(1.,.0,abs(vQ.y))*smoothstep(1.,.6,abs(vQ.x))*.42;c=vec3(.78,.84,.92);}
  else if(K==3.){a=smoothstep(1.,.25,r)*.9;c=vec3(1.);}
  else if(K==4.||K==5.){float an=uTime*(1.+h(vSeed)*2.)+vSeed*7.;vec2 q=mat2(cos(an),-sin(an),sin(an),cos(an))*vQ;a=smoothstep(1.,.85,length(q*vec2(1.,2.2)));c=K==4.?mix(vec3(.45,.6,.2),vec3(.85,.5,.15),h(vSeed+3.)):vec3(1.,.72,.82);}
  else if(K==6.){a=smoothstep(1.,0.,r)*smoothstep(1.,.0,r)*.9;c=vec3(.85,1.,.45);}
  else if(K==7.){a=smoothstep(1.,0.,r)*.8;c=mix(vec3(1.,.55,.15),vec3(1.,.85,.4),h(vSeed));}
  else if(K==8.){a=smoothstep(1.,.0,abs(vQ.y))*clamp(.5+vQ.x*.5,0.,1.)*1.;c=vec3(1.,.97,.9);}
  else if(K==9.){a=smoothstep(.12,0.,abs(r-.75))*.7;c=vec3(.85,.95,1.);}
  else if(K==10.){a=smoothstep(1.,.2,r)*.6;c=vec3(.95,.98,1.);}
  else if(K==11.){a=smoothstep(1.,.0,r)*.75;c=vec3(1.,.7,.35);}
  else if(K==12.){float w=sin(uTime*9.+vSeed*20.)*.35;float y=vQ.y+abs(vQ.x)*(.6+w);a=smoothstep(.22,.05,abs(y))*step(abs(vQ.x),.95);c=vec3(.16,.15,.19);}
  a*=vAlpha*uPAlpha;if(a<=0.)discard;o=vec4(c*uTint*a,a);
 }`;
 // sprites: a painted thing from the sheet, a frame of it, with its soft shadow
 const FS_S=`#version 300 es
 precision highp float;in vec2 vPx;out vec4 o;uniform sampler2D uTex;uniform vec4 uCell;uniform vec4 uQuad;uniform vec2 uSheet;uniform vec4 uShadow,uCell2;uniform float uShare,uFlip,uTw;
 void main(){vec2 q=(vPx-uQuad.xy)/uQuad.zw;if(uFlip>.5)q.x=1.-q.x;if(uShadow.a>0.&&q.y>.8){float d=length((q-vec2(.5,.93))*vec2(1.,5.));float a=smoothstep(.5,.1,d)*uShadow.a;o=vec4(uShadow.rgb*a,a)*uShare;}else o=vec4(0);
  if(q.x<0.||q.x>1.||q.y<0.||q.y>.86)return;vec4 c=texture(uTex,(uCell.xy+vec2(q.x,q.y/.86)*uCell.zw)/uSheet);if(uTw>0.)c=mix(c,texture(uTex,(uCell2.xy+vec2(q.x,q.y/.86)*uCell2.zw)/uSheet),uTw);o=c+o*(1.-c.a);o*=uShare;}`;
 // a sprite that turns (live spin / swing about its pivot, then squashed): the quad is the box of the circle its cell sweeps about
 // the pivot, and each pixel is taken back through the turn into the cell (outside it: clear, with a soft edge of one pixel; the
 // sheet read inside the cell's own texels only); its soft shadow stays on the ground, in the quad the sprite has unturned.
 // uTurn: the turn and squash undone, row by row; uPivot: the pivot on the screen (mirrored with the picture when it faces the other
 // way) and where it lies in the cell (px from the cell's top left)
 const FS_ST=`#version 300 es
 precision highp float;in vec2 vPx;out vec4 o;uniform sampler2D uTex;uniform vec4 uCell,uCell2,uQuad,uShadow,uTurn,uPivot;uniform vec2 uSheet;uniform float uShare,uFlip,uTw;
 void main(){vec2 q=(vPx-uQuad.xy)/uQuad.zw;vec4 s=vec4(0);if(uShadow.a>0.&&q.y>.8&&q.y<=1.){float d=length((q-vec2(.5,.93))*vec2(1.,5.));float a=smoothstep(.5,.1,d)*uShadow.a;s=vec4(uShadow.rgb*a,a);}
  vec2 cs=vec2(uQuad.z,uQuad.w*.86),d=vPx-uPivot.xy;if(uFlip>.5)d.x=-d.x;vec2 p=(uPivot.zw+vec2(dot(uTurn.xy,d),dot(uTurn.zw,d)))/cs;
  vec2 e=min(p,1.-p)*cs;float cover=clamp(min(e.x,e.y)+.5,0.,1.);p=clamp(p,0.,1.);
  vec4 c=texture(uTex,clamp(uCell.xy+p*uCell.zw,uCell.xy+.5,uCell.xy+uCell.zw-.5)/uSheet);if(uTw>0.)c=mix(c,texture(uTex,clamp(uCell2.xy+p*uCell2.zw,uCell2.xy+.5,uCell2.xy+uCell2.zw-.5)/uSheet),uTw);
  c*=cover;o=(c+s*(1.-c.a))*uShare;}`;
 // a hit's burst (live hit.burst): specks thrown from the sprite's middle at the hit, one quad each, everything from its seed and
 // the time since the hit (MOTION.burst is the same in numbers): a way within the spread about straight up, out along it slowing
 // (its speed falls by e every third of its life), embers and lanterns rising, the rest settling, fading over the last two
 // thirds of a life of its own; drawn only while a burst is alive
 const VS_B=`#version 300 es
 in vec2 aPos;in float aSeed;uniform vec2 uView,uAt;uniform float uK,uSince,uLife,uSpeed,uSpread,uKind,uShare;
 out vec2 vQ;out float vSeed,vAlpha;out vec2 vDir;
 float h(float n){return fract(sin(n*91.345+7.13)*43758.5453);}
 void main(){
  float s=aSeed,K=uKind,life=uLife*(.55+.45*h(s+2.)),T=life/3.,t=min(uSince,life),a=-1.5707963+(h(s)-.5)*uSpread,v=uSpeed*(.45+.55*h(s+1.)),g=K==7.?-14.:K==11.?-9.:22.;
  vec2 dir=vec2(cos(a),sin(a)),off=dir*v*T*(1.-exp(-t/T))+vec2(0.,g*t*t*.5);
  float sp=v*exp(-t/T),sz=2.5+3.5*h(s+3.),streak=(K==1.||K==2.||K==8.||K==10.)?1.:0.,len=streak>.5?max(1.,sp/60.):1.;
  vec2 q=aPos*2.-1.,o=streak>.5?dir*q.x*sz*len*.5+vec2(-dir.y,dir.x)*q.y*sz*.5:q*sz*(K==6.||K==7.||K==11.?2.6:1.);
  vec2 P=uAt+(off+o)*uK;
  vQ=q;vSeed=s;vDir=dir;vAlpha=(uSince<life?1.-smoothstep(.35,1.,uSince/life):0.)*uShare;
  gl_Position=vec4(P.x/uView.x*2.-1.,1.-P.y/uView.y*2.,0.,1.);
 }`;
 // light shafts: the sky the land lets through, gathered toward the sun (at a quarter of the size), added over the land
 const FS_OCC=`#version 300 es
 precision highp float;in vec2 vPx;out vec4 o;uniform sampler2D uTex;uniform vec2 uView;
 void main(){o=vec4(1.-texture(uTex,vec2(vPx.x/uView.x,1.-vPx.y/uView.y)).a);}`;
 const FS_RAY=`#version 300 es
 precision highp float;in vec2 vPx;out vec4 o;uniform sampler2D uTex;uniform vec2 uView,uSun;uniform float uAmt;uniform vec3 uTint;
 void main(){vec2 uv=vec2(vPx.x/uView.x,1.-vPx.y/uView.y),s=vec2(uSun.x/uView.x,1.-uSun.y/uView.y),d=(s-uv)/20.;float a=0.,w=1.;vec2 p=uv;for(int i=0;i<20;i++){p+=d;a+=(1.-texture(uTex,p).a)*w*step(0.,p.y)*step(p.y,1.);w*=.93;}a/=10.;float here=texture(uTex,uv).a;o=vec4(uTint*a*uAmt*(.35+.65*here),0.);}`;
 // ------------------------------------------------------------------ a sprite's own motions
 // (live spin, swing, pivot, squash, pulse; cleaned by scene-themes.js liveOf). Plain numbers, so the tests can follow them without
 // WebGL. Angles in degrees, + clockwise on the screen; t the painter's time in s (0 while the land rests: Motion off, Still, a
 // page at rest); ph the sprite's own phase (0..1, from its id). spin turns for ever, from 360 x ph; swing rocks like a pendulum,
 // amplitude x sin(2 pi (hz x t + ph)); both may be given (the angles add). The pivot is a fraction of the cell from its left and
 // top (default its middle with spin, its top middle with swing alone); squash [x, y] is laid on after the turn, along the
 // screen's own x and y, about the pivot. pulse [least, most, hz]: the share of light, least + (most - least) x (.5 + .5 sin(2 pi
 // (hz x t + ph))). Facing the other way (face) mirrors the drawn sprite, turn and pivot with it.
 const MOTION=Object.freeze({
  phase:id=>{let h=2166136261;for(const ch of String(id))h=Math.imul(h^ch.charCodeAt(0),16777619);return ((h>>>0)%9973)/9973;},
  turns:sp=>!!(sp&&(sp.spin||sp.swing)),
  angle:(sp,t,ph)=>(sp.spin?sp.spin*t+360*ph:0)+(sp.swing?sp.swing[0]*Math.sin(PI2*(sp.swing[1]*t+ph)):0),
  pivot:sp=>sp.pivot||(sp.spin?[.5,.5]:[.5,0]),
  squash:sp=>sp.squash||[1,1],
  pulse:(sp,t,ph)=>{const p=sp.pulse;return p?p[0]+(p[1]-p[0])*(.5+.5*Math.sin(PI2*(p[2]*t+ph))):1;},
  // how far the cell reaches from its pivot at any angle (the circle through its farthest corner), in the units of w and h
  reach:(w,h,pv)=>Math.hypot(Math.max(pv[0],1-pv[0])*w,Math.max(pv[1],1-pv[1])*h),
  // the cell (its top left x0, y0; w x h px): its pivot on the screen, and the box that holds it at any angle once squashed (a
  // pixel more each way, for its soft edge): [x, y, w, h]
  quad(x0,y0,w,h,pv,sq){const px=x0+pv[0]*w,py=y0+pv[1]*h,r=MOTION.reach(w,h,pv)+1,rx=r*sq[0],ry=r*sq[1];return {pivot:[px,py],box:[px-rx,py-ry,2*rx,2*ry]};},
  // a point of the cell (px from the pivot) to the screen (px from the pivot): squashed after it is turned
  forward(deg,sq,x,y){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [sq[0]*(c*x-s*y),sq[1]*(s*x+c*y)];},
  // and back: the inverse the shader takes (uTurn), row by row, and a point taken back with it
  inverse(deg,sq){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [c/sq[0],s/sq[1],-s/sq[0],c/sq[1]];},
  back:(m,x,y)=>[m[0]*x+m[1]*y,m[2]*x+m[3]*y],
  // a hit (live hit {frame, shake, flash, burst}): the time since the sprite's loop last reached hit.frame, in step with the
  // frame drawn (frame = floor(t x fps + ph x frames) mod frames); -1: it never does (no hit, one frame, fps 0)
  hitSince(sp,t,ph){const h=sp.hit;if(!h||!(sp.fps>0)||!(sp.frames>1))return -1;const n=sp.frames,u=t*sp.fps+ph*n-h.frame;return (((u%n)+n)%n)/sp.fps;},
  // the jolt at that time since (art px, + right and down): quick knocks, the first straight down, under an envelope that is gone
  // after its seconds (or before the loop comes round again: never more often than the loop gives it)
  hitShake(h,since,period){
    const sh=h&&h.shake;
    if(!sh||!(since>=0))return [0,0];
    const T=Math.min(sh[1],period>0?period:Infinity),e=since<T?(1-since/T)**2:0;
    return e?[sh[0]*e*.45*Math.sin(PI2*13*since),sh[0]*e*Math.cos(PI2*9*since)]:[0,0];
  },
  // the flash at that time since: its amount at once, falling back to nothing over its seconds (or the loop)
  hitFlash(h,since,period){const f=h&&h.flash;if(!f||!(since>=0))return 0;const T=Math.min(f[1],period>0?period:Infinity);return since<T?f[0]*(1-since/T)**2:0;},
  // one speck of a burst at that time since, from its four numbers r (0..1, the shader's hashes of its seed): where it is from the
  // burst's place (art px), how fast it goes, how much of it shows, how big it is
  burst(b,since,r){
    const life=b.life*(.55+.45*r[2]),
      T=life/3,
      t=Math.min(since,life),
      a=-Math.PI/2+(r[0]-.5)*b.spread*Math.PI/180,
      v=b.speed*(.45+.55*r[1]),
      g=b.kind==='embers'?-14:b.kind==='lanterns'?-9:22,
      d=v*T*(1-Math.exp(-t/T)),
      x=Math.min(1,Math.max(0,(since/life-.35)/.65));
   return {off:[Math.cos(a)*d,Math.sin(a)*d+g*t*t/2],speed:v*Math.exp(-t/T),alpha:since<life?1-x*x*(3-2*x):0,size:2.5+3.5*r[3],life};}
 });
 // ------------------------------------------------------------------ the painter
 function make(doc,base,opt){
  const canvas=doc.createElement('canvas');canvas.className='tk-paint';canvas.setAttribute('aria-hidden','true');
  let gl=null;
  try{
    gl=canvas.getContext('webgl2',{
      alpha:true,
      premultipliedAlpha:true,
      antialias:false,
      depth:false,
      stencil:false,
      preserveDrawingBuffer:false,
      powerPreference:'default',
      desynchronized:false
    });
  }catch{gl=null;}
  if(!gl)return null;
  const S=global.ReserveSceneThemes,T=S?.travel;if(!T)return null;
  // (every picture through the engine's read: a megapack's store first, then the package)
  const read=S.reader?S.reader(base):global.fetch;
  // (the sky's picture: where the land's sprites carry its clouds (the table's `clear`), the sky WITHOUT them once that picture is in;
  // a megapack from before it has none: then the whole sky as ever, and that megapack's own live file has no drifting clouds)
  const clearName=(s,st)=>s.info?.clear&&s.live&&s.quality>=2?'clear-'+s.land+'-'+st+'.webp':'';
  const skyOf=(s,st)=>{const c=clearName(s,st),t=c?tex.get(c):null;return t?.ready?t:tex.get('page-'+s.land+'-'+st+'.webp');};
  const on=opt.on||{};
  let lost=0,
    dead=false,
    raf=0,
    nap=0,
    ask=0,
    peek=null,
    peekShift=0,
    peekWin=null,
    peekPage=null,
    peekV=0,
    peekK=0,
    peekHit=null,
    hitSet=0,
    seenHit=null,
    lastHit=null,
    scene=null,
    running=false,
    drawn=false,
    firstFull=false,
    seen=null;
  // (what of the frame the dashboard shows now, in the frame's own px: only that is drawn, with a margin; none: nothing is drawn)
  const watch=typeof global.IntersectionObserver==='function'?new global.IntersectionObserver(list=>{
    for(const e of list){const r=e.intersectionRect;seen=e.isIntersecting?{top:r.top,bottom:r.bottom}:{top:0,bottom:0};}
    if(seen.bottom>seen.top)wake();
  },{threshold:[0,.05,.1,.2,.3,.4,.5,.6,.7,.8,.9,.95,1]}):null;
  // (the GPU's own time for a frame, where the browser tells it: the governor weighs it with the page's)
  const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');let queries=[],gpuMs=0;
  const progs={},tex=new Map(),fbos={};let quad=null,pquad=null,seeds=null;
  function compile(vs,fs){
    const p=gl.createProgram();
    for(const [type,src]of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
      const s=gl.createShader(type);
      gl.shaderSource(s,src);
      gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
      gl.attachShader(p,s);
    }
    gl.bindAttribLocation(p,0,'aPos');
    gl.bindAttribLocation(p,1,'aSeed');
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    const u={};
    const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){const info=gl.getActiveUniform(p,i);u[info.name.replace(/\[0\]$/,'')]=gl.getUniformLocation(p,info.name);}
    return {p,u};
  }
  function setup(){
   progs.land=compile(VS,FS);
   progs.copy=compile(VS,FS_COPY);
   progs.half=compile(VS,FS_HALF);
   progs.part=compile(VS_P,FS_P);
   progs.sprite=compile(VS,FS_S);
   try{progs.spriteT=compile(VS,FS_ST);}catch{progs.spriteT=null;}
   try{progs.burst=compile(VS_B,FS_P);}catch{progs.burst=null;}
   hitSet=0;
   progs.occ=compile(VS,FS_OCC);
   progs.ray=compile(VS,FS_RAY);
   progs.glass=compile(VS,FS_GLASS);
   quad=gl.createVertexArray();
   gl.bindVertexArray(quad);
   const b=gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER,b);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
   gl.enableVertexAttribArray(0);
   gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
   pquad=gl.createVertexArray();gl.bindVertexArray(pquad);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
   seeds=gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER,seeds);
   const sd=new Float32Array(1024);
   for(let i=0;i<1024;i++)sd[i]=i*1.618+.37;
   gl.bufferData(gl.ARRAY_BUFFER,sd,gl.STATIC_DRAW);
   gl.enableVertexAttribArray(1);
   gl.vertexAttribPointer(1,1,gl.FLOAT,false,0,0);
   gl.vertexAttribDivisor(1,1);
   gl.bindVertexArray(null);
   const z=gl.createTexture();
   gl.bindTexture(gl.TEXTURE_2D,z);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,0,0]));
   tex.set('',{t:z,w:1,h:1,ready:true});
  }
  // ---- pictures: read once as the extension's own bytes, decoded off the page, uploaded premultiplied with their mipmaps
  function picture(name,{mips=true,xmips=0,data=false,exact=false}={}){
   let t=tex.get(name);if(t)return t;t={t:null,w:0,h:0,ready:false,failed:false,x:[]};tex.set(name,t);
   Promise.resolve().then(()=>read(base+name)).then(r=>{
     if(!r?.ok)throw Error('missing '+name);
     return r.blob();
   }).then(b=>global.createImageBitmap(b,data?{premultiplyAlpha:'none',colorSpaceConversion:'none'}:{premultiplyAlpha:'premultiply',colorSpaceConversion:'default'})).then(bmp=>{
    if(dead||!gl||gl.isContextLost()){bmp.close?.();return;}
    const g=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,g);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bmp);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    if(mips){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_NEAREST);}
    else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    if(exact){gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);}
    t.t=g;t.w=bmp.width;t.h=bmp.height;bmp.close?.();t.ready=true;if(xmips)xmipsOf(t,xmips);wake();
   }).catch(()=>{t.failed=true;wake();});
   return t;
  }
  // (x-wise halvings for the blur: each level the columns halved, the rows kept)
  function xmipsOf(t,levels){
   let src=t.t,w=t.w;const h=t.h,fb=gl.createFramebuffer();gl.bindVertexArray(quad);gl.useProgram(progs.half.p);gl.disable(gl.BLEND);
   for(let i=0;i<levels&&w>8;i++){
     const w2=Math.ceil(w/2),g=gl.createTexture();
     gl.bindTexture(gl.TEXTURE_2D,g);
     gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w2,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
     for(const [k,v]of [[gl.TEXTURE_WRAP_S,gl.REPEAT],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])
       gl.texParameteri(gl.TEXTURE_2D,k,v);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,g,0);
    gl.viewport(0,0,w2,h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,src);
    gl.uniform1i(progs.half.u.uTex,0);
    gl.uniform2f(progs.half.u.uSrc,w,h);
    gl.uniform4f(progs.half.u.uRect,0,0,w2,h);
    gl.uniform2f(progs.half.u.uView,w2,h);
    // (uView flips y: draw with the rows as they are)
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);t.x.push({t:g,w:w2});src=g;w=w2;}
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fb);
  }
  function drop(name){
    const t=tex.get(name);
    if(!t||!name)return;
    tex.delete(name);
    if(gl&&!gl.isContextLost()){if(t.t)gl.deleteTexture(t.t);for(const x of t.x||[])gl.deleteTexture(x.t);}
  }
  // ---- the scene: what is shown (land, hours, places, quality), worked out once per message
  function want(s){
   const names=new Set();const info=s.info||{};
   for(const [stage]of s.hours){const st=info.stages?.[stage]||stage;
    if(s.win)for(let i=0;i<(s.lands?.layers?.length||0);i++)names.add('land-'+s.land+'-'+st+'-'+i+'.webp');
    if(s.page){names.add('page-'+s.land+'-'+st+'.webp');if(clearName(s,st))names.add(clearName(s,st));for(const m of info.move||[])names.add('page-'+s.land+'-'+st+'-'+m[0]+'.webp');}
    if(s.live&&s.quality>=1)for(const n of info.glow?.[st]||[])names.add('glow-'+s.land+'-'+st+'-'+n+'.webp');
    if(s.page&&s.live&&s.quality>=2)
      for(const n of info.lights||[])if(s.live.layers?.find(l=>l.id===n)?.lights){names.add('alt-'+s.land+'-'+st+'-'+n+'.webp');names.add('ids-'+s.land+'-'+st+'-'+n+'.webp');}
    if(s.live&&s.quality>=2&&info.sprites)names.add(info.sprites===2?'sprites-'+s.land+'-'+st+'.webp':'sprites-'+s.land+'.webp');}
   if(s.page)names.add(info.under?'under-'+s.land+'.webp':'under.webp');
   if(s.live)for(const l of s.live.layers)if((l.flowMax>0||l.sway||l.shimmer)&&(!Array.isArray(info.flow)||info.flow.includes(l.id)))names.add('flow-'+s.land+'-'+l.id+'.webp');
   return names;
  }
  function show(s){
   if(dead)return;const names=want(s);
   for(const n of names){
     const blur=/^page-[a-z]+-[a-z]+-([0-9])\.webp$/.exec(n),id=blur?Number(blur[1]):-1,live=s.live?.layers?.find(l=>l.id===id),b=id>=0?(live?live.blur:id===3?1:0):0;
     picture(n,{mips:!/^(flow|ids)-/.test(n),data:/^(flow|ids)-/.test(n),exact:/^ids-/.test(n),xmips:b>0&&s.quality>=1?6:0});
   }
   for(const n of [...tex.keys()])if(n&&!names.has(n))drop(n);
   scene=s;scene.names=names;{const hs=(s.live?.sprites||[]).filter(sp=>sp.hit&&sp.fps>0&&sp.frames>1);scene.hits=hs.length?hs:null;}wake();
  }
  const ready=()=>scene&&(!scene.win||scene.lands)&&[...scene.names].every(n=>{
    const t=tex.get(n);
    return t&&(t.ready||t.failed&&/^(glow|flow|sprites|alt|ids|clear)-/.test(n));
  })&&![...scene.names].some(n=>tex.get(n)?.failed&&!/^(glow|flow|sprites|alt|ids|clear)-/.test(n));
  // ---- the governor: a frame rate and how much is drawn, chosen so frames are never missed
  const G={level:0,fps:60,last:0,times:[],gpu:[],late:[],up:[],since:0,next:0,prev:0,quick:false,ds:[]};
  const due=lv=>1000/Math.min(60,scene?.fps||60)*LEVELS[lv].every;
  const LEVELS=[
    {every:1,parts:1,shafts:1,taps:1,scale:1},
    {every:2,parts:1,shafts:1,taps:1,scale:1},
    {every:2,parts:.5,shafts:0,taps:1,scale:1},
    {every:2,parts:.5,shafts:0,taps:.5,scale:.75},
    {every:3,parts:.25,shafts:0,taps:.5,scale:.6}
  ];
  // (a draw is missed when it comes a whole display frame and at least half a draw's time after its moment: on time it comes within
  // one display frame; on a quick display a draw one display frame late is no visible stumble)
  const tickOf=()=>G.ds.length?Math.max(4,Math.min(...G.ds)):16.7;
  function govern(now,cost,late){
   const iv=G.last?now-G.last:16.7;
   G.last=now;
   G.times.push(iv);
   G.gpu.push(cost);
   const tk=tickOf()-1;
   G.late.push(late>Math.max(tk,due(G.level)*.5)?1:0);
   G.up.push(late>Math.max(tk,due(Math.max(0,G.level-1))*.5)?1:0);
   if(G.times.length>90){G.times.shift();G.gpu.shift();G.late.shift();G.up.shift();}
   if(now-G.since<1500||G.times.length<45)return;
   const missed=G.late.reduce((a,b)=>a+b,0)/G.late.length,
     missedUp=G.up.reduce((a,b)=>a+b,0)/G.up.length,
     work=G.gpu.reduce((a,b)=>a+b,0)/G.gpu.length,
     frame=due(G.level),
     up=G.level>0?due(G.level-1):frame;
   if((missed>.1||work>frame*.6)&&G.level<LEVELS.length-1){G.level++;G.since=now;G.times=[];G.gpu=[];G.late=[];G.up=[];}
   else if(missedUp<.02&&work<up*.25&&G.level>(scene?.floor||0)&&now-G.since>10000){G.level--;G.since=now;G.times=[];G.gpu=[];G.late=[];G.up=[];}
  }
  // ---- one frame
  function frame(now){
   if(dead||!running)return;if(!gl||gl.isContextLost())return;
   const lv=Math.max(G.level,scene?.floor||0),L=LEVELS[lv],gap=due(lv);
   if(seen&&!(seen.bottom>seen.top))return;
   // (the display's own frame time: two frames asked for one after the other)
   if(G.quick&&G.prev){const d=now-G.prev;if(d>3){G.ds.push(d);if(G.ds.length>30)G.ds.shift();}}G.prev=now;G.quick=false;
   // (paced by time: a draw when its moment has come, within 2 ms; behind by more than a draw: start again from now)
   if(now>=G.next-2){
     const late=G.next?now-G.next:0;
     G.next=late>gap||!G.next?now+gap:G.next+gap;
     const t0=global.performance.now();
     let q=null;
     if(timer&&queries.length<4){q=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,q);}
     draw(now,L);
     if(q){gl.endQuery(timer.TIME_ELAPSED_EXT);queries.push(q);}
    while(queries.length&&gl.getQueryParameter(queries[0],gl.QUERY_RESULT_AVAILABLE)){
      const r=gl.getQueryParameter(queries[0],gl.QUERY_RESULT);
      if(!gl.getParameter(timer.GPU_DISJOINT_EXT))gpuMs=gpuMs*.8+r/1e6*.2;
      gl.deleteQuery(queries.shift());
    }
    govern(now,Math.max(global.performance.now()-t0,gpuMs),late);}
   next();
  }
  // (one request at a time: a newer one makes any older one void)
  function askFrame(){const k=++ask;raf=global.requestAnimationFrame(t=>{if(k!==ask)return;raf=0;frame(t);});}
  // (the next display frame is asked for only when the next draw is nearly due: until 3.5 ms before it, a timer)
  function next(){
    if(raf||nap||dead||!running)return;
    const wait=G.next-(global.performance?.now?.()||0)-3.5;
    if(wait>1&&global.setTimeout)nap=global.setTimeout(()=>{nap=0;if(running&&!dead&&!raf)askFrame();},wait);else{G.quick=true;askFrame();}
  }
  function stop(){ask++;if(raf){global.cancelAnimationFrame(raf);raf=0;}if(nap){global.clearTimeout(nap);nap=0;}}
  function wake(){if(dead)return;if(!drawn&&!ready()){return;}if(running){if(!raf&&!nap)askFrame();}else{draw(global.performance?.now?.()||0,LEVELS[0],true);}}
  function size(L){
   const dpr=Math.min(2,global.devicePixelRatio||1)*L.scale,
     w=Math.max(1,Math.round(doc.documentElement.clientWidth*dpr)),
     h=Math.max(1,Math.round(doc.documentElement.clientHeight*dpr));
   if(canvas.width!==w||canvas.height!==h){
     canvas.width=w;
     canvas.height=h;
     for(const k of Object.keys(fbos)){gl.deleteTexture(fbos[k].t);gl.deleteFramebuffer(fbos[k].f);delete fbos[k];}
   }
   return dpr;
  }
  function fbo(key,w,h){
    let f=fbos[key];
    if(f&&f.w===w&&f.h===h)return f;
    if(f){gl.deleteTexture(f.t);gl.deleteFramebuffer(f.f);}
    const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    for(const [k,v]of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])
      gl.texParameteri(gl.TEXTURE_2D,k,v);
    const fb=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    f=fbos[key]={t,f:fb,w,h};
    return f;
  }
  // the journey now (band clock), and what the rail does to a layer
  function journey(now){
    const s=scene,tb=now-(s.epoch||0),route=s.ride?.route;
    const st=route?T.at(route,tb):{v:0,a:0,x:0};
    return {tb,v:s.moving?Math.max(0,st.v):0,x:s.moving?st.x:0,a:s.moving?st.a:0};
  }
  const shakeOf=(j,o)=>{if(!scene.moving||!scene.ride?.probe)return [0,0,0];const p=scene.ride.probe(j.tb,o);return p?.outside||[0,0,0];};
  function layerDraw(p,o){
   const u=progs.land.u,sc=o.scale||1;
   gl.uniform4f(u.uRect,o.rect[0]*sc,o.rect[1]*sc,o.rect[2]*sc,o.rect[3]*sc);
   gl.uniform1f(u.uScale,sc);
   gl.uniform1f(u.uCover,o.cover?1:0);
   {
     const cs=!o.cover&&o.cut?o.cut:[],flat=new Float32Array(24);
     cs.slice(0,6).forEach((c,i)=>flat.set(c,i*4));
     gl.uniform4fv(u.uCut,flat);
     gl.uniform1f(u.uCuts,Math.min(6,cs.length));
     gl.uniform2f(u.uCutEdge,32,40);
   }
   gl.uniform2f(u.uOrigin,o.origin[0],o.origin[1]);
   gl.uniform1f(u.uK,o.k);
   gl.uniform2f(u.uShake,o.shake[0],o.shake[1]);
   gl.uniform3f(u.uTilt,o.tilt[0],o.tilt[1],o.tilt[2]);
   gl.uniform4f(u.uMap,0,0,o.repeat,o.slide);
   gl.uniform2f(u.uStretch,o.stretch[0],o.stretch[1]);
   gl.uniform2f(u.uClip,o.clip[0],o.clip[1]);
   gl.uniform1f(u.uTileRow,o.tileRow);
   const L=o.live||{},fl=o.flow&&tex.get(o.flow)?.ready?tex.get(o.flow):null,gw=o.glow&&tex.get(o.glow)?.ready?tex.get(o.glow):null;
   gl.uniform1f(u.uTime,o.time);
   gl.uniform1f(u.uFlowMax,L.flowMax||0);
   gl.uniform1f(u.uFlowOn,fl&&(L.flowMax>0||L.sway||L.shimmer)?1:0);
   gl.uniform1f(u.uSwayAmp,o.full&&L.sway?L.sway.amp:0);
   gl.uniform1f(u.uSwayHz,L.sway?.hz||.3);
   gl.uniform1f(u.uSwayKind,L.sway?.kind==='water'?1:0);
   const sh=o.full&&L.shimmer&&L.shimmer.stages.includes(o.stage)?L.shimmer:null;
   gl.uniform1f(u.uShimKind,sh?['','heat','glint','twinkle','flicker','lightning'].indexOf(sh.kind):0);
   gl.uniform1f(u.uShimAmt,sh?sh.amount:0);
   gl.uniform1f(u.uGlowOn,gw?1:0);
   gl.uniform1f(u.uBobAmp,L.bob?L.bob.amp:0);
   gl.uniform1f(u.uBobHz,L.bob?.hz||.3);
   gl.uniform3f(u.uRipple,o.full&&L.ripple?L.ripple.amp:0,L.ripple?.hz||.25,L.ripple?.from||0);
   gl.uniform4f(u.uRings,o.full&&L.rings?L.rings.amount:0,L.rings?.from||0,L.rings?.size||30,L.rings?.rate||.5);
   {const f=o.hit||0;if(f!==hitSet){gl.uniform1f(u.uHit,f);hitSet=f;}}
   // the blur: as far as the layer moves on the canvas in a sixtieth of a second, faded in between 1 and 3 screen px a frame of
   // its real motion (the engine's blurOf), then as much of it as the layer takes (4.0.173: a layer that takes half still shows it)
   const mv=o.speedPx*(o.dpr||1)/60,
     bx=o.blur*(T.blur?T.blur(mv,o.dpr||1):(mv>2*(o.dpr||1)?mv:0)),
     xl=p.x?.length?Math.min(p.x.length,Math.max(0,Math.floor(Math.log2(Math.max(1,bx/o.k*(p.w/4096)/8))))):0;
   gl.uniform1f(u.uBlurPx,bx);gl.uniform1f(u.uXLod,0);
   // (the picture's own scale: the mip level just above it, read smoothly, as the browser draws a scaled picture (measured closer than
   // blending two levels))
   const lod=Math.max(0,Math.floor(Math.log2(Math.max(1,(p.w/4096)/o.k))));gl.uniform1f(u.uLod,lod);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,xl>0&&bx>1.5?p.x[xl-1].t:p.t);gl.uniform1i(u.uTex,0);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,fl?fl.t:tex.get('').t);gl.uniform1i(u.uFlow,1);
   gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,gw?gw.t:tex.get('').t);gl.uniform1i(u.uGlow,2);
   // the lights: the picture with every light in its other state and the map of the lights, both in; never under the motion blur
   {const la=o.full&&L.lights&&o.alt&&!(xl>0&&bx>1.5)?tex.get(o.alt):null,li=la?.ready?tex.get(o.ids):null,onL=!!(li?.ready),q=L.lights||{};
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D,onL?la.t:tex.get('').t);
    gl.uniform1i(u.uAlt,3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D,onL?li.t:tex.get('').t);
    gl.uniform1i(u.uIds,4);
    gl.uniform1f(u.uLampOn,onL?1:0);
    if(onL){
      const pr=q.period||[240,1200];
      const at=(v,or)=>typeof v==='number'?v:v&&typeof v==='object'&&typeof v[o.stage]==='number'?v[o.stage]:or;
      gl.uniform4f(u.uLampT,pr[0],pr[1],at(q.on,.1),at(q.off,.2));
      gl.uniform2f(u.uLampS,q.fade||.12,q.stutter===0?0:1);
      gl.uniform2f(u.uLamp,(q.bulbs||[]).includes(o.stage)?1:0,(q.beacons||[]).includes(o.stage)?1:0);
    }}
   if(xl>0&&bx>1.5)gl.uniform1f(u.uLod,0);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  // a sprite that REPLACES its patch of a layer's picture (live sprite `cut`): the patch on the tile (x0, row0, x1, row1), and only
  // while that sprite is being drawn. The layer's shader lets the picture give way inside it (a rim of 32 art px untouched, then a
  // ramp of 40); the sprite's sheet is made for exactly that, so what does not move reads as the still does.
  const inWindow=sp=>sp.at[1]-.663*sp.frame[3]*sp.scale<384;
  function cutOf(s,n,stage,win){
    const live=s.live;
    if(!live||s.quality<2||!s.info?.sprites)return null;
    const sheet=tex.get(s.info.sprites===2?'sprites-'+s.land+'-'+stage+'.webp':'sprites-'+s.land+'.webp');
    if(!sheet?.ready)return null;
   const out=[];
   for(const sp of live.sprites){
     if(!sp.cut||sp.fixed||Math.floor(sp.layer)!==n||!sp.stages.includes(stage))continue;
     if(inWindow(sp)!==!!win)continue;
     const w=sp.frame[2]*sp.scale,h=sp.frame[3]*sp.scale,y0=sp.at[1]-h/.86;
     out.push([sp.at[0]-w/2,y0,sp.at[0]+w/2,y0+h]);
   }
   return out.length?out:null;}
  // particles and sprites of a layer between two layers (fractional), drawn after layer `after`
  function extras(s,j,after,stage,share,region,L,dpr,time){
   const live=s.live;if(!live||s.quality<2)return;
   for(const p of live.particles){if(Math.floor(p.layer)!==after||!p.stages.includes(stage)||!(p.count>0))continue;
    const sp=speedAt(s,p.layer,region),slide=((sp*j.x)%4096+4096)%4096,u=progs.part.u,n=Math.max(1,Math.round(p.count*L.parts*(s.quality>=3?1.5:1)));
    if(region.win&&p.box[1]>260)continue;if(!region.win&&p.box[3]<512)continue;
    gl.useProgram(progs.part.p);gl.bindVertexArray(pquad);
    gl.uniform2f(u.uView,canvas.width,canvas.height);
    gl.uniform1f(u.uK,region.k);
    gl.uniform1f(u.uTime,time);
    gl.uniform1f(u.uFar,j.x);
    gl.uniform1f(u.uV,j.v);
    gl.uniform1f(u.uSlide,slide);
    gl.uniform1f(u.uKind,KINDS.indexOf(p.kind));
    gl.uniform1f(u.uWind,p.wind);
    gl.uniform4f(u.uBox,p.box[0],p.box[1],p.box[2],p.box[3]);
    gl.uniform2f(u.uSize,p.size[0],p.size[1]);
    gl.uniform2f(u.uVel,p.vel[0],p.vel[1]);
    gl.uniform2f(u.uOrigin,region.origin[0],region.origin[1]);
    gl.uniform2f(u.uShake,region.shake[0],region.shake[1]);
    gl.uniform2f(u.uStretch,region.win?-4:0,region.win?260:0);
    gl.uniform1f(u.uWin,region.win?1:0);
    gl.uniform1f(u.uEvery0,p.every?.[0]||4);
    gl.uniform1f(u.uEvery1,p.every?.[1]||11);
    gl.uniform1f(u.uShare,share);
    {const tn=p.tint;gl.uniform3f(u.uTint,tn?tn[0]/255:1,tn?tn[1]/255:1,tn?tn[2]/255:1);gl.uniform1f(u.uPAlpha,p.alpha??1);}
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,Math.min(1024,n));gl.bindVertexArray(quad);
   }
   const sheet=tex.get(s.info?.sprites===2?'sprites-'+s.land+'-'+stage+'.webp':'sprites-'+s.land+'.webp');
   if(sheet?.ready)for(const sp of live.sprites){if(Math.floor(sp.layer)!==after||!sp.stages.includes(stage))continue;if(sp.cut&&inWindow(sp)!==!!region.win)continue;
    // (its own phase: no two sprites beat or bob in step; a box it loops in: faded in and out at the box's edges, so it never pops)
    const v=sp.fixed?0:speedAt(s,sp.layer,region),
      slide=sp.fixed?0:((v*j.x)%4096+4096)%4096,
      pa=sp.path,
      ph=phaseOf(sp.id),
      ff=time*sp.fps+ph*sp.frames,
      ft=Math.floor(ff)%sp.frames,
      tw=sp.tween?ff-Math.floor(ff):0,
      cl=sp.cols>0?sp.cols:sp.frames;
    let x=sp.at[0]+pa.vx*time,y=sp.at[1]+pa.vy*time+pa.bob[0]*Math.sin(PI2*(pa.bob[1]*time+ph)),fade=1;
    if(pa.loop){
      const lw=pa.loop[2]-pa.loop[0],lh=pa.loop[3]-pa.loop[1];
      if(lw>0){x=pa.loop[0]+(((x-pa.loop[0])%lw)+lw)%lw;if(lw<4096)fade=Math.min(fade,edgeIn((x-pa.loop[0])/lw));}
      if(lh>0){y=pa.loop[1]+(((y-pa.loop[1])%lh)+lh)%lh;fade=Math.min(fade,edgeIn((y-pa.loop[1])/lh));}
    }
    const flip=sp.face&&pa.vx!==0&&(pa.vx>0)!==(sp.face==='right')?1:0;if(!(fade>0))continue;
    x=((x-slide)%4096+4096)%4096;const w=sp.frame[2]*sp.scale,h=sp.frame[3]*sp.scale;
    // (live spin, swing, pulse: the turn now, its pivot and squash, how far the turned cell reaches (art px), the share of light)
    const tn=sp.spin||sp.swing?progs.spriteT:null,
      deg=tn?MOTION.angle(sp,time,ph):0,
      pv=tn?MOTION.pivot(sp):null,
      sq=tn?MOTION.squash(sp):null,
      reach=tn?MOTION.reach(w,h,pv)*Math.max(sq[0],sq[1])+2:0,
      pl=sp.pulse?MOTION.pulse(sp,time,ph):1,
      hs=sp.hit&&s.moving?MOTION.hitSince(sp,time,ph):-1;
    for(const wrap of [0,-4096,4096]){
     // a turned sprite: the quad that holds its cell at any angle; culled only when even that cannot show
     if(tn){const k=region.k,cw=w*k,ch=h*k,qw=cw,qh=ch/.86;let sx,sy;
      if(region.win){sx=region.origin[0]+(x+wrap)*k+region.shake[0];sy=region.origin[1]+(-4+y*264/256)*k+region.shake[1];if(y-h/.86-reach>260)continue;}
      else{sx=region.origin[0]+(x+wrap)*k+region.shake[0];sy=region.origin[1]+(y-512)*k+region.shake[1];if(y+reach<512)continue;}
      const tq=MOTION.quad(sx-qw/2,sy-qh,cw,ch,pv,sq),pd=flip?2*sx-tq.pivot[0]:tq.pivot[0],py=tq.pivot[1],rx=tq.box[2]/2,ry=tq.box[3]/2;let b0=pd-rx,b1=py-ry,b2=pd+rx,b3=py+ry;
      if(sp.shadow&&sp.shadow[3]>0){b0=Math.min(b0,sx-qw/2);b1=Math.min(b1,sy-qh);b2=Math.max(b2,sx+qw/2);b3=Math.max(b3,sy);}
      if(b2<0||b0>canvas.width)continue;const u=tn.u;gl.useProgram(tn.p);
      gl.uniform4f(u.uRect,b0,b1,b2-b0,b3-b1);
      gl.uniform2f(u.uView,canvas.width,canvas.height);
      gl.uniform4f(u.uQuad,sx-qw/2,sy-qh,qw,qh);
      gl.uniform4f(u.uCell,sp.frame[0]+(ft%cl)*sp.frame[2],sp.frame[1]+Math.floor(ft/cl)*sp.frame[3],sp.frame[2],sp.frame[3]);
      gl.uniform2f(u.uSheet,sheet.w,sheet.h);
      gl.uniform4f(u.uShadow,sp.shadow?sp.shadow[0]/255:0,sp.shadow?sp.shadow[1]/255:0,sp.shadow?sp.shadow[2]/255:0,sp.shadow?sp.shadow[3]:0);
      gl.uniform1f(u.uShare,share*fade*pl);
      gl.uniform1f(u.uFlip,flip);
      {
        const f2=(ft+1)%sp.frames;
        gl.uniform4f(u.uCell2,sp.frame[0]+(f2%cl)*sp.frame[2],sp.frame[1]+Math.floor(f2/cl)*sp.frame[3],sp.frame[2],sp.frame[3]);
        gl.uniform1f(u.uTw,tw);
      }
      {const m=MOTION.inverse(deg,sq);gl.uniform4f(u.uTurn,m[0],m[1],m[2],m[3]);gl.uniform4f(u.uPivot,pd,py,pv[0]*cw,pv[1]*ch);}
      if(peek&&share>.5){
        const d=canvas.width/Math.max(1,doc.documentElement.clientWidth);
        peek.push({
          id:sp.id,
          frame:ft,
          x:(sx-qw/2)/d,
          y:(sy-qh)/d,
          w:qw/d,
          h:qh/d,
          win:!!region.win,
          fade:Math.round(fade*100)/100,
          turn:Math.round(deg*100)/100,
          pulse:Math.round(pl*1000)/1000,
          pivot:[pd/d,py/d],
          box:[b0/d,b1/d,(b2-b0)/d,(b3-b1)/d]
        });
      }
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sheet.t);gl.uniform1i(u.uTex,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      if(sp.hit){seenHit?.add(sp.id);if(hs>=0&&sp.hit.burst&&hs<sp.hit.burst.life)burstDraw(sp.hit.burst,hs,[sx-pa.vx*hs*k,sy-qh+qh*.43-pa.vy*hs*k],k,share*fade,L,time);}
      continue;
     }
     let sx,sy;
     if(region.win){sx=region.origin[0]+(x+wrap)*region.k+region.shake[0];sy=region.origin[1]+(-4+y*264/256)*region.k+region.shake[1];if(y-h/.86>260)continue;}
     else{sx=region.origin[0]+(x+wrap)*region.k+region.shake[0];sy=region.origin[1]+(y-512)*region.k+region.shake[1];if(y<512-h)continue;}
     const qw=w*region.k,qh=h*region.k/.86;if(sx+qw<0||sx-qw>canvas.width)continue;const u=progs.sprite.u;gl.useProgram(progs.sprite.p);
     gl.uniform4f(u.uRect,sx-qw/2,sy-qh,qw,qh);
     gl.uniform2f(u.uView,canvas.width,canvas.height);
     gl.uniform4f(u.uQuad,sx-qw/2,sy-qh,qw,qh);
     gl.uniform4f(u.uCell,sp.frame[0]+(ft%cl)*sp.frame[2],sp.frame[1]+Math.floor(ft/cl)*sp.frame[3],sp.frame[2],sp.frame[3]);
     gl.uniform2f(u.uSheet,sheet.w,sheet.h);
     gl.uniform4f(u.uShadow,sp.shadow?sp.shadow[0]/255:0,sp.shadow?sp.shadow[1]/255:0,sp.shadow?sp.shadow[2]/255:0,sp.shadow?sp.shadow[3]:0);
     gl.uniform1f(u.uShare,share*fade*pl);
     gl.uniform1f(u.uFlip,flip);
     {
       const f2=(ft+1)%sp.frames;
       gl.uniform4f(u.uCell2,sp.frame[0]+(f2%cl)*sp.frame[2],sp.frame[1]+Math.floor(f2/cl)*sp.frame[3],sp.frame[2],sp.frame[3]);
       gl.uniform1f(u.uTw,tw);
     }
     if(peek&&share>.5){
       const d=canvas.width/Math.max(1,doc.documentElement.clientWidth);
       peek.push({id:sp.id,frame:ft,x:(sx-qw/2)/d,y:(sy-qh)/d,w:qw/d,h:qh/d,win:!!region.win,fade:Math.round(fade*100)/100,...(sp.pulse?{pulse:Math.round(pl*1000)/1000}:{})});
     }
     gl.activeTexture(gl.TEXTURE0);
     gl.bindTexture(gl.TEXTURE_2D,sheet.t);
     gl.uniform1i(u.uTex,0);
     gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      if(sp.hit){
        seenHit?.add(sp.id);
        if(hs>=0&&sp.hit.burst&&hs<sp.hit.burst.life)burstDraw(sp.hit.burst,hs,[sx-pa.vx*hs*region.k,sy-qh+qh*.43-pa.vy*hs*region.k],region.k,share*fade,L,time);
      }
      }       // (tween: this frame and the next mixed by the share of the time, in one draw: laid one over the other, what is half clear grew thicker between frames; cols: the sheet's frames in rows)
   }
   gl.useProgram(progs.land.p);
  }
  // a hit's burst: its specks at the time since the hit, from the place on the canvas it was thrown (px), k canvas px per art px
  function burstDraw(b,since,at,k,share,L,time){
    const P=progs.burst;
    if(!P)return;
    const u=P.u,n=Math.min(120,Math.max(1,Math.round(b.count*L.parts)));
    gl.useProgram(P.p);
    gl.bindVertexArray(pquad);
   gl.uniform2f(u.uView,canvas.width,canvas.height);
   gl.uniform2f(u.uAt,at[0],at[1]);
   gl.uniform1f(u.uK,k);
   gl.uniform1f(u.uSince,since);
   gl.uniform1f(u.uLife,b.life);
   gl.uniform1f(u.uSpeed,b.speed);
   gl.uniform1f(u.uSpread,b.spread*Math.PI/180);
   gl.uniform1f(u.uKind,KINDS.indexOf(b.kind));
   gl.uniform1f(u.uShare,share);
   gl.uniform1f(u.uTime,time);
   gl.uniform1f(u.uPAlpha,1);
   gl.uniform3f(u.uTint,1,1,1);
   gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,n);gl.bindVertexArray(quad);}
  const NO_HIT=Object.freeze([0,0]);
  // (a sprite's own phase, from its id; the fade over the first and last 8 % of a loop box)
  const phases=new Map(),phaseOf=id=>{let p=phases.get(id);if(p===undefined){p=MOTION.phase(id);phases.set(id,p);}return p;};
  const edgeIn=f=>{const e=Math.min(f,1-f)/.08;return e>=1?1:e<=0?0:e*e*(3-2*e);};
  // a layer's speed (art px a second at the land's own pace) for a fractional layer: between its two neighbours
  function speedAt(s,layer,region){
   const list=region.win?(s.lands?.layers||[]).map((l,i)=>[i,l.still?0:l.speed]):[[0,0],...(s.info?.move||[]).map(m=>[m[0],m[1]])];
   const a=Math.floor(layer),f=layer-a,lo=list.find(m=>m[0]===a)?.[1]??0,hi=list.find(m=>m[0]===a+1)?.[1]??lo;return lo+(hi-lo)*f;
  }
  function draw(now,L,once){
   if(peek)peek.length=0;
   // (the first frame waits for every picture; after it an hour still being read is left out until it is in, so nothing stands still meanwhile)
   const s=scene;if(!s||!gl||gl.isContextLost()||!drawn&&!ready())return;
   const dpr=size(L),W=canvas.width,H=canvas.height,j=journey(now),time=s.moving?now/1000:0,full=s.quality>=2;
   gl.viewport(0,0,W,H);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.SCISSOR_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
   // (only the part the dashboard shows, and a margin of a sixth of the frame either way)
   if(seen&&!once){
     const m=(seen.bottom-seen.top)/6+40,y0=Math.max(0,Math.floor((seen.top-m)*dpr)),y1=Math.min(H,Math.ceil((seen.bottom+m)*dpr));
     if(y1>y0&&(y0>0||y1<H)){gl.enable(gl.SCISSOR_TEST);gl.scissor(0,H-y1,W,y1-y0);}
   }
   gl.bindVertexArray(quad);
   const info=s.info||{},hours=s.hours,covers=[];
   // (a sprite's hit: its loop reaching the hit's frame jolts the whole land and flashes it, only while the land moves and only
   // for a sprite that was drawn in the frame before (in view, in an hour it shows in); none: nothing of this runs)
   let hitS=NO_HIT,hitF=0;
   if(s.hits){lastHit=seenHit;seenHit=new Set();if(peek)peekHit=[];
    if(s.moving&&lastHit)
      for(const sp of s.hits){
        if(!lastHit.has(sp.id))continue;
        let w=0;
        for(const [stage,share]of hours)if(sp.stages.includes(info.stages?.[stage]||stage))w=Math.max(w,share);
        if(!(w>0))continue;
     const ph=phaseOf(sp.id),
       since=MOTION.hitSince(sp,time,ph),
       period=sp.frames/sp.fps,
       sh=MOTION.hitShake(sp.hit,since,period),
       fl=MOTION.hitFlash(sp.hit,since,period);
     if(hitS===NO_HIT)hitS=[0,0];hitS[0]+=sh[0]*w;hitS[1]+=sh[1]*w;hitF+=fl*w;
     if(peek)
       peekHit.push({
         id:sp.id,
         frame:Math.floor(time*sp.fps+ph*sp.frames)%sp.frames,
         since:Math.round(since*1000)/1000,
         shake:[Math.round(sh[0]*100)/100,Math.round(sh[1]*100)/100],
         flash:Math.round(fl*1000)/1000,
         burst:sp.hit.burst&&since<sp.hit.burst.life?sp.hit.burst.count:0
       });}
    hitF=Math.min(1.5,hitF);}
   else if(peek)peekHit=null;
   hours.forEach(([stage,share],h)=>{
    const st=info.stages?.[stage]||stage,
      second=h>0&&share<1,
      base=[
        ...(s.page?['page-'+s.land+'-'+st+'.webp',...(info.move||[]).map(m=>'page-'+s.land+'-'+st+'-'+m[0]+'.webp')]:[]),
        ...(s.win?(s.lands?.layers||[]).map((l,i)=>'land-'+s.land+'-'+st+'-'+i+'.webp'):[])
      ];
    if(!base.every(n=>tex.get(n)?.ready))return;
    if(second){
      const f=fbo('stage',W,H);
      gl.bindFramebuffer(gl.FRAMEBUFFER,f.f);
      gl.viewport(0,0,W,H);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if(seen&&!once&&W)gl.enable(gl.SCISSOR_TEST);
    }
    gl.useProgram(progs.land.p);gl.uniform2f(progs.land.u.uView,W,H);
    // the window: the band's own picture place and scale; the land rides against the window as one; the rows drawn 264 over 256
    if(s.win&&s.lands){
     const k=s.k*dpr,o=shakeOf(j,{amp:1.7,near:0,depth:.6,surge:T.bounds?.surge??11,turn:false});
     if(peek){peekShift=o[0];peekWin=[o[0],o[1]];peekV=j.v;peekK=s.k;}
     const _o=o,origin=[s.win.x*dpr,s.win.y*dpr],shake=[(o[0]+hitS[0])*k,(o[1]+hitS[1])*k],region={win:true,k,origin,shake};
     s.lands.layers.forEach((l,i)=>{
       const p=tex.get('land-'+s.land+'-'+st+'-'+i+'.webp');
       if(!p?.ready)return;
       const sp=l.still?0:l.speed,turn=l.turn>0?l.turn:4095,id=Number.isInteger(l.n)?l.n:i,live=s.live?.layers?.find(q=>q.id===id);
      layerDraw(p,{
        rect:[origin[0]-8,origin[1],4096*k+16,256*k],
        origin,
        k,
        shake,
        tilt:[0,0,0],
        repeat:l.still?0:turn,
        slide:l.still?0:((sp*j.x)%turn+turn)%turn,
        stretch:[-4,260],
        clip:[0,256],
        tileRow:0,
        cut:cutOf(s,id,st,true),
        live,
        flow:live?'flow-'+s.land+'-'+id+'.webp':'',
        glow:info.glow?.[st]?.includes(id)?'glow-'+s.land+'-'+st+'-'+id+'.webp':'',
        time,
        full,
        stage:st,
        blur:0,
        speedPx:sp*j.v*k/dpr,
        dpr,
        hit:hitF
      });
      extras(s,j,id,st,1,region,L,dpr,time);});
     // rain on the glass (a land where it rains, live.glass): after the land in the window, under the cabin's picture
     const gr=s.live?.glass;
     if(gr&&gr.stages.includes(st)&&s.quality>=1&&progs.glass){
       gl.useProgram(progs.glass.p);
       gl.bindVertexArray(quad);
       const u=progs.glass.u,tint=st==='night'||st==='dusk'?[1,.9,.74]:st==='sunset'?[1,.93,.84]:[.95,.98,1];
       gl.uniform4f(u.uRect,origin[0]-8,origin[1],4096*k+16,256*k);
       gl.uniform2f(u.uView,W,H);
       gl.uniform2f(u.uOrigin,origin[0],origin[1]);
       gl.uniform1f(u.uK,k);
       gl.uniform1f(u.uTime,time);
       gl.uniform1f(u.uAmt,gr.amount);
       gl.uniform1f(u.uV,s.moving?j.v:0);
       gl.uniform3f(u.uTint,tint[0],tint[1],tint[2]);
       gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
       gl.useProgram(progs.land.p);
     }
    }
    // under the room: the sky and every layer that travels, one rigid world (one displacement for all, as in the window), the
    // carriage's underside lying over them
    if(s.page){
     const k=s.k*dpr,top=s.page.top*dpr,origin=[s.page.x*dpr,top],sky=skyOf(s,st);
     const po=shakeOf(j,{amp:1.7*s.k,near:0,depth:1,turn:false}),pshake=[(po[0]+hitS[0]*s.k)*dpr,(po[1]+hitS[1]*s.k)*dpr];if(peek)peekPage=[po[0]/s.k,po[1]/s.k];
     const fullW=4096*k,high=Math.ceil(fullW*1738/4096);
     if(sky?.ready)
       layerDraw(sky,{
         rect:[0,top,W,high],
         origin,
         k,
         shake:pshake,
         tilt:[0,0,0],
         repeat:0,
         slide:0,
         stretch:[0,1738],
         clip:[0,1738],
         tileRow:512,
         live:s.live?.layers?.find(q=>q.id===0),
         flow:s.live?.layers?.some(q=>q.id===0)?'flow-'+s.land+'-0.webp':'',
         glow:info.glow?.[st]?.includes(0)?'glow-'+s.land+'-'+st+'-0.webp':'',
         time,
         full,
         stage:st,
         blur:0,
         speedPx:0,
         dpr,
         hit:hitF
       });
     extras(s,j,0,st,1,{win:false,k,origin,shake:pshake},L,dpr,time);
     for(const [n,speed]of info.move||[]){const p=tex.get('page-'+s.land+'-'+st+'-'+n+'.webp');if(!p?.ready)continue;const live=s.live?.layers?.find(q=>q.id===n);
      const shake=pshake,tilt=[0,W/2,top],blur=live?live.blur:n===3?1:0;
      if(!h)
        covers.push([
          p,
          {
            rect:[0,top-12*dpr,W,high+24*dpr],
            origin,
            k,
            shake,
            tilt,
            repeat:4096,
            slide:((speed*j.x)%4096+4096)%4096,
            stretch:[0,1738],
            clip:[0,1738],
            tileRow:512,
            live:null,
            flow:'',
            glow:'',
            time,
            full:false,
            stage:st,
            blur:0,
            speedPx:0,
            dpr,
            cover:true
          }
        ]);
      layerDraw(p,{
        rect:[0,top-12*dpr,W,high+24*dpr],
        origin,
        k,
        shake,
        tilt,
        repeat:4096,
        slide:((speed*j.x)%4096+4096)%4096,
        stretch:[0,1738],
        clip:[0,1738],
        tileRow:512,
        cut:cutOf(s,n,st),
        live,
        alt:live?.lights&&info.lights?.includes(n)?'alt-'+s.land+'-'+st+'-'+n+'.webp':'',
        ids:'ids-'+s.land+'-'+st+'-'+n+'.webp',
        flow:live?'flow-'+s.land+'-'+n+'.webp':'',
        glow:info.glow?.[st]?.includes(n)?'glow-'+s.land+'-'+st+'-'+n+'.webp':'',
        time,
        full,
        stage:st,
        blur:full||s.quality>=1?blur*L.taps:0,
        speedPx:speed*j.v*s.k,
        dpr,
        hit:hitF
      });
      extras(s,j,n,st,1,{win:false,k,origin,shake},L,dpr,time);}
     // the underside: the cabin's, so it neither travels nor shakes
     const under=tex.get(info.under?'under-'+s.land+'.webp':'under.webp'),row=Math.max(0,STAGES.indexOf(st));
     if(under?.ready)
       layerDraw(under,{
         rect:[0,top,W,Math.ceil(172*k)],
         origin,
         k,
         shake:[0,0],
         tilt:[0,0,0],
         repeat:0,
         slide:0,
         stretch:[-row*180,-row*180+900],
         clip:[0,172],
         tileRow:-9999,
         live:null,
         flow:'',
         glow:'',
         time,
         full:false,
         stage:st,
         blur:0,
         speedPx:0,
         dpr
       });
    }
    if(second){
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.viewport(0,0,W,H);
      if(seen&&!once)gl.enable(gl.SCISSOR_TEST);
      gl.useProgram(progs.copy.p);
      const u=progs.copy.u;
      gl.uniform4f(u.uRect,0,0,W,H);
      gl.uniform2f(u.uView,W,H);
      gl.uniform1f(u.uShare,share);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,fbos.stage.t);
      gl.uniform1i(u.uTex,0);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
   });
   // light shafts (Extra high and High, the hours the land names): the sky the land lets through, gathered toward the sun
   const sf=s.live?.shafts;if(sf&&s.quality>=2&&L.shafts&&s.page&&hours.some(([st])=>sf.stages.includes(st)))shafts(s,sf,W,H,dpr,hours,covers);
   if(!drawn){drawn=true;on.painting?.(true);}
  }
  function shafts(s,sf,W,H,dpr,hours,covers){
   const w=Math.max(1,W>>2),h=Math.max(1,H>>2),occ=fbo('occ',w,h);
   // (what the land keeps from the sky: its layers' cover drawn at a quarter of the size; the rays gather the sky between)
   gl.bindFramebuffer(gl.FRAMEBUFFER,occ.f);
   gl.viewport(0,0,w,h);
   gl.disable(gl.SCISSOR_TEST);
   gl.clearColor(0,0,0,0);
   gl.clear(gl.COLOR_BUFFER_BIT);
   gl.enable(gl.BLEND);
   gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   gl.useProgram(progs.land.p);gl.uniform2f(progs.land.u.uView,w,h);for(const [p,o]of covers)layerDraw(p,{...o,scale:.25});
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.useProgram(progs.ray.p);let u=progs.ray.u;
   const k=s.k*dpr,sun=[s.page.x*dpr+sf.from[0]*4096*k,s.page.top*dpr+sf.from[1]*1738*k],warm=hours[0][0]==='sunset'?[1,.62,.32]:hours[0][0]==='morning'?[1,.86,.62]:[1,.95,.82];
   gl.uniform4f(u.uRect,0,s.page.top*dpr,W,H-s.page.top*dpr);
   gl.uniform2f(u.uView,W,H);
   gl.uniform2f(u.uSun,sun[0],sun[1]);
   gl.uniform1f(u.uAmt,sf.amount);
   gl.uniform3f(u.uTint,warm[0],warm[1],warm[2]);
   gl.activeTexture(gl.TEXTURE0);
   gl.bindTexture(gl.TEXTURE_2D,occ.t);
   gl.uniform1i(u.uTex,0);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  }
  // ---- losing the context: try once more; lost twice, the land is laid as before
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault();
    lost++;
    running=false;
    stop();
    drawn=false;
    for(const t of tex.values())t.ready=false;
    tex.clear();
    on.painting?.(false);
    if(lost>=2)on.fail?.();
  });
  canvas.addEventListener('webglcontextrestored',()=>{if(lost>=2||dead)return;try{setup();if(scene)show(scene);}catch{on.fail?.();}});
  try{setup();}catch{return null;}
  watch?.observe(canvas);
  return {canvas,show,
   // moving: the land goes on (rAF), or it rests where the journey stands (one frame, then nothing)
   run(on){
     on=!!on;
     if(on===running)return;
     running=on;
     if(on){G.last=0;G.times=[];G.gpu=[];G.late=[];G.up=[];G.next=0;G.prev=0;G.quick=false;if(!raf&&!nap&&ready())askFrame();}
     else{stop();if(ready())draw(global.performance.now(),LEVELS[0],true);}
   },
   get stats(){
     return {
       level:Math.max(G.level,scene?.floor||0),
       fps:G.times.length?1000/(G.times.reduce((a,b)=>a+b,0)/G.times.length):0,
       work:G.gpu.length?G.gpu.reduce((a,b)=>a+b,0)/G.gpu.length:0,
       gpu:gpuMs,
       timer:!!timer,
       drawn,
       lost,
       textures:tex.size,
       canvas:[canvas.width,canvas.height],
       seen,
       ...(peek?{sprites:peek.slice(),shift:peekShift,win:peekWin,page:peekPage,v:peekV,k:peekK,...(peekHit?{hit:peekHit.slice()}:{})}:{})
     };
   },
   look(on){peek=on?peek||[]:null;},
   get drawn(){return drawn;},
   lose(){gl.getExtension('WEBGL_lose_context')?.loseContext();},
   destroy(){dead=true;running=false;watch?.disconnect();stop();for(const n of [...tex.keys()])drop(n);canvas.remove();}};
 }
 global.ReserveTrainPainter={make,kinds:KINDS,motion:MOTION};
})(globalThis);
