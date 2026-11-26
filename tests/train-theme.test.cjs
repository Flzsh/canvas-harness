'use strict';
// Soul Passage (scene-themes.js bands.train, themes/train): your own cabin on a train that never stops. Its sky is a band
// in the band's own words (band-kit.js) that says which pictures show: the land outside for the student's weekday (one
// land a day since 4.2.2) under the cabin for the stage of the day, the stages cross-fading over 40
// minutes, the land changing at midnight. The scene draws those pictures as a band that travels (bandRide, ride.json):
// a land is a set of strips sliding at their own speeds, a cabin is its picture plus its loose things as pieces moved by
// one ride, every movement keyframes handed to element.animate. Only the pictures shown now are read.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// (public tree: Soul Passage's downloaded files are not in the package. onDisk: packaged or named by the Market's version 4;
// dataPath: a downloaded data file's copy beside the tests; pictures of the downloaded kind are not read here)
const MARKET4=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/megapack-soul-passage-4.json'),'utf8')).files.map(f=>f.name);
const onDisk=f=>require('node:fs').existsSync(require('node:path').join(__dirname,'../extension/themes/train',f))||MARKET4.includes(f);
const dataPath=(d,f)=>{const p=require('node:path'),own=p.join(d,f);return require('node:fs').existsSync(own)?own:p.join(__dirname,'fixtures/megapack-train-data',f);};
const {createDOM,read}=require('./addons-fixture.cjs');
const K=require('../extension/band-kit.js');
const ext=path.join(__dirname,'../extension'),dir=path.join(ext,'themes/train'),RIDE_FILE=JSON.parse(fs.readFileSync(path.join(dir,'ride.json'),'utf8'));
// (4.2: Soul Passage is a megapack. Its pictures and data of the downloaded kind are not in the package: the Market lists them, each by its
// name, size and SHA-256 (tests/fixtures/megapack-soul-passage-4.json is a copy of megapacks/soul-passage/4.json))
const MARKET=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/megapack-soul-passage-4.json'),'utf8')),DOWNLOADED=MARKET.files.map(f=>f.name);
// (the public source is spread over lines: a table is read from it with the line breaks taken out)
const DENSE=()=>read('scene-themes.js').replace(/\n[ \t]*/g,'');
// (the lands' own data, of the downloaded kind, as the tests read it: the Market's files, copied beside the tests)
const DATA=path.join(__dirname,'fixtures/megapack-train-data'),dataFile=file=>fs.readFileSync(fs.existsSync(path.join(dir,file))?path.join(dir,file):path.join(DATA,file),'utf8');
// (the tests' own world: the shipped ride, with Thursday's glass city as the land that travels past in strips, as every land did in
// 4.0.165 and the deep sea did here until it left in 4.2.2; see PAGED)
const CLASSIC={"stars":false,"layers":[{"speed":0.0,"still":true},{"speed":1.2,"still":false},{"speed":3.0,"still":false},{"speed":8.0,"still":false},{"speed":20.0,"still":false},{"speed":120.0,"still":false}],"shade":[{"file":"shade-metro-0","speed":120.0},{"file":"shade-metro-1","speed":20.0},{"file":"shade-metro-2","speed":8.0}]};
const RIDE={...RIDE_FILE,lands:{...RIDE_FILE.lands,metro:CLASSIC}};
// Sunday first, as the clock counts (Date.getDay): Monday .. Sunday are sea, peaks, clouds, the glass city, citadel, mesa, grove
// (until 4.2.2 Thursday was the deep sea in odd weeks of the year; it is gone, and no land takes turns by the week)
const WEEK=['grove','sea','peaks','clouds','metro','citadel','mesa'],landOf=day=>WEEK[day];
const LANDS=['grove','sea','peaks','clouds','citadel','mesa','metro'],STAGES=['morning','noon','sunset','dusk','night'],MOTIFS=['cat','kettle','lamp','mug','plant','bear'];
const strips=(land,stage,ride=RIDE)=>(ride.lands?.[land]?.layers||[]).map((layer,i)=>'land-'+land+'-'+stage+'-'+i+'.webp');
// the files one picture of the band is made of: a land's strips, or a cabin and its sheet of pieces
const filesOf=id=>{const m=/^land-([a-z]+)-([a-z]+)$/.exec(id);return m?strips(m[1],m[2],RIDE_FILE):['cabin-'+id.slice(6)+'.webp','pieces-'+id.slice(6)+'.webp'];};
const pictureOf=file=>{const land=/^(land-[a-z]+-[a-z]+)-\d+\.webp$/.exec(file),cabin=/^(?:cabin|pieces)-((?:[a-z]+-)?[a-z]+)\.webp$/.exec(file);return land?land[1]:cabin?'cabin-'+cabin[1]:file.startsWith('shade-')?'shade':file;};
const SHADES=LANDS.flatMap(land=>(RIDE_FILE.lands?.[land]?.shade||[]).map(s=>s.file+'.png'));
// (4.0.178) The first cabin's room under the band (its floor boards, the cloth rugs, mats, pads, chips, label, patches and rings, and
// the light card and panel they covered) is gone from the package: every land wears its own kit from the first moment, so those
// pictures only ever showed as a flash while the scene loaded. Its pieces' sizes stay the kits' sizes.
const OLD_ROOM=['floor-top.png','floor-tile.png','rug-peri.png','rug-rose.png','rug-gold.png','rug-runner.png','mat-peri.png','mat-rose.png','mat-gold.png','mat-sage.png',
 'pad-peri.png','pad-rose.png','pad-gold.png','pad-sage.png','chip-peri.png','chip-rose.png','chip-gold.png','chip-sage.png','chip-teal.png','label.png',
 'patch-sel.png','patch-hover.png','ring.png','ring-on.png','train-card.png','train-panel.png'];
const PIECE_SIZE={'rug-peri':[640,768],'rug-rose':[640,768],'rug-gold':[640,768],'rug-runner':[768,640],'mat-peri':[288,144],'mat-rose':[288,144],'mat-gold':[288,144],'mat-sage':[288,144],'ring':[56,56],'ring-on':[56,56]};
// A land with a page of its own (scene-themes.js rooms.train.pages): under the room its sky stands still (page-<land>-<stage>.webp,
// 3072 x 1304: three quarters of the band's pixels) and its layers travel over it (pages.move: [n, speed] -> page-<land>-<stage>-<n>.webp:
// 1 the far land, 2 the near land, 3 our own bridge close up), the window shows the same land layers as strips at the same speeds, and
// the frames are that land's own (kit-<land>-<piece>.png, each the size of the cloth piece it stands in for). A land without `move`
// is one still picture yet.
const PAGED_FILE=JSON.parse(/train:Object\.freeze\(\{\s*pages:(\{[\s\S]*?\}),\s*box:/.exec(fs.readFileSync(path.join(ext,'scene-themes.js'),'utf8'))[1]);
// (the tests' world: no page for Thursday's glass city, so the strips, floor and shadows of a land without a page are tested; the
// engine the fixture runs is told the same. A test may give the engine a table of its own: fixture({paged}))
const PAGED=Object.fromEntries(Object.entries(PAGED_FILE).filter(([land])=>land!=='metro'));
const worldSource=(paged=PAGED)=>read('scene-themes.js').replace(/(train:Object\.freeze\(\{\s*pages:)(\{[\s\S]*?\})(,\s*box:)/,(m,a,b,c)=>a+JSON.stringify(paged)+c);
const PIECES=['rug-peri','rug-rose','rug-gold','rug-runner','mat-peri','mat-rose','mat-gold','mat-sage','pad-peri','pad-sage','pad-rose','pad-gold','chip-teal','chip-peri','chip-rose','chip-gold','chip-sage','label','patch-hover','patch-sel','ring','ring-on'];
const PAGEFILES=Object.entries(PAGED_FILE).flatMap(([land,info])=>STAGES.filter(stage=>!info.stages?.[stage]).flatMap(stage=>['page-'+land+'-'+stage+'.webp',...(info.move||[]).map(m=>'page-'+land+'-'+stage+'-'+m[0]+'.webp')])),KITFILES=Object.keys(PAGED_FILE).flatMap(land=>[...PIECES.map(piece=>'kit-'+land+'-'+piece+'.png'),'kit-'+land+'-lamp.png']);   // (4.0.174: a land's kit has its lamp too, hung in a course card's icon column)
// (engine 2: what a land's table entry names beside its layers: its live and sun files, flow maps, glow maps, sprite sheets, underside)
const EXTRAS=Object.entries(PAGED_FILE).flatMap(([land,info])=>[...(info.live?['live-'+land+'.json']:[]),...(info.sun?['sun-'+land+'.json']:[]),...(info.under?['under-'+land+'.webp']:[]),...(info.flow||[]).map(n=>'flow-'+land+'-'+n+'.webp'),...Object.entries(info.glow||{}).flatMap(([stage,ns])=>ns.map(n=>'glow-'+land+'-'+stage+'-'+n+'.webp')),...(info.sprites===1?['sprites-'+land+'.webp']:info.sprites===2?STAGES.filter(stage=>!info.stages?.[stage]).map(stage=>'sprites-'+land+'-'+stage+'.webp'):[]),/* (4.2.6) a layer's lights: its picture with every light in its other state and the map of the lights, at every hour that has them (a noon with no lit window has none; tests/train-lights.test.cjs holds that they come in pairs, at three hours or more); a sky without its drifting clouds */...(info.lights||[]).flatMap(n=>STAGES.filter(stage=>!info.stages?.[stage]&&onDisk('ids-'+land+'-'+stage+'-'+n+'.webp')).flatMap(stage=>['alt-'+land+'-'+stage+'-'+n+'.webp','ids-'+land+'-'+stage+'-'+n+'.webp'])),...(info.clear?STAGES.filter(stage=>!info.stages?.[stage]).map(stage=>'clear-'+land+'-'+stage+'.webp'):[])]);
// (a land may have a cabin of its own, the same room in that land's light: patch_cabins.py; OWN_CABINS in scene-themes.js names them)
const OWN_CABINS=JSON.parse(/OWN_CABINS=Object\.freeze\((\[[^\]]*\])\)/.exec(fs.readFileSync(path.join(__dirname,'../extension/scene-themes.js'),'utf8'))[1].replace(/'/g,'"'));
const cab=(land,stage)=>OWN_CABINS.includes(land)?'cabin-'+land+'-'+stage:'cabin-'+stage,cabFiles=(land,stage)=>{const o=OWN_CABINS.includes(land)?land+'-':'';return ['cabin-'+o+stage+'.webp','pieces-'+o+stage+'.webp'];};
const KIT=[...LANDS.flatMap(land=>STAGES.flatMap(stage=>strips(land,stage,RIDE_FILE))),...STAGES.flatMap(stage=>['cabin-'+stage+'.webp','pieces-'+stage+'.webp']),...OWN_CABINS.flatMap(land=>STAGES.flatMap(stage=>cabFiles(land,stage))),...SHADES,'ride.json','band.html','band.js','page.html','page.js','painter.js','poster.jpg','theme.css','train-card-dark.png','train-panel-dark.png',...MOTIFS.map(m=>'icon-'+m+'.png'),...PAGEFILES,...KITFILES,...EXTRAS,'lever.webp','under.webp'];
const KINDS=['bend','rot','lift','slide'],DRIVES=['hang','stand'];
const scenes=()=>{const env=vm.createContext({});vm.runInContext(read('scene-themes.js'),env,{filename:'scene-themes.js'});return env.ReserveSceneThemes;};
const hooks={picture:value=>({asset:value.asset}),image:()=>true};
const cleaned=()=>K.clean(scenes().band('train'),hooks);
let words=null;const banded=()=>words||(words=cleaned().band);
// what the band shows at a moment: [picture, presence]
const at=(day,hour,week=46)=>K.resolve(banded(),{mode:'light',day,hour,month:11,week,ratio:6}).pieces.map(piece=>[piece.draw[0].asset,piece.presence??1]);
const hm=text=>{const [h,m]=text.split(':').map(Number);return h+m/60;};
// the scene's objects come from another realm (vm): compared as plain data
const copy=value=>JSON.parse(JSON.stringify(value));
// every number a keyframe gives (inside a transform's or a filter's brackets, or an opacity), its offset left aside
const numbers=frame=>Object.entries(frame).filter(([key])=>key!=='offset'&&key!=='easing').flatMap(([,value])=>typeof value==='number'?[value]:[...String(value).matchAll(/\(([^)]*)\)/g)].flatMap(m=>m[1].split(',').map(part=>Number(part.trim().replace(/(px|deg)$/,'')))));
function size(file){
 const b=fs.readFileSync(path.join(dir,file));
 if(file.endsWith('.png'))return [b.readUInt32BE(16),b.readUInt32BE(20)];
 if(file.endsWith('.jpg')){for(let i=2;i<b.length;){const marker=b[i+1],length=b.readUInt16BE(i+2);if(marker>=0xC0&&marker<=0xC2)return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];i+=2+length;}return null;}
 const tag=b.toString('latin1',12,16);assert.equal(b.toString('latin1',0,4)+b.toString('latin1',8,12),'RIFFWEBP',file);
 if(tag==='VP8X')return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];if(tag==='VP8 ')return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 const v=b.readUInt32LE(21);return [(v&0x3fff)+1,((v>>14)&0x3fff)+1];
}

test('Soul Passage is registered like the other built-in scenes; its kit is split between the package and the Market',()=>{
 // (the shipped files as they are, not the tests' world)
 const RIDE=RIDE_FILE,PAGED=PAGED_FILE;
 // the package holds what Canvas's own page shows and the code; the frames' pictures and the lands' data come from the Market
 const PACKAGED=KIT.filter(file=>!DOWNLOADED.includes(file));
 assert.deepEqual([...KIT].sort(),[...new Set([...PACKAGED,...DOWNLOADED])].sort(),'the kit is the package and the Market\'s files together');
 assert.equal(DOWNLOADED.length,398);assert.equal(PACKAGED.length,178);
 assert.deepEqual(fs.readdirSync(dir).sort(),[...PACKAGED].sort(),'the folder holds the packaged kit and nothing else');
 for(const file of DOWNLOADED)assert.ok(require('../extension/scene-themes.js').megapacks.train.kind.test(file),file+' is of the downloaded kind');
 for(const file of PACKAGED)assert.ok(!require('../extension/scene-themes.js').megapacks.train.kind.test(file),file+' is of the packaged kind');
 // a land's strips are the band's top half, 4096 x 256 (their sizes are the Market's to check); a still sky may be a narrow strip
 for(const land of LANDS)for(const stage of STAGES)RIDE.lands[land].layers.forEach((layer,i)=>assert.ok(DOWNLOADED.includes('land-'+land+'-'+stage+'-'+i+'.webp'),land+' '+stage+' '+i));
 for(const stage of STAGES){assert.ok(DOWNLOADED.includes('cabin-'+stage+'.webp'));assert.ok(DOWNLOADED.includes('pieces-'+stage+'.webp'));}
 for(const land of OWN_CABINS)for(const stage of STAGES){const [c,p]=cabFiles(land,stage);assert.ok(DOWNLOADED.includes(c),c);assert.ok(DOWNLOADED.includes(p),p+': a land\'s own cabin comes with the Market (its sizes are the Market\'s to check)');}
 for(const file of SHADES)assert.ok(DOWNLOADED.includes(file),file);
 assert.deepEqual(size('train-card-dark.png'),[200,200]);/* (the light card and panel are gone: 4.0.178) */assert.deepEqual(size('train-panel-dark.png'),[360,360]);
 for(const file of PAGEFILES)assert.ok(DOWNLOADED.includes(file),file+': the page from under the room to its foot');
 assert.deepEqual(size('lever.webp'),[1200,300],'the speed control: five hours side by side; the screen, what is lit on it, its knob');
 assert.ok(DOWNLOADED.includes('under.webp'),'the carriage\'s underside');
 for(const land of Object.keys(PAGED))for(const piece of PIECES)assert.deepEqual(size('kit-'+land+'-'+piece+'.png'),PIECE_SIZE[piece]||[128,128],land+'\'s '+piece+' is the size of the cloth one');
 for(const file of OLD_ROOM)assert.ok(!fs.existsSync(path.join(dir,file)),'the first cabin\'s '+file+' is gone');
 for(const land of Object.keys(PAGED))assert.deepEqual(size('kit-'+land+'-lamp.png'),[96,112],land+'\'s lamp: 48 x 56 on the page');
 for(const m of MOTIFS)assert.deepEqual(size('icon-'+m+'.png'),[112,112],m);const [w,h]=size('poster.jpg');assert.equal(Math.round(w/h),8,'the poster is 8:1');
 // Canvas's page may load every packaged file but the scripts (they run only inside the scene's own pages); the scene feature owns them all
 const manifest=JSON.parse(read('manifest.json')),assets=require('../extension/features.js').catalogue.find(f=>f.id==='scene-themes').files.assets;
 for(const entry of manifest.web_accessible_resources){const listed=entry.resources.filter(file=>file.startsWith('themes/train/'));assert.deepEqual([...listed].sort(),PACKAGED.filter(file=>!file.endsWith('.js')).map(file=>'themes/train/'+file).sort(),entry.matches.join(' '));}
 assert.deepEqual(assets.filter(file=>file.startsWith('themes/train/')).sort(),PACKAGED.map(file=>'themes/train/'+file).sort(),'the scene feature owns the packaged files and nothing that is downloaded');
 const refs=[...new Set([...read('themes/train/theme.css').matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)].map(m=>m[2]))].sort();
 assert.deepEqual(refs,[...KITFILES,'train-card-dark.png','train-panel-dark.png'].sort(),'every paged land\'s own frames, and cards and panels in brass after dark; none of the first cabin\'s pictures');
 for(const file of refs)assert.ok(PACKAGED.includes(file),'Canvas\'s page reads '+file+' from the package');
 // (the tests' copy of the lands' data is the Market's, byte for byte)
 for(const file of fs.readdirSync(DATA))assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(DATA,file))).digest('hex'),MARKET.files.find(f=>f.name===file)?.sha256,file);
 // a valid setting, a built-in look, a scene in every public list, named Soul Passage
 assert.ok(require('../extension/customization-model.js').enums.sceneTheme.includes('train'));
 const lists=['customize-ui.js','customization-model.js','dashboard-view.js','dashboard.js','page-preferences.js','biscuit-parse.js'];
 for(const file of lists){
  const source=read(file),arrays=[...source.matchAll(/'starry','sea','stars','blueprint','maple','thanksgiving','christmas'(,'train')?\]/g)],names=[...source.matchAll(/thanksgiving:'Thanksgiving',christmas:'Christmas'(,train:'Soul Passage')?\}/g)];
  assert.ok(arrays.length+names.length,file+' lists the scenes');
  for(const m of arrays)assert.equal(m[1],",'train'",file+' lists Soul Passage (the scene train) with the others');for(const m of names)assert.equal(m[1],",train:'Soul Passage'",file+' names it');
 }
 assert.equal(require('../extension/scene-themes.js').names.train,'Soul Passage');
 // (4.2) a megapack: under its own heading after the Everyday pack, its packaged poster and its name, no description
 const ui=read('customize-ui.js');assert.match(ui,/\['blueprint','Blueprint','',poster\('blueprint'\)\],\s*(?:\/\/[^\n]*\n\s*)?\{head:'Megapack'\},\s*megaChoice\(\)\s*\]/,'under Megapack, out of the Everyday pack');assert.match(ui,/return \['train','Soul Passage','',poster\('train'\)\];/,'an ordinary choice when here, no description');
 assert.match(read('biscuit-controls.js'),/\['Thanksgiving','thanksgiving'\],\['Christmas','christmas'\],\['Soul Passage','train'\]\]/,'a choice when Biscuit asks which scene');
 // (shown as Soul Passage: the page titles say so, and nothing a person reads says Train Cabin or Window Seat)
 assert.match(read('themes/train/band.html'),/<title>Soul Passage band<\/title>/);assert.match(read('themes/train/page.html'),/<title>Soul Passage land<\/title>/);
 for(const file of lists)assert.doesNotMatch(read(file).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,''),/'(?:Train Cabin|Window Seat)'/,file+' no longer shows an old name');
 // nothing names it before the student does
 assert.equal(require('../extension/customization-model.js').defaults.sceneTheme,'');
});

