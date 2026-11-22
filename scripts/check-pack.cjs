'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const C=require('../extension/pack-common.js'),Art=require('../extension/custom-art.js'),Kits=require('../extension/custom-kits.js'),Quick=require('../extension/quick-pack.js');
const K=require('../extension/band-kit.js');
const codecs={chtheme:require('../extension/theme-pack.js'),chpet:require('../extension/pet-pack.js'),chpreset:require('../extension/preset-pack.js')};
const E=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function validateKit(source){
 const c=C.context();let value;try{value=JSON.parse(source);}catch{throw new C.ValidationError(['$: malformed JSON']);}
 const input=c.record(value,['version','name','assets','accent','font','bannerSize','bannerFit','bannerPosition','titlePlacement'],'$',['version','name','assets','accent','font','bannerSize','bannerFit','bannerPosition','titlePlacement']),raw=c.record(input.assets,['bannerArt','borderArt','titleArt','iconArt'],'$.assets'),parts={},svgOnly={...input,assets:{}};
 for(const [key,part]of Object.entries(raw)){
  const field='$.assets.'+key,v=c.record(part,['name','type','data','sha256'],field,['name','type','data','sha256']);c.text(v.name,field+'.name',160);const allowed=key==='bannerArt'?C.imageTypes.concat(C.videoTypes):key==='titleArt'?['image/svg+xml','image/png','image/webp']:['image/svg+xml'];c.choice(v.type,allowed,field+'.type');parts[key]={type:v.type,data:v.data,sha256:v.sha256};if(v.type==='image/svg+xml')svgOnly.assets[key]=v;
 }
 const pack={format:'chkit',...input,assets:C.assets(parts,c)};c.finish();await Kits.importKit(new Blob([JSON.stringify(svgOnly)]));const {media}=await C.processAssets(pack,c);c.finish();return {pack,media,kind:'kit'};
}
async function validate(source,{extension=''}={}){
 if(typeof source!=='string')source=JSON.stringify(source);
 if(source.length>C.limits.fileBytes||Buffer.byteLength(source)>C.limits.fileBytes)throw new C.ValidationError(['$: file exceeds 40000000 bytes']);
 if(extension==='chpack'||source.trimStart().startsWith('<?ch-pack')){
  const parsed=Quick.parse(source),problems=parsed.errors.map(v=>'$: '+v.message),assets={};let total=0;
  for(const part of parsed.parts){for(const v of part.errors)problems.push('$.parts['+part.index+']: '+v.message);if(part.svg&&!part.errors.length)try{const asset=Art.importSVG(part.svg,part.name||'Artwork');total+=Buffer.byteLength(asset.svg);assets[part.index]={...asset,slot:part.slot};}catch(error){problems.push('$.parts['+part.index+']: '+error.message);}}
  if(total>Art.limits.totalBytes)problems.push('$.parts: SVG artwork exceeds the aggregate budget');if(problems.length)throw new C.ValidationError(problems);return {kind:'course-art',pack:{format:'chpack',name:parsed.name,assets},media:[]};
 }
 let parsed;try{parsed=JSON.parse(source);}catch{throw new C.ValidationError(['$: malformed JSON']);}const format=parsed?.format;
 if(extension==='chkit'||!format&&parsed?.version===1&&parsed?.assets)return validateKit(source);
 const codec=typeof format==='string'&&Object.hasOwn(codecs,format)?codecs[format]:null;if(!codec)throw new C.ValidationError(['$.format: expected chtheme, chpet or chpreset']);if(extension&&extension!==format)throw new C.ValidationError(['$.format: file extension .'+extension+' does not match '+format]);const result=await codec.validate(source);return {...result,kind:format==='chtheme'?'theme':format==='chpet'?'pet':'preset'};
}
function svgURL(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
function assetURL(asset,still=false){return asset.svg?svgURL(still?asset.still||asset.svg:asset.svg):still&&asset.firstFrame||'data:'+asset.type+';base64,'+asset.data;}
function image(asset,{still=false,reduced=asset,style=''}={}){if(!asset)return '';const url=assetURL(asset,still),src=E(url),css=E(style),rest=assetURL(reduced,true);return '<picture>'+(!still&&rest!==url?'<source media="(prefers-reduced-motion: reduce)" srcset="'+E(rest)+'">':'')+'<img alt="" src="'+src+'" style="'+css+'"></picture>';}
function tiledImage(asset,{still=false,reduced=asset,position='center'}={}){if(!asset)return '';const live=assetURL(asset,still),rest=assetURL(reduced,true),alternate=!still&&rest!==live&&(asset!==reduced||!asset.svg||C.animatedSVG(asset.svg)),layer=(url,kind)=>'<div aria-hidden="true" class="tile-image'+kind+'" style="'+E('background-image:url("'+url+'");background-position:'+position)+'"></div>';return layer(live,alternate?' tile-live':'')+(alternate?layer(rest,' tile-still'):'');}
function part(pack,value,{still=false}={}){
 if(!value)return '';const asset=pack.assets[value.asset],poster=value.still&&pack.assets[value.still],tile=value.fit==='tile',style='width:100%;height:100%;object-fit:'+(tile?'cover':value.fit||'cover')+';object-position:'+(value.position||'center');
 if(C.videoTypes.includes(asset.type)){const cell=still?image(poster,{still:true,style}):'<video controls muted loop playsinline preload="metadata"'+(poster?' poster="'+E(assetURL(poster,true))+'"':'')+' style="'+E(style)+'"><source src="'+E(assetURL(asset))+'" type="'+E(asset.type)+'"></video><div class="video-still">'+image(poster,{still:true,style})+'</div>';return tile?'<div class="movie video-tiles">'+Array(4).fill('<div class="video-cell">'+cell+'</div>').join('')+'</div>':still?cell:'<div class="movie">'+cell+'</div>';}
 if(tile)return tiledImage(still&&poster?poster:asset,{still,reduced:poster||asset,position:value.position||'center'});
 if(still&&poster)return image(poster,{still:true,style});return image(asset,{still,reduced:poster||asset,style});
}
function themePreview(pack){
 const bandPart=(mode,still=false)=>{const value=mode==='dark'&&pack.band.dark||pack.band,focus=pack.band.focus||{x:1,y:.5};return part(pack,{...value,still:value.stillAsset||value.still,fit:'cover',position:Math.round(focus.x*100)+'% '+Math.round(focus.y*100)+'%'},{still});};
 const frame=(kind,label)=>{const value=pack.frames?.[kind],style=value?'border:24px solid transparent;border-image-source:url(&quot;'+E(assetURL(pack.assets[value.asset],true))+'&quot;);border-image-slice:'+value.slice.join(' ')+';border-image-repeat:stretch;':'';return '<div class="surface" style="'+style+'"><h3>'+label+'</h3><p class="muted">Supporting text</p><button type="button">Sample button</button></div>';};
 const samples=['light','dark'].map(mode=>{
  const palette=pack.colors[mode]||Object.values(pack.colors)[0],vars=Object.entries(palette).map(([key,v])=>'--'+key+':'+v).join(';'),banner=pack.banner?'<div class="banner">'+part(pack,pack.banner)+'</div>':'',band=pack.band?'<div class="band" title="Band (8:1, cropped to the band at its focus)">'+bandPart(mode)+'</div>':'';
  return '<section class="sample" style="'+vars+'"><h2>'+mode+' sample'+(pack.colors[mode]?'':' (available palette)')+'</h2><div class="back">'+part(pack,pack.background)+'</div><div class="sample-content">'+band+banner+'<h3'+(pack.title?' style="font-family:PackTitle;font-weight:'+pack.title.weight+'"':'')+'>Dashboard title</h3><p class="muted">Muted dashboard text</p>'+frame('panel','Panel')+frame('card','Course card')+'<div class="icons">'+(pack.icons||[]).map(id=>image(pack.assets[id],{style:'width:40px;height:40px;object-fit:contain'})).join('')+'</div></div></section>';
 }).join('');const still=['background','banner'].filter(key=>pack[key]?.still||pack.assets?.[pack[key]?.asset]?.still).map(key=>'<h3>'+key+' still</h3><div class="banner">'+part(pack,pack[key],{still:true})+'</div>').join('')+(pack.band?[['light','band still'],...(pack.band.dark?[['dark','band.dark still']]:[])].map(([mode,label])=>'<h3>'+label+'</h3><div class="band">'+bandPart(mode,true)+'</div>').join(''):'');
 const font=pack.title?'<style>@font-face{font-family:PackTitle;src:url("'+assetURL(pack.assets[pack.title.asset])+'");font-weight:'+pack.title.weight+'}</style>':'';return font+'<div class="samples">'+samples+'</div>'+still;
}
function preview(result){
 const {pack}=result;let body='';
 if(pack.format==='chtheme')body=themePreview(pack);
 else if(pack.format==='chpet'){const pet=codecs.chpet;body='<div class="poses">'+pet.poses.map(name=>{const asset=pet.pose(pack,name),reduced=pet.pose(pack,name,true);return '<figure><figcaption>'+E(name)+(pack.poses[name]?'':' (fallback)')+'</figcaption><div style="width:'+pack.size[0]+'px;height:'+pack.size[1]+'px">'+image(asset,{reduced,style:'width:100%;height:100%;object-fit:contain'})+'</div><p>Still</p><div style="width:'+pack.size[0]+'px;height:'+pack.size[1]+'px">'+image(reduced,{still:true,style:'width:100%;height:100%;object-fit:contain'})+'</div></figure>';}).join('')+'</div>';}
 else if(pack.format==='chpreset')body='<p>Changes to local data</p><ul>'+codecs.chpreset.describe(pack).map(line=>'<li>'+E(line)+'</li>').join('')+'</ul>';
 else body='<div class="poses">'+Object.entries(pack.assets).map(([key,asset])=>'<figure><figcaption>'+E(asset.slot||key)+'</figcaption>'+image(asset,{style:'max-width:100%;width:360px;height:140px;object-fit:contain'})+'</figure>').join('')+'</div>';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; media-src data:; font-src data:; style-src \'unsafe-inline\'"><title>'+E(pack.name)+' preview</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:24px}h1,h2,h3,p{margin:0 0 12px}.samples,.poses,.icons{display:flex;flex-wrap:wrap;gap:20px}.sample{position:relative;isolation:isolate;box-sizing:border-box;overflow:hidden;flex:1 1 360px;padding:20px;background:var(--bg);color:var(--ink);border:1px solid var(--line)}.sample h2,.sample-content{position:relative;z-index:1}.back{position:absolute;inset:0;z-index:0;pointer-events:none}.sample-content{display:grid;gap:16px}.surface{padding:16px;background:var(--surface);border:1px solid var(--line)}.muted{color:var(--muted)}button{color:var(--accent);background:var(--surface);border:1px solid var(--line);padding:8px}.banner{height:160px;overflow:hidden}.band{aspect-ratio:8/1;overflow:hidden}.movie,.video-still{width:100%;height:100%}.video-still,.tile-still{display:none}.tile-image{width:100%;height:100%;background-repeat:repeat}.video-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}.video-cell{min-width:0;min-height:0;overflow:hidden}.video-cell picture{width:100%;height:100%}picture,img,video{display:block;max-width:100%}figure{margin:0;padding:12px;border:1px solid}figcaption{margin-bottom:8px}@media(prefers-reduced-motion:reduce){video,.tile-live{display:none}.video-still,.tile-still{display:block}}</style></head><body><h1>'+E(pack.name)+' preview</h1><p>'+E(result.kind)+' preview</p>'+body+'</body></html>\n';
}
function sameFile(a,b){return a.dev===b.dev&&a.ino!==0&&a.ino===b.ino;}
function writePreview(input,target,html,inputStat){
 const fold=value=>process.platform==='win32'?value.toLowerCase():value,inputPath=path.resolve(input),targetPath=path.resolve(target);if(fold(inputPath)===fold(targetPath))throw Error('Preview output must differ from the input file');
 try{const targetStat=fs.statSync(targetPath);if(sameFile(inputStat,targetStat)||fold(fs.realpathSync.native(inputPath))===fold(fs.realpathSync.native(targetPath)))throw Error('Preview output must differ from the input file');}catch(error){if(error.code!=='ENOENT')throw error;}
 let descriptor;try{descriptor=fs.openSync(targetPath,fs.constants.O_WRONLY|fs.constants.O_CREAT,0o666);if(sameFile(inputStat,fs.fstatSync(descriptor)))throw Error('Preview output must differ from the input file');fs.ftruncateSync(descriptor,0);fs.writeFileSync(descriptor,html,'utf8');}finally{if(descriptor!==undefined)fs.closeSync(descriptor);}
}
/* The band, for a creator: the level the file needs, what a lower level would leave out, everything the reader left
   out or changed, and two things measured at the common window sizes: whether a keep box is cut, and (for a PNG still,
   the only picture type Node can read without a decoder) whether the greeting sits on low contrast. */
function pngPixels(buffer){
 try{
  if(buffer.length<33||buffer.readUInt32BE(0)!==0x89504e47)return null;let at=8,head=null;const data=[];
  while(at+8<=buffer.length){const size=buffer.readUInt32BE(at),tag=buffer.toString('latin1',at+4,at+8),body=buffer.subarray(at+8,at+8+size);if(tag==='IHDR')head=body;else if(tag==='IDAT')data.push(body);else if(tag==='IEND')break;at+=12+size;}
  const w=head.readUInt32BE(0),h=head.readUInt32BE(4),n={0:1,2:3,4:2,6:4}[head[9]];if(head[8]!==8||!n||head[12]||w*h>16e6)return null;
  const raw=zlib.inflateSync(Buffer.concat(data)),line=w*n,px=new Uint8Array(h*line);if(raw.length<h*(line+1))return null;
  for(let y=0;y<h;y++){const f=raw[y*(line+1)],src=y*(line+1)+1,dst=y*line;for(let i=0;i<line;i++){const a=i>=n?px[dst+i-n]:0,b=y?px[dst-line+i]:0,c=y&&i>=n?px[dst-line+i-n]:0,x=raw[src+i];let v=x;if(f===1)v=x+a;else if(f===2)v=x+b;else if(f===3)v=x+((a+b)>>1);else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=x+(pa<=pb&&pa<=pc?a:pb<=pc?b:c);}px[dst+i]=v&255;}}
  const sw=Math.min(96,w),sh=Math.max(1,Math.min(96,Math.round(sw*h/w))),out=new Uint8ClampedArray(sw*sh*4);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(Math.min(h-1,Math.floor((y+.5)*h/sh))*w+Math.min(w-1,Math.floor((x+.5)*w/sw)))*n,o=(y*sw+x)*4;if(n<3){out[o]=out[o+1]=out[o+2]=px[i];out[o+3]=n===2?px[i+1]:255;}else{out[o]=px[i];out[o+1]=px[i+1];out[o+2]=px[i+2];out[o+3]=n===4?px[i+3]:255;}}
  return {data:out,w:sw,h:sh};
 }catch{return null;}
}
function bandReport(result){
 const lines=[],notes=[],pack=result.pack,B=result.band;if(pack?.format!=='chtheme'||!B)return {lines,notes};
 for(const note of B.notes)notes.push(note.path+': '+note.message);
 if(pack.companion)lines.push('Companion: '+pack.companion.name+' (walks while this theme is on)');
 if(B.held){lines.push('Band: left out here. The file asks for band level '+pack.minBand+'; this checker reads level '+K.level+'.');return {lines,notes};}
 if(!pack.band)return {lines,notes};
 lines.push('Band level needed: '+B.needs.level+' (this checker reads level '+K.level+')');
 for(let at=B.needs.level-1;at>=1;at--){const lost=K.older(B.needs,at);if(lost.length)lines.push(' a version at band level '+at+' cannot use: '+lost.join(', '));}
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),clamp=v=>Math.min(1,Math.max(0,v)),light=hex=>{const m=/^#([0-9a-f]{6})/i.exec(String(hex));if(!m)return .5;const n=parseInt(m[1],16);return ((n>>16)*.2126+((n>>8)&255)*.7152+(n&255)*.0722)/255;};
 const band=K.clean(pack.band,{picture:value=>Object.fromEntries(K.pictureKeys.filter(key=>own(value,key)).map(key=>[key,value[key]])),image:id=>own(pack.assets,id)}).band,seenPictures=new Map();let unread=false;
 for(const mode of ['light','dark'].filter(mode=>pack.colors[mode])){
  const cut=[],dim=[];
  for(const size of K.sizes){
   const view={w:size.w,h:size.h},look=K.resolve(band,{mode,ratio:size.w/size.h,hour:12,month:6}),asset=pack.assets[look.asset],art=asset?.width&&asset?.height?{w:asset.width,h:asset.height}:null;if(!art)continue;
   const keep=look.keep||K.autoKeep(art),f=K.fit(art,view,{focus:look.focus,keep});
   if(look.keep&&f.kept<.98)cut.push(size.name+' ('+Math.round(f.kept*100)+'% shows)');
   if(look.text==='auto'||look.shade)continue;
   const id=look.stillAsset||(typeof look.still==='string'?look.still:look.asset),still=pack.assets[id];if(!seenPictures.has(id))seenPictures.set(id,still?.type==='image/png'&&typeof still.data==='string'?pngPixels(Buffer.from(still.data,'base64')):null);
   const pixels=seenPictures.get(id);if(!pixels){unread=true;continue;}
   const grid=K.detail(pixels.data,pixels.w,pixels.h).grid,q=size.greeting,span=(a,b)=>{a=clamp(a);b=clamp(b);if(b-a<.0625){a=Math.min(a,.9375);b=a+.0625;}return [a,b];},[x0,x1]=span((q.x-f.x)/f.w,(q.x+q.w-f.x)/f.w),[y0,y1]=span((q.y-f.y)/f.h,(q.y+q.h-f.y)/f.h),behind=K.shadeOf(grid,x0,y0,x1,y1);if(behind===null)continue;
   const mid=(q.x+q.w/2)/view.w,alpha=mid<.08?mid/.08*.5:mid<.25?.5+(mid-.08)/.17*.5:1,ground=light(pack.colors[mode].bg)*(1-alpha)+behind*alpha,words=look.text==='light'?.97:look.text==='dark'?.11:light(pack.colors[mode].ink);
   if(Math.abs(words-ground)<.4)dim.push(size.name);
  }
  if(cut.length)notes.push('$.band.keep ('+mode+'): the keep box is cut at '+cut.join(', ')+'. A picture never shrinks below half the size that fills the band; make the box smaller, or give a `narrow` picture for tall, narrow windows.');
  if(dim.length)notes.push('$.band ('+mode+'): the greeting sits on low contrast at '+dim.join(', ')+'. Set "text": "auto", or add a "shade".');
 }
 if(unread)notes.push('$.band: text contrast at the greeting was not measured (only a PNG still can be read here). "text": "auto" lets the page choose light or dark words from the picture.');
 return {lines,notes};
}
async function main(argv=process.argv.slice(2),io={out:console.log,error:console.error}){
 let filename,outFile,wantsPreview=false;for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--preview'){wantsPreview=true;if(i+1<argv.length&&!argv[i+1].startsWith('--')&&(filename||argv.length-i>2))outFile=argv[++i];}else if(arg.startsWith('--')||filename){io.error('Usage: node check.cjs <pack> [--preview [output.html]]');return 2;}else filename=arg;}
 if(!filename){io.error('Usage: node check.cjs <pack> [--preview [output.html]]');return 2;}
 try{const stat=fs.statSync(filename);if(!stat.isFile()||stat.size<1||stat.size>C.limits.fileBytes)throw new C.ValidationError(['$: file must be nonempty and at most 40000000 bytes']);let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(filename));}catch(error){throw new C.ValidationError(['$: '+error.message]);}const result=await validate(source,{extension:path.extname(filename).slice(1).toLowerCase()});let target;
  if(wantsPreview){target=path.resolve(outFile||filename+'.preview.html');writePreview(filename,target,preview(result),stat);}io.out('OK: '+result.kind+' '+result.pack.name);
  for(const [field,value]of result.pack.format==='chtheme'&&result.pack.band?[['band',result.pack.band],...(result.pack.band.dark?.asset?[['band.dark',result.pack.band.dark]]:[])]:[]){const a=result.pack.assets[value.asset],ratio=a?.width&&a?.height?a.width/a.height:0,kept=value.keep||result.pack.band.keep;if(ratio&&ratio<5&&!kept)io.error('NOTE: '+field+' is '+a.width+' x '+a.height+', not band shaped; it is placed whole around its detail. Give "keep" to choose what always shows.');else if(ratio&&!kept&&(ratio<6||ratio>10||a.width<2048))io.error('NOTE: '+field+' is '+a.width+' x '+a.height+'; a band is painted at 8:1 (4096 x 512) and cropped to the band (cover).');}
  {const report=bandReport(result);for(const text of report.lines)io.out(text);for(const note of report.notes)io.error('NOTE: '+note);}
  if(result.media.length)io.error('NOTE: Node verified hashes, container metadata and bounds. Browser import still decodes/transcodes media; this is not browser playback verification.');
  if(target)io.out('Preview: '+target);return 0;
 }catch(error){for(const message of error.problems||[error.message])io.error(message);return 1;}
}
module.exports={validate,preview,main,codecs,bandReport};if(require.main===module)main().then(code=>{process.exitCode=code;},error=>{console.error(error.message);process.exitCode=1;});
