/*! Canvas Harness — packaged dashboard scenes. Original creator: Flzsh. */
(function(global){
 'use strict';
 const motifs={
   starry:['moon','star','swirl','cypress','cottage','sunflower'],
   sea:['turtle','fish','coral','jelly','shell','ray'],
   stars:['giant','binary','galaxy','redgiant','cluster','nebula'],
   blueprint:['gear','divider','pendulum','rocket','orbit','bulb'],
   maple:['maple','acorn','pumpkin','pinecone','oak','apple'],
   thanksgiving:['turkey','horn','pie','lantern','corn','squash'],
   christmas:['tree','gift','stocking','cane','flake','mug'],
   train:['cat','kettle','lamp','mug','plant','bear']
 };
 const names=Object.freeze({
   starry:'Starry Night',
   sea:'Under the Sea',
   stars:'Starfield',
   blueprint:'Blueprint',
   maple:'Maple Wind',
   thanksgiving:'Thanksgiving',
   christmas:'Christmas',
   train:'Soul Passage'
 });
 /* A scene's sky may be a band in the band's own words (band-kit.js) instead of a video: pictures
    laid over each other that follow the student's clock (the clock the band reads for "time"). Soul Passage: the land
    outside, a different one each weekday, fills the band's top half; over it lies the cabin, whose window glass is clear.
    Both come in five stages of the day that cross-fade over 40 minutes. The band itself is Sunday's and six variants name
    the other days (when.days), so no look has more than ten pieces and no pack limit had to move. Only the pictures shown
    now are read (two, four while a fade runs); at a new stage or day the shown ones stay until all the next are in. */
 const weekLands=['grove','sea','peaks','clouds','metro','citadel','mesa'],dayStages=['morning','noon','sunset','dusk','night'];
 // A picture whose decode() was rejected is not a broken picture: a tab at the back puts decoding off, and the browser may
 // reject the promise although the file is whole. Its own load (or error) says which it is.
 // (fresh: the source is about to be set, so `complete` says nothing yet)
 const pictureIn=(img,fresh)=>new Promise((ok,no)=>{
  if(!fresh&&img.complete){if(img.naturalWidth)ok();else no(Error('picture'));return;}
  let over=false;
  const end=good=>{
    if(over)return;
    over=true;
    try{img.removeEventListener?.('load',l);img.removeEventListener?.('error',e);}catch{}
    if(img.onload===l)img.onload=null;
    if(img.onerror===e)img.onerror=null;
    if(good)ok();else no(Error('picture'));
  },l=()=>end(true),e=()=>end(false);
  try{img.addEventListener?.('load',l);img.addEventListener?.('error',e);}catch{}
  if(!img.onload)img.onload=l;if(!img.onerror)img.onerror=e;
 });
 const landStages=(land,more)=>dayStages.map(stage=>({draw:{asset:'land-'+land+'-'+stage},at:{x:0,y:0,w:4096,h:256},when:{time:stage,fade:40,...more}})),
   OWN_CABINS=Object.freeze(['citadel','clouds','grove','mesa','metro','peaks','sea']),
   landPieces=land=>[...landStages(land),...(OWN_CABINS.includes(land)?dayStages.map(stage=>({draw:{asset:'cabin-'+land+'-'+stage},at:'all',when:{time:stage,fade:40}})):[{use:'cabin'}])];
 // seven lands, one a weekday (4.2.2: the deep sea, which had Thursday in odd weeks of the year, is gone; the glass city has every
 // Thursday, so no land takes turns by the week any more)
 const landOfDay=day=>weekLands[day]||'';
 const bands=Object.freeze({train:Object.freeze({asset:'poster',box:[4096,512],keep:{x:2000,y:0,w:2096,h:512},text:'auto',
  times:{morning:['05:00','10:30'],noon:['10:30','15:00'],sunset:['15:00','19:00'],dusk:['19:00','23:00'],night:['23:00','05:00']},
  recipes:{cabin:dayStages.map(stage=>({draw:{asset:'cabin-'+stage},at:'all',when:{time:stage,fade:40}}))},
  pieces:landPieces(weekLands[0]),
  variants:['mon','tue','wed','thu','fri','sat'].map((day,i)=>({when:{days:[day]},pieces:landPieces(weekLands[i+1])}))})});
 // the page colour under the band's faded left end, for text "auto"
 const bandPaper=Object.freeze({train:{light:'#F7EEE6',dark:'#1A1C4A'}});
 // a scene whose band travels names its ride (bandRide): the file in its folder that says what the pictures are made of
 const rides=Object.freeze({train:'ride.json'});
 // and such a band has a page of its own in its folder: inside the extension it runs there, in a frame (frameBand)
 const pages=Object.freeze({train:'band.html'});
 /* MEGAPACK (4.2): a scene whose pictures and data come down from the Market instead of with the package (megapack
    engine 1). They live in the extension's own Cache Storage `cache`, each under its Market
    address (`host` + the "<sha256>.<ext>" the local record `key` maps its name to: {version,engine,bytes,count,manifest,names,at},
    written only once every file is stored and checked). `kind`: the files of the downloaded kind (the frames' pictures and the
    land's data); ride.json, the kits, the lever, the icons and the poster always come with the package. */
 const MEGAPACK=Object.freeze({
   train:Object.freeze({id:'soul-passage',cache:'megapack-soul-passage',key:'megapack:soul-passage',host:'https://flzsh.github.io/canvas-harness-packs/megapacks/soul-passage/files/',kind:/^(?:(?:page|land|cabin|pieces|flow|sprites|glow|alt|ids|clear|under|sun|live)-[a-z0-9-]+\.(?:webp|png|json)|under\.webp)$/})
 });
 const megaRecords=new Map(),megaHere=new Map(),packagedMemo=new Map();let megaWatching=false,megaGate=null;
 const megaNames=rec=>rec&&typeof rec==='object'&&rec.names&&typeof rec.names==='object'&&!Array.isArray(rec.names)?rec.names:null;
 // the local record, read once a document and again whenever it changes (a download ends, the megapack is removed)
 function megaRecord(mp){
  if(!megaWatching){
    megaWatching=true;
    try{
      global.chrome?.storage?.onChanged?.addListener?.((changes,area)=>{
        if(area!=='local'||!changes)return;
        for(const [sceneId,m]of Object.entries(MEGAPACK))if(Object.hasOwn(changes,m.key)){megaRecords.delete(m.key);megaHere.delete(sceneId);megaChanged(sceneId);}
      });
    }catch{}
  }
  if(!megaRecords.has(mp.key))
    megaRecords.set(mp.key,new Promise(ok=>{
      try{
        const got=global.chrome?.storage?.local?.get?.(mp.key,value=>ok(value?.[mp.key]??null));
        if(got&&typeof got.then==='function')got.then(value=>ok(value?.[mp.key]??null),()=>ok(null));else if(!global.chrome?.storage?.local?.get)ok(null);
      }catch{ok(null);}
    }));
  return megaRecords.get(mp.key);
 }
 // read(name) -> a Response, for every file a scene's pages read: the store first (only a page of the extension's own sees it;
 // Canvas's page never does), then the package, so a build that carries the files works as before. `base` is the scene's folder;
 // a full address under it is taken as its name.
 function reader(base){
  const id=/\/themes\/([a-z]+)\/$/.exec(String(base))?.[1],mp=id?MEGAPACK[id]:null,own=String(global.location?.protocol)==='chrome-extension:'&&typeof global.caches?.open==='function';
  return url=>{
   const name=String(url).startsWith(base)?String(url).slice(String(base).length):String(url),pack=()=>global.fetch(base+name);
   if(!mp||!own||!mp.kind.test(name))return pack();
   return megaRecord(mp).then(rec=>{const file=megaNames(rec)?.[name];if(typeof file!=='string'||!/^[0-9a-f]{64}\.(?:webp|png|json)$/.test(file))return pack();
    return global.caches.open(mp.cache).then(cache=>cache.match(mp.host+file)).then(hit=>hit||pack(),()=>pack());},()=>pack());
  };
 }
 // whether this build carries a megapack's files itself (they are among the files the manifest lets Canvas's page load)
 function packaged(id){
  const mp=MEGAPACK[id];if(!mp)return true;
  if(!packagedMemo.has(id)){
    let yes=true;
    try{
      const m=global.chrome?.runtime?.getManifest?.(),dir='themes/'+id+'/';
      if(m&&Array.isArray(m.web_accessible_resources))
        yes=m.web_accessible_resources.some(g=>Array.isArray(g?.resources)&&g.resources.some(f=>typeof f==='string'&&f.startsWith(dir)&&mp.kind.test(f.slice(dir.length))));
    }catch{}
    packagedMemo.set(id,yes);
  }
  return packagedMemo.get(id);
 }
 // where a scene stands for the picker: 'packaged' (its files come with this build), 'here' (all downloaded) or 'none'
 function megapackState(id){const mp=MEGAPACK[id];if(!mp||packaged(id))return Promise.resolve('packaged');return megaRecord(mp).then(rec=>megaNames(rec)?'here':'none');}
 // and the land under its room (rooms.pages) a page of its own too (framePage)
 const landPages=Object.freeze({train:'page.html'});
 // (engine 2, part 2: the land's own page may paint the land (painter.js, WebGL2) in the window and under the room)
 const PAINT=true;
 /* A band that is a room names the room's daylight (rooms), for the page under it: the page's floor starts at the row
    the cabin's floor does (floor, in the picture's own pixels), and the windows throw their light on it. windows: every
    window's panes along the picture's first row. hours: for each stage of the day with sun or moon, how that light lies
    below the band: its lean as it comes toward us (x for each y), how far down the page it reaches and how far along
    the room it has slid when it leaves the band (both as drawn at the scale `at`), its colour, its strength on the
    floor (a) and over what lies there (over, in the colour `top` when that is another), the shade between and beside
    the panes (dim), and how dark the passing land's shadows are in it (shade). The colours are the cabin's own floor at
    that hour, lit against unlit. A stage that is not named has no light. `band` is the band's height on every menu:
    a room's picture never changes size with the menu's header (the page under it is its floor either way). Every beam also takes the ride: it leans a
    little further and back as the car sways and shivers, half as much, at each rail joint (sway: degrees for one unit
    of the ride). */
 const rooms=Object.freeze({
   train:Object.freeze({
     pages:{
       "metro":{"stages":{},"foot":{"morning":"#728ada","noon":"#8aa3eb","sunset":"#3353a8","dusk":"#264c9e","night":"#1c3478"},"move":[[1,39.0],[2,78.0],[3,234.0]],"live":1,"flow":[0,1,2,3],"sprites":2,"sun":1,"lights":[1,2],"clear":1,"cabin":1},
       "clouds":{"stages":{},"foot":{"morning":"#dfd6d7","noon":"#cad1e4","sunset":"#d5ad9b","dusk":"#bd94ac","night":"#586dab"},"move":[[1,39.0],[2,78.0],[3,234.0]],"live":1,"flow":[0,1,2,3],"sun":1,"sprites":2,"cabin":1},
       "citadel":{"stages":{},"foot":{"morning":"#98bae6","noon":"#5ac8df","sunset":"#8974bd","dusk":"#3b3e88","night":"#161c47"},"move":[[1,39.0],[2,78.0],[3,234.0]],"live":1,"flow":[0,1,2,3],"sun":1,"sprites":2,"lights":[1,2],"clear":1,"cabin":1},
       "mesa":{"stages":{"morning":"noon","dusk":"night"},"foot":{"noon":"#0a1824","sunset":"#1a191a","night":"#172123"},"move":[[1,39.0],[2,78.0],[3,234.0]],"live":1,"flow":[1,2,3],"sprites":2,"sun":1,"cabin":1},
       "grove":{"stages":{"morning":"noon","dusk":"night"},"foot":{"noon":"#598236","sunset":"#353d03","night":"#152f17"},"move":[[1,39.0],[2,78.0],[3,234.0]],"live":1,"flow":[1,2,3],"sprites":2,"sun":1,"lights":[1,2],"cabin":1},
       "sea":{"stages":{"morning":"noon","dusk":"night"},"foot":{"noon":"#195ccf","sunset":"#303073","night":"#071030"},"move":[[1,6.0],[2,54.0],[3,234.0]],"live":1,"flow":[0,1,2,3],"sprites":2,"sun":1,"cabin":1},
       "peaks":{"stages":{"morning":"noon","dusk":"night"},"foot":{"noon":"#8794a2","sunset":"#5d6c96","night":"#2a4877"},"move":[[1,39.0],[2,78.0],[3,234.0]],"live":1,"flow":[1,2,3],"sprites":2,"sun":1,"lights":[2],"cabin":1}
     },
     box:[4096,512],
     lever:{x:2602,y:204,w:78,h:42,zoom:3,cell:240,sheet:[1200,300],stops:[12,30,48,66],half:9,knob:14,track:31,grow:2.4,paces:[0,.33,1,4],names:['Stopped','Slow','Cruise','Fast']},
     floor:430,
     band:268,
     at:.6,
     windows:[[[28,287],[293,552],[558,808]],[[2332,2521],[2526,2794],[2799,3067],[3100,3341],[3346,3614],[3619,3813]]],
  hours:{morning:{lean:.95,reach:540,shift:250,col:[255,238,205],a:.62,over:.10,dim:[120,62,44,.085],shade:.24},
   noon:{lean:.22,reach:300,shift:30,col:[255,247,230],a:.55,over:.06,dim:[120,62,44,.075],shade:.3},
   sunset:{lean:-.85,reach:660,shift:-80,col:[255,170,92],a:.58,over:.17,dim:[112,52,60,.10],shade:.34},
   dusk:{lean:-.85,reach:600,shift:-80,col:[214,98,182],a:.5,over:.09,top:[246,176,236],dim:[40,20,80,.11],shade:.2},
   night:{lean:-.85,reach:560,shift:-80,col:[46,128,196],a:.5,over:.08,top:[176,208,255],dim:[8,14,50,.12],shade:.2}},sway:.6})});
 const lum=hex=>{const n=parseInt(String(hex).slice(1),16);return Number.isFinite(n)?((n>>16&255)*.2126+(n>>8&255)*.7152+(n&255)*.0722)/255:.5;},clamp01=n=>Math.max(0,Math.min(1,n));
 // the words on a band: text "auto" turns the greeting light or dark when the picture under it calls for the other tone
 // than the theme's own ink (as a pack's band does, data-theme.js bandWords)
 function bandWords(id,tone){
  if(!tone)return '';const scope='.rd.rd.rd.rd.rd[data-theme-kit="'+id+'"]',ink=tone==='light'?'#FBF8F1':'#1F1D1A',back=tone==='light'?'21,19,15':'255,253,248';
  return '\n'+scope+' :is(.rd-workspace-heading,.rd-course-heading) :is(h1,.rd-heading-date,.rd-heading-detail){color:'+ink+'!important;text-shadow:0 1px 2px rgba('+back+',.8),0 0 18px rgba('+back+',.85)!important;}'+scope+' .rd-course-heading::before{background:radial-gradient(closest-side,rgba('+back+',.5),rgba('+back+',0))!important;}';
 }
 /* The band that travels (Soul Passage). ride.json in the scene's folder says what the band's pictures are made of.
    A land is a set of strips, each joining itself end to end and passing at its own speed (far slow, near fast).
    The cabin is its picture with every loose or hanging thing cut out as a piece of its own (one sheet per stage);
    a soft thing is a chain of links. ONE RIDE moves all of it: the car's slow sway and the knock at every rail joint
    (never evenly spaced; the same 48 seconds over and over). The land rides up and down against the window; what
    hangs is a pendulum pushed by the sway and kicked by each joint; what stands is knocked and rings at its own
    rate; soft things bend link by link, the far links late; the shadows of what passes close outside run across the
    floor at the speed that layer passes. Every movement is a list of keyframes worked out once and handed to the
    compositor (transform, opacity, filter), so nothing runs per frame on the page, and all start from the same
    moment of the document's clock, so two stages cross-fading move as one. */
 // The ride at a pace (1: the land's own speeds): how fast its loop goes by (the knocks of the rail joints come sooner; what swings
 // swings a little quicker), how much stronger what is outside shakes against the room, and with how much more force the
 // room's own things swing and hop (in small steps, so a change of pace never shows as a jump).
 // (engine 2: below the slow stop the loop slows to a stand with the train, and what swings fades out in steps, so the train coming to
 // a stand never shows as a jump either)
 const rideRate=p=>!(p>0)?0:p<.2?Math.round(.68*Math.sqrt(p/.2)*1e4)/1e4:p<1?.6+.4*p:Math.min(2,1+.2*Math.log2(p)),
   swing=p=>p<.5?.7:p<3?1:1.8,
   force=p=>!(p>0)?1:p<.05?.2:p<.12?.4:p<1?Math.round((.6+.4*p)*5)/5:Math.min(2.2,1+Math.round(.46*Math.log2(p)*4)/4);
 /* Engine 2: the train's speed has inertia. A change of stop is a curve of the speed from where it is (its speed, how fast that
    changes and how fast that changes) to the new stop at rest, smooth to the third derivative (a quintic: the least jerk), as long
    as the felt change needs: about 3 s from Stopped to Cruise, 4 s from Cruise to Fast, braking a fifth quicker (TRAVEL), and
    longer if the acceleration or the jerk would pass their bounds or the speed would dip below a stand. A new choice in the middle
    starts a new curve from that moment's speed, acceleration and jerk, so nothing ever jumps. A travel is told as numbers:
    [the speed it goes to, the moment it began (ms of the band's clock), how far the journey had come then (seconds of travel at the
    land's own speed), how much of the ride's loop had gone by then, and while it changes: the speed, acceleration and jerk it
    began with and how long the change takes (s)]. Every document that moves something works out the same curve from the same
    numbers: where the journey is (x), how fast (v), how hard the train accelerates (a), and how much of the ride's loop has gone by
    (r: the loop goes by at rideRate of the speed). */
 /* A land's own life (engine 2): live-<land>.json in the scene's folder (version 1; see the spec G-train-engine2-spec 2.2): what of
    each layer flows, sways, shimmers, blurs or bobs, the particles and painted sprites that travel in it, light shafts, and how its
    rail rides (ride: knock, rail joints `gap` apart in the bridge's own pixels, bounce, heave, rumble, car "floats"). liveOf reads
    one: a file that is not version 1 or not made as it should be is no file (the land is drawn as before, plain sliding); a part
    that is not right is left out; every number is held within its bounds.
    A sprite may move from its one picture (all optional; a sprite without them is read and drawn exactly as before):
     spin   degrees a second, + clockwise on the screen (-720..720; 0 is none): the cell turns about its pivot for ever
     swing  [degrees, hz] (0..90, 0..5; an amplitude of 0 is none): it rocks like a pendulum about its pivot,
            degrees x sin(2 pi (hz x time + the sprite's phase)); hz 0 is a still tilt
     pivot  [x, y], fractions of the cell from its left and its top (0..1); default [.5, .5] with spin, [.5, 0] (it hangs)
            with swing alone
     squash [x, y] (.05..4 each; default [1, 1]): laid on after the turn, along the screen's x and y, about the pivot (a
            wheel seen at an angle: [.7, 1])
     pulse  [least, most, hz] (0..2, 0..2, 0..10): its light breathes between least and most of its share
    pivot and squash are kept only with spin or swing (alone they do nothing); spin starts at 360 x the phase. A turned cell is
    drawn whole at any angle (its art needs no empty margin); its shadow stays on the ground; `cut` still cuts the unturned
    cell's box; `face` mirrors the drawn sprite, turn and pivot with it. With motion off they stand, as bob and frames do.
    A sprite with frames (more than one, fps above 0) may also have a hit: something that happens to the land each time its loop
    reaches one frame, in step with the frame drawn (its phase included), while the sprite is in view:
     hit    {frame, shake, flash, burst}: frame 0..frames - 1 (rounded, held within the loop; without one the hit is dropped)
      shake [px, seconds] (0..24, 0..2): the land (window and under the room, not the cabin) jolts, added to the ride's own
            knocks: quick knocks, the first straight down, gone after its seconds
      flash [amount, seconds] (0..1.5, 0..2): every layer of the land brightens, its own light and as much toward white, by
            the amount at once, falling back to nothing over its seconds; one flash for the whole land
      burst {kind, count, speed, spread, life}: specks of a particle kind thrown from the sprite's middle: count 0..120
            (default 24), speed art px a second outward (0..2000, default 160), spread degrees about straight up (0..360,
            default 360: all round), life seconds (.05..5, default 1.2); they fly out, slow and fade
     A shake or flash of 0 is none; a hit with none of the three is dropped. Never more often than the loop: a jolt or flash
     longer than the loop ends as the loop comes round. With motion off, Still, reduced or a page at rest: no hit at all. */
 const LIVE_STAGES=['morning','noon','sunset','dusk','night'],PARTICLES=['dust','sand','rain','snow','leaves','petals','fireflies','embers','meteor','bubbles','spray','lanterns','birds'],SHIMMERS=['heat','glint','twinkle','flicker','lightning'];
 const RAIL=Object.freeze({knock:1,gap:2000,bounce:1,heave:[],rumble:.5,floats:false});
 function liveOf(json){
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),num=(v,lo,hi,or)=>Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):or,list=(v,n)=>Array.isArray(v)?v.slice(0,n):[];
  const pair=(v,lo,hi)=>Array.isArray(v)&&v.length>=2&&v.slice(0,2).every(Number.isFinite)?[num(v[0],lo,hi,0),num(v[1],lo,hi,0)]:null;
  const box=v=>Array.isArray(v)&&v.length>=4&&v.slice(0,4).every(Number.isFinite)?[num(v[0],-4096,8192,0),num(v[1],-2250,4500,0),num(v[2],-4096,8192,4096),num(v[3],-2250,4500,2250)]:null;
  const stages=v=>v==='all'||v===undefined?[...LIVE_STAGES]:Array.isArray(v)?LIVE_STAGES.filter(s=>v.includes(s)):null;
  // (a share of a light's period: one number for every hour, or a number for each hour)
  const share=(v,or)=>obj(v)?Object.fromEntries(LIVE_STAGES.map(s=>[s,num(v[s],0,1,or)])):num(v,0,1,or);
  if(!obj(json)||json.v!==1)return null;
  for(const key of ['layers','particles','sprites'])if(json[key]!==undefined&&!Array.isArray(json[key]))return null;
  for(const key of ['shafts','ride','glass'])if(json[key]!==undefined&&!obj(json[key]))return null;
  const layers=[];
  for(const l of list(json.layers,10)){
    if(!obj(l)||!Number.isInteger(l.id)||l.id<0||l.id>9||layers.some(m=>m.id===l.id))continue;
    const sh=obj(l.shimmer)&&SHIMMERS.includes(l.shimmer.kind)?{kind:l.shimmer.kind,amount:num(l.shimmer.amount,0,2,.5),stages:stages(l.shimmer.stages)||[]}:null;
   layers.push({
     id:l.id,
     flowMax:num(l.flowMax,0,400,0),
     sway:obj(l.sway)?{amp:num(l.sway.amp,0,20,0),hz:num(l.sway.hz,.01,5,.3),...(l.sway.kind==='water'?{kind:'water'}:{})}:null,
     shimmer:sh,
     blur:num(l.blur,0,2,0),
     bob:obj(l.bob)?{amp:num(l.bob.amp,0,40,0),hz:num(l.bob.hz,.01,5,.3)}:null,
     ...(obj(l.ripple)?{ripple:{amp:num(l.ripple.amp,0,12,0),hz:num(l.ripple.hz,.02,3,.25),from:num(l.ripple.from,0,2250,0)}}:{}),
     ...(obj(l.rings)?{rings:{amount:num(l.rings.amount,0,1,0),from:num(l.rings.from,0,2250,0),size:num(l.rings.size,6,120,30),rate:num(l.rings.rate,.05,3,.5)}}:{}),
     ...(obj(l.lights)?
       {
         lights:{
           period:(q=>[q[0],Math.max(q[0],q[1])])(pair(l.lights.period,5,7200)||[240,1200]),
           on:share(l.lights.on,.1),
           off:share(l.lights.off,.2),
           bulbs:Array.isArray(l.lights.bulbs)?LIVE_STAGES.filter(s=>l.lights.bulbs.includes(s)):[],
           beacons:Array.isArray(l.lights.beacons)?LIVE_STAGES.filter(s=>l.lights.beacons.includes(s)):[],
           ...(typeof l.lights.fade==='number'?{fade:num(l.lights.fade,.05,4,.12)}:{}),
           ...(l.lights.stutter===0?{stutter:0}:{})
         }
       }:
       {})
   });}
  const particles=[];for(const p of list(json.particles,24)){if(!obj(p)||!PARTICLES.includes(p.kind))continue;const st=stages(p.stages);if(!st)continue;
   particles.push({
     kind:p.kind,
     layer:num(p.layer,0,9.99,1),
     box:box(p.box)||[0,0,4096,2250],
     count:Math.round(num(p.count,0,400,p.kind==='meteor'?1:30)),
     size:pair(p.size,.2,64)||[1.5,3],
     vel:pair(p.vel,-2000,2000)||[0,0],
     wind:num(p.wind,0,4,0),
     every:pair(p.every,.2,120),
     stages:st,
     ...(Array.isArray(p.tint)&&p.tint.length>=3&&p.tint.slice(0,3).every(Number.isFinite)?{tint:p.tint.slice(0,3).map(v=>Math.round(num(v,0,255,255)))}:{}),
     ...(Number.isFinite(p.alpha)?{alpha:num(p.alpha,0,1,1)}:{})
   });}
  const motionOf=s=>{
    const spin=Number.isFinite(s.spin)&&s.spin!==0?num(s.spin,-720,720,0):0,
      sw=pair(s.swing,0,90),
      swing=sw&&sw[0]>0?[sw[0],num(s.swing[1],0,5,0)]:null,
      pl=Array.isArray(s.pulse)&&s.pulse.length>=3&&s.pulse.slice(0,3).every(Number.isFinite)?[num(s.pulse[0],0,2,1),num(s.pulse[1],0,2,1),num(s.pulse[2],0,10,0)]:null;
   const h=s.hit,
     fr=Math.round(num(s.frames,1,64,1)),
     sh=obj(h)&&pair(h.shake,0,24),
     fl=obj(h)&&pair(h.flash,0,1.5),
     b=obj(h)&&obj(h.burst)&&PARTICLES.includes(h.burst.kind)?h.burst:null;
   const shake=sh&&sh[0]>0&&num(h.shake[1],0,2,0)>0?[sh[0],num(h.shake[1],0,2,0)]:null,
     flash=fl&&fl[0]>0&&num(h.flash[1],0,2,0)>0?[fl[0],num(h.flash[1],0,2,0)]:null,
     count=b?Math.round(num(b.count,0,120,24)):0;
   const burst=count>0?{kind:b.kind,count,speed:num(b.speed,0,2000,160),spread:num(b.spread,0,360,360),life:num(b.life,.05,5,1.2)}:null,
     hit=obj(h)&&fr>1&&Number.isFinite(h.frame)&&(shake||flash||burst)?
       {frame:Math.round(num(h.frame,0,fr-1,0)),...(shake?{shake}:{}),...(flash?{flash}:{}),...(burst?{burst}:{})}:
       null;
   return {
     ...(spin?{spin}:{}),
     ...(swing?{swing}:{}),
     ...(spin||swing?{pivot:pair(s.pivot,0,1)||(spin?[.5,.5]:[.5,0]),squash:pair(s.squash,.05,4)||[1,1]}:{}),
     ...(pl?{pulse:pl}:{}),
     ...(hit?{hit}:{})
   };};
  const sprites=[];
  for(const s of list(json.sprites,32)){
    if(!obj(s)||typeof s.id!=='string'||!/^[a-z0-9-]{1,32}$/.test(s.id))continue;
    const f=Array.isArray(s.frame)&&s.frame.length>=4&&s.frame.slice(0,4).every(Number.isFinite)?s.frame.slice(0,4).map(Math.round):null;
    if(!f||f[2]<1||f[3]<1||f[2]>1024||f[3]>1024||f[0]<0||f[1]<0)continue;
    const st=stages(s.stages);
    if(!st)continue;
    const at=pair(s.at,-4096,8192);
    if(!at)continue;
    const pa=obj(s.path)?s.path:{};
   sprites.push({
     id:s.id,
     frame:f,
     frames:Math.round(num(s.frames,1,64,1)),
     cols:Math.round(num(s.cols,0,64,0)),
     tween:s.tween===true||s.tween===1,
     cut:s.cut===true||s.cut===1,
     fps:num(s.fps,0,60,0),
     layer:num(s.layer,0,9.99,1),
     at,
     scale:num(s.scale,.05,8,1),
     path:{vx:num(pa.vx,-2000,2000,0),vy:num(pa.vy,-2000,2000,0),bob:pair(pa.bob,0,200)||[0,0],loop:box(pa.loop)},
     fixed:s.fixed===true,
     face:s.face==='left'||s.face==='right'?s.face:null,
     shadow:Array.isArray(s.shadow)&&s.shadow.length>=4&&s.shadow.slice(0,4).every(Number.isFinite)?
       [num(s.shadow[0],0,255,0),num(s.shadow[1],0,255,0),num(s.shadow[2],0,255,0),num(s.shadow[3],0,1,0)]:
       null,
     stages:st,
     ...motionOf(s)
   });}
  const sf=obj(json.shafts)?json.shafts:null,shafts=sf&&pair(sf.from,-2,3)?{from:pair(sf.from,-2,3),amount:num(sf.amount,0,2,.25),stages:stages(sf.stages)||[]}:null;
  const r=obj(json.ride)?json.ride:{},
    ride={
      knock:num(r.knock,0,4,RAIL.knock),
      gap:num(r.gap,0,40000,RAIL.gap),
      bounce:num(r.bounce,0,4,RAIL.bounce),
      heave:list(r.heave,4).map(h=>pair(h,0,40)).filter(h=>h&&h[1]>0).map(([a,hz])=>[a,Math.min(5,hz)]),
      rumble:num(r.rumble,0,2,RAIL.rumble),
      floats:r.car==='floats'
    };
  // glass: what lies on the cabin's window panes (rain: drops that land, sit and run)
  const glass=obj(json.glass)&&json.glass.kind==='rain'&&stages(json.glass.stages)?{kind:'rain',amount:num(json.glass.amount,0,2,.8),stages:stages(json.glass.stages)}:null;
  return {v:1,layers,particles,sprites,shafts,ride,...(glass?{glass}:{})};
 }
 /* sun-<land>.json (engine 2, 3.4): for each hour with sun, for each sliding layer, 256 numbers along its tile (16 of its pixels each):
    how much of the sun's light that layer lets into the carriage when it has slid that far (1 open sky, 0 a mountain in the way):
    {"v":1,"hours":{"noon":{"1":[256 numbers],"3":[...]},...}}. sunOf reads one (null: none, the light stays as it is). */
 function sunOf(json){
  if(!json||typeof json!=='object'||json.v!==1||!json.hours||typeof json.hours!=='object'||Array.isArray(json.hours))return null;const out={};
  for(const stage of LIVE_STAGES){
    const h=json.hours[stage];
    if(!h||typeof h!=='object')continue;
    const layers={};
    for(const [n,list]of Object.entries(h)){
      if(!/^[1-9]$/.test(n)||!Array.isArray(list)||list.length!==256||!list.every(Number.isFinite))continue;
      layers[n]=Float32Array.from(list,v=>Math.min(1,Math.max(0,v)));
    }
    if(Object.keys(layers).length)out[stage]=layers;
  }
  return Object.keys(out).length?out:null;
 }
 const TRAVEL=Object.freeze({base:4.346,power:.95,brake:.8,least:1.5,amax:3.5,top:12,step:1/30,push:.35,let:.22,surge:5.5,spring:[.8,.95]});
 /* (4.0.169) The shape of a change, from where the train is (speed v0, acceleration a0) to a new speed v1 over T seconds: a push
    (the first `push` s, at most three tenths of the change: the acceleration rises from what it was to its peak A), then
    - to a moving speed: a fall of the acceleration that eases out at the new speed ((1-w)^3 (1+3w) of the peak, w the share of
      what is left: the speed comes most of the way early, the end is gentle);
    - to a stand: a nearly steady braking ((1-.2w) of the peak) that lets go only in about the last `let` s ((1-w^m)): the
      deceleration is still more than half its peak a quarter of a second before the stand, so the stand is a small jolt.
    The peak is what makes the change come out right; speed and acceleration are continuous, the jerk may jump. */
 // (4.0.170) how much of a layer's motion blur is drawn: as far as it moves on the canvas in a sixtieth of a second, faded in
 // between 1 and 3 screen px (canvas px / dpr) so it never switches on at once
 const blurOf=(px,dpr)=>{const d=dpr>0?dpr:1,u=Math.min(1,Math.max(0,(px/d-1)/2));return px>0?px*u*u*(3-2*u):0;};
 function shapeOf(v0,a0,v1,T){
  const D=v1-v0,tau=Math.min(TRAVEL.push,.3*T),L=Math.max(1e-6,T-tau),stop=!(v1>1e-9)&&D<0;
  const m=stop?Math.max(4,Math.log(.25)/Math.log(Math.max(1e-6,1-TRAVEL.let/L))):0,share=stop?.9-1/(m+1)+.2/(m+2):.4;
  const A=(D-a0*tau/3)/(2*tau/3+L*share),vt=v0+a0*tau/3+2*A*tau/3,xt=v0*tau+a0*tau*tau/2+(A-a0)*tau*tau/4;
  return {v0,a0,v1,T,tau,L,A,stop,m,vt,xt};
 }
 // the shape at s seconds into the change: [speed, acceleration, jerk, distance from the start]
 function shapeAt(c,s){
  const {v0,a0,A,tau,L,stop,m,vt,xt}=c;
  if(s<=tau){const u=s/tau,d=A-a0;return [v0+a0*s+d*(s*s/tau-s*s*s/(3*tau*tau)),a0+d*(2*u-u*u),d*(2-2*u)/tau,v0*s+a0*s*s/2+d*(s*s*s/(3*tau)-s*s*s*s/(12*tau*tau))];}
  const w=Math.min(1,(s-tau)/L);
  if(!stop)return [vt+A*L*(w-2*w**3+2*w**4-.6*w**5),A*(1-6*w*w+8*w**3-3*w**4),A*(-12*w+24*w*w-12*w**3)/L,xt+vt*L*w+A*L*L*(w*w/2-w**4/2+.4*w**5-.1*w**6)];
  const wm=w**m;
  return [
    vt+A*L*(w-.1*w*w-wm*w/(m+1)+.2*wm*w*w/(m+2)),
    A*(1-.2*w-wm+.2*wm*w),
    A*(-.2-m*(w>0?wm/w:0)+.2*(m+1)*wm)/L,
    xt+vt*L*w+A*L*L*(w*w/2-w**3/30-wm*w*w/((m+1)*(m+2))+.2*wm*w**3/((m+2)*(m+3)))
  ];
 }
 // a travel from its numbers (see above); anything else is a train standing at the journey's start
 function travelOf(list){
  const n=i=>Number.isFinite(Number(list?.[i]))?Number(list[i]):0,v1=Math.min(TRAVEL.top,Math.max(0,Array.isArray(list)?n(0):1)),t0=n(1),x0=n(2),r0=n(3);
  const T=Array.isArray(list)&&list.length>=8?Math.min(60,Math.max(0,n(7))):0,v0=T>0?Math.min(TRAVEL.top,Math.max(0,n(4))):v1,a0=T>0?n(5):0,j0=T>0?n(6):0;
  const p={v1,t0,x0,r0,v0,a0,j0,T,c:T>0?shapeOf(v0,a0,v1,T):null,rides:null,xT:x0,rT:r0};
  if(p.c){
   // (the ride's loop, as it goes by at the speed of each moment: summed in steps of a thirtieth of a second, Simpson within each)
   const N=Math.max(1,Math.ceil(T/TRAVEL.step)),h=T/N,rate=t=>rideRate(Math.max(0,shapeAt(p.c,t)[0])),R=new Float64Array(N+1);R[0]=r0;
   for(let i=0;i<N;i++){const a=i*h;R[i+1]=R[i]+h/6*(rate(a)+4*rate(a+h/2)+rate(a+h));}
   p.rides=R;p.h=h;p.xT=x0+shapeAt(p.c,T)[3];p.rT=R[N];
  }
  return p;
 }
 // where a travel is at a moment of the band's clock: {v, a, j, x, r}
 function travelAt(p,t){
  const s=(t-p.t0)/1000;
  if(!p.c||s>=p.T)return {v:p.v1,a:0,j:0,x:p.xT+p.v1*Math.max(0,s-p.T),r:p.rT+rideRate(p.v1)*Math.max(0,s-p.T),moving:false};
  if(s<=0)return {v:p.v0,a:p.a0,j:p.j0,x:p.x0+p.v0*s,r:p.r0+rideRate(p.v0)*s,moving:true};
  const i=Math.min(p.rides.length-2,Math.floor(s/p.h)),a=i*p.h,[v,acc,j,dx]=shapeAt(p.c,s);
  return {v,a:acc,j,x:p.x0+dx,r:p.rides[i]+(s-a)*(rideRate(Math.max(0,shapeAt(p.c,a)[0]))+rideRate(Math.max(0,v)))/2,moving:true};
 }
 // a new choice of speed at a moment: the curve from where the train is then to the new speed (now: the band's clock, ms); `at once`
 // (Still, Off, reduced motion, nothing to move it by): the new speed from that moment on, the journey going on from where it was
 function travelTo(p,now,v1,atOnce){
  const s=travelAt(p,now);v1=Math.min(TRAVEL.top,Math.max(0,Number(v1)||0));
  const steady=[v1,now,s.x,s.r];if(atOnce)return steady;
  const near=Math.abs(v1-s.v)<1e-6&&Math.abs(s.a)<1e-6;if(near)return steady;
  // (as long as the change is felt, at least `least` s (4.0.173: Stopped to Slow 1.5 s, Slow to Cruise 1.85, Cruise to Fast 4,
  // Stopped to Cruise 3.1), braking a fifth quicker (Fast to Stopped 5.5 at most))
  const felt=Math.abs(Math.log((v1+1)/(s.v+1)));let T=(v1<s.v?TRAVEL.brake:1)*Math.max(TRAVEL.least,TRAVEL.base*felt**TRAVEL.power)+Math.abs(s.a)*.3;
  // (longer while the curve would pass its bounds: too hard an acceleration, a dip below a stand, a swing past the new speed)
  const lo=Math.min(s.v,v1),hi=Math.max(s.v,v1),over=.06*(hi-lo)+.02;
  for(let k=0;k<16;k++){
   const c=shapeOf(s.v,s.a,v1,T);let ok=Math.abs(c.A)<=TRAVEL.amax;
   for(let i=1;i<64&&ok;i++){const [v,a]=shapeAt(c,T*i/64);if(Math.abs(a)>TRAVEL.amax||v<-1e-3||v>hi+over&&v>s.v)ok=false;}
   if(ok)break;T*=1.15;
  }
  return [v1,now,s.x,s.r,s.v,s.a,s.j,Math.round(T*1e4)/1e4];
 }
 function bandRide(doc,base,file,lived){
  const read=reader(base),URLs=global.URL,PI2=Math.PI*2,r3=n=>Math.round(n*1000)/1000;
  let data=null,ride=null,state='',waits=[],moving=0,shake=null,floorNode=null,floorKey='',floorAnims=[],floorUrls=[];const open=new Set(),cache=new Map();
  const el=(cls,tag)=>{const n=doc.createElement(tag||'div');if(cls)n.className=cls;n.setAttribute('aria-hidden','true');return n;};
  const css=(node,styles)=>{for(const [key,value]of Object.entries(styles))node.style[key]=value;return node;};
  const blob=name=>Promise.resolve().then(()=>read(base+name)).then(response=>{
    if(!response?.ok)throw Error('missing '+name);
    return response.blob();
  }).then(b=>URLs.createObjectURL(b));
  // a picture's own read: the URL joins its list the moment it exists; one that arrives after the picture closed is given back at once
  const owned=(name,urls,gone)=>blob(name).then(url=>{if(gone()){URLs.revokeObjectURL(url);throw Error('closed');}urls.push(url);return url;});
  const image=(url,cls)=>{const img=el(cls,'img');img.alt='';img.draggable=false;img.decoding='async';img.setAttribute('src',url);return img;};
  const decoded=img=>typeof img.decode==='function'?img.decode().catch(()=>pictureIn(img)):pictureIn(img);
  // the ride: everything below repeats every `loop` seconds exactly, so a list of keyframes can run for ever
  function makeRide(spec){
   const P=spec.loop,sw=spec.sway.map(([a,turns,p])=>[a,turns/P,p]);let s=spec.seed>>>0;
   const rnd=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
   const joints=[];for(let t=.4;t<P-.6;){joints.push([t,.7+.3*rnd(),rnd()<.55]);t+=spec.gap[0]+(spec.gap[1]-spec.gap[0])*rnd();}
   const wrap=t=>((t%P)+P)%P,sway=t=>{let y=0;for(const [a,f,p]of sw)y+=a*Math.sin(PI2*f*t+p);return y;};
   // what is left at time t of every knock in the last `dead` seconds (this turn of the loop and the one before)
   const first=t=>{let a=0,b=joints.length;while(a<b){const m=a+b>>1;if(joints[m][0]<t)a=m+1;else b=m;}return a;};
   const ring=(time,dead,each)=>{
     const t=wrap(time);
     let y=0;
     for(const lap of [0,-P]){
       const from=t-lap-dead;
       for(let i=first(from);i<joints.length;i++){
         const [t0,amp,two]=joints[i],since=t-t0-lap;
         if(since<=0)break;
         if(since>dead)continue;
         y+=amp*each(since);
         if(two&&since>.13)y+=amp*.7*each(since-.13);
       }
     }
     return y;
   };
   const shakeAt=t=>sway(t)+ring(t,.8,tau=>.85*Math.exp(-tau/.085)*Math.sin(PI2*5.5*tau));
   const pendulum=(t,per,zeta)=>{
     const f0=1/per,w0=PI2*f0,wd=w0*Math.sqrt(1-zeta*zeta);
     let th=0;
     for(const [a,f,p]of sw){const q=f/f0,g=q*q/Math.sqrt((1-q*q)**2+(2*zeta*q)**2);th+=.55*a*Math.min(g,3.2)*Math.sin(PI2*f*t+p-Math.atan2(2*zeta*q,1-q*q));}
     return th+1.05*ring(t,14,tau=>Math.exp(-zeta*w0*tau)*Math.sin(wd*tau));
   };
   const jolt=(t,f,zeta)=>{const w0=PI2*f,wd=w0*Math.sqrt(1-zeta*zeta);return ring(t,Math.min(14,6/(zeta*w0)),tau=>Math.exp(-zeta*w0*tau)*Math.sin(wd*tau));};
   const lean=(drives,t)=>{let y=0;for(const d of drives)y+=d[0]==='hang'?d[3]*pendulum(t,d[1],d[2]):d[3]*jolt(t,d[1],d[2])+(d[4]?d[4]*sway(t-.12):0);return y;};
   // What is outside, riding against the room: x and y carry everything alike (the car yaws and rolls: slow, never the same
   // twice in a loop), r tilts it (the car pitches), b is the bounce that only what is close shows (our bridge under the
   // room). A rail joint knocks as the wheels take it: the two axles of one bogie, then the two of the next, each knock a
   // short hard swing that dies in a quarter of a second.
   const tides=(list,t)=>{let y=0;for(const [a,turns,p]of list)y+=a*Math.sin(PI2*turns/P*t+p);return y;};
   const thump=t=>ring(t,1.5,tau=>{let y=0;for(const [late,a]of [[0,1],[.15,.8],[.62,.55],[.77,.45]]){const u=tau-late;if(u>0)y+=a*Math.exp(-u/.075)*Math.sin(PI2*8.5*u);}return y;});
   const outside=t=>{
     const k=thump(t);
     return {
       x:tides([[.5,13,.3],[.32,23,1.9],[.18,38,4.1]],t)+.2*thump(t-.03),
       y:tides([[.55,17,1.2],[.3,29,3.3],[.15,44,.4]],t)+.3*k,
       r:tides([[.6,11,2.2],[.3,19,.7],[.1,31,5]],t),
       b:tides([[.6,53,.9],[.4,37,2.6],[.25,81,4.4]],t)+1.1*k
     };
   };
   return {P,sway,shake:shakeAt,pendulum,jolt,lean,outside};
  }
  // a movement as keyframes over one loop (the last equal to the first): its numbers are sampled `rate` times a second, then
  // thinned: a sample stays only where a straight run between the samples kept would miss the true value by more than
  // `tol` (one for each number). A still stretch costs two keyframes; a knock keeps its whole shape.
  const frames=(rate,nums,tol,format)=>{
   const n=Math.max(2,Math.round(ride.P*rate)),v=[];for(let i=0;i<=n;i++)v.push(nums(i===n?0:i/n*ride.P));
   const keep=new Uint8Array(n+1),stack=[[0,n]];keep[0]=keep[n]=keep[n>>1]=1;stack.push([0,n>>1],[n>>1,n]);stack.shift();
   while(stack.length){
     const [a,b]=stack.pop();
     if(b-a<2)continue;
     let worst=1,at=-1;
     for(let i=a+1;i<b;i++){
       const part=(i-a)/(b-a);
       for(let k=0;k<tol.length;k++){const e=Math.abs(v[i][k]-(v[a][k]+(v[b][k]-v[a][k])*part))/tol[k];if(e>worst){worst=e;at=i;}}
     }
     if(at>0){keep[at]=1;stack.push([a,at],[at,b]);}
   }
   const out=[];for(let i=0;i<=n;i++)if(keep[i])out.push({offset:i/n,...format(v[i])});return out;
  };
  /* ENGINE 2: THE RAIL. What rides with the train is worked out from the journey itself, in windows of the band's clock (WIN s each,
     the same windows in every page): the rail's joints lie along the track (gap apart, a little uneven, some doubled), so their
     knocks come as often as the train passes them, faster as it goes faster; above about three a second they melt into a rumble.
     What hangs swings back when the train speeds up and forward when it brakes, and rings down after; what stands leans and
     settles (each a damped oscillator of its own period, kicked by every joint it crosses and pulled by the train's acceleration,
     so a chain's links follow each other late). The land outside rides against the room with the same knocks (each joint four
     axles), surges back a little as the train speeds up, heaves if the car floats, and rumbles at speed. Each window is a list
     of keyframes run once (fill both), the next laid at its start, and worked out again from the moment a new travel is told; a
     window starts from where the one before left every oscillator, so nothing ever jumps. */
  // (PULL: degrees of lean for each unit of a piece's own swing at a felt acceleration of 1, hanging and standing)
  const WIN=10,SIMHZ=120,LOOK=1.5,AXLES=[[0,1],[.15,.8],[.62,.55],[.77,.45]],SURGE=TRAVEL.surge,RUMBLE=1.2,PULL=[7.6,4.2],PZ=[.27,.15],OUT=[1.2,.6];
  let bareLands=false,journey=[[-Infinity,null]],rail=RAIL,railFor='',railTimer=0,railSlice=0,sun=null;
  const tracks=new Map(),sims=new Map(),looks=new Map(),lives=new Map(),suns=new Map();
  const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  // (how strongly the room's things ride at a speed: the force of the steps before, made smooth; and what is outside)
  const fS=v=>!(v>0)?0:v<.2?.6*Math.sqrt(v/.2):v<1?.6+.4*v:Math.min(2.2,1+.46*Math.log2(v)),swS=v=>(.7+.3*smooth(.3,.8,v)+.8*smooth(2,4.5,v))*smooth(0,.15,v);
  const feel=a=>a/(1+Math.abs(a)/3),feelIn=a=>a/(1+Math.abs(a)),hashJ=(j,s)=>{
    let h=Math.imul((j|0)^Math.imul(s,0x9e3779b9),0x85ebca6b);
    h^=h>>>13;
    h=Math.imul(h,0xc2b2ae35);
    h^=h>>>16;
    return (h>>>0)/4294967296;
  };
  const journeyAt=t=>{let p=journey[0][1]||route;for(const [from,q]of journey)if(t>=from&&q)p=q;return travelAt(p,t);};
  // the rail's joints between two places of the journey (seconds of travel at the land's own speed): [place, strength, doubled]
  const jointsIn=(xa,xb)=>{
    const out=[];
    if(!(rail.gap>0)||!(xb>xa))return out;
    const G=rail.gap/1800;
    for(let j=Math.floor(xa/G)-1,e=Math.ceil(xb/G)+1;j<=e;j++){const x=(j+.2+.6*hashJ(j,1))*G;if(x>=xa&&x<xb)out.push([x,.7+.3*hashJ(j,2),hashJ(j,3)<.55]);}
    return out;
  };
  // (the moments the train pulls away from a stand between two moments of the clock: [moment, knock])
  const startsIn=(ta,tb)=>{
    const out=[];
    for(const [,p]of journey){if(!p?.c||!(p.v0<1e-6)||!(p.v1>0)||Math.abs(p.a0)>1e-6)continue;const t=p.t0+120;if(t>=ta&&t<tb)out.push([t,.85*kfade(1)*rail.knock]);}
    return out;
  };
  const kfade=v=>{const nu=rail.gap>0?v/(rail.gap/1800):0;return 1-.75*smooth(2,4.5,nu);},rumbled=v=>{const nu=rail.gap>0?v/(rail.gap/1800):0;return rail.rumble*smooth(1.5,4.5,nu);};
  // one window of the journey, sampled SIMHZ times a second from LOOK s before it: speed, acceleration, place, the ride's loop; when
  // each joint (and each axle of the car over it) is crossed; and every oscillator the room's things ride on (unit kicks, unit pull)
  function simOf(k){
   if(sims.has(k))return sims.get(k);
   const t0=k*WIN*1000-LOOK*1000,n=Math.round((WIN+LOOK)*SIMHZ)+1,dt=1000/SIMHZ,V=new Float64Array(n),A=new Float64Array(n),X=new Float64Array(n),R=new Float64Array(n);
   for(let i=0;i<n;i++){const s=journeyAt(t0+i*dt);V[i]=Math.max(0,s.v);A[i]=s.a;X[i]=s.x;R[i]=s.r;}
   // (the moment the journey reaches a place, by the samples either side)
   const when=x=>{
     if(!(x>=X[0])||!(x<X[n-1]))return null;
     let a=0,b=n-1;
     while(b-a>1){const m=a+b>>1;if(X[m]<=x)a=m;else b=m;}
     const u=X[b]>X[a]?(x-X[a])/(X[b]-X[a]):0;
     return t0+(a+u)*dt;
   };
   const kicks=[],axles=[];
   for(const [x,amp,two]of jointsIn(X[0]-1,X[n-1])){
     for(const [dx,w]of two?[[0,1],[.13,.7]]:[[0,1]]){
       const t=when(x+dx);
       if(t!==null){const i=Math.min(n-1,Math.round((t-t0)/dt));kicks.push([t,amp*w*kfade(V[i])*fS(V[i])*rail.knock]);}
       for(const [late,wa]of AXLES){const ta=when(x+dx+late);if(ta!==null){const i=Math.min(n-1,Math.round((ta-t0)/dt));axles.push([ta,amp*w*wa*kfade(V[i])*rail.knock]);}}
     }
   }
   // (pulling away from a stand: the couplings take up with one knock, the size of a joint's at Cruise, room and land alike)
   for(const [t,amp]of startsIn(t0,t0+(n-1)*dt)){kicks.push([t,amp*fS(1)]);axles.push([t,amp]);}
   kicks.sort((a,b)=>a[0]-b[0]);axles.sort((a,b)=>a[0]-b[0]);
   const sim={k,t0,n,dt,V,A,X,R,kicks,axles,osc:new Map(),drv:new Map(),memo:new Map()};sims.set(k,sim);
   for(const old of [...sims.keys()])if(old<k-2||old>k+2)sims.delete(old);
   return sim;
  }
  // an oscillator (hang: a pendulum of `per` seconds; stand: `per` Hz) over a window: its unit response to the kicks (K) and to the
  // train's acceleration (P, the pull: its rest leans back by the felt acceleration), from where the window before left it
  function oscOf(sim,kind,per,zeta){
   const key=kind+'/'+per+'/'+zeta;if(sim.osc.has(key))return sim.osc.get(key);
   const f0=kind==='hang'?1/per:per,w0=PI2*f0,z=Math.min(.95,Math.max(.01,zeta)),wd=w0*Math.sqrt(1-z*z),sg=z*w0,c1=kind==='hang'?1.05:1,h=sim.dt/1000;
   // (the pull: on the piece's own oscillator, damped at least PZ; the outside's spring as it is given)
   const zp=kind==='hang'?Math.max(z,PZ[0]):kind==='stand'?Math.max(z,PZ[1]):z,
     felt=kind==='spring'?feel:feelIn,
     sp=zp*w0,
     wp=w0*Math.sqrt(1-zp*zp),
     E1=Math.exp(-sp*h),
     C1=Math.cos(wp*h),
     S1=Math.sin(wp*h);
   const pull=(x,v,u)=>{const y=x-u;return [u+E1*(y*C1+(v+sp*y)/wp*S1),E1*(v*C1-(sp*v+w0*w0*y)/wp*S1)];};
   // (one step of the oscillator, exactly; a whole sample's step worked out once)
   const E0=Math.exp(-sg*h),C0=Math.cos(wd*h),S0=Math.sin(wd*h),step=(x,v,u,d)=>{
     const same=d===h,e=same?E0:Math.exp(-sg*d),c=same?C0:Math.cos(wd*d),s=same?S0:Math.sin(wd*d),y=x-u;
     return [u+e*(y*c+(v+sg*y)/wd*s),e*(v*c-(sg*v+w0*w0*y)/wd*s)];
   };
   const prev=sims.get(sim.k-1)?.osc.get(key)?.end;let kx=0,kv=0,px=0,pv=0;
   if(prev){[kx,kv,px,pv]=prev;}
   else{// (no window before: the last fifteen seconds of the journey as it was, from rest)
    const warm=simWarm(sim,15);for(const [t,amp]of warm.kicks){[kx,kv]=step(kx,kv,0,(t-warm.at)/1000);kv+=c1*wd*amp;warm.at=t;}[kx,kv]=step(kx,kv,0,(sim.t0-warm.at)/1000);
    for(let i=0;i<warm.A.length;i++)[px,pv]=pull(px,pv,-felt(warm.A[i]));
   }
   const K=new Float32Array(sim.n),P=new Float32Array(sim.n);let j=0;const ks=sim.kicks;while(j<ks.length&&ks[j][0]<sim.t0)j++;
   let end=null;const mark=Math.round((WIN*SIMHZ));
   for(let i=0;i<sim.n;i++){
    if(i===mark)end=[kx,kv,px,pv];
    K[i]=kx;P[i]=px;if(i===sim.n-1)break;
    const t=sim.t0+i*sim.dt,tn=t+sim.dt;let at=t;
    while(j<ks.length&&ks[j][0]<tn){[kx,kv]=step(kx,kv,0,(ks[j][0]-at)/1000);kv+=c1*wd*ks[j][1];at=ks[j][0];j++;}
    [kx,kv]=step(kx,kv,0,at===t?h:(tn-at)/1000);[px,pv]=pull(px,pv,-felt((sim.A[i]+sim.A[i+1])/2));
   }
   const o={K,P,end:end||[kx,kv,px,pv]};sim.osc.set(key,o);return o;
  }
  // (the journey before a window that has no window before it: its kicks and accelerations over the last `secs` seconds)
  function simWarm(sim,secs){
    const at=sim.t0-secs*1000,n=Math.round(secs*SIMHZ),dt=1000/SIMHZ,A=new Float64Array(n),X=new Float64Array(n+1),V=new Float64Array(n+1);
    for(let i=0;i<=n;i++){const s=journeyAt(at+i*dt);X[i]=s.x;V[i]=Math.max(0,s.v);if(i<n)A[i]=s.a;}
   const kicks=[];
   for(const [x,amp,two]of jointsIn(X[0],X[n]))
     for(const [dx,w]of two?[[0,1],[.13,.7]]:[[0,1]]){
       let a=0,b=n;
       if(!(x+dx>=X[0]&&x+dx<X[n]))continue;
       while(b-a>1){const m=a+b>>1;if(X[m]<=x+dx)a=m;else b=m;}
       kicks.push([at+a*dt,amp*w*kfade(V[a])*fS(V[a])*rail.knock]);
     }
   for(const [t,amp]of startsIn(at,at+n*dt))kicks.push([t,amp*fS(1)]);kicks.sort((p,q)=>p[0]-q[0]);return {at,A,kicks};}
  const read1=(arr,sim,t)=>{
    const u=(t-sim.t0)/sim.dt;
    if(u<=0)return arr[0];
    if(u>=sim.n-1)return arr[sim.n-1];
    const i=Math.floor(u),f=u-i;
    return arr[i]+(arr[i+1]-arr[i])*f;
  };
  // the swing of the sway at the ride's loop time r for a pendulum of `per` s (as ride.pendulum without its knocks)
  const hangs=new Map(),hangOf=(per,zeta)=>{
    const key=per+'/'+zeta;
    let c=hangs.get(key);
    if(!c){
      const f0=1/per;
      c=data.ride.sway.map(([a,turns,p])=>{
        const f=turns/ride.P,q=f/f0,g=q*q/Math.sqrt((1-q*q)**2+(2*zeta*q)**2);
        return [.55*a*Math.min(g,3.2),PI2*f,p-Math.atan2(2*zeta*q,1-q*q)];
      });
      hangs.set(key,c);
    }
    return c;
  };
  const swayHang=(c,r)=>{let th=0;for(const [a,w,p]of c)th+=a*Math.sin(w*r+p);return th;};
  // (a piece's drives in a window: each with its oscillator and, if it hangs, its sway; found once a window)
  const drivesOf=(sim,i)=>{
    let list=sim.drv.get(i);
    if(!list){list=data.pieces[i].d.map(d=>({d,o:oscOf(sim,d[0],d[1],d[2]),c:d[0]==='hang'?hangOf(d[1],d[2]):null}));sim.drv.set(i,list);}
    return list;
  };
  // the lean of a piece at a moment (positive: its free end forward), from the window's journey
  function leanAt(i,sim,t){
   const key=i*1e9+t,had=sim.memo.get(key);if(had!==undefined)return had;
   const q=data.pieces[i],tt=t-(q.dt||0)*1000,v=read1(sim.V,sim,tt),r=read1(sim.R,sim,tt),f=fS(v);let y=0;
   for(const {d,o,c}of drivesOf(sim,i)){
     if(c)y+=d[3]*(f*swayHang(c,r)+read1(o.K,sim,tt)+PULL[0]*read1(o.P,sim,tt));else y+=d[3]*(read1(o.K,sim,tt)+PULL[1]*read1(o.P,sim,tt))+(d[4]?d[4]*f*ride.sway(r-.12):0);
   }
   sim.memo.set(key,y);return y;
  }
  // a piece's numbers at a moment, as its kind moves it (the format is pieceRaw's)
  // (4.2.9) THE ROOM AT A STAND. With the train stopped nothing rode the rail and the room stood dead still (the owner: "when the
  // train is stopped there is no animation"). At a stand what hangs stirs in the room's own air, slowly, each thing at its own
  // rate and by how lightly it hangs; what is soft bends a little, link after link; the cat goes on breathing. It fades out as the
  // train gathers speed (by a quarter of Cruise the ride has it alone) and comes back as it stands. Degrees, added to the ride's.
  const IDLE=new Map();
  function idleAt(i,sim,t){
   if(IDLE.of!==data){IDLE.clear();IDLE.of=data;}
   let o=IDLE.get(i);
   if(!o){const q=data.pieces[i];let root=i,depth=0;while(data.pieces[root].p>=0&&depth<12){root=data.pieces[root].p;depth++;}
    const h=Math.sin((root+1)*12.9898)*43758.5453,u=h-Math.floor(h),g=Math.min(q.k==='bend'?6:3,Math.max(.3,Number(q.d?.[0]?.[3])||1));
    o={amp:q.k==='bend'?(q.hang?.2:.08)*g:q.hang?.4*g:0,T:(3.6+2.4*u)*1000,ph:PI2*u*7,lag:depth*380};IDLE.set(i,o);}
   if(!(o.amp>0))return 0;const w=1-smooth(0,.25,read1(sim.V,sim,t));if(!(w>0))return 0;
   const a=PI2*(t-o.lag)/o.T+o.ph;return w*o.amp*(Math.sin(a)+.45*Math.sin(1.73*a+1.3));
  }
  function pieceAt(i,sim,t){
   const q=data.pieces[i],parent=q.p>=0?data.pieces[q.p]:null;
   if(q.k==='bend')return [(q.hang?1:-1)*(leanAt(i,sim,t)-(parent?leanAt(q.p,sim,t):0))+idleAt(i,sim,t)];
   if(q.k==='rot')return [(q.hang?-1:1)*leanAt(i,sim,t)+idleAt(i,sim,t)];
   const tt=t-(q.dt||0)*1000,v=read1(sim.V,sim,tt),r=read1(sim.R,sim,tt);
   if(q.k==='lift'){
     const o=drivesOf(sim,i)[0].o,j=read1(o.K,sim,tt);
     const going=smooth(0,.15,v);
     return [-(q.hop||0)*Math.max(j,-.4),1+(q.squash||0)*j+(q.breath||0)*(going*(.5-.5*Math.cos(PI2*14*r/ride.P))+(1-going)*(.5-.5*Math.cos(PI2*tt/3400)))];
   }
   return [(q.slide||1)*fS(v)*ride.sway(r-.35)-2.5*feel(read1(sim.A,sim,tt))];
  }
  // what is outside at a moment: x, y and tilt for a layer (amp: how much it rides; near: its bounce; depth: how much of a heave it
  // shows; surge: how far it slides back as the train speeds up; turn: it tilts)
  const thumpAt=(sim,t)=>{let y=0;for(const [ta,amp]of sim.axles){const u=(t-ta)/1000;if(u<=0)break;if(u>1.5)continue;y+=amp*Math.exp(-u/.075)*Math.sin(PI2*8.5*u);}return y;};
  const tidesAt=(list,r)=>{let y=0;for(const [a,turns,p]of list)y+=a*Math.sin(PI2*turns/ride.P*r+p);return y;};
  const noiseAt=t=>{const s=t/1000;return .5*Math.sin(PI2*11.3*s+2*Math.sin(.7*s))+.3*Math.sin(PI2*13.7*s+1.3)+.2*Math.sin(PI2*9.1*s+3*Math.sin(.31*s));};
  // (4.0.170) The world outside is one rigid thing that barely moves: every layer of it (in the window and under the room: far,
  // near, bridge, their particles and sprites) takes exactly the same displacement, in its own units (o.amp/1.7 of the band's art
  // px); no tilt, no bounce. Across: only the push of the train's acceleration, on a critically damped spring (no overshoot, no
  // rebound). Up and down: the joints' knocks and the rumble at speed, small, nothing at a stand; a floating land's slow heave (at
  // most 2 art px).
  function outsideAt(o,sim,t){
   const v=read1(sim.V,sim,t),scale=(o.amp??1.7)/1.7;
   let heave=0,most=0;for(const [a,hz]of rail.floats?rail.heave:[]){heave+=a*Math.sin(PI2*hz*t/1000+hz*7.1);most+=a;}if(most>2)heave*=2/most;
   const x=TRAVEL.surge*read1(oscOf(sim,'spring',TRAVEL.spring[0],TRAVEL.spring[1]).P,sim,t),y=OUT[0]*thumpAt(sim,t)+OUT[1]*rumbled(v)*noiseAt(t)-heave;
   return [x*scale,y*scale,0];
  }
  // a track's keyframes for window k: its numbers sampled `rate` times a second over the window, thinned to `tol`; a track that stays
  // at rest the whole window is null (it stands, nothing runs)
  function windowFrames(track,k){
   const key=track.key+'@'+k+'/'+moving;if(looks.has(key))return looks.get(key);
   const sim=simOf(k),from=k*WIN*1000,n=Math.max(2,Math.round(WIN*track.rate)),v=[];for(let i=0;i<=n;i++)v.push(track.at(sim,from+i/n*WIN*1000));
   let still=true;for(const s of v)for(let m=0;m<s.length;m++)if(Math.abs(s[m]-track.rest[m])>track.tol[m]){still=false;break;}
   let out=null;
   if(!still){const keep=new Uint8Array(n+1),stack=[[0,n]];keep[0]=keep[n]=1;
    while(stack.length){
      const [a,b]=stack.pop();
      if(b-a<2)continue;
      let worst=1,at=-1;
      for(let i=a+1;i<b;i++){
        const part=(i-a)/(b-a);
        for(let m=0;m<track.tol.length;m++){const e=Math.abs(v[i][m]-(v[a][m]+(v[b][m]-v[a][m])*part))/track.tol[m];if(e>worst){worst=e;at=i;}}
      }
      if(at>0){keep[at]=1;stack.push([a,at],[at,b]);}
    }
    out=[];for(let i=0;i<=n;i++)if(keep[i])out.push({offset:i/n,...track.format(v[i])});}
   looks.set(key,out);if(looks.size>900){const first=looks.keys().next().value;looks.delete(first);}return out;
  }
  // (the tracks: what is outside (o: amp, near, depth, surge, turn), a piece of the room by its index)
  const outTrack=o=>
    ({
      key:'o'+[o.amp,o.near,o.depth,o.surge,o.turn?1:0].join('/'),
      rate:48,
      tol:[.07,.07,.004],
      rest:[0,0,0],
      at:(sim,t)=>outsideAt(o,sim,t),
      format:v=>({transform:'translate3d('+r3(v[0])+'px,'+r3(v[1])+'px,0)'+(o.turn?' rotate('+r3(v[2])+'deg)':'')})
    });
  function pieceTrack(i){
   const q=data.pieces[i],fastest=Math.max(1.4,...q.d.map(d=>d[0]==='hang'?1/d[1]:d[1])),rate=Math.min(48,Math.max(16,fastest*9)),at=(sim,t)=>pieceAt(i,sim,t);
   if(q.k==='bend')return {key:'p'+i,rate,at,tol:[.045],rest:[0],format:v=>({transform:'skewX('+r3(v[0])+'deg)'})};
   if(q.k==='rot')return {key:'p'+i,rate,at,tol:[.04],rest:[0],format:v=>({transform:'rotate('+r3(v[0])+'deg)'})};
   if(q.k==='lift')return {key:'p'+i,rate,at,tol:[.06,.0014],rest:[0,1],format:v=>({transform:'translate3d(0,'+r3(v[0])+'px,0) scaleY('+r3(v[1])+')'})};
   return {key:'p'+i,rate:12,at,tol:[.06],rest:[0],format:v=>({transform:'translate3d('+r3(v[0])+'px,0,0)'})};
  }
  // (the room's daylight (3.4): each sliding layer lets in its share of the sun where it has slid to; a layer that passes too fast for the
  // eye to follow lets in its mean; the shade over the room is what is kept out, as deep as `deep` at the most)
  function sunAt(stage,deep,sim,t){
   const hours=sun?.hours?.[stage];if(!hours)return [0];const v=read1(sim.V,sim,t),x=read1(sim.X,sim,t);let light=1;
   for(const [n,speed]of sun.move){
     const list=hours[String(n)];
     if(!list)continue;
     const off=((speed*x)%4096+4096)%4096,u=off/16,i=Math.floor(u)%256,f=u-Math.floor(u),here=list[i]*(1-f)+list[(i+1)%256]*f;
    let mean=list.mean;if(mean===undefined){mean=0;for(const q of list)mean+=q;mean/=256;list.mean=mean;}const blur=smooth(12,40,speed*v/16);light*=here*(1-blur)+mean*blur;}
   return [Math.round(deep*(1-light)*1000)/1000];
  }
  const sunTrack=(stage,deep)=>({key:'s'+stage+'/'+deep+'/'+(sun?.land||''),sun:true,rate:30,tol:[.008],rest:[0],at:(sim,t)=>sunAt(stage,deep,sim,t),format:v=>({opacity:v[0]})});
  // lay a track's window (k: the band's window now); the one it had goes once the new one runs
  function railLay(track,k){
   if(track.k===k&&track.level===moving)return;track.k=k;track.level=moving;const frames=moving&&ride?windowFrames(track,k):null,old=track.anim;track.anim=null;
   if(frames&&typeof track.node.animate==='function'){
     try{const a=track.node.animate(frames,{duration:WIN*1000,fill:'both'});a.startTime=epoch+k*WIN*1000;track.anim=a;}catch{track.anim=null;}
   }
   try{old?.cancel();}catch{}
   // (the room's shade is there only while it shades: an overlay that blends, even a clear one, changes how the room is drawn)
   if(track.sun){const none=!frames;if((track.node.style.display==='none')!==none)track.node.style.display=none?'none':'';}
  }
  // every track at the window of now (a few at a time, so laying never holds the page), and the next window at its start
  function railRun(again){
   if(railTimer){global.clearTimeout(railTimer);railTimer=0;}if(railSlice){global.clearTimeout(railSlice);railSlice=0;}
   if(again){for(const t of tracks.values())t.k=null;sims.clear();looks.clear();}
   if(!tracks.size||!ride)return;const now=(global.performance?.now?.()||0)-epoch,k=Math.floor(now/(WIN*1000)),list=[...tracks.values()];
   if(!moving){for(const t of list)railLay(t,k);return;}
   let i=0;
   const some=()=>{
     railSlice=0;
     const until=(global.performance?.now?.()||0)+5;
     do{if(i<list.length&&tracks.get(list[i].node)===list[i])railLay(list[i],k);i++;}while(i<list.length&&!((global.performance?.now?.()||0)>until));
     if(i<list.length)railSlice=global.setTimeout(some,0);
   };
   some();
   if(typeof global.setTimeout==='function'){
    const lay=()=>{railTimer=0;railRun();},start=(k+1)*WIN*1000-now;
    if(start>3500)
      railTimer=global.setTimeout(()=>{
        railTimer=0;
        if(Math.floor(((global.performance?.now?.()||0)-epoch)/(WIN*1000))!==k){railRun();return;}
        let j=0;
        const ahead=()=>{
          railTimer=0;
          const until=(global.performance?.now?.()||0)+4;
          do{const t=list[j];if(t&&tracks.get(t.node)===t)windowFrames(t,k+1);j++;}while(j<list.length&&!((global.performance?.now?.()||0)>until));
          if(j<list.length)railTimer=global.setTimeout(ahead,0);else railTimer=global.setTimeout(lay,Math.max(4,(k+1)*WIN*1000-((global.performance?.now?.()||0)-epoch)+4));
        };
        ahead();
      },start-3000);
    else railTimer=global.setTimeout(lay,Math.max(20,start+4));
   }
  }
  // a thing takes the rail (a piece of the room, the land in the window, a layer of the page), or (null) lets it go
  function railTrack(node,spec){
   const had=tracks.get(node);if(had){tracks.delete(node);try{had.anim?.cancel();}catch{}}
   if(!spec)return;const track={node,anim:null,k:null,level:-1,...spec};tracks.set(node,track);
   if(ride&&moving){const now=(global.performance?.now?.()||0)-epoch;railLay(track,Math.floor(now/(WIN*1000)));if(!railTimer)railRun();}
  }
  // the land that is passing: its own ride (live-<land>.json, read once; without one the rail of before)
  function railLand(name){
   if(!name||name===railFor)return;railFor=name;
   // (and the light it lets in: sun-<land>.json, read once, when the land's own page entry says it has one)
   const lit=s=>{
     if(railFor!==name)return;
     sun=s?{land:name,hours:s,move:(rooms.train?.pages?.[name]?.move||[]).filter(m=>Number(m?.[1])>0)}:null;
     for(const t of tracks.values())if(t.sun)t.k=null;
     railRun();
   };
   if(suns.has(name))
     lit(suns.get(name));
   else if(lived?.has?.('sun:'+name)){
     suns.set(name,null);
     Promise.resolve().then(()=>read(base+'sun-'+name+'.json')).then(r=>r?.ok?r.json():null).then(json=>{const s=sunOf(json);suns.set(name,s);lit(s);},()=>lit(null));
   }
   else{suns.set(name,null);lit(null);}
const use=live=>{if(railFor!==name)return;const next=live?.ride||RAIL;if(JSON.stringify(next)===JSON.stringify(rail))return;rail=next;railRun(true);};
   if(lives.has(name)){use(lives.get(name));return;}
   if(!lived?.has?.(name)){lives.set(name,null);use(null);return;}
   lives.set(name,null);
   Promise.resolve().then(()=>read(base+'live-'+name+'.json')).then(r=>r?.ok?r.json():null).then(json=>{const live=liveOf(json);lives.set(name,live);use(live);},()=>use(null));
  }
  // (epoch: this document's clock at the moment the band's own page began, when the band runs in a page of its own; else 0)
  let epoch=0;
  const start=(node,keyframes,ms,more)=>{
    if(typeof node?.animate!=='function')return null;
    try{
      const {ride:rides,...rest}=more||{};
      if(rides&&!(pace>0))return null;
      const a=node.animate(keyframes,{duration:ms,iterations:Infinity,...rest});
      if(rides){timeRide(a,ms);riding.add(a);if(riding.size>1500)retime();}else a.startTime=epoch+(rest.at||0);
      return a;
    }catch{return null;}
  };
  // the travel: its pace (1: the land's own speeds; 0: stopped), and how far it had come (far: seconds of travel at pace 1) at a
  // moment of the band's clock (at, ms). A strip that is `turn` long and goes `speed` a second is so always at the same place of
  // the same journey, in the band's window and under the room alike, whatever the pace was before. Nothing may move: it rests at
  // the journey's start, the picture as it was composed.
  let pace=1,paceAt=0,paceFar=0,rideFar=0,loopRate=1;
  // (engine 2: a travel that is changing speed is followed in steps of a tenth of a second: each step goes on from where the curve is
  // at its start at the curve's mean speed over it (and the ride's loop at its mean rate), so every place stays where the curve has it)
  let route=travelOf([1,0,0,0]),stepping=0;const STEP=100;
  // What rides (the pieces, the land against the window, the riders on the page) runs one loop of the ride for ever ({ride:1}):
  // the loop goes by at the pace's own rate, from the place of the loop the ride had come to (rideFar: seconds of it gone by at
  // that moment), so the band's page and the dashboard are at the same place of the same loop.
  const riding=new Set(),timeRide=(a,ms)=>{
    const r=loopRate>0?loopRate:rideRate(pace)||1,gone=(((rideFar*1000)%ms)+ms)%ms;
    a.tkLoop=ms;
    a.playbackRate=r;
    a.startTime=epoch+paceAt-gone/r;
  };
  const retime=()=>{for(const a of riding){if(a.cancelled||a.playState==='idle'){riding.delete(a);continue;}try{timeRide(a,a.tkLoop);}catch{riding.delete(a);}}};
  // (what is outside, by `amp` px for everything alike, sideways a little less; what is close also by its bounce, `near` px;
  // `turn`: a whole layer of the page, which tilts too, about the middle of its top)
  const outsideOf=(amp,near,turn)=>kept('outside'+amp+'/'+near+'/'+(turn?swing(pace):0),()=>{
    const tilt=.045*swing(pace);
    return frames(48,t=>{
      const o=ride.outside(t);
      return [o.x*amp*.6,o.y*amp+o.b*near,o.r*tilt];
    },[.07,.07,.004],v=>({transform:'translate3d('+r3(v[0])+'px,'+r3(v[1])+'px,0)'+(turn?' rotate('+r3(v[2])+'deg)':'')}));
  });
  const slide=(node,speed,turn)=>{
   if(!(speed>0)||!(turn>0)||!node?.style)return null;
   if(!moving){if(node.style.transform)node.style.transform='';return null;}
   const gone=(((speed*paceFar)%turn)+turn)%turn;
   if(!(pace>0)){node.style.transform='translate3d('+r3(-gone)+'px,0,0)';return null;}
   if(node.style.transform)node.style.transform='';
   const ms=turn/(speed*pace)*1000;return start(node,[{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(-turn)+'px,0,0)'}],ms,{at:paceAt-gone/turn*ms});
  };
  const kept=(key,make)=>{if(!cache.has(key))cache.set(key,make());return cache.get(key);};
  // a piece's movement over one loop, once, as numbers; then at a force as keyframes (every swing and hop that much greater)
  function pieceRaw(i){
   const q=data.pieces[i],
     parent=q.p>=0?data.pieces[q.p]:null,
     fastest=Math.max(1.4,...q.d.map(d=>d[0]==='hang'?1/d[1]:d[1])),
     rate=Math.min(48,Math.max(16,fastest*9)),
     lean=(p,t)=>ride.lean(p.d,t-p.dt),
     raw=v=>({v});
   if(q.k==='bend')return [frames(rate,t=>[(q.hang?1:-1)*(lean(q,t)-(parent?lean(parent,t):0))],[.045],raw),(v,f)=>({transform:'skewX('+r3(v[0]*f)+'deg)'})];
   if(q.k==='rot')return [frames(rate,t=>[(q.hang?-1:1)*lean(q,t)],[.04],raw),(v,f)=>({transform:'rotate('+r3(v[0]*f)+'deg)'})];
   if(q.k==='lift'){
     const d=q.d[0];
     return [frames(rate,t=>{
       const j=ride.jolt(t-q.dt,d[1],d[2]);
       return [-(q.hop||0)*Math.max(j,-.4),1+(q.squash||0)*j+(q.breath||0)*(.5-.5*Math.cos(PI2*14*t/ride.P))];
     },[.06,.0014],raw),(v,f)=>({transform:'translate3d(0,'+r3(v[0]*f)+'px,0) scaleY('+r3(1+(v[1]-1)*f)+')'})];
   }
   return [frames(12,t=>[(q.slide||1)*ride.sway(t-.35)],[.06],raw),(v,f)=>({transform:'translate3d('+r3(v[0]*f)+'px,0,0)'})];
  }
  function pieceFrames(i,f=1){const [list,format]=kept('piece'+i,()=>pieceRaw(i));return kept('piece'+i+'@'+f,()=>list.map(o=>({offset:o.offset,...format(o.v,f)})));}
  function load(){
   if(state)return;state='loading';
   Promise.resolve().then(()=>read(base+file)).then(response=>{if(!response?.ok)throw Error('missing '+file);return response.json();}).then(json=>{
     if(!json?.lands||!Array.isArray(json.pieces)||!json.ride||!Array.isArray(json.box)||!Array.isArray(json.sheet))throw Error('ride');
     const made=makeRide(json.ride);
     if(!(made.P>0)||!Number.isFinite(made.shake(1)))throw Error('ride');
     data=json;
     ride=made;
     state='ready';
   }).catch(()=>{
     data=null;
     ride=null;
     state='failed';
   }).then(()=>{
     const list=waits;
     waits=[];
     for(const f of list)f();
   });
  }
  const whenRead=f=>{if(state==='ready'||state==='failed')f();else{waits.push(f);load();}};
  const BOXW=()=>data.box[0];
  // a land: its strips, each laid twice and sliding one length for ever; the whole of it rides against the window
  function land(id,name,done){
   const info=data.lands[name],node=el('tk-layer tk-land'),out=el('tk-out'),urls=[],imgs=[],strips=[],stars=[],hour=id.slice(id.lastIndexOf('-')+1);
   let closed=false,anims=[],slides=[];
   node.setAttribute('data-layer',id);
   node.append(out);
   const pic={id,node,ready:false,failed:false,run,glide,quiver,paint(g,x,y,w,h){
     for(const img of imgs)if(img)g.drawImage(img,x,y,w,h);
   },close(){
     closed=true;
     for(const a of anims)a.cancel();
     anims=[];
     for(const a of slides)a.cancel();
     slides=[];
     railTrack(out,null);
     node.remove();
     for(const u of urls.splice(0))URLs.revokeObjectURL(u);
     open.delete(pic);
   }};
   // (the strips' own travel, set again whenever the pace changes; the land rides against the window only while the train goes)
   function glide(){
     for(const a of slides)a.cancel();
     slides=[];
     if(!pic.ready||closed||bareLands)return;
     for(const [strip,speed,turn]of strips){const a=slide(strip,speed,turn);if(a)slides.push(a);}
   }
   // (the whole land rides against the window on the rail: more, the faster the train goes; it surges back as the train speeds up)
   function quiver(){
     if(!moving||!pic.ready||closed||bareLands){railTrack(out,null);return;}
     if(!tracks.has(out))railTrack(out,outTrack({amp:1.7,near:0,depth:.6,surge:SURGE,turn:false}));
   }
   function run(){
    node.style.visibility=bareLands?'hidden':'';
    for(const a of anims)a.cancel();
    anims=[];
    if(bareLands){for(const a of slides)a.cancel();slides=[];railTrack(out,null);return;}
    glide();
    quiver();
    if(!moving||!pic.ready||closed)return;
    stars.forEach((star,i)=>{
      const life=2400+(i*977)%2900,b=start(star,[{opacity:.2},{offset:.3,opacity:1},{offset:.55,opacity:.35},{offset:.8,opacity:.9},{opacity:.2}],life,{at:-((i*613)%life)});
      if(b)anims.push(b);
    });
   }
   if(!info){pic.failed=true;Promise.resolve().then(()=>done(false));return pic;}
   Promise.all(info.layers.map((layer,i)=>owned(id+'-'+i+'.webp',urls,()=>closed).then(url=>{imgs[i]=image(url,'tk-tile');return decoded(imgs[i]);}))).then(()=>{
    if(closed)return;const W=BOXW();
    // after dark a few of the sky's stars twinkle (between the sky and the first strip)
    let sky=null;
    if(info.stars&&(hour==='night'||hour==='dusk')){
      sky=el('tk-stars');
      for(let i=0;i<(hour==='night'?22:8);i++){
        const h=n=>{const v=Math.sin((i+1)*n)*43758.5453;return v-Math.floor(v);},star=css(el('tk-star'),{left:Math.round(700+h(12.9898)*3340)+'px',top:Math.round(6+h(78.233)*140)+'px'});
        sky.append(star);
        stars.push(star);
      }
    }
    info.layers.forEach((layer,i)=>{
     if(i===1&&sky){out.append(sky);sky=null;}
     if(layer.still||!layer.speed){out.append(imgs[i]);return;}
     const turn=layer.turn>0?layer.turn:W-1,strip=el('tk-strip'),twin=image(imgs[i].getAttribute('src'),'tk-tile');
     twin.style.left=turn+'px';
     strip.append(imgs[i],twin);
     out.append(strip);
     strips.push([strip,layer.speed,turn]);
    });
    if(sky)out.append(sky);
    pic.ready=true;run();done(true);
   },()=>{if(!closed){pic.failed=true;done(false);}});
   open.add(pic);return pic;
  }
  // the cabin: its picture, then every piece in its place (a link sits inside the link it hangs from), then what the
  // page draws itself: steam, the record turning, the clocks' second hands, the plane's airscrew, dust in the daylight
  function cabin(id,stage,done,own){
   const node=el('tk-layer tk-cabin'),urls=[],parts=[],extra=[];let closed=false,anims=[],timer=0,wave=0,swings=[],room=null,sheet='',roomUrl='';node.setAttribute('data-layer',id);
   const pic={id,node,ready:false,failed:false,run,surge,paint(g,x,y,w,h){
     if(room)g.drawImage(room,x,y,w,h);
   },close(){closed=true;stop();node.remove();for(const u of urls.splice(0))URLs.revokeObjectURL(u);open.delete(pic);}};
   const lit=stage==='sunset'||stage==='dusk'||stage==='night',
     day=stage==='morning'||stage==='noon'||stage==='sunset',
     lamps=new Set(['moon lamp','floor lamp','tall lamp','table lamp','desk lamp','glass bulb']);
   function stop(){
     if(timer)global.clearTimeout(timer);
     timer=0;
     if(wave)global.clearTimeout(wave);
     wave=0;
     swings=[];
     for(const a of anims)a.cancel();
     anims=[];
     for(const n of parts)railTrack(n,null);
     for(const item of extra)if(item[0]==='sun')railTrack(item[1],null);
   }
   function build(){
    const [AW,AH]=data.sheet,byName=new Map();
    data.pieces.forEach((q,i)=>{
     const parent=q.p>=0?data.pieces[q.p]:null,
       n=css(el('tk-piece'),{
         left:(q.x-(parent?parent.x:0))+'px',
         top:(q.y-(parent?parent.y:0))+'px',
         width:q.w+'px',
         height:q.h+'px',
         backgroundImage:'url("'+sheet+'")',
         backgroundPosition:(-q.ax)+'px '+(-q.ay)+'px',
         backgroundSize:AW+'px '+AH+'px',
         transformOrigin:r3(q.px-q.x)+'px '+r3(q.py-q.y)+'px'
       });
     n.setAttribute('data-piece',q.n);parts.push(n);byName.set(q.n,[n,q]);(parent?parts[q.p]:node).append(n);
    });
    const X=data.extras||{},add=(cls,styles,into)=>{const n=css(el(cls),styles);(into||node).append(n);return n;};
    for(const s of X.steam||[]){const box=add('tk-steam',{left:s.x+'px',top:s.y+'px'});const puffs=[];for(let i=0;i<6;i++)puffs.push(add('tk-puff',{},box));extra.push(['steam',box,puffs,s.s||1]);}
    if(X.record){
      const r=X.record,box=add('tk-record',{left:(r.cx-r.rx)+'px',top:(r.cy-r.ry)+'px',width:2*r.rx+'px',height:2*r.rx+'px',transform:'scaleY('+r3(r.ry/r.rx)+')'});
      extra.push(['record',add('tk-disc',{},box),r.turn||1.8]);
      add('tk-gloss',{},box);
    }
    for(const h of X.hands||[])extra.push(['hand',add('tk-hand',{left:(h.cx-.5)+'px',top:(h.cy-h.r)+'px',height:h.r+'px'})]);
    if(X.prop&&byName.has(X.prop.on)){const [host,q]=byName.get(X.prop.on),p=X.prop;extra.push(['prop',add('tk-prop',{left:(p.x-q.x-1.5)+'px',top:(p.y-q.y-p.h)+'px',height:2*p.h+'px'},host)]);}
    // the laptop: a line being typed (in the screen's own ink at this hour), the cursor at its end
    const ink=X.type?.col?.[stage]||'';
    if(X.type){const t=X.type;extra.push(['type',add('tk-type',{left:t.x+'px',top:t.y+'px',width:t.w+'px',height:t.h+'px',...(ink?{background:ink}:{})}),t]);}
    if(X.cursor){const c=X.cursor;extra.push(['cursor',add('tk-cursor',{left:c.x+'px',top:c.y+'px',width:c.w+'px',height:c.h+'px',...(ink?{background:ink}:{})}),X.type||null]);}
    // a lamp that is on at this hour wears a soft halo; it sits inside the lamp's piece, so it rides with it
    for(const g of X.glow||[]){
      if(!Array.isArray(g.on)||!g.on.includes(stage))continue;
      const host=byName.get(g.at),ox=host?host[1].x:0,oy=host?host[1].y:0;
      extra.push(['glow',add('tk-glow',{left:(g.x-ox-g.r)+'px',top:(g.y-oy-g.r)+'px',width:2*g.r+'px',height:2*g.r+'px'},host?.[0]),extra.length]);
    }
    if(X.sand){
      const s=X.sand,host=byName.get('hourglass'),box=add('tk-sand',host?{left:(s.x-host[1].x)+'px',top:(s.y-host[1].y)+'px',height:s.h+'px'}:{left:s.x+'px',top:s.y+'px',height:s.h+'px'},host?.[0]);
      extra.push(['sand',add('',{},box)]);
    }
    // the shade a passing mountain or tree throws into the room (sun-<land>.json): over the room only, in its own shape
    if(day&&roomUrl){const shade=add('tk-sun',{display:'none',maskImage:'url("'+roomUrl+'")',webkitMaskImage:'url("'+roomUrl+'")'});shade.setAttribute('data-hour',stage);extra.push(['sun',shade]);}
    if(day){
      const motes=add('tk-motes',{});
      for(let i=0;i<26;i++){
        const h=n=>{const v=Math.sin((i+1)*n)*43758.5453;return v-Math.floor(v);};
        extra.push(['mote',add('tk-mote',{left:Math.round(700+h(12.9898)*3300)+'px',top:Math.round(24+h(78.233)*250)+'px'},motes),h(39.3468),h(11.135)]);
      }
    }
   }
   function run(){
    stop();if(!moving||!pic.ready||closed)return;const P=ride.P*1000;let i=0;
    for(const item of extra){
     const [kind,n]=item;let a=null;
     if(kind==='steam'){
       a=start(n,kept('steam',()=>frames(12,t=>[-2.6*ride.pendulum(t,1.9,.35)],[.1],v=>({transform:'skewX('+r3(v[0])+'deg)'}))),P,{ride:1});
       item[2].forEach((puff,k)=>{
         const side=k%2?1:-1,
           b=start(
             puff,
             [
               {transform:'translate3d(0,0,0) scale(.28)',opacity:0},
               {offset:.14,opacity:.5},
               {offset:.5,transform:'translate3d('+side*4*item[3]+'px,'+(-30*item[3])+'px,0) scale('+r3(.9*item[3])+')',opacity:.34},
               {transform:'translate3d('+(-side*5*item[3])+'px,'+(-60*item[3])+'px,0) scale('+r3(1.7*item[3])+')',opacity:0}
             ],
             4200,
             {at:-k*700});
         if(b)anims.push(b);
       });
     }
     else if(kind==='record')a=start(n,[{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],item[2]*1000);
     else if(kind==='hand'){
       a=start(n,[{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],60000,{easing:'steps(60,end)'});
       if(a){const d=new global.Date();try{a.startTime=null;a.currentTime=d.getSeconds()*1000+d.getMilliseconds();a.play?.();}catch{}}
     }
     else if(kind==='prop')a=start(n,[{transform:'scaleY(1)'},{transform:'scaleY(.12)'},{transform:'scaleY(1)'}],900);
     else if(kind==='cursor'){
       a=start(n,[{opacity:1},{opacity:0}],1060,{easing:'steps(2,jump-none)'});
       const t=item[2];
       if(t){
         const T=(t.steps*.46+3)*1000,
           b=start(
             n,
             [
               {transform:'translate3d('+(-t.w)+'px,0,0)',easing:'steps('+t.steps+',end)'},
               {offset:r3(1-2800/T),transform:'translate3d(0,0,0)'},
               {offset:.985,transform:'translate3d(0,0,0)'},
               {transform:'translate3d('+(-t.w)+'px,0,0)'}
             ],
             T);
         if(b)anims.push(b);
       }
     }
     else if(kind==='type'){
       const t=item[2],T=(t.steps*.46+3)*1000;
       a=start(n,[{transform:'scaleX(0)',easing:'steps('+t.steps+',end)'},{offset:r3(1-2800/T),transform:'scaleX(1)'},{offset:.985,transform:'scaleX(1)'},{transform:'scaleX(0)'}],T);
     }
     else if(kind==='glow')a=start(n,[{opacity:.7},{offset:.45,opacity:1},{offset:.7,opacity:.82},{opacity:.7}],5200+(item[2]*900)%2700,{at:-((item[2]*1300)%5000)});
     else if(kind==='sand')a=start(n,[{transform:'translate3d(0,-6px,0)'},{transform:'translate3d(0,0,0)'}],260);
     else if(kind==='sun'){railTrack(n,sunTrack(stage,stage==='noon'?.26:.32));continue;}
     else if(kind==='mote'){
       if(moving<2)continue;
       const life=(8+item[2]*8)*1000;
       a=start(
         n,
         [
           {transform:'translate3d(0,0,0)',opacity:0},
           {offset:.25,opacity:.34},
           {offset:.5,transform:'translate3d('+r3(10-20*item[3])+'px,-9px,0)',opacity:.1},
           {offset:.75,opacity:.3},
           {transform:'translate3d('+r3(26-12*item[3])+'px,-22px,0)',opacity:0}
         ],
         life,
         {at:-item[3]*life});
     }
     if(a)anims.push(a);
    }
    // the pieces a few at a time, so starting never holds the page
    const some=()=>{
      timer=0;
      if(closed||!moving)return;
      const until=global.performance?.now?.()+5;
      do{
        const q=data.pieces[i];
        if(moving<2&&q.p>=0){i++;continue;}
        railTrack(parts[i],pieceTrack(i));
        swings[i]=true;
        {
          if(lit&&lamps.has(q.n)){
            const b=start(parts[i],[{filter:'brightness(1)'},{offset:.45,filter:'brightness(1.07)'},{offset:.7,filter:'brightness(.98)'},{filter:'brightness(1)'}],5200+(i%5)*700,{at:-(i%7)*830});
            if(b)anims.push(b);
          }
          if(lit&&q.n.startsWith('fairy lights')){
            const b=start(parts[i],[{filter:'brightness(1)'},{filter:'brightness(1.3)'},{filter:'brightness(.94)'},{filter:'brightness(1)'}],2300+(i%7)*230,{at:-(i%5)*410});
            if(b)anims.push(b);
          }
        }
        i++;
      }while(i<parts.length&&!(global.performance?.now?.()>until));
      if(i<parts.length)timer=global.setTimeout(some,0);
    };
    if(parts.length)some();
   }
   // (engine 2: the pieces ride the rail, whose force follows the speed itself; a new force needs nothing more)
   function surge(){
    return;
    if(wave)global.clearTimeout(wave);wave=0;if(!moving||!pic.ready||closed||!(pace>0))return;const P=ride.P*1000,f=force(pace);let j=0;
    const more=()=>{
      wave=0;
      if(closed||!moving)return;
      const until=global.performance?.now?.()+5;
      do{
        const old=swings[j];
        if(old){const a=start(parts[j],pieceFrames(j,f),P,{ride:1});if(a){old.cancel();const at=anims.indexOf(old);if(at>=0)anims[at]=a;else anims.push(a);swings[j]=a;}}
        j++;
      }while(j<parts.length&&!(global.performance?.now?.()>until));
      if(j<parts.length)wave=global.setTimeout(more,0);
    };
    more();
   }
   Promise.all([owned('cabin-'+(own?own+'-':'')+stage+'.webp',urls,()=>closed),owned('pieces-'+(own?own+'-':'')+stage+'.webp',urls,()=>closed)]).then(([a,b])=>{
     room=image(a,'tk-room');
     roomUrl=a;
     sheet=b;
     return Promise.all([decoded(room),decoded(image(b,''))]);
   }).then(()=>{
    if(closed)return;node.append(room);build();pic.ready=true;run();done(true);
   },()=>{if(!closed){pic.failed=true;done(false);}});
   open.add(pic);return pic;
  }
  // the shadows on the floor: for the land that is passing, each of its nearest layers as a strip of shade that leans
  // away from the window and slides at that layer's speed
  function floor(stageNode,name,strength){
   if(name)railLand(name);
   const info=data?.lands?.[name],key=strength>0&&info?.shade?.length?name:'';
   if(key!==floorKey){
    floorKey=key;for(const a of floorAnims)a.cancel();floorAnims=[];floorNode?.remove();floorNode=null;for(const u of floorUrls)URLs.revokeObjectURL(u);floorUrls=[];
    if(key){
      const node=floorNode=el('tk-shade'),lean=el('','i');
      node.append(lean);
      const f=data.extras?.floor||{y:262,h:250,lean:.85};
      css(node,{top:f.y+'px',height:f.h+'px'});
      lean.style.transform='skewX('+r3(Math.atan(f.lean)*180/Math.PI)+'deg)';
     info.shade.forEach(sh=>{
       blob(sh.file+'.png').then(url=>{
         if(floorNode!==node){URLs.revokeObjectURL(url);return;}
         floorUrls.push(url);
         const strip=css(el('','b'),{backgroundImage:'url("'+url+'")'});
         strip.setAttribute('data-speed',String(sh.speed));
         lean.append(strip);
         runFloor();
       },()=>{});
     });}
   }
   if(floorNode){if(floorNode.parentNode!==stageNode||stageNode.lastChild!==floorNode)stageNode.append(floorNode);floorNode.style.opacity=String(r3(strength));}
  }
  // small things on the page that ride with the cabin (the course cards' motifs): node -> 'sway' (it stands: it leans and rings) or 'hop';
  // and the beams of the room's daylight: 'lean' (n is the beam's own lean in degrees, `by` how far one unit of the ride leans it)
  const riders=new Map();
  function runRiders(){const f=force(pace);
   for(const [node,r]of riders){
     if(r.kind==='rail')continue;
     r.a?.cancel();
     r.a=null;
     node.removeAttribute?.('data-ride');
     if(!moving||!(pace>0)||!ride||!node.isConnected)continue;
     node.setAttribute?.('data-ride','');
    r.a=start(
      node,
      r.kind==='shake'?
        outsideOf(r.n,r.by,true):
        r.kind==='lean'?
          kept('rider-lean'+r.n+'/'+r.by+'@'+f,()=>frames(30,t=>[r.n+r.by*f*(.5*ride.sway(t-.15)+.5*ride.shake(t-.15))],[.012],v=>({transform:'skewX('+r3(v[0])+'deg)'}))):
          r.kind==='sway'?
            kept('rider-sway'+r.n+'@'+f,()=>frames(36,t=>[f*ride.lean([['stand',2.3+r.n*.17,.11,3.4,1.3],['stand',5.6,.07,.6,0]],t-r.n*.07)],[.06],v=>({transform:'rotate('+r3(v[0])+'deg)'}))):
            kept('rider-hop'+r.n+'@'+f,()=>frames(30,t=>{
      const j=ride.jolt(t-r.n*.05,2.6+r.n*.21,.24);
      return [-2.2*f*Math.max(j,-.4),.9*f*ride.sway(t-.2)];
    },[.05,.05],v=>({transform:'translate3d(0,'+r3(v[0])+'px,0) rotate('+r3(v[1])+'deg)'}))),ride.P*1000,{ride:1});}
  }
  function runFloor(){
    for(const a of floorAnims)a.cancel();
    floorAnims=[];
    if(!floorNode)return;
    const W=BOXW();
    for(const strip of floorNode.querySelectorAll('b')){const a=slide(strip,Number(strip.getAttribute('data-speed')),W);if(a)floorAnims.push(a);}
  }
  // the travel's pace from a moment on: (pace, that moment on the band's clock, how far the journey had come by then, how much of
  // the ride's loop, the loop's rate)
  function steady(p,at,far,gone,rate){
    p=Number.isFinite(p)?Math.min(12,Math.max(0,p)):1;
    at=Number.isFinite(at)?at:0;
    far=Number.isFinite(far)?far:0;
    gone=Number.isFinite(gone)?gone:0;
    rate=Number.isFinite(rate)?rate:rideRate(p);
    if(p===pace&&at===paceAt&&far===paceFar&&gone===rideFar&&rate===loopRate)return;
    const turned=(p>0)!==(pace>0),stronger=swing(p)!==swing(pace),harder=force(p)!==force(pace);
    pace=p;
    paceAt=at;
    paceFar=far;
    rideFar=gone;
    loopRate=rate;
   if(turned){for(const pic of open)pic.run();runRiders();}
   else{for(const pic of open){pic.glide?.();if(stronger)pic.quiver?.();}retime();if(harder){for(const pic of open)pic.surge?.();runRiders();}}
   runFloor();
  }
  // the travel now: steady, or the next step of a change of speed (and the step after it, a tenth of a second on)
  function follow(){
   if(stepping){global.clearTimeout(stepping);stepping=0;}
   const now=(global.performance?.now?.()||0)-epoch,here=travelAt(route,now);
   // (steady, or nothing may move: the pace it ends at, from the moment it ends; a change under way is taken up again once things may move)
   if(!here.moving||!moving||typeof global.setTimeout!=='function'){steady(route.v1,route.t0+route.T*1000,route.xT,route.rT,rideRate(route.v1));return;}
   const then=travelAt(route,now+STEP);steady(Math.max(0,(then.x-here.x)*1000/STEP),now,here.x,here.r,Math.max(0,(then.r-here.r)*1000/STEP));
   stepping=global.setTimeout(()=>{stepping=0;follow();},STEP);
  }
  return {
   whenRead,get failed(){return state==='failed';},get box(){return data?.box||null;},
   // a picture of the band by its name in the band's words: land-<land>-<stage>, cabin-<stage>, or a land's own cabin-<land>-<stage>
   open(id,done){const m=/^land-([a-z]+)-([a-z]+)$/.exec(id),c=/^cabin-(?:([a-z]+)-)?([a-z]+)$/.exec(id);if(m)return land(id,m[1],done);if(c)return cabin(id,c[2],done,c[1]||'');return null;},
   // how much may move: 0 nothing, 1 the lighter half (Graphics Medium), 2 everything
   move(on){on=on===true?2:Number(on)||0;if(on===moving)return;moving=on;for(const pic of open)pic.run();runFloor();runRiders();if(route.T>0)follow();railRun();},
   // a thing on the page takes the ride (kind 'sway' or 'hop'; n tells one from the next so no two move alike; kind 'shake': what is
   // outside, riding n px against the room as the land in the window does, and `by` px more of bounce if it is close); '' lets it go
   rider(node,kind,n,by){const had=riders.get(node);if(had?.kind==='rail'&&kind!=='rail'){railTrack(node,null);node.removeAttribute?.('data-ride');riders.delete(node);}
    // (kind 'rail': what is outside, on the rail; n says how: {amp, near, depth, surge, turn})
    if(kind==='rail'){
      const spec=n&&typeof n==='object'?{amp:Number(n.amp)||0,near:Number(n.near)||0,depth:Number.isFinite(n.depth)?n.depth:1,surge:Number(n.surge)||0,turn:!!n.turn}:null;
      if(!spec)return;
      const text=JSON.stringify(spec);
      if(had?.kind==='rail'&&had.text===text)return;
      riders.set(node,{kind,text,a:null});
      node.setAttribute?.('data-ride','');
      whenRead(()=>{if(state==='ready'&&riders.get(node)?.text===text)railTrack(node,outTrack(spec));});
      return;
    }
    if(!kind){had?.a?.cancel();node.removeAttribute?.('data-ride');riders.delete(node);return;}
    if(had&&had.kind===kind&&(kind!=='shake'||(had.n===(Number(n)||0)&&had.by===(Number(by)||0))))return;
    had?.a?.cancel();
    riders.set(node,kind==='lean'||kind==='shake'?{kind,n:Number(n)||0,by:Number(by)||0,a:null}:{kind,n:n%6,a:null});
    whenRead(()=>{if(state==='ready')runRiders();});
   },
   // the band runs in a page of its own that began at this moment of this document's clock: the riders move from there
   since(ms){ms=Number.isFinite(ms)?ms:0;if(ms===epoch)return;epoch=ms;runRiders();runFloor();for(const t of tracks.values())t.k=null;railRun();},
   // the land that is passing (its own ride, live-<land>.json)
   land(name){if(/^[a-z]{1,16}$/.test(String(name||'')))railLand(name);},
   // the travel's pace from a moment on: (pace, that moment on the band's clock, how far the journey had come by then)
   // the travel (see travelOf): a list of four numbers is a steady pace from a moment on, eight a change of speed under way
   pace(list,at,far,gone){
     if(!Array.isArray(list))list=[list,at,far,gone];
     const next=travelOf(list),text=JSON.stringify(list);
     if(text===route.text)return;
     next.text=text;
     route=next;
    // (the journey: every travel told, each from its own moment; what is worked out again starts at the window of now)
    if(journey[0][1]===null)
      journey=[[-Infinity,next]];
    else{journey=journey.filter(([from])=>from<next.t0);journey.push([next.t0,next]);if(journey.length>8)journey=journey.slice(-8);journey[0]=[-Infinity,journey[0][1]];}
    const k=Math.floor(((global.performance?.now?.()||0)-epoch)/(WIN*1000));
    for(const key of [...sims.keys()])if(key>=k)sims.delete(key);
    looks.clear();
    for(const t of tracks.values())t.k=null;
    follow();railRun();},
   get route(){return route;},
   get lands(){return data?.lands||null;},
   live(name){return lives.get(name)||null;},
   // (the land's own page paints the window's land: the band's own lands stand hidden and still)
   bare(on){on=!!on;if(on===bareLands)return;bareLands=on;for(const pic of open)if(pic.glide)pic.run();},
   // (the rail at a moment: the journey there, the joints and axles crossed in its window, the rumble, what is outside for a layer o,
   // and a piece's numbers with the part that the train's acceleration gives it)
   probe(t,o){if(!ride)return null;const k=Math.floor(t/(WIN*1000)),sim=simOf(k),from=k*WIN*1000,v=read1(sim.V,sim,t);
    const pull=i=>{
      const q=data.pieces[i],tt=t-(q.dt||0)*1000;
      let y=0;
      for(const d of q.d){const os=oscOf(sim,d[0],d[1],d[2]);y+=d[3]*(d[0]==='hang'?PULL[0]:PULL[1])*read1(os.P,sim,tt);}
      return y;
    };
    return {
      k,
      v,
      a:read1(sim.A,sim,t),
      x:read1(sim.X,sim,t),
      kicks:sim.kicks.filter(([tt])=>tt>=from&&tt<from+WIN*1000).map(([tt,a])=>[tt,a]),
      axles:sim.axles.filter(([tt])=>tt>=from&&tt<from+WIN*1000).length,
      rumble:rumbled(v),
      rail:{...rail},
      outside:o?outsideAt(o,sim,t):null,
      piece:i=>pieceAt(i,sim,t),
      pull,
      shade:(stage,deep)=>sunAt(stage,deep,sim,t)[0]
    };},
   get window(){return WIN;},
   get travel(){return [pace,paceAt,paceFar,rideFar];},
   floor,
   // the strips of shade a land throws ([{file, speed}]), once the ride is read (settled: read or failed)
   shade(name){return data?.lands?.[name]?.shade||[];},get settled(){return state==='ready'||state==='failed';},
   clear(){
     if(stepping){global.clearTimeout(stepping);stepping=0;}
     floor(null,'',0);
     for(const [node,r]of riders){r.a?.cancel();node.removeAttribute?.('data-ride');if(r.kind==='rail')railTrack(node,null);}
     riders.clear();
     if(railTimer){global.clearTimeout(railTimer);railTimer=0;}
     if(railSlice){global.clearTimeout(railSlice);railSlice=0;}
   },
   get moving(){return moving;}
  };
 }
 // the stage of the day a travelling band is in, as the eye sees it: the pictures lie in list order, so it is the topmost
 // cabin once that is more than half there, else the cabin under it
 const stageOf=wanted=>{
   const cabins=[];
   for(const w of wanted){const m=/^cabin-(?:[a-z]+-)?([a-z]+)$/.exec(w.id);if(m)cabins.push([m[1],w.alpha]);}
   if(!cabins.length)return '';
   const top=cabins[cabins.length-1];
   return cabins.length<2||top[1]>.5?top[0]:cabins[cabins.length-2][0];
 };
 // every stage's share of what the eye sees of a travelling band (the topmost cabin as much as it is there, then what it
 // leaves to those under it), and the land most there
 const sharesOf=wanted=>{
   const hours=[];
   let left=1,land='',most=0;
   for(let i=wanted.length-1;i>=0;i--){
     const w=wanted[i],c=/^cabin-(?:[a-z]+-)?([a-z]+)$/.exec(w.id),l=/^land-([a-z]+)-[a-z]+$/.exec(w.id);
     if(c){const share=Math.round(w.alpha*left*1000)/1000;if(share>0)hours.unshift([c[1],share]);left*=1-w.alpha;}else if(l&&w.alpha>most){most=w.alpha;land=l[1];}
   }
   return {hours,land};
 };
 // a band's words without their fades: a stage changes at its hour (Graphics Low)
 const stillBand=b=>({...b,pieces:(b.pieces||[]).map(p=>p.when?.fade?{...p,when:{...p.when,fade:0}}:p),...(b.variants?{variants:b.variants.map(stillBand)}:{})});
 // a moment of a band, for the page under it: where the picture lies on the band (fit), the hours and the land
 const momentOf=(K,words,env,view)=>{
   try{
     const look=K.resolve(words,env),box=words.box||[1,1];
     return {
       fit:K.fit({w:box[0],h:box[1]},view,{focus:look.focus||{x:1,y:.5},keep:look.keep}),
       ...sharesOf((look.pieces||[]).filter(p=>p.draw?.[0]?.kind==='image').map(p=>({id:p.draw[0].asset,alpha:p.presence??1})))
     };
   }catch{return null;}
 };
 /* skyBand(doc, base, band, on, rideFile) -> {node, show, clear, destroy} or null without the band kit. show(env, view,
    swap, quiet, page, moving) lays the pictures for that moment (env: the clock, the mode and the band's shape) over the
    band; swap (Graphics Low) leaves out the fades so a stage changes at its hour. With a ride file the pictures are the
    travelling lands and the cabin with its pieces (bandRide), laid on a stage in the art's own pixels and scaled to
    the band; `moving` says how much may move: 0 nothing (reduced motion, Still, Off, Graphics Low, a hidden tab, a
    band scrolled away), 1 the lighter half (Graphics Medium: no links inside links, no dust), 2 everything. Without one each picture is a single still, read as the extension's own bytes. The picture
    under the greeting is measured (text "auto", on.tone); one that cannot be read calls on.fail. */
 function skyBand(doc,base,raw,on,rideFile,lived){
  const K=global.ReserveBandKit,read=reader(base),URLs=global.URL;if(!K?.clean||!K.resolve||!K.fit)return null;
  const band=K.clean(raw,{picture:value=>typeof value?.asset==='string'?{asset:value.asset}:null,image:asset=>/^[a-z0-9-]{1,64}$/.test(asset)}).band;
  const swapped=stillBand(band);
  const box=band.box||[1,1],
    node=doc.createElement('div'),
    art=doc.createElement('div'),
    pictures=new Map(),
    ride=rideFile?bandRide(doc,base,rideFile,lived):null,
    stage=ride?doc.createElement('div'):null;
  node.className='tk-band';node.setAttribute('aria-hidden','true');art.className='tk-art';node.append(art);if(stage){stage.className='tk-stage';art.append(stage);}
  const pct=n=>Math.round(n*1e5)/1e3+'%',px=n=>Math.round(n*100)/100+'px',set=(el,styles)=>{
    for(const [key,value]of Object.entries(styles))if((el.style[key]||'')!==value)el.style[key]=value;
  };
  let dead=false,now=null,wanted=[],measured='',sample=null;
  function free(id){
    const p=pictures.get(id);
    if(!p)return;
    pictures.delete(id);
    if(p.close){p.close();return;}
    if(!p.img)return;
    p.img.remove();
    p.img.removeAttribute('src');
    if(p.url)URLs.revokeObjectURL(p.url);
  }
  function request(id){
   if(ride){
    const holder={ready:false,failed:false,waiting:true};pictures.set(id,holder);
    ride.whenRead(()=>{
     if(dead||pictures.get(id)!==holder)return;
     const pic=ride.failed?null:ride.open(id,ok=>{if(dead||pictures.get(id)!==pic)return;place();});
     if(!pic){holder.failed=true;holder.waiting=false;place();return;}
     pictures.set(id,pic);
    });
    return;
   }
   const p={img:doc.createElement('img'),url:'',ready:false,failed:false},img=p.img,file=base+id+'.webp',mine=()=>!dead&&pictures.get(id)===p;pictures.set(id,p);
   img.className='tk-layer';img.alt='';img.draggable=false;img.decoding='async';img.setAttribute('aria-hidden','true');img.setAttribute('data-layer',id);
   const settle=ok=>{if(!mine())return;p.ready=ok;p.failed=!ok;place();};
   const open=src=>{
     if(!mine())return;
     if(typeof img.decode==='function'){img.setAttribute('src',src);img.decode().catch(()=>pictureIn(img)).then(()=>settle(true),()=>settle(false));}
     else{const wait=pictureIn(img,true);img.setAttribute('src',src);wait.then(()=>settle(true),()=>settle(false));}
   };
   if(typeof read==='function'&&typeof URLs?.createObjectURL==='function')
     Promise.resolve().then(()=>read(file)).then(response=>{if(!response?.ok)throw Error('missing '+id);return response.blob();}).then(blob=>{
       if(!mine())return;
       p.url=URLs.createObjectURL(blob);
       open(p.url);
     }).catch(()=>settle(false));
   else open(file);
  }
  const shown=p=>p.node?!!p.node.parentNode:!!p.img?.parentNode;
  function show(env,view,swap,quiet,page,moving,travel,bare){
   if(dead)return;const look=K.resolve(swap?swapped:band,env);ride?.bare?.(!!bare);
   wanted=(look.pieces||[]).filter(p=>p.draw?.[0]?.kind==='image').map(p=>
     ({id:p.draw[0].asset,at:p.at?.type==='area'?{x:p.at.x,y:p.at.y,w:p.at.w,h:p.at.h}:null,alpha:Math.round((p.presence??1)*1000)/1000}));
   now={look,view,quiet,page};if(Array.isArray(travel))ride?.pace(travel);ride?.move(swap?0:moving);
   for(const [id,p]of [...pictures])if(!shown(p)&&!wanted.some(w=>w.id===id))free(id);
   for(const w of wanted)if(!pictures.has(w.id))request(w.id);
   place();
  }
  // the shown pictures stay until every one of the next is in; then all are laid in list order (depth) over the art
  function place(){
   if(dead||!now)return;
   if(wanted.some(w=>pictures.get(w.id)?.failed)){on.fail?.();return;}
   if(!wanted.every(w=>pictures.get(w.id)?.ready))return;
   const look=now.look,f=K.fit({w:box[0],h:box[1]},now.view,{focus:look.focus||{x:1,y:.5},keep:look.keep});
   set(art,{left:px(f.x),top:px(f.y),width:px(f.w),height:px(f.h)});
   if(ride){
    // the stage: the art's own pixels, scaled to the band
    set(stage,{transform:'scale('+Math.round(f.w/box[0]*1e5)/1e5+')'});
    const order=wanted.map(w=>{
      const el=pictures.get(w.id).node;
      set(el,{opacity:w.alpha<1?String(w.alpha):''});
      return el;
    }),kids=[...stage.children].filter(el=>el.classList?.contains('tk-layer'));
    if(kids.length!==order.length||order.some((el,i)=>kids[i]!==el))for(const el of order)stage.append(el);
    for(const id of [...pictures.keys()])if(!wanted.some(w=>w.id===id))free(id);
    // the shadows on the floor are the passing land's, as strong as the hour is light
    let name='',most=0,light=0;const strength={morning:.24,noon:.3,sunset:.34};
    for(const w of wanted){const m=/^land-([a-z]+)-([a-z]+)$/.exec(w.id);if(!m)continue;if(w.alpha>=most){most=w.alpha;name=m[1];}light+=w.alpha*(strength[m[2]]||0);}
    ride.floor(stage,name,ride.moving?Math.min(.4,light):0);
    // a land without a day (`night` in its entry; none since 4.2.2, when the deep sea left): the room answers it (theme.css, data-mood)
    {const mood=rooms.train?.pages?.[name]?.night?'deep':null;if(stage.getAttribute('data-mood')!==mood){if(mood)stage.setAttribute('data-mood',mood);else stage.removeAttribute('data-mood');}}
    // the stage of the day the band is in now (the cabin most present), for the page under it
    on.stage?.(stageOf(wanted));
   }else{
    const order=wanted.map(w=>{
      const img=pictures.get(w.id).img,r=w.at||{x:0,y:0,w:1,h:1};
      set(img,{left:pct(r.x),top:pct(r.y),width:pct(r.w),height:pct(r.h),opacity:w.alpha<1?String(w.alpha):''});
      return img;
    });
    if(art.children.length!==order.length||order.some((img,i)=>art.children[i]!==img))for(const img of order)art.append(img);
    for(const id of [...pictures.keys()])if(!wanted.some(w=>w.id===id))free(id);
   }
   if(!node.hasAttribute('data-ready'))node.setAttribute('data-ready','');
   measure(f);
  }
  // text "auto": how light the band is under the greeting, the pictures as they are laid, the page where they are clear
  // and where the band fades into the page over its left quarter (the same reading as a pack's band)
  function measure(f){
   const {look,view,quiet,page}=now;if(look.text!=='auto'||!quiet){on.tone?.('');return;}
   const key=JSON.stringify([wanted,Math.round(f.x),Math.round(f.y),Math.round(f.w),quiet,view.w,page]);if(key===measured)return;measured=key;
   let l=null;
   try{
    const W=256,H=32;
    if(!sample){const c=doc.createElement('canvas');c.width=W;c.height=H;sample=c.getContext?.('2d',{willReadFrequently:true})||null;}
    const g=sample;
    g?.clearRect?.(0,0,W,H);
    const x0=Math.floor(clamp01((quiet.x-f.x)/f.w)*W),
      x1=Math.ceil(clamp01((quiet.x+quiet.w-f.x)/f.w)*W),
      y0=Math.floor(clamp01((quiet.y-f.y)/f.h)*H),
      y1=Math.ceil(clamp01((quiet.y+quiet.h-f.y)/f.h)*H);
    if(g&&x1>x0&&y1>y0){
     for(const w of wanted){
       const r=w.at||{x:0,y:0,w:1,h:1},p=pictures.get(w.id);
       g.globalAlpha=w.alpha;
       if(p.paint)p.paint(g,r.x*W,r.y*H,r.w*W,r.h*H);else g.drawImage(p.img,r.x*W,r.y*H,r.w*W,r.h*H);
     }
     const data=g.getImageData(x0,y0,x1-x0,y1-y0).data;let sum=0,n=0;
     for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;sum+=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255*a+page*(1-a);n++;}l=n?sum/n:null;
    }
   }catch{l=null;}
   if(l===null)return;
   const mid=(quiet.x+quiet.w/2)/view.w,fall=mid<.08?mid/.08*.5:mid<.25?.5+(mid-.08)/.17*.5:1;
   on.tone?.(page*(1-fall)+l*fall<.5?'light':'dark');
  }
  function clear(){now=null;wanted=[];measured='';sample=null;ride?.move(false);ride?.clear();for(const id of [...pictures.keys()])free(id);node.removeAttribute('data-ready');}
  return {node,show,clear,rest(){
    ride?.move(false);
  },rider(el,kind,n,by){ride?.rider(el,kind,n,by);},destroy(){clear();dead=true;node.remove();},get pictures(){return [...pictures.keys()];},get since(){return 0;},
   // for the page under the band: the moment as the band lays it, and a land's strips of shade (now if the ride is read, else [] and `later` is called once it is)
   moment(env,view,swap){return dead?null:momentOf(K,swap?swapped:band,env,view);},
   shades(name,later){if(!ride)return [];if(ride.settled)return ride.shade(name);ride.whenRead(()=>{if(!dead)later?.();});return [];}};
 }
 /* frameBand(doc, base, origin, page, rideFile, on) -> the same handle as skyBand, for a band that runs in its own page.
    A travelling band is hundreds of movements. Run in the dashboard's own page they cost it dearly: on every frame the
    page makes for any reason (a hover, the pet walking) the browser samples every running animation again and lays every
    layer again. So inside the extension the band is a frame showing the band's own page (the same engine, skyBand and
    bandRide, loaded there): it runs in the extension's process, and this page's frames cost what they cost without it.
    This page sends the moment (show: the clock, the band's size, the place of the greeting, how much may move); the
    band's page answers when it is laid (placed), with the tone under the greeting, the stage of the day, or a failure.
    Nothing goes to the frame before its page says it is ready; a page that never answers leaves the poster. The motifs
    on the course cards ride here, in this page (they are part of it), on the same ride. */
 function frameBand(doc,base,origin,page,rideFile,on,raw,lived){
  const node=doc.createElement('div'),frame=doc.createElement('iframe'),ride=rideFile?bandRide(doc,base,rideFile,lived):null,K=global.ReserveBandKit;
  // the stage of the day by the band's own words and the clock (known here at once; the band's page says the same when
  // it is laid)
  let words=null;
  try{words=K?.clean&&raw?K.clean(raw,{picture:value=>typeof value?.asset==='string'?{asset:value.asset}:null,image:asset=>/^[a-z0-9-]{1,64}$/.test(asset)}).band:null;}catch{words=null;}
  const stageAt=env=>{
    if(!words||!K?.resolve)return null;
    try{return stageOf((K.resolve(words,env).pieces||[]).map(piece=>({id:piece.draw?.[0]?.asset||'',alpha:piece.presence??1})));}catch{return null;}
  };
  node.className='tk-band';
  node.setAttribute('aria-hidden','true');
  frame.className='tk-frame';
  frame.setAttribute('aria-hidden','true');
  frame.setAttribute('tabindex','-1');
  frame.setAttribute('title','');
  frame.setAttribute('scrolling','no');
  frame.setAttribute('loading','eager');
  let ready=false,dead=false,last=null,sent='',wait=0,shown=[],stillWords=null,since=0;
  const post=message=>{if(ready&&!dead)frame.contentWindow?.postMessage({tkBand:1,...message},origin);};
  function hear(event){
   if(dead||!event)return;
   if(event.source!==frame.contentWindow){on.other?.(event);return;}
   if(event.origin!==origin)return;
   const said=event.data;
   if(!said||said.tkBand!==1)return;
   // (the band's page says when it began: what rides here, in this page, moves from that same moment)
   if(said.ready){
     ready=true;
     if(wait){global.clearTimeout(wait);wait=0;}
     const began=Number(said.origin),mine=Number(global.performance?.timeOrigin),gap=Math.round(began-mine);
     since=began>0&&mine>0&&Math.abs(gap)<864e5?gap:0;
     ride?.since(since);
     sent='';
     if(last)tell();
     on.ready?.();
     return;
   }
   if(said.failed){on.fail?.();return;}
   if(typeof said.tone==='string')on.tone?.(said.tone==='light'||said.tone==='dark'?said.tone:'');
   if(typeof said.stage==='string')on.stage?.(/^[a-z]{0,16}$/.test(said.stage)?said.stage:'');
   if(said.placed){shown=Array.isArray(said.pictures)?said.pictures.filter(name=>typeof name==='string').slice(0,16):[];if(last&&!node.hasAttribute('data-ready'))node.setAttribute('data-ready','');}
  }
  function tell(){const text=JSON.stringify(last);if(text===sent)return;sent=text;post({show:last});}
  global.addEventListener?.('message',hear);
  node.append(frame);frame.setAttribute('src',base+page);
  // a page that never says it is ready (blocked, or broken) leaves the poster
  wait=global.setTimeout(()=>{wait=0;if(!ready&&!dead)on.fail?.();},9000);
  return {node,
   // (travel: [pace, the moment on the band's own clock, how far the journey had come, how much of the ride's loop had gone by]: this page's riders and the band's page take it as it is)
   show(env,view,swap,quiet,page,moving,travel,bare){
     if(dead)return;
     last={env,view,swap:!!swap,quiet:quiet||null,page,moving:swap?0:Number(moving)||0,travel:Array.isArray(travel)?travel.slice(0,8):null,...(bare?{bare:true}:{})};
     const hour=stageAt(env);
     if(hour!==null)on.stage?.(hour);
     if(last.travel)ride?.pace(last.travel);
     ride?.move(last.moving);
     if(ready)tell();
   },
   rest(){ride?.move(false);if(last&&last.moving){last={...last,moving:0};if(ready)tell();}},
   rider(el,kind,n,by){ride?.rider(el,kind,n,by);},get since(){return since;},get timed(){return ready;},
   clear(){last=null;sent='';shown=[];ride?.move(false);ride?.clear();post({clear:true});node.removeAttribute('data-ready');},
   destroy(){this.clear();dead=true;if(wait){global.clearTimeout(wait);wait=0;}global.removeEventListener?.('message',hear);frame.removeAttribute('src');node.remove();},
   get pictures(){return [...shown];},get framed(){return true;},
   moment(env,view,swap){if(dead||!words||!K?.resolve||!K.fit)return null;if(swap)stillWords||=stillBand(words);return momentOf(K,swap?stillWords:words,env,view);},
   shades(name,later){if(!ride)return [];if(ride.settled)return ride.shade(name);ride.whenRead(()=>{if(!dead)later?.();});return [];}};
 }
 /* roomLight(doc, base, room) -> {node, over, show, still, clear}: the daylight of a band that is a room (rooms), on the page
    below the band. Each pane of the room's windows throws its own patch on the floor from under that pane in the band,
    the bars' and the wall's shade between and beside the panes; the light leans, reaches and is coloured as the hour
    says, and the shadows of the land passing outside cross it at the speeds they cross the cabin's own floor (the same
    strips, sliding one length for ever, all from the same moment). Two layers: `node` lies on the floor under the page's
    things, with the passing shadows; `over` is a faint one over them, without, so what lies on the floor takes the light too. In each, one
    beam for every hour that is there (two while a stage fades into the next), as strong as that hour is there.
    show(g, hours, shades, moving): g is where the band's picture lies on the dashboard (x of its left end, k its scale,
    foot the band's lower edge, deep how far the dashboard goes on below the light's start, since the moment the band's
    own page began). Nothing moves unless `moving`: then there are no shadows at all, as on the cabin's own floor.
    `ride(node, degrees)` hands a beam to the band's ride so it leans with the car (null lets it go). */
/* The land's own page (rooms.pages): under the band the land goes on down the page. For each stage of the day that is showing,
    the sky (page-<land>-<stage>.webp, 4096 wide in the band's own pixels, its first row the row under the room) stands still at the
    band's own scale and place, and over it lie the layers that travel (pages.move: [n, speed] -> page-<land>-<stage>-<n>.webp, each
    a picture that runs on into itself): the far land, the near land, our own bridge. Each layer is a holder (u) with a bar in it
    (b) one picture longer than the page, sliding one picture's length for ever, at the place of the journey the band's window is at
    (travel: {moving, pace, at, far, most}; at is a moment of this page's clock, most the lever's greatest pace).
    What is outside rides against the room: each holder is handed to the band's ride (ride(node, px, near), null lets it go) and
    moves as the land in the window does (px), our bridge, which is close, also by its bounce (near); stronger the faster the
    train goes.
    A layer that passes faster than the eye can follow is smeared along its way, by as far as it moves in a sixtieth of a second:
    four more bars (s) with the same picture squeezed sideways to fewer and fewer columns and stretched back, each smear twice as
    long as the one before; the two nearest the speed's own length are cross-faded (only what can pass that fast at the lever's
    greatest pace gets them: our bridge).
    The first stage stands whole and the next lies over it as strongly as the band shows it. Below the picture the page runs on in
    the colour of its foot.
    Across the top of each stage, over its layers, lies the carriage's own underside (under.webp: the side sill and what hangs
    from it over the rail, a row of 100 px for each hour in the band's own pixels): it belongs to the cabin, so it neither travels
    nor shakes; the rail runs and shakes under it. */
 function roomPage(doc,base,ride){
  const readFile=reader(base),blobs=new Map();
  const node=doc.createElement('div');node.className='tk-page';node.setAttribute('aria-hidden','true');node.setAttribute('data-rd-keep','');
  // (HZ: a layer is smeared by as far as it moves in one HZ-th of a second, from FROM px on, MOST at most; UNDER: the underside's
  // sheet, the pitch of its rows, the height of its strip, in the band's own pixels)
  let laid='',went='',shook='',last=null,gone=false;
  const layers=new Map(),r2=n=>Math.round(n*100)/100,URLs=global.URL,HZ=60,FROM=5,MOST=110,HOURS=['morning','noon','sunset','dusk','night'],UNDER=[900,180,172];
  const bars=()=>[...layers.values()].flatMap(n=>n.tkLayers||[]),every=L=>[L.b,...(L.s||[])];
  function drop(n){
    for(const L of n.tkLayers||[]){
      ride?.(L.u,null);
      for(const bar of every(L)){try{bar.tkRun?.cancel();}catch{}}
      if(L.smear){L.smear.dead=true;for(const url of L.smear.urls||[]){try{URLs.revokeObjectURL(url);}catch{}}}else L.smear={dead:true};
    }
    n.remove();
  }
  function glide(g,now){
   const turn=4096*g.k,moving=!!now.moving,pace=Number(now.pace)||0,far=Number(now.far)||0;
   for(const L of bars())for(const bar of every(L)){
    try{bar.tkRun?.cancel();}catch{}bar.tkRun=null;const speed=L.speed,been=moving?(((speed*far)%4096)+4096)%4096:0;
    if(moving&&pace>0&&typeof bar.animate==='function'){
     if(bar.style.transform)bar.style.transform='';
     try{
       const ms=4096/(speed*pace)*1000,run=bar.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d('+r2(-turn)+'px,0,0)'}],{duration:ms,iterations:Infinity});
       run.startTime=(Number(now.at)||0)-been/4096*ms;
       bar.tkRun=run;
     }catch{}
    }else{const x=been?'translate3d('+r2(-been*g.k)+'px,0,0)':'';if(bar.style.transform!==x)bar.style.transform=x;}
   }
  }
  // the smeared pictures of a layer: its columns halved again and again (so every row keeps its own height); the last four
  // halvings are its four smears, each twice as long as the one before
  // (a picture of the land as CSS: the package's address at once; the store's bytes as a blob address once read, when the store has
  // them; one blob address a file, kept while this page lives. A build that does not carry the megapack's files (they are downloaded)
  // does not ask the package for them first: the picture waits for the store's blob, and only a file the store turns out not to have
  // takes the package's address, as before. What lay returns then is that wait, for the smears; otherwise null)
  const scene=/\/themes\/([a-z]+)\/$/.exec(String(base))?.[1];
  function lay(el,name,moved){
    const store=blobOf(name),pack='url("'+base+name+'")';
    if(!store||packaged(scene)){el.style.backgroundImage=pack;store?.then(to=>{if(!to||gone)return;el.style.backgroundImage='url("'+to+'")';moved?.(to);});return null;}
    return store.then(to=>{if(gone)return;el.style.backgroundImage=to?'url("'+to+'")':pack;if(to)moved?.(to);});
  }
  function blobOf(name){
    const mp=MEGAPACK[/\/themes\/([a-z]+)\/$/.exec(String(base))?.[1]];
    if(!mp||!mp.kind.test(name)||String(global.location?.protocol)!=='chrome-extension:'||typeof global.caches?.open!=='function'||typeof URLs?.createObjectURL!=='function')return null;
   if(!blobs.has(name))
     blobs.set(
       name,
       megaRecord(mp).then(rec=>megaNames(rec)?.[name]?readFile(name).then(r=>r?.ok?r.blob():null).then(b=>b?URLs.createObjectURL(b):null):null).catch(()=>null));
   return blobs.get(name);
  }
  function smear(L){
   if(L.smear)return;const mine=L.smear={};const img=doc.createElement('img');img.decoding='async';
   img.onload=()=>{try{
    if(mine.dead||gone)return;let w=img.naturalWidth,h=img.naturalHeight,src=img;const made=[];if(!(w>0&&h>0))return;
    while(w>24){
      const w2=Math.max(24,Math.ceil(w/2)),c=doc.createElement('canvas');
      c.width=w2;
      c.height=h;
      const x=c.getContext?.('2d');
      if(!x)return;
      x.imageSmoothingEnabled=true;
      x.imageSmoothingQuality='low';
      x.drawImage(src,0,0,w,h,0,0,w2,h);
      src=c;
      w=w2;
      made.push(c);
    }
    const four=made.slice(-4);if(four.length<4||typeof four[0].toBlob!=='function')return;let left=four.length;const urls=new Array(four.length);
    four.forEach((c,i)=>c.toBlob(blob=>{if(blob)urls[i]=URLs.createObjectURL(blob);if(--left)return;
     if(mine.dead||gone||!L.u.isConnected||urls.some(url=>!url)){for(const url of urls)if(url){try{URLs.revokeObjectURL(url);}catch{}}return;}
     mine.urls=urls;
     L.cells=four.map(cv=>cv.width);
     L.s=urls.map(url=>{const bar=doc.createElement('s');bar.style.backgroundImage='url("'+url+'")';bar.style.opacity='0';bar.style.visibility='hidden';L.u.append(bar);return bar;});
     laid='';
     went='';
     if(last)api.show(...last);
    }));
   }catch{}};
   // (a layer still waiting for the store's blob: its smears wait for it too)
   if(L.ready)L.ready.then(()=>{if(!mine.dead&&!gone)img.setAttribute('src',L.url);});else img.setAttribute('src',L.url);
  }
  function blur(g,now){
   const moving=!!now.moving,pace=Number(now.pace)||0,most=Number(now.most)||0,wide=4096*g.k;
   for(const L of bars()){
    const by=moving?Math.min(MOST,L.speed*pace*g.k/HZ):0,all=every(L),share=new Array(all.length).fill(0);
    if(moving&&!L.smear&&L.speed*most*g.k/HZ>=FROM)smear(L);
    if(all.length<2||by<FROM)share[0]=1;
    else{
      const long=L.cells.map(cells=>wide/cells);
      let i=0;
      while(i<long.length-1&&by>long[i])i++;
      const low=i?long[i-1]:FROM,u=Math.round(Math.min(1,Math.max(0,(by-low)/(long[i]-low)))*50)/50;
      share[i+1]=u;
      share[i]=Math.round((1-u)*100)/100;
    }
    const shown=share.filter(v=>v>0).length,mode=share[0]>=1?'':shown>1?'mix':'full';
    if((L.u.getAttribute('data-smear')||'')!==mode){if(mode)L.u.setAttribute('data-smear',mode);else L.u.removeAttribute('data-smear');}
    all.forEach((bar,i)=>{
      const o=!mode&&!i?'':String(share[i]),see=share[i]>0?'':'hidden';
      if(bar.style.opacity!==o)bar.style.opacity=o;
      if(bar.style.visibility!==see)bar.style.visibility=see;
    });
   }
  }
  function quiver(g,now){
   // (engine 2: on the rail, which follows the speed itself: the far land shows a third of a floating car's heave, the near land more,
   // our bridge all of it and its bounce)
   const on=!!now.moving,key=JSON.stringify([laid,on,Math.round(g.k*1e4)]);if(key===shook)return;shook=key;
   for(const L of bars())ride?.(L.u,on?{amp:r2(1.7*g.k),near:L.n===3?r2(4.6*g.k):0,depth:L.n===1?.35:L.n===2?.6:1,surge:r2(TRAVEL.surge*g.k),turn:true}:null);
  }
  const api={node,
   show(g,land,hours,info,travel){
    const want=[];
    for(const [stage,share]of hours){const st=info.stages?.[stage]||stage,had=want.find(w=>w[0]===st);if(had)had[1]=Math.min(1,had[1]+share);else want.push([st,share]);}
    if(!want.length)return;last=[g,land,hours,info,travel];gone=false;
    const key=JSON.stringify([land,Math.round(g.x*10),Math.round(g.k*1e4),Math.round(g.top),Math.round(g.deep),want.map(w=>w[0])]);
    if(key!==laid){
     laid=key;went='';node.style.top=Math.round(g.top)+'px';node.style.height=Math.max(0,Math.round(g.deep-g.top))+'px';node.style.backgroundColor=info.foot?.[want[0][0]]||'';
     for(const [id,n]of layers)if(!want.some(w=>land+':'+w[0]===id)){drop(n);layers.delete(id);}
     const wide=Math.round(4096*g.k*10)/10,at=Math.round(g.x*10)/10,high=Math.ceil(wide*1738/4096);
     for(const [stage]of want){
      const id=land+':'+stage;let n=layers.get(id);
      if(!n){n=doc.createElement('i');lay(n,'page-'+land+'-'+stage+'.webp');n.tkLayers=[];
       for(const m of Array.isArray(info.move)?info.move:[]){
        if(!(Number(m?.[1])>0)||!/^[0-9]$/.test(String(m[0])))continue;const u=doc.createElement('u'),bar=doc.createElement('b'),url=base+'page-'+land+'-'+stage+'-'+m[0]+'.webp';
        const L={u,b:bar,s:null,cells:null,n:Number(m[0]),speed:Number(m[1]),url,smear:null,ready:null};
        L.ready=lay(bar,url.slice(base.length),to=>{L.url=to;});
        u.append(bar);
        n.append(u);
        n.tkLayers.push(L);
       }
       const under=doc.createElement('em');lay(under,info.under?'under-'+land+'.webp':'under.webp');n.append(under);n.tkUnder=[under,Math.max(0,HOURS.indexOf(stage))];
       layers.set(id,n);}
      node.append(n);n.style.backgroundSize=wide+'px auto';n.style.backgroundPosition=at+'px 0';
      for(const L of n.tkLayers)
        for(const bar of every(L)){
          bar.style.backgroundSize=bar===L.b?wide+'px auto':wide+'px '+high+'px';
          bar.style.backgroundPosition=at+'px 0';
          bar.style.width='calc(100% + '+Math.ceil(wide+2)+'px)';
          bar.style.height=high+'px';
        }
      {
        const [under,row]=n.tkUnder;
        under.style.backgroundSize=wide+'px '+r2(UNDER[0]*g.k)+'px';
        under.style.backgroundPosition=at+'px '+r2(-row*UNDER[1]*g.k)+'px';
        under.style.height=Math.ceil(UNDER[2]*g.k)+'px';
      }
     }
    }
    want.forEach(([stage,share],i)=>{const n=layers.get(land+':'+stage),o=String(i?Math.round(share*1000)/1000:1);if(n&&n.style.opacity!==o)n.style.opacity=o;});
    const now=stepOf(travel||{}),going=JSON.stringify([laid,!!now.moving,now.pace||0,Math.round(now.at||0),Math.round((now.far||0)*1000)]);
    blur(g,now);quiver(g,now);
    if(going!==went){went=going;glide(g,now);}
   },
   clear(){
     if(stepping){global.clearTimeout(stepping);stepping=0;}
     laid='';
     went='';
     shook='';
     last=null;
     gone=true;
     for(const n of layers.values())drop(n);
     layers.clear();
     node.remove();
   }};
  // (engine 2: a travel told as a curve, {moving, route: its numbers on the band's clock, offset: where the band's clock starts on this
  // page's, most}, is followed in steps of a tenth of a second while its speed changes, as the band's ride follows it; a travel told
  // as {moving, pace, at, far} is taken as it is)
  let route=null,routeText='',stepping=0;
  function stepOf(t){
   if(!Array.isArray(t.route))return t;const text=JSON.stringify(t.route);if(text!==routeText){routeText=text;route=travelOf(t.route);}
   if(stepping){global.clearTimeout(stepping);stepping=0;}const off=Number(t.offset)||0,now=(global.performance?.now?.()||0)-off,here=travelAt(route,now);
   if(!here.moving||!t.moving||typeof global.setTimeout!=='function')return {moving:t.moving,pace:route.v1,at:route.t0+route.T*1000+off,far:route.xT,most:t.most};
   const then=travelAt(route,now+100);stepping=global.setTimeout(()=>{stepping=0;if(last&&!gone)api.show(...last);},100);
   return {moving:t.moving,pace:Math.max(0,(then.x-here.x)*10),at:now+off,far:here.x,most:t.most};
  }
  return api;
 }
 /* framePage(doc, base, origin, file, on) -> {node, show, clear}: the land under the room run in a page of its own (themes/train/
    page.html) in a frame, as the band is (frameBand): its travelling layers, their ride against the room and their smears are
    many movements, and run in the dashboard's page they cost it on every frame it makes. Here the dashboard keeps only a holder
    where roomPage's node lay (the same place, the page's foot colour under the picture) with the frame in it, as tall as the
    picture and its underside; the land's page lays the land with the same engine (pageHere: roomPage and a ride of its own) and
    moves it from the same moments: the band's travel and the band page's own beginning are told on its clock. Nothing goes to
    the frame before its page says it is ready; a page that fails or never answers calls on.fail (the dashboard then lays the
    land itself, as before). What the land's page says reaches hear() through the band's own listener (frameBand on.other). */
 function framePage(doc,base,origin,file,on){
  const node=doc.createElement('div'),frame=doc.createElement('iframe');node.className='tk-page';node.setAttribute('aria-hidden','true');node.setAttribute('data-rd-keep','');
  frame.className='tk-pageframe';
  frame.setAttribute('aria-hidden','true');
  frame.setAttribute('tabindex','-1');
  frame.setAttribute('title','');
  frame.setAttribute('scrolling','no');
  frame.setAttribute('loading','eager');
  node.append(frame);
  let ready=false,dead=false,last=null,sent='',wait=0,since=0,placed=false,painting=false;
  const post=message=>{if(ready&&!dead)frame.contentWindow?.postMessage({tkPage:1,...message},origin);};
  function hear(event){
   if(dead||!event||event.source!==frame.contentWindow||event.origin!==origin)return;const said=event.data;if(!said||said.tkPage!==1)return;
   if(said.ready){
     ready=true;
     if(wait){global.clearTimeout(wait);wait=0;}
     const began=Number(said.origin),mine=Number(global.performance?.timeOrigin),gap=began-mine;
     since=began>0&&mine>0&&Math.abs(gap)<864e5?gap:0;
     sent='';
     if(last)tell();
     on.ready?.();
     return;
   }
   if(said.failed){on.fail?.();return;}
   if(said.placed){placed=true;on.placed?.();}
   if(typeof said.painting==='boolean'){painting=said.painting;on.painting?.(painting);}
  }
  // (the moment on this page's clock goes to the land's page on its own: the band's travel as it is, and when the band's page began there;
  // nothing before the band's page has said when it began, so the land never starts from another moment than the band's)
  function tell(){
   const [g,land,hours,travel]=last,t=travel||{},band=Number(t.since)||0,r3=n=>Math.round(n*1000)/1000;
   const message={
     g:{x:r3(g.x),k:Math.round(g.k*1e6)/1e6,top:Math.round(g.top),deep:Math.round(g.deep),...(g.win?{win:{x:r3(g.win.x),y:r3(g.win.y)}}:{})},
     land,
     hours:hours.map(([stage,share])=>[stage,r3(share)]),
     moving:t.moving?Number(t.level)||2:0,
    travel:Array.isArray(t.route)?t.route.slice(0,8):null,
    epoch:r3(band-since),
    most:Number(t.most)||1,
    still:t.still?1:0,
    ...(t.paint?{paint:true,quality:Number(t.quality)||2}:{})
   };
   const text=JSON.stringify(message);if(text===sent||!t.timed)return;sent=text;post({show:message});
  }
  frame.setAttribute('src',base+file);
  wait=global.setTimeout(()=>{wait=0;if(!ready&&!dead)on.fail?.();},9000);
  return {node,framed:true,hear,
   // g as roomPage takes it (x of the band's picture, k its scale, top where the land starts, deep where the dashboard ends); the frame is
   // as tall as the land's picture (its foot colour goes on below it, in the holder)
   show(g,land,hours,info,travel){
    // (engine 2: the holder lies under the band from the band's top, so the land's page can draw the land in the window as well as
    // under the room; it is clear down to where the land starts and the land's foot colour below; the frame is as tall as the band
    // and the land's picture)
    if(dead)return;const foot=Math.max(0,Math.round(g.top)),height=Math.max(0,Math.round(g.deep)),tall=Math.min(height,foot+Math.ceil(4096*g.k*1738/4096)+2);
    if(node.style.top!=='0px')node.style.top='0px';if(node.style.height!==height+'px')node.style.height=height+'px';
    const want=hours.map(([stage])=>info.stages?.[stage]||stage),colour=info.foot?.[want[0]]||'',ground=colour?'linear-gradient(180deg,transparent '+foot+'px,'+colour+' '+foot+'px)':'';
    if((node.style.backgroundImage||'')!==ground)node.style.backgroundImage=ground;
    if(frame.style.height!==tall+'px')frame.style.height=tall+'px';
    last=[{x:g.x,k:g.k,top:foot,deep:tall,win:g.win||null},land,hours,travel];if(ready)tell();},
   get placed(){return placed;},get painting(){return painting&&!dead;},
   // (everything stops where the band stops: a hidden tab, a page at rest)
   rest(){if(last&&last[3]?.moving){last=[last[0],last[1],last[2],{...last[3],moving:false}];if(ready)tell();}},
   clear(){last=null;sent='';placed=false;post({clear:true});node.remove();},
   destroy(){this.clear();dead=true;if(wait){global.clearTimeout(wait);wait=0;}frame.removeAttribute('src');}};
 }
 // the land under the room laid in this document (the land's own page, themes/<id>/page.html, calls this): roomPage with a ride of its own
 function pageHere(doc,base,id,on){
  const room=rooms[id];
  if(!room?.pages)return null;
  const ride=rides[id]?bandRide(doc,base,rides[id],livedOf(id)):null,page=roomPage(doc,base,ride?(node,spec)=>ride.rider(node,spec?'rail':'',spec):null);
  return {node:page.node,
   ride,info:land=>Object.hasOwn(room.pages,land)?room.pages[land]:null,
   // (dom: the land is laid in this page; false while the painter draws it, so nothing is drawn twice)
   show(g,land,hours,moving,travel,epoch,most,dom=true){
    const info=room.pages[land];if(!info||!Object.hasOwn(room.pages,land))return false;
    ride?.since(epoch);ride?.land(land);if(travel)ride?.pace(travel);ride?.move(dom?moving:0);
    if(dom)page.show(g,land,hours,info,{moving:!!moving,route:travel||[1,0,0,0],offset:epoch,most});else page.clear();return true;},
   clear(){ride?.move(false);ride?.clear();page.clear();}};
 }
/* The cabin's speed control (rooms.lever: where it lies in the band's own pixels, its stops, the pace of each): drawn in the
    room, on the screen of the laptop on the desk: a stop mark and three bars that rise toward faster, a groove under them, a
    round knob that stands at one of four stops (stopped, slow, the land's own speed, fast). The laptop is small, so under the
    pointer (or held, or with the keys) the screen grows from its foot; a press or a drag along it, or the arrow keys, moves the
    knob. place(g, stage) lays it where the band's picture lies (g: x and y of the picture's corner on the dashboard, k its scale)
    in the light of that hour; on(stop) says a new choice. It lies in the wall's own layer, under the page's things: a panel that
    scrolls over the band slides over it too. So a press does not arrive at it by itself (the page's bare layers lie over the
    band): the dashboard is listened to, and a press inside it is the control's when nothing but those bare layers (THROUGH) lies
    over it there. (The sheet has `zoom` pixels to one of the band's, so the grown screen is as sharp as the small one.) */
 function roomLever(doc,base,spec,on,root,rd,dock){
  const node=doc.createElement('div'),
    plate=doc.createElement('i'),
    knob=doc.createElement('b'),
    lit=spec.stops.map(()=>doc.createElement('u')),
    STAGES=['morning','noon','sunset','dusk','night'],
    most=spec.stops.length-1,
    THROUGH=['rd-shell','rd-workspace','rd-workspace-heading','rd-course-heading'];
  node.className=dock?'tk-lever-dock':'tk-lever';
  if(dock)node.setAttribute('title','Train speed');
  node.setAttribute('data-rd-keep','');
  node.setAttribute('role','slider');
  node.setAttribute('tabindex','0');
  node.setAttribute('aria-label','Train speed');
  node.setAttribute('aria-orientation','horizontal');
  node.setAttribute('aria-valuemin','0');
  node.setAttribute('aria-valuemax',String(most));
  node.hidden=true;node.append(plate,...lit,knob);for(const n of [plate,knob,...lit])n.style.backgroundImage='url("'+base+'lever.webp")';node.style.setProperty?.('--tk-grow',String(spec.grow));
  // (4.2.9) the docked copy: a small dark laptop lid in the window's lower left corner with the same screen on it; it grows from that corner
  if(dock){
    Object.assign(node.style,{
      position:'fixed',
      left:'14px',
      bottom:'14px',
      zIndex:'20',
      display:'none',
      margin:'0',
      padding:'0',
      border:'0',
      background:'#1c2942',
      cursor:'pointer',
      touchAction:'none',
      userSelect:'none',
      outline:'none',
      transformOrigin:'0 100%',
      borderRadius:'5px',
      overflow:'hidden',
      boxShadow:'0 0 0 2px #1c2942,0 0 0 3px rgba(255,255,255,.22),0 5px 12px rgba(8,14,28,.42)',
      transition:'transform .28s cubic-bezier(.22,1.25,.36,1)'
    });
    for(const n of [plate,knob,...lit])Object.assign(n.style,{position:'absolute',left:'0',top:'0',display:'block',backgroundRepeat:'no-repeat',pointerEvents:'none'});
  }
  let at=-1,k=0,col=1,held=false,over=false,away=false;const px=n=>Math.round(n*100)/100+'px',undo=[],Z=spec.zoom;
  function draw(){
   if(!(k>0))return;const size=px(spec.sheet[0]/Z*k)+' '+px(spec.sheet[1]/Z*k),cx=col*spec.cell/Z;
   plate.style.backgroundSize=size;plate.style.width=px(spec.w*k);plate.style.height=px(spec.h*k);plate.style.backgroundPosition=px(-cx*k)+' 0';
   // (what is lit: a strip of the sheet's second row over each stop's own mark)
   lit.forEach((n,i)=>{
     const x=spec.stops[i]-spec.half;
     n.style.backgroundSize=size;
     n.style.left=px(x*k);
     n.style.width=px(2*spec.half*k);
     n.style.height=px(spec.h*k);
     n.style.backgroundPosition=px(-(cx+x)*k)+' '+px(-spec.h*k);
   });
   knob.style.backgroundSize=size;
   knob.style.width=px(spec.knob*k);
   knob.style.height=px(spec.knob*k);
   knob.style.left=px(-spec.knob/2*k);
   knob.style.top=px((spec.track-spec.knob/2)*k);
   knob.style.backgroundPosition=px(-cx*k)+' '+px(-2*spec.h*k);
   knob.style.transform='translate3d('+px(spec.stops[Math.max(0,at)]*k)+',0,0)';
  }
  // (stopped: the stop mark alone is lit; else every bar up to the knob's)
  function set(i,quiet){
    i=Math.min(most,Math.max(0,Math.round(Number(i))||0));
    if(i===at)return;
    at=i;
    node.setAttribute('aria-valuenow',String(i));
    node.setAttribute('aria-valuetext',spec.names[i]||'');
    lit.forEach((n,j)=>{n.style.opacity=(j?i>=j:i===0)?'1':'0';});
    draw();
    if(!quiet)on?.(i);
  }
  const nearest=x=>{let best=0;spec.stops.forEach((sx,i)=>{if(Math.abs(sx-x)<Math.abs(spec.stops[best]-x))best=i;});return best;};
  // (by where the press is across the screen as it is drawn at that moment, small or grown)
  const pick=event=>{const r=node.getBoundingClientRect?.();if(r&&r.width>0)set(nearest((event.clientX-r.left)/r.width*spec.w));};
  const bare=el=>el===rd||THROUGH.some(name=>el.classList?.contains(name));
  // (the Home heading's own words may lie over the laptop at some widths: over the control they let the press through to it;
  // anything one can press in the heading keeps its own press, and so does every panel)
  const PRESS=new Set(['A','BUTTON','INPUT','SELECT','TEXTAREA','LABEL','SUMMARY','DETAILS','OPTION']),ROLES=new Set(['button','link','tab','checkbox','radio','switch','slider','menuitem','option','textbox','combobox','spinbutton']);
  const pressable=el=>
    PRESS.has(String(el.tagName||'').toUpperCase())||
      ROLES.has(el.getAttribute?.('role'))||
      (el.hasAttribute?.('tabindex')&&el.getAttribute('tabindex')!=='-1')||
      el.getAttribute?.('contenteditable')==='true'||
      el.isContentEditable===true;
  const words=el=>{
    for(let n=el;n&&n!==rd;n=n.parentElement||n.parentNode){if(pressable(n))return false;if(n.classList?.contains('rd-workspace-heading')||n.classList?.contains('rd-course-heading'))return true;}
    return false;
  };
  function reach(event){
   const target=event.target;if(target===node||(target&&node.contains?.(target)))return true;
   const r=node.hidden?null:node.getBoundingClientRect?.();
   if(!r||!(r.width>0)||!(event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom))return false;
   if(typeof root?.elementsFromPoint!=='function')return false;
   try{for(const el of root.elementsFromPoint(event.clientX,event.clientY)){if(el===node||node.contains(el))return true;if(!bare(el)&&!words(el))return false;}}catch{}
   return false;
  }
  const grown=()=>{if(dock)node.style.transform=over||held?'scale('+spec.grow+')':'';};
  const hover=now=>{
    if(now===over)return;
    over=now;
    if(now){node.setAttribute('data-over','');if(!dock)rd?.setAttribute?.('data-tk-lever-over','');}else{node.removeAttribute('data-over');if(!dock)rd?.removeAttribute?.('data-tk-lever-over');}
    grown();
  };
  const hold=now=>{if(now===held)return;held=now;if(now)node.setAttribute('data-held','');else node.removeAttribute('data-held');grown();};
  const down=event=>{
    if(event.button||event.tkLever||!reach(event))return;
    event.tkLever=true;
    hold(true);
    node.removeAttribute('data-keys');
    try{node.focus?.({preventScroll:true});}catch{}
    pick(event);
    event.preventDefault?.();
  };
  const move=event=>{if(held)pick(event);else hover(reach(event));},up=()=>hold(false);
  const listen=(target,type,fn,options)=>{
    if(typeof target?.addEventListener!=='function')return;
    target.addEventListener(type,fn,options);
    undo.push(()=>target.removeEventListener?.(type,fn,options));
  };
  listen(node,'pointerdown',down);listen(rd,'pointerdown',down,true);listen(rd,'pointermove',move,{capture:true,passive:true});listen(rd,'pointerleave',()=>hover(false));
  // (the docked copy stands outside the dashboard, over the page: the pointer over it is its own)
  if(dock){listen(node,'pointermove',move,{passive:true});listen(node,'pointerleave',()=>hover(false));}
  for(const type of ['pointerup','pointercancel'])listen(doc,type,up,true);
  listen(node,'keydown',event=>{
    const step={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[event.key];
    if(step)set(at+step);else if(event.key==='Home')set(0);else if(event.key==='End')set(most);else return;
    node.setAttribute('data-keys','');
    event.preventDefault?.();
  });
  listen(node,'blur',()=>node.removeAttribute('data-keys'));
  return {node,set,get at(){return at;},
   place(g,stage){
     const c=Math.max(0,STAGES.indexOf(stage)),left=dock?'14px':px(g.x+spec.x*g.k),top=dock?'':px(g.y+spec.y*g.k);
     if(node.style.left!==left)node.style.left=left;
     if(node.style.top!==top)node.style.top=top;
     if(g.k!==k||c!==col){k=g.k;col=c;node.style.width=px(spec.w*k);node.style.height=px(spec.h*k);draw();}
     if(node.hidden)node.hidden=false;
     if(dock)node.style.display=away?'block':'none';
   },
   // (the docked copy is there only while the cabin's own control is out of sight)
   away(on){away=!!on;if(dock)node.style.display=away&&!node.hidden?'block':'none';},
   hide(){
     if(!node.hidden)node.hidden=true;
     if(dock)node.style.display='none';
     hover(false);
     hold(false);
   },clear(){hover(false);hold(false);for(const f of undo.splice(0))f();node.remove();}};
 }
 function roomLight(doc,base,room,ride){
  const make=(tag,cls,into)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(into)into.append(n);else{n.setAttribute('aria-hidden','true');n.setAttribute('data-rd-keep','');}return n;};
  const node=make('div','tk-day'),over=make('div','tk-day tk-over'),r1=n=>Math.round(n*10)/10,rgba=v=>'rgba('+v.join(',')+')',OFF=1400,RISE=76;
  let laid='',beams=new Map(),anims=[],last=null;
  function wipe(){
    for(const a of anims){try{a.cancel();}catch{}}
    anims=[];
    for(const pair of beams.values())for(const n of pair){ride?.(n.firstChild,null);n.remove();}
    beams=new Map();
  }
  function beam(g,stage,shades,share){
   const L=room.hours[stage],z=g.k/room.at,X=a=>g.x+(a+L.shift)*g.k+OFF,deep=Math.max(RISE+40,Math.min(L.reach*z+RISE,g.deep));
   // one picture across the room: `lit` inside every pane, `dim` between and beside the panes of a window, nothing far from a window
   const across=(lit,dim)=>{const none=rgba([dim[0],dim[1],dim[2],0]),stops=[none+' 0'];
    for(const panes of room.windows){const a=X(panes[0][0]),b=X(panes[panes.length-1][1]);stops.push(none+' '+r1(a-170)+'px',rgba(dim)+' '+r1(a-24)+'px');
     for(const [p0,p1]of panes){const x0=X(p0)+3,x1=X(p1)-3;stops.push(rgba(dim)+' '+r1(x0-2.5)+'px',rgba(lit)+' '+r1(x0+2.5)+'px',rgba(lit)+' '+r1(x1-2.5)+'px',rgba(dim)+' '+r1(x1+2.5)+'px');}
     stops.push(rgba(dim)+' '+r1(b+24)+'px',none+' '+r1(b+170)+'px');}
    return 'linear-gradient(90deg,'+stops.join(',')+')';};
   return [false,true].map(top=>{
    const box=make('div','',top?over:node),lean=make('i','',box);box.setAttribute('data-hour',stage);box.style.height=r1(deep)+'px';if(share!==null)box.style.opacity=String(share);
    const deg=Math.round(Math.atan(L.lean)*18000/Math.PI)/100;lean.style.transform='skewX('+deg+'deg)';ride?.(lean,deg);
    make('u','',lean).style.backgroundImage=across([...(top&&L.top?L.top:L.col),top?L.over:L.a],top?L.dim:[L.dim[0],L.dim[1],L.dim[2],Math.round(L.dim[3]*1300)/1000]);
    // (the passing shadows cross the floor only: over the page's things the light is still, so nothing moves across what is read,
    // and the page keeps half as many moving layers)
    if(!top&&L.shade&&shades.length){
     const hold=make('s','',lean),mask=across([0,0,0,1],[0,0,0,0]),w=r1(room.box[0]*g.k);
     hold.style.webkitMaskImage=mask;
     hold.style.maskImage=mask;
     hold.style.opacity=String(Math.round(L.shade*1.2*1000)/1000);
     for(const sh of shades){
      if(!/^[a-z0-9-]{1,64}$/.test(String(sh?.file))||!(sh.speed>0))continue;
      const strip=make('b','',hold);strip.style.left=r1(g.x+OFF)+'px';strip.style.width=r1(w*2)+'px';strip.style.backgroundImage='url("'+base+sh.file+'.png")';strip.style.backgroundSize=w+'px 100%';
      const go=Array.isArray(g.pace)?g.pace:[1,g.since||0,0],turn=room.box[0],gone=(((sh.speed*go[2])%turn)+turn)%turn;
      if(!(go[0]>0))strip.style.transform='translate3d('+r1(-gone*g.k)+'px,0,0)';
      else if(typeof strip.animate==='function'){
        try{
          const ms=turn/(sh.speed*go[0])*1000,a=strip.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(-w)+'px,0,0)'}],{duration:ms,iterations:Infinity});
          a.startTime=go[1]-gone/turn*ms;
          anims.push(a);
        }catch{}
      }
     }
    }
    return box;});
  }
  function show(g,hours,shades,moving){
   last=[g,hours,shades];const want=hours.filter(([stage])=>Object.hasOwn(room.hours,stage)),strips=moving?shades:[];
   const key=JSON.stringify([
     r1(g.x),
     Math.round(g.k*1e4),
     Math.round(g.foot),
     Math.round(g.deep),
     g.since||0,
     g.pace||0,
     want.map(([stage])=>stage),
     strips.map(sh=>[sh.file,sh.speed])
   ]);
   if(key!==laid){
    // laid again (another hour, land or size): an hour that was there keeps its strength at once, a new one comes in softly
    const had=new Map([...beams].map(([stage,pair])=>[stage,pair[0].style.opacity||'0']));laid=key;wipe();
    // both layers start where the light does (a little above the band's lower edge) and are as deep as any hour reaches
    const top=Math.round(g.foot-RISE)+'px',tall=Math.round(Math.max(0,Math.min(Math.max(...Object.values(room.hours).map(hour=>hour.reach))*g.k/room.at+RISE,g.deep)))+'px';
    for(const n of [node,over]){if(n.style.top!==top)n.style.top=top;if(n.style.height!==tall)n.style.height=tall;}
    for(const [stage]of want)beams.set(stage,beam(g,stage,strips,had.has(stage)?had.get(stage):null));
    if(want.some(([stage])=>!had.has(stage)))try{void node.offsetWidth;}catch{}
   }
   for(const [stage,share]of want)for(const n of beams.get(stage))if(n.style.opacity!==String(share))n.style.opacity=String(share);
  }
  return {node,over,show,
   // everything stops where the band stops (a hidden tab, a page at rest): the light stays, its shadows go
   still(){if(last)show(last[0],last[1],last[2],false);},
   clear(){wipe();laid='';last=null;node.remove();over.remove();},
   get moving(){return anims.length;}};
 }
 let active=null;
 // The dashboard draws Starfield directly; its packaged document reuses the same renderer.
 function starSky(cv,doc,win){
const document = doc, W = 1600, H = 440, g = cv.getContext?.('2d'); if (!g) return null;
// Logical coordinates stay at the original banner size: the scene is W x H units. The sky is as tall as the band above the
// widgets and as wide as the dashboard, at one scale both ways (never a stretched galaxy): a wider band shows more sky to the
// left of the scene (OX units of it; logical x runs from -OX to W), a narrower one crops the scene's left (OX < 0), and the
// galaxy keeps its place at the right. The backing store matches the box's shape exactly, with at most H rows as before.
let scale = 1, LW = W, OX = 0, vignette, sceneTime = 0;
function sizeCanvas() { const box = cv.getBoundingClientRect(), dpr = Math.min(2, Math.max(1, win.devicePixelRatio || 1));
  const bw = Math.max(1, (box.width || win.innerWidth || W) * dpr), bh = Math.max(1, (box.height || H) * dpr);
  const aspect = bw / bh, rows = Math.max(1, Math.round(Math.min(H, bh)));
  cv.width = Math.max(1, Math.round(rows * aspect)); cv.height = rows; scale = rows / H; LW = H * aspect; OX = LW - W; vignette = null; }
sizeCanvas();
let s = 61803; const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647, gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) * Math.SQRT2; };
const perm = (() => { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } return [...p, ...p]; })();
const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t, gr2 = (h, x, y) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y) * ((h & 4) ? .5 : 1);
// ---------------------------------------------------------------- black-body colour, sprites by temperature
function bbRGB(T) {
  const t = T / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332),
    gg = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755),
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = [r, gg, b].map(v => Math.max(0, Math.min(255, v))), m = Math.max(...c); return c.map(v => v / m * 255); }
const BINS = [2600, 3200, 3700, 4200, 4700, 5200, 5800, 6400, 7200, 8500, 10000, 13000, 18000, 26000];
const binOf = T => { let k = 0; while (k < BINS.length - 1 && BINS[k + 1] <= T) k++; return k; };
const mk = (stops) => {
  const k = document.createElement('canvas');
  k.width = k.height = 64;
  const x = k.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return k;
};
const SPR = BINS.map(T => {
  const [r, gg, b] = bbRGB(T).map(v => v | 0);
  return mk([[0, 'rgba(255,255,255,1)'], [.05, `rgba(${(r + 255) >> 1},${(gg + 255) >> 1},${(b + 255) >> 1},.95)`], [.12, `rgba(${r},${gg},${b},.42)`], [.3, `rgba(${r},${gg},${b},.11)`], [.62, `rgba(${r},${gg},${b},.025)`], [1, `rgba(${r},${gg},${b},0)`]]);
});
const SOFT = BINS.map(T => { const [r, gg, b] = bbRGB(T).map(v => v | 0); return mk([[0, `rgba(${r},${gg},${b},1)`], [.4, `rgba(${r},${gg},${b},.35)`], [1, `rgba(${r},${gg},${b},0)`]]); });
const HII = mk([[0, 'rgba(255,190,210,1)'], [.25, 'rgba(255,110,150,.55)'], [1, 'rgba(230,60,110,0)']]);
const PIN = BINS.map(T => `rgb(${bbRGB(T).map(v => (v * .7 + 255 * .3) | 0).join(',')})`);
// ---------------------------------------------------------------- the galaxy, in its own plane (units: kpc)
const RD = 3.2, RMAX = 15, V0 = 1, R0 = 1.4, OMP = .042, BAR = 3.6, PITCH = .23;      // disc scale length, edge, rotation curve, pattern speed, bar half-length, arm pitch
const omega = r => V0 * (1 - Math.exp(-r / R0)) / Math.max(r, .05);
// the arms start at the bar's ends and wind out as logarithmic spirals: phase of the arm through radius r
const armPhase = (r, k) => k * Math.PI + Math.log(Math.max(r, BAR) / BAR) / Math.tan(PITCH);
const expDisc = () => { let r; do { r = -RD * Math.log(rnd() * rnd()); } while (r > RMAX); return r; };     // exponential disc: r e^-r/Rd
const G = [];
for (let i = 0; i < 9000; i++) G.push({ kind: 'old', r: expDisc(), th: rnd() * 6.283, z: gauss() * .25, T: 4200 + rnd() * 2400, L: .25 + Math.pow(rnd(), 3) * 1.6 });
for (let i = 0; i < 3200; i++) {
  const r = Math.abs(gauss()) * .9;
  G.push({ kind: 'bulge', r, th: rnd() * 6.283, z: gauss() * .55 * Math.exp(-r / 2), T: 3900 + rnd() * 1300, L: .3 + Math.pow(rnd(), 3) * 2 });
}
for (let i = 0; i < 2600; i++) G.push({ kind: 'bar', u: gauss() * BAR * .48, v: gauss() * .45, z: gauss() * .25, T: 4000 + rnd() * 1500, L: .3 + Math.pow(rnd(), 3) * 1.6 });
for (let i = 0; i < 9000; i++)
  G.push({ kind: 'young', r: BAR * .9 + Math.pow(rnd(), .8) * (RMAX - BAR), th: rnd() * 6.283, z: gauss() * .08, T: 9000 + Math.pow(rnd(), 2) * 17000, L: .35 + Math.pow(rnd(), 4) * 3.6 });