test('ride.json is well formed: every land has its strips, every piece sits in the cabin and on the sheet, every drive is known',()=>{
 // (the shipped file as it is, not the tests' world)
 const RIDE=RIDE_FILE,PAGED=PAGED_FILE,strips=(land,stage)=>(RIDE_FILE.lands?.[land]?.layers||[]).map((layer,i)=>'land-'+land+'-'+stage+'-'+i+'.webp');
 assert.deepEqual(RIDE.box,[4096,512],'the ride is laid in the band\'s own pixels');assert.deepEqual(RIDE.stages,STAGES);
 assert.deepEqual(Object.keys(RIDE.lands).sort(),[...LANDS].sort(),'seven lands');
 assert.ok(RIDE.ride.loop>0&&Number.isFinite(RIDE.ride.loop),'one loop of the ride');assert.ok(Number.isInteger(RIDE.ride.seed));
 assert.ok(RIDE.ride.gap.length===2&&RIDE.ride.gap[0]>0&&RIDE.ride.gap[0]<=RIDE.ride.gap[1],'rail joints come apart');
 for(const sway of RIDE.ride.sway)assert.ok(sway.length===3&&sway.every(Number.isFinite),String(sway));
 for(const land of LANDS){
  const {layers,shade}=RIDE.lands[land];
  if(PAGED[land]){
   // a land with a page of its own: one still view in the window, no floor under the room so no shadows on it; a stage it has no
   // picture for is stood in for by one it has, and every stage it has names the colour the page runs on with
   // (and its layers, if it travels: the far land and the near land in the window at the speeds the page names, one picture to a
   // turn, what is nearer going by faster; our bridge passes under the room only, and since 4.0.168 it travels WITH the near land:
   // its supports stand in that land, so they may not slide over it (owner, 2026-11-16: "fix the rail speed and background scenery
   // and make sure these are synced"; at 1800 px a second against the land's 30 it smeared into see-through bands))
   const move=PAGED[land].move||[];
   for(const [n,speed] of move)assert.ok(Number.isInteger(n)&&n>=1&&n<=9&&speed>0,land+': layer '+n);
   assert.ok(move.every((m,i)=>!i||(m[0]>move[i-1][0]&&m[1]>move[i-1][1]&&(m[0]!==3||m[1]<=8*move[i-1][1]))),land+': what is nearer goes by faster; our bridge, nearest, at most 8 times the near land');
   // (a layer is in the window when its picture reaches the window: each strip there travels at its layer's page speed)
   const win=copy(layers),speedOf=new Map(move);assert.deepEqual(win[0],{speed:0,still:true},land+': the sky stands');assert.ok(win.length>=1&&win.length<=1+move.length,land+': '+win.length+' strips');
   win.slice(1).forEach((l,i)=>{const n=l.n??i+1;assert.deepEqual(l,{speed:speedOf.get(n),still:false,turn:4096,...(l.n!==undefined?{n}:{})},land+': window layer '+n+' travels at its page speed');});assert.deepEqual(copy(shade),[],land+': no shadows');
   for(const stage of STAGES)for(const file of strips(land,stage))assert.ok(DOWNLOADED.includes(file),file);
   const stand=PAGED[land].stages||{};for(const [stage,other] of Object.entries(stand))assert.ok(STAGES.includes(stage)&&STAGES.includes(other)&&!stand[other],land+': '+stage+' is stood in for by '+other);
   for(const stage of STAGES.filter(stage=>!stand[stage]))assert.match(PAGED[land].foot[stage],/^#[0-9a-f]{6}$/,land+' '+stage+': the colour of the page\'s foot');
   continue;
  }
  assert.ok(Array.isArray(layers)&&layers.length>=2,land+' has layers');
  layers.forEach((layer,i)=>{assert.equal(typeof layer.still,'boolean',land+' '+i);assert.ok(Number.isFinite(layer.speed)&&layer.speed>=0,land+' '+i);if(!layer.still)assert.ok(layer.speed>0,land+' '+i+' moves');});
  assert.equal(layers[0].still,true,land+': the sky stays');
  for(const stage of STAGES)for(const file of strips(land,stage))assert.ok(DOWNLOADED.includes(file),file);
  // the shadows on the floor: some of the land's nearest layers, each sliding at its layer's speed
  assert.ok(Array.isArray(shade)&&shade.length>0,land+' has shadows');
  for(const s of shade){assert.ok(DOWNLOADED.includes(s.file+'.png'),s.file);assert.ok(layers.some(layer=>!layer.still&&layer.speed===s.speed),s.file+' slides at a layer\'s speed');}
 }
 const [W,H]=RIDE.box,[AW,AH]=RIDE.sheet,names=new Set();assert.ok(RIDE.pieces.length>0);
 // a cut piece may reach 4 px over the cabin's edge (the soft rim of the cut)
 const RIM=4;
 RIDE.pieces.forEach((q,i)=>{
  const name=i+' '+q.n;assert.equal(typeof q.n,'string');assert.ok(!names.has(q.n),name+': names are unique');names.add(q.n);
  assert.ok(KINDS.includes(q.k),name+': kind '+q.k);
  for(const key of ['x','y','w','h','ax','ay','px','py','dt'])assert.ok(Number.isFinite(q[key]),name+': '+key);assert.ok(q.w>0&&q.h>0,name);
  assert.ok(q.x>=-RIM&&q.y>=-RIM&&q.x+q.w<=W+RIM&&q.y+q.h<=H+RIM,name+': its box lies in the cabin');
  assert.ok(q.ax>=0&&q.ay>=0&&q.ax+q.w<=AW&&q.ay+q.h<=AH,name+': its rectangle lies on the sheet');
  assert.ok(q.p===-1||Number.isInteger(q.p)&&q.p>=0&&q.p<i,name+': hangs from an earlier piece or none');
  assert.equal(typeof q.hang,'boolean',name);assert.ok(Array.isArray(q.d)&&q.d.length>0,name+' has a drive');
  for(const d of q.d){assert.ok(DRIVES.includes(d[0]),name+': drive '+d[0]);assert.equal(d.length,d[0]==='hang'?4:5,name);assert.ok(d.slice(1).every(Number.isFinite),name);assert.ok(d[1]>0&&d[2]>0&&d[2]<1,name+': a rate and a damping below 1');}
 });
 // the page's own things: steam, the record, the clocks' hands, the airscrew on a piece that exists, the sand in the hourglass
 const X=RIDE.extras;for(const s of X.steam)assert.ok([s.x,s.y].every(Number.isFinite));assert.ok(X.record.rx>0&&X.record.ry>0);for(const h of X.hands)assert.ok(h.r>0);
 assert.ok(names.has(X.prop.on),'the airscrew sits on '+X.prop.on);assert.ok(names.has('hourglass'),'the sand runs in the hourglass');assert.ok(X.floor.h>0&&Number.isFinite(X.floor.lean));
});

test('the band is plain band words: no notes, level 2, a keep box over the cabin\'s right half and words that read the picture',()=>{
 const {band,notes,needs}=cleaned();assert.deepEqual(notes,[]);assert.equal(needs.level,2);for(const use of ['when:days','variants'])assert.ok(needs.uses.includes(use),use);assert.ok(!needs.uses.includes('when:weeks'),'no land takes turns by the week (4.2.2)');
 assert.deepEqual(band.box,[4096,512]);assert.deepEqual(band.keep,{x:2000/4096,y:0,w:2096/4096,h:1});assert.equal(band.text,'auto');assert.equal(band.asset,'poster');
 assert.equal(band.variants.length,6,'the band is Sunday\'s; six variants name the other days');assert.deepEqual(band.variants.map(look=>look.when.days),[[1],[2],[3],[4],[5],[6]]);
 for(const look of [band,...band.variants]){assert.equal(look.pieces.length,10,'five lands and five cabins a day, Thursday too');assert.ok(look.pieces.length<=32);}
 // Thursday is one land like every other day (until 4.2.2 two took turns by the week of the year): the glass city, in every week
 for(const look of [band,...band.variants])for(const piece of look.pieces)assert.equal(piece.when.weeks,undefined,piece.draw[0].asset);
 assert.deepEqual([...new Set(band.variants[3].pieces.map(piece=>/^land-([a-z]+)-/.exec(piece.draw[0].asset)?.[1]).filter(Boolean))],['metro'],'Thursday: the glass city');
 // every picture the band can show is made of files of the kit: seven lands and the cabin in five stages, 40 pictures
 const pictures=new Set([band,...band.variants].flatMap(look=>look.pieces.map(piece=>piece.draw[0].asset)));assert.equal(pictures.size,35+5*OWN_CABINS.length+(OWN_CABINS.length<7?5:0));
 for(const id of pictures){const files=filesOf(id);assert.ok(files.length>=1,id);for(const file of files)assert.ok(KIT.includes(file),id+': '+file);}
 assert.equal(K.timed(band),true,'it looks at the clock');
});

test('the student\'s weekday picks the land, one a day in every week (Thursday the glass city); it changes at midnight without a fade',()=>{
 for(let day=0;day<7;day++)for(const week of [45,46])assert.deepEqual(at(day,12,week),[['land-'+landOf(day)+'-noon',1],[cab(landOf(day),'noon'),1]],'day '+day+', week '+week+': the week does not matter');
 assert.deepEqual(at(1,hm('23:59')),[['land-sea-night',1],[cab('sea','night'),1]],'Monday, a minute to midnight');
 assert.deepEqual(at(2,0),[['land-peaks-night',1],[cab('peaks','night'),1]],'Tuesday at midnight: the next land, the same cabin');
 assert.deepEqual(at(0,hm('23:50')),[['land-grove-night',1],[cab('grove','night'),1]]);assert.deepEqual(at(1,hm('00:30')),[['land-sea-night',1],[cab('sea','night'),1]],'Sunday night runs into Monday');
 assert.deepEqual(at(3,hm('23:59'),46),[['land-clouds-night',1],[cab('clouds','night'),1]]);assert.deepEqual(at(4,0,46),[['land-metro-night',1],[cab('metro','night'),1]],'Thursday of an even week: the glass city');
 assert.deepEqual(at(4,hm('23:59'),45),[['land-metro-night',1],[cab('metro','night'),1]],'Thursday of an odd week: the glass city too (the deep sea is gone)');assert.deepEqual(at(5,0,45),[['land-citadel-night',1],[cab('citadel','night'),1]]);
 // Thursday's land fades through the day like the others
 assert.deepEqual(at(4,hm('10:10'),45),[['land-metro-morning',1],['land-metro-noon',.5],[cab('metro','morning'),1],[cab('metro','noon'),.5]]);
 assert.deepEqual(at(4,hm('10:10'),46),[['land-metro-morning',1],['land-metro-noon',.5],[cab('metro','morning'),1],[cab('metro','noon'),.5]]);
 // the week of the student's own date (ISO 8601) no longer picks a land: odd or even, and across the end of a year of 53 weeks
 // (where the deep sea once came two Thursdays running), every Thursday is the glass city
 const thursday=date=>at(4,12,K.week(date))[0][0];
 for(const date of [new Date(2026,10,5),new Date(2026,10,12),new Date(2026,10,19),new Date(2026,11,31),new Date(2027,0,7),new Date(2027,0,14)])assert.equal(thursday(date),'land-metro-noon',date.toDateString());
});

test('the clock picks the stage, and neighbouring stages cross-fade over 40 minutes',()=>{
 const stage=(hour,name,day=3)=>assert.deepEqual(at(day,hour),[['land-clouds-'+name,1],[cab('clouds',name),1]],name+' at '+hour);
 stage(hm('06:00'),'morning');stage(hm('08:00'),'morning');stage(hm('11:10'),'noon');stage(12,'noon');stage(hm('15:40'),'sunset');stage(17,'sunset');stage(hm('19:40'),'dusk');stage(21,'dusk');stage(hm('23:40'),'night');stage(2,'night');stage(hm('04:20'),'night');stage(hm('05:40'),'morning');
 // the later stage comes in over the 40 minutes before its hour (on top), the earlier one leaves over the 40 after (under)
 assert.deepEqual(at(3,hm('09:50')),[['land-clouds-morning',1],[cab('clouds','morning'),1]],'the fade has not begun');
 assert.deepEqual(at(3,hm('10:10')),[['land-clouds-morning',1],['land-clouds-noon',.5],[cab('clouds','morning'),1],[cab('clouds','noon'),.5]]);
 assert.deepEqual(at(3,hm('10:30')),[['land-clouds-morning',1],['land-clouds-noon',1],[cab('clouds','morning'),1],[cab('clouds','noon'),1]],'noon is whole, on top');
 assert.deepEqual(at(3,hm('10:50')),[['land-clouds-morning',.5],['land-clouds-noon',1],[cab('clouds','morning'),.5],[cab('clouds','noon'),1]]);
 assert.deepEqual(at(3,hm('14:40')),[['land-clouds-noon',1],['land-clouds-sunset',.5],[cab('clouds','noon'),1],[cab('clouds','sunset'),.5]]);
 assert.deepEqual(at(3,hm('18:40')),[['land-clouds-sunset',1],['land-clouds-dusk',.5],[cab('clouds','sunset'),1],[cab('clouds','dusk'),.5]]);
 assert.deepEqual(at(3,hm('22:40')),[['land-clouds-dusk',1],['land-clouds-night',.5],[cab('clouds','dusk'),1],[cab('clouds','night'),.5]]);
 // night to morning: morning is listed under night, so it comes in unseen and night leaves over it
 assert.deepEqual(at(3,hm('04:40')),[['land-clouds-morning',.5],['land-clouds-night',1],[cab('clouds','morning'),.5],[cab('clouds','night'),1]]);
 assert.deepEqual(at(3,hm('05:20')),[['land-clouds-morning',1],['land-clouds-night',.5],[cab('clouds','morning'),1],[cab('clouds','night'),.5]]);
 assert.deepEqual(at(3,5),[['land-clouds-morning',1],['land-clouds-night',1],[cab('clouds','morning'),1],[cab('clouds','night'),1]],'05:00: morning is whole under night, which now leaves');
 // never more than two stages at once, so never more than four pictures
 for(let minute=0;minute<24*60;minute+=5)for(const day of [3,4])assert.ok(at(day,minute/60).length<=4,day+' '+minute);
});

// ---------------------------------------------------------------- the scene on a page
const settle=async()=>{for(let i=0;i<16;i++)await new Promise(setImmediate);};
function fixture({graphics='high',theme='light',missing=[],paint=()=>[200,190,180,255],ride=null,decode=true,now=()=>0,clock:start={},framed=false,paged=PAGED}={}){
 const document=createDOM('<html><body><div id="host"><div id="shadow"><main class="rd"><div class="rd-workspace-heading"><h1>Good afternoon</h1><p class="rd-heading-date">Wednesday</p></div><div class="rd-rail-course"><span class="rd-rail-art"><svg></svg></span><i class="rd-frame"></i></div></main></div></div></body></html>');
 const host=document.getElementById('host'),shadow=document.getElementById('shadow'),rd=shadow.querySelector('.rd');shadow.host=host;
 const proto=Object.getPrototypeOf(rd);if(!Object.getOwnPropertyDescriptor(proto,'lastChild'))Object.defineProperty(proto,'lastChild',{configurable:true,get(){return this.childNodes[this.childNodes.length-1]||null;}});
 // Thursday 5 November 2026, noon (ISO week 45: the glass city, in the tests' world the land that travels past in strips)
 const timers=new Map(),observers=[],intersections=[],windowEvents=new Map(),images=[],decodes=[],fetched=[],made=new Map(),revoked=new Set(),anims=[],frames=[],clock={year:2026,month:11,date:5,day:4,hour:12,seconds:0,...start},look={paint};let sequence=0,serial=0;
 const media={matches:false,listeners:new Set(),addEventListener(type,fn){media.listeners.add(fn);},removeEventListener(type,fn){media.listeners.delete(fn);}};
 const decorate=el=>{el.ownerDocument=document;el.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:300,right:1366,bottom:300});
  el.style.getPropertyValue=key=>el.style[key]||'';el.style.getPropertyPriority=()=>'';el.prepend=node=>{node.remove();node.parentNode=el;el.childNodes.unshift(node);};el.before=node=>{node.remove();const host=el.parentNode;if(!host)return;host.childNodes.splice(host.childNodes.indexOf(el),0,node);node.parentNode=host;};
  // every movement is recorded: what moves, its keyframes and timing, and whether it was cancelled
  el.animate=(keyframes,options)=>{const a={el,keyframes,options,startTime:undefined,currentTime:undefined,cancelled:false,cancel(){a.cancelled=true;},play(){a.played=true;}};anims.push(a);return a;};
  if(el.tagName==='IMG'){images.push(el);if(decode)el.decode=()=>new Promise((ok,no)=>decodes.push({el,ok,no}));}
  // a frame: what is posted to its page is kept
  if(el.tagName==='IFRAME'){const posts=[];el.contentWindow={posts,postMessage(message,origin){posts.push([JSON.parse(JSON.stringify(message)),origin]);}};frames.push(el);}
  if(el.tagName==='CANVAS')el.getContext=()=>({drawImage(){},set globalAlpha(v){},getImageData:(x,y,w,h)=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)data.set(look.paint(),i*4);return {data};}});
  return el;};
 const create=document.createElement;document.createElement=tag=>decorate(create(tag));for(const el of document.querySelectorAll('*'))decorate(el);
 document.querySelector('h1').getBoundingClientRect=()=>({left:24,top:133,width:334,height:38,right:358,bottom:171});document.querySelector('.rd-heading-date').getBoundingClientRect=()=>({left:24,top:176,width:200,height:18,right:224,bottom:194});
 rd.dataset.motionStyle='gentle';rd.setAttribute('data-graphics',graphics);rd.setAttribute('data-theme',theme);document.visibilityState='visible';
 class Clock extends Date{getDay(){return clock.day;}getHours(){return Math.floor(clock.hour);}getMinutes(){return Math.round((clock.hour%1)*60)%60;}getMonth(){return clock.month-1;}getFullYear(){return clock.year;}getDate(){return clock.date;}getSeconds(){return clock.seconds;}getMilliseconds(){return 0;}}
 class Address extends URL{static createObjectURL(blob){const url='blob:train-'+(++serial);made.set(url,blob.file);return url;}static revokeObjectURL(url){revoked.add(url);}}
 class Observer{constructor(fn){this.fn=fn;this.targets=new Set();observers.push(this);}observe(el){this.targets.add(el);}disconnect(){this.disconnected=true;}}
 const env=vm.createContext({document,console,Promise,Uint8ClampedArray,Date:Clock,URL:Address,performance:{now},chrome:{runtime:{getURL:file=>'chrome-extension://train-test/'+file,...(framed?{id:'train-test'}:{})}},matchMedia:()=>media,
  MutationObserver:Observer,IntersectionObserver:class extends Observer{constructor(fn){super(fn);intersections.push(this);}},getComputedStyle:el=>({display:el.hidden?'none':'block',visibility:'visible'}),
  requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms:ms||0});return id;},clearTimeout:id=>timers.delete(id),
  addEventListener:(type,fn)=>windowEvents.set(type,fn),removeEventListener:type=>windowEvents.delete(type),
  fetch:async url=>{const file=url.replace('chrome-extension://train-test/themes/train/','');fetched.push(file);return {ok:!missing.includes(file),blob:async()=>({file}),json:async()=>ride?ride():file==='ride.json'?JSON.parse(JSON.stringify(RIDE)):JSON.parse(dataFile(file))};}});
 vm.runInContext(read('band-kit.js'),env,{filename:'band-kit.js'});vm.runInContext(worldSource(paged),env,{filename:'scene-themes.js'});
 const api=env.ReserveSceneThemes,run=async which=>{const entries=[...timers].filter(([,timer])=>which(timer));for(const [id]of entries)timers.delete(id);for(const [,timer]of entries)timer.fn();await settle();};
 const h={document,rd,shadow,env,api,clock,look,fetched,made,revoked,timers,anims,frames,windowEvents,
  // the band's own page (in its frame) says something to the dashboard; `from` can be another window or origin
  say:async(data,from={})=>{windowEvents.get('message')?.({source:from.source||frames[frames.length-1]?.contentWindow,origin:from.origin||'chrome-extension://train-test',data});await settle();},
  apply:()=>api.apply(shadow,rd,'train',{motionStyle:'gentle',theme}),update:(more={})=>api.apply(shadow,rd,'train',{motionStyle:'gentle',theme,...more}),
  // the pictures read so far finish decoding
  load:async()=>{await settle();for(const d of decodes.splice(0))if(d.el.getAttribute('src'))d.ok();else decodes.push(d);for(const img of images.splice(0))if(img.getAttribute('src'))img.onload?.();else images.push(img);await settle();},
  // the minute passes (the scene's one timer) or the page changes; turn() runs only what waits for the next turn (0 ms)
  minute:()=>run(()=>true),turn:()=>run(timer=>timer.ms===0),
  layers:()=>rd.querySelectorAll('.tk-layer').map(node=>[node.getAttribute('data-layer'),node.style.opacity?Number(node.style.opacity):1]),
  sky:()=>rd.querySelector('.tk-sky'),poster:()=>rd.querySelector('.tk-poster'),css:()=>shadow.querySelector('style[data-rd-scene-style]')?.textContent||'',
  file:url=>made.get(url),live:()=>anims.filter(a=>!a.cancelled),
  // the files whose blob URLs are still held, and the pictures they make
  held:()=>[...made].filter(([url])=>!revoked.has(url)).map(([,file])=>file),
  pictures:()=>[...new Set(h.held().map(pictureOf))].filter(id=>id!=='shade').sort(),
  visibility:value=>{document.visibilityState=value;document.dispatchEvent({type:'visibilitychange'});},
  reduce:value=>{media.matches=value;for(const fn of media.listeners)fn();},
  intersect:(target,value)=>{for(const o of intersections)if(o.targets.has(target))o.fn([{target,isIntersecting:value}]);},
  mutate:async()=>{for(const o of observers)if(!o.disconnected)o.fn([]);await h.minute();}};
 return h;
}

test('only the pictures shown now are read: the ride, a land\'s strips and a cabin with its sheet; the shown ones stay until the next are in',async t=>{
 const h=fixture();t.after(()=>h.api.remove());h.apply();await settle();
 const noon=[...strips('metro','noon'),cabFiles('metro','noon')[0],cabFiles('metro','noon')[1]];
 assert.deepEqual(h.fetched,['ride.json',...noon],'Thursday noon: the ride, then one land and one cabin');
 assert.equal(h.layers().length,0,'nothing shows before its pictures are in');assert.equal(h.sky().querySelector('.tk-band').hasAttribute('data-ready'),false);
 await h.load();assert.deepEqual(h.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]]);assert.ok(h.sky().querySelector('.tk-band').hasAttribute('data-ready'));assert.equal(h.rd.getAttribute('data-band-stage'),'noon');
 // the stage holds the art in its own pixels, scaled to the band
 const art=h.rd.querySelector('.tk-art'),stage=art.querySelector('.tk-stage'),f=K.fit({w:4096,h:512},{w:1366,h:296},{focus:{x:1,y:.5},keep:{x:2000/4096,y:0,w:2096/4096,h:1}});
 for(const key of ['left','top','width','height'])assert.ok(Math.abs(parseFloat(art.style[key])-f[{left:'x',top:'y',width:'w',height:'h'}[key]])<.02,key);
 assert.equal(stage.style.transform,'scale('+Math.round(f.w/4096*1e5)/1e5+')');
 // the land: the still sky once, every other layer a strip laid twice, end to end
 const land=stage.querySelector('[data-layer="land-metro-noon"]'),out=land.querySelector('.tk-out'),layers=RIDE.lands.metro.layers;
 assert.equal(out.children.length,layers.length,'one child per layer, far to near');
 out.children.forEach((child,i)=>{
  if(layers[i].still){assert.equal(child.tagName,'IMG',String(i));assert.equal(h.file(child.getAttribute('src')),'land-metro-noon-'+i+'.webp');return;}
  const [one,two]=child.children;assert.ok(child.classList.contains('tk-strip'),String(i));assert.equal(h.file(one.getAttribute('src')),'land-metro-noon-'+i+'.webp');assert.equal(two.getAttribute('src'),one.getAttribute('src'));assert.equal(two.style.left,'4095px','the copy follows the strip');
 });
 // the cabin: its picture, then every piece in its place on the sheet (a link sits inside the link it hangs from)
 const cabin=stage.querySelector('[data-layer="'+cab('metro','noon')+'"]'),pieces=cabin.querySelectorAll('.tk-piece'),byName=new Map(pieces.map(node=>[node.getAttribute('data-piece'),node]));
 assert.equal(h.file(cabin.querySelector('.tk-room').getAttribute('src')),cabFiles('metro','noon')[0]);assert.equal(pieces.length,RIDE.pieces.length);
 for(const q of RIDE.pieces){
  const node=byName.get(q.n),parent=q.p>=0?RIDE.pieces[q.p]:null;assert.equal(node.parentNode,parent?byName.get(parent.n):cabin,q.n);
  assert.deepEqual([node.style.left,node.style.top,node.style.width,node.style.height],[(q.x-(parent?parent.x:0))+'px',(q.y-(parent?parent.y:0))+'px',q.w+'px',q.h+'px'],q.n);
  assert.equal(node.style.backgroundPosition,(-q.ax)+'px '+(-q.ay)+'px',q.n);assert.equal(node.style.backgroundSize,RIDE.sheet.join('px ')+'px');assert.equal(h.file(/^url\("(.*)"\)$/.exec(node.style.backgroundImage)[1]),cabFiles('metro','noon')[1]);
 }
 assert.equal(h.poster().getAttribute('src'),null,'the poster is only the fallback: never read while the band works');
 // the floor: the shadows of the passing land's nearest layers, read once it shows, as strong as noon is light
 const shades=RIDE.lands.metro.shade;assert.deepEqual(h.fetched.slice(1+noon.length),shades.map(s=>s.file+'.png'));
 const floor=stage.querySelector('.tk-shade');assert.equal(stage.lastChild,floor,'the shadows lie over the cabin');assert.equal(floor.style.opacity,'0.3');assert.deepEqual(floor.querySelectorAll('b').map(b=>Number(b.getAttribute('data-speed'))).sort((a,b)=>a-b),shades.map(s=>s.speed).sort((a,b)=>a-b));
 // a quiet minute changes nothing and reads nothing
 const count=h.fetched.length;await h.minute();assert.equal(h.fetched.length,count);
 // 14:40: sunset comes in; noon stays shown until all of sunset is in
 const sunset=[...strips('metro','sunset'),cabFiles('metro','sunset')[0],cabFiles('metro','sunset')[1]];h.clock.hour=14+40/60;await h.minute();assert.deepEqual(h.fetched.slice(count),sunset);assert.deepEqual(h.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]]);
 await h.load();assert.deepEqual(h.layers(),[['land-metro-noon',1],['land-metro-sunset',.5],[cab('metro','noon'),1],[cab('metro','sunset'),.5]],'four pictures while the fade runs, in depth order');
 assert.equal(h.rd.getAttribute('data-band-stage'),'noon');assert.equal(floor.style.opacity,'0.4','the shadows deepen, up to 0.4');assert.equal(h.fetched.length,count+sunset.length,'the same land\'s shadows are not read again');
 // 15:40: noon is let go, every file of it
 h.clock.hour=15+40/60;await h.minute();assert.deepEqual(h.layers(),[['land-metro-sunset',1],[cab('metro','sunset'),1]]);assert.equal(h.rd.getAttribute('data-band-stage'),'sunset');
 assert.deepEqual(h.pictures(),[cab('metro','sunset'),'land-metro-sunset'],'noon\'s pictures are released');assert.ok(noon.every(file=>!h.held().includes(file)));assert.equal(h.fetched.length,count+sunset.length,'nothing new is read');
});

test('a whole week on the minute: the land changes at midnight, never more than four pictures are held, each read only when shown',async t=>{
 // Sunday 8 November 2026 (ISO week 45) to Saturday the 14th (Thursday is the glass city)
 const h=fixture({clock:{day:0,date:8,hour:0}});t.after(()=>h.api.remove());h.apply();await h.load();
 let most=0;
 for(let day=0;day<7;day++)for(let minute=day?0:10;minute<24*60;minute+=10){
  Object.assign(h.clock,{day,date:8+day,hour:minute/60});await h.minute();await h.load();
  const held=h.pictures(),land=landOf(day);most=Math.max(most,held.length);assert.ok(held.length<=4,'day '+day+' '+minute+': '+held);
  const shown=h.layers().map(([id])=>id);assert.ok(shown.filter(id=>id.startsWith('land-')).every(id=>id.startsWith('land-'+land+'-')),'day '+day+' '+minute+': '+shown);
  const shade=h.held().filter(file=>file.startsWith('shade-'));assert.ok(shade.every(file=>file.startsWith('shade-'+land+'-')),'day '+day+' '+minute+': the passing land\'s shadows only');
  if(minute===12*60)assert.equal(shade.length,RIDE.lands[land].shade.length,'shadows at noon');if(minute===2*60||minute===21*60)assert.deepEqual(shade,[],'no shadows by night');
 }
 assert.equal(most,4);assert.equal(new Set(h.fetched.filter(file=>file.endsWith('.webp')).map(pictureOf)).size,35+5*OWN_CABINS.length+(OWN_CABINS.length<7?5:0),'over a week every picture is shown in its turn');
 assert.ok(!h.fetched.includes('poster.jpg'));assert.equal(h.fetched.filter(file=>file==='ride.json').length,1,'the ride is read once');
 // Monday's land at midnight: the cabin stays, the land changes, nothing fades
 Object.assign(h.clock,{day:1,date:9,hour:hm('23:59')});await h.minute();await h.load();assert.deepEqual(h.layers(),[['land-sea-night',1],[cab('sea','night'),1]]);
 Object.assign(h.clock,{day:2,date:10,hour:0});await h.minute();await h.load();assert.deepEqual(h.layers(),[['land-peaks-night',1],[cab('peaks','night'),1]]);
 // the Thursday before, in an odd week, is the glass city too (until 4.2.2 it was the deep sea)
 Object.assign(h.clock,{day:4,date:5,hour:12});await h.minute();await h.load();assert.deepEqual(h.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]]);
 Object.assign(h.clock,{date:12});await h.minute();await h.load();assert.deepEqual(h.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]]);
});

