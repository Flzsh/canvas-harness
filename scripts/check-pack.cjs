'use strict';
const fs=require('node:fs'),path=require('node:path');
const C=require('../extension/pack-common.js'),Art=require('../extension/custom-art.js'),Kits=require('../extension/custom-kits.js'),Quick=require('../extension/quick-pack.js');
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
 const frame=(kind,label)=>{const value=pack.frames?.[kind],style=value?'border:24px solid transparent;border-image-source:url(&quot;'+E(assetURL(pack.assets[value.asset],true))+'&quot;);border-image-slice:'+value.slice.join(' ')+';border-image-repeat:stretch;':'';return '<div class="surface" style="'+style+'"><h3>'+label+'</h3><p class="muted">Supporting text</p><button type="button">Sample button</button></div>';};
 const samples=['light','dark'].map(mode=>{
  const palette=pack.colors[mode]||Object.values(pack.colors)[0],vars=Object.entries(palette).map(([key,v])=>'--'+key+':'+v).join(';'),banner=pack.banner?'<div class="banner">'+part(pack,pack.banner)+'</div>':'';
  return '<section class="sample" style="'+vars+'"><h2>'+mode+' sample'+(pack.colors[mode]?'':' (available palette)')+'</h2><div class="back">'+part(pack,pack.background)+'</div><div class="sample-content">'+banner+'<h3'+(pack.title?' style="font-family:PackTitle;font-weight:'+pack.title.weight+'"':'')+'>Dashboard title</h3><p class="muted">Muted dashboard text</p>'+frame('panel','Panel')+frame('card','Course card')+'<div class="icons">'+(pack.icons||[]).map(id=>image(pack.assets[id],{style:'width:40px;height:40px;object-fit:contain'})).join('')+'</div></div></section>';
 }).join('');const still=['background','banner'].filter(key=>pack[key]?.still||pack.assets?.[pack[key]?.asset]?.still).map(key=>'<h3>'+key+' still</h3><div class="banner">'+part(pack,pack[key],{still:true})+'</div>').join('');
 const font=pack.title?'<style>@font-face{font-family:PackTitle;src:url("'+assetURL(pack.assets[pack.title.asset])+'");font-weight:'+pack.title.weight+'}</style>':'';return font+'<div class="samples">'+samples+'</div>'+still;
}
function preview(result){
 const {pack}=result;let body='';
 if(pack.format==='chtheme')body=themePreview(pack);
 else if(pack.format==='chpet'){const pet=codecs.chpet;body='<div class="poses">'+pet.poses.map(name=>{const asset=pet.pose(pack,name),reduced=pet.pose(pack,name,true);return '<figure><figcaption>'+E(name)+(pack.poses[name]?'':' (fallback)')+'</figcaption><div style="width:'+pack.size[0]+'px;height:'+pack.size[1]+'px">'+image(asset,{reduced,style:'width:100%;height:100%;object-fit:contain'})+'</div><p>Still</p><div style="width:'+pack.size[0]+'px;height:'+pack.size[1]+'px">'+image(reduced,{still:true,style:'width:100%;height:100%;object-fit:contain'})+'</div></figure>';}).join('')+'</div>';}
 else if(pack.format==='chpreset')body='<p>Changes to local data</p><ul>'+codecs.chpreset.describe(pack).map(line=>'<li>'+E(line)+'</li>').join('')+'</ul>';
 else body='<div class="poses">'+Object.entries(pack.assets).map(([key,asset])=>'<figure><figcaption>'+E(asset.slot||key)+'</figcaption>'+image(asset,{style:'max-width:100%;width:360px;height:140px;object-fit:contain'})+'</figure>').join('')+'</div>';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; media-src data:; font-src data:; style-src \'unsafe-inline\'"><title>'+E(pack.name)+' preview</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:24px}h1,h2,h3,p{margin:0 0 12px}.samples,.poses,.icons{display:flex;flex-wrap:wrap;gap:20px}.sample{position:relative;isolation:isolate;box-sizing:border-box;overflow:hidden;flex:1 1 360px;padding:20px;background:var(--bg);color:var(--ink);border:1px solid var(--line)}.sample h2,.sample-content{position:relative;z-index:1}.back{position:absolute;inset:0;z-index:0;pointer-events:none}.sample-content{display:grid;gap:16px}.surface{padding:16px;background:var(--surface);border:1px solid var(--line)}.muted{color:var(--muted)}button{color:var(--accent);background:var(--surface);border:1px solid var(--line);padding:8px}.banner{height:160px;overflow:hidden}.movie,.video-still{width:100%;height:100%}.video-still,.tile-still{display:none}.tile-image{width:100%;height:100%;background-repeat:repeat}.video-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}.video-cell{min-width:0;min-height:0;overflow:hidden}.video-cell picture{width:100%;height:100%}picture,img,video{display:block;max-width:100%}figure{margin:0;padding:12px;border:1px solid}figcaption{margin-bottom:8px}@media(prefers-reduced-motion:reduce){video,.tile-live{display:none}.video-still,.tile-still{display:block}}</style></head><body><h1>'+E(pack.name)+' preview</h1><p>'+E(result.kind)+' preview</p>'+body+'</body></html>\n';
}
function sameFile(a,b){return a.dev===b.dev&&a.ino!==0&&a.ino===b.ino;}
function writePreview(input,target,html,inputStat){
 const fold=value=>process.platform==='win32'?value.toLowerCase():value,inputPath=path.resolve(input),targetPath=path.resolve(target);if(fold(inputPath)===fold(targetPath))throw Error('Preview output must differ from the input file');
 try{const targetStat=fs.statSync(targetPath);if(sameFile(inputStat,targetStat)||fold(fs.realpathSync.native(inputPath))===fold(fs.realpathSync.native(targetPath)))throw Error('Preview output must differ from the input file');}catch(error){if(error.code!=='ENOENT')throw error;}
 let descriptor;try{descriptor=fs.openSync(targetPath,fs.constants.O_WRONLY|fs.constants.O_CREAT,0o666);if(sameFile(inputStat,fs.fstatSync(descriptor)))throw Error('Preview output must differ from the input file');fs.ftruncateSync(descriptor,0);fs.writeFileSync(descriptor,html,'utf8');}finally{if(descriptor!==undefined)fs.closeSync(descriptor);}
}
async function main(argv=process.argv.slice(2),io={out:console.log,error:console.error}){
 let filename,outFile,wantsPreview=false;for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--preview'){wantsPreview=true;if(i+1<argv.length&&!argv[i+1].startsWith('--')&&(filename||argv.length-i>2))outFile=argv[++i];}else if(arg.startsWith('--')||filename){io.error('Usage: node check.cjs <pack> [--preview [output.html]]');return 2;}else filename=arg;}
 if(!filename){io.error('Usage: node check.cjs <pack> [--preview [output.html]]');return 2;}
 try{const stat=fs.statSync(filename);if(!stat.isFile()||stat.size<1||stat.size>C.limits.fileBytes)throw new C.ValidationError(['$: file must be nonempty and at most 40000000 bytes']);let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(filename));}catch(error){throw new C.ValidationError(['$: '+error.message]);}const result=await validate(source,{extension:path.extname(filename).slice(1).toLowerCase()});let target;
  if(wantsPreview){target=path.resolve(outFile||filename+'.preview.html');writePreview(filename,target,preview(result),stat);}io.out('OK: '+result.kind+' '+result.pack.name);
  if(result.media.length)io.error('NOTE: Node verified hashes, container metadata and bounds. Browser import still decodes/transcodes media; this is not browser playback verification.');
  if(target)io.out('Preview: '+target);return 0;
 }catch(error){for(const message of error.problems||[error.message])io.error(message);return 1;}
}
module.exports={validate,preview,main,codecs};if(require.main===module)main().then(code=>{process.exitCode=code;},error=>{console.error(error.message);process.exitCode=1;});