for (let i = 0; i < 220; i++) G.push({ kind: 'hii', r: BAR + rnd() * (RMAX - BAR - 2), th: rnd() * 6.283, z: 0, T: 0, L: .6 + rnd() * 1.4 });
// ---------------------------------------------------------------- the foreground field (units: pc)
function fieldStar() { const [a, b, al] = rnd() < .62 ? [.08, .5, -1.3] : [.5, 30, -2.3], k = al + 1, M = Math.pow(Math.pow(a, k) + rnd() * (Math.pow(b, k) - Math.pow(a, k)), 1 / k);
  let T = 5772 * Math.pow(M, .54), L = M < .43 ? .23 * Math.pow(M, 2.3) : Math.pow(M, 3.5);
  if (rnd() < .04) { T = 3600 + rnd() * 1400; L = 50 + Math.pow(rnd(), 2) * 750; }
  return { T: Math.min(26000, T), L };
}
const FOC = 900, F = []; for (let i = 0; i < 11000; i++) { const st = fieldStar(), Z = 2 + Math.pow(rnd(), .34) * 600; F.push({ X: (rnd() - .5) * Z * 2.2, Y: (rnd() - .5) * Z * .36, Z, ...st }); }
// ---------------------------------------------------------------- projection: the galaxy's place, size, tilt and turn on the banner
const GX = 1120, GY = 200, PX = 23, INC = 62 * Math.PI / 180, PA = -.32, ci = Math.cos(INC), si = Math.sin(INC), cp = Math.cos(PA), sp = Math.sin(PA);
const projected = new Float64Array(2);
const project = (x, y, z) => { const y2 = y * ci - z * si; projected[0] = GX + (x * cp - y2 * sp) * PX; projected[1] = GY + (x * sp + y2 * cp) * PX; return projected; };
// dust: optical depth at a point of the disc, on the inner (leading) edge of each arm and along the bar's leading sides
// The noise's x coordinate belongs to the star; only its y coordinate changes with the orbit.
function starNoise(p, y) { const Y = Math.floor(y) & 255; y -= Math.floor(y); const v = fade(y), a = p.na + Y, b = p.nb + Y, x = p.nf;
  return lerp(lerp(gr2(perm[a], x, y), gr2(perm[b], x - 1, y), p.nu), lerp(gr2(perm[a + 1], x, y - 1), gr2(perm[b + 1], x - 1, y - 1), p.nu), v); }