// (engine 2: what rides with the train (the pieces, the land against the window) runs on the rail: one window of the journey at a time
// (WIN), every page the same windows of the band's clock; what has a life of its own loops for ever)
const WIN=10000;
test('the ride: every strip slides one length at its own speed, every piece rides a window of the journey, all from the same moment',async t=>{
 const h=fixture({clock:{seconds:37}});t.after(()=>h.api.remove());h.apply();await h.load();
 const live=h.live(),W=RIDE.box[0],on=el=>live.filter(a=>a.el===el);
 assert.ok(live.length>RIDE.pieces.length);
 for(const a of live){
  assert.ok(a.options.iterations===Infinity||a.options.duration===WIN&&a.options.fill==='both','a loop, or a window of the rail');assert.ok(Number.isFinite(a.options.duration)&&a.options.duration>0);assert.ok(a.startTime===null||Number.isFinite(a.startTime),'its start is set');
  for(const frame of a.keyframes){for(const n of numbers(frame))assert.ok(Number.isFinite(n),JSON.stringify(frame));if('offset' in frame)assert.ok(frame.offset>=0&&frame.offset<=1,JSON.stringify(frame));}
 }
 // the land's strips, far to near
 const out=h.rd.querySelector('[data-layer="land-metro-noon"] .tk-out'),speeds=RIDE.lands.metro.layers.filter(layer=>!layer.still).map(layer=>layer.speed),bands=out.querySelectorAll('.tk-strip');
 assert.equal(bands.length,speeds.length);
 bands.forEach((strip,i)=>{const [a,...more]=on(strip);assert.equal(more.length,0);assert.deepEqual(copy(a.keyframes),[{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(1-W)+'px,0,0)'}]);assert.equal(a.options.duration,(W-1)/speeds[i]*1000,'strip '+i);assert.equal(a.startTime,0);});
 // the whole land rides against the window on the rail, from the window's start
 const [shake]=on(out);assert.equal(shake.options.duration,WIN);assert.equal(shake.options.fill,'both');assert.equal(shake.startTime,0);assert.ok(shake.keyframes.every(fr=>/^translate3d\(-?[\d.]+px,-?[\d.]+px,0\)$/.test(fr.transform)));
 // every piece: one window of the rail, offsets 0 to 1 in order; the kind says what moves
 const kind={bend:/^skewX\(/,rot:/^rotate\(/,lift:/^translate3d\(0,-?[\d.]+px,0\) scaleY\(/,slide:/^translate3d\(-?[\d.]+px,0,0\)$/};let widest=0;
 for(const node of h.rd.querySelectorAll('[data-layer="'+cab('metro','noon')+'"] .tk-piece')){
  const q=RIDE.pieces.find(p=>p.n===node.getAttribute('data-piece')),moves=on(node);assert.equal(moves.length,1,q.n);const [a]=moves,k=a.keyframes;
  assert.equal(a.options.duration,WIN,q.n);assert.equal(a.startTime,0,q.n);assert.ok(k.length>=3,q.n);
  assert.equal(k[0].offset,0);assert.equal(k.at(-1).offset,1);for(let i=1;i<k.length;i++)assert.ok(k[i].offset>k[i-1].offset,q.n);
  for(const frame of k){assert.match(frame.transform,kind[q.k],q.n);const list=numbers(frame);if(q.k==='lift')list.pop();for(const n of list)widest=Math.max(widest,Math.abs(n));}
 }
 assert.ok(widest>0&&widest<40,'nothing swings or jumps far: '+widest);
 // what the page draws itself: steam, the record, the clocks' hands on the student's seconds, the airscrew, the cursor,
 // the sand and dust in the daylight; no fairy-light glow by day
 const cabin=h.rd.querySelector('[data-layer="'+cab('metro','noon')+'"]'),count=sel=>cabin.querySelectorAll(sel).length;
 assert.equal(count('.tk-steam'),RIDE.extras.steam.length);assert.equal(count('.tk-puff'),6*RIDE.extras.steam.length);assert.equal(count('.tk-record'),1);assert.equal(count('.tk-hand'),RIDE.extras.hands.length);assert.equal(count('.tk-prop'),1);assert.equal(count('.tk-cursor'),1);assert.equal(count('.tk-sand'),1);assert.equal(count('.tk-mote'),26);
 for(const sel of ['.tk-steam','.tk-puff','.tk-disc','.tk-hand','.tk-prop','.tk-mote','.tk-type'])for(const node of cabin.querySelectorAll(sel))assert.equal(on(node).length,1,sel);
 // the laptop types its last line in steps, and the cursor (which also blinks) stands at the end of what is typed; no lamp wears a halo by day
 {assert.equal(count('.tk-type'),1);const [typed]=on(cabin.querySelector('.tk-type')),moves=on(cabin.querySelector('.tk-cursor'));assert.equal(typed.keyframes[0].transform,'scaleX(0)');assert.equal(typed.keyframes[0].easing,'steps('+RIDE.extras.type.steps+',end)');assert.equal(moves.length,2);assert.equal(moves[1].options.duration,typed.options.duration);assert.equal(moves[1].keyframes[0].transform,'translate3d('+(-RIDE.extras.type.w)+'px,0,0)');assert.equal(count('.tk-glow'),0);}
 for(const node of cabin.querySelectorAll('.tk-hand')){const [a]=on(node);assert.equal(a.options.duration,60000);assert.equal(a.startTime,null);assert.equal(a.currentTime,37000,'the second hand shows the seconds');}
 assert.equal(cabin.querySelector('.tk-prop').parentNode.getAttribute('data-piece'),RIDE.extras.prop.on,'the airscrew turns with its plane');assert.equal(cabin.querySelector('.tk-sand').parentNode.getAttribute('data-piece'),'hourglass');
 assert.equal(live.filter(a=>a.keyframes.some(frame=>frame.filter)).length,0,'the fairy lights glow only after dark');
 // the floor's shadows slide at their layer's speed
 for(const strip of h.rd.querySelectorAll('.tk-shade b')){const [a]=on(strip);assert.deepEqual(copy(a.keyframes),[{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(-W)+'px,0,0)'}]);assert.equal(a.options.duration,W/Number(strip.getAttribute('data-speed'))*1000);assert.equal(a.startTime,0);}
 // after dark: the fairy lights glow, no dust, no shadows on the floor
 const night=fixture({clock:{hour:1}});t.after(()=>night.api.remove());night.apply();await night.load();
 const lights=night.rd.querySelectorAll('[data-layer="'+cab('metro','night')+'"] .tk-piece').filter(node=>node.getAttribute('data-piece').startsWith('fairy lights'));assert.ok(lights.length>0);
 for(const node of lights){const moves=night.live().filter(a=>a.el===node);assert.equal(moves.length,2,node.getAttribute('data-piece'));assert.ok(moves[1].keyframes.every(frame=>/^brightness\([\d.]+\)$/.test(frame.filter)));assert.equal(moves[1].options.iterations,Infinity);}
 // the lamps that are on at night wear a halo that breathes, each inside its lamp's piece so it rides with it
 {const halos=night.rd.querySelectorAll('[data-layer="'+cab('metro','night')+'"] .tk-glow'),lit=RIDE.extras.glow.filter(g=>g.on.includes('night'));assert.ok(lit.length>0);assert.equal(halos.length,lit.length);for(const node of halos){const moves=night.live().filter(a=>a.el===node);assert.equal(moves.length,1);assert.ok(moves[0].keyframes.every(frame=>typeof frame.opacity==='number'));assert.ok(lit.some(g=>g.at===node.parentNode.getAttribute('data-piece')));}}
 assert.equal(night.rd.querySelectorAll('.tk-mote').length,0);assert.equal(night.rd.querySelector('.tk-shade'),null);assert.ok(!night.fetched.some(file=>file.startsWith('shade-')),'no shadows are read by night');
});

test('the pieces start a few at a time, so starting never holds the page; a band that stops meanwhile starts no more',async t=>{
 let ms=0;const h=fixture({now:()=>ms++});t.after(()=>h.api.remove());h.apply();await h.load();
 const pieces=()=>h.anims.filter(a=>a.el.classList.contains('tk-piece')&&!a.keyframes[0].filter).length;
 const first=pieces();assert.ok(first>0&&first<RIDE.pieces.length,'a few on the first turn: '+first);
 await h.turn();const second=pieces();assert.ok(second>first&&second<RIDE.pieces.length,'a few more on the next: '+second);
 h.reduce(true);await settle();assert.equal(h.live().length,0);assert.equal([...h.timers.values()].filter(timer=>timer.ms===0).length,0,'the next turn is called off');
 await h.turn();assert.equal(pieces(),second,'no more start');
 h.reduce(false);await settle();for(let i=0;i<RIDE.pieces.length&&[...h.timers.values()].some(timer=>timer.ms===0);i++)await h.turn();
 assert.equal(h.live().filter(a=>a.el.classList.contains('tk-piece')&&!a.keyframes[0].filter).length,RIDE.pieces.length,'in the end every piece moves');
});

test('the band stands still, with nothing left moving, for Graphics Low, Still, Off, reduced motion, a band scrolled away and a hidden tab; a resting page does not stop a band that travels',async t=>{
 // Graphics Low: the stage swaps at its hour, nothing ever starts to move and no shadows are read
 const low=fixture({graphics:'low',clock:{hour:hm('10:10')}});t.after(()=>low.api.remove());low.apply();await low.load();
 assert.deepEqual(low.fetched,['ride.json',...strips('metro','morning'),cabFiles('metro','morning')[0],cabFiles('metro','morning')[1]]);assert.deepEqual(low.layers(),[['land-metro-morning',1],[cab('metro','morning'),1]]);assert.equal(low.anims.length,0,'not one movement');
 low.clock.hour=hm('10:30');await low.minute();await low.load();assert.deepEqual(low.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]],'at 10:30 it is noon at once');assert.equal(low.anims.length,0);
 low.rd.setAttribute('data-graphics','high');low.clock.hour=hm('14:40');await low.mutate();await low.load();assert.deepEqual(low.layers().map(([,a])=>a),[1,.5,1,.5],'back on High the fades return');assert.ok(low.live().length>0,'and the band moves');
 // a moving band stopped by each in turn: every movement it started is cancelled, none starts, the pictures stay
 const h=fixture();t.after(()=>h.api.remove());h.apply();await h.load();
 const stops=[
  ['Graphics Low',async()=>{h.rd.setAttribute('data-graphics','low');await h.mutate();},async()=>{h.rd.setAttribute('data-graphics','high');await h.mutate();}],
  ['motion Still',async()=>{h.update({motionStyle:'still'});await settle();},async()=>{h.update();await settle();}],
  ['motion Off',async()=>{h.update({motionStyle:'off'});await settle();},async()=>{h.update();await settle();}],
  ['reduced motion',async()=>{h.reduce(true);await settle();},async()=>{h.reduce(false);await settle();}],
  // (the light under the band has its own "in view": it is scrolled away too)
  ['a band scrolled away',async()=>{const day=h.rd.querySelector('.tk-day');h.intersect(h.sky(),false);h.intersect(day,false);await settle();},async()=>{h.intersect(h.sky(),true);h.intersect(h.rd.querySelector('.tk-day'),true);await settle();}],
  ['a hidden tab',async()=>{h.visibility('hidden');await settle();},async()=>{h.visibility('visible');await settle();}]];
 for(const [name,stop,go]of stops){
  assert.ok(h.live().length>RIDE.pieces.length,name+': moving before');const before=h.anims.length;
  await stop();await h.load();
  assert.equal(h.live().length,0,name+': nothing moves');assert.ok(h.anims.every(a=>a.cancelled),name+': every movement was cancelled');assert.equal(h.anims.length,before,name+': none started');
  assert.deepEqual(h.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]],name+': the same pictures stand still');
  await go();await h.load();assert.ok(h.live().length>RIDE.pieces.length,name+': moving again');
 }
 // (4.2.6) the dashboard's idle rest (data-art-rest: 30 to 60 s without input) does NOT stop a band that travels: its land is a place
 // to sit and look at; every movement goes on, none is cancelled or begun again
 {const before=h.anims.length,moving=h.live().length;assert.ok(moving>RIDE.pieces.length,'moving before the page rests');
  h.rd.setAttribute('data-art-rest','');await h.mutate();await h.load();assert.equal(h.live().length,moving,'a resting page: the band travels on');assert.equal(h.anims.length,before,'a resting page: nothing was begun again');
  h.rd.removeAttribute('data-art-rest');await h.mutate();await h.load();assert.equal(h.live().length,moving,'the rest over: still the same movements');assert.equal(h.anims.length,before);}
 // a hidden tab reads nothing until it is seen
 h.visibility('hidden');h.clock.hour=17;const count=h.fetched.length;await h.minute();assert.equal(h.fetched.length,count,'nothing is read for a hidden tab');assert.equal(h.live().length,0);
 h.visibility('visible');await settle();assert.deepEqual(h.fetched.slice(count,count+2),strips('metro','sunset').slice(0,2));await h.load();assert.ok(h.live().length>0);
});

test('Graphics Medium moves the lighter half: the land, the shadows and every piece that hangs from nothing; the links and the dust stay',async t=>{
 const h=fixture({graphics:'medium'});t.after(()=>h.api.remove());h.apply();await h.load();
 const cabin=()=>h.rd.querySelector('[data-layer="'+cab('metro','noon')+'"]'),moved=()=>new Set(h.live().map(a=>a.el)),piece=node=>RIDE.pieces.find(q=>q.n===node.getAttribute('data-piece'));
 let now=moved();assert.ok(RIDE.pieces.some(q=>q.p>=0)&&RIDE.pieces.some(q=>q.p<0));
 for(const node of cabin().querySelectorAll('.tk-piece'))assert.equal(now.has(node),piece(node).p<0,piece(node).n);
 for(const node of cabin().querySelectorAll('.tk-mote'))assert.equal(now.has(node),false,'the dust stays');
 for(const sel of ['.tk-steam','.tk-disc','.tk-hand'])for(const node of cabin().querySelectorAll(sel))assert.ok(now.has(node),sel);
 for(const node of h.rd.querySelectorAll('.tk-strip'))assert.ok(now.has(node),'the land passes');assert.ok(h.rd.querySelectorAll('.tk-shade b').length>0&&h.rd.querySelectorAll('.tk-shade b').every(node=>now.has(node)),'its shadows too');
 // High: everything; Medium again: the links and the dust stop, nothing left running on them
 h.rd.setAttribute('data-graphics','high');await h.mutate();now=moved();for(const node of cabin().querySelectorAll('.tk-piece, .tk-mote'))assert.ok(now.has(node),'on High all moves');
 h.rd.setAttribute('data-graphics','medium');await h.mutate();now=moved();
 for(const node of cabin().querySelectorAll('.tk-piece'))assert.equal(now.has(node),piece(node).p<0,piece(node).n);assert.ok(cabin().querySelectorAll('.tk-mote').every(node=>!now.has(node)));
 assert.deepEqual(h.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]],'Medium keeps the fades and the pictures');
});

test('removing the scene cancels every movement and lets go of every picture read; put on again, it reads again',async t=>{
 const h=fixture();t.after(()=>h.api.remove());h.apply();await h.load();h.clock.hour=hm('14:40');await h.minute();await h.load();
 assert.equal(h.pictures().length,4);assert.ok(h.held().some(file=>file.startsWith('shade-')));
 // (public scenes do not read the look's parts, so the band is cleared by taking the scene down)
 h.api.remove();await settle();
 assert.equal(h.live().length,0);assert.deepEqual(h.held(),[],'every blob URL it made is revoked');assert.equal(h.rd.querySelectorAll('.tk-layer').length,0);assert.equal(h.rd.querySelector('.tk-shade'),null);
 // on again: read again
 const count=h.fetched.length;h.apply();await h.load();assert.ok(h.fetched.length>count);assert.equal(h.layers().length,4);assert.ok(h.live().length>0);
 h.api.remove();
 assert.equal(h.live().length,0);assert.ok(h.anims.every(a=>a.cancelled));assert.deepEqual(h.held(),[]);assert.equal(h.timers.size,0);assert.equal(h.rd.hasAttribute('data-band-stage'),false);assert.equal(h.rd.querySelector('.tk-sky'),null);
});

