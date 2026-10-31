/* Review deck drawings: the reading room the full-screen deck lives in, and the card boxes, index cards, piles,
   seals and tags the deck is made of. One hand for all of it: wobbly ink, colour washes set a little off the
   line, hatching, shadows as offset washes. Colours are classes that review-deck.css maps to each theme, so one
   drawing serves light, night, the four scenes and Market kits. Drawn at runtime from fixed seeds, so it is the
   same picture every time. Nothing here reads Canvas or the deck. Creator: Flzsh. */
(function(root){
 'use strict';
 let sv=1;
 const seed=v=>{sv=Math.abs(Math.floor(v))%2147483646+1;},rnd=()=>(sv=sv*16807%2147483647)/2147483647;
 const J=a=>(rnd()*2-1)*a,R=(a,b)=>a+rnd()*(b-a),I=(a,b)=>Math.floor(a+rnd()*(b-a+1)),f=v=>Math.round(v*10)/10;
 const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 // A hand line: each run bows a little between its points.
 function hl(p,j=.6){
   let d='M'+f(p[0][0]+J(j))+' '+f(p[0][1]+J(j));
   for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];d+='Q'+f((a[0]+b[0])/2+J(j*1.5))+' '+f((a[1]+b[1])/2+J(j*1.5))+' '+f(b[0]+J(j))+' '+f(b[1]+J(j));}
   return d;
 }
 // A smooth hand curve through points, for leaves, clouds and cloth.
 function cv(p,closed=false,j=0){
  const q=p.map(([x,y])=>[x+J(j),y+J(j)]),n=q.length,at=i=>closed?q[(i+n)%n]:q[Math.max(0,Math.min(n-1,i))];let d='M'+f(q[0][0])+' '+f(q[0][1]);
  for(let i=0;i<(closed?n:n-1);i++){
    const a=at(i-1),b=at(i),c=at(i+1),e=at(i+2);
    d+='C'+f(b[0]+(c[0]-a[0])/6)+' '+f(b[1]+(c[1]-a[1])/6)+' '+f(c[0]-(e[0]-b[0])/6)+' '+f(c[1]-(e[1]-b[1])/6)+' '+f(c[0])+' '+f(c[1]);
  }
  return closed?d+'Z':d;
 }
 // Long edges are split so a long line wanders instead of bowing once.
 function split(p,step,closed){
   if(!step)return p;
   const out=[],n=closed?p.length:p.length-1;
   for(let i=0;i<n;i++){const a=p[i],b=p[(i+1)%p.length],k=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let t=0;t<k;t++)out.push(lerp(a,b,t/k));}
   if(!closed)out.push(p[p.length-1]);
   return out;
 }
 const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
 const off=(p,dx,dy)=>p.map(([x,y])=>[x+dx,y+dy]);
 const over=p=>{const L=Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1])||1;return [...p,p[0],lerp(p[0],p[1],Math.min(.5,5/L))];};
 const oval=(cx,cy,rx,ry,n=12,j=0,a0=0)=>Array.from({length:n},(_,i)=>{const a=a0+i/n*Math.PI*2;return [cx+Math.cos(a)*rx+J(j),cy+Math.sin(a)*ry+J(j)];});
 const rot=(p,cx,cy,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return p.map(([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c]);};
 // A drawn shape: the wash set off the line, then the line, open, running a few units past its start.
 function S(cls,p,o={}){
  const {j=.6,k='k',dx=1.2,dy=1.4,step=80,smooth=false}=o,q=smooth?p:split(p,step,true);
  const fill=cls?`<path class="${cls}" d="${smooth?cv(off(q,dx,dy),true,j*.3):hl([...off(q,dx,dy),[q[0][0]+dx,q[0][1]+dy]],j*.5)+'Z'}"/>`:'';
  return fill+(k?`<path class="${k}" d="${smooth?cv(over(q),false,j*.5):hl(over(q),j)}"/>`:'');
 }
 const L=(p,k='k',j=.6)=>`<path class="${k}" d="${hl(p,j)}"/>`;
 const C=(p,k='k',j=0)=>`<path class="${k}" d="${cv(p,false,j)}"/>`;
 const F=(cls,p,j=.4)=>`<path class="${cls}" d="${hl([...p,p[0]],j)}Z"/>`;
 const hatch=(x,y,s=7,n=3,k='kf')=>{let g='';for(let i=0;i<n;i++)g+=L([[x+i*s*.6,y+s],[x+i*s*.6+s*.75,y]],k,.25);return g;};
 const G=(cls,body)=>`<g class="${cls}">${body}</g>`;
 const leaf=(x,y,deg,len,wid,cls='lf',k='k')=>{
   const p=rot([[x,y],[x+len*.35,y-wid/2],[x+len*.8,y-wid*.3],[x+len,y],[x+len*.8,y+wid*.3],[x+len*.35,y+wid/2]],x,y,deg);
   return S(cls,p,{smooth:true,k,dx:.8,dy:1})+L(rot([[x+len*.1,y],[x+len*.85,y]],x,y,deg),'kf',.2);
 };
 const heart=(x,y,deg,s,cls)=>{
   const p=rot([[x,y],[x-s*.55,y-s*.45],[x-s*.5,y-s*.95],[x,y-s*.75],[x+s*.5,y-s*.95],[x+s*.55,y-s*.45]].map(([a,b])=>[a,b]),x,y,deg);
   return S(cls,[p[0],p[1],p[2],p[3],p[4],p[5]],{smooth:true,k:'k',dx:.8,dy:.9})+L(rot([[x,y],[x,y-s*.7]],x,y,deg),'kf',.2);
 };
 const starPts=(cx,cy,r,ri=.45,n=5)=>Array.from({length:n*2},(_,i)=>{const a=-Math.PI/2+i*Math.PI/n,rr=i%2?r*ri:r;return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr];});
 const pos=(x,y,w,h)=>`left:${f(x/16)}%;top:${f(y/10)}%;width:${f(w/16)}%;height:${f(h/10)}%`;
 const svg=(x,y,w,h,body,cls='')=>`<svg class="rv-art${cls?' '+cls:''}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="none" focusable="false">${body}</svg>`;

 // World: 1600 x 1000. The table's back edge, its front edge, the apron's foot and the wall's foot.
 const W=1600,H=1000,TT=640,TF=712,TE=728,AP=842,FL=880;
 // BL: how far left the wall and floor run past the frame; TL: the long table's far end. Seen only in wide rooms.
 const BL=-1600,TL=-900;
 const GEO=Object.freeze({W,H,TT,TF,FL,view:[850,64,320,526],cab:[40,116,306,524],shelf:[1318,68,274,572],lamp:[1372,520,160,190],book:[1250,666,200,46],cup:[1486,640,96,70],port:[860,180,300,300]});

 /* ---------- the back wall, the floor and the rug (static, far behind) ---------- */
 // The wall, the floor and the rug run on to the left of the frame (BL): a wide room shows more of the room there.
 function wall(){
  seed(101);let s=`<path class="wl" d="M${BL} -20H1620V${FL+6}H${BL}Z"/>`;
  s+=F('ww',[...split([[BL,-20],[1620,-20],[1620,34]],140,false),[1180,46],[700,40],[260,52],[-300,44],[-900,50],[-1300,42],[BL,48]],2);
  s+=F('ww o5',[[1590,40],[1620,40],[1620,FL],[1596,FL]],1);
  // plaster: a few hairlines and two patches where the wall was mended
  for(const [x,y] of [[470,140],[640,300],[1240,220],[720,470],[260,380],[-420,176],[-760,420],[-1180,260],[-560,470]])s+=L([[x,y],[x+R(8,18),y+R(6,14)],[x+R(14,30),y+R(14,26)]],'kf',.4);
  s+=F('ww o4',[[560,180],[640,172],[652,226],[574,234]],1.5)+F('ww o4',[[-700,300],[-646,294],[-640,336],[-694,342]],1.2);
  // picture rail and its shadow
  s+=S('sd o3',rect(BL,61,1620-BL,4),{k:'',step:0})+S('tr',rect(BL,50,1620-BL,10),{step:160})+L(split([[BL,54],[1620,54]],400,false),'kf',.5);
  // chair rail, wainscot panels and baseboard
  s+=S('sd o3',rect(BL,545,1620-BL,5),{k:'',step:0})+S('tr',rect(BL,532,1620-BL,13),{step:160})+L(split([[BL,537],[1620,537]],400,false),'kf',.5);
  for(let x=8-198*8;x<1600;x+=198){
    s+=S('pn',rect(x+12,556,172,284),{step:90,k:'kf'})+L([[x+20,564],[x+176,564]],'kh',.4)+L([[x+20,564],[x+20,832]],'kh',.4)+L([[x+176,566],[x+176,832]],'kf',.4)+hatch(x+150,812,8);
  }
  s+=S('tr',rect(BL,846,1620-BL,34),{step:160})+L(split([[BL,852],[1620,852]],400,false),'kh',.4)+S('sd o3',rect(BL,878,1620-BL,3),{k:'',step:0});
  // floorboards with staggered joints and grain, then the rug, a long runner under the long table
  s+=`<path class="fl" d="M${BL} ${FL}H1620V1020H${BL}Z"/>`;
  [896,916,941,972].forEach((y,i)=>{
    s+=L(split([[BL,y],[1620,y]],200,false),'kf',.5);
    for(let x=BL+60+i*97%180;x<1600;x+=I(200,330))s+=L([[x,y-(i?[20,25,31,34][i]:16)+2],[x,y-1]],'kf',.3);
    for(let n=0;n<12;n++){const gx=R(BL,1580),gy=y-R(4,12);s+=L([[gx,gy],[gx+R(20,60),gy+J(1.2)]],'kg',.3);}
  });
  const rug=[[-640,906],[1450,906],[1530,1006],[-720,1006]];
  s+=S('rg',rug,{step:140});
  s+=L(split([[-620,914],[1430,914],[1500,1006]],200,false),'kf',.6)+L(split([[-630,926],[1440,926]],200,false),'kf',.5);
  for(let x=-590;x<1420;x+=70){const y=956;s+=S('rg2',[[x,y-12],[x+18,y],[x,y+12],[x-18,y]],{step:0,k:'kf'})+L([[x-30,y],[x-22,y]],'kf',.3);}
  for(let x=-634;x<1450;x+=11)s+=L([[x,906],[x+J(1.5),898+J(1.4)]],'kf',.3);
  // the cabinet and the shelf throw shadows on the wall away from the window
  s+=S('sd o3',[[22,128],[40,126],[40,640],[22,640]],{k:'',step:0})+S('sd o3',[[1592,76],[1608,80],[1608,640],[1592,640]],{k:'',step:0});
  // scenes: Starry Night paints swirls into the wall's wash; the blueprint draws its grid
  let sw='';
  seed(131);
  for(let i=0;i<15;i++){
    const cx=R(-1500,1520),cy=R(90,500),r=R(30,70);
    sw+=C([[cx-r,cy],[cx-r*.4,cy-r*.8],[cx+r*.6,cy-r*.5],[cx+r*.5,cy+r*.3],[cx-r*.1,cy+r*.35],[cx-r*.05,cy-r*.15],[cx+r*.2,cy-r*.05]],'sw',1.5);
  }
  s+=G('t-starry',sw);
  let bp='';for(let x=BL;x<=1600;x+=40)bp+=`<path class="bpg" d="M${x} 0V1000"/>`;for(let y=0;y<=1000;y+=40)bp+=`<path class="bpg" d="M${BL} ${y}H1600"/>`;s=G('t-bp',bp)+s;
  return s;
 }

 /* ---------- the view through the window: the lake and hills beside the Focus room ---------- */
 function pine(x,y,h,cls='pn1'){
   const w=h*.42;
   let s=L([[x,y],[x,y-h*.25]],'kf',.2);
   for(let t=0;t<3;t++){const by=y-h*(.18+t*.24),ty=by-h*.42,ww=w*(1-t*.24);s+=S(cls,[[x-ww,by],[x,ty],[x+ww,by]],{step:0,k:'kf',j:.4,dx:.6,dy:.7});}
   return s;
 }
 function view(){
  seed(202);const [x0,y0,w,h]=GEO.view,b=y0+h;let s='';
  s+=`<path class="sk" d="M${x0-10} ${y0-10}H${x0+w+10}V${b+10}H${x0-10}Z"/>`+
    F('sk2',[[x0-10,250],[x0+130,242],[x0+w+10,254],[x0+w+10,b],[x0-10,b]],2)+
    F('sk3',[[x0-10,330],[x0+170,322],[x0+w+10,334],[x0+w+10,b],[x0-10,b]],2);
  let day=S('sun',oval(928,168,19,19,10,.5),{smooth:true});for(let i=0;i<8;i++){const a=i*Math.PI/4+.2;day+=L([[928+Math.cos(a)*25,168+Math.sin(a)*25],[928+Math.cos(a)*32,168+Math.sin(a)*32]],'kf',.3);}
  day+=C([[1056,150],[1062,145],[1068,150]],'kf')+C([[1068,150],[1074,145],[1080,150]],'kf')+C([[1090,172],[1095,168],[1100,172]],'kf')+C([[1100,172],[1105,168],[1110,172]],'kf');
  s+=G('t-day',day);
  let night=S('mn',[[1098,124],[1112,132],[1118,150],[1110,168],[1094,174],[1104,160],[1106,146]],{smooth:true});seed(212);
  for(let i=0;i<34;i++){const x=R(x0+8,x0+w-8),y=R(y0+12,330);night+=i%5?S('st',oval(x,y,R(.8,1.6),R(.8,1.6),6),{smooth:true,k:''}):S('st',starPts(x,y,3.4,.32,4),{step:0,k:''});}
  s+=G('t-night',night);
  // Starry Night: the sky turns in brush strokes, stars ring, a cypress stands at the edge, a village sleeps
  seed(222);
  let sn='';
  for(let i=0;i<7;i++){
    const cx=R(x0+30,x0+w-30),cy=R(120,320),r=R(16,40);
    sn+=C([[cx-r,cy+r*.2],[cx-r*.5,cy-r*.7],[cx+r*.6,cy-r*.6],[cx+r*.7,cy+r*.3],[cx,cy+r*.45],[cx-r*.2,cy-r*.1],[cx+r*.2,cy-r*.05]],'sw',1);
  }
  for(const [x,y,r] of [[900,150,9],[1000,118,7],[1120,200,8],[960,260,6],[1060,240,7]]){
    sn+=S('st',oval(x,y,r*.5,r*.5,8),{smooth:true,k:''})+C(oval(x,y,r,r,10,.6).concat([[x+r,y]]),'sw')+C(oval(x,y,r*1.5,r*1.5,12,.8).slice(0,9),'sw');
  }
  sn+=S('mn',[[1130,110],[1146,118],[1152,136],[1144,152],[1128,158],[1138,144],[1140,128]],{smooth:true});
  sn+=S('cyp',[[874,590],[866,520],[872,450],[878,380],[886,320],[892,380],[898,450],[904,520],[896,590]],{smooth:true});for(let y=340;y<580;y+=22)sn+=C([[874+J(2),y],[886,y-10],[898+J(2),y]],'kf');
  for(let i=0;i<6;i++){
    const hx=960+i*30+J(4),hy=418+J(3);
    sn+=S('cb',rect(hx,hy,14,10),{step:0,k:'kf'})+S('rf',[[hx-2,hy],[hx+7,hy-7],[hx+16,hy]],{step:0,k:'kf'})+S('wn',rect(hx+4,hy+3,4,4),{step:0,k:''});
  }
  sn+=S('cb',[[1058,418],[1062,380],[1066,418]],{step:0,k:'kf'});
  s+=G('t-starry',sn);
  // Starfield: the window is deep space; a ringed planet, a moon, a far galaxy
  seed(232);let sp='';for(let i=0;i<60;i++){const x=R(x0,x0+w),y=R(y0,b);sp+=S('st',oval(x,y,R(.6,1.4),R(.6,1.4),5),{smooth:true,k:''});}
  sp+=S('pl',oval(1060,250,44,44,14,.6),{smooth:true})+
    F('pl2',[...oval(1060,250,44,44,14,0).slice(2,8),[1060,250]],.6)+
    C([[1000,268],[1040,236],[1110,222],[1126,232],[1090,262],[1020,284],[1000,276],[1000,268]],'rgk')+
    S('pl2',oval(930,420,14,14,10,.4),{smooth:true});
  sp+=C([[920,180],[940,168],[964,176],[960,196],[936,200],[930,186],[944,182]],'sw',.8)+C([[900,200],[930,214],[970,206]],'sw',.6);
  s+=G('t-space',sp);
  // the land: far mountains, two hills with pines, a cabin with a chimney, the lake, the boat, the reeds
  seed(242);let land='';
  const ridge=[[x0-10,404],[868,372],[892,356],[910,364],[944,300],[968,330],[990,338],[1018,312],[1050,278],[1080,322],[1104,334],[1132,318],[1176,366],[x0+w+10,380],[x0+w+10,440],[x0-10,440]];
  land+=S('mt',ridge,{step:0});
  land+=S('mt2',[[934,318],[944,300],[956,316],[950,322],[942,314]],{step:0,k:'kf'})+S('mt2',[[1038,296],[1050,278],[1064,298],[1056,304],[1048,296],[1042,302]],{step:0,k:'kf'});
  for(const [x,y] of [[950,320],[1060,300],[1110,340],[982,344]])land+=hatch(x,y,9,3,'kf');
  const crest=x=>396+Math.sin((x-850)/40)*5+Math.sin((x-850)/17)*2;
  land+=S('hl1',[[x0-10,crest(840)],...Array.from({length:9},(_,i)=>[850+i*40,crest(850+i*40)]),[x0+w+10,crest(1180)],[x0+w+10,460],[x0-10,460]],{step:0});
  for(let x=854;x<1170;x+=R(8,14))land+=pine(x,crest(x)+R(3,7),R(11,20));
  const crest2=x=>420+Math.sin((x-850)/55+1)*4;
  land+=S('hl2',[[x0-10,crest2(840)],...Array.from({length:7},(_,i)=>[850+i*55,crest2(850+i*55)]),[x0+w+10,crest2(1180)],[x0+w+10,452],[x0-10,452]],{step:0});
  for(let x=858;x<1060;x+=R(16,30))land+=pine(x,crest2(x)+R(4,8),R(18,30),'pn2');
  land+=L([[1140,438],[1142,404]],'kh',.3)+L([[1141,420],[1150,412]],'kf',.2)+S('lf',oval(1144,404,8,6,8,.6),{smooth:true,k:'kf'});
  // the cabin, its window lit at night; the smoke is drawn moving (review-deck.js)
  land+=S('cb',rect(1076,420,28,18),{step:0})+
    S('rf',[[1071,421],[1090,405],[1109,421]],{step:0})+
    S('cb',rect(1096,404,5,10),{step:0,k:'kf'})+
    S('wn',rect(1080,425,6,6),{step:0,k:'kf'})+
    L([[1094,438],[1094,428],[1099,428],[1099,438]],'kf',.2)+
    L([[1110,438],[1124,437]],'kf',.3)+
    L([[1114,433],[1114,438]],'kf',.2)+
    L([[1120,433],[1120,438]],'kf',.2);
  // the shore and the lake
  land+=S('lk',[[x0-10,446],[x0+w+10,444],[x0+w+10,b+10],[x0-10,b+10]],{step:0,k:''});
  land+=L(split([[x0-10,446],[x0+w+10,444]],40,false),'k',.8);
  for(const [x,y,r] of [[880,447,5],[1000,446,4],[1130,445,6],[1160,446,3]])land+=S('mt',[[x-r,y],[x-r*.6,y-r*.8],[x+r*.5,y-r*.7],[x+r,y]],{step:0,k:'kf'});
  land+=F('lk2',[[x0-10,448],[x0+w+10,446],[x0+w+10,462],[1100,468],[1000,462],[900,470],[x0-10,464]],1.5);
  for(let x=860;x<1060;x+=R(16,30))land+=F('lk2',[[x-4,450],[x+4,450],[x,462+R(0,8)]],.4);
  for(let i=0;i<16;i++){const y=R(472,584),x=R(x0+6,x0+w-40);land+=L([[x,y],[x+R(12,34),y+J(.5)]],'kf',.3);}
  land+=G('t-day',[[928,476],[922,490],[934,502],[926,516],[930,530]].map(([x,y])=>L([[x-6,y],[x+6,y]],'gl',.3)).join(''));
  land+=G('t-night',[[1100,470],[1094,486],[1106,500],[1098,516]].map(([x,y])=>L([[x-5,y],[x+5,y]],'gl',.3)).join(''));
  // a moored rowboat, its rope and its reflection
  land+=S('bt',[[936,516],[996,515],[986,528],[946,528]],{step:0,j:.4})+
    L([[944,520],[988,519]],'kf',.3)+
    L([[958,516],[958,527]],'kf',.2)+
    L([[972,516],[972,527]],'kf',.2)+
    L([[946,531],[986,531]],'lk2s',.4)+
    C([[936,518],[922,512],[908,508]],'kf')+
    S('wd3',rect(904,496,5,18),{step:0,k:'kf'});
  // reeds and cattails, lily pads with one flower
  for(let i=0;i<11;i++){const x=856+i*4+J(1.5),top=R(520,556);land+=C([[x,592],[x+J(2),(592+top)/2],[x+J(4),top]],'k');if(i%3===0)land+=S('rf',oval(x+J(3),top+6,1.8,5,6),{smooth:true,k:'kf'});}
  for(const [x,y,r] of [[1040,566,9],[1066,576,7],[1096,562,8],[1124,580,6],[1146,568,7]])
    land+=S('lf',[[x+r*.2,y],[x+r,y-r*.25],[x+r,y+r*.3],[x,y+r*.35],[x-r,y+r*.2],[x-r,y-r*.25],[x-r*.2,y-r*.32],[x,y]],{smooth:true,k:'kf'});
  land+=S('fl1',oval(1068,571,2.6,2,6),{smooth:true,k:'kf'});
  s+=G('t-land',land);
  return s;
 }
 // Under the Sea: the window is a porthole onto the water.
 function porthole(){
  seed(252);const [x,y,w]=GEO.port,cx=x+w/2,cy=y+w/2;let s=`<path class="sea" d="M${x} ${y}H${x+w}V${y+w}H${x}Z"/>`;
  for(let i=0;i<4;i++)s+=F('lt o3',[[x+40+i*60,y],[x+70+i*60,y],[x+20+i*50,y+w],[x-10+i*50,y+w]],1);
  for(let i=0;i<7;i++){const sx=x+20+i*42;s+=C([[sx,y+w],[sx+8,y+w-30],[sx-4,y+w-60],[sx+6,y+w-90-i%3*12]],'swd');}
  s+=S('cor',[[x+40,y+w],[x+52,y+w-40],[x+60,y+w-26],[x+70,y+w-50],[x+82,y+w]],{smooth:true})+S('mt',[[x+150,y+w],[x+170,y+w-22],[x+210,y+w-26],[x+230,y+w]],{smooth:true});
  const fish=(fx,fy,s2,cls)=>
    S(cls,[[fx,fy],[fx+s2*.8,fy-s2*.45],[fx+s2*1.6,fy],[fx+s2*.8,fy+s2*.45]],{smooth:true})+
      S(cls,[[fx+s2*1.5,fy],[fx+s2*2,fy-s2*.4],[fx+s2*2,fy+s2*.4]],{step:0})+
      S('ink',oval(fx+s2*.45,fy-s2*.08,1.2,1.2,5),{smooth:true,k:''});
  s+=fish(cx-60,cy-30,14,'fish1')+fish(cx+30,cy+10,10,'fish2')+fish(cx-10,cy+60,8,'fish1');
  for(const [bx,by,r] of [[cx+80,cy-60,3],[cx+86,cy-80,2],[cx+78,cy-96,1.6]])s+=S('',oval(bx,by,r,r,6),{smooth:true,k:'kf'});
  return s;
 }

 /* ---------- the window frame, curtains, the card cabinet and the bookshelf (middle ground) ---------- */
 function archPts(x,y,w,bottom,i=0){
   const r=w/2-i,cx=x+w/2,cy=y+w/2,p=[[x+i,bottom],[x+i,cy]];
   for(let k=1;k<12;k++){const a=Math.PI+k*Math.PI/12;p.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}
   p.push([x+w-i,cy],[x+w-i,bottom]);
   return p;
 }
 function windowFrame(){
  seed(303);const [x,y,w]=GEO.view,b=590;let s='';
  const outer=archPts(x-14,y-14,w+28,b+4),inner=archPts(x,y,w,b);
  s+=`<path class="tr" fill-rule="evenodd" d="${hl([...outer,outer[0]],.5)}Z ${hl([...inner,inner[0]],.3)}Z"/>`+L(over(outer),'k',.6)+L(inner,'k',.5);
  const glass=archPts(x+10,y+10,w-20,b);
  s+=`<path class="tr2" fill-rule="evenodd" d="${hl([...inner,inner[0]],.2)}Z ${hl([...glass,glass[0]],.2)}Z"/>`+L(glass,'kf',.4);
  const cx=x+w/2,cy=y+w/2;
  s+=S('tr',rect(cx-5,y+12,10,b-y-12),{step:120,j:.4})+S('tr',rect(x+10,322,w-20,9),{step:100,j:.4})+S('tr',rect(x+10,cy-3,w-20,7),{step:100,j:.4});
  for(const a of [-135,-90,-45]){const r=Math.PI*a/180,ex=cx+Math.cos(r)*(w/2-12),ey=cy+Math.sin(r)*(w/2-12);s+=L([[cx,cy],[ex,ey]],'kt',.3);}
  for(const [gx,gy] of [[x+22,560],[cx+16,560],[x+30,300],[cx+20,300]])s+=F('lt o3',[[gx,gy],[gx+12,gy-26],[gx+18,gy-26],[gx+6,gy]],.5);
  s+=S('sd o3',rect(x-6,b+16,w+12,6),{k:'',step:0})+S('tr',rect(x-24,b,w+48,13),{step:90})+L([[x-24,b+4],[x+w+24,b+4]],'kh',.3)+S('tr2',rect(x-8,b+13,w+16,11),{step:90});
  for(const bx of [x+4,x+w-14])s+=S('tr',[[bx,b+24],[bx+10,b+24],[bx+8,b+34],[bx+4,b+40],[bx+2,b+30]],{step:0});
  // on the sill: a violet in a pot, a glass jar with a sprig
  s+=S('pt',[[x+18,566],[x+52,566],[x+48,590],[x+22,590]],{step:0})+S('pt2',rect(x+15,561,40,7),{step:0})+hatch(x+40,580,5,2);
  for(let i=0;i<7;i++){const a=-170+i*26;s+=leaf(x+35,560,a,R(14,19),9,i%2?'lf':'lf2');}
  for(const [fx,fy] of [[x+28,548],[x+38,544],[x+46,550],[x+33,552]])s+=S('fl1',oval(fx,fy,2.4,2.4,6),{smooth:true,k:'kf'});
  s+=S('gl2',[[x+w-40,560],[x+w-24,560],[x+w-22,590],[x+w-42,590]],{step:0})+
    L([[x+w-41,572],[x+w-23,572]],'kf',.3)+
    C([[x+w-32,572],[x+w-30,540],[x+w-34,522]],'k')+
    leaf(x+w-31,544,-40,10,5)+
    leaf(x+w-33,532,-150,10,5,'lf2');
  return s;
 }
 function portholeFrame(){
  seed(313);const [x,y,w]=GEO.port,cx=x+w/2,cy=y+w/2,r=w/2;let s='';
  const o=oval(cx,cy,r+20,r+20,24,.4),i2=oval(cx,cy,r,r,24,.3);
  s+=`<path class="br" fill-rule="evenodd" d="${cv(o,true)} ${cv(i2,true)}"/>`+C(over(o),'k')+C(over(i2),'k')+C(oval(cx,cy,r+10,r+10,24,.4).concat([[cx+r+10,cy]]),'kf');
  for(let k=0;k<12;k++){const a=k*Math.PI/6;s+=S('br2',oval(cx+Math.cos(a)*(r+10),cy+Math.sin(a)*(r+10),3,3,6),{smooth:true,k:'kf'});}
  s+=S('br',rect(x-34,cy-18,18,36),{step:0})+L([[x-30,cy-8],[x-20,cy-8]],'kf',.2)+F('lt o3',[[cx-60,cy-100],[cx-40,cy-112],[cx-80,cy-40],[cx-96,cy-30]],.5);
  return s;
 }
 function curtain(side){
  seed(side<0?321:322);const cx=1010,m=(x)=>side<0?x:2*cx-x;let s='';
  const pts=[[788,46],[866,46],[858,200],[846,330],[852,366],[862,470],[878,640],[784,640],[790,470],[806,366],[804,250]].map(([x,y])=>[m(x),y]);
  s+=S('cu',pts,{smooth:true,j:.5});
  for(let k=0;k<5;k++){
    const tx=796+k*15;
    s+=C([[m(tx),50],[m(tx+(828-tx)*.5+J(3)),220],[m(826+k*4-8),366]],'kf')+C([[m(822+k*6-6),378],[m(812+k*12+J(3)),500],[m(800+k*18+J(4)),636]],'kf');
    if(k%2)s+=F('cu2',[[m(tx+2),56],[m(tx+8),56],[m(830+k*3-6),360],[m(826+k*3-6),360]],.6)+F('cu2',[[m(818+k*7),386],[m(824+k*7),386],[m(810+k*16),632],[m(800+k*16),632]],.6);
  }
  for(let k=0;k<9;k++){const bx=m(786+k*11);s+=C([[bx,640],[bx+(side<0?5:-5),645],[bx+(side<0?11:-11),640]],'k');}
  s+=S('tie',[[m(800),358],[m(858),356],[m(860),372],[m(802),374]],{smooth:true})+
    L([[m(856),366],[m(870),386],[m(866),420]],'k',.5)+
    S('tie',[[m(862),418],[m(874),418],[m(878),446],[m(858),446]],{step:0});
  for(let k=0;k<4;k++)s+=L([[m(862+k*4),428],[m(860+k*5),446]],'kf',.2);
  return s;
 }
 function curtains(){
  seed(330);let s=S('br',rect(796,38,428,6),{step:100})+S('br',oval(792,41,7,7,8,.3),{smooth:true})+S('br',oval(1228,41,7,7,8,.3),{smooth:true});
  for(const rx of [794,810,826,842,858,1162,1178,1194,1210,1226])s+=C(oval(rx,46,4,5,8,.2).concat([[rx+4,46]]),'k');
  return s+curtain(-1)+curtain(1);
 }
 function cabinet(){
  seed(404);const X=40,Y=132,Wc=290,B=652;let s='';
  s+=S('wd3',[[X+Wc,Y-2],[X+Wc+16,Y-10],[X+Wc+16,B],[X+Wc,B]],{step:120})+hatch(X+Wc+3,600,6,2);
  s+=S('wd',rect(X,Y,Wc,B-Y),{step:120});
  s+=S('wd2',[[X-12,Y-18],[X+Wc+12,Y-18],[X+Wc+26,Y-24],[X+Wc+26,Y-14],[X+Wc+8,Y],[X-8,Y]],{step:120})+L([[X-10,Y-11],[X+Wc+10,Y-11]],'kf',.4)+L([[X-6,Y-3],[X+Wc+6,Y-3]],'kf',.4);
  const cols=4,rows=8,gx=6,gy=6,dw=(Wc-24-(cols-1)*gx)/cols,dh=(624-(Y+14)-(rows-1)*gy)/rows;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const ajar=r===4&&c===1,dx=X+12+c*(dw+gx)-(ajar?2:0),dy=Y+14+r*(dh+gy)+(ajar?3:0),ww=dw+(ajar?4:0),hh=dh+(ajar?2:0);
   if(ajar){s+=S('sd o4',rect(dx+3,dy+hh,ww,5),{k:'',step:0})+S('wd3',rect(dx+2,dy-6,ww-4,7),{step:0,k:'kf'});for(let t=0;t<9;t++)s+=L([[dx+6+t*6,dy-1],[dx+7+t*6,dy-6]],'kp',.2);}
   s+=S('wd2',rect(dx,dy,ww,hh),{step:0,j:.5})+L([[dx+3,dy+3],[dx+ww-3,dy+3]],'kh',.2)+F('wd3 o5',[[dx+ww-4,dy+3],[dx+ww-2,dy+3],[dx+ww-2,dy+hh-2],[dx+3,dy+hh-2],[dx+3,dy+hh-4],[dx+ww-4,dy+hh-4]],.2);
   if(rnd()<.6)s+=L([[dx+4,dy+R(.3,.8)*hh],[dx+ww*.5,dy+R(.3,.8)*hh+J(1)],[dx+ww-5,dy+R(.3,.8)*hh]],'kg',.4);
   const lx=dx+ww/2-13,ly=dy+9;s+=S('br',rect(lx,ly,26,12),{step:0,j:.3,k:'kf'})+S('pp',rect(lx+2.5,ly+2.5,21,7),{step:0,k:''});
   if(rnd()<.85)s+=L([[lx+5,ly+6],[lx+9+R(2,8),ly+6+J(.6)],[lx+R(13,19),ly+5.5]],rnd()<.12?'kr':'kp',.3);
   s+=C([[dx+ww/2-7,dy+hh*.66],[dx+ww/2-6,dy+hh*.66+6],[dx+ww/2,dy+hh*.66+8],[dx+ww/2+6,dy+hh*.66+6],[dx+ww/2+7,dy+hh*.66]],'kb')+
     S('br',oval(dx+ww/2-7,dy+hh*.66,1.6,1.6,5),{smooth:true,k:''})+
     S('br',oval(dx+ww/2+7,dy+hh*.66,1.6,1.6,5),{smooth:true,k:''});
  }
  for(const [nx,ny] of [[X+2,300],[X+Wc-2,452],[X+80,Y+2]])s+=L([[nx,ny],[nx+J(3),ny+R(3,7)]],'kf',.2);
  s+=hatch(X+Wc-40,600,8,3);
  // the cabinet's top stays clear under the room's title and its week of dots: a pothos kept at the back of the top,
  // out of sight behind the cornice, trails over the right-hand edge and down the side
  const px=X+226,py=Y-24;
  const vine=(pts)=>{
    let v=C(pts,'k');
    const segs=pts.length-1;
    for(let i=1;i<segs*3;i++){
      const t=i/(segs*3),k2=Math.min(segs-1,Math.floor(t*segs)),u=t*segs-k2,p=lerp(pts[k2],pts[k2+1],u);
      v+=heart(p[0],p[1],(i%2?-1:1)*R(50,80)+(i%2?0:180)+R(-20,20),R(9,14),i%3?'lf':'lf2');
    }
    return v;
  };
  s+=vine([[X+Wc+4,Y-12],[X+Wc+16,Y-4],[X+Wc+18,py+60],[X+Wc+12,py+150],[X+Wc+20,py+230]]);
  return s;
 }
 function shelf(){
  seed(505);const X=1318,Y=82,Ws=274,B=652;let s='';
  s+=S('wd4',rect(X+12,Y,Ws-24,B-Y),{step:120,k:''});
  for(let i=0;i<9;i++)s+=L([[X+14,Y+20+i*62],[X+Ws-14,Y+26+i*62]],'kg',.6);
  const shelves=[190,294,398,502,606];let top=Y;
  const objects={1:'globe',2:'glass',3:'plant'};
  shelves.forEach((sy,n)=>{
   let x=X+18;const end=X+Ws-20,gap=sy-top-4;let placed=false;
   while(x<end-8){
    const room=end-x,roll=rnd();
    if(!placed&&objects[n]&&x>X+Ws*.55&&room>44){placed=true;const ox=x+6,base=sy;
     if(objects[n]==='globe'){
       s+=S('br',[[ox+4,base],[ox+30,base],[ox+26,base-5],[ox+8,base-5]],{step:0})+
         L([[ox+17,base-5],[ox+17,base-14]],'k',.2)+
         S('b5',oval(ox+17,base-34,18,18,12,.4),{smooth:true})+
         C([[ox+4,base-40],[ox+12,base-30],[ox+24,base-36],[ox+30,base-26]],'kf')+
         S('lf2',[[ox+10,base-44],[ox+20,base-48],[ox+24,base-38],[ox+14,base-34]],{smooth:true,k:'kf'})+
         C([[ox-2,base-30],[ox+6,base-52],[ox+28,base-56],[ox+36,base-38]],'kb');
     }
     if(objects[n]==='glass'){
       s+=S('wd3',rect(ox,base-6,30,6),{step:0})+
         S('wd3',rect(ox,base-62,30,6),{step:0})+
         L([[ox+3,base-56],[ox+3,base-6]],'k',.2)+
         L([[ox+27,base-56],[ox+27,base-6]],'k',.2)+
         S('gl2',[[ox+6,base-56],[ox+24,base-56],[ox+16,base-32],[ox+24,base-8],[ox+6,base-8],[ox+14,base-32]],{smooth:false,step:0,k:'kf'})+
         F('sand',[[ox+9,base-8],[ox+21,base-8],[ox+15,base-16]],.3)+
         F('sand',[[ox+10,base-52],[ox+20,base-52],[ox+15,base-40]],.3);
     }
     if(objects[n]==='plant'){
       s+=S('pt',[[ox+2,base-22],[ox+28,base-22],[ox+25,base],[ox+5,base]],{step:0})+S('pt2',rect(ox,base-26,30,5),{step:0});
       for(let k=0;k<6;k++)s+=leaf(ox+15,base-26,-160+k*28,R(12,18),7,k%2?'lf':'lf2');
       s+=C([[ox+26,base-24],[ox+40,base-10],[ox+38,base+24],[ox+44,base+40]],'k')+heart(ox+40,base+6,200,9,'lf')+heart(ox+38,base+24,160,8,'lf2')+heart(ox+44,base+40,210,8,'lf');
     }
     x+=46;continue;}
    if(roll<.1&&room>60){
      const n2=I(3,4);
      let yy=sy;
      for(let k=0;k<n2;k++){const bw=R(44,58),bh=R(8,11),bx=x+J(3);s+=S('b'+I(1,8),rect(bx,yy-bh,bw,bh),{step:0,j:.3})+L([[bx+bw-5,yy-bh+2],[bx+bw-5,yy-2]],'kf',.2);yy-=bh;}
      x+=62;
      continue;
    }
    if(roll<.17&&room>30){
      const h=gap*R(.75,.9),bw=R(12,18),lean=R(10,16);
      s+=S('b'+I(1,8),[[x,sy],[x+bw,sy],[x+bw+lean,sy-h],[x+lean,sy-h]],{step:0,j:.4})+L([[x+3+lean*.2,sy-h*.2],[x+bw-3+lean*.2,sy-h*.2]],'kf',.2);
      x+=bw+lean+2;
      continue;
    }
    if(roll<.21&&room>20){s+=S('br2',[[x,sy],[x+16,sy],[x+16,sy-4],[x+4,sy-4],[x+4,sy-gap*.55],[x,sy-gap*.55]],{step:0});x+=18;continue;}
    const bw=I(9,21),h=gap*R(.6,.96),cls='b'+I(1,8);
    s+=S(cls,rect(x,sy-h,bw,h),{step:0,j:.35,dx:.8,dy:1});
    if(rnd()<.7)s+=L([[x+1.5,sy-h+5],[x+bw-1.5,sy-h+5]],'kf',.2)+L([[x+1.5,sy-6],[x+bw-1.5,sy-6]],'kf',.2);
    const t=rnd();
    if(t<.45){for(let k=0;k<I(2,4);k++)s+=L([[x+bw/2,sy-h*.62+k*6],[x+bw/2+J(.5),sy-h*.62+k*6+3]],'kp',.2);}
    else if(t<.75)s+=S('pp',rect(x+2,sy-h*.66,bw-4,Math.min(16,h*.2)),{step:0,k:'kf'})+L([[x+3.5,sy-h*.66+5],[x+bw-3.5,sy-h*.66+5]],'kp',.2);else s+=F('o4 sd',rect(x+1,sy-h+8,bw-2,h*.18),.2);
    x+=bw+R(.5,2.2);
   }
   s+=S('sd o3',rect(X+12,sy+10,Ws-24,5),{k:'',step:0})+S('wd2',rect(X+8,sy,Ws-16,10),{step:90})+L([[X+10,sy+3],[X+Ws-10,sy+3]],'kh',.3);top=sy+10;
  });
  s+=S('wd',rect(X,Y,14,B-Y),{step:120})+S('wd',rect(X+Ws-14,Y,14,B-Y),{step:120})+hatch(X+Ws-12,600,4,2);
  s+=S('wd2',[[X-10,Y-16],[X+Ws+10,Y-16],[X+Ws+6,Y],[X-6,Y]],{step:120})+L([[X-8,Y-9],[X+Ws+8,Y-9]],'kf',.4);
  return s;
 }
 // Left of the cabinet (wide rooms): a pressed fern framed under glass and a small print of the lake, both hung
 // from the picture rail on wires, each throwing its shadow on the wall.
 function pictures(){
  seed(450);let s='';
  const hang=(x,y,w)=>S('br',oval(x+w/2,57,3,3,6,.2),{smooth:true,k:'kf'})+L([[x+w/2,58],[x+16,y+8]],'kf',.3)+L([[x+w/2,58],[x+w-16,y+8]],'kf',.3);
  const framed=(x,y,w,h,cls,mat)=>{let f=S('sd o3',rect(x+9,y+11,w,h),{k:'',step:0})+S(cls,rect(x,y,w,h),{step:90});
   for(const [cx,cy,dx,dy] of [[x,y,1,1],[x+w,y,-1,1],[x+w,y+h,-1,-1],[x,y+h,1,-1]])f+=L([[cx+dx*2,cy+dy*2],[cx+dx*mat,cy+dy*mat]],'kf',.2);
   f+=L([[x+4,y+4],[x+w-4,y+4]],'kh',.3)+L([[x+4,y+4],[x+4,y+h-4]],'kh',.3)+S('pp',rect(x+mat,y+mat,w-mat*2,h-mat*2),{step:90,k:'kf'});
   // the glass: two thin light strokes across the corner
   f+=L([[x+mat+8,y+mat+30],[x+mat+30,y+mat+8]],'kh',.3)+L([[x+mat+8,y+mat+44],[x+mat+44,y+mat+8]],'kh',.3);
   return f;};
  const fx=-238,fy=150,fw=172,fh=226;s+=hang(fx,fy,fw)+framed(fx,fy,fw,fh,'wd3',14)+S('',rect(fx+28,fy+28,fw-56,fh-70),{step:0,k:'kf',j:.3});
  const sx=fx+fw/2,sy=fy+fh-52,stem=[];for(let t=0;t<=6;t++)stem.push([sx+Math.sin(t*.55)*5,sy-t*21]);
  s+=C(stem,'k');
  for(let t=1;t<13;t++){
    const u=t/13,k=Math.min(5,Math.floor(u*6)),p=lerp(stem[k],stem[k+1],u*6-k),sz=(1-u)*15+5;
    s+=leaf(p[0],p[1],-152+u*22,sz,sz*.42,t%2?'lf':'lf2','kf')+leaf(p[0],p[1],-28-u*22,sz,sz*.42,t%2?'lf2':'lf','kf');
  }
  s+=L([[sx-32,fy+fh-36],[sx+30,fy+fh-36]],'kp',.3)+L([[sx-20,fy+fh-29],[sx+16,fy+fh-29]],'kp',.3)+hatch(fx+fw-34,fy+fh-12,5,3);
  const gx=-474,gy=236,gw=120,gh=94;s+=hang(gx,gy,gw)+framed(gx,gy,gw,gh,'wd2',12);
  const ix=gx+18,iy=gy+18,iw=gw-36,ih=gh-36;
  s+=F('sk',rect(ix,iy,iw,ih),.2)+
    F('hl1',[[ix,iy+ih*.5],[ix+iw*.3,iy+ih*.32],[ix+iw*.55,iy+ih*.44],[ix+iw*.8,iy+ih*.28],[ix+iw,iy+ih*.4],[ix+iw,iy+ih*.66],[ix,iy+ih*.66]],.3)+
    F('lk',[[ix,iy+ih*.66],[ix+iw,iy+ih*.66],[ix+iw,iy+ih],[ix,iy+ih]],.2);
  for(const [px2,h2] of [[ix+12,16],[ix+20,12],[iw*.7+ix,14]])s+=pine(px2,iy+ih*.6,h2);
  s+=L([[ix+6,iy+ih*.8],[ix+20,iy+ih*.8]],'kf',.2)+L([[ix+34,iy+ih*.88],[ix+56,iy+ih*.88]],'kf',.2)+S('',rect(ix,iy,iw,ih),{step:0,k:'kf',j:.3});
  return s;
 }
 function beam(){return G('t-sun',F('lt o2',[[862,260],[1150,236],[980,712],[420,712]],3)+F('lt o3',[[900,300],[1100,280],[930,712],[560,712]],3));}
 function mid(){return pictures()+G('t-arch',windowFrame())+G('t-sea',portholeFrame())+G('t-curtain',curtains())+cabinet()+shelf()+beam();}

 /* ---------- the table and what stands on it (near ground) ---------- */
 function leg(x,top,bot,s,cls){
  const cx=x+28*s,
    w=n=>n*s,
    prof=[
      [w(-26),top],
      [w(-26),top+40*s],
      [w(-22),top+44*s],
      [w(-28),top+50*s],
      [w(-20),top+58*s],
      [w(-24),top+(bot-top)*.55],
      [w(-16),bot-34*s],
      [w(-10),bot-24*s],
      [w(-14),bot-12*s],
      [w(-18),bot-4*s],
      [w(-16),bot]
    ];
  const p=[...prof.map(([a,b])=>[cx+a,b]),...prof.slice().reverse().map(([a,b])=>[cx-a,b])];
  let o=S(cls,p,{step:0,j:.4});
  for(const y of [top+40*s,top+50*s,top+58*s,bot-24*s,bot-12*s])o+=L([[cx-w(22),y],[cx+w(22),y]],'kf',.3);
  o+=L([[cx+w(10),top+64*s],[cx+w(14),bot-40*s]],'kh',.3)+hatch(cx-w(20),bot-60*s,6*s,2);
  return o;
 }
 function near(){
  seed(606);let s='';
  // beyond the table's far end (very wide rooms): a rubber plant in a pot on the floor
  const rx=-1160;
  s+=S('sd o4',[[rx-46,874],[rx+60,874],[rx+54,884],[rx-50,884]],{k:'',step:0})+
    C([[rx-2,800],[rx-8,700],[rx+4,610],[rx-4,520]],'k')+
    C([[rx+2,760],[rx+30,690],[rx+44,640]],'k')+
    C([[rx-4,740],[rx-36,680],[rx-46,620]],'k');
  for(const [lx,ly,a,len] of [
    [-1164,524,-96,46],
    [-1168,560,-150,52],
    [-1160,566,-30,50],
    [-1166,612,-160,56],
    [-1156,618,-14,54],
    [-1118,644,-50,48],
    [-1204,628,-128,50],
    [-1162,664,-172,52],
    [-1158,676,-6,50],
    [-1208,700,-150,46],
    [-1112,704,-28,46],
    [-1164,740,-170,44],
    [-1156,748,-8,44]
  ])
    s+=leaf(lx,ly,a,len,len*.46,len%4?'lf':'lf2','k');
  s+=S('pt',[[rx-38,798],[rx+40,798],[rx+32,876],[rx-30,876]],{step:0})+S('pt2',rect(rx-43,790,86,12),{step:0})+hatch(rx+12,846,6,3)+L([[rx-34,812],[rx+36,812]],'kc',.3);
  // the long table: its shadow on the floor, the back legs, the top with its grain, the far end's end grain
  s+=S('sd o4',[[TL+40,958],[1540,958],[1500,992],[TL+80,994]],{k:'',step:0});
  s+=leg(TL+96,AP,930,.82,'wd3')+leg(150,AP,930,.82,'wd3')+leg(1420,AP,930,.82,'wd3');
  s+=S('tp',[[TL,TT],[1620,TT],[1620,TF],[TL,TF]],{step:160});
  for(let i=0;i<9;i++){const y=TT+7+i*7.4;let x=TL+8;while(x<1600){const len=R(110,360),y2=y+J(1.4);s+=L([[x,y],[x+len*.5,y+J(1.6)],[x+len,y2]],'kg',.5);x+=len+R(14,70);}}
  for(let k=0;k<4;k++)s+=C([[TL+2,TT+12+k*15],[TL+7,TT+17+k*15],[TL+2,TT+22+k*15]],'kg');
  for(const [kx,ky] of [[330,668],[1080,694],[-520,684]])s+=C(oval(kx,ky,10,2.6,10,.3).concat([[kx+10,ky]]),'kg')+C(oval(kx,ky,4,1,8,.2).concat([[kx+4,ky]]),'kg');
  s+=C(oval(560,676,24,6,14,.4).slice(0,11),'kf');
  for(let i=0;i<11;i++){const x=i<7?R(200,1300):R(TL+40,-60),y=R(650,706);s+=L([[x,y],[x+R(6,16),y+J(1.5)]],'kf',.2);}
  // morning light through the window lands on the table as the window's own shape
  s+=G(
    't-sun',
    F('lt o2',[[562,648],[868,648],[812,708],[470,708]],2)+
      F('lt o3',[[600,652],[840,652],[790,704],[520,704]],2)+
      F('tp o6',[[704,648],[714,648],[650,708],[640,708]],.4)+
      F('tp o6',[[530,676],[860,676],[856,681],[524,681]],.4));
  s+=S('wd',rect(TL,TF,1620-TL,TE-TF),{step:160})+L(split([[TL,TF+3],[1620,TF+3]],400,false),'kh',.4);
  s+=S('wd',rect(TL,TE,1620-TL,AP-TE),{step:160})+S('wd3 o5',rect(TL,AP-8,1620-TL,8),{k:'',step:0})+L(split([[TL,AP-8],[1620,AP-8]],400,false),'kf',.5);
  for(let i=0;i<5;i++){const y=TE+10+i*20;s+=L([[TL,y],[R(-640,-420),y+J(1)]],'kg',.5)+L([[R(-300,-100),y],[R(160,480),y+J(1)]],'kg',.5)+L([[R(1100,1300),y],[1620,y+J(1)]],'kg',.5);}
  // the apron: drawers either side; behind the grade buttons a plain sunk panel with a bead and no hardware
  for(const [x1,x2] of [[-760,-330],[190,640],[1330,1570]]){
    s+=S('wd2',rect(x1,744,x2-x1,80),{step:90})+L([[x1+5,748],[x2-5,748]],'kh',.3)+L([[x1+5,748],[x1+5,820]],'kh',.3)+F('wd3 o5',[[x2-6,750],[x2-3,750],[x2-3,821],[x1+6,821],[x1+6,818],[x2-6,818]],.3);
   const mx=(x1+x2)/2;
   s+=S('br',[[mx-26,772],[mx+26,772],[mx+22,780],[mx-22,780]],{smooth:true,k:'kf'})+
     C([[mx-20,776],[mx-16,792],[mx,796],[mx+16,792],[mx+20,776]],'kb')+
     S('br',oval(mx-20,776,2.4,2.4,6),{smooth:true,k:'kf'})+
     S('br',oval(mx+20,776,2.4,2.4,6),{smooth:true,k:'kf'})+
     S('kd',[[mx-2,804],[mx+2,804],[mx+3,812],[mx-3,812]],{step:0,k:''})+
     hatch(x2-40,808,6,3);
  }
  s+=S('wd2',rect(704,748,606,74),{step:120,k:'kf'})+
    L([[710,753],[1304,753]],'kh',.3)+
    L([[710,753],[710,816]],'kh',.3)+
    F('wd3 o5',[[1304,754],[1306,754],[1306,821],[708,821],[708,818],[1304,818]],.3)+
    S('',rect(720,761,574,48),{step:120,k:'kf',j:.4})+
    L([[724,764],[1290,764]],'kh',.2)+
    hatch(1268,806,6,3);
  s+=leg(TL+6,AP,975,1,'wd')+leg(56,AP,975,1,'wd')+leg(1488,AP,975,1,'wd');
  // far left (wide rooms): last term's card boxes, closed and tied with string; loose cards; a magnifier; a cup of pencils
  const crate=(x,y,w,h,cls)=>
    S(cls,rect(x,y,w,h),{step:0,j:.4})+
      S(cls,rect(x-4,y-7,w+8,10),{step:0,j:.3})+
      L([[x-2,y-4],[x+w+2,y-4]],'kh',.2)+
      S('pp',rect(x+w*.3,y+h*.3,w*.4,h*.44),{step:0,k:'kf'})+
      L([[x+w*.36,y+h*.46],[x+w*.6,y+h*.46]],'kp',.2)+
      L([[x+w*.36,y+h*.6],[x+w*.54,y+h*.6]],'kp',.2)+
      L([[x+w*.82,y-7],[x+w*.82,y+h]],'kr',.3)+
      hatch(x+w-26,y+h-12,6,3);
  s+=S('sd o4',[[-574,706],[-356,706],[-362,714],[-580,714]],{k:'',step:0})+
    crate(-566,666,196,40,'cb')+
    crate(-552,618,170,40,'wd2')+
    C([[-414,611],[-424,600],[-414,594],[-408,602],[-414,611],[-402,620]],'kr')+
    C([[-414,611],[-404,602],[-396,606],[-404,612],[-414,611]],'kr');
  for(let k=0;k<4;k++)s+=S('pp',rot(rect(-330+k*16,690-k*2,44,14),-308+k*16,697,6-k*5),{step:0,j:.3,k:'kf'});
  s+=S('sd o4',[[-262,700],[-188,708],[-194,712],[-266,704]],{k:'',step:0})+
    S('gl2',oval(-258,690,17,6.4,14,.3),{smooth:true})+
    C(oval(-258,690,19,8,16,.3).concat([[-239,690]]),'k')+
    L([[-268,688],[-254,687]],'kh',.2)+
    S('wd3',[[-240,692],[-192,702],[-193,707],[-241,697]],{step:0,j:.3})+
    S('br',[[-244,690],[-238,691],[-239,698],[-245,697]],{step:0,k:'kf'});
  s+=S('sd o4',[[-86,664],[-44,664],[-50,670],[-92,670]],{k:'',step:0});
  for(const [px,py,ang,cls] of [[-70,596,-10,'yl'],[-58,590,6,'b6'],[-64,604,-2,'yl']]){
    const p=rot([[px-3,py+40],[px-3,py],[px,py-7],[px+3,py],[px+3,py+40]],px,py,ang);
    s+=S(cls,p,{step:0,j:.3,k:'kf'})+S('pp',rot([[px-3,py],[px,py-7],[px+3,py]],px,py,ang),{step:0,k:''})+S('kd',rot([[px-1,py-4.5],[px,py-7],[px+1,py-4.5]],px,py,ang),{step:0,k:''});
  }
  s+=S('pp',rot(rect(-54,584,7,64),-51,620,12),{step:0,j:.3,k:'kf'});for(let k=0;k<7;k++)s+=L(rot([[-54,590+k*8],[-51,590+k*8]],-51,620,12),'kf',.1);
  s+=S('cp',[[-80,624],[-42,624],[-44,664],[-78,664]],{step:0})+C(oval(-61,624,19,4,12,.3).concat([[-42,624]]),'k')+L([[-79,636],[-43,636]],'kc',.3)+L([[-78,652],[-44,652]],'kc',.3)+hatch(-56,654,5,2);
  // left: a stamp, a tray of blank cards; behind, a stack of books with reading glasses; a fern with every leaflet
  s+=S('wd3',rect(14,696,26,12),{step:0})+S('rf',[[20,696],[22,682],[26,672],[32,682],[34,696]],{smooth:true})+S('rf',oval(27,668,6,5,8,.3),{smooth:true});
  s+=S('sd o4',[[50,708],[214,708],[206,714],[44,714]],{k:'',step:0});
  for(let k=0;k<6;k++)s+=S('pp',rot(rect(70+k*22,664-k%2*3,44,30),92+k*22,680,-8+k*3),{step:0,j:.3,k:'kf'})+L(rot([[74+k*22,670],[110+k*22,670]],92+k*22,680,-8+k*3),'kr',.2);
  s+=S('wd2',rect(56,684,158,24),{step:0})+L([[60,688],[210,688]],'kh',.3)+hatch(186,696,6,3)+L([[56,684],[64,676],[206,676],[214,684]],'kf',.4);
  s+=S('sd o4',[[220,664],[356,664],[350,670],[214,670]],{k:'',step:0});
  for(const [bx,by,bw,bh,c] of [[222,648,134,16,'b3'],[230,634,118,14,'b6'],[238,622,104,12,'b1']]){
    s+=S(c,rect(bx,by,bw,bh),{step:0,j:.35})+S('pp',rect(bx+bw-12,by+2,10,bh-4),{step:0,k:'kf'});
    for(let k=1;k<4;k++)s+=L([[bx+bw-11,by+k*bh/4],[bx+bw-3,by+k*bh/4]],'kf',.1);
    s+=L([[bx+3,by+3],[bx+bw-16,by+3]],'kh',.2);
  }
  s+=C([[300,646],[302,666],[298,684],[303,700]],'kr')+F('rd2',[[298,698],[306,698],[305,708],[302,703],[299,708]],.2);
  s+=C(oval(262,614,12,6.5,12,.4).concat([[274,614]]),'K')+
    C(oval(294,614,12,6.5,12,.4).concat([[306,614]]),'K')+
    C([[274,612],[278,608],[282,612]],'K')+
    L([[250,612],[236,604]],'K',.3)+
    L([[306,612],[318,606]],'K',.3)+
    F('gl2 o5',oval(262,614,11,5.5,10),.2)+
    F('gl2 o5',oval(294,614,11,5.5,10),.2);
  const fx=400,fy=628;
  s+=S('pt',[[382,632],[418,632],[414,664],[386,664]],{step:0})+S('pt2',rect(379,625,42,8),{step:0})+hatch(400,650,5,3)+S('sd o4',[[372,664],[420,664],[414,670],[366,670]],{k:'',step:0});
  for(let k=0;k<8;k++){
    const a=(-160+k*20)*Math.PI/180,len=R(42,66),pts=[];
    for(let t=0;t<=4;t++){const u=t/4,droop=u*u*len*.35;pts.push([fx+Math.cos(a)*len*u,fy+Math.sin(a)*len*u+droop]);}
   s+=C(pts,'k');
   for(let t=1;t<10;t++){
     const u=t/10,sx=lerp(pts[Math.floor(u*4)],pts[Math.min(4,Math.floor(u*4)+1)],u*4-Math.floor(u*4)),sz=(1-u)*9+3,deg=a*180/Math.PI+(u*u*30);
     s+=leaf(sx[0],sx[1],deg-62,sz,sz*.42,t%2?'lf':'lf2','kf')+leaf(sx[0],sx[1],deg+62,sz,sz*.42,t%2?'lf2':'lf','kf');
   }
  }
  // right, back: the table is kept clear for the pile of cards you have done; then the reading lamp, brass base and
  // stem, green glass shade (it lights at night: glow below)
  s+=S('sd o4',[[1396,664],[1510,664],[1500,672],[1386,672]],{k:'',step:0})+C([[1496,660],[1540,666],[1580,662],[1620,668]],'k');
  s+=S('br',oval(1450,658,48,8,16,.3),{smooth:true})+
    S('br',oval(1450,650,22,6,12,.3),{smooth:true})+
    S('br',rect(1446,566,8,84),{step:0,j:.3})+
    S('br2',oval(1450,600,6,4,8,.2),{smooth:true,k:'kf'})+
    L([[1448,570],[1448,646]],'kh',.2);
  s+=S('gs',[[1374,566],[1382,548],[1408,535],[1450,530],[1492,535],[1518,548],[1526,566]],{smooth:true})+
    S('br',rect(1372,563,156,7),{step:0,j:.3})+
    C([[1396,552],[1420,540],[1446,537]],'kh')+
    C([[1400,560],[1430,550]],'kh');
  // right, front: an open book with a ribbon, a cup of tea on its saucer
  const [bx]=GEO.book;s+=S('sd o4',[[bx-6,708],[bx+206,708],[bx+198,716],[bx-12,716]],{k:'',step:0})+S('b4',rect(bx-4,703,208,7),{step:0,j:.3});
  s+=S('pp',[[bx+2,690],[bx+50,684],[bx+100,688],[bx+102,706],[bx+4,708]],{step:0,j:.4})+S('pp',[[bx+100,688],[bx+150,684],[bx+198,690],[bx+196,708],[bx+102,706]],{step:0,j:.4});
  for(let k=0;k<5;k++){s+=L([[bx+12,692+k*3],[bx+R(60,88),691+k*3]],'kp',.2);s+=L([[bx+110,691+k*3],[bx+R(150,186),692+k*3]],'kp',.2);}
  s+=L([[bx-2,700],[bx+2,708]],'kf',.2)+
    L([[bx+198,700],[bx+201,708]],'kf',.2)+
    C([[bx+101,688],[bx+101,698],[bx+101,706]],'kf')+
    C([[bx+101,706],[bx+104,716],[bx+99,726]],'kr')+
    F('rd2',[[bx+96,724],[bx+104,724],[bx+103,732],[bx+100,728],[bx+97,732]],.2);
  const tx=1532;s+=S('sd o4',[[tx-50,708],[tx+42,708],[tx+34,714],[tx-58,714]],{k:'',step:0})+S('cp',oval(tx,703,44,7,16,.3),{smooth:true})+C(oval(tx,702,26,4,12,.3).concat([[tx+26,702]]),'kf');
  s+=C([[tx+22,680],[tx+34,678],[tx+36,688],[tx+22,694]],'k')+
    S('cp',[[tx-25,672],[tx+25,672],[tx+21,692],[tx+12,700],[tx-12,700],[tx-21,692]],{smooth:true})+
    S('cp',oval(tx,672,25,5,14,.2),{smooth:true})+
    S('tea',oval(tx,673,21,3.4,12,.2),{smooth:true,k:''})+
    L([[tx-23,682],[tx+23,682]],'kc',.3)+
    hatch(tx+8,690,5,2);
  s+=L([[tx-44,700],[tx-20,694]],'kd2',.3)+S('mt3',oval(tx-46,701,4,2.4,8,.2),{smooth:true,k:'kf'});
  // a pencil lying on the table, a paper clip
  s+=S('yl',[[880,704],[978,696],[979,700],[881,708]],{step:0,j:.3,k:'kf'})+S('pp',[[978,696],[990,698],[979,700]],{step:0,k:'kf'})+S('rd2',[[872,704],[880,704],[881,708],[873,709]],{step:0,k:'kf'});
  s+=C([[1012,706],[1030,704],[1031,700],[1014,702],[1015,698],[1028,697]],'kf');
  return s;
 }

 /* ---------- small parts that move: clouds, water, smoke, steam, the heron, the lamp, a page, dust ---------- */
 function cloud(n){
   seed(700+n);
   const w=[150,110,130][n%3],h=w*.32;
   const pts=[];
   for(let i=0;i<14;i++){const a=Math.PI+i/13*Math.PI,r=1+(i%2?.12:-.05)+J(.06);pts.push([w/2+Math.cos(a)*w/2*r,h*.8+Math.sin(a)*h*.9*r]);}
   pts.push([w*.92,h*.86],[w*.08,h*.86]);
  const body=S('cl',pts,{smooth:true,dx:1.4,dy:1.6})+
    F('cl2',[[w*.14,h*.78],[w*.86,h*.76],[w*.8,h*.86],[w*.2,h*.86]],.6)+
    G('t-starry',C([[w*.1,h*.6],[w*.3,h*.2],[w*.6,h*.3],[w*.55,h*.6],[w*.4,h*.5]],'sw')+C([[w*.5,h*.7],[w*.75,h*.4],[w*.9,h*.6]],'sw'));
  return `<svg class="rv-art" viewBox="-4 -4 ${w+8} ${h+10}" preserveAspectRatio="none" focusable="false">${body}</svg>`;}
 function glints(){
   seed(720);
   let s='';
   for(let i=0;i<22;i++){const x=R(0,320),y=R(0,120);s+=L([[x,y],[x+R(6,16),y]],i%3?'kf':'gl',.2);}
   return `<svg class="rv-art" viewBox="0 0 320 120" preserveAspectRatio="none" focusable="false">${s}</svg>`;
 }
 const puff=(cls,n)=>{seed(740+n);return `<svg class="rv-art" viewBox="-12 -12 24 24" focusable="false">${S(cls,oval(0,0,R(6,8),R(5,7),9,.6),{smooth:true,k:'kf'})}</svg>`;};
 function wisp(n){seed(760+n);const x=10;return `<svg class="rv-art" viewBox="0 0 20 60" preserveAspectRatio="none" focusable="false">${C([[x,58],[x+5,44],[x-4,30],[x+4,16],[x-1,2]],'stm',.8)}</svg>`;}
 function heron(){
  seed(780);
  const stand=C([[14,40],[15,52]],'K')+
    C([[18,40],[19,52]],'K')+
    S('hr',[[6,30],[12,24],[22,24],[28,30],[22,40],[10,40]],{smooth:true,k:'K'})+
    C([[24,26],[27,18],[22,12],[25,5]],'K')+
    S('hr',oval(27,5,3.4,2.6,6),{smooth:true,k:'K'})+
    L([[30,5],[38,7]],'K',.2)+
    L([[8,32],[2,36]],'K',.2);
  const fly=(up)=>
    S('hr',[[10,30],[22,28],[34,30],[24,34]],{smooth:true,k:'K'})+
      C([[32,29],[38,26],[42,27]],'K')+
      L([[42,27],[48,28]],'K',.2)+
      L([[12,31],[2,34]],'K',.2)+
      S('hr2',up?[[18,29],[10,10],[24,14],[26,28]]:[[18,31],[8,46],[22,42],[26,32]],{smooth:true,k:'K'});
  return `<svg class="rv-art" viewBox="0 0 50 54" focusable="false"><g class="rv-h-stand">${stand}</g><g class="rv-h-up">${fly(true)}</g><g class="rv-h-down">${fly(false)}</g></svg>`;
 }
 function glow(){
  seed(800);
  const [x,y,w,h]=GEO.lamp;
  let s=F('lt2 o2',[[1378,568],[1522,568],[1600,712],[1250,712]],3)+
    F('lt2 o3',[[1400,568],[1500,568],[1560,712],[1300,712]],3)+
    F('lt2 o3',oval(1440,690,170,20,18),2)+
    F('lt2 o3',oval(1450,520,90,26,16),2);
  s+=S('gs2',[[1374,566],[1382,548],[1408,535],[1450,530],[1492,535],[1518,548],[1526,566]],{smooth:true,k:''})+F('lt2',oval(1450,570,60,4,12),.5);
  return svg(x-140,y-30,w+160,h+40,s);
 }
 function chain(){
   seed(820);
   let s='';
   for(let k=0;k<9;k++)s+=S('br2',oval(5,4+k*5,1.4,1.6,5),{smooth:true,k:''});
   s+=S('br',[[3,48],[7,48],[8,56],[5,60],[2,56]],{smooth:true,k:'k'});
   return `<svg class="rv-art" viewBox="0 0 10 62" preserveAspectRatio="none" focusable="false">${s}</svg>`;
 }
 function page(){
   seed(840);
   let s=S('pp',[[2,6],[50,0],[98,4],[96,22],[2,20]],{step:0,j:.4});
   for(let k=0;k<4;k++)s+=L([[10,7+k*3],[R(60,88),7+k*3]],'kp',.2);
   return `<svg class="rv-art" viewBox="0 -2 100 26" preserveAspectRatio="none" focusable="false">${s}</svg>`;
 }
 function motes(){
   seed(860);
   let s='';
   for(let i=0;i<18;i++){const t=rnd(),x=lerp([860,300],[480,700],t)[0]+R(0,280),y=lerp([860,300],[480,700],t)[1]+J(30);s+=S('mote',oval(x,y,R(.9,1.8),R(.9,1.8),5),{smooth:true,k:''});}
   return svg(400,240,800,480,s);
 }
 function caustics(){seed(880);let s='';for(let i=0;i<14;i++){const x=R(0,1600),y=R(60,520);s+=C([[x,y],[x+20,y-8],[x+44,y+4],[x+66,y-6]],'cau',1);}return svg(0,0,1600,600,s);}

 /* The whole place, layered far to near; the page lays the content over it. Built once per page. */
 let roomCache='';
 function room(){
  if(roomCache)return roomCache;
  const [vx,vy,vw,vh]=GEO.view,clouds=[0,1,2].map(n=>`<div class="rv-cloud rv-cloud-${n}" style="top:${[8,20,31][n]}%;width:${[52,38,44][n]}%;height:${[14,10,12][n]}%">${cloud(n)}</div>`).join('');
  const smoke=[0,1,2].map(n=>`<i class="rv-puff rv-puff-${n}">${puff('smk',n)}</i>`).join(''),steam=[0,1,2].map(n=>`<i class="rv-wisp rv-wisp-${n}">${wisp(n)}</i>`).join('');
  roomCache=`<div class="rv-world" aria-hidden="true">
<svg class="rv-l rv-l-wall rv-art" viewBox="0 0 1600 1000" preserveAspectRatio="none" focusable="false">${wall()}</svg>
<div class="rv-bit rv-caustics t-sea" style="${pos(0,0,1600,600)}">${caustics()}</div>
<div class="rv-view rv-l-view t-arch" style="${pos(vx,vy,vw,vh)}">${svg(vx,vy,vw,vh,view())}${clouds}<div class="rv-glints t-land" style="left:0;top:${f((470-vy)/vh*100)}%;width:100%;height:${f(120/vh*100)}%">${glints()}</div><div class="rv-smoke t-land" style="left:${f((1098-vx)/vw*100)}%;top:${f((380-vy)/vh*100)}%;width:6%;height:6%">${smoke}</div><div class="rv-heron t-land" style="left:${f((1110-vx)/vw*100)}%;top:${f((420-vy)/vh*100)}%;width:${f(50/vw*100)}%;height:${f(54/vh*100)}%">${heron()}</div></div>
<div class="rv-port t-sea" style="${pos(...GEO.port,GEO.port[2])}">${svg(GEO.port[0],GEO.port[1],GEO.port[2],GEO.port[2],porthole())}</div>
<svg class="rv-l rv-l-mid rv-art" viewBox="0 0 1600 1000" preserveAspectRatio="none" focusable="false">${mid()}</svg>
<div class="rv-bit rv-motes t-sun" style="${pos(400,240,800,480)}">${motes()}</div>
<svg class="rv-l rv-l-near rv-art" viewBox="0 0 1600 1000" preserveAspectRatio="none" focusable="false">${near()}</svg>
<div class="rv-bit rv-glow" style="${pos(GEO.lamp[0]-140,GEO.lamp[1]-30,GEO.lamp[2]+160,GEO.lamp[3]+40)}">${glow()}</div>
<div class="rv-bit rv-chain" style="${pos(1505,566,10,62)}">${chain()}</div>
<div class="rv-bit rv-leaf" style="${pos(GEO.book[0]+100,GEO.book[1]+18,100,26)}">${page()}</div>
<div class="rv-bit rv-steam" style="${pos(1512,600,40,70)}">${steam}</div>
</div>`;
  return roomCache;
 }

 /* ---------- the deck's own things: boxes, cards, piles, seals, tags, keys ---------- */
 const boxCache=new Map();
 // A card box seen a little from the front and above: the back wall's top edge and its inside in shadow, the side
 // walls' top edges, one compartment for new cards and one for each step, dividers with tabs (their labels show on
 // hover), cards standing in each with staggered tops (one dog-eared), then the front wall: a bevel catching the light
 // along its top edge, grain and a knot, finger joints at both corners, worn corners, and a brass label holder held
 // by two screws.
 function cardBox(counts=[],{sticker=false,salt=0}={}){
  const key=counts.join(',')+'|'+sticker+'|'+salt;if(boxCache.has(key))return boxCache.get(key);
  seed(900+salt*31);
  let o=F('bx-sd',[[18,124],[220,122],[217,135],[22,137]],.6)+S('bx-sd',oval(116,131,100,5,16),{smooth:true,k:'',dx:0,dy:0});
  o+=S('bx-kr2',[[14,30],[206,30],[206,92],[14,92]],{step:0,k:'K',j:.5});
  o+=F('bx-in',[[16,35.5],[204,35.5],[204,92],[16,92]],.3)+L([[16,35.5],[204,35.5]],'Kf',.3);
  for(let x=22;x<200;x+=8)o+=L([[x,54],[x+8,40]],'bx-hat',.2);
  o+=S('bx-bev',[[14,30],[19,30],[12,78],[6,78]],{step:0,k:'Kf',j:.2,dx:.5,dy:.5})+S('bx-bev',[[201,30],[206,30],[214,78],[208,78]],{step:0,k:'Kf',j:.2,dx:.5,dy:.5});
  o+=F('bx-in',[[19,31],[22,36],[16,80],[12,78]],.2)+F('bx-in',[[201,31],[198,36],[204,80],[208,78]],.2);
  const steps=['1d','2d','4d','8d','16d','32d','64d'],
    x0=22,
    x1=198,
    sw=(x1-x0)/8,
    shown=counts.map(n=>n?Math.min(5,1+Math.floor(Math.log2(n))):0),
    total=shown.reduce((a,b)=>a+b,0),
    ear=total?I(0,total-1):-1;
  let ci=0;
  // each day tab stands on its own divider (19 of the section's 22 units) and the stagger is in height: staggered
  // sideways, every third tab ran across the next one (4d into 8d, 32d into 64d)
  for(let i=0;i<8;i++){
   const sx=x0+i*sw;
   if(i){
     const tx=sx,top=i%2?17:14.5;
     o+=`<g class="bx-divider" style="--i:${i}">`+
       S('bx-div',[[sx,30],[sx+sw-3,30],[sx+sw-3,90],[sx,90]],{step:0,k:'Kf',j:.3})+
       S('bx-tab',[[tx,30],[tx+1,top],[tx+sw-4,top],[tx+sw-3,30]],{step:0,k:'K',j:.3,dx:.8,dy:.8})+
       `<text class="bx-step" x="${f(tx+(sw-3)/2)}" y="27" text-anchor="middle">${steps[i-1]}</text></g>`;
   }
   for(let k=0;k<shown[i];k++){
    const cx=sx+3+k*2.2,cy=38+k*2.4-(k%2)+R(-1.4,2.2),w=sw-8,front=k===shown[i]-1,dog=ci++===ear;
    const edge=dog?[[cx,cy],[cx+w-4.5,cy],[cx+w,cy+4.5],[cx+w,cy+48],[cx,cy+48]]:[[cx,cy],[cx+w,cy],[cx+w,cy+48],[cx,cy+48]];
    o+=`<g class="bx-c">`+
      S('bx-card',edge,{step:0,k:'Kf',j:.25,dx:.6,dy:.6})+
      L([[cx+2,cy+4],[cx+w-(dog?5:2),cy+4]],'bx-rule',.15)+
      (front?L([[cx+2,cy+9],[cx+w-2,cy+9]],'bx-blue',.1)+L([[cx+2,cy+13.5],[cx+w-2,cy+13.5]],'bx-blue',.1):'')+
      (dog?S('bx-div',[[cx+w-4.5,cy],[cx+w-4,cy+4.2],[cx+w,cy+4.5]],{step:0,k:'Kf',j:.1,dx:.3,dy:.3}):'')+
      `</g>`;
   }
  }
  o+=S('bx-kr',[[6,78],[214,78],[212,128],[8,128]],{step:0,k:'K',j:.6});
  o+=F('bx-bev',[[7,79],[213,79],[212.6,84],[7.4,84]],.2)+L([[10,80.3],[210,80.1]],'kh2',.15)+L([[8,84.5],[212,84.3]],'Kf',.3);
  o+=L([[24,92],[204,91]],'bx-gr',.4)+
    L([[14,106],[90,105],[150,107],[206,105]],'bx-gr',.6)+
    L([[14,120],[208,119]],'bx-gr',.4)+
    C(oval(186,99,5,1.6,8,.2).concat([[191,99]]),'bx-gr')+
    C(oval(186,99,1.8,.6,6,.1).concat([[187.8,99]]),'bx-gr');
  for(const [ex,dir] of [[6.5,1],[213.5,-1]])
    for(let k=0;k<5;k++){
      const y=86+k*8.2;
      if(k%2===0)o+=S('bx-kr2',[[ex,y],[ex+dir*7,y],[ex+dir*7,y+8],[ex,y+8]],{step:0,k:'Kf',j:.15,dx:.3,dy:.3})+C([[ex+dir*1.6,y+2],[ex+dir*4.2,y+4],[ex+dir*1.6,y+6]],'Kf');
    }
  o+=F('bx-wear',[[9,117],[22,120],[24,128],[9,128]],.5)+
    F('bx-wear',[[211,116],[198,120],[196,128],[211,128]],.5)+
    L([[30,125],[38,124.4]],'Kf',.2)+
    L([[170,126],[182,125.4]],'Kf',.2)+
    L([[96,127],[102,126.6]],'Kf',.2);
  o+=S('bx-br',rect(42,86,136,32),{step:0,k:'K',j:.4})+L([[45,88.4],[175,88.4]],'kh2',.15)+S('bx-pp',rect(50,90,120,24),{step:0,k:'Kf',j:.3})+F('bx-br2',[[50,90],[170,90],[169.4,92.4],[50.6,92.4]],.1);
  for(const sx of [46,174]){
    o+=S('bx-br2',oval(sx,102,2.4,2.4,8,.1),{smooth:true,k:'K',dx:.4,dy:.5});
    const a=R(0,Math.PI);
    o+=L([[sx-Math.cos(a)*1.7,102-Math.sin(a)*1.7],[sx+Math.cos(a)*1.7,102+Math.sin(a)*1.7]],'Kf',.05);
  }
  o+=hatch(188,112,6,3,'Kf');
  // the done sticker goes on the front's right-hand corner, clear of the plate
  if(sticker)o+=`<g class="bx-sticker">${S('bx-gold',rot(starPts(196,101,12),196,101,-12),{step:0,k:'K',j:.3})}</g>`;
  const out=`<svg class="rv-boxart" viewBox="0 0 220 140" focusable="false" aria-hidden="true">${o}</svg>`;
  boxCache.set(key,out);
  if(boxCache.size>80)boxCache.delete(boxCache.keys().next().value);
  return out;
 }
 // An index card up close: red top rule and blue lines on the front; on the back the ruling shows faintly through.
 // The card has a thickness (a second, lighter line just below and right), a corner chosen by v (a dog-ear, a curl,
 // or a worn corner with a faint tea ring), the paper's tooth in the margins and a pencil dot. One pen wide throughout.
 const cardCache={};
 function cardFace(kind='front',v=0){
  const key=kind+v;if(cardCache[key])return cardCache[key];seed(950+v*7+(kind==='front'?0:3));
  const front=kind==='front',corner=v%3;
  const shape=corner===0?[[5,5],[454,5],[493,42],[493,293],[5,293]]:corner===1?[[5,5],[493,5],[493,258],[466,293],[5,293]]:[[5,5],[493,5],[493,293],[20,293],[5,279]];
  let o=S('cd-paper',shape,{step:90,k:'K',j:1,dx:4,dy:5});
  o+=L(corner===1?[[14,297.4],[460,297.4]]:corner===2?[[24,297.4],[490,297.4]]:[[12,297.4],[490,297.4]],'Kf',.4)+
    L(corner===0?[[497.4,48],[497.4,290]]:corner===1?[[497.4,12],[497.4,252]]:[[497.4,12],[497.4,290]],'Kf',.4);
  const end=y=>corner===1&&y>250?458:484;
  if(front){o+=L(split([[16,66],[484,64]],120,false),'cd-rule',.8);for(let y=92;y<286;y+=24)o+=L(split([[16,y],[end(y),y+J(.8)]],160,false),'cd-blue',.6);}
  else{
    let show=L(split([[484,66],[16,64]],120,false),'cd-rule',1);
    for(let y=92;y<286;y+=24)show+=L(split([[end(y),y],[16,y+J(.8)]],160,false),'cd-blue',.8);
    o+=G('cd-show',show)+L([[30,40],[40,36]],'Kf',.3);
  }
  if(corner===0)o+=F('cd-sh',[[458,46],[494,44],[490,52],[462,53]],.4)+S('cd-paper2',[[454,5],[457,43],[493,42]],{step:0,k:'K',j:.4,dx:1.5,dy:1.8})+L([[463,30],[477,35]],'Kf',.2);
  if(corner===1)
    o+=F('cd-sh',[[470,297],[497,264],[501,274],[478,301]],.4)+
      S('cd-paper2',[[493,258],[499,272],[494,286],[466,293],[484,280]],{smooth:true,k:'K',j:.3,dx:1.2,dy:1.4})+
      C([[490,267],[486,278],[476,287]],'Kf');
  if(corner===2)o+=hatch(14,262,7,2,'Kf')+C(oval(426,238,30,26,16,1.2).slice(0,13),'cd-ring')+C(oval(424,240,25,21,14,1).slice(3,10),'cd-ring');
  for(let i=0;i<14;i++){const x=rnd()<.5?R(14,70):R(424,480),y=R(16,282);o+=L([[x,y],[x+R(3,7),y+J(1.2)]],'cd-tooth',.2);}
  o+=hatch(corner===1?414:450,268,10,3,'Kf');
  return cardCache[key]=`<svg class="rv-paper" viewBox="0 0 500 300" preserveAspectRatio="none" focusable="false" aria-hidden="true">${o}</svg>`;
 }
 // A pile of done cards lying flat: each card shows its edge, the pile fans a little, the top card is ruled, and its
 // shadow sits right under the bottom card. No cards yet: a pencilled place where they will go.
 function pile(n,{salt=0}={}){
  seed(980+salt+n*3);const shown=Math.min(9,n);let o='';
  if(!shown){
    for(const [a,b] of [[[12,42],[52,41]],[[70,41],[128,42]],[[129,48],[130,86]],[[128,88],[88,89]],[[64,89],[12,88]],[[11,80],[11,50]]])o+=L([a,b],'cd-lead',.4);
    return `<svg class="rv-pileart" viewBox="0 0 140 112" focusable="false" aria-hidden="true">${o}</svg>`;
  }
  const cards=Array.from({length:shown},(_,k)=>({y:88-k*3.2,ang:k===shown-1?J(1.2):J(3.2),dx:J(2.6)})),b=cards[0];
  o+=F('bx-sd',rot(rect(15+b.dx,b.y-43,120,48),74+b.dx,b.y-19,b.ang),.4)+S('bx-sd',oval(74,90.6,60,3,14),{smooth:true,k:'',dx:0,dy:0});
  cards.forEach((c,k)=>{const top=k===shown-1,T=p=>rot(p,70+c.dx,c.y-22,c.ang);
   o+=S('cd-paper',T(rect(10+c.dx,c.y-46,120,48)),{step:0,k:top?'K':'Kf',j:.4,dx:1,dy:1.2})+L(T([[12+c.dx,c.y+3.6],[129+c.dx,c.y+3.4]]),'Kf',.2);
   if(top){o+=L(T([[16+c.dx,c.y-37],[124+c.dx,c.y-37.4]]),'cd-rule',.3);for(const yy of [c.y-28,c.y-19,c.y-10])o+=L(T([[16+c.dx,yy],[124+c.dx,yy]]),'cd-blue',.3);o+=hatch(106+c.dx,c.y-9,6,3,'Kf');}
  });
  return `<svg class="rv-pileart" viewBox="0 0 140 112" focusable="false" aria-hidden="true">${o}</svg>`;
 }
 function seal(salt=0){
   seed(1000+salt);
   const p=[];
   for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=i%2?17:19.5;p.push([20+Math.cos(a)*r+J(.6),20+Math.sin(a)*r+J(.6)]);}
   return `<svg class="rv-sealart" viewBox="0 0 40 40" focusable="false" aria-hidden="true">${S('sl',p,{smooth:true,k:'K',dx:1.2,dy:1.4})+C(oval(20,20,12,12,12,.5).concat([[32,20]]),'sl2')}</svg>`;
 }
 function star(salt=0){seed(1020+salt);return `<svg class="rv-starart" viewBox="0 0 40 40" focusable="false" aria-hidden="true">${S('bx-gold',rot(starPts(20,21,17),20,21,-10),{step:0,k:'K',j:.4,dx:1.2,dy:1.4})+L([[14,16],[18,14]],'kh2',.2)}</svg>`;}
 // Drawn frames for controls: kinds clay, paper, again, good, easy, tag, slip. Stretched; the pen stays one width.
 const frameCache={};
 // vw: the frame's width in drawing units when it is sized to what it carries (a label tag), so its hole and its end
 // keep their shape and the paper ends just past the words
 function frame(kind='paper',salt=0,vw=120){
  vw=Math.max(60,Math.min(480,Math.round(+vw)||120));const key=kind+salt+'/'+vw;if(frameCache[key])return frameCache[key];seed(1100+salt*13+kind.length);
  let o;if(kind==='tag'&&vw!==120)o=S('fr-fill',[[10,4],[vw-4,3],[vw-2,37],[10,38],[2,21]],{step:0,k:'K',j:.5,dx:1.6,dy:2})+C(oval(12,21,3,3,8,.2).concat([[15,21]]),'K');
  else if(kind==='tag')o=S('fr-fill',[[10,4],[96,3],[98,37],[10,38],[2,21]],{step:0,k:'K',j:.5,dx:1.6,dy:2})+C(oval(12,21,3,3,8,.2).concat([[15,21]]),'K');
  else o=S('fr-fill',[[4,4],[60,3],[116,4],[117,36],[60,37],[3,36]],{step:0,k:'K',j:.7,dx:2,dy:2.6});
  if(kind==='clay')o+=hatch(98,28,5,3,'fr-h');
  return frameCache[key]=`<svg class="rv-frame rv-frame-${kind}" viewBox="0 0 ${vw} 40" preserveAspectRatio="none" focusable="false" aria-hidden="true">${o}</svg>`;
 }
 function key(salt=0){seed(1200+salt);return `<svg class="rv-keyart" viewBox="0 0 22 20" preserveAspectRatio="none" focusable="false" aria-hidden="true">${S('ky',[[2,2],[20,2],[20,17],[2,18]],{step:0,k:'K',j:.35,dx:.8,dy:1})+L([[4,15],[18,15]],'Kf',.2)}</svg>`;}
 function pencil(){seed(1220);return `<svg class="rv-pencilart" viewBox="0 0 70 22" focusable="false" aria-hidden="true">${S('yl',[[8,6],[52,4],[53,15],[9,17]],{step:0,k:'K',j:.3})+S('pp',[[52,4],[66,9],[53,15]],{step:0,k:'K',j:.2})+S('ink',[[61,7.2],[66,9],[61.4,11]],{step:0,k:''})+S('rd2',[[2,7],[9,6],[9,17],[2,16]],{step:0,k:'K',j:.2})+S('br',[[8,6],[13,5.6],[13.4,16.6],[9,17]],{step:0,k:'Kf',j:.2})+L([[14,10.6],[50,9.6]],'Kf',.2)}</svg>`;}
 // Big card: a little index card with its corners drawn out (pressed: drawn in)
 function bigCard(on){
   seed(on?1260:1270);
   const c=on?[[[3,8],[7,8],[7,4]],[[27,8],[23,8],[23,4]],[[3,16],[7,16],[7,20]],[[27,16],[23,16],[23,20]]]:[[[1,6],[1,1],[6,1]],[[24,1],[29,1],[29,6]],[[1,18],[1,23],[6,23]],[[29,18],[29,23],[24,23]]];
  return `<svg class="rv-bigart" viewBox="0 0 30 24" focusable="false" aria-hidden="true">${S('pp',rect(5.5,5,19,14),{step:0,k:'K',j:.25,dx:.7,dy:.8})+L([[7.5,8.6],[22.5,8.4]],'cd-rule',.1)+L([[7.5,12],[22.5,12]],'cd-blue',.1)+L([[7.5,15.2],[22.5,15.2]],'cd-blue',.1)}${c.map(p=>L(p,'Kl',.2)).join('')}</svg>`;}
 function arrows(out){
   seed(out?1240:1250);
   const a=out?[[[5,15],[15,5]],[[9,5],[15,5],[15,11]],[[5,9],[5,15],[11,15]]]:[[[5,15],[15,5]],[[5,11],[5,15],[9,15]],[[11,5],[15,5],[15,9]]];
   return `<svg class="rv-arrows" viewBox="0 0 20 20" focusable="false" aria-hidden="true">${a.map(p=>L(p,'Kl',.25)).join('')}</svg>`;
 }
 function dot(r=5,salt=0){seed(1300+salt);return `<svg class="rv-dotart" viewBox="-10 -10 20 20" focusable="false" aria-hidden="true">${S('dt',oval(0,0,r,r,9,.25),{smooth:true,k:'K',dx:.5,dy:.6})}</svg>`;}
 function plus(){seed(1320);return L([[250,110],[250,190]],'K',1.2)+L([[210,150],[290,150]],'K',1.2);}
 function sheet(){seed(1340);return `<svg class="rv-sheetart" viewBox="0 0 400 260" preserveAspectRatio="none" focusable="false" aria-hidden="true">${S('cd-paper',rect(4,4,392,252),{step:60,k:'K',j:1.2,dx:4,dy:5})}</svg>`;}
 // The catalogue drawer, pulled out of the cabinet and seen from above the front: the inside of its back and side
 // walls in shadow, the top edges of the cards standing at the back with two guide tabs among them, the sheet the
 // cards are laid out on, and the front with a bevelled edge, grain, finger joints and worn corners. Stretched to the
 // drawer's size; the holder and the pull ring are drawn to their own shape (drawerFront).
 function drawer(){
  seed(1360);let o=S('bx-kr2',rect(10,10,580,382),{step:80,k:'K',j:1,dx:4,dy:5})+F('bx-bev',[[12,11],[588,11],[588,15],[12,15]],.3);
  o+=F('bx-in',[[18,16],[582,16],[570,30],[30,30]],.4)+F('bx-in',[[18,16],[30,30],[30,346],[18,346]],.4)+F('bx-in',[[582,16],[570,30],[570,346],[582,346]],.4);
  for(let y=40;y<330;y+=24)o+=L([[20,y+10],[28,y]],'bx-hat',.3)+L([[572,y+10],[580,y]],'bx-hat',.3);
  for(let k=0;k<5;k++){const y=18+k*2.8,xa=36+J(4),xb=564+J(4);o+=S('bx-card',[[xa,y],[xb,y],[xb,y+5],[xa,y+5]],{step:120,k:'Kf',j:.4,dx:.4,dy:.5});}
  o+=S('bx-tab',[[180,24],[182,14],[226,14],[228,24]],{step:0,k:'K',j:.3,dx:.6,dy:.6})+S('bx-tab',[[420,28],[421,20],[458,20],[460,28]],{step:0,k:'K',j:.3,dx:.6,dy:.6});
  o+=S('bx-pp',rect(30,34,540,310),{step:90,k:'Kf',j:.8})+hatch(540,320,8,3,'Kf');
  o+=S('bx-kr',[[4,340],[596,340],[592,396],[8,396]],{step:90,k:'K',j:.8})+F('bx-bev',[[5,341],[595,341],[594.6,347],[5.4,347]],.3)+L([[10,342.4],[590,342]],'kh2',.3)+L([[6,347.6],[594,347.2]],'Kf',.4);
  o+=L([[14,360],[586,359]],'bx-gr',.6)+L([[14,376],[200,375],[400,377],[586,375]],'bx-gr',.6)+L([[20,388],[586,387]],'bx-gr',.5);
  for(const [ex,dir] of [[4.5,1],[595.5,-1]])for(let k=0;k<6;k++){const y=349+k*7.8;if(k%2===0)o+=S('bx-kr2',[[ex,y],[ex+dir*9,y],[ex+dir*9,y+7.8],[ex,y+7.8]],{step:0,k:'Kf',j:.15,dx:.3,dy:.3});}
  o+=F('bx-wear',[[8,384],[28,388],[30,396],[8,396]],.5)+F('bx-wear',[[592,384],[572,388],[570,396],[592,396]],.5)+hatch(540,384,7,3,'Kf');
  return `<svg class="rv-drawerart" viewBox="0 0 600 400" preserveAspectRatio="none" focusable="false" aria-hidden="true">${o}</svg>`;
 }
 // The drawer's front fittings: a brass label holder on two screws (the page writes "Cards" in it) and a pull ring
 // hanging from its plate, the ring's shadow set off below it.
 function drawerFront(){
  seed(1380);
  let o=S('bx-br',rect(10,5,140,36),{step:0,k:'K',j:.4,dx:1.2,dy:1.5})+
    L([[13,7.5],[147,7.5]],'kh2',.15)+
    S('bx-pp',rect(18,11,124,24),{step:0,k:'Kf',j:.3})+
    F('bx-br2',[[18,11],[142,11],[141.4,13.6],[18.6,13.6]],.1);
  for(const sx of [14,146]){
    o+=S('bx-br2',oval(sx,23,2.6,2.6,8,.1),{smooth:true,k:'K',dx:.4,dy:.5});
    const a=R(0,Math.PI);
    o+=L([[sx-Math.cos(a)*2,23-Math.sin(a)*2],[sx+Math.cos(a)*2,23+Math.sin(a)*2]],'Kf',.05);
  }
  const ro=oval(80,58,12,9,16,.2),ri=oval(80,58,7.6,5.2,14,.15);
  o+=S('bx-sd',oval(84,61.5,12,8.4,14),{smooth:true,k:'',dx:0,dy:0})+
    S('bx-br',[[66,44],[94,44],[90,51],[70,51]],{smooth:true,k:'K',dx:.6,dy:.8})+
    S('bx-br2',oval(72,47.4,1.4,1.4,6),{smooth:true,k:''})+
    S('bx-br2',oval(88,47.4,1.4,1.4,6),{smooth:true,k:''});
  o+=`<path class="bx-br" fill-rule="evenodd" d="${cv(ro,true)} ${cv(ri,true)}"/>`+C(over(ro),'K')+C(over(ri),'Kf')+C([[70,54],[73,51],[78,50]],'kh2');
  return `<svg class="rv-drawerfront" viewBox="0 0 160 70" focusable="false" aria-hidden="true">${o}</svg>`;
 }
 // The new-card slot: a squared stack of blank ruled cards, a pencilled plus on the top one, a pencil lying across.
 function newCard(){
  seed(1400);let o=F('bx-sd',[[22,116],[188,113],[184,124],[26,126]],.6);
  for(let k=0;k<5;k++){const y=104-k*3.4,a=-2+J(1.1),ddx=J(1.6),T=p=>rot(p,98+ddx,y-37,a),top=k===4;
   o+=S('cd-paper',T(rect(20+ddx,y-74,156,74)),{step:0,k:top?'K':'Kf',j:.5,dx:1.2,dy:1.4})+L(T([[22+ddx,y+2],[174+ddx,y+1.8]]),'Kf',.2);
   if(top){
     o+=L(T([[26+ddx,y-60],[170+ddx,y-60.4]]),'cd-rule',.3);
     for(const yy of [y-47,y-35,y-23,y-11])o+=L(T([[26+ddx,yy],[170+ddx,yy]]),'cd-blue',.3);
     o+=L(T([[98+ddx,y-50],[98+ddx,y-24]]),'cd-lead',.5)+L(T([[85+ddx,y-37],[111+ddx,y-37]]),'cd-lead',.5)+hatch(150+ddx,y-14,6,3,'Kf');
   }
  }
  const P=p=>rot(p,104,64,-16);
  o+=F('cd-sh',P([[38,70],[170,66],[170,73],[38,77]]),.3);
  o+=S('bx-gold',P([[46,58],[150,56],[150,64],[46,66]]),{step:0,k:'K',j:.3,dx:.6,dy:.8})+
    L(P([[52,61],[146,59.6]]),'Kf',.1)+
    S('cd-paper',P([[150,56],[166,60],[150,64]]),{step:0,k:'K',j:.2,dx:.4,dy:.5})+
    S('bx-ink',P([[161,58.7],[166,60],[161,61.3]]),{step:0,k:''});
  o+=S('bx-br',P([[38,57.6],[46,58],[46,66],[38,66.2]]),{step:0,k:'K',j:.2,dx:.4,dy:.5})+
    L(P([[41,57.8],[41,66.1]]),'Kf',.05)+
    L(P([[43.4,57.9],[43.4,66.1]]),'Kf',.05)+
    S('bx-era',P([[30,58.2],[38,57.6],[38,66.2],[30,65.8]]),{step:0,k:'K',j:.2,dx:.4,dy:.5});
  return `<svg class="rv-newart" viewBox="0 0 200 130" preserveAspectRatio="none" focusable="false" aria-hidden="true">${o}</svg>`;
 }
 // The low step the back row of boxes stands on: a top board seen a little from above, a front face with a bead and
 // grain, two bun feet, its shadow on the table. Its width follows how many boxes stand on it.
 function riser(n=2){
  seed(1460+n);const W=Math.round(Math.max(1,n)*175.4+(Math.max(1,n)-1)*22+32);let o=F('sd',[[6,36],[W-2,36],[W-8,44],[2,44]],.4);
  o+=S('wd',[[2,0],[W-2,0],[W-6,8],[6,8]],{step:120,j:.4,dx:.8,dy:.8})+L([[8,2.6],[W-8,2.6]],'kh',.3);
  o+=S('wd3',rect(6,8,W-12,26),{step:120,j:.4,dx:.8,dy:1})+L([[10,11],[W-10,11]],'kh',.3)+L([[10,30],[W-10,30]],'kf',.3);
  for(let i=0;i<3;i++){let x=12;while(x<W-30){const len=R(40,140),y=15+i*5;o+=L([[x,y+J(.8)],[Math.min(W-12,x+len),y+J(.8)]],'kg',.4);x+=len+R(10,40);}}
  for(const fx of [24,W-24])o+=S('wd2',oval(fx,37,10,4,10,.2),{smooth:true});
  o+=hatch(W-44,20,6,3,'kf');
  return `<svg class="rv-riserart" viewBox="0 0 ${W} 44" preserveAspectRatio="none" focusable="false" aria-hidden="true">${o}</svg>`;
 }
 // The card's shadow on the wall or the table: an offset wash, never a blur.
 function shadow(){seed(1420);return `<svg class="rv-shadowart" viewBox="0 0 500 300" preserveAspectRatio="none" focusable="false" aria-hidden="true">${S('cd-shadow',rect(6,8,486,282),{step:120,k:'',j:2.4,dx:0,dy:0})}</svg>`;}
 // The entrance: a paper wash sweeps across the page and the room is left behind it.
 function sweep(){
   seed(1440);
   const edge=[];
   for(let i=0;i<=10;i++)edge.push([96+J(3),i*10]);
   return `<svg class="rv-sweepart" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" aria-hidden="true">${F('sw-wash',[[0,-4],...edge,[0,104]],.6)+C(edge,'sw-edge',.4)}</svg>`;
 }
 const api={
   GEO,
   room,
   newCard,
   shadow,
   sweep,
   wall,
   view,
   porthole,
   mid,
   near,
   cardBox,
   cardFace,
   pile,
   seal,
   star,
   frame,
   key,
   pencil,
   bigCard,
   arrows,
   dot,
   plus,
   sheet,
   drawer,
   drawerFront,
   riser,
   heron,
   glow,
   cloud
 };
 root.ReserveReviewDeckArt=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