function dustTau(p, th, tp) { if (!p.dust) return 0; let tau = 0;
  for (let k = 0; k < 2; k++) { let d = th - tp - p.phases[k] + .2; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; tau += Math.exp(-d * d / (2 * .09 * .09)); }
  return tau * 1.3 * (.6 + .6 * starNoise(p, th * 2.3)) * p.atten; }
// ---------------------------------------------------------------- one frame
const LOGF0 = Math.log10(1 / (600 * 600)), MAG = 2.4;
// ---------------------------------------------------------------- painted once: far galaxies and a companion
// The far galaxies are small tilted smudges, warm (old light, red-shifted); the companion is a dwarf elliptical beside the
// spiral, a soft yellow-white glow with its own faint stars.
const BACK = document.createElement('canvas'), backSeed = s;
function backdrop() {
  const seed = s;
  s = backSeed;
  BACK.width = Math.max(1, Math.ceil(W * scale));
  BACK.height = cv.height;
  const b = BACK.getContext('2d');
  b.setTransform(scale, 0, 0, scale, 0, 0);
  b.globalCompositeOperation = 'lighter';
  const blob = (x, y, r, rgb, a) => {
    const gr = b.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    b.fillStyle = gr;
    b.beginPath();
    b.arc(x, y, r, 0, Math.PI * 2);
    b.fill();
  };
  b.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, sz = 3 + Math.pow(rnd(), 2) * 7;
    b.save();
    b.translate(x, y);
    b.rotate(a);
    b.scale(1, .3 + rnd() * .5);
    blob(0, 0, sz, rnd() < .7 ? '255,215,170' : '200,215,255', .45);
    blob(0, 0, sz * .3, '255,240,220', .6);
    b.restore();
  }
  {
    const cx = GX + 250, cy = GY - 70;
    blob(cx, cy, 34, '255,235,200', .32);
    blob(cx, cy, 12, '255,245,225', .6);
    for (let i = 0; i < 260; i++) {
      const r = Math.abs(gauss()) * 16;
      const a = rnd() * Math.PI * 2;
      b.fillStyle = 'rgba(255,240,215,.7)';
      b.fillRect(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r, 1, 1);
    }
  }
  s = seed;
}
backdrop();
// ---------------------------------------------------------------- the pointer drags the stars along
// As the pointer moves, the stars near it are carried a little along its path (most at its point, fading with distance),
// as if drawn through water; a pointer that stays still moves nothing, so there is never a ring or a hole around it. Once
// it has moved on they drift slowly back to their places (no spring, no wobble: most of the way back in about 3 x
// EASE_BACK seconds). A grid of offsets (CELL px) is stepped at 60 Hz; only the cells near a moving pointer or still
// settling are visited, and nothing at all is computed once everything is still. A star is drawn at its place plus the
// offset there. The dashboard supplies normalized pointer coordinates. The reach is 46 px (2026-11-09: the stars are
// pulled from further away; it was 20): the pull falls off smoothly, so stars far from the pointer barely move.
const CELL = 10, GOX = 4400, GW = Math.ceil((W + GOX) / CELL) + 2, GH = Math.ceil(H / CELL) + 2, FX = new Float32Array(GW * GH), FY = new Float32Array(GW * GH);
const DRAG = .38, REACH = 46, MAXOFF = 22, EASE_BACK = 1.2, SETTLE = 1 - Math.exp(-1 / (60 * EASE_BACK));   // how much of the pointer's step a star follows, its reach (px), the most a star is moved, and how slowly it returns
let QX = null, QY = null, LX = null, LY = null, live = false, lastT = -1, A0 = 1e9, A1 = -1, B0 = 1e9, B1 = -1;   // the pointer's place and where the field last saw it, the cells still settling
function spring() {
  const s2 = 2 * REACH * REACH, far = 4.84 * REACH * REACH, R = Math.ceil(2.2 * REACH / CELL); let a0 = A0, a1 = A1, b0 = B0, b1 = B1;
  const mx = QX !== null && LX !== null ? QX - LX : 0, my = QX !== null && LY !== null ? QY - LY : 0, moved = Math.abs(mx) + Math.abs(my) > .01; LX = QX; LY = QY;
  if (moved) { const ci = Math.round((QX + GOX) / CELL), cj = Math.round(QY / CELL); a0 = Math.min(a0, ci - R); a1 = Math.max(a1, ci + R); b0 = Math.min(b0, cj - R); b1 = Math.max(b1, cj + R); }
  a0 = Math.max(0, a0); b0 = Math.max(0, b0); a1 = Math.min(GW - 1, a1); b1 = Math.min(GH - 1, b1); A0 = B0 = 1e9; A1 = B1 = -1;
  for (let j = b0; j <= b1; j++) for (let i = a0, n = j * GW + a0; i <= a1; i++, n++) {
    if (moved) {
      const ex = i * CELL - GOX - QX, ey = j * CELL - QY, d2 = ex * ex + ey * ey;
      if (d2 < far) { const w = Math.exp(-d2 / s2); FX[n] += mx * DRAG * w; FY[n] += my * DRAG * w; const m = Math.hypot(FX[n], FY[n]); if (m > MAXOFF) { FX[n] *= MAXOFF / m; FY[n] *= MAXOFF / m; } }
    }
    FX[n] -= FX[n] * SETTLE; FY[n] -= FY[n] * SETTLE;
    if (Math.abs(FX[n]) + Math.abs(FY[n]) > .05) { if (i < A0) A0 = i; if (i > A1) A1 = i; if (j < B0) B0 = j; if (j > B1) B1 = j; } else FX[n] = FY[n] = 0;
  }
  live = A1 >= 0 || moved;
}
const step = dt => { if (!live) return; for (let k = Math.max(1, Math.min(4, Math.round(dt * 60))); k > 0 && live; k--) spring(); };
const aim = (x, y, inside) => { if (inside) { QX = x; QY = y; } else QX = QY = LX = LY = null; live = true; };
// A reused result and a cell bounds check keep the lens work local to the pointer.
const lensed = new Float64Array(3);
const lens = (x, y) => { lensed[0] = x; lensed[1] = y; lensed[2] = 1;
  if (!live || x + GOX < (A0 - 1) * CELL || x + GOX > (A1 + 1) * CELL || y < (B0 - 1) * CELL || y > (B1 + 1) * CELL) return lensed;
  const gx = (x + GOX) / CELL, gy = y / CELL, i = Math.floor(gx), j = Math.floor(gy); if (i < 0 || j < 0 || i >= GW - 1 || j >= GH - 1) return lensed;
  const u = gx - i, v = gy - j, n = j * GW + i, a = (1 - u) * (1 - v), b = u * (1 - v), c = (1 - u) * v, d = u * v;
  lensed[0] += FX[n] * a + FX[n + 1] * b + FX[n + GW] * c + FX[n + GW + 1] * d; lensed[1] += FY[n] * a + FY[n + 1] * b + FY[n + GW] * c + FY[n + GW + 1] * d; return lensed; };