test('text "auto": the greeting turns light over the night cabin and stays the theme\'s own ink by day; dark mode the other way',async t=>{
 const day=fixture({paint:()=>[236,224,214,255]});t.after(()=>day.api.remove());day.apply();await day.load();assert.doesNotMatch(day.css(),/#FBF8F1/,'dark ink on a light cabin stays');
 const night=fixture({paint:()=>[14,18,60,255],clock:{hour:1}});t.after(()=>night.api.remove());night.apply();await night.load();
 assert.match(night.css(),/\[data-theme-kit="train"\] :is\(\.rd-workspace-heading,\.rd-course-heading\) :is\(h1,\.rd-heading-date,\.rd-heading-detail\)\{color:#FBF8F1!important;/,'light words on the night cabin');
 night.look.paint=()=>[236,224,214,255];night.clock.hour=12;await night.minute();await night.load();assert.doesNotMatch(night.css(),/#FBF8F1/,'and back by day');
 const dark=fixture({theme:'dark',paint:()=>[236,224,214,255]});t.after(()=>dark.api.remove());dark.apply();await dark.load();assert.match(dark.css(),/color:#1F1D1A!important/,'dark words over the noon cabin in the night carriage');
});

const BROKEN=[['a cabin',{missing:[cabFiles('metro','noon')[0]]}],['a sheet of pieces',{missing:[cabFiles('metro','noon')[1]]}],['one strip of the land',{missing:['land-metro-noon-4.webp']}],['the ride',{missing:['ride.json']}],['a ride that is not JSON',{ride:()=>{throw SyntaxError('Unexpected token');}}],['a ride without the land',{ride:()=>({...RIDE,lands:{grove:RIDE.lands.grove}})}]];
test('a ride or picture that cannot be read leaves the poster; removing the scene leaves nothing behind',async()=>{
 for(const [name,options]of BROKEN){
  const h=fixture(options),before=h.shadow.innerHTML;h.apply();await h.load();
  assert.equal(h.poster().getAttribute('src'),'chrome-extension://train-test/themes/train/poster.jpg',name);assert.equal(h.poster().hidden,false,name);assert.equal(h.rd.querySelector('.tk-band'),null,name);assert.equal(h.live().length,0,name);
  h.api.remove();assert.equal(h.shadow.innerHTML,before,name);assert.equal(h.timers.size,0,name);
 }
 const ok=fixture(),plain=ok.shadow.innerHTML;ok.apply();await ok.load();assert.equal(ok.layers().length,2);assert.equal(ok.rd.dataset.themeKit,'train');
 assert.deepEqual(ok.rd.querySelectorAll('.tk-icon').map(icon=>icon.dataset.motif),['cat']);assert.equal(ok.rd.querySelector('.tk-icon').getAttribute('src'),'chrome-extension://train-test/themes/train/icon-cat.png');
 assert.equal(ok.rd.querySelector('video'),null,'no video: the band is pictures that move');
 ok.api.remove();assert.equal(ok.shadow.innerHTML,plain);assert.equal(ok.timers.size,0);assert.deepEqual(ok.held(),[],'its pictures are let go');assert.ok(ok.anims.every(a=>a.cancelled));
});

test('without img.decode the pictures are waited for by their load events',async t=>{
 const h=fixture({decode:false});t.after(()=>h.api.remove());h.apply();await settle();assert.equal(h.layers().length,0);
 await h.load();assert.deepEqual(h.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]]);assert.ok(h.live().length>RIDE.pieces.length);
});

test('Biscuit knows Soul Passage by name, and its old names still find it',()=>{
 const P=require('../extension/biscuit-parse.js'),ctx={now:Date.parse('2026-05-11T16:00:00Z'),timeZone:'America/New_York',courses:[],workItems:[],focus:{running:false},skills:{}};
 for(const q of ['train cabin theme','train cabin','train cabin scene','train theme','window seat','window seat theme','window seat scene','set scene to window seat','soul passage','soul passage theme','soul passage scene','set scene to soul passage']){const out=P.parse(q,ctx);assert.ok(out.length,q);assert.equal(out[0].intent,'setting',q);assert.deepEqual(out[0].fields,{key:'sceneTheme',value:'train'},q);}
 const Controls=require('../extension/biscuit-controls.js');assert.ok(Controls.propose('none',{settings:{}},{picker:{kind:'scene',open:true}}).choices.some(choice=>choice.label==='Soul Passage'&&choice.fields.value==='train'));
 // (the whole Biscuit: the name alone sets the scene; the train's speed is found under the new name; a line about the window seat's speed is not a change of scene)
 const M=require('../extension/biscuit-mind.js'),rule=id=>M.RULES.find(r=>r.id===id),card=(...a)=>a;
 for(const q of [' soul passage ',' use the soul passage ',' soul passage theme ',' window seat ',' use the window seat ',' train cabin ',' window seat theme '])assert.ok(rule('r9-scene-names').when(q),q);
 for(const q of [' soul passage ',' window seat '])assert.equal(rule('r9-scene-names').answer(null,{q,card})[2].value,'train',q);
 for(const q of [' make the soul passage go faster ',' soul passage faster ',' make the window seat go faster ',' window seat faster ',' slow the train down please ']){assert.ok(rule('r9-train').when(q),q);const a=rule('r9-train').answer(null,{q,card});assert.equal(a[3],'Open Soul Passage > laptop screen > Train speed.',q);assert.deepEqual(a[4].ui.path,['Soul Passage','Laptop screen','Train speed']);}
 // (Canvas Harness has no Scenery panel: a line about the land or the hour is not the speed rule's)
 for(const q of [' change the train scenery ',' the train at night ',' soul passage on monday '])assert.ok(!rule('r9-train').when(q),q);
 for(const q of [' soul passage ',' use the soul passage ',' soul passage theme ',' window seat ',' use the window seat ',' window seat theme '])assert.ok(!rule('r9-train').when(q),q);
});

// Inside the extension (a runtime with an id) the travelling band is not laid in the dashboard's page: it is the band's own page
// (themes/train/band.html) in a frame, so its movements run in the extension's process. The dashboard tells it the moment and
// hears back that it is laid, the tone under the greeting, the stage of the day, or a failure.
test('inside the extension the band is its own page in a frame: the dashboard reads no picture, sends the moment once the page is ready, and hears the answers',async t=>{
 const h=fixture({framed:true});t.after(()=>h.api.remove());h.apply();await h.load();
 const frame=h.rd.querySelector('.tk-frame');assert.ok(frame,'a frame');assert.equal(frame.tagName,'IFRAME');assert.equal(frame.getAttribute('src'),'chrome-extension://train-test/themes/train/band.html');
 assert.equal(frame.parentNode.className,'tk-band');assert.equal(frame.parentNode.parentNode,h.sky());assert.equal(frame.getAttribute('aria-hidden'),'true');assert.equal(frame.getAttribute('tabindex'),'-1');
 assert.equal(h.rd.querySelectorAll('.tk-stage').length,0,'no stage in the dashboard\'s page');assert.equal(h.rd.querySelectorAll('.tk-piece').length,0);
 assert.ok(h.fetched.every(file=>file==='ride.json'),'the dashboard reads no picture (only the ride, for the motifs on the cards): '+h.fetched.join(' '));
 // the stage of the day is known at once, from the band's words and the clock
 assert.equal(h.rd.getAttribute('data-band-stage'),'noon');
 // nothing goes to the frame before its page says it is ready
 assert.equal(frame.contentWindow.posts.length,0);assert.ok(!frame.parentNode.hasAttribute('data-ready'));
 await h.say({tkBand:1,ready:true});
 assert.equal(frame.contentWindow.posts.length,1);const [first,origin]=frame.contentWindow.posts[0];assert.equal(origin,'chrome-extension://train-test');assert.equal(first.tkBand,1);
 const show=first.show;assert.deepEqual(show.env,{mode:'light',hour:12,month:11,day:4,week:45,ratio:show.view.w/show.view.h});assert.ok(show.view.w>0&&show.view.h>0);assert.equal(show.swap,false);assert.equal(show.moving,2);
 assert.deepEqual(show.quiet,{x:24,y:133,w:334,h:61},'the place of the greeting');assert.ok(show.page>0&&show.page<=1);
 // laid: the band fades in; the tone under the greeting and the stage come back
 await h.say({tkBand:1,placed:true,pictures:['land-metro-noon',cab('metro','noon')]});assert.ok(frame.parentNode.hasAttribute('data-ready'));
 await h.say({tkBand:1,tone:'light'});assert.match(h.css(),/#FBF8F1/,'the greeting turns light');await h.say({tkBand:1,tone:''});assert.doesNotMatch(h.css(),/#FBF8F1/);
 await h.say({tkBand:1,stage:'sunset'});assert.equal(h.rd.getAttribute('data-band-stage'),'sunset');
 // another window, another origin, or other words are not heard
 await h.say({tkBand:1,stage:'night'},{source:{}});await h.say({tkBand:1,stage:'night'},{origin:'https://example.org'});await h.say({stage:'night'});await h.say({tkBand:1,stage:'<b>'});
 assert.notEqual(h.rd.getAttribute('data-band-stage'),'night');
 // the same minute again sends nothing; the next moment is sent
 await h.minute();assert.equal(frame.contentWindow.posts.length,1);
 h.clock.hour=19.5;await h.minute();assert.equal(frame.contentWindow.posts.length,2);assert.equal(frame.contentWindow.posts[1][0].show.env.hour,19.5);assert.equal(h.rd.getAttribute('data-band-stage'),'dusk');
 // a hidden tab: the band is told to stand still
 h.visibility('hidden');await h.minute();const rest=frame.contentWindow.posts.at(-1)[0].show;assert.equal(rest.moving,0);
 // removing the scene takes the frame away and stops listening
 h.api.remove();assert.equal(h.rd.querySelector('.tk-frame'),null);assert.equal(h.windowEvents.has('message'),false);
});
test('the framed band at Graphics Low stands still and changes at the hour; a band page that fails or never answers leaves the poster',async t=>{
 const low=fixture({framed:true,graphics:'low'});t.after(()=>low.api.remove());low.apply();await low.load();await low.say({tkBand:1,ready:true});
 const sent=low.rd.querySelector('.tk-frame').contentWindow.posts[0][0].show;assert.equal(sent.swap,true);assert.equal(sent.moving,0);
 // the band's page says it failed: the poster shows, the frame is gone
 const bad=fixture({framed:true});t.after(()=>bad.api.remove());bad.apply();await bad.load();await bad.say({tkBand:1,ready:true});await bad.say({tkBand:1,failed:true});
 assert.equal(bad.rd.querySelector('.tk-frame'),null);assert.equal(bad.poster().hidden,false);assert.match(bad.poster().getAttribute('src'),/poster\.jpg$/);
 // a page that never says it is ready
 const mute=fixture({framed:true});t.after(()=>mute.api.remove());mute.apply();await mute.load();assert.ok(mute.rd.querySelector('.tk-frame'));
 const wait=[...mute.timers].find(([,timer])=>timer.ms===9000);assert.ok(wait,'it is given nine seconds');mute.timers.delete(wait[0]);wait[1].fn();await settle();
 assert.equal(mute.rd.querySelector('.tk-frame'),null);assert.equal(mute.poster().hidden,false);
});
// themes/train/band.js, the band page's relay: it lays the band with the dashboard's own engine, listens to its parent only, and
// passes on only what a moment is made of.
test('the band page listens to its parent only, bounds what it is told, and answers ready, placed, tone, stage and failed',async()=>{
 const said=[],shows=[],watch=[];let cleared=0;const parent={postMessage(message,target){said.push([JSON.parse(JSON.stringify(message)),target]);}},listeners=new Map();
 const node={marks:new Set(),hasAttribute(name){return this.marks.has(name);}},band={node,show(...args){shows.push(JSON.parse(JSON.stringify(args)));},clear(){cleared++;},destroy(){},pictures:['land-sea-noon',cab('sea','noon')]},host={kids:[],append(n){this.kids.push(n);}};
 let made=null;const env=vm.createContext({URL,document:{querySelector:sel=>sel==='.tk-host'?host:null},location:{href:'chrome-extension://train-test/themes/train/band.html'},parent,MutationObserver:class{constructor(fn){this.fn=fn;watch.push(this);}observe(){}},
  ReserveSceneThemes:{bandHere(doc,base,id,on){made={base,id,on};return band;}},addEventListener:(type,fn)=>listeners.set(type,fn),performance:{timeOrigin:1762900000123.5}});
 env.globalThis=env;vm.runInContext(fs.readFileSync(path.join(dir,'band.js'),'utf8'),env,{filename:'band.js'});
 assert.deepEqual(said,[[{tkBand:1,ready:true,origin:1762900000123.5},'*']],'ready, once, with the moment the page began');assert.equal(made,null,'no band before the first moment');
 const hear=(data,source=parent)=>listeners.get('message')({source,data});
 // someone else, or other words: nothing
 hear({tkBand:1,show:{env:{},view:{w:900,h:300}}},{});hear({show:{env:{},view:{w:900,h:300}}});hear({tkBand:1,show:{env:{},view:{w:0,h:300}}});assert.equal(made,null);assert.equal(shows.length,0);
 // a moment: bounded, and only its own fields
 hear({tkBand:1,show:{env:{mode:'dark',hour:99,month:0,day:9,week:'x',extra:'no'},view:{w:1366.5,h:358,more:1},swap:1,quiet:{x:24,y:133,w:1e9,h:61},page:7,moving:5,also:'no'}});
 assert.equal(made.id,'train');assert.equal(made.base,'chrome-extension://train-test/themes/train/');assert.equal(host.kids[0],node);
 assert.deepEqual(shows[0],[{mode:'dark',hour:24,month:1,day:6,week:1,ratio:1366.5/358},{w:1366.5,h:358},false,{x:24,y:133,w:20000,h:61},1,2,null,false]);
 hear({tkBand:1,show:{env:{mode:'light',hour:12.5,month:11,day:3,week:46},view:{w:1200,h:300},swap:true,quiet:null,page:.93,moving:0}});
 assert.deepEqual(shows[1],[{mode:'light',hour:12.5,month:11,day:3,week:46,ratio:4},{w:1200,h:300},true,null,.93,0,null,false]);
 // the travel (its pace, the moment, how far, how much of the ride's loop): four numbers within their bounds, or none
 hear({tkBand:1,show:{env:{mode:'light',hour:12.5,month:11,day:3,week:46},view:{w:1200,h:300},moving:2,travel:[99,'soon',5e20,-7e20,'more']}});assert.deepEqual(shows[2][6],[12,0,1e13,-1e13]);
 hear({tkBand:1,show:{env:{mode:'light',hour:12.5,month:11,day:3,week:46},view:{w:1200,h:300},moving:2,travel:[.5,-2500.5,61.25,12.5]}});assert.deepEqual(shows[3][6],[.5,-2500.5,61.25,12.5]);
 hear({tkBand:1,show:{env:{mode:'light',hour:12.5,month:11,day:3,week:46},view:{w:1200,h:300},moving:2,travel:'fast'}});assert.equal(shows[4][6],null);
 // what the band says goes to the parent
 made.on.tone('light');made.on.tone('');made.on.stage('dusk');node.marks.add('data-ready');watch[0].fn();
 assert.deepEqual(said.slice(1).map(([m])=>m),[{tkBand:1,tone:'light'},{tkBand:1,tone:''},{tkBand:1,stage:'dusk'},{tkBand:1,placed:true,pictures:['land-sea-noon',cab('sea','noon')]}]);
 hear({tkBand:1,clear:true});assert.equal(cleared,1);
 // a failure is said once, and the band is not made again
 made.on.fail();made.on.fail();assert.deepEqual(said.at(-1)[0],{tkBand:1,failed:true});assert.equal(said.filter(([m])=>m.failed).length,1);
 const before=shows.length;hear({tkBand:1,show:{env:{},view:{w:900,h:300}}});assert.equal(shows.length,before);
});
// The whole page is the cabin: its floor starts on the page where the cabin's does in the band, and the band's windows throw their
// light on it (scene-themes.js rooms, roomLight).
test('the room under the band: the floor starts at the cabin\'s floor line, each window pane throws its light, the passing land\'s shadows cross it and it leans with the ride',async t=>{
 // (the land's strips of shade are known once the ride is read: the light is laid again then)
 const h=fixture();t.after(()=>h.api.remove());h.apply();await h.load();await h.minute();await h.load();
 const f=K.fit({w:4096,h:512},{w:1366,h:296},{focus:{x:1,y:.5},keep:{x:2000/4096,y:0,w:2096/4096,h:1}}),k=f.w/4096,r1=n=>Math.round(n*10)/10;
 // one band on every menu: the room's own height, whatever stands above this page's first widget (the cabin is one size everywhere)
 assert.equal(h.sky().style['--tk-band'],'268px','the band is the room\'s own height, not the header\'s');
 assert.equal(h.rd.style['--tk-floor-y'],Math.round(f.y+430*k)+'px','the floor line is row 430 of the picture, where the band lays it');
 const days=()=>h.rd.children.filter(n=>n.classList.contains('tk-day')),beams=()=>days().map(d=>d.children.map(b=>[b.getAttribute('data-hour'),Number(b.style.opacity)]));
 assert.deepEqual(days().map(d=>d.className),['tk-day','tk-day tk-over'],'one light on the floor, a faint one over what lies there');
 assert.ok(days().every(d=>d.hasAttribute('data-rd-keep')&&d.getAttribute('aria-hidden')==='true'&&d.style.top===Math.round(300-76)+'px'),'kept through renders, starting a little above the band\'s lower edge');
 assert.deepEqual(beams(),[[['noon',1]],[['noon',1]]]);
 // a beam: it leans, its panes are one picture across the room, and the land's three strips of shade slide one length each for ever
 const [under,over]=days().map(d=>d.children[0]),lean=under.children[0],[panes,hold]=lean.children;
 assert.equal(lean.tagName,'I');assert.equal(lean.style.transform,'skewX('+Math.round(Math.atan(.22)*18000/Math.PI)/100+'deg)');assert.equal(panes.tagName,'U');assert.equal(hold.tagName,'S');
 const stops=text=>[...text.matchAll(/rgba\(([^)]*)\) (-?[\d.]+)px/g)].map(m=>[m[1],Number(m[2])]);
 const lit=stops(panes.style.backgroundImage).filter(([c])=>c==='255,247,230,0.55').map(([,x])=>x),want=[[28,287],[293,552],[558,808],[2332,2521],[2526,2794],[2799,3067],[3100,3341],[3346,3614],[3619,3813]];
 assert.equal(lit.length,18,'nine panes, each lit from edge to edge');
 want.forEach(([a,b],i)=>{assert.ok(Math.abs(lit[2*i]-(f.x+(a+30)*k+1400+3+2.5))<.11,'pane '+i+' starts under itself');assert.ok(Math.abs(lit[2*i+1]-(f.x+(b+30)*k+1400-3-2.5))<.11,'pane '+i+' ends under itself');});
 assert.ok(stops(over.children[0].children[0].style.backgroundImage).some(([c])=>c==='255,247,230,0.06'),'the one over the page is faint');assert.equal(over.children[0].children.length,1,'and still: no shadows cross what is read');
 const strips=hold.children,shade=RIDE.lands.metro.shade,w=r1(4096*k);assert.equal(strips.length,3);assert.equal(hold.style.opacity,String(Math.round(.3*1.2*1000)/1000));assert.equal(hold.style.maskImage,hold.style.webkitMaskImage);
 strips.forEach((strip,i)=>{assert.equal(strip.style.backgroundImage,'url("chrome-extension://train-test/themes/train/'+shade[i].file+'.png")');assert.equal(strip.style.backgroundSize,w+'px 100%');
  const a=h.live().find(a=>a.el===strip);assert.ok(a,'strip '+i+' slides');assert.deepEqual(copy(a.keyframes),[{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(-w)+'px,0,0)'}]);assert.equal(a.options.duration,4096/shade[i].speed*1000);assert.equal(a.startTime,0);});
 // it takes the ride: one loop of keyframes that lean it a little either way round its own lean, from the same moment
 const sway=h.live().find(a=>a.el===lean);assert.ok(sway,'the beam leans with the car');assert.equal(sway.options.duration,RIDE.ride.loop*1000);assert.equal(sway.startTime,0);
 const angles=sway.keyframes.map(frame=>numbers(frame)[0]),own=Math.atan(.22)*180/Math.PI;assert.ok(Math.max(...angles)>own+.1&&Math.min(...angles)<own-.1&&Math.max(...angles.map(a=>Math.abs(a-own)))<1.2,'a small lean either way');assert.deepEqual(copy(sway.keyframes[0]).transform,copy(sway.keyframes.at(-1)).transform,'the loop closes');
 // the band scrolled away but the light still in view: the cabin stops, the shadows on the page go on
 h.intersect(h.sky(),false);await settle();assert.deepEqual(h.live().map(a=>a.el.tagName),['B','B','B']);h.intersect(h.sky(),true);await settle();
 // a stage fading into the next: both hours' light, each as much as its hour is there; then the one hour
 h.clock.hour=hm('14:40');await h.minute();await h.load();assert.deepEqual(beams(),[[['noon',.5],['sunset',.5]],[['noon',.5],['sunset',.5]]]);
 h.clock.hour=17;await h.minute();await h.load();assert.deepEqual(beams(),[[['sunset',1]],[['sunset',1]]]);assert.equal(days()[0].children[0].children[0].style.transform,'skewX('+Math.round(Math.atan(-.85)*18000/Math.PI)/100+'deg)','the evening light leans the other way');
 // dusk and night have their light too, as the cabin's own floor is painted
 h.clock.hour=21;await h.minute();await h.load();assert.deepEqual(beams(),[[['dusk',1]],[['dusk',1]]]);
 h.clock.hour=1;await h.minute();await h.load();assert.deepEqual(beams(),[[['night',1]],[['night',1]]]);
 // Grades and Review open a room of their own over the page: the cabin's light is not laid over that picture
 const host=h.env.document.createElement('div'),scene=h.env.document.createElement('div');host.className='rd-roomhost';scene.className='rd-roomlayer';host.append(scene);h.rd.append(host);await h.mutate();await h.load();
 assert.equal(days()[1].hidden,true,'put away while the scene is open');assert.ok(!days()[0].hidden,'the floor\'s own light stays (it is under the scene)');
 scene.setAttribute('data-state','gone');await h.minute();await h.load();assert.ok(!days()[1].hidden,'back when the scene has gone');host.remove();await h.mutate();await h.load();
 // Graphics Low and Still: the light stays, nothing in it moves
 h.clock.hour=12;await h.minute();await h.load();h.rd.setAttribute('data-graphics','low');await h.mutate();await h.load();
 assert.deepEqual(beams(),[[['noon',1]],[['noon',1]]]);assert.equal(days()[0].children[0].children[0].children.length,1,'no shadows');assert.equal(h.live().length,0);
 // (the cabin's own floor in the band has its three strips too: the light's are the ones held by an S)
 h.rd.setAttribute('data-graphics','high');await h.mutate();await h.load();assert.equal(h.live().filter(a=>a.el.parentNode?.tagName==='S').length,3);
 // Dark is not the room's floor: no light, no floor line; back in Light both return; removing the scene leaves nothing
 h.rd.setAttribute('data-theme','dark');await h.mutate();await h.load();assert.equal(days().length,0);assert.equal(h.rd.style['--tk-floor-y'],undefined);assert.ok(!h.live().some(a=>a.el.parentNode?.tagName==='S'||a.el.tagName==='I'));
 h.rd.setAttribute('data-theme','light');await h.mutate();await h.load();assert.equal(days().length,2);assert.ok(h.rd.style['--tk-floor-y']);
 h.api.remove();assert.equal(days().length,0);assert.equal(h.rd.style['--tk-floor-y'],undefined);assert.equal(h.live().length,0);
});
// A land with a page of its own (rooms.train.pages: every weekday's land; in the tests' world all but Thursday's). Under the band the land goes on down the page
// as one still picture a stage (the far land and our own bridge close up), laid at the band's own scale and place; the wooden floor
// and the windows' light on it are not laid; the dashboard says which land it is, so the frames can be that land's own.
test('a land with a page of its own: its sky stands, its layers travel in the window and under the band as one journey; no wooden floor; it goes with the land and with the scene',async t=>{
 // the first land that travels (Monday .. Sunday as the clock counts them), on its own weekday of the week of 9 November 2026
 const land=LANDS.find(name=>PAGED[name]?.move?.length);if(!land){t.skip('no land travels yet');return;}
 const day=WEEK.indexOf(land),date=8+day,info=PAGED[land],lands=info.move.filter(m=>m[0]<3);let T=0;
 const h=fixture({clock:{date,day},now:()=>T});t.after(()=>h.api.remove());h.apply();await h.load();await h.minute();await h.load();
 const own=[...(PAGED[land].live?['live-'+land+'.json']:[]),...(PAGED[land].sun?['sun-'+land+'.json']:[])];
 assert.deepEqual(h.fetched.filter(f=>!own.includes(f)),['ride.json',...strips(land,'noon'),...cabFiles(land,'noon')],'the window\'s strips; the page\'s pictures are the page\'s own paint, not read by the scene');
 assert.deepEqual(h.layers(),[['land-'+land+'-noon',1],[cab(land,'noon'),1]]);
 const f=K.fit({w:4096,h:512},{w:1366,h:296},{focus:{x:1,y:.5},keep:{x:2000/4096,y:0,w:2096/4096,h:1}}),k=f.w/4096,r1=n=>Math.round(n*10)/10,r2=n=>Math.round(n*100)/100;
 const pages=()=>h.rd.children.filter(n=>n.classList.contains('tk-page')),days=()=>h.rd.children.filter(n=>n.classList.contains('tk-day'));
 const shown=()=>pages()[0].children.map(i=>[/page-([a-z]+-[a-z]+)\.webp/.exec(i.style.backgroundImage)?.[1],Number(i.style.opacity)]);
 assert.equal(pages().length,1);assert.equal(h.rd.getAttribute('data-page-land'),land,'the dashboard says which land it stands in, for that land\'s frames');
 const page=pages()[0];assert.ok(page.hasAttribute('data-rd-keep')&&page.getAttribute('aria-hidden')==='true','kept through renders, not read out');assert.equal(page.style.top,'300px','it starts where the band ends');
 assert.deepEqual(shown(),[[land+'-noon',1]]);const [one]=page.children;assert.equal(one.tagName,'I');assert.equal(one.style.backgroundImage,'url("chrome-extension://train-test/themes/train/page-'+land+'-noon.webp")','the sky, which stands');
 assert.equal(one.style.backgroundSize,r1(4096*k)+'px auto','at the band\'s own scale');assert.equal(one.style.backgroundPosition,r1(f.x)+'px 0','and under the band\'s own picture');
 assert.equal(h.rd.style['--tk-floor-y'],undefined,'no wooden floor');assert.equal(days().length,0,'and no window light on it');
 // over the sky the layers that travel: each a holder with a bar in it one picture longer than the page, its picture again and again
 // along it, sliding one picture's length for ever at its own speed
 const holders=()=>pages()[0].children[0].children.filter(n=>n.tagName==='U'),bars=()=>holders().map(u=>u.children[0]),running=el=>h.live().filter(a=>a.el===el);
 assert.equal(holders().length,info.move.length);assert.ok(holders().every(u=>u.children.length===1));
 // and over them, across the page's top, the carriage's own underside in the light of that hour: the cabin's, so it does not move
 const under=()=>pages()[0].children.map(i=>i.children[i.children.length-1]);
 {const [em]=under();assert.equal(em.tagName,'EM');assert.equal(em.style.backgroundImage,'url("chrome-extension://train-test/themes/train/under.webp")');assert.equal(em.style.backgroundSize,r1(4096*k)+'px '+r2(900*k)+'px');assert.equal(em.style.backgroundPosition,r1(f.x)+'px '+r2(-180*k)+'px','noon\'s row, under the band\'s own picture');assert.equal(em.style.height,Math.ceil(172*k)+'px');assert.equal(running(em).length,0);}
 assert.deepEqual(bars().map(bar=>[bar.tagName,Number(/page-[a-z]+-noon-([0-9])\.webp/.exec(bar.style.backgroundImage)?.[1])]),info.move.map(m=>['B',m[0]]),'the far land, the near land, our bridge, back to front');
 bars().forEach((bar,i)=>{
  assert.equal(bar.style.backgroundSize,r1(4096*k)+'px auto');assert.equal(bar.style.backgroundPosition,r1(f.x)+'px 0');assert.equal(bar.style.width,'calc(100% + '+Math.ceil(r1(4096*k)+2)+'px)');assert.equal(bar.style.height,Math.ceil(r1(4096*k)*1738/4096)+'px');
  const [run,...more]=running(bar);assert.equal(more.length,0);assert.deepEqual(copy(run.keyframes),[{transform:'translate3d(0,0,0)'},{transform:'translate3d('+r2(-4096*k)+'px,0,0)'}]);
  assert.equal(run.options.duration,4096/info.move[i][1]*1000);assert.equal(run.options.iterations,Infinity);assert.equal(run.startTime,0,'from the journey\'s start');
 });
 // what is outside rides against the room, as a carriage moves: each holder runs one loop of the ride for ever, carried sideways and
 // up and down and tilted a little; the land as the land in the window is (the window's is in the band's own pixels), our bridge,
 // which is close, also by its bounce
 const part=(el,n)=>running(el).flatMap(a=>a.keyframes.map(fr=>Math.abs(Number(/translate3d\((-?[\d.]+)px,(-?[\d.]+)px/.exec(fr.transform)[n])))),reach=el=>Math.max(...part(el,2)),out=h.rd.querySelector('.tk-out'),rate=p=>!(p>0)?0:p<1?.6+.4*p:Math.min(2,1+.2*Math.log2(p));
 holders().forEach(u=>{const [ride,...more]=running(u);assert.equal(more.length,0);assert.equal(ride.options.duration,WIN);assert.equal(ride.options.fill,'both');assert.equal(ride.startTime,0);assert.ok(ride.keyframes.every(fr=>/^translate3d\(-?[\d.]+px,-?[\d.]+px,0\) rotate\(-?0?deg\)$/.test(fr.transform)),'no tilt');});
 // (4.0.170: the world outside is one rigid thing: every layer under the room the same keyframes)
 const keysOf=u=>JSON.stringify(running(u)[0].keyframes.map(fr=>fr.transform));holders().forEach(u=>assert.equal(keysOf(u),keysOf(holders()[0]),'every layer rides as one'));
 assert.equal(running(out).length,1);assert.ok(running(out)[0].keyframes.every(fr=>/^translate3d\(-?[\d.]+px,-?[\d.]+px,0\)$/.test(fr.transform)));
 info.move.forEach((m,i)=>assert.ok(Math.abs(reach(holders()[i])-reach(out)*k)<.2,'layer '+m[0]+' rides as the land in the window does'));const calm=reach(out);
 // the window shows the same land layers, at the same speeds, from the same moment: one world above and below the room
 const strips_=()=>h.rd.querySelectorAll('.tk-strip');assert.equal(strips_().length,lands.length);
 strips_().forEach((strip,i)=>{const [run]=running(strip);assert.deepEqual(copy(run.keyframes),[{transform:'translate3d(0,0,0)'},{transform:'translate3d(-4096px,0,0)'}]);assert.equal(run.options.duration,4096/lands[i][1]*1000);assert.equal(run.startTime,0);assert.equal(strip.children[1].style.left,'4096px','its picture runs on into itself');});
 // the speed control: drawn in the room, on the laptop's screen, at the band's own place and scale; it starts at the land's own stop
 // (rooms.train.lever, read from the engine's own words: where the screen lies, its stops, the pace of each)
 const lever=h.rd.children.find(n=>n.classList.contains('tk-lever')),spec=JSON.parse(/lever:(\{.*?\}),floor:/.exec(DENSE())[1].replace(/([{,])([a-z]+):/g,'$1"$2":').replace(/'/g,'"').replace(/([:,\[])\./g,(all,before)=>before+'0.'));
 assert.ok(lever&&!lever.hidden&&lever.hasAttribute('data-rd-keep'));assert.ok(h.rd.children.indexOf(lever)>h.rd.children.indexOf(h.sky()),'in the wall\'s layer: laid after the band');assert.equal(lever.getAttribute('role'),'slider');assert.equal(lever.getAttribute('aria-label'),'Train speed');assert.equal(lever.getAttribute('tabindex'),'0');
 assert.equal(lever.getAttribute('aria-valuemax'),String(spec.paces.length-1));assert.equal(lever.getAttribute('aria-valuenow'),String(spec.paces.indexOf(1)));assert.equal(lever.getAttribute('aria-valuetext'),'Cruise');
 assert.equal(lever.style.left,r2(f.x+spec.x*k)+'px');assert.equal(lever.style.top,r2(f.y+spec.y*k)+'px');assert.equal(lever.style.width,r2(spec.w*k)+'px');
 const plate=lever.children[0],knob=lever.children[lever.children.length-1],lit=lever.children.slice(1,-1);assert.equal(plate.tagName,'I');assert.equal(knob.tagName,'B');assert.equal(lit.length,spec.stops.length);assert.ok(lit.every(n=>n.tagName==='U'));assert.equal(lever.getAttribute('aria-orientation'),'horizontal');assert.equal(lever.style['--tk-grow']??String(spec.grow),String(spec.grow));
 const lights=()=>lit.map(n=>n.style.opacity).join('');assert.equal(plate.style.backgroundImage,'url("chrome-extension://train-test/themes/train/lever.webp")');
 assert.equal(plate.style.backgroundPosition,r2(-(1*spec.cell/spec.zoom)*k)+'px 0','noon\'s screen');assert.equal(knob.style.transform,'translate3d('+r2(spec.stops[spec.paces.indexOf(1)]*k)+'px,0,0)','the knob at the land\'s own stop');assert.equal(lights(),'0110','two bars lit, the stop mark dark');
 assert.equal(lit[2].style.left,r2((spec.stops[2]-spec.half)*k)+'px');assert.equal(lit[2].style.backgroundPosition,r2(-(spec.cell/spec.zoom+spec.stops[2]-spec.half)*k)+'px '+r2(-spec.h*k)+'px','its own strip of what is lit');assert.equal(knob.style.backgroundPosition,r2(-(spec.cell/spec.zoom)*k)+'px '+r2(-2*spec.h*k)+'px');
 // a notch up after ten seconds: everything goes faster by that notch's pace, from where the journey had come to (ten seconds' worth)
 const key=name=>lever.dispatchEvent({type:'keydown',key:name,bubbles:false,preventDefault(){}}),fast=spec.paces[spec.paces.length-1],placeOf=(speed,far,ms)=>T-((speed*far)%4096)/4096*ms;
 const posterSwing=()=>{const a=h.live().find(a=>a.el.getAttribute?.('data-piece')==='city poster'&&/rotate/.test(a.keyframes[0].transform||''));return a?Math.max(...a.keyframes.map(fr=>Math.abs(Number(/rotate\((-?[\d.]+)deg\)/.exec(fr.transform)[1])))):0;},calmSwing=posterSwing();assert.ok(calmSwing>0,'the poster swings');
 T=10000;key('ArrowUp');await settle();assert.equal(lever.getAttribute('aria-valuetext'),'Fast');assert.ok(posterSwing()/calmSwing>1.4&&posterSwing()/calmSwing<2.6,'a thing that hangs in the room swings with more force at speed: '+posterSwing()/calmSwing);assert.equal(knob.style.transform,'translate3d('+r2(spec.stops[spec.stops.length-1]*k)+'px,0,0)');assert.equal(lights(),'0111');
 bars().forEach((bar,i)=>{const [run,...more]=running(bar),ms=4096/(info.move[i][1]*fast)*1000;assert.equal(more.length,0,'the slower run is over');assert.equal(run.options.duration,ms);assert.ok(Math.abs(run.startTime-placeOf(info.move[i][1],10,ms))<1e-6,'it goes on from where it was');});
 strips_().forEach((strip,i)=>{const [run,...more]=running(strip),ms=4096/(lands[i][1]*fast)*1000;assert.equal(more.length,0);assert.equal(run.options.duration,ms);assert.ok(Math.abs(run.startTime-placeOf(lands[i][1],10,ms))<1e-6,'the window is at the same place of the journey');});
 // and what rides takes the new window of the journey (worked out again from the moment of the change), what is outside shaking more,
 // inside and under the room alike
 const riders=()=>[...holders().map(u=>running(u)[0]),running(out)[0],...h.live().filter(a=>a.el.classList.contains('tk-piece')&&a.options.duration===WIN&&a.keyframes.some(fr=>/rotate|skewX|translate3d/.test(fr.transform||'')))];
 assert.ok(riders().length>holders().length+20);for(const a of riders()){assert.equal(a.options.duration,WIN);assert.equal(a.startTime,10000,'the window of now');}
 assert.ok(reach(out)>.2&&reach(out)<=1.9+1e-9&&calm>.2,'at speed the land outside still rides, a little (4.0.170): '+reach(out)+' '+calm);info.move.forEach((m,i)=>assert.ok(Math.abs(reach(holders()[i])-reach(out)*k)<.25,'layer '+m[0]+' rides as one with the window'));
 key('ArrowUp');await settle();assert.equal(lever.getAttribute('aria-valuetext'),'Fast','no notch beyond the last');
 // down to the first notch after four more seconds: the train stands where it had come to (10 s at the land's pace, 4 s fast), and
 // nothing rides: no strip slides, no piece swings; the room's own life (the steam, the clocks) goes on
 T=14000;key('Home');await settle();const far=10+4*fast;assert.equal(lever.getAttribute('aria-valuetext'),'Stopped');
 bars().forEach((bar,i)=>{assert.equal(running(bar).length,0);assert.equal(bar.style.transform,'translate3d('+r2(-((info.move[i][1]*far)%4096)*k)+'px,0,0)');});
 strips_().forEach((strip,i)=>{assert.equal(running(strip).length,0);assert.equal(strip.style.transform,'translate3d('+Math.round(-((lands[i][1]*far)%4096)*1000)/1000+'px,0,0)');});
 // (what was knocked as the train stopped rings down; a few windows later nothing outside shakes and no piece rides)
 T=60000;await h.minute();assert.ok(holders().every(u=>running(u).length===0)&&running(out).length===0,'nothing outside shakes while the train stands');
 // (4.2.9, the owner: "when the train is stopped there is no animation") the room is not dead at a stand: what hangs stirs a little in
 // the room's own air, what is soft bends a little, the cat breathes; nothing hops, nothing slides, nothing is knocked
 const idle=h.live().filter(a=>a.el.classList.contains('tk-piece')&&a.keyframes.some(fr=>/rotate|skewX|translate3d/.test(fr.transform||'')));
 assert.ok(idle.length>20,'at a stand what hangs stirs: '+idle.length);let stirs=0;
 for(const a of idle)for(const fr of a.keyframes){const t=fr.transform||'',deg=/(?:rotate|skewX)\((-?[\d.e-]+)deg\)/.exec(t),hop=/translate3d\(0,(-?[\d.e-]+)px,0\)/.exec(t),slide=/translate3d\((-?[\d.e-]+)px,0,0\)/.exec(t);
  if(deg){assert.ok(Math.abs(+deg[1])<=3,'a stir, not a swing: '+t);if(Math.abs(+deg[1])>.1)stirs++;}if(hop)assert.ok(Math.abs(+hop[1])<.08,'nothing hops at a stand: '+t);if(slide)assert.ok(Math.abs(+slide[1])<.08,'nothing slides at a stand: '+t);}
 assert.ok(stirs>40,'and it is plain to see: '+stirs);
 assert.ok(h.live().some(a=>a.el.classList.contains('tk-puff')),'the kettle still steams');
 // and off again at the land's own pace
 T=60000;key('End');key('ArrowDown');await settle();assert.equal(lever.getAttribute('aria-valuetext'),'Cruise');
 bars().forEach((bar,i)=>{const [run]=running(bar),ms=4096/info.move[i][1]*1000;assert.equal(bar.style.transform,'');assert.equal(run.options.duration,ms);assert.ok(Math.abs(run.startTime-placeOf(info.move[i][1],far,ms))<1e-6);});
 assert.ok(h.live().some(a=>a.el.classList.contains('tk-piece')&&a.keyframes.some(fr=>/rotate|skewX/.test(fr.transform||''))),'the pieces ride again');
 // Graphics Low: nothing travels; the land rests as it was composed, the lever keeps its notch
 h.rd.setAttribute('data-graphics','low');await h.mutate();await h.load();bars().forEach(bar=>{assert.equal(running(bar).length,0);assert.equal(bar.style.transform,'');});strips_().forEach(strip=>assert.equal(running(strip).length,0));
 assert.equal(lever.getAttribute('aria-valuetext'),'Cruise');h.rd.setAttribute('data-graphics','high');await h.mutate();await h.load();assert.ok(bars().every(bar=>running(bar).length===1));
 // a stage fading into the next: both hours' pictures, the coming one as strong as the band shows it; then the one
 h.clock.hour=hm('14:40');await h.minute();await h.load();await h.minute();assert.deepEqual(shown(),[[land+'-noon',1],[land+'-sunset',.5]]);assert.ok(pages()[0].children.every(i=>i.children.length===info.move.length+1&&i.children.filter(n=>n.tagName==='U').every(u=>running(u).length===1&&running(u.children[0]).length===1)));assert.deepEqual(under().map(em=>em.style.backgroundPosition),[r1(f.x)+'px '+r2(-180*k)+'px',r1(f.x)+'px '+r2(-360*k)+'px'],'each hour its own underside');
 h.clock.hour=17;await h.minute();await h.load();await h.minute();assert.deepEqual(shown(),[[land+'-sunset',1]]);
 // Thursday is the glass city, which has no page in the tests' world: the room's floor and its light come back (the lever stays: its strips travel too)
 Object.assign(h.clock,{date:5,day:4,hour:12});await h.minute();await h.load();await h.minute();await h.load();
 assert.equal(pages().length,0);assert.equal(h.rd.getAttribute('data-page-land'),null);assert.ok(h.rd.style['--tk-floor-y']);assert.equal(days().length,2);assert.ok(!lever.hidden);
 // and back on the land's own day; Dark keeps its own page (and the lever); removing the scene leaves nothing
 Object.assign(h.clock,{date,day});await h.minute();await h.load();await h.minute();await h.load();assert.equal(pages().length,1);assert.equal(days().length,0);
 h.rd.setAttribute('data-theme','dark');await h.mutate();await h.load();assert.equal(pages().length,0,'Dark is not laid over');assert.equal(h.rd.getAttribute('data-page-land'),null);assert.ok(!lever.hidden,'the night carriage has its lever');assert.equal(plate.style.backgroundPosition,r2(-(4*spec.cell/spec.zoom)*k)+'px 0','night\'s screen');
 h.rd.setAttribute('data-theme','light');await h.mutate();await h.load();await h.minute();await h.load();assert.equal(pages().length,1);
 // a press on the screen puts the knob at the nearest stop, by where the press is across the screen as it is drawn then (the keys'
 // ring of light is for the keys only); held, it stays grown
 key('ArrowUp');assert.ok(lever.hasAttribute('data-keys'));const wide=lever.getBoundingClientRect().width;lever.dispatchEvent({type:'pointerdown',button:0,clientX:spec.stops[1]/spec.w*wide,clientY:4,bubbles:false,preventDefault(){}});await settle();assert.equal(lever.getAttribute('aria-valuetext'),'Slow');assert.ok(!lever.hasAttribute('data-keys'));assert.ok(lever.hasAttribute('data-held'));assert.equal(lights(),'0100');
 key('Home');await settle();assert.equal(lights(),'1000','stopped: the stop mark alone');key('End');key('ArrowDown');key('ArrowDown');await settle();assert.equal(lever.getAttribute('aria-valuetext'),'Slow');
 h.api.remove();assert.equal(pages().length,0);assert.equal(h.rd.getAttribute('data-page-land'),null);assert.equal(h.rd.children.filter(n=>n.classList.contains('tk-lever')).length,0);assert.equal(h.live().length,0,'nothing left moving');
});
// 4.0.178 (the owner: "I still see a flash of the older wooden floor and carpet background when the theme is loading"): the land is worn
// (data-page-land: its frames and its page's ground) from the first moment the scene is on, before the band or the land's page has
// answered, so the first cabin's floor and rugs (gone from theme.css and the package) never show: at the start, at Graphics Low, at
// midnight, with a band that cannot be read; not in Dark, and not once the scene is gone.
test('the land is worn from the first moment the scene is on: no frame of the first cabin while it loads',async t=>{
 const land=LANDS.find(name=>PAGED[name]?.move?.length);if(!land){t.skip('no land travels yet');return;}
 const day=WEEK.indexOf(land),date=8+day;
 for(const graphics of ['high','low']){
  const h=fixture({graphics,clock:{date,day}});t.after(()=>h.api.remove());
  h.apply();assert.equal(h.rd.getAttribute('data-theme-kit'),'train');assert.equal(h.rd.getAttribute('data-page-land'),land,'worn at once with the scene ('+graphics+'), before anything is read: '+h.fetched.join(','));
  await h.load();await h.minute();await h.load();assert.equal(h.rd.getAttribute('data-page-land'),land,'and kept once its page is laid');
  // (midnight: the next day's land)
  const next=(day+1)%7,other=landOf(next);Object.assign(h.clock,{date:date+1,day:next,hour:0});await h.minute();await h.load();
  assert.equal(h.rd.getAttribute('data-page-land'),PAGED[other]?other:null,'at midnight the next land');
  h.api.remove();assert.equal(h.rd.getAttribute('data-page-land'),null,'gone with the scene');
 }
 const dark=fixture({theme:'dark',clock:{date,day}});t.after(()=>dark.api.remove());dark.apply();await dark.load();assert.equal(dark.rd.getAttribute('data-page-land'),null,'Dark wears none');
 const failed=fixture({missing:['ride.json'],clock:{date,day}});t.after(()=>failed.api.remove());failed.apply();await failed.load();await failed.minute();await failed.load();
 assert.equal(failed.rd.getAttribute('data-page-land'),land,'a band that cannot be read keeps the land\'s frames');
 // (whatever comes first, it is never that room: theme.css names none of its pictures)
 const css=read('themes/train/theme.css');for(const file of OLD_ROOM)assert.ok(!new RegExp('(?<![a-z-])'+file.replace('.','\\.')).test(css),file);
});
// Megapack (4.2): a build without the scene's downloaded files, and no complete download on this machine: the scene is not put on
// (no half scene) and the dashboard says so on data-megapack ("missing"); once the record says the files are all here it goes on;
// Canvas's own page never lays a fallback from files it does not have: the band is the packaged poster, the land is not laid.
test('a megapack whose files are neither packaged nor here is not put on; the record puts it on; Canvas\'s page shows the poster',async t=>{
 const land=LANDS.find(name=>PAGED[name]?.move?.length);const day=WEEK.indexOf(land),date=8+day;
 const h=fixture({clock:{date,day}});t.after(()=>h.api.remove());
 let record=null;const changes=[],tell=()=>{for(const fn of changes)fn({'megapack:soul-passage':{newValue:record}},'local');};
 h.env.chrome.runtime.getManifest=()=>({web_accessible_resources:[{resources:['themes/train/theme.css','themes/train/ride.json','themes/train/poster.jpg','themes/train/kit-sea-label.png']}]});
 h.env.chrome.storage={local:{get:(key,cb)=>cb({[key]:record})},onChanged:{addListener:fn=>changes.push(fn)}};
 h.apply();await settle();
 assert.equal(h.rd.getAttribute('data-theme-kit'),null,'no scene');assert.equal(h.rd.getAttribute('data-megapack'),'missing','and the picker can read why');assert.deepEqual(h.fetched,[],'nothing read');
 assert.equal(await h.api.megapack('train'),'none');h.apply();await settle();assert.equal(h.rd.getAttribute('data-megapack'),'missing','a render meanwhile keeps it so');
 record={version:1,engine:1,bytes:1,count:1,manifest:'c'.repeat(64),names:{[cabFiles('metro','noon')[0]]:'a'.repeat(64)+'.webp'},at:1};tell();await settle();await h.load();
 assert.equal(h.rd.getAttribute('data-theme-kit'),'train','the record has come: the scene goes on');assert.equal(h.rd.getAttribute('data-megapack'),null);assert.equal(await h.api.megapack('train'),'here');
 // (this is Canvas's page with no band frame: nothing laid from files it does not have, the packaged poster instead)
 assert.equal(h.poster()?.hidden,false,'the poster');assert.equal(h.poster().getAttribute('src'),'chrome-extension://train-test/themes/train/poster.jpg');
 assert.ok(!h.fetched.some(f=>/^(cabin|pieces|land|page|under|live|sun)-/.test(f)),'no downloaded-kind file asked of the package: '+h.fetched.join(','));
 assert.equal(h.rd.querySelectorAll('.tk-page').length,0,'no land laid in Canvas\'s page');
 // (removed while it is worn: the scene goes, and says so)
 record=null;tell();await settle();await settle();
 assert.equal(h.rd.getAttribute('data-theme-kit'),null,'removed: the scene goes');assert.equal(h.rd.getAttribute('data-megapack'),'missing');
 h.api.remove();assert.equal(h.rd.getAttribute('data-megapack'),null,'taken down: nothing said');
});
// The speed control lies in the wall's layer, under the page's own things, and takes a press only where nothing of the page lies
// over it. The Home heading's words do lie over the laptop at some widths (courses down the side at 1366-1536 px, every layout at
// 1366): over the control they let the press through to it; a button in the heading, or a panel, keeps its own press.
test('the speed control takes a press through the heading\'s words over it, never through a button or a panel',async()=>{
 const h=fixture();h.apply();await h.load();await h.minute();await h.load();
 const lever=h.rd.children.find(n=>n.classList.contains('tk-lever'));assert.ok(lever&&!lever.hidden,'the speed control is laid');
 const heading=h.rd.querySelector('.rd-workspace-heading'),words=heading.querySelector('h1'),now=()=>lever.getAttribute('aria-valuetext');
 const r=lever.getBoundingClientRect(),right=r.left+r.width*.97,left=r.left+r.width*.03,y=r.top+r.height/2;
 const press=(top,x)=>h.rd.dispatchEvent({type:'pointerdown',button:0,clientX:x,clientY:y,target:top,bubbles:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}});
 assert.equal(now(),'Cruise');
 // the heading's words over the laptop
 h.shadow.elementsFromPoint=()=>[words,heading,lever.children[0],lever,h.rd];
 press(words,right);await settle();assert.equal(now(),'Fast','a press on the heading\'s words over the screen reaches it');
 press(words,left);await settle();assert.equal(now(),'Stopped');
 // a button in the heading over it keeps its own press
 const chip=h.document.createElement('button');heading.append(chip);h.shadow.elementsFromPoint=()=>[chip,heading,lever.children[0],lever,h.rd];
 press(chip,right);await settle();assert.equal(now(),'Stopped','a button over it keeps the press');
 // words in a panel over it keep it too
 const panel=h.document.createElement('section');panel.className='rd-widget';h.rd.append(panel);const said=h.document.createElement('p');panel.append(said);
 h.shadow.elementsFromPoint=()=>[said,panel,lever.children[0],lever,h.rd];press(said,right);await settle();assert.equal(now(),'Stopped','a panel over it keeps the press');
 // and with nothing over it, as before
 h.shadow.elementsFromPoint=()=>[heading,lever.children[0],lever,h.rd];press(heading,right);await settle();assert.equal(now(),'Fast');
 h.api.remove();
});
test('the look at another day and hour (reserve:train-preview): the band and the page are laid as on that weekday at that stage of the day; set back, they follow the clock',async t=>{
 // ({day, hour} kept under reserve:train-preview; the scene reads it and hears it change)
 const land=LANDS.find(name=>PAGED[name]?.move?.length&&name!=='metro');if(!land){t.skip('no land travels yet');return;}
 // (4.2: the scene also hears its speed stop change, so every listener is told; both go with the scene)
 const h=fixture();let kept={day:WEEK.indexOf(land),hour:17},gone=0;const all=new Set(),heard=(changes,area)=>{for(const fn of [...all])fn(changes,area);};
 h.env.chrome.storage={local:{get:(key,done)=>done({[key]:kept})},onChanged:{addListener:fn=>all.add(fn),removeListener:fn=>{if(all.delete(fn))gone++;}}};
 h.apply();await h.load();await h.minute();await h.load();
 assert.deepEqual(h.layers(),[['land-'+land+'-sunset',1],[cab(land,'sunset'),1]],'that weekday\'s land, in the evening, though the clock says Thursday noon');assert.equal(h.rd.getAttribute('data-page-land'),land);
 // changed in the popup: Thursday's land, at night; Dark keeps its own night
 kept={day:4,hour:1};heard({'reserve:train-preview':{newValue:kept}},'local');await h.load();await h.minute();await h.load();assert.deepEqual(h.layers(),[['land-metro-night',1],[cab('metro','night'),1]]);
 heard({'reserve:train-preview':{newValue:{day:4,week:2}}},'local');await h.load();await h.minute();await h.load();assert.deepEqual(h.layers().map(l=>l[0]),['land-metro-noon',cab('metro','noon')],'a record from before 4.2.2 for the even week\'s Thursday: Thursday\'s land, at the clock\'s own hour');
 heard({'other':{newValue:1}},'local');heard({'reserve:train-preview':{newValue:{day:9,hour:'x'}}},'sync');await h.load();await h.minute();assert.deepEqual(h.layers().map(l=>l[0]),['land-metro-noon',cab('metro','noon')],'only its own key, only its own store');
 // set back: the clock again (Thursday 5 November 2026, noon)
 heard({'reserve:train-preview':{}},'local');await h.load();await h.minute();await h.load();assert.deepEqual(h.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]]);
 h.api.remove();assert.equal(gone,2,'it stops listening when the scene goes');assert.equal(all.size,0);
});
// (4.2.2) The deep sea is gone. A look at it kept from before (Canvas Harness's Scenery "Drowned sea" or Make it yours > Adjust > Land
// "Deep sea": {day:4, week:1}) is no day chosen: today's own land, the light it names kept; nothing of the deep sea is asked for, the
// band is whole, nothing falls back to the poster. The glass city's record (week 2) is Thursday's land, as it was.
test('a look at the deep sea kept from before 4.2.2 is today\'s own land with its light; no error, no missing picture',async t=>{
 // Monday 9 November 2026, noon: the mirror sea's day
 const h=fixture({clock:{day:1,date:9}});const all=new Set(),heard=(changes,area)=>{for(const fn of [...all])fn(changes,area);};
 h.env.chrome.storage={local:{get:(key,done)=>done({[key]:{day:4,week:1,hour:17}})},onChanged:{addListener:fn=>all.add(fn),removeListener:fn=>all.delete(fn)}};
 t.after(()=>h.api.remove());h.apply();await h.load();await h.minute();await h.load();
 assert.deepEqual(h.layers(),[['land-sea-sunset',1],[cab('sea','sunset'),1]],'Monday\'s own land, in the evening the record names');assert.equal(h.rd.getAttribute('data-page-land'),'sea');
 heard({'reserve:train-preview':{newValue:{day:4,week:1}}},'local');await h.load();await h.minute();await h.load();assert.deepEqual(h.layers(),[['land-sea-noon',1],[cab('sea','noon'),1]],'without a light: the clock, as if nothing was chosen');
 heard({'reserve:train-preview':{newValue:{day:4,week:2,hour:1}}},'local');await h.load();await h.minute();await h.load();assert.deepEqual(h.layers(),[['land-metro-night',1],[cab('metro','night'),1]],'the glass city\'s record: Thursday');
 assert.ok(!h.fetched.some(file=>/abyss/.test(file)),'nothing of the deep sea is asked for: '+h.fetched.join(','));
 assert.ok(h.sky().querySelector('.tk-band').hasAttribute('data-ready'),'the band is whole');assert.equal(h.poster().getAttribute('src'),null,'never the poster');
});
// (4.2) The speed stop chosen anywhere else (Make it yours > Look: Speed, or the lever in another tab) is heard from the store: the lever
// and the ride go to it, eased as under a hand, and nothing is written back; a stop the page chose itself is not taken twice.
test('the speed stop chosen elsewhere moves the lever and the ride, eased, and is not written back',async t=>{
 const h=fixture();t.after(()=>h.api.remove());let kept={};const all=new Set(),written=[],tell=value=>{for(const fn of [...all])fn({'reserve:train-pace':{newValue:value}},'local');};
 h.env.chrome.storage={local:{get:(key,done)=>done({[key]:kept[key]}),set:value=>{written.push({...value});Object.assign(kept,value);}},onChanged:{addListener:fn=>all.add(fn),removeListener:fn=>all.delete(fn)}};
 h.apply();await h.load();await h.minute();await h.load();
 const lever=h.rd.children.find(n=>n.classList.contains('tk-lever')),now=()=>lever.getAttribute('aria-valuetext');assert.ok(lever);assert.equal(now(),'Cruise');
 tell(3);await settle();assert.equal(now(),'Fast','the lever goes to the stop');assert.deepEqual(written,[],'nothing written back');
 tell(0);await settle();assert.equal(now(),'Stopped');tell(1);await settle();assert.equal(now(),'Slow');
 for(const bad of [4,-1,1.5,'x',undefined])tell(bad);await settle();assert.equal(now(),'Slow','a stop that is not one is not taken');
 for(const fn of [...all])fn({'reserve:train-pace':{newValue:3}},'sync');await settle();assert.equal(now(),'Slow','only its own store');
 // a stop the student chose on the lever itself: written once, and its echo from the store changes nothing
 lever.dispatchEvent({type:'keydown',key:'End',bubbles:false,preventDefault(){}});await settle();assert.equal(now(),'Fast');assert.deepEqual(written,[{'reserve:train-pace':3}]);
 tell(3);await settle();assert.equal(now(),'Fast');assert.deepEqual(written,[{'reserve:train-pace':3}],'its echo is not taken again');
 h.api.remove();assert.equal(all.size,0,'it stops listening when the scene goes');
});
test('inside the extension the light runs from the band page\'s own moment, so the page and the band move as one',async t=>{
 const h=fixture({framed:true});t.after(()=>h.api.remove());h.env.performance.timeOrigin=1762900000000;h.apply();await settle();
 await h.say({tkBand:1,ready:true,origin:1762900000412.4});await h.turn();await h.minute();await settle();
 const day=h.rd.children.find(n=>n.classList.contains('tk-day')),strips=h.live().filter(a=>a.el.tagName==='B'),leans=h.live().filter(a=>a.el.tagName==='I');
 assert.ok(day,'the light is laid without waiting for the band\'s pictures');assert.equal(strips.length,3);assert.equal(leans.length,2);
 assert.ok([...strips,...leans].every(a=>a.startTime===412),'everything starts 412 ms into this page: the moment the band\'s page began');
 // a moment that cannot be right is not believed
 const far=fixture({framed:true});t.after(()=>far.api.remove());far.env.performance.timeOrigin=1762900000000;far.apply();await settle();
 await far.say({tkBand:1,ready:true,origin:'soon'});await far.turn();await far.minute();await settle();assert.ok(far.live().filter(a=>a.el.tagName==='B').every(a=>a.startTime===0));
});
// Dark is the student's own choice, and the theme's Dark is the night carriage: the band shows its night at every hour then.
test('Dark, chosen by the student, is the night carriage at every hour; Light follows the clock',async t=>{
 const dark=fixture({theme:'dark'});t.after(()=>dark.api.remove());dark.apply();await dark.load();
 assert.deepEqual(dark.layers(),[['land-metro-night',1],[cab('metro','night'),1]],'noon on the clock, night in the band');assert.equal(dark.rd.getAttribute('data-band-stage'),'night');
 dark.clock.hour=16.5;await dark.minute();await dark.load();assert.deepEqual(dark.layers(),[['land-metro-night',1],[cab('metro','night'),1]]);
 const light=fixture({});t.after(()=>light.api.remove());light.apply();await light.load();assert.deepEqual(light.layers(),[['land-metro-noon',1],[cab('metro','noon'),1]]);
});


// Diagnosis of 4.0.164 (problem 1): the cabin is 2368 CSS px wide at the room's band height (268 + 28 px) and pinned right, so a
// wider dashboard showed a bare strip at its left. Wider than that, the band grows with the width and the cabin covers it whole;
// up to that width it is the room's own 268 px, as before.
test('a dashboard wider than the cabin at the room\'s height gets a taller band, so the cabin always covers the whole width',async t=>{
 for(const [w,band] of [[1366,268],[1920,268],[2368,268],[2369,269],[2600,297],[3840,452]]){
  const h=fixture();t.after(()=>h.api.remove());h.rd.getBoundingClientRect=()=>({left:0,top:0,width:w,height:300,right:w,bottom:300});
  h.apply();await h.load();
  assert.equal(h.sky().style['--tk-band'],band+'px','band at '+w+' px');
  const f=K.fit({w:4096,h:512},{w,h:band+28},{focus:{x:1,y:.5},keep:{x:2000/4096,y:0,w:2096/4096,h:1}});
  assert.ok(f.covers&&f.x<=.5&&f.x+f.w>=w-.5&&f.y<=.5&&f.y+f.h>=band+28-.5,'the cabin covers the band at '+w+' px');
 }
});

// Engine 2, part 1: inside the extension the land under the room is a page of its own (themes/train/page.html) in a frame, as the band
// is. The dashboard keeps a holder where the land lay (its place, the land's foot colour under the picture) with the frame in it; the
// frame's page lays the land with the same engine (pageHere: roomPage and a ride of its own) and moves it from the same moments.
const pagedLand=()=>{const land=LANDS.find(name=>PAGED[name]?.move?.length);return land?{land,day:landOf(4,46)===land?4:WEEK.indexOf(land)}:null;};
test('inside the extension the land under the room is its own page in a frame: a holder in its place, the moment on that page\'s clock, and the land laid here if the page fails',async t=>{
 const one=pagedLand();if(!one){t.skip('no land travels yet');return;}
 const {land,day}=one,info=PAGED[land],r3=n=>Math.round(n*1000)/1000;let T=0;
 const make=()=>{const h=fixture({framed:true,clock:{date:8+day,day},now:()=>T});h.env.performance.timeOrigin=1762900000000;h.rd.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:1600,right:1366,bottom:1600});return h;};
 const h=make();t.after(()=>h.api.remove());h.apply();await h.load();
 const band=h.rd.querySelector('.tk-frame');await h.say({tkBand:1,ready:true,origin:1762900000400},{source:band.contentWindow});
 const holder=()=>h.rd.children.find(n=>n.classList.contains('tk-page')),page=holder();assert.ok(page,'a holder where the land lies');
 const frame=page.children[0];assert.equal(page.children.length,1,'nothing but the frame: no layers, no bars in the dashboard');assert.equal(frame.tagName,'IFRAME');assert.equal(frame.className,'tk-pageframe');
 assert.equal(frame.getAttribute('src'),'chrome-extension://train-test/themes/train/page.html');assert.equal(frame.getAttribute('aria-hidden'),'true');assert.equal(frame.getAttribute('tabindex'),'-1');
 // (it lies under the band, from the band's top: clear down to where the land starts, the land's foot colour below)
 assert.ok(page.hasAttribute('data-rd-keep')&&page.getAttribute('aria-hidden')==='true');assert.equal(page.style.top,'0px');assert.equal(page.style.height,'1600px');assert.equal(page.style.backgroundImage,'linear-gradient(180deg,transparent 300px,'+info.foot.noon+' 300px)','the land\'s foot colour under the picture');
 assert.ok(h.rd.children.indexOf(page)<h.rd.children.indexOf(h.sky()),'under the band');
 const f=K.fit({w:4096,h:512},{w:1366,h:296},{focus:{x:1,y:.5},keep:{x:2000/4096,y:0,w:2096/4096,h:1}}),k=f.w/4096,tall=Math.min(1600,300+Math.ceil(4096*k*1738/4096)+2);
 assert.equal(frame.style.height,tall+'px','as tall as the band and the land\'s picture');assert.equal(h.rd.getAttribute('data-page-land'),land);
 assert.ok(!h.fetched.some(file=>file.startsWith('page-')),'the dashboard reads none of the land\'s pictures');
 const inside=el=>{for(let n=el;n;n=n.parentNode)if(n===page)return true;return false;};
 assert.ok(!h.live().some(a=>inside(a.el)),'and moves nothing of it');
 // nothing goes to the land's page before it says it is ready; then the moment, on its own clock
 assert.equal(frame.contentWindow.posts.length,0);
 await h.say({tkPage:1,ready:true,origin:1762900000250},{source:frame.contentWindow});await h.minute();await h.load();
 assert.equal(frame.contentWindow.posts.length,1);const [first,origin]=frame.contentWindow.posts[0];assert.equal(origin,'chrome-extension://train-test');assert.equal(first.tkPage,1);
 assert.deepEqual(first.show,{g:{x:r3(f.x),k:Math.round(k*1e6)/1e6,top:300,deep:tall,win:{x:r3(f.x),y:r3(f.y)}},land,hours:[['noon',1]],moving:2,travel:[1,0,0,0],epoch:150,most:4,still:0,paint:true,quality:2},'the band\'s travel as it is, and the band\'s page began 150 ms into the land\'s');
 // another window, another origin, other words: not heard
 await h.say({tkPage:1,failed:true},{source:{}});await h.say({tkPage:1,failed:true},{source:frame.contentWindow,origin:'https://example.org'});await h.say({failed:true},{source:frame.contentWindow});assert.ok(holder()===page&&frame.getAttribute('src'));
 // a notch up ten seconds on: the new travel goes once to the land's page
 const lever=h.rd.children.find(n=>n.classList.contains('tk-lever'));T=10000;lever.dispatchEvent({type:'keydown',key:'ArrowUp',bubbles:false,preventDefault(){}});await settle();
 const next=frame.contentWindow.posts.at(-1)[0].show;assert.deepEqual(next.travel,[4,9600,9.6,9.6],'pace, the moment on the band\'s clock, how far, how much of the ride');assert.equal(next.epoch,150);
 const sent=frame.contentWindow.posts.length;await h.minute();assert.equal(frame.contentWindow.posts.length,sent,'the same moment is not sent again');
 // Graphics Medium is told as such (the land's page rides its lighter half); a hidden tab rests it
 h.rd.setAttribute('data-graphics','medium');await h.mutate();await h.load();assert.equal(frame.contentWindow.posts.at(-1)[0].show.moving,1);h.rd.setAttribute('data-graphics','high');await h.mutate();await h.load();
 h.visibility('hidden');await h.minute();assert.equal(frame.contentWindow.posts.at(-1)[0].show.moving,0,'a hidden tab: the land stands');h.visibility('visible');await h.minute();await h.load();
 // the land's page fails: the dashboard lays the land itself, as before the frame
 await h.say({tkPage:1,failed:true},{source:frame.contentWindow});await h.minute();await h.load();
 const own=holder();assert.ok(own&&own!==page,'a land of the dashboard\'s own');assert.equal(own.querySelector('.tk-pageframe'),null);assert.equal(own.children[0].tagName,'I');assert.equal(frame.getAttribute('src'),null,'the frame is let go');
 // a land's page that never answers: nine seconds, then the same
 const mute=make();t.after(()=>mute.api.remove());mute.apply();await mute.load();await mute.say({tkBand:1,ready:true,origin:1762900000400},{source:mute.rd.querySelector('.tk-frame').contentWindow});
 const quiet=mute.rd.children.find(n=>n.classList.contains('tk-page'));assert.ok(quiet.querySelector('.tk-pageframe'));
 const wait=[...mute.timers].find(([,timer])=>timer.ms===9000);assert.ok(wait,'it is given nine seconds');mute.timers.delete(wait[0]);wait[1].fn();await mute.minute();await mute.load();
 assert.equal(mute.rd.children.find(n=>n.classList.contains('tk-page'))?.children[0]?.tagName,'I');
 // removing the scene takes it all away
 h.api.remove();assert.equal(h.rd.children.filter(n=>n.classList.contains('tk-page')).length,0);assert.equal(h.windowEvents.has('message'),false);
});
// themes/train/page.js, the land page's relay: it lays the land with the dashboard's own engine, listens to its parent only, and passes on
// only what a moment is made of.
test('the land\'s page listens to its parent only, bounds what it is told, and answers ready, placed and failed',async()=>{
 const said=[],shows=[];let cleared=0;const parent={postMessage(message,target){said.push([JSON.parse(JSON.stringify(message)),target]);}},listeners=new Map();
 const node={parentNode:null},host={kids:[],append(n){this.kids.push(n);n.parentNode=host;}},land={node,show(...args){shows.push(JSON.parse(JSON.stringify(args)));return args[1]==='mesa'||args[1]==='sea';},clear(){cleared++;node.parentNode=null;}};
 let made=null;const env=vm.createContext({URL,document:{querySelector:sel=>sel==='.tk-host'?host:null},location:{href:'chrome-extension://train-test/themes/train/page.html'},parent,
  ReserveSceneThemes:{pageHere(doc,base,id,on){made={base,id,on};return land;}},addEventListener:(type,fn)=>listeners.set(type,fn),performance:{timeOrigin:1762900000250.5}});
 env.globalThis=env;vm.runInContext(fs.readFileSync(path.join(dir,'page.js'),'utf8'),env,{filename:'page.js'});
 assert.deepEqual(said,[[{tkPage:1,ready:true,origin:1762900000250.5},'*']],'ready, once, with the moment the page began');assert.equal(made,null,'no land before the first moment');
 const hear=(data,source=parent)=>listeners.get('message')({source,data}),good={g:{x:-1210.5,k:.578125,deep:1007},land:'mesa',hours:[['noon',1]],moving:2,travel:[1,0,0,0],epoch:150,most:6};
 // someone else, other words, or no land: nothing
 hear({tkPage:1,show:good},{});hear({show:good});hear({tkPage:1,show:{...good,land:'Mesa!'}});hear({tkPage:1,show:{...good,g:{x:0,k:0,deep:10}}});hear({tkPage:1,show:{...good,hours:[['teatime',1]]}});assert.equal(made,null);assert.equal(shows.length,0);
 hear({tkPage:1,show:good});assert.equal(made.id,'train');assert.equal(made.base,'chrome-extension://train-test/themes/train/');assert.equal(host.kids[0],node);
 assert.deepEqual(shows[0],[{x:-1210.5,k:.578125,top:0,deep:1007,win:null},'mesa',[['noon',1]],2,[1,0,0,0],150,6,true]);assert.deepEqual(said.at(-1)[0],{tkPage:1,placed:true},'placed, once the land is laid');
 // bounded: every number within its range, the hours a stage of the day each, at most four
 hear({tkPage:1,show:{g:{x:9e9,k:99,top:-5,deep:9e9,y:3,win:{x:-9e9,y:9e9}},land:'sea',hours:[['noon',7],['dusk',-1],['x',1],['night',.5],['morning',.2],['sunset',.1]],moving:9,travel:[99,'soon',5e20,-7e20],epoch:9e9,most:50,more:1}});
 assert.deepEqual(shows[1],[{x:40000,k:8,top:0,deep:20000,win:{x:-40000,y:4000}},'sea',[['noon',1],['dusk',0],['night',.5]],2,[12,0,1e13,-1e13],864e5,12,true]);
 hear({tkPage:1,show:{...good,travel:'fast'}});assert.equal(shows[2][4],null);
 assert.equal(said.filter(([m])=>m.placed).length,3,'placed again for each new land laid');
 hear({tkPage:1,clear:true});assert.equal(cleared,1);hear({tkPage:1,show:good});assert.equal(node.parentNode,host,'laid again after a clear');
 // a failure is said once, and the land is not made again
 made.on.fail();made.on.fail();assert.deepEqual(said.at(-1)[0],{tkPage:1,failed:true});assert.equal(said.filter(([m])=>m.failed).length,1);
 const before=shows.length;hear({tkPage:1,show:good});assert.equal(shows.length,before);
});
// The land's page lays exactly what the dashboard laid before: the same layers, pictures, sizes and places, the same travel from the same
// moment of the journey, the same ride against the room.
test('the land\'s page lays the same land as the dashboard did: layers, pictures, places, the travel and the ride, from the same moments',async t=>{
 const one=pagedLand();if(!one){t.skip('no land travels yet');return;}
 const {land,day}=one,info=PAGED[land];
 // today's: laid in the dashboard's own page
 const h=fixture({clock:{date:8+day,day}});t.after(()=>h.api.remove());h.apply();await h.load();await h.minute();await h.load();
 const old=h.rd.children.find(n=>n.classList.contains('tk-page'));assert.ok(old);
 // the frame's: the same engine in another document, told the same moment (its clock 150 ms behind the band's page)
 const p=fixture({clock:{date:8+day,day}});const here=p.api.pageHere(p.env.document,'chrome-extension://train-test/themes/train/','train');p.rd.append(here.node);t.after(()=>here.clear());
 const f=K.fit({w:4096,h:512},{w:1366,h:296},{focus:{x:1,y:.5},keep:{x:2000/4096,y:0,w:2096/4096,h:1}});
 assert.equal(here.show({x:f.x,k:f.w/4096,top:0,deep:1007},'nowhere',[['noon',1]],2,[1,0,0,0],0,6),false,'a land with no page is not laid');
 assert.equal(here.show({x:f.x,k:f.w/4096,top:0,deep:1007},land,[['noon',1]],2,[1,0,0,0],-150,6),true);await settle();await settle();
 const style=el=>({tag:el.tagName,image:el.style.backgroundImage,size:el.style.backgroundSize,place:el.style.backgroundPosition,width:el.style.width,height:el.style.height,opacity:el.style.opacity||'',kids:el.children.map(style)});
 assert.deepEqual(here.node.children.map(style),old.children.map(style),'the same layers, pictures, sizes and places');
 assert.equal(here.node.style.top,'0px');assert.equal(here.node.style.height,'1007px');assert.equal(here.node.style.backgroundColor,old.style.backgroundColor);
 // the same travel and the same ride, each from the same moment of the journey (the frame's clock is 150 ms behind)
 const within=(el,node)=>{for(let n=el;n;n=n.parentNode)if(n===node)return true;return false;};
 const runs=(hh,node)=>hh.live().filter(a=>within(a.el,node)).map(a=>({tag:a.el.tagName,keyframes:copy(a.keyframes),duration:a.options.duration,rate:a.playbackRate??1,start:a.startTime}));
 const was=runs(h,old),now=runs(p,here.node);assert.ok(was.length>=info.move.length*2,'bars travel and holders ride: '+was.length);
 assert.deepEqual(now.map(r=>({...r,start:r.start+150})),was,'every movement the same, from the same moment');
});

// Engine 2, part 3.1 (4.0.169): the speed has inertia. A new stop is a curve of the speed from where the train is (speed and
// acceleration) to the new speed at rest (4.0.173: the stops are 0, .33, 1, 4): about 3.1 s from Stopped to Cruise, 4 s from Cruise to
// Fast, braking a fifth
// quicker, never past the bound of acceleration, interruptible at any moment, the journey's place always continuous.
const travel=()=>scenes().travel;
const sample=(p,from,to,n=400)=>{const S=travel(),out=[];for(let i=0;i<=n;i++){const t=from+(to-from)*i/n;out.push({t,...S.at(p,t)});}return out;};
test('the speed has inertia: a curve to the new stop as long as the change is felt, smooth, within its bounds, the journey continuous',()=>{
 const S=travel(),B=S.bounds;
 const cruise=S.of([1,0,0,0]);assert.deepEqual(copy(S.at(cruise,5000)),{v:1,a:0,j:0,x:5,r:5,moving:false},'four numbers: a steady pace from a moment, as before');
 // Cruise to Fast at 1 s: about four seconds
 const up=S.of(S.to(cruise,1000,4));assert.equal(up.v0,1);assert.equal(up.x0,1,'from where the journey had come');assert.ok(up.T>3.85&&up.T<4.15,'Cruise to Fast takes about 4 s: '+up.T);
 const s=sample(up,1000,1000+up.T*1000);
 assert.ok(Math.abs(s[0].v-1)<1e-9&&Math.abs(s[0].a)<1e-9,'it begins at the speed it had, with the acceleration it had (none)');
 assert.ok(Math.abs(s.at(-1).v-4)<1e-6&&Math.abs(s.at(-1).a)<1e-6,'and arrives at rest at the new speed');
 for(let i=1;i<s.length;i++){assert.ok(s[i].v>=s[i-1].v-1e-9,'speeding up only');assert.ok(s[i].x>s[i-1].x,'the journey goes on');assert.ok(s[i].r>=s[i-1].r,'the ride\'s loop goes on');}
 assert.ok(Math.max(...s.map(q=>Math.abs(q.a)))<=B.amax+1e-9,'within the bound of acceleration');
 // the journey: what the curve's speed adds up to (checked against a sum of small steps)
 let x=1;for(let i=1;i<s.length;i++)x+=(s[i].t-s[i-1].t)/1000*(s[i].v+s[i-1].v)/2;assert.ok(Math.abs(x-s.at(-1).x)<1e-3,'the place is where the speed took it: '+x+' '+s.at(-1).x);
 const after=S.at(up,1000+up.T*1000+2000);assert.ok(Math.abs(after.x-(s.at(-1).x+8))<1e-9&&after.v===4&&after.moving===false,'then steady');
 // Stopped to Cruise about 3.1 s; braking a fifth quicker than speeding up
 const go=S.of(S.to(S.of([0,0,0,0]),0,1));assert.ok(go.T>2.95&&go.T<3.25,'Stopped to Cruise about 3.1 s: '+go.T);
 const stop=S.of(S.to(cruise,0,0));assert.ok(stop.T<go.T&&stop.T>1.7,'Cruise to Stopped a fifth quicker: '+stop.T);
 const down=S.of(S.to(S.of([4,0,0,0]),0,1));assert.ok(down.T<up.T&&down.T>3,'Fast to Cruise a fifth quicker than up: '+down.T);
 for(const p of [go,stop,down]){const q=sample(p,0,p.T*1000);assert.ok(q.every(z=>z.v>=-1e-6),'never below a stand');assert.ok(Math.max(...q.map(z=>Math.abs(z.a)))<=B.amax+1e-9);}
 // at once (Still, Off, reduced motion): the new pace from that moment, the journey going on from where it was
 assert.deepEqual(copy(S.to(cruise,3000,4,true)),[4,3000,3,3]);
});
test('a new stop in the middle of a change starts from that moment\'s speed, acceleration and jerk: nothing jumps, nothing passes a stand',()=>{
 const S=travel(),B=S.bounds,eq=(a,b,what)=>{for(const k of ['v','a','j','x','r'])assert.ok(Math.abs(a[k]-b[k])<1e-7,what+': '+k+' '+a[k]+' '+b[k]);};
 // Cruise to Fast, then Stopped 3 s into it, then Fast again 2.5 s into the braking, then Slow 1 s later
 let p=S.of(S.to(S.of([1,0,0,0]),0,4));const plans=[p];
 for(const [at,to] of [[3000,0],[5500,4],[6500,.33]]){const was=S.at(p,at),next=S.of(S.to(p,at,to));eq(S.at(next,at),was,'at '+at+' ms');plans.push(next);p=next;}
 // the whole journey through the four curves: continuous, speed never below a stand, acceleration and jerk bounded
 const all=[];plans.forEach((q,i)=>{const from=i?[0,3000,5500,6500][i]:0,to=i<3?[3000,5500,6500][i]:6500+q.T*1000+500;all.push(...sample(q,from,to,200).slice(i?1:0));});
 for(let i=1;i<all.length;i++){assert.ok(Math.abs(all[i].v-all[i-1].v)<=B.amax*(all[i].t-all[i-1].t)/1000+1e-6,'no jump in speed at '+all[i].t);assert.ok(all[i].x>=all[i-1].x-1e-9,'the journey never goes back');}
 assert.ok(all.every(q=>q.v>=-1e-3),'never below a stand');assert.ok(Math.max(...all.map(q=>Math.abs(q.a)))<=B.amax+1e-6,'acceleration within its bound');
 assert.ok(Math.abs(all.at(-1).v-.33)<1e-9,'it ends at the last choice');
 // what is told: numbers that make the same curve again in another page (through a message)
 const told=JSON.parse(JSON.stringify(S.to(plans[1],5500,4))),here=S.of(S.to(plans[1],5500,4)),there=S.of(told);
 for(const t of [5500,6000,8000,12000,20000])assert.deepEqual(copy(S.at(there,t)),copy(S.at(here,t)),'the same place at '+t+' ms in both pages');
});
test('inside the extension a new stop is told once, the same curve to the band\'s page and the land\'s page; each follows it by itself',async t=>{
 const one=pagedLand();if(!one){t.skip('no land travels yet');return;}
 const {land,day}=one;let T=0;
 const h=fixture({framed:true,clock:{date:8+day,day},now:()=>T});h.env.setInterval=()=>0;h.env.performance.timeOrigin=1762900000000;h.rd.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:1600,right:1366,bottom:1600});
 t.after(()=>h.api.remove());h.apply();await h.load();
 const band=h.rd.querySelector('.tk-frame');await h.say({tkBand:1,ready:true,origin:1762900000400},{source:band.contentWindow});
 const frame=h.rd.querySelector('.tk-pageframe');await h.say({tkPage:1,ready:true,origin:1762900000250},{source:frame.contentWindow});await h.minute();await h.load();
 const lever=h.rd.children.find(n=>n.classList.contains('tk-lever')),toBand=()=>band.contentWindow.posts.map(p=>p[0].show?.travel),toPage=()=>frame.contentWindow.posts.map(p=>p[0].show?.travel);
 const b0=toBand().length,p0=toPage().length;
 T=10000;lever.dispatchEvent({type:'keydown',key:'ArrowUp',bubbles:false,preventDefault(){}});await settle();
 const curve=toBand().at(-1);assert.equal(curve.length,8,'a change of speed under way: eight numbers');assert.deepEqual(curve.slice(0,7),[4,9600,9.6,9.6,1,0,0],'to Fast, from 9.6 s on the band\'s clock, from where the journey and the ride had come, at Cruise, at rest');
 assert.ok(curve[7]>3.85&&curve[7]<4.15,'about four seconds');assert.deepEqual(toPage().at(-1),curve,'the land\'s page is told the same curve');
 assert.equal(toBand().length,b0+1);assert.equal(toPage().length,p0+1);
 // while it changes, the dashboard tells them nothing more (each page follows the curve by itself)
 for(const ms of [100,400,1000,3000]){T=10000+ms;await h.minute();}assert.equal(toBand().length,b0+1,'nothing more to the band\'s page');assert.equal(toPage().length,p0+1,'nothing more to the land\'s page');
 // a new choice in the middle: one new curve from where the train is
 T=13000;lever.dispatchEvent({type:'keydown',key:'Home',bubbles:false,preventDefault(){}});await settle();const stop=toBand().at(-1);
 const S=h.api.travel,was=S.at(S.of(curve),13000-400),now=S.of(stop);assert.equal(stop[0],0);assert.equal(stop[1],12600);for(const [i,k] of [[2,'x'],[3,'r'],[4,'v'],[5,'a'],[6,'j']])assert.ok(Math.abs(stop[i]-was[k])<1e-9,k);
 assert.ok(Math.abs(S.at(now,12600).v-was.v)<1e-9);assert.deepEqual(toPage().at(-1),stop);
});
test('a page that moves things follows the curve in tenths of a second: each strip goes on from where the curve has it, and ends steady',async t=>{
 let T=0;const h=fixture({now:()=>T});h.env.setInterval=()=>0;t.after(()=>h.api.remove());h.apply();await h.load();
 const lever=h.rd.children.find(n=>n.classList.contains('tk-lever'));
 // (the deep: the land that has strips in the window and no page; the lever drives it too)
 const strips=()=>h.rd.querySelectorAll('.tk-strip'),run=strip=>h.live().filter(a=>a.el===strip)[0],speeds=RIDE.lands.metro.layers.filter(l=>!l.still).map(l=>l.speed),W=RIDE.box[0]-1;
 const where=(a,at,i)=>{if(!a)return null;const ms=a.options.duration;return ((((at-a.startTime)/ms)%1)+1)%1*W;};
 if(!lever){t.skip('no lever');return;}
 T=10000;lever.dispatchEvent({type:'keydown',key:'ArrowUp',bubbles:false,preventDefault(){}});await settle();
 const S=h.api.travel,steps=[];let before=strips().map(run);
 for(let k=1;k<=90;k++){
  T=10000+k*100;const due=[...h.timers].filter(([,timer])=>timer.ms===100);for(const [id]of due)h.timers.delete(id);for(const [,timer]of due)timer.fn();await settle();
  const after=strips().map(run);
  after.forEach((a,i)=>{const was=where(before[i],T,i),is=where(a,T,i);if(was!==null&&is!==null){const d=Math.min(Math.abs(was-is),W-Math.abs(was-is));assert.ok(d<1e-6,'strip '+i+' at '+T+' ms goes on from where it was: '+was+' '+is);}});
  steps.push(after.map(a=>a?W/(a.options.duration/1000)/speeds[0]:0)[0]);before=after;
 }
 assert.ok(steps[0]>1.05&&steps[0]<1.3,'the first tenth already clearly above Cruise (the push): '+steps[0]);assert.ok(steps.slice(1).every((v,i)=>v>=steps[i]-1e-9),'faster at every step');assert.ok(Math.abs(steps.at(-1)-4)<1e-6,'and Fast at the end');
 assert.equal([...h.timers].filter(([,timer])=>timer.ms===100).length,0,'steady: no more steps');
});

// Engine 2, parts 3.2 and 3.3: what rides with the train rides the rail. Its joints lie along the track, so their knocks come as often
// as the train passes them; above about three a second they melt into a rumble; a land's own ride (live-<land>.json) chooses its kind;
// what hangs swings back as the train speeds up and forward as it brakes, and rings down after; a new travel never makes anything jump.
const BASE='chrome-extension://train-test/themes/train/';
const rideNow=async(h,lived,live)=>{const real=h.env.fetch;h.env.fetch=async url=>{const file=url.replace(BASE,'');if(file.startsWith('live-')){h.fetched.push(file);return {ok:!!live,json:async()=>JSON.parse(JSON.stringify(live))};}return real(url);};const r=h.api.rideOf(h.env.document,BASE,'ride.json',lived);await new Promise(ok=>r.whenRead(ok));return r;};
const hangs=()=>{let best=-1;RIDE.pieces.forEach((q,i)=>{if(q.p<0&&q.k==='rot'&&q.hang&&(best<0||q.d[0][3]>RIDE.pieces[best].d[0][3]))best=i;});return best;};
const stands=()=>RIDE.pieces.findIndex(q=>q.p<0&&q.k==='rot'&&!q.hang&&q.d[0][0]==='stand'&&q.d[0][3]>0);
test('the rail: its joints lie along the track, so the knocks come as often as the train passes them, and melt into a rumble at speed',async t=>{
 const h=fixture();t.after(()=>h.api.remove());const r=await rideNow(h,[],null);t.after(()=>r.clear());
 const per=v=>{r.pace([v,0,0,0]);let n=0,sum=0;for(let k=2;k<8;k++){const p=r.probe(k*r.window*1000+1);n+=p.kicks.length;sum+=p.kicks.reduce((s,q)=>s+q[1],0);}const p=r.probe(30000);return {n:n/(6*r.window),each:sum/Math.max(1,n),rumble:p.rumble,axles:p.axles};};
 const slow=per(.33),cruise=per(1),fast=per(4);
 assert.ok(cruise.n>.9&&cruise.n<2.2,'at Cruise about as often as before (one joint a second, some doubled): '+cruise.n);
 assert.ok(Math.abs(cruise.n/slow.n-3)<1,'at Slow a third as often: '+cruise.n/slow.n);assert.ok(Math.abs(fast.n/cruise.n-4)<1,'at Fast four times as often: '+fast.n/cruise.n);
 assert.ok(fast.each<.6*cruise.each*1.92,'at Fast each knock is softer than its speed would make it (they melt): '+fast.each+' '+cruise.each);
 assert.equal(cruise.rumble,0,'no rumble at Cruise');assert.ok(fast.rumble>.3,'a low rumble at Fast: '+fast.rumble);assert.equal(slow.rumble,0);
 assert.ok(fast.axles>4*fast.n*r.window*.8,'the land outside takes each joint four axles');
 // standing: no knocks
 r.pace([0,0,0,0]);assert.equal(r.probe(30000).kicks.length,0,'a train at a stand crosses no joints');
 assert.deepEqual(copy(r.probe(30000).rail),{knock:1,gap:2000,bounce:1,heave:[],rumble:.5,floats:false},'without a file of its own a land rides the rail of before');
});
test('a land\'s own ride chooses its kind: a floating line has no joints, its car heaves, its bridge bounces as it says; a bad file is no file',async t=>{
 const h=fixture();t.after(()=>h.api.remove());
 const live={v:1,ride:{knock:0,gap:0,bounce:.15,heave:[[2.2,.31],[.9,.83]],rumble:.1,car:'floats'}};
 const f=await rideNow(h,['mesa'],live);t.after(()=>f.clear());f.land('mesa');await settle();
 assert.deepEqual(copy(f.probe(0).rail),{knock:0,gap:0,bounce:.15,heave:[[2.2,.31],[.9,.83]],rumble:.1,floats:true});assert.ok(h.fetched.includes('live-mesa.json'));
 f.pace([4,0,0,0]);assert.equal(f.probe(25000).kicks.length,0,'a floating line has no joints');assert.equal(f.probe(25000).axles,0);
 f.pace([0,0,0,0]);const ys=[...Array(24)].map((_,i)=>f.probe(30000+i*250,{amp:1.7,near:0,depth:1}).outside[1]);assert.ok(Math.max(...ys)-Math.min(...ys)>2,'the car heaves (the land outside rises and falls) even at a stand: '+(Math.max(...ys)-Math.min(...ys)));
 f.pace([1,0,0,0]);for(let i=0;i<40;i++){const at=30000+i*97,a=f.probe(at,{amp:1.7,near:4.6,depth:1,turn:true}).outside,b=f.probe(at,{amp:1.7,near:0,depth:.35}).outside;assert.deepEqual(a,b,'no bridge bounces: every layer the same');}
 assert.ok(Math.max(...ys)-Math.min(...ys)<=4+1e-9,'the heave at most 2 art px either way');
 // a land that is not listed as having a file reads none; a file that is not right is no file
 const q=await rideNow(h,[],live),n=h.fetched.length;t.after(()=>q.clear());q.land('sea');await settle();assert.equal(h.fetched.length,n,'not listed: nothing read');assert.equal(q.probe(0).rail.gap,2000);
 const bad=await rideNow(h,['sea'],{v:2,ride:{gap:0}});t.after(()=>bad.clear());bad.land('sea');await settle();assert.equal(bad.probe(0).rail.gap,2000,'another version: the rail of before');
});
test('what hangs swings back as the train speeds up and forward as it brakes, what stands leans, and both ring down after',async t=>{
 let T=0;const h=fixture({now:()=>T});t.after(()=>h.api.remove());const r=await rideNow(h,[],null);t.after(()=>r.clear());const S=h.api.travel;
 const i=hangs(),j=stands();assert.ok(i>=0&&j>=0,'a thing that hangs and a thing that stands');
 r.pace([1,0,0,0]);T=20000;const up=S.to(S.of([1,0,0,0]),20000,4);r.pace(up);
 const mid=20000+up[7]*500,during=r.probe(mid).pull(i),leanUp=r.probe(mid).pull(j);
 assert.ok(during<-1,'speeding up, what hangs swings back (its free end behind): '+during);assert.ok(leanUp<0&&leanUp>during,'what stands leans back, less: '+leanUp);
 assert.ok(Math.abs(r.probe(20000).pull(i))<.05,'it begins as the speed begins to change: no jump');
 // braking from Fast to a stand
 const end=20000+up[7]*1000+3000;T=end;const down=S.to(S.of(up),end,0);r.pace(down);const brake=r.probe(end+down[7]*500).pull(i);
 assert.ok(brake>1,'braking, it swings forward: '+brake);
 // and rings down after
 const still=end+down[7]*1000+15000;assert.ok(Math.abs(r.probe(still).pull(i))<.05&&Math.abs(r.probe(still).pull(j))<.05,'rung down a while after');
 // the harder the change, the further it swings: Stopped to Cruise swings less than Cruise to Fast
 const soft=await rideNow(h,[],null);t.after(()=>soft.clear());T=0;soft.pace([0,0,0,0]);T=20000;const go=S.to(S.of([0,0,0,0]),20000,1);soft.pace(go);
 assert.ok(Math.abs(soft.probe(20000+go[7]*500).pull(i))<Math.abs(during),'a gentler change, a smaller swing');
});
// Engine 2, 4.0.169: a change of speed one can feel. A push in its first half second (the acceleration at its peak by 0.35 s),
// most of the change early, shorter changes; a stop that brakes nearly steadily to the end and lets go only at the stand (a small
// jolt); between moving speeds an easy end. Speed and acceleration continuous (the jerk may jump).
test('a change of speed is felt: a push in its first half second, most of it early, a stop that ends in a small jolt, shorter changes',()=>{
 const S=travel(),B=S.bounds,of=(a,b)=>S.of(S.to(S.of([a,0,0,0]),0,b));
 const stats=p=>{let peak=0,at=0,half=null;const D=p.v1-p.v0;for(let i=0;i<=1200;i++){const t=p.T*1000*i/1200,s=S.at(p,t);if(Math.abs(s.a)>Math.abs(peak)){peak=s.a;at=t;}if(half===null&&Math.abs(s.v-p.v0)>=Math.abs(D)/2)half=t;}return {peak,at,half};};
 const go=of(0,1),slow=of(.33,1),up=of(1,4),down=of(4,1),stop=of(1,0),halt=of(4,0),off=of(0,.33),rest=of(.33,0);
 // (4.0.173: Stopped to Slow 1.5 s, Slow to Cruise about 1.8, Cruise to Fast about 4, Stopped to Cruise about 3.1, Fast to Stopped 5.5 at most)
 assert.ok(Math.abs(off.T-1.5)<.1,'Stopped to Slow about 1.5 s: '+off.T);assert.ok(Math.abs(go.T-3.1)<.15,'Stopped to Cruise about 3.1 s: '+go.T);assert.ok(Math.abs(slow.T-1.8)<.15,'Slow to Cruise about 1.8 s: '+slow.T);assert.ok(Math.abs(up.T-4)<.2,'Cruise to Fast about 4 s: '+up.T);
 assert.ok(Math.abs(down.T-up.T*.8)<.2&&Math.abs(stop.T-go.T*.8)<.15&&Math.abs(rest.T-off.T*.8)<.1,'braking a fifth quicker: '+down.T+' '+stop.T+' '+rest.T);assert.ok(halt.T<=5.5,'Fast to Stopped within 5.5 s: '+halt.T);
 for(const p of [go,slow,up,down]){const s=stats(p);assert.ok(s.at<=500,'the push: the peak within half a second: '+s.at);assert.ok(s.half<=.35*p.T*1000,'half the change within the first 35 %: '+s.half/p.T/10);}
 for(const p of [stop,halt]){const s=stats(p),last=S.at(p,p.T*1000-250).a;assert.ok(s.at<=500,'the brakes take hold within half a second');assert.ok(last/s.peak>=.5,'a quarter second before the stand still braking at half its peak or more: '+last/s.peak);assert.ok(Math.abs(S.at(p,p.T*1000).a)<1e-6,'and it lets go at the stand');}
 assert.ok(Math.abs(S.at(down,down.T*1000-250).a/stats(down).peak)<.05,'between moving speeds an easy end');
 for(const p of [go,slow,up,down,stop,halt]){const q=sample(p,0,p.T*1000,600);assert.ok(q.every(z=>z.v>=-1e-6),'never below a stand');assert.ok(Math.max(...q.map(z=>Math.abs(z.a)))<=B.amax+1e-9,'within the bound');
  for(let i=1;i<q.length;i++){const dt=(q[i].t-q[i-1].t)/1000;assert.ok(Math.abs(q[i].v-q[i-1].v)<=B.amax*dt+1e-6&&Math.abs(q[i].a-q[i-1].a)<=40*dt+1e-6,'speed and acceleration continuous');}}
});
// What answers it (4.0.169): the hanging lamp swings back 14-20 degrees on Cruise to Fast and 9-13 on Stopped to Cruise, at once,
// once or twice, and is still some 6 s after; the land outside (in the window and under the room alike) is pushed back a little
// (4.0.170: at most 4 art px on Stopped to Cruise, 8 on Cruise to Fast) on a critically damped spring, with no overshoot and no
// rebound; pulling away from a stand the couplings take up with one knock; at once (Still, Off) none of it.
test('the room answers a change at once and clearly, the land outside shifts as one on a spring, the couplings knock as it pulls away',async t=>{
 let T=0;const h=fixture({now:()=>T});t.after(()=>h.api.remove());const r=await rideNow(h,[],null);t.after(()=>r.clear());const S=h.api.travel,B=S.bounds;
 const lamp=RIDE.pieces.findIndex(q=>q.n==='moon lamp');assert.ok(lamp>=0,'the moon lamp hangs in the room');
 const run=(a,b,atOnce)=>{T=0;r.pace([a,0,0,0]);T=20000;const plan=S.to(S.of([a,0,0,0]),20000,b,atOnce);r.pace(plan);return plan;};
 const most=(f,from,to)=>{let m=0;for(let t=from;t<to;t+=25){const v=f(t);if(Math.abs(v)>Math.abs(m))m=v;}return m;};
 const out=(t,k=1)=>r.probe(t,{amp:1.7*k,near:0,depth:.6,turn:false}).outside[0],knockAt=t=>r.probe(t).kicks.filter(([tt])=>Math.abs(tt-t)<1).length;
 let p=run(1,4),end=20000+p[7]*1000;
 const lean=most(u=>r.probe(u).pull(lamp),19000,end+6000);assert.ok(lean<=-14&&lean>=-20.5,'Cruise to Fast: the lamp swings back '+lean);
 assert.ok(r.probe(20500).pull(lamp)<-2,'clearly within half a second: '+r.probe(20500).pull(lamp));
 const shift=most(u=>out(u),19500,end+3000);assert.ok(shift<=-5&&shift>=-8,'the land is pushed back, at most 8 art px: '+shift);
 assert.ok(Math.abs(out(20800,.6)-.6*out(20800))<1e-9,'window and page by one spring, each at its own scale');
 let still=null;for(let u=end;u<end+12000;u+=100){let ok=true;for(let w=u;w<u+1500;w+=50)if(Math.abs(r.probe(w).pull(lamp))>.1){ok=false;break;}if(ok){still=u-end;break;}}assert.ok(still!==null&&still<=6500,'still within 0.1 degree '+still+' ms after the change');
 let turns=0,sign=0;for(let u=20000;u<end+6000;u+=25){const v=r.probe(u).pull(lamp),sg=Math.abs(v)>.5?Math.sign(v):0;if(sg&&sign&&sg!==sign)turns++;if(sg)sign=sg;}assert.ok(turns<=4,'at most two visible swings back and forth (Cruise to Fast eases in over 4 s: it may settle without one): '+turns);
 assert.equal(knockAt(20120),0,'between moving speeds no knock of the couplings');
 p=run(0,1);const go=most(u=>r.probe(u).pull(lamp),19000,20000+p[7]*1000+6000);assert.ok(go<=-9&&go>=-13,'Stopped to Cruise: the lamp '+go);
 const goShift=most(u=>out(u),19500,20000+p[7]*1000+3000);assert.ok(goShift<=-2&&goShift>=-4,'at most 4 art px: '+goShift);
 assert.equal(knockAt(20120),1,'pulling away, the couplings take up with one knock');
 p=run(1,0);end=20000+p[7]*1000;const brake=most(u=>out(u),19500,end);assert.ok(brake>1,'braking, the land is pushed forward: '+brake);
 const back=most(u=>{const x=out(u);return Math.sign(x)!==Math.sign(brake)?x:0;},end,end+3000);assert.ok(Math.abs(back)<.01*Math.abs(brake),'at the stand no rebound: '+back);
 assert.ok(Math.abs(out(end+3500))<.05*Math.abs(brake),'then still');
 p=run(4,1);end=20000+p[7]*1000;const ease=most(u=>out(u),19500,end),past=most(u=>{const x=out(u);return Math.sign(x)!==Math.sign(ease)?x:0;},end,end+3000);assert.ok(Math.abs(past/ease)<.01,'between moving speeds no overshoot: '+past/ease);
 p=run(0,1,true);assert.equal(p.length,4,'at once: the new speed from that moment');assert.equal(knockAt(20120),0,'no knock');assert.ok(Math.abs(r.probe(21000).pull(lamp))<1e-6&&Math.abs(out(21000))<1e-6,'nothing swings, nothing shifts');
});
// 4.0.170: the world outside is one rigid thing that barely moves. Every outside layer, in the window and under the room, takes
// exactly the same displacement at every moment (in its own units); nothing tilts; up and down only the joints' knocks and the
// rumble, at most 0.8 CSS px at the owner's scale (about .42 CSS px per art px: 1.9 art px), nothing at a stand.
test('the world outside is one rigid thing: every layer the same displacement, no tilt, a small knock, nothing at a stand',async t=>{
 let T=0;const h=fixture({now:()=>T});t.after(()=>h.api.remove());const r=await rideNow(h,[],null);t.after(()=>r.clear());
 const W={amp:1.7,near:0,depth:.6,surge:11,turn:false},page=k=>[{amp:1.7*k,near:0,depth:.35,turn:true},{amp:1.7*k,near:0,depth:.6,turn:true},{amp:1.7*k,near:4.6*k,depth:1,turn:true}];
 for(const [v,most] of [[0,0],[.33,1.9],[1,1.9],[4,1.9]]){T=0;r.pace([v,0,0,0]);let peak=0;
  for(let at=20000;at<30000;at+=20){const w=r.probe(at,W).outside;peak=Math.max(peak,Math.abs(w[1]),Math.abs(w[0]));assert.equal(w[2],0,'no tilt');
   for(const o of page(.42)){const p=r.probe(at,o).outside;assert.ok(Math.abs(p[0]-.42*w[0])<1e-9&&Math.abs(p[1]-.42*w[1])<1e-9&&p[2]===0,'every layer the same displacement at '+at+' ms');}}
  assert.ok(peak<=most+1e-9,'at pace '+v+' the outside moves at most '+most+' art px: '+peak);if(v)assert.ok(peak>.2,'and the knocks are still felt: '+peak);}
});
test('motion blur comes in smoothly between 1 and 3 screen px a frame and is the whole distance above that',()=>{
 const blur=travel().blur;for(const dpr of [1,1.5,2]){assert.equal(blur(.9*dpr,dpr),0,'none under a screen px');assert.ok(Math.abs(blur(3*dpr,dpr)-3*dpr)<1e-9&&Math.abs(blur(10*dpr,dpr)-10*dpr)<1e-9,'the whole distance from 3 px');
  let was=0;for(let px=0;px<=4*dpr;px+=.01*dpr){const b=blur(px,dpr);assert.ok(b>=was-1e-9&&b<=px+1e-9,'growing, never more than the distance');assert.ok(b-was<=.06*dpr,'no step at '+px);was=b;}}
});
// 4.0.173 (the owner: "I barely see difference from 1, 2, 3, 4 speed"): the stops are 0, .33, 1 and 4, each three to four times the
// one before; at the owner's scale (.578 CSS px per art px, device scale 1.5) the rail is not blurred at Slow, a touch at Cruise and
// streaks the whole way at Fast; the near land is sharp at Cruise and a little blurred at Fast (a layer's share is taken after the fade).
test('the four stops can be told apart: each three to four times the one before; the blur none, a touch, a streak',()=>{
 const paces=JSON.parse(/paces:(\[[^\]]*\])/.exec(DENSE())[1].replace(/([\[,])\./g,'$10.'));
 assert.deepEqual(paces,[0,.33,1,4],'Stopped, Slow, Cruise, Fast');for(const i of [2,3]){const r=paces[i]/paces[i-1];assert.ok(r>=3&&r<=4+1e-9,'three to four times the one before: '+r);}
 const blur=travel().blur,k=.578125,dpr=1.5,move=Object.values(PAGED_FILE).find(l=>l.move).move,speed=id=>move.find(m=>m[0]===id)[1];
 const streak=(id,share,pace)=>share*blur(speed(id)*pace*k*dpr/60,dpr)/dpr,frame=(id,pace)=>speed(id)*pace*k/60;
 assert.equal(streak(3,1,.33),0,'Slow: the rail sharp');assert.ok(streak(3,1,1)>.5&&streak(3,1,1)<frame(3,1),'Cruise: a touch on the rail: '+streak(3,1,1));
 assert.ok(Math.abs(streak(3,1,4)-frame(3,4))<1e-9,'Fast: the rail streaks the whole way it moves in a frame: '+streak(3,1,4));
 assert.equal(streak(2,.5,1),0,'Cruise: the near land sharp');assert.ok(streak(2,.5,4)*dpr>1,'Fast: a little on the near land: '+streak(2,.5,4));
 assert.match(read('themes/train/painter.js'),/bx=o\.blur\*\(T\.blur\?T\.blur\(mv,o\.dpr\|\|1\)/,'the painter takes a layer\'s share after the fade');
});
test('a new travel never makes anything jump: from the moment it is told, and from one window of the rail to the next',async t=>{
 let T=0;const h=fixture({now:()=>T});t.after(()=>h.api.remove());const r=await rideNow(h,[],null);t.after(()=>r.clear());const S=h.api.travel;
 r.pace([1,0,0,0]);const W=r.window*1000,i=hangs();
 // a window and the next: the same place, the same swing
 for(const k of [1,2,3]){const a=r.probe(k*W-1).piece(i)[0],b=r.probe(k*W).piece(i)[0];assert.ok(Math.abs(a-b)<.06,'window '+k+': '+a+' '+b);const o=r.probe(k*W-1,{amp:1.7,near:4.6,depth:1,turn:true}).outside,p=r.probe(k*W,{amp:1.7,near:4.6,depth:1,turn:true}).outside;assert.ok(Math.abs(o[1]-p[1])<.25,'outside, window '+k);}
 // a new travel in the middle of a window: what was worked out up to that moment stays
 T=23456;const before=[0,-300,-1000].map(d=>r.probe(T+d).piece(i)[0]);r.pace(S.to(S.of([1,0,0,0]),T,4));const after=[0,-300,-1000].map(d=>r.probe(T+d).piece(i)[0]);
 // (exactly the same until the last sample before it; within that sample, by the little the new curve has begun to change)
 before.forEach((v,n)=>assert.ok(Math.abs(v-after[n])<(n?1e-9:.02),'unchanged up to the moment of the change: '+v+' '+after[n]));
});
test('live-<land>.json is read by its version 1: every part held within its bounds, a part that is not right left out, a file that is not right no file',()=>{
 const L=scenes().liveOf;
 const spec={v:1,layers:[{id:0,flowMax:6,shimmer:{kind:'twinkle',amount:.6,stages:['dusk','night']}},{id:1,flowMax:40,sway:{amp:2,hz:.3},shimmer:{kind:'heat',amount:1,stages:['noon','sunset']}},{id:2,flowMax:60,sway:{amp:3.5,hz:.45},blur:.6},{id:3,blur:1,bob:{amp:3,hz:.31}}],
  particles:[{kind:'dust',layer:2.5,box:[0,1500,4096,2250],count:70,size:[1.5,4],vel:[-14,1],wind:1,stages:['morning','noon','sunset']},{kind:'meteor',layer:.5,box:[0,0,4096,1200],every:[4,11],stages:['night']}],
  sprites:[{id:'ship',frame:[0,0,96,64],frames:4,fps:5,layer:1.6,at:[1480,1690],scale:1,path:{vx:-9,bob:[2,.4]},shadow:[116,85,154,.5],stages:'all'}],
  shafts:{from:[.82,-.2],amount:.25,stages:['morning','sunset']},ride:{knock:0,gap:0,bounce:.15,heave:[[2.2,.31],[.9,.83]],rumble:.1,car:'floats'}};
 const got=copy(L(spec));
 assert.equal(got.layers.length,4);assert.deepEqual(got.layers[1],{id:1,flowMax:40,sway:{amp:2,hz:.3},shimmer:{kind:'heat',amount:1,stages:['noon','sunset']},blur:0,bob:null});
 assert.deepEqual(got.particles[0],{kind:'dust',layer:2.5,box:[0,1500,4096,2250],count:70,size:[1.5,4],vel:[-14,1],wind:1,every:null,stages:['morning','noon','sunset']});assert.deepEqual(got.particles[1].every,[4,11]);
 assert.deepEqual(got.sprites[0],{id:'ship',frame:[0,0,96,64],frames:4,cols:0,tween:false,cut:false,fps:5,layer:1.6,at:[1480,1690],scale:1,path:{vx:-9,vy:0,bob:[2,.4],loop:null},fixed:false,face:null,shadow:[116,85,154,.5],stages:['morning','noon','sunset','dusk','night']});
 // (as built for the lead: a shimmer kind lightning, and a sprite fixed to the train instead of its land)
 {const more=copy(L({v:1,layers:[{id:2,shimmer:{kind:'lightning',amount:1,stages:['dusk']}}],sprites:[{id:'shadow',frame:[0,0,64,32],at:[2000,600],fixed:true},{id:'plane',frame:[0,0,84,34],at:[600,120],face:'right'},{id:'kite',frame:[0,0,9,9],at:[1,1],face:'up'}]}));assert.equal(more.layers[0].shimmer.kind,'lightning');assert.equal(more.sprites[0].fixed,true);assert.deepEqual(more.sprites.map(s=>s.face),[null,'right',null],'face: left or right, nothing else');}
 assert.deepEqual(got.shafts,{from:[.82,-.2],amount:.25,stages:['morning','sunset']});assert.deepEqual(got.ride,{knock:0,gap:0,bounce:.15,heave:[[2.2,.31],[.9,.83]],rumble:.1,floats:true});
 // not a file of version 1, or made wrong at the top: no file (the land is drawn as before)
 for(const bad of [null,7,'x',[],{},{v:2},{v:'1'},{v:1,layers:{}},{v:1,particles:'rain'},{v:1,ride:[1]},{v:1,shafts:5}])assert.equal(L(bad),null,JSON.stringify(bad));
 // a part that is not right is left out; numbers are held within their bounds
 const odd=copy(L({v:1,layers:[{id:12},{id:'1'},{id:2,flowMax:1e9,blur:-3,sway:{amp:99,hz:0}},{id:2}],particles:[{kind:'lava'},{kind:'rain',count:1e6,stages:'sometimes'},{kind:'snow',count:-4,vel:[1e9,-1e9]}],sprites:[{id:'Big Ship',frame:[0,0,9,9],at:[0,0]},{id:'a',frame:[0,0,0,9],at:[0,0]},{id:'b',frame:[0,0,9,9]},{id:'c',frame:[1,2,3,4],at:[5,6],frames:900,fps:-1,scale:99}],ride:{gap:-5,heave:[[1,0],[90,9],'x'],car:'boat'}}));
 assert.deepEqual(odd.layers,[{id:2,flowMax:400,sway:{amp:20,hz:.01},shimmer:null,blur:0,bob:null}]);
 assert.deepEqual(odd.particles.map(p=>[p.kind,p.count,p.vel]),[['snow',0,[2000,-2000]]]);
 assert.deepEqual(odd.sprites.map(s=>[s.id,s.frames,s.fps,s.scale]),[['c',64,0,8]]);
 assert.deepEqual(odd.ride,{knock:1,gap:0,bounce:1,heave:[[40,5]],rumble:.5,floats:false});
});

// Engine 2, part 3.4: the room's daylight follows the land: sun-<land>.json says how much of the sun each sliding layer lets in where it
// has slid to; the room's shade deepens as a mountain passes on the sun's side and clears after; a layer too fast to follow lets in its mean.
test('the room\'s daylight follows the land: a mountain on the sun\'s side shades the room as it passes, and the shade clears after',async t=>{
 let T=0;const h=fixture({now:()=>T});t.after(()=>h.api.remove());
 const half=[...Array(256)].map((_,i)=>i<128?0:1),piers=[...Array(256)].map((_,i)=>i%2?1:.2),file={v:1,hours:{noon:{'1':half,'3':piers}}};
 const real=h.env.fetch;h.env.fetch=async url=>{const name=url.replace(BASE,'');if(name.startsWith('sun-')){h.fetched.push(name);return {ok:true,json:async()=>file};}return real(url);};
 const r=h.api.rideOf(h.env.document,BASE,'ride.json',['sun:mesa']);t.after(()=>r.clear());await new Promise(ok=>r.whenRead(ok));r.land('mesa');await settle();assert.ok(h.fetched.includes('sun-mesa.json'));
 const speed=PAGED.mesa.move.find(m=>m[0]===1)[1];r.pace([1,0,0,0]);
 // (layer 1 at 15 px a second: the mountain covers the first half of its tile; the bridge travels with the near land since 4.0.168, so
 //  its piers are followed like any layer: a gap lets the sun in, a pier on the sun's side shades the room. The rule that a layer too
 //  fast for the eye lets in its mean stays in sunAt, but nothing travels that fast any more)
 const at=off=>off/speed*1000,shade=ms=>r.probe(ms).shade('noon',.3),bridge=[...Array(256)].map((_,i)=>i%2?1:.2).reduce((a,b)=>a+b)/256;
 assert.ok(Math.abs(shade(at(1000))-.3)<.01,'in the mountain\'s shadow the room is shaded: '+shade(at(1000)));
 assert.ok(bridge>.5&&Math.abs(shade(at(3000)))<.01,'past it, with a gap of the bridge at the sun, the room is clear: '+shade(at(3000)));
 assert.ok(Math.abs(shade(at(3008))-.3*.8)<.01,'and a pier passing on the sun\'s side shades it: '+shade(at(3008)));
 assert.equal(r.probe(at(3000)).shade('morning',.3),0,'an hour the file says nothing of: no shade');
 // a file that is not right: no shade at all
 for(const bad of [null,{v:2},{v:1,hours:[]},{v:1,hours:{noon:{'1':[1,2,3]}}},{v:1,hours:{noon:{'x':half}}}])assert.equal(h.api.sunOf?.(bad)??null,null,JSON.stringify(bad).slice(0,40));
});

// Engine 2, part 2: the land's page paints the land with the painter (painter.js, WebGL2) when the dashboard allows it, and lays it as
// before without WebGL2, at Graphics Low, or once the painter has failed (its context lost twice). While the painter draws, the band's
// own land in the window stands bare (hidden and still): the painter draws it there.
test('the land\'s page paints when it may and lays the land as before when it may not, without WebGL2, or once the painter fails',async()=>{
 const said=[],shows=[],painters=[];let makeOk=true;const parent={postMessage(message){said.push(JSON.parse(JSON.stringify(message)));}},listeners=new Map();
 const node={parentNode:null},host={append(n){n.parentNode=host;}},root={kids:[],attrs:new Set(),append(n){this.kids.push(n);},hasAttribute(a){return this.attrs.has(a);},setAttribute(a){this.attrs.add(a);},removeAttribute(a){this.attrs.delete(a);}};
 const ride={lands:{mesa:{layers:[{speed:0,still:true},{speed:15,still:false,turn:4096}]}},live:name=>name==='mesa'?{v:1,layers:[],particles:[],sprites:[],shafts:null,ride:{}}:null};
 const land={node,ride,info:name=>name==='mesa'?{move:[[1,15]],foot:{}}:null,show(...args){shows.push(args.at(-1));return true;},clear(){}};
 const Painter={make(doc,base,{on}){if(!makeOk)return null;const p={on,canvas:{},seen:[],runs:[],gone:false,show(s){this.seen.push(s);},run(v){this.runs.push(v);},destroy(){this.gone=true;},stats:{fps:60}};painters.push(p);return p;}};
 const env=vm.createContext({URL,document:{querySelector:sel=>sel==='.tk-host'?host:sel==='.rd'?root:null},location:{href:'chrome-extension://train-test/themes/train/page.html'},parent,ReserveTrainPainter:Painter,
  ReserveSceneThemes:{pageHere:()=>land},addEventListener:(type,fn)=>listeners.set(type,fn),performance:{timeOrigin:1}});
 env.globalThis=env;vm.runInContext(fs.readFileSync(path.join(dir,'page.js'),'utf8'),env,{filename:'page.js'});
 const hear=data=>listeners.get('message')({source:parent,data}),good={g:{x:-1210,k:.578125,top:300,deep:1307,win:{x:-1210,y:0}},land:'mesa',hours:[['noon',1]],moving:2,travel:[1,0,0,0],epoch:150,most:6};
 // allowed: the painter is made and told the scene; until it has drawn a whole frame the land is laid as before under it
 hear({tkPage:1,show:{...good,paint:true,quality:2}});const p=painters[0];assert.ok(p,'a painter');assert.equal(root.kids[0],p.canvas,'its canvas over the land');
 assert.deepEqual(copy(p.seen[0]).win,{x:-1210,y:0});assert.equal(p.seen[0].quality,2);assert.equal(p.seen[0].land,'mesa');assert.equal(p.seen[0].ride,ride);assert.deepEqual(p.runs,[true],'it runs while the land moves');
 assert.equal(shows.at(-1),true,'laid as before until the painter draws');
 // it has drawn: the page says so, and the land is no longer laid in the page (nothing drawn twice)
 p.on.painting(true);assert.deepEqual(said.filter(m=>'painting' in m).map(m=>m.painting),[true]);assert.equal(shows.at(-1),false,'the painter alone');
 // resting: the painter draws one still frame and stops
 hear({tkPage:1,show:{...good,moving:0,paint:true,quality:2}});assert.equal(p.runs.at(-1),false);
 // Graphics Low (not allowed): the painter goes, the land is laid as before, the band takes its window back
 hear({tkPage:1,show:{...good,paint:false}});assert.ok(p.gone);assert.equal(shows.at(-1),true);assert.deepEqual(said.filter(m=>'painting' in m).map(m=>m.painting),[true,false]);
 // allowed again: a new painter; it fails (its context lost twice): the land is laid as before, for good
 hear({tkPage:1,show:{...good,paint:true,quality:3}});const q=painters[1];assert.ok(q&&q!==p);q.on.painting(true);q.on.fail();
 assert.ok(q.gone);assert.equal(shows.at(-1),true,'laid as before');assert.equal(said.filter(m=>'painting' in m).at(-1).painting,false);
 hear({tkPage:1,show:{...good,paint:true,quality:2}});assert.equal(painters.length,2,'no painter is made again after it failed');assert.equal(shows.at(-1),true);
 // a page without WebGL2 (the painter cannot be made): the land is laid as before, nothing is said of painting
 const said2=said.length;makeOk=false;
});
test('without WebGL2 the land is laid as before and nothing is said of painting',()=>{
 const said=[],shows=[];const parent={postMessage(message){said.push(JSON.parse(JSON.stringify(message)));}},listeners=new Map(),node={parentNode:null},host={append(n){n.parentNode=host;}};
 const land={node,ride:{},info:()=>({move:[]}),show(...args){shows.push(args.at(-1));return true;},clear(){}};
 const env=vm.createContext({URL,document:{querySelector:sel=>sel==='.tk-host'?host:null},location:{href:'chrome-extension://train-test/themes/train/page.html'},parent,ReserveTrainPainter:{make:()=>null},ReserveSceneThemes:{pageHere:()=>land},addEventListener:(type,fn)=>listeners.set(type,fn),performance:{timeOrigin:1}});
 env.globalThis=env;vm.runInContext(fs.readFileSync(path.join(dir,'page.js'),'utf8'),env,{filename:'page.js'});
 listeners.get('message')({source:parent,data:{tkPage:1,show:{g:{x:0,k:.5,top:300,deep:1000},land:'mesa',hours:[['noon',1]],moving:2,travel:[1,0,0,0],epoch:0,most:6,paint:true,quality:2}}});
 assert.deepEqual(shows,[true]);assert.ok(!said.some(m=>'painting' in m));
});
test('the dashboard lets the land\'s page paint from Graphics Medium up, and the band\'s window land stands bare only while it paints',async t=>{
 const one=pagedLand();if(!one){t.skip('no land travels yet');return;}
 const {day}=one;const h=fixture({framed:true,clock:{date:8+day,day}});h.env.performance.timeOrigin=1762900000000;h.rd.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:1600,right:1366,bottom:1600});t.after(()=>h.api.remove());h.apply();await h.load();
 const band=h.rd.querySelector('.tk-frame'),frame=h.rd.querySelector('.tk-pageframe');await h.say({tkBand:1,ready:true,origin:1762900000400},{source:band.contentWindow});await h.say({tkPage:1,ready:true,origin:1762900000250},{source:frame.contentWindow});await h.minute();await h.load();
 const toPage=()=>frame.contentWindow.posts.at(-1)[0].show,toBand=()=>band.contentWindow.posts.at(-1)[0].show;
 assert.equal(toPage().paint,true);assert.equal(toPage().quality,2,'High');assert.equal(toBand().bare,undefined,'the band keeps its window land until the painter draws');
 await h.say({tkPage:1,painting:true},{source:frame.contentWindow});await h.minute();assert.equal(toBand().bare,true,'the painter draws: the band\'s window land stands bare');
 for(const [g,paint,quality]of [['medium',true,1],['xhigh',true,3],['high',true,2]]){h.rd.setAttribute('data-graphics',g);await h.mutate();await h.load();assert.equal(toPage().paint,paint,g);assert.equal(toPage().quality,quality,g);}
 h.rd.setAttribute('data-graphics','low');await h.mutate();await h.load();assert.equal(toPage().paint,undefined,'Graphics Low: today\'s still pictures');assert.equal(toBand().bare,undefined,'and the band\'s own window land');
 h.rd.setAttribute('data-graphics','high');await h.mutate();await h.load();await h.say({tkPage:1,painting:false},{source:frame.contentWindow});await h.minute();assert.equal(toBand().bare,undefined,'the painter stopped: the band shows its window land again');
});
// The new lands (2026-11): a layer under water bends slowly instead of fluttering like leaves, and a land may tint its flecks and
// show them fainter (sea snow is not warm dust). Both are optional: a file without them is read as before.
test('a land may ask for a water sway and for tinted, fainter flecks; without them a file reads as it did',()=>{
 const L=scenes().liveOf;
 const got=JSON.parse(JSON.stringify(L({v:1,layers:[{id:1,sway:{amp:5,hz:.1,kind:'water'}},{id:2,sway:{amp:5,hz:.1,kind:'storm'}},{id:3,sway:{amp:5,hz:.1}}],
  particles:[{kind:'dust',tint:[130,190,300],alpha:.4},{kind:'dust',tint:['a',1,2],alpha:7},{kind:'dust',tint:[1,2]},{kind:'dust'}]})));
 assert.deepEqual(got.layers.map(l=>l.sway),[{amp:5,hz:.1,kind:'water'},{amp:5,hz:.1},{amp:5,hz:.1}],'only "water" is a kind; anything else is the wind as before');
 assert.deepEqual(got.particles[0].tint,[130,190,255]);assert.equal(got.particles[0].alpha,.4);
 assert.equal(got.particles[1].tint,undefined,'a tint that is not three numbers is no tint');assert.equal(got.particles[1].alpha,1,'held within 0 and 1');
 assert.equal(got.particles[2].tint,undefined);assert.ok(!('tint' in got.particles[3])&&!('alpha' in got.particles[3]),'nothing is added to a fleck that asks for neither');
 const painter=read('themes/train/painter.js');
 assert.match(painter,/uSwayKind>\.5\)\{float w=sin\(/,'the painter has the slow bend');assert.match(painter,/gl\.uniform1f\(u\.uSwayKind,L\.sway\?\.kind==='water'\?1:0\)/);
 assert.match(painter,/gl\.uniform1f\(u\.uPAlpha,p\.alpha\?\?1\)/,'a fleck shows whole unless the land says less');assert.match(painter,/o=vec4\(c\*uTint\*a,a\)/);
});

test('Soul Passage: a sprite may keep its frames in rows and dissolve from one to the next (a large, slow piece of a land)',()=>{
 // a sheet of large frames in rows: cols says how many lie in a row; tween asks for a dissolve between frames. Both optional: a sprite without them reads as before.
 const L=scenes().liveOf;const got=JSON.parse(JSON.stringify(L({v:1,layers:[],sprites:[{id:'grip',frame:[0,0,660,555],frames:16,cols:8,tween:1,fps:4.8,layer:2,at:[2820,1400.5],scale:1.3333,stages:'all'},{id:'plain',frame:[0,0,84,34],frames:10,at:[600,120]},{id:'odd',frame:[0,0,9,9],at:[1,1],cols:-3,tween:'yes'}]})));
 assert.deepEqual(got.sprites.map(s=>[s.id,s.frames,s.cols,s.tween]),[['grip',16,8,true],['plain',10,0,false],['odd',1,0,false]]);
 const painter=fs.readFileSync(path.join(__dirname,'..','extension','themes','train','painter.js'),'utf8').split(String.fromCharCode(10)).map(l=>l.trimStart()).join('');
 assert.match(painter,/cl=sp\.cols>0\?sp\.cols:sp\.frames/,'the painter reads the sheet in rows');assert.match(painter,/gl\.uniform1f\(u\.uTw,tw\)/,'and mixes this frame with the next by the share of the time');assert.match(painter,/if\(uTw>0\.\)c=mix\(c,texture\(uTex,\(uCell2\.xy/,'in one draw (in the shader)');assert.doesNotMatch(painter,/share\*fade\*tw/,'never one laid over the other');
});

test('Soul Passage: a land without a day keeps the night carriage at every hour; no land of 4.2.2 is one (the deep sea was)',async t=>{
 // the table's word `night` on a land: the band's moment is asked for its night while that land passes, as Dark is. Read from the source:
 const src=read('scene-themes.js');
 assert.ok(src.includes("if(rides[id]){const here=landOfDay(env.day),table=rooms[id]?.pages;if(table&&Object.hasOwn(table,here)&&table[here]?.night)env.hour=1;}"),'the moment asks for night over a land without a day');
 assert.deepEqual(Object.entries(PAGED_FILE).filter(([,info])=>info.night).map(([land])=>land),[],'no shipped land asks for it since the deep sea left (4.2.2)');
 // the word still works (kept for a land to come): in a world where Wednesday's land has no day, Wednesday noon is that land's night
 // under the night cabin and the room's mood is marked; Friday's land, which has a day, is noon again and unmarked
 const h=fixture({paged:{...PAGED,clouds:{...PAGED.clouds,night:1}},clock:{day:3,date:4}});t.after(()=>h.api.remove());h.apply();await h.load();await h.minute();await h.load();
 const mood=()=>h.rd.querySelector('.tk-stage').getAttribute('data-mood');
 assert.deepEqual(h.layers(),[['land-clouds-night',1],[cab('clouds','night'),1]],'noon on the clock, night in the band');assert.equal(mood(),'deep');
 Object.assign(h.clock,{day:5,date:6});await h.minute();await h.load();await h.minute();await h.load();
 assert.deepEqual(h.layers(),[['land-citadel-noon',1],[cab('citadel','noon'),1]],'a land with a day: the clock');assert.equal(mood(),null);
 // the band's own words are untouched: asked at hour 1 on a Thursday they give its night land and the night cabin
 assert.deepEqual(at(4,1,45),[['land-metro-night',1],[cab('metro','night'),1]]);
});

test('Soul Passage: a sprite may replace its patch of the picture (the factory\'s fist), and only while it is really drawn',()=>{
 const L=scenes().liveOf;const got=JSON.parse(JSON.stringify(L({v:1,layers:[],sprites:[{id:'fist',frame:[0,0,607,511],frames:48,cols:6,tween:1,cut:1,fps:8,layer:2,at:[2820,1400],scale:1.45,stages:'all'},{id:'plain',frame:[0,0,84,34],frames:10,at:[600,120]},{id:'odd',frame:[0,0,9,9],at:[1,1],cut:'yes'}]})));
 assert.deepEqual(got.sprites.map(s=>[s.id,s.cut]),[['fist',true],['plain',false],['odd',false]]);
 const painter=fs.readFileSync(path.join(__dirname,'..','extension','themes','train','painter.js'),'utf8').split(String.fromCharCode(10)).map(l=>l.trimStart()).join('');
 assert.match(painter,/function cutOf\(s,n,stage,win\)\{const live=s\.live;if\(!live\|\|s\.quality<2\|\|!s\.info\?\.sprites\)return null;/,'nothing is cut when sprites are not drawn');
 assert.match(painter,/if\(!sheet\?\.ready\)return null;/,'nor before the sheet has come');
 assert.match(painter,/if\(!sp\.cut\|\|sp\.fixed\|\|Math\.floor\(sp\.layer\)!==n\|\|!sp\.stages\.includes\(stage\)\)continue;/,'nor for another layer or another hour');
 assert.match(painter,/const cs=!o\.cover&&o\.cut\?o\.cut:\[\]/,'the cover pass keeps the whole picture');
 assert.match(painter,/col\*=1\.-smoothstep\(uCutEdge\.x,uCutEdge\.x\+uCutEdge\.y,e\);/,'the picture gives way over a ramp inside the patch');
 assert.match(painter,/gl\.uniform2f\(u\.uCutEdge,32,40\)/,'a rim of 32 art px untouched, a ramp of 40: the sheet is made for these');
 // (4.2.6) a layer may have up to six such patches, each sprite's own, and the cabin's window has them too (Above the clouds: the
 // land's own whales leave the picture where they were painted and move as sprites); the sky never does
 assert.match(painter,/uniform vec4 uCut\[6\];uniform float uCuts;/);assert.match(painter,/for\(int i=0;i<6;i\+\+\)\{if\(float\(i\)>=uCuts\)break;vec4 c=uCut\[i\];/,'every patch of the layer');
 assert.match(painter,/out\.push\(\[sp\.at\[0\]-w\/2,y0,sp\.at\[0\]\+w\/2,y0\+h\]\);\}\n?\s*return out\.length\?out:null;\}/,'all of a layer\'s cut sprites, none: nothing');
 assert.match(painter,/cs\.slice\(0,6\)\.forEach/,'six at most');assert.match(painter,/if\(inWindow\(sp\)!==!!win\)continue;/,'the window pass takes the patches in the window rows, the page pass the others');assert.match(painter,/cut:cutOf\(s,id,st,true\)/);
 // (a cut sprite's cell has a wide empty margin: where it belongs is told by the middle row of its cell, and it is drawn in that pass only)
 assert.match(painter,/const inWindow=sp=>sp\.at\[1\]-\.663\*sp\.frame\[3\]\*sp\.scale<384;/);assert.match(painter,/if\(sp\.cut&&inWindow\(sp\)!==!!region\.win\)continue;/);
 {const inWindow=sp=>sp.at[1]-.663*sp.frame[3]*sp.scale<384;assert.equal(inWindow({at:[422,334.88],frame:[0,0,393,216],scale:1.33333}),true,'a small whale of the window, its cell reaching under the window');assert.equal(inWindow({at:[2885,1433.03],frame:[0,0,607,511],scale:1.45}),false,'the factory\'s fist');assert.equal(inWindow({at:[2746,2045.72],frame:[0,0,982,610],scale:1.666}),false,'the great flukes\' plate');}
 assert.equal((painter.match(/cut:cutOf\(/g)||[]).length,2,'the page\'s travelling layers and the window\'s strips');
});

test('Soul Passage: the cabin answers a land without a day (none in 4.2.2; the deep sea was one): its lamps low, the water\'s cold in the room',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','extension','scene-themes.js'),'utf8'),css=fs.readFileSync(path.join(__dirname,'..','extension','themes','train','theme.css'),'utf8');
 // the stage is marked from the passing land's own entry, and unmarked when another land passes
 assert.match(src,/const mood=rooms\.train\?\.pages\?\.\[name\]\?\.night\?'deep':null;if\(stage\.getAttribute\('data-mood'\)!==mood\)\{if\(mood\)stage\.setAttribute\('data-mood',mood\);else stage\.removeAttribute\('data-mood'\);\}/);
 // one filter on the cabin's own layer (the room and its pieces), nothing on the windows' land
 const rule=/\.rd\[data-theme-kit\] \.tk-stage\[data-mood="deep"\] > \.tk-cabin\{filter:brightness\(\.5\) saturate\(\.4\) hue-rotate\(-25deg\) contrast\(1\.12\);animation:tk-falter 11s linear infinite\}/;
 assert.match(css,rule);assert.doesNotMatch(css,/data-mood[^{]*tk-land/,'the land in the windows is left as it is');
 // the faltering light only ever changes the filter, begins and ends at the resting filter, and stops with motion off
 const frames=css.match(/@keyframes tk-falter\{(.*?)\}\}/)?.[1]||'';assert.ok(frames.length>0);
 assert.deepEqual([...frames.matchAll(/\{([a-z-]+):/g)].map(m=>m[1]).filter(k=>k!=='filter'),[]);
 assert.match(frames,/^0%,61%\{filter:brightness\(\.5\) /);assert.match(frames,/65\.6%,100%\{filter:brightness\(\.5\) [^}]*$/);
 assert.match(css,/\[data-graphics=low\]\) \.tk-stage\[data-mood="deep"\] > \.tk-cabin\{animation:none\}/);
});