// Parallax moves x only. Flux, y, sprite, size and colour never change for a foreground star.
const field = [];
for (const p of F) { const sy = H / 2 + p.Y / p.Z * FOC * 1.9, m = (Math.log10(p.L / (p.Z * p.Z)) - LOGF0) / MAG; if (sy < -20 || sy > H + 20 || m <= 0) continue;
  const b = binOf(p.T), pin = m < 1.05, z = pin ? .7 + m * .5 : 7 + Math.pow(m - 1, 1.4) * 24, spike = m > 1.9 ? 10 + (m - 1.9) * 40 : 0;
  field.push({
    X:p.X,
    Z:p.Z,
    sy,
    z,
    spike,
    pin,
    sprite:SPR[b],
    colour:PIN[b],
    alpha:pin ? Math.min(1, m * .85) : Math.min(1, .55 + (m - 1) * .45),
    spikeAlpha:Math.min(.8, (m - 1.9) * .9),
    extent:Math.max(z / 2, spike)
  }); }
for (const p of G) {
  p.radius = p.kind === 'bar' ? Math.hypot(p.u, p.v) : p.r;
  p.om = omega(p.radius);
  p.phases = [armPhase(p.radius, 0), armPhase(p.radius, 1)];
  const nx = p.radius * .7, ix = Math.floor(nx) & 255;
  p.nf = nx - Math.floor(nx);
  p.nu = fade(p.nf);
  p.na = perm[ix];
  p.nb = perm[ix + 1];
  p.atten = Math.exp(-p.radius / 9);
  p.dust = p.radius <= RMAX && p.radius > BAR * .8;
  p.dim = p.kind === 'bulge' || p.kind === 'bar' ? .5 : 1;
}
function frame(t, advance = true) {
  sceneTime = t; g.setTransform(scale, 0, 0, scale, OX * scale, 0);
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#020307'; g.fillRect(-OX, 0, LW, H);
  g.globalCompositeOperation = 'lighter';
  if (advance) { step(lastT < 0 ? 0 : t - lastT); lastT = t; }
  const tg = t * 1.1, tp = OMP * tg, camX = t * 1.4;                            // galactic time (fast), the pattern's turn, the camera's drift (pc)
  g.globalAlpha = 1;
  {
    const o = (camX * .02) % W;
    for (let x = -o - Math.ceil(Math.max(0, OX) / W) * W; x <= W; x += W) if (x + W > -OX) g.drawImage(BACK, x, 0, W, H);
  }   // the far galaxies, tiled left to right across the whole width
  // the field, behind and in front alike: parallax from the drift, inverse-square light
  // (the field repeats every W + 400 units, so a wider sky to the left shows it again, one copy after another)
  for (const p of field) { const sx = W / 2 + (p.X - camX) / p.Z * FOC, wx = ((sx + 200) % (W + 400) + W + 400) % (W + 400) - 200;
    for (let tx = wx; tx + p.extent + MAXOFF >= -OX; tx -= W + 400) {
      if (tx - p.extent - MAXOFF > W) continue;
      const [lx, ly] = lens(tx, p.sy); if (lx + p.extent < -OX || lx - p.extent > W) continue;
      g.globalAlpha = p.alpha;
      if (p.pin) { g.fillStyle = p.colour; g.fillRect(lx - p.z / 2, ly - p.z / 2, p.z, p.z); }
      else { g.drawImage(p.sprite, lx - p.z / 2, ly - p.z / 2, p.z, p.z);
        if (p.spike) { g.globalAlpha = p.spikeAlpha; g.fillStyle = p.colour; g.fillRect(lx - p.spike, ly - .5, p.spike * 2, 1); g.fillRect(lx - .5, ly - p.spike, 1, p.spike * 2); } } } }
  // the galaxy's unresolved light: the bulge and the bar
  {
    const [bx0, by0] = project(0, 0, 0), [bx, by] = lens(bx0, by0);
    g.globalAlpha = .34;
    g.drawImage(SOFT[binOf(4600)], bx - 70, by - 40, 140, 80);
    g.globalAlpha = .48;
    g.drawImage(SOFT[binOf(5000)], bx - 26, by - 16, 52, 32);
  }
  // its stars
  const barCos = Math.cos(tp), barSin = Math.sin(tp);
  for (const p of G) {
    let x, y, z = p.z, a = 1, T = p.T, L = p.L, r, th;
    if (p.kind === 'bar') { const c = barCos, s2 = barSin; x = p.u * c - p.v * s2; y = p.u * s2 + p.v * c; r = p.radius; th = Math.atan2(y, x); }
    else { r = p.r; th = p.th + p.om * tg; }
    if (p.kind === 'young' || p.kind === 'hii') {
      let d = 9;
      for (let k = 0; k < 2; k++) { let delta = th - tp - p.phases[k]; delta = ((delta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; d = Math.min(d, Math.abs(delta)); }
      a = Math.exp(-d * d / (2 * (p.kind === 'hii' ? .08 : .17) ** 2));
      if (a < .03) continue;
    }
    if (p.kind !== 'bar') { x = Math.cos(th) * r; y = Math.sin(th) * r; }
    const [sx0, sy0] = project(x, y, z), [sx, sy, mu] = lens(sx0, sy0); if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    // dust between this star and us: the disc's dust where the line of sight crosses it, if the star lies behind the plane
    const tau = dustTau(p, th, tp) * (p.kind === 'old' || p.kind === 'young' ? .7 : 1) + (z < 0 || p.kind === 'bulge' ? dustTau(p, th - .05, tp) * .6 : 0);
    const ext = Math.exp(-tau); T = T ? T / (1 + tau * .2) : 0;
    if (p.kind === 'hii') { const zz = 5 + L * 4; g.globalAlpha = .55 * a * ext; g.drawImage(HII, sx - zz / 2, sy - zz / 2, zz, zz); continue; }
    // the bulge and the bar hold thousands of stars in a small place: each gives less light, so the centre glows instead of burning white
    const dim = p.dim, m = L * a * ext * mu * dim, b = binOf(T);
    if (m < 1) { g.globalAlpha = Math.min(1, (.16 + m * .55) * dim); g.fillStyle = PIN[b]; const zz = .8 + m * .5; g.fillRect(sx - zz / 2, sy - zz / 2, zz, zz); }
    else { const zz = 5 + Math.pow(m - 1, 1.2) * 7; g.globalAlpha = Math.min(1, .45 + (m - 1) * .25); g.drawImage(SPR[b], sx - zz / 2, sy - zz / 2, zz, zz); }
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  if (!vignette) {
    vignette = g.createLinearGradient(-OX, 0, W, 0);
    vignette.addColorStop(0, 'rgba(2,3,7,.45)');
    vignette.addColorStop(.15, 'rgba(2,3,7,0)');
    vignette.addColorStop(.9, 'rgba(2,3,7,0)');
    vignette.addColorStop(1, 'rgba(2,3,7,.4)');
  }
  g.fillStyle = vignette;
  g.fillRect(-OX, 0, LW, H);
}

  let dead = false, paused = true, raf = 0, lastNow = null, lastDraw = -Infinity, elapsed = 0, needsSize = false;
  function forget() { QX = QY = LX = LY = null; FX.fill(0); FY.fill(0); A0 = B0 = 1e9; A1 = B1 = -1; live = false; lastT = -1; }
  function tick(now) {
    raf = 0; if (dead || paused) return;
    if (lastNow !== null) elapsed += Math.min(50, Math.max(0, now - lastNow)) / 1000; lastNow = now;
    if (now - lastDraw >= 1000 / 30 - 2) { lastDraw = now; frame(elapsed); }
    raf = win.requestAnimationFrame(tick);
  }
  return {
    pause(value) { if (dead || paused === value) return; paused = value; lastNow = null;
      if (paused) { if (raf) win.cancelAnimationFrame(raf); raf = 0; forget(); }
      else if (!raf) { if(needsSize){sizeCanvas();backdrop();needsSize=false;}lastDraw = -Infinity; raf = win.requestAnimationFrame(tick); }
    },
    aim(x, y, inside) { if (!paused && !dead) aim(-OX + x * LW, y * H, inside); },
    resize() { if (dead) return; if(paused){needsSize=true;return;}sizeCanvas(); backdrop(); frame(elapsed, false); },
    destroy() { dead = true; if (raf) win.cancelAnimationFrame(raf); raf = 0; forget(); }
  };
 }

 // Starfield: the frames' stars are drawn here, star by star, so the pointer's lens bends each one as it bends the sky's.
 // Every frame is a ring of star streams (clumped like the Milky Way, knotted at the corners). At rest each ring is four
 // cached edge strips; frames near the pointer are drawn star by star through a point lens (r' = (r + sqrt(r^2 + 4E^2)) / 2,
 // brightened by mu = (u^2 + 2) / (u sqrt(u^2 + 4))). Nothing is drawn while nothing changes.
 function starFrames(rd,doc,win,isHidden){
  const canvas=doc.createElement('canvas');canvas.className='tk-starframes';canvas.setAttribute('aria-hidden','true');canvas.setAttribute('data-rd-keep','');
  Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',width:'100vw',height:'100vh',pointerEvents:'none',zIndex:'2'});
  const g=canvas.getContext?.('2d'),rings=new WeakMap(),observed=new Set();if(!g)return null;
  // the course sidebar has no ring of its own: its course cards carry the stars
  const KIND=[['.rd-rail-all .rd-frame, .rd-rail-course .rd-frame','card'],['.rd-course-information, .rd-work-column, .rd-information','panel']];
  // card: the ring 7px inside the card; panel: 8px outside the panel; rail: just outside the rail
  const SHAPE={
    card:{grow:-2,radius:5,spread:3,density:.72,clump:13,size:.43},
    panel:{grow:8,radius:6,spread:4.4,density:.62,clump:21,size:.4},
    rail:{grow:2,radius:6,spread:4.4,density:.62,clump:21,size:.4}
  };
  const PAD=16;
  let dpr=1,W=0,H=0,raf=0,dirty=true,dead=false,geometry=null,base=null,painted=null;
  // THE POINTER DRAGS THE STARS ALONG (as in the sky): as it moves, the stars near it are carried a little along its path,
  // and a pointer that stays still moves nothing (no ring round it); once it has moved on they drift slowly back, with
  // no spring and no wobble. Stepped at 60 Hz over only the cells near a moving pointer or still settling; a star there
  // is drawn at its place plus the offset. Rings away from it stay their cached strips; nothing runs once all is still.
  const CELL=10,DRAG=.34,REACH=46,MAXOFF=12,EASE_BACK=1.2,SETTLE=1-Math.exp(-1/(60*EASE_BACK));
  let GW=0,GH=0,FX=new Float32Array(0),FY=new Float32Array(0),live=false,box=null,px=null,py=null,lx=null,ly=null,last=0,A0=1e9,A1=-1,B0=1e9,B1=-1;
  function grid(){
    const gw=Math.ceil(W/CELL)+2,gh=Math.ceil(H/CELL)+2;
    if(gw===GW&&gh===GH)return;
    GW=gw;
    GH=gh;
    const n=GW*GH;
    FX=new Float32Array(n);
    FY=new Float32Array(n);
    A0=B0=1e9;
    A1=B1=-1;
    box=null;
    live=px!==null;
  }
  function spring(){
   const s2=2*REACH*REACH,far=4.84*REACH*REACH,R=Math.ceil(2.2*REACH/CELL);let a0=A0,a1=A1,b0=B0,b1=B1;
   const mx=px!==null&&lx!==null?px-lx:0,my=px!==null&&ly!==null?py-ly:0,moved=Math.abs(mx)+Math.abs(my)>.01;lx=px;ly=py;
   if(moved){const ci=Math.round(px/CELL),cj=Math.round(py/CELL);a0=Math.min(a0,ci-R);a1=Math.max(a1,ci+R);b0=Math.min(b0,cj-R);b1=Math.max(b1,cj+R);}
   a0=Math.max(0,a0);b0=Math.max(0,b0);a1=Math.min(GW-1,a1);b1=Math.min(GH-1,b1);A0=B0=1e9;A1=B1=-1;let moving=false;
   for(let j=b0;j<=b1;j++)for(let i=a0,n=j*GW+a0;i<=a1;i++,n++){
    if(moved){
      const ex=i*CELL-px,ey=j*CELL-py,d2=ex*ex+ey*ey;
      if(d2<far){const w=Math.exp(-d2/s2);FX[n]+=mx*DRAG*w;FY[n]+=my*DRAG*w;const m=Math.hypot(FX[n],FY[n]);if(m>MAXOFF){FX[n]*=MAXOFF/m;FY[n]*=MAXOFF/m;}}
    }
    FX[n]-=FX[n]*SETTLE;FY[n]-=FY[n]*SETTLE;
    if(Math.abs(FX[n])+Math.abs(FY[n])>.05){moving=true;if(i<A0)A0=i;if(i>A1)A1=i;if(j<B0)B0=j;if(j>B1)B1=j;}else FX[n]=FY[n]=0;
   }
   live=moving||moved;
  }
  // steps the spring for dt seconds and finds the box (window px) that still holds any offset
  function step(dt){
   if(!live||!GW)return;for(let k=Math.max(1,Math.min(4,Math.round(dt*60)));k>0&&live;k--)spring();
   box=A1>=0?{x0:(A0-1)*CELL,y0:(B0-1)*CELL,x1:(A1+1)*CELL,y1:(B1+1)*CELL}:null;
  }
  const shifted=new Float64Array(2);
  const offset=(x,y)=>{const gx=x/CELL,gy=y/CELL,i=Math.floor(gx),j=Math.floor(gy);if(i<0||j<0||i>=GW-1||j>=GH-1)return shifted.fill(0);
   const u=gx-i,v=gy-j,n=j*GW+i,a=(1-u)*(1-v),b=u*(1-v),c=(1-u)*v,d=u*v;
   shifted[0]=FX[n]*a+FX[n+1]*b+FX[n+GW]*c+FX[n+GW+1]*d;shifted[1]=FY[n]*a+FY[n+1]*b+FY[n+GW]*c+FY[n+GW+1]*d;return shifted;};
  const seeded=seed=>{let s=seed>>>0||1;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
  const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;};
  // glow sprites, one per tint, drawn once
  const glow=rgb=>{
    const c=doc.createElement('canvas');
    c.width=c.height=64;
    const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,`rgba(${rgb},1)`);
    gr.addColorStop(.25,`rgba(${rgb},.45)`);
    gr.addColorStop(1,`rgba(${rgb},0)`);
    x.fillStyle=gr;
    x.fillRect(0,0,64,64);
    return c;
  };
  const SPRITE={cool:glow('195,214,255'),warm:glow('255,205,160'),core:glow('255,255,255')};
  // a point on the rounded ring at arc length s, with its outward normal
  function track(w,h,r){
   const straight=[w-2*r,h-2*r],arc=Math.PI*r/2,parts=[];let at=0;
   const edge=(x,y,dx,dy,nx,ny,len)=>{parts.push({at,len,f:s=>[x+dx*s,y+dy*s,nx,ny]});at+=len;};
   const bend=(cx,cy,a0)=>{parts.push({at,len:arc,f:s=>{const a=a0+s/r;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r,Math.cos(a),Math.sin(a)];}});at+=arc;};
   edge(r,0,1,0,0,-1,straight[0]);bend(w-r,r,-Math.PI/2);edge(w,r,0,1,1,0,straight[1]);bend(w-r,h-r,0);
   edge(w-r,h,-1,0,0,1,straight[0]);bend(r,h-r,Math.PI/2);edge(0,h-r,0,-1,-1,0,straight[1]);bend(r,r,Math.PI);
   return {length:at,point(s){s=((s%at)+at)%at;const p=parts.find(q=>s<q.at+q.len)||parts.at(-1);return p.f(s-p.at);}};
  }
  // the stars of one ring, in ring coordinates (0,0 = the ring's top left); the same frame size always gets the same sky
  function stars(kind,w,h,key){
   const S=SHAPE[kind],r=Math.min(S.radius,w/2,h/2),T=track(w,h,r),rnd=seeded(hash(key)),gauss=()=>{
     let u=0;
     while(!u)u=rnd();
     return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*rnd());
   },out=[];
   const clumps=[];for(let s=rnd()*S.clump;s<T.length;s+=S.clump*(.6+rnd()*.8))clumps.push([s,S.clump*(.1+rnd()*.26)]);
   const waves=[0,1].map(()=>[60+rnd()*90,rnd()*6.2832]),wob=s=>waves.reduce((a,[p,f])=>a+Math.sin(s/p*6.2832+f),0)*S.spread*.28;
   const add=(x,y,b,warm)=>out.push([x,y,b,warm]);
   const n=Math.round(T.length*S.density);
   for(let k=0;k<n;k++){
     const c=clumps[(rnd()*clumps.length)|0],s=rnd()<.7&&c?c[0]+gauss()*c[1]:rnd()*T.length,[x,y,nx,ny]=T.point(s),off=wob(s)+gauss()*S.spread*.45;
     add(x+nx*off,y+ny*off,Math.pow(rnd(),3.2),rnd()<.14);
   }
   const flares=[];
   for(const [cx,cy,big] of [[0,0,1],[w,0,0],[w,h,0],[0,h,0]]){
    const ix=cx?cx-r*.3:r*.3,iy=cy?cy-r*.3:r*.3;
    for(let q=0;q<14;q++)add(ix+gauss()*S.spread*.6,iy+gauss()*S.spread*.6,Math.pow(rnd(),2.2),rnd()<.2);
    flares.push([ix,iy,big?1:.55+rnd()*.25]);
   }
   return {stars:out,flares,size:S.size};
  }
  // one star at (x,y), brightness b (m scales its light; 1 = as drawn)
  function star(ctx,x,y,b,warm,k,m){
   if(b>.55){const R=(2+b*5)*k*Math.sqrt(m);ctx.globalAlpha=Math.min(1,.42*m);ctx.drawImage(warm?SPRITE.warm:SPRITE.cool,x-R,y-R,2*R,2*R);
    const c=(.8+b)*k*Math.sqrt(m);ctx.globalAlpha=Math.min(1,.9*m);ctx.drawImage(SPRITE.core,x-c,y-c,2*c,2*c);
    if(b>.85)spikes(ctx,x,y,(4+b*6)*k*Math.sqrt(m),warm,.42*Math.min(1,m));}
   else{const z=Math.max(.6,(.7+b*1.6)*k*1.15)*Math.sqrt(m);ctx.globalAlpha=Math.min(1,(.35+b)*m);ctx.fillStyle=warm?'rgb(255,215,180)':'rgb(215,228,255)';ctx.fillRect(x-z/2,y-z/2,z,z);}
  }
  function spikes(ctx,x,y,len,warm,alpha){
   ctx.globalAlpha=alpha;ctx.strokeStyle=warm?'rgba(255,214,180,.9)':'rgba(214,226,255,.9)';ctx.lineWidth=.6;ctx.beginPath();
   ctx.moveTo(x-len,y);ctx.lineTo(x+len,y);ctx.moveTo(x,y-len);ctx.lineTo(x,y+len);ctx.stroke();
  }
  function dragRing(ctx,ring,ox,oy,bx){
   const k=ring.size,inside=(x,y)=>x>=bx.x0&&x<=bx.x1&&y>=bx.y0&&y<=bx.y1;
   for(const [sx,sy,b,warm] of ring.stars){const x=ox+sx,y=oy+sy;if(!inside(x,y))continue;const [dx,dy]=offset(x,y);star(ctx,x+dx,y+dy,b,warm,k,1);}
   for(const [fx,fy,s] of ring.flares){
     const x=ox+fx,y=oy+fy;
     if(!inside(x,y))continue;
     const [dx,dy]=offset(x,y);
     ctx.globalAlpha=.85;
     const c=1.3*s;
     ctx.drawImage(SPRITE.core,x+dx-c*2,y+dy-c*2,c*4,c*4);
     spikes(ctx,x+dx,y+dy,7*s,false,.5*s);
   }
   ctx.globalAlpha=1;
  }
  function drawRing(ctx,ring,ox,oy){
   const k=ring.size;
   for(const [sx,sy,b,warm] of ring.stars)star(ctx,ox+sx,oy+sy,b,warm,k,1);
   for(const [fx,fy,s] of ring.flares){const x=ox+fx,y=oy+fy;ctx.globalAlpha=.85;const c=1.3*s;ctx.drawImage(SPRITE.core,x-c*2,y-c*2,c*4,c*4);spikes(ctx,x,y,7*s,false,.5*s);}
   ctx.globalAlpha=1;
  }
  // a ring at rest: four thin strips cached at the screen's pixel ratio (only the edges hold stars)
  function strips(ring,w,h){
   const band=PAD*2,make=(sw,sh)=>{
     const c=doc.createElement('canvas');
     c.width=Math.max(1,Math.ceil(sw*dpr));
     c.height=Math.max(1,Math.ceil(sh*dpr));
     const x=c.getContext('2d');
     x.setTransform(dpr,0,0,dpr,0,0);
     x.globalCompositeOperation='lighter';
     return [c,x];
   };
   const parts=[[-PAD,-PAD,w+band,band],[-PAD,h-PAD,w+band,band],[-PAD,PAD,band,h-band],[w-PAD,PAD,band,h-band]].filter(p=>p[2]>0&&p[3]>0);
   return parts.map(([x0,y0,sw,sh])=>{
     const [c,x]=make(sw,sh);
     x.save();
     x.beginPath();
     x.rect(0,0,sw,sh);
     x.clip();
     drawRing(x,ring,-x0,-y0);
     x.restore();
     return {c,x0,y0,sw,sh};
   });
  }
  function frames(){
   const list=[];
   for(const [selector,kind] of KIND)for(const el of rd.querySelectorAll(selector)){
    const b=el.getBoundingClientRect();if(b.width<8||b.height<8)continue;
    const S=SHAPE[kind],x=b.left-S.grow,y=b.top-S.grow,w=b.width+2*S.grow,h=b.height+2*S.grow;if(w<8||h<8)continue;
    let clip=null;if(kind==='card'){const rail=el.closest('.rd-course-rail');if(rail){const c=rail.getBoundingClientRect();clip=[c.left,c.top,c.width,c.height];}}
    list.push({el,kind,x,y,w,h,clip});
   }
   return list;
  }
  function ringOf(f,index){
   const key=f.kind+':'+index+':'+Math.round(f.w)+'x'+Math.round(f.h)+'@'+dpr;let ring=rings.get(f.el);
   if(!ring||ring.key!==key){
     const made=stars(f.kind,f.w,f.h,f.kind+index+':'+Math.round(f.w)+'x'+Math.round(f.h));
     ring={key,...made};
     ring.strips=strips(ring,f.w,f.h);
     rings.set(f.el,ring);
   }
   return ring;
  }
  function paint(){
   raf=0;if(dead)return;
   if(isHidden()){dirty=true;return;}
   const nd=Math.min(2,win.devicePixelRatio||1),nw=win.innerWidth,nh=win.innerHeight;
   if(nd!==dpr||nw!==W||nh!==H){dpr=nd;W=nw;H=nh;canvas.width=Math.ceil(W*dpr);canvas.height=Math.ceil(H*dpr);dirty=true;}
   grid();const now=win.performance?.now?.()??Date.now();step(last?Math.max(0,(now-last)/1000):0);last=live?now:0;
   if(dirty||!geometry){
     base=canvas.getBoundingClientRect();
     geometry=frames();
     const present=new Set(geometry.map(f=>f.el));
     for(const el of observed)if(!present.has(el)){resize?.unobserve?.(el);observed.delete(el);}
     for(const el of present)if(!observed.has(el)){resize?.observe(el);observed.add(el);}
   }
   const bx=box&&{x0:box.x0-base.left,y0:box.y0-base.top,x1:box.x1-base.left,y1:box.y1-base.top};
   // Restore only the old/new push area; the rest of the canvas already holds the cached rings.
   const boxes=[painted,bx].filter(Boolean),
     pad=PAD+MAXOFF,
     area=dirty?
       {x0:0,y0:0,x1:W,y1:H}:
       boxes.length?
         {x0:Math.min(...boxes.map(b=>b.x0))-pad,y0:Math.min(...boxes.map(b=>b.y0))-pad,x1:Math.max(...boxes.map(b=>b.x1))+pad,y1:Math.max(...boxes.map(b=>b.y1))+pad}:
         null;
   if(!area)return;
   g.setTransform(dpr,0,0,dpr,0,0);
   g.save();
   g.beginPath();
   g.rect(area.x0,area.y0,area.x1-area.x0,area.y1-area.y0);
   g.clip();
   g.globalCompositeOperation='source-over';
   g.globalAlpha=1;
   g.clearRect(area.x0,area.y0,area.x1-area.x0,area.y1-area.y0);
   g.globalCompositeOperation='lighter';
   geometry.forEach((f,index)=>{
    const ox=f.x-base.left,oy=f.y-base.top;if(ox+f.w+PAD<area.x0||ox-PAD>area.x1||oy+f.h+PAD<area.y0||oy-PAD>area.y1)return;const ring=ringOf(f,index);
    if(f.clip){g.save();g.beginPath();g.rect(f.clip[0]-base.left,f.clip[1]-base.top,f.clip[2],f.clip[3]);g.clip();}
    const near=!!bx&&bx.x1>ox-PAD&&bx.x0<ox+f.w+PAD&&bx.y1>oy-PAD&&bx.y0<oy+f.h+PAD;
    // the strips draw everything outside the push box; inside it the ring's own stars are drawn where the push has moved them
    if(near){g.save();g.beginPath();g.rect(0,0,W,H);g.rect(bx.x0,bx.y0,bx.x1-bx.x0,bx.y1-bx.y0);g.clip('evenodd');}
    for(const s of ring.strips)g.drawImage(s.c,ox+s.x0,oy+s.y0,s.sw,s.sh);
    if(near){g.restore();dragRing(g,ring,ox,oy,bx);}
    if(f.clip)g.restore();
   });
   g.restore();painted=bx;dirty=false;
   if(live)raf=win.requestAnimationFrame(paint);
  }
  const wake=()=>{if(!dead&&!raf&&!isHidden())raf=win.requestAnimationFrame(paint);};
  const resize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(()=>{dirty=true;wake();}):null;resize?.observe(rd);
  return {canvas,
   // where the pointer is (or null when it left / motion is off): the stars near it are pushed aside and spring back
   aim(x,y,on){const nx=x==null||!on?null:x,ny=nx===null?null:y;if(nx===px&&ny===py)return;px=nx;py=ny;live=true;wake();},
   pause(){if(raf)win.cancelAnimationFrame(raf);raf=0;px=py=lx=ly=null;FX.fill(0);FY.fill(0);A0=B0=1e9;A1=B1=-1;box=null;live=false;last=0;dirty=true;},
   dirty(){dirty=true;wake();},
   destroy(){dead=true;resize?.disconnect();if(raf)win.cancelAnimationFrame(raf);raf=0;canvas.remove();}};
 }
 // remove(rd) takes the scene down only if that dashboard owns it, so an old dashboard being torn down never removes a newer one's
 // (a scene held back by the megapack gate is let go the same way)
 function remove(rd){
   if(megaGate&&(!rd||megaGate.rd===rd)){megaGate.rd.removeAttribute?.('data-megapack');megaGate=null;}
   if(active&&(!rd||active.rd===rd)){const previous=active;active=null;previous.destroy();}
 }
 // (a megapack's record came or went: a scene held back by the gate is tried again; a scene on whose files are gone goes)
 function megaChanged(id){
   if(megaGate?.id===id){const g=megaGate;apply(g.root,g.rd,g.id,g.opts);}
   else if(active?.id===id&&!packaged(id)){
     const {root,rd,opts}=active.gateArgs||{};
     megapackState(id).then(state=>{if(state==='none'&&active?.id===id&&root&&rd){remove(rd);apply(root,rd,id,opts);}});
   }
 }
 // The origin the frames of a band's own pages (frameBand, framePage) speak from: the extension's own. Where Canvas is at a school's
 // own address, the page reaches the frames by the second resource list's per-session address (use_dynamic_url), and their
 // messages still carry the extension's real origin, as the PDF reader's frame does (pdf-host.js).
 function frameOrigin(base){
  try{const url=new global.URL(base),runtime=String(global.chrome?.runtime?.id||'');return url.protocol+'//'+(/^[a-p]{32}$/.test(runtime)?runtime:url.host);}catch{return '';}
 }
 function apply(root,rd,id,opts={}){
  if(!id||!Object.hasOwn(motifs,id)||global.ReserveFeatures?.enabled('scene-themes')===false){remove(rd);return;}
  if(active?.root===root&&active.rd===rd&&active.id===id){active.update(opts);return;}
  remove();
  // (megapack) a scene whose files neither come with this build nor are all on this machine is not put on: no half scene. The
  // dashboard says so on data-megapack, for the picker: "checking" while the record is read, "missing" when it is not there.
  if(MEGAPACK[id]&&!packaged(id)&&megaHere.get(id)!==true){
   megaGate={root,rd,id,opts};rd?.setAttribute?.('data-megapack',megaHere.has(id)?'missing':'checking');
   if(!megaHere.has(id))
     megaRecord(MEGAPACK[id]).then(rec=>{
       megaHere.set(id,!!megaNames(rec));
       if(megaGate?.id!==id||megaGate.rd!==rd)return;
       if(megaHere.get(id)){const g=megaGate;megaGate=null;rd.removeAttribute?.('data-megapack');apply(g.root,g.rd,g.id,g.opts);}else rd.setAttribute?.('data-megapack','missing');
     });
   return;
  }
  if(!root||!rd||!global.chrome?.runtime?.getURL)return;
  const doc=rd.ownerDocument||global.document,base=global.chrome.runtime.getURL('themes/'+id+'/');
  const reduced=global.matchMedia?.('(prefers-reduced-motion: reduce)');
  const previousKit=rd.getAttribute('data-theme-kit'),previousPause=rd.hasAttribute('data-scene-paused'),icons=new Map(),minis=new Map(),lens=new Map(),disposers=[];
  let options=opts,
    dead=false,
    timer=0,
    raf=0,
    point=null,
    intersecting=true,
    skyInView=true,
    playing=false,
    mediaSource='',
    skyAnimator=null,
    invisibleState=false,
    drawingPaused=true;
  const link=doc.createElement('link');link.rel='stylesheet';link.setAttribute('href',base+'theme.css');
  // the sky and pictures show once the theme's own styles are in (scene-themes.css holds them back until then)
  let sheetReady=false;link.addEventListener('load',()=>{sheetReady=true;if(!dead)rd.setAttribute('data-theme-kit-ready','');});
  const sky=doc.createElement('div');sky.className='tk-sky';sky.setAttribute('aria-hidden','true');sky.setAttribute('data-rd-keep','');
  // A band sky (bands: Soul Passage) has no video: its pictures come and go with the clock (its own page in a frame, frameBand),
  // and the poster is only its fallback.
  const banded=Object.hasOwn(bands,id);
  const media=banded?null:doc.createElement(id==='stars'?'canvas':'video');
  const poster=doc.createElement('img');poster.className='tk-poster';poster.alt='';
  if(banded)poster.hidden=true;else poster.setAttribute('src',base+'poster.jpg');
  if(id==='stars')media.setAttribute('aria-hidden','true');
  else if(media){media.muted=true;media.loop=true;media.playsInline=true;media.autoplay=false;media.preload='none';media.poster=base+'poster.jpg';}
  if(media)sky.append(media);
  sky.append(poster);
  let band=null,broken=false,minute=0,bandWide=0,tone='',light=null,lightInView=true,floorY=0,page=null,pageFell=false,lever=null,dock=null,dockWatch=null,travel=[1,0,0,0];
  const origin=banded?frameOrigin(base):'';
  // (a band's words over its picture: the greeting turned light or dark, bandWords)
  const style=banded?doc.createElement('style'):null;
  style?.setAttribute('data-rd-scene-style',id);
  // The band: the strip of sky above the widgets. Home's header is taller or shorter with the Help band, Edit Home moves
  // and the window's width, so the sky is sized to reach just where the first widget starts (theme.css: --tk-band) and a
  // scene is painted to be seen whole in that strip. Written on the sky alone: a variable on the root would restyle the
  // whole dashboard. Measured on each sync (DOM changes, debounced) and when the window's size changes. The desk (.rd-main)
  // starts exactly where its first widget does, below the Help band when that is on; its panels themselves are never read.
  // The Help band counts as the band's floor too: with Help open the desk moves down, and sizing the sky to it re-fitted
  // the scene (it zoomed and slid left), so the scene now stops where Help starts, the same as without it.
  const BAND='.rd-main, .ch-band-host';
  let bandPx=0;
  function measureBand(){
   let px=0;
   try{
    const at=rd.getBoundingClientRect?.(),top=at?.top;
    if(banded)bandWide=Math.round(at?.width||0);
    // (a room keeps one band on every menu: sized to each menu's header, its cabin was a different size on each)
    // (on a dashboard wider than its picture at that height the band grows, so the cabin still covers the whole width)
    if(rooms[id]?.band){const r=rooms[id];px=Math.max(r.band,Math.ceil(bandWide*r.box[1]/r.box[0])-28);}
    else if(Number.isFinite(top)){
     let first=Infinity;
     const scope=rd.getRootNode?.(),within=scope&&typeof scope.querySelectorAll==='function'?scope:rd;
     // (where the desk starts in the page, not on the screen: with the courses as the dock or across the top, Home scrolls
     //  inside its work area under a band that stays; read while scrolled, the band shrank by the scroll at the next
     //  render, e.g. on selecting a row further down, and grew back on the next render at the top, owner 2026-11-16)
     for(const el of within.querySelectorAll(BAND)){
       const r=el.getBoundingClientRect?.();
       if(!r||!(r.width>200))continue;
       let y=r.top-top;
       for(let p=el.parentElement;p&&p!==rd;p=p.parentElement)y+=p.scrollTop||0;
       if(y>80)first=Math.min(first,y);
     }
     if(Number.isFinite(first))px=Math.round(Math.max(200,Math.min(560,first)));
    }
   }catch{px=0;}
   if(px!==bandPx){bandPx=px;if(px)sky.style.setProperty('--tk-band',px+'px');else sky.style.removeProperty('--tk-band');}
  }
  const frames=id==='stars'?starFrames(rd,doc,global,()=>invisibleState||doc.hidden||doc.visibilityState==='hidden'||rd.isConnected===false):null;
  function listen(target,type,fn,options){target?.addEventListener?.(type,fn,options);disposers.push(()=>target?.removeEventListener?.(type,fn,options));}
  // (a band sky also takes the motion it is told: Still or Off stops the train however the dashboard is marked)
  function animated(){return (rd.dataset.motionStyle??options.motionStyle??'gentle')==='gentle'&&!(banded&&['still','off'].includes(options.motionStyle))&&!reduced?.matches;}
  // ---- a band sky (bands): its words, its frame, the room under it (rooms), the lever, the clock
  function syncStyle(){if(!style)return;const css=bandWords(id,tone);if(style.textContent!==css)style.textContent=css;}
  const modeOf=()=>['light','dark'].includes(options.theme)?options.theme:rd.getAttribute('data-theme')==='dark'?'dark':'light';
  // the greeting's box on the band, in the dashboard's own pixels (the sky starts at its top left)
  function greeting(){
   try{
    const at=rd.getBoundingClientRect?.();if(!at)return null;let box=null;
    for(const el of [rd.querySelector('.rd-workspace-heading h1')||rd.querySelector('.rd-course-heading h1'),rd.querySelector('.rd-heading-date')]){
     if(!el)continue;let r=null;try{const range=doc.createRange?.();if(range){range.selectNodeContents(el);r=range.getBoundingClientRect?.();}}catch{r=null;}
     if(!r||!(r.width>0&&r.height>0))r=el.getBoundingClientRect?.();if(!r||!(r.width>0&&r.height>0))continue;
     box=box?{l:Math.min(box.l,r.left),t:Math.min(box.t,r.top),r:Math.max(box.r,r.right),b:Math.max(box.b,r.bottom)}:{l:r.left,t:r.top,r:r.right,b:r.bottom};
    }
    return box?{x:Math.round(box.l-at.left),y:Math.round(box.t-at.top),w:Math.round(Math.min(box.r-box.l,620)),h:Math.round(box.b-box.t)}:null;
   }catch{return null;}
  }
  // the measured tone becomes words only when it is the other tone than the theme's own ink in this mode
  function turn(next){const want=next&&next!==(modeOf()==='dark'?'light':'dark')?next:'';if(want!==tone){tone=want;syncStyle();}}
  // (the land's own page failed or never answered: no land is laid in this page, which keeps the land's ground and kit frames)
  function pageFail(){if(dead||pageFell)return;pageFell=true;if(page?.framed){page.destroy();page=null;}schedule();}
  function fallback(){
    broken=true;
    band?.destroy();
    band=null;
    syncLight(null);
    if(!poster.getAttribute('src'))poster.setAttribute('src',base+'poster.jpg');
    poster.hidden=false;
    mend(doc.hidden?0:6000);
  }
  // A band that failed is laid again when the page is next seen (pictures asked for by a tab at the back are the ones that fail):
  // at most three times; the poster stays until the new band has stood for a moment.
  let mends=0,mending=0,mended=0;
  function mend(after){
   if(dead||!broken||mends>=3||mending)return;if(doc.hidden||!after)return;
   mending=global.setTimeout(()=>{
     mending=0;
     if(dead||!broken)return;
     if(doc.hidden)return;
     mends++;
     broken=false;
     syncBand();
     mended=global.setTimeout(()=>{mended=0;if(!dead&&!broken&&band)poster.hidden=true;},2600);
   },after);
  }
  disposers.push(()=>{if(mending){global.clearTimeout(mending);mending=0;}if(mended){global.clearTimeout(mended);mended=0;}});
  // a band sky: the pictures for this minute, fitted to the band; nothing is read for a hidden or scrolled-away page. The band
  // runs in its own page, in a frame (frameBand); laid in this page (skyBand) only while this build carries its pictures.
  function syncBand(){
   if(!banded||dead||broken)return;
   if(!band){
     const on={tone:turn,fail:fallback,ready:schedule,other:event=>page?.hear?.(event),stage:name=>{
       if(dead)return;
       if(name){if(rd.getAttribute('data-band-stage')!==name)rd.setAttribute('data-band-stage',name);}else rd.removeAttribute('data-band-stage');
     }};
     band=rides[id]&&pages[id]&&origin&&typeof global.chrome?.runtime?.id==='string'&&typeof global.addEventListener==='function'?
       frameBand(doc,base,origin,pages[id],rides[id],on,bands[id],livedOf(id)):
       packaged(id)?skyBand(doc,base,bands[id],on,rides[id],livedOf(id)):null;
     if(!band){fallback();return;}
   }
   if(band.node.parentNode!==sky)sky.append(band.node);
   if(hidden()||!bandWide){band.rest?.();light?.still();page?.rest?.();return;}
   const now=new global.Date(),mode=modeOf(),view={w:bandWide,h:(bandPx||330)+28};
   let nth=0;for(const icon of icons.values())band.rider?.(icon,['plant','lamp'].includes(icon.dataset.motif)?'sway':'hop',nth++);
   // (Dark, chosen by the student, is the night carriage at every hour: a band that travels is asked for its night)
   const env={
     mode,
     hour:mode==='dark'&&rides[id]?1:now.getHours()+now.getMinutes()/60,
     month:now.getMonth()+1,
     day:now.getDay(),
     week:global.ReserveBandKit?.week?.(now)??1,
     ratio:view.w/view.h
   },
     swap=rd.getAttribute('data-graphics')==='low',
     awake=animated()&&(!!rides[id]||!rd.hasAttribute?.('data-art-rest'));   // (a band that travels keeps travelling through the dashboard's idle rest: its land is a place to sit and look at)
   if(look){if(look.day!==null)env.day=look.day;if(look.hour!==null&&mode!=='dark')env.hour=look.hour;}
   // (a land without a day: while it passes, the band is asked for its night at every hour, as Dark is: the lamps-on room, no
   // daylight through its panes, the land's own dark. No land of 4.2.2 asks for it; the deep sea did)
   if(rides[id]){const here=landOfDay(env.day),table=rooms[id]?.pages;if(table&&Object.hasOwn(table,here)&&table[here]?.night)env.hour=1;}
   band.show(
     env,
     view,
     swap,
     greeting(),
     lum(bandPaper[id]?.[mode]||'#808080'),
     awake&&skyInView?(rd.getAttribute('data-graphics')==='medium'?1:2):0,
     rooms[id]?.lever?travel:null,
     !!page?.painting&&!swap);
   syncLight(env,view,swap,awake&&!swap&&lightInView);
  }
  // the room under the band (rooms): the page's floor starts at the row the cabin's does (--tk-floor-y on the dashboard,
  // written only when the band's place changes), and the windows' light lies on it as the band is laid at this moment.
  // None in Dark (the page is not the room's floor there) or once the band has failed.
  // The travel's pace. The lever's notch is kept between visits (chrome.storage.local); a new pace is taken in a few steps, so the
  // train gathers speed and slows as a train does, and at every step the journey goes on from where it had come to. (The journey
  // is told on the band's own clock: it began when the band's page did.)
  // A look at another day or hour (reserve:train-preview in chrome.storage.local: {day: 0-6, hour: 0-23.99}): the band and
  // the land's page are laid as on that weekday, at that hour, until it is set back (Make it yours > Look: Land and Time).
  const LOOK_KEY='reserve:train-preview';let look=null;
  const lookOf=raw=>{
    const day=Number.isInteger(raw?.day)&&raw.day>=0&&raw.day<=6&&!(raw.day===4&&raw.week===1)?raw.day:null,
      hour=Number.isFinite(raw?.hour)&&raw.hour>=0&&raw.hour<24?raw.hour:null;
    return day===null&&hour===null?null:{day,hour};
  };
  if(rooms[id]){
    try{
      const heard=(changes,area)=>{if(area!=='local'||!changes||!Object.hasOwn(changes,LOOK_KEY))return;look=lookOf(changes[LOOK_KEY].newValue);if(!dead)syncBand();};
      global.chrome?.storage?.local?.get?.(LOOK_KEY,got=>{if(dead)return;look=lookOf(got?.[LOOK_KEY]);if(look)syncBand();});
      global.chrome?.storage?.onChanged?.addListener?.(heard);
      disposers.push(()=>{try{global.chrome?.storage?.onChanged?.removeListener?.(heard);}catch{}});
    }catch{}
  }
  const PACE_KEY='reserve:train-pace',clock=()=>(global.performance?.now?.()||0)-(band?.since||0);
  function notchOf(p){const list=rooms[id]?.lever?.paces||[1];let best=0;list.forEach((v,i)=>{if(Math.abs(v-p)<Math.abs(list[best]-p))best=i;});return best;}
  // (engine 2: the new stop is a curve of the speed from where the train is, told once to every page that moves something (travelTo);
  // at once with Still, Off or reduced motion)
  // (write: keep the stop for the next visit; a stop heard from the store is not written back)
  function setPace(notch,quiet,write=!quiet){
   const list=rooms[id]?.lever?.paces;if(!list||dead)return;const want=list[Math.min(list.length-1,Math.max(0,notch|0))];
   if(write){try{global.chrome?.storage?.local?.set?.({[PACE_KEY]:notch|0});}catch{}}
   const now=clock(),here=travelOf(travel);if(want===here.v1&&!travelAt(here,now).moving)return;
   travel=travelTo(here,now,want,quiet||!animated()||typeof global.setInterval!=='function');syncBand();
  }
  if(rooms[id]?.lever){
    try{
      global.chrome?.storage?.local?.get?.(PACE_KEY,got=>{
        const n=Number(got?.[PACE_KEY]);
        if(dead||!Number.isInteger(n)||n<0||n>=rooms[id].lever.paces.length)return;
        lever?.set(n,true);
        dock?.set(n,true);
        setPace(n,true);
      });
    }catch{}
  }
  // (4.2) a stop chosen anywhere else (Make it yours > Look: Speed, or the lever in another tab) moves this lever and the ride, eased
  // as under a hand; a stop this page chose itself is already where it goes (its travel's target is that stop's pace)
  if(rooms[id]?.lever){
    try{
      const paced=(changes,area)=>{
        if(dead||area!=='local'||!changes||!Object.hasOwn(changes,PACE_KEY))return;
        const list=rooms[id].lever.paces,n=Number(changes[PACE_KEY].newValue);
        if(!Number.isInteger(n)||n<0||n>=list.length||travelOf(travel).v1===list[n])return;
        lever?.set(n,true);
        dock?.set(n,true);
        setPace(n,false,false);
      };
      global.chrome?.storage?.onChanged?.addListener?.(paced);
      disposers.push(()=>{try{global.chrome?.storage?.onChanged?.removeListener?.(paced);}catch{}});
    }catch{}
  }
  // The land the dashboard wears (data-page-land: its kit of frames and its page's ground) from the first moment the scene is on,
  // not only once the land's page is laid, so the first cabin's floor and rugs never show while it loads: today's land by the clock
  // (or the look above); in Dark, for a land without a page and once the scene is gone, none.
  const landNow=()=>{const now=new global.Date();return landOfDay(look&&look.day!==null?look.day:now.getDay());};
  function wear(land){
    const want=rd.getAttribute('data-theme')!=='dark'&&land&&rooms[id]?.pages&&Object.hasOwn(rooms[id].pages,land)?land:'';
    if(want){if(rd.getAttribute('data-page-land')!==want)rd.setAttribute('data-page-land',want);}else if(rd.hasAttribute?.('data-page-land'))rd.removeAttribute('data-page-land');
  }
  function syncLight(env,view,swap,moving){
   const room=rooms[id];if(!room)return;
   let y=0,shown=false,paging=false,placed=false;
   try{
    const seen=env&&band?band.moment?.(env,view,swap):null,
      m=rd.getAttribute('data-theme')!=='dark'?seen:null,
      at=seen?.fit?rd.getBoundingClientRect?.():null,
      box=at?sky.getBoundingClientRect?.():null;
    // (the speed control lies on the laptop's screen at every hour, Dark too: wherever the band's picture lies)
    if(room.lever&&box&&box.height>0&&seen.fit.w>0){
     if(!lever){lever=roomLever(doc,base,room.lever,n=>{dock?.set(n,true);setPace(n);},root,rd);lever.set(notchOf(travel[0]),true);}
     // (in the wall's layer: after the band, before the page's things)
     if(lever.node.parentNode!==rd){if(typeof sky.after==='function'&&sky.parentNode===rd)sky.after(lever.node);else rd.append(lever.node);}
     lever.place({x:box.left-at.left+seen.fit.x,y:box.top-at.top+seen.fit.y,k:seen.fit.w/room.box[0]},rd.getAttribute('data-theme')==='dark'?'night':rd.getAttribute('data-band-stage')||'noon');placed=true;
     // (4.2.9) the same control within reach: the laptop is in the cabin, at the top of the page; once it has scrolled out of sight a
     // small copy of its screen stands in the window's lower left corner, laid over the page itself (the dashboard's root holds what
     // is fixed inside it to itself). Both move together.
     if(!dock){
       dock=roomLever(doc,base,room.lever,n=>{lever?.set(n,true);setPace(n);},root,rd,true);
       dock.set(lever.at,true);
       (typeof root?.append==='function'?root:rd).append(dock.node);
      if(typeof global.IntersectionObserver==='function'){
        try{dockWatch=new global.IntersectionObserver(list=>{for(const e of list)dock?.away(!e.isIntersecting);});dockWatch.observe(lever.node);}catch{dockWatch=null;}
      }}
     dock.place({x:0,y:0,k:1.2},rd.getAttribute('data-theme')==='dark'?'night':rd.getAttribute('data-band-stage')||'noon');
    }
    const paged=m&&room.pages&&Object.hasOwn(room.pages,m.land)?room.pages[m.land]:null;
    if(paged&&box&&box.height>0&&m.fit.w>0){
     // (a land with a page of its own: its picture goes on under the band; no wooden floor, no window light on it)
     const k=m.fit.w/room.box[0],foot=box.bottom-at.top;
     if(!page)
       page=band.framed&&landPages[id]&&!pageFell?framePage(doc,base,origin,landPages[id],{fail:pageFail,painting:()=>{
         if(!dead)syncBand();
       }}):packaged(id)?roomPage(doc,base,(node,spec)=>band?.rider?.(node,spec?'rail':'',spec)):null;
     // (a land's own page lies under the band (its painter may draw the window's land too); the dashboard's own lies after it)
     if(page&&page.node.parentNode!==rd){
       if(page.framed&&typeof sky.before==='function'&&sky.parentNode===rd)
         sky.before(page.node);
       else if(typeof sky.after==='function'&&sky.parentNode===rd)sky.after(page.node);else rd.append(page.node);
     }
     page?.show(
       {x:box.left-at.left+m.fit.x,k,top:foot,deep:at.height,win:{x:box.left-at.left+m.fit.x,y:box.top-at.top+m.fit.y}},
       m.land,
       m.hours,
       paged,
       {
         moving:!!moving,
         route:travel,
         offset:band.since||0,
         most:Math.max(1,...(room.lever?.paces||[1])),
         since:band.since||0,
         timed:!!band.timed,
         still:!animated(),
         paint:PAINT&&['medium','high','xhigh'].includes(rd.getAttribute('data-graphics')||'high'),
         quality:{medium:1,high:2,xhigh:3}[rd.getAttribute('data-graphics')||'high']||2,
         level:rd.getAttribute('data-graphics')==='medium'?1:2
       });
     wear(m.land);
     light?.clear();paging=true;
    }else if(m&&box&&box.height>0&&m.fit.w>0){
     const k=m.fit.w/room.box[0],foot=box.bottom-at.top;y=Math.round(box.top-at.top+m.fit.y+room.floor*k);
     if(!light){light=roomLight(doc,base,room,(node,deg)=>band?.rider?.(node,deg===null?'':'lean',deg,room.sway));visibility?.observe(light.node);}
     if(light.node.parentNode!==rd){if(typeof sky.after==='function'&&sky.parentNode===rd)sky.after(light.node);else rd.append(light.node);}
     if(light.over.parentNode!==rd)rd.append(light.over);
     light.show(
       {
         x:box.left-at.left+m.fit.x,
         k,
         foot,
         deep:Math.max(0,at.height-(foot-76)),
         since:band.since||0,
         pace:room.lever?(r=>[r.v1,r.t0+r.T*1000+(band.since||0),r.xT])(travelOf(travel)):0
       },
       m.hours,
       band.shades?.(m.land,schedule)||[],
       !!moving);
     shown=true;
     // (Grades and Review open a room of their own over the page: the cabin's light is not laid over that picture)
     let scene=false;try{for(const layer of rd.querySelectorAll?.('.rd-roomlayer')||[]){if(!['spare','gone','leaving'].includes(layer.getAttribute?.('data-state'))){scene=true;break;}}}catch{scene=false;}
     if(!!light.over.hidden!==scene)light.over.hidden=scene;
    }
   }catch{shown=false;}
   if(!placed){lever?.hide();dock?.hide();}
   if(!paging&&page){if(page.framed){page.destroy();page=null;}else page.clear();}
   if(!paging&&rooms[id]?.pages)wear(landNow());
   if(!shown)light?.clear();
   if(y!==floorY){floorY=y;if(y)rd.style.setProperty?.('--tk-floor-y',y+'px');else rd.style.removeProperty?.('--tk-floor-y');}
  }
  // the band's one timer: it looks at the clock on each minute while the scene is on
  function tick(){const at=new global.Date();minute=global.setTimeout(()=>{minute=0;if(dead)return;syncBand();tick();},60500-(at.getSeconds()*1000+at.getMilliseconds()));}
  // ---- every scene
  function hidden(){
   if(doc.hidden||doc.visibilityState==='hidden'||rd.isConnected===false||!intersecting)return true;
   for(let el=rd;el;el=el.parentElement||(el===root.host?null:el.getRootNode?.()?.host)){
    if(el.hidden||el.getAttribute?.('aria-hidden')==='true')return true;
    const style=global.getComputedStyle?.(el);if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse')return true;
   }
   // A shadow root is not a parentElement. Always check its host and ancestors.
   for(let el=root.host;el;el=el.parentElement){
    if(el.hidden||el.getAttribute?.('aria-hidden')==='true')return true;
    const style=global.getComputedStyle?.(el);if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse')return true;
   }
   return false;
  }
  function restoreLens(el){
   const before=lens.get(el);if(!before)return;
   if(before.value)el.style.setProperty('--lens',before.value,before.priority);else el.style.removeProperty('--lens');
   lens.delete(el);
  }
  function clearLens(){for(const el of lens.keys())restoreLens(el);}
  function syncMedia(){
   if(dead)return;
   // the sky also rests while it is scrolled out of view (the frames' stars keep drawing; they are on the page)
   const motion=animated(),rest=rd.hasAttribute?.('data-art-rest'),invisible=hidden(),paused=!motion||invisible||!skyInView||rest;
   const pauseDrawing=!motion||invisible||rest;
   invisibleState=invisible;drawingPaused=!!pauseDrawing;
   if(pauseDrawing&&!rd.hasAttribute('data-scene-paused'))rd.setAttribute('data-scene-paused','');
   else if(!pauseDrawing&&rd.hasAttribute('data-scene-paused'))rd.removeAttribute('data-scene-paused');
   if(banded){syncStyle();syncBand();}
   else{
    media.hidden=paused;poster.hidden=!paused;
    if(id==='stars'){
     if(!paused&&!skyAnimator){skyAnimator=starSky(media,doc,global);skyAnimator?.resize();}
     skyAnimator?.pause(paused);
     if(!skyAnimator){media.hidden=true;poster.hidden=false;}
    }else{
     media.autoplay=!paused;
     if(!paused&&!mediaSource){mediaSource=base+'sky.mp4';media.setAttribute('src',mediaSource);media.preload='metadata';}
     if(!paused&&!playing){playing=true;const started=media.play();started?.catch?.(()=>{playing=false;media.hidden=true;poster.hidden=false;});}
     else if(paused){media.pause();playing=false;}
    }
   }
   if(paused){point=null;if(raf){global.cancelAnimationFrame(raf);raf=0;}clearLens();frames?.pause();}
   frames?.dirty();
  }
  function sync(){
   if(dead)return;
   if(link.parentNode!==root)root.append(link);
   if(style&&style.parentNode!==root)root.append(style);
   if(rd.getAttribute('data-theme-kit')!==id)rd.dataset.themeKit=id;
   // (a room's land is worn in the same task as the theme, so its kit is there from the first frame)
   if(rooms[id]?.pages&&!rd.hasAttribute('data-page-land'))wear(landNow());
   if(sheetReady&&!rd.hasAttribute('data-theme-kit-ready'))rd.setAttribute('data-theme-kit-ready','');
   restMirror();
   // put back only when it is gone: moving a frame reloads it (and its whole sky)
   if(sky.parentNode!==rd){rd.prepend(sky);skyAnimator?.resize();}
   measureBand();
   if(frames){if(frames.canvas.parentNode!==rd)rd.append(frames.canvas);frames.dirty();}
   const arts=[...rd.querySelectorAll('.rd-rail-art')],present=new Set(arts);
   for(const [art,icon]of icons)if(!present.has(art)){icon.remove();icons.delete(art);}
   arts.forEach((art,index)=>{
    const motif=motifs[id][index%6];let icon=icons.get(art);
    if(!icon){icon=doc.createElement('img');icon.className='tk-icon';icon.alt='';icons.set(art,icon);}
    if(icon.dataset.motif!==motif){icon.dataset.motif=motif;icon.setAttribute('src',base+'icon-'+motif+'.png');}
    if(icon.parentNode!==art)art.append(icon);
   });
   // the small drawings elsewhere (an empty state's picture, a module's badge) wear the theme's pictures too: the theme's
   // showpiece for an empty state, the others in turn; the drawing itself stays, hidden while the theme is on
   const smalls=[...rd.querySelectorAll('svg.rd-mini')].filter(svg=>!svg.closest('.rd-rail-art')),keep=new Set(smalls);
   for(const [svg,icon]of minis)if(!keep.has(svg)){icon.remove();minis.delete(svg);}
   smalls.forEach((svg,index)=>{
    const empty=!!svg.closest('.rd-empty-art'),motif=motifs[id][empty?2:(index+3)%6];let icon=minis.get(svg);
    if(!icon){icon=doc.createElement('img');icon.className='tk-icon tk-mini';icon.alt='';minis.set(svg,icon);}
    if(icon.dataset.motif!==motif){icon.dataset.motif=motif;icon.setAttribute('src',base+'icon-'+motif+'.png');}
    const box=svg.getBoundingClientRect?.();if(box?.width){icon.style.width=box.width+'px';icon.style.height=box.height+'px';}
    if(icon.nextSibling!==svg)svg.before(icon);
   });
   for(const el of lens.keys())if(!rd.contains(el))restoreLens(el);
   syncMedia();
  }
  function schedule(){if(dead)return;global.clearTimeout(timer);timer=global.setTimeout(()=>{timer=0;sync();},60);}
  // The idle rest (data-art-rest on the root, motion.js) pauses the scene's loops through data-kit-rest, which only a scene
  // writes (scene-themes.css): a rule keyed on data-art-rest itself restyled the whole dashboard each time the rest started
  // or ended, with or without a scene. Mirrored as the root changes (the observer runs before the next frame, so the pause
  // lands in the same frame as before) and on every sync (a scene applied while the page rests).
  function restMirror(){
    if(dead)return;
    const on=!!rd.hasAttribute?.('data-art-rest');
    if(on!==!!rd.hasAttribute?.('data-kit-rest')){if(on)rd.setAttribute('data-kit-rest','');else rd.removeAttribute('data-kit-rest');}
  }
  function bend(){
   raf=0;if(dead||!point||drawingPaused||doc.hidden||!intersecting)return;
   const {x:px,y:py}=point,r=sky.getBoundingClientRect();
   const x=r.width?(px-r.left)/r.width:0,y=r.height?(py-r.top)/r.height:0;
   skyAnimator?.aim(Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y)),!!r.width&&!!r.height&&x>=0&&x<=1&&y>=0&&y<=.82);
   // the frames' stars bend one by one (starFrames), only while the pointer is over the dashboard
   const box=rd.getBoundingClientRect();frames?.aim(px,py,px>=box.left&&px<=box.right&&py>=box.top&&py<=box.bottom);
  }
  function pointer(event){if(dead||drawingPaused)return;point={x:event.clientX,y:event.clientY};if(!raf)raf=global.requestAnimationFrame(bend);}
  function leave(){if(dead||drawingPaused)return;point={x:-1e4,y:-1e4};if(!raf)raf=global.requestAnimationFrame(bend);}
  function onMotionChange(){syncMedia();}
  listen(doc,'visibilitychange',syncMedia);
  if(banded)listen(doc,'visibilitychange',()=>{if(!doc.hidden)mend(700);});
  listen(global,'pagehide',()=>remove(rd));
  if(reduced?.addEventListener)listen(reduced,'change',onMotionChange);
  if(id==='stars'){
   listen(global,'pointermove',pointer,{passive:true});listen(doc.documentElement,'pointerleave',leave);
   if(frames){
     const redraw=()=>frames.dirty();
     listen(doc,'scroll',redraw,{capture:true,passive:true});
     listen(root,'scroll',redraw,{capture:true,passive:true});
     listen(global,'resize',()=>{redraw();skyAnimator?.resize();},{passive:true});
   }
  }
  const observer=typeof global.MutationObserver==='function'?new global.MutationObserver(()=>{restMirror();schedule();}):null;
  observer?.observe(root,{childList:true,subtree:true});
  observer?.observe(rd,{attributes:true,attributeFilter:['data-motion-style','hidden','class','style','data-art-rest',...(banded?['data-theme','data-graphics']:[])]});
  // Size observers cover reflow; class/style changes can move a frame without changing its size.
  const layout=frames&&typeof global.MutationObserver==='function'?new global.MutationObserver(changes=>{
    if(changes.some(change=>!change.target?.closest?.('.tk-sky, .tk-icon, .tk-starframes')))frames.dirty();
  }):null;
  layout?.observe(root,{attributes:true,subtree:true,attributeFilter:['class','style','hidden']});
  if(frames){listen(root,'transitionend',()=>frames.dirty(),true);listen(root,'animationend',()=>frames.dirty(),true);}
  const watched=new Set();
  for(const start of [rd.parentElement,root.host])
    for(let el=start;el;el=el.parentElement){if(watched.has(el))continue;watched.add(el);observer?.observe(el,{attributes:true,attributeFilter:['hidden','style','class','aria-hidden']});}
  // A wider or narrower window moves the widgets without changing the page's elements: measure the band again.
  listen(global,'resize',schedule,{passive:true});
  const visibility=typeof global.IntersectionObserver==='function'?new global.IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.target===rd)
        intersecting=entry.isIntersecting;
      else if(entry.target===sky)skyInView=entry.isIntersecting;else if(light&&entry.target===light.node)lightInView=entry.isIntersecting;
    }
    syncMedia();
  }):null;
  visibility?.observe(rd);visibility?.observe(sky);
  const skySize=id==='stars'&&typeof global.ResizeObserver==='function'?new global.ResizeObserver(()=>skyAnimator?.resize()):null;skySize?.observe(sky);
  active={root,rd,id,gateArgs:{root,rd,opts},update(next){options=next;sync();},destroy(){
   dead=true;
   observer?.disconnect();
   layout?.disconnect();
   visibility?.disconnect();
   skySize?.disconnect();
   global.clearTimeout(timer);
   if(minute)global.clearTimeout(minute);
   minute=0;
   if(raf)global.cancelAnimationFrame(raf);
   for(const dispose of disposers)dispose();clearLens();frames?.destroy();
   if(banded){
    band?.destroy();band=null;light?.clear();light=null;
    if(page?.framed)page.destroy();else page?.clear();
    page=null;lever?.clear();lever=null;dock?.clear();dock=null;try{dockWatch?.disconnect();}catch{}dockWatch=null;
    rd.removeAttribute?.('data-page-land');rd.removeAttribute('data-band-stage');
    if(floorY){floorY=0;rd.style.removeProperty?.('--tk-floor-y');}
    style?.remove();
   }
   if(id==='stars')skyAnimator?.destroy();else if(media){media.pause();media.removeAttribute('src');media.load?.();}
   rd.removeAttribute('data-theme-kit-ready');
   link.remove();
   sky.remove();
   for(const icon of icons.values())icon.remove();
   icons.clear();
   for(const icon of minis.values())icon.remove();
   minis.clear();
   rd.removeAttribute('data-kit-rest');
   if(previousKit===null)rd.removeAttribute('data-theme-kit');else rd.setAttribute('data-theme-kit',previousKit);
   if(previousPause)rd.setAttribute('data-scene-paused','');else rd.removeAttribute('data-scene-paused');
  }};
  sync();
  if(banded&&!dead)tick();
 }
 // a scene's band in its own words (Soul Passage), for the tests and the checker; null for a scene with a video sky
 const band=id=>Object.hasOwn(bands,id)?bands[id]:null;
 // the band of a scene laid in this document (the band's own page, themes/<id>/band.html, calls this)
 // (the lands with a life of their own: live-<land>.json in the scene's folder, named by the land's own page entry)
 const livedOf=id=>new Set(Object.entries(rooms[id]?.pages||{}).flatMap(([land,info])=>[...(info?.live?[land]:[]),...(info?.sun?['sun:'+land]:[])]));
 const bandHere=(doc,base,id,on)=>Object.hasOwn(bands,id)?skyBand(doc,base,bands[id],on||{},rides[id],livedOf(id)):null;
 const api={apply,remove,names,createStarSky:starSky};api.band=band;api.bandHere=bandHere;api.pageHere=pageHere;
 // the train's speed (engine 2), for the land's painter, the tests and the checker: a travel from its numbers, where it is at a moment,
 // a new choice from a moment, the ride's loop rate at a speed, the bounds
 api.travel=Object.freeze({of:travelOf,at:travelAt,to:travelTo,rate:rideRate,bounds:TRAVEL,blur:blurOf});
 // a land's own life read from its file (null: drawn as before), a ride of its own (tests and the checker), the reader of a scene's
 // files, and where a megapack stands on this machine
 api.liveOf=liveOf;
 api.sunOf=sunOf;
 api.reader=reader;
 api.megapack=megapackState;
 api.megapacks=MEGAPACK;
 api.rideOf=(doc,base,file,lived)=>bandRide(doc,base,file,new Set(lived||[]));
 global.ReserveSceneThemes=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
