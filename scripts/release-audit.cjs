'use strict';
// Usage: node scripts/release-audit.cjs <unpacked-directory> [release-manifest.json]
// Optional: --source <checkout> --package <archive-name> --output <summary.json>
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),LIMIT=3500,TEXT=/\.(?:[cm]?js|css|html?|json|svg|md|txt|map|xml|webmanifest)$/i;
const PINS=new Map([
 ['vendor/pdfjs/pdf.mjs','bc51f4874a66e3853189cb5d50aba4b3096afa83ed433b885d293a3d94583cdc'],
 ['vendor/pdfjs/pdf.worker.mjs','bb422f60804477de4a0b09091d8347a916a387755ed1cbad24ccaec1d09c78bf']
]);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const escapeRE=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const term=parts=>escapeRE(parts.join(''));
// Keep policy strings assembled so this tool can pass the same content scan.
const RULES=[
 ['R01','(?<![\\w$-])'+term(['pl','ay-'])+'[a-z0-9_.-]+'],
 ['R02','\\b(?:'+term(['submit-','celebrate'])+'|'+term(['submit-','scenes'])+')\\b'],
 ['R03','\\b'+term(['the','mes'])+'[/\\\\]|\\b'+term(['sk','y','.js'])+'\\b|\\b'+term(['scene-','the','mes'])+'\\b'],
 ['R04','\\b(?:'+term(['biscuit-','parse'])+'|'+term(['pony-','study-','offer'])+'|'+term(['well','being'])+')\\b'],
 ['R05','\\b(?:(?:study|pony|biscuit)[-_])?'+term(['re','view'])+'(?:[-_][a-z0-9]+)*\\.(?:[cm]?js|css|html?)\\b'],
 ['R06','\\b(?:'+term(['study-','prompts'])+'|'+term(['study-','ui'])+')\\b'],
 ['R07','\\b'+term(['what'])+'\\s+'+term(['for'])+'\\b'],
 ['R08','\\b(?:(?:photo|answer)[-_\\s]*im'+'port|im'+'port[-_\\s]*(?:photo|answer)s?)\\b'],
 ['R09','\\b(?:(?:ai|study)[-_]?'+term(['ru','bric'])+'|(?:Reserve)?'+term(['ru','bric'])+'[-_]?(?:helpers?|ui|aids?|coach|prompts?|assist)|'+term(['fix-','list'])+'|'+term(['teacher-','feedback'])+')\\b'],
 ['R10','\\b(?:Reserve)?'+term(['course'])+'[-_]?'+term(['do','ck'])+'\\b'],
 ['R11','\\b(?:'+term(['pa','cks','.js'])+'|'+term(['pack-','views'])+')\\b'],
 ['R13','\\b(?:web(?:site)?[-_]?in'+'staller|(?:artwork|pack)[-_]?in'+'staller|in'+'stall[-_](?:pack|theme)|in'+'stallPack)\\b'],
 ['R14',term(['reserve:','de','v'])+'[a-z0-9:_-]*'],
 ['R15','\\b'+term(['w','ra','.instructure','.com'])+'\\b'],
 ['R16','\\b(?:__|Reserve|CanvasHarness|CH[_$])[\\w$]*(?:Ti'+'ming|De'+'bug|Tr'+'ace|Pe'+'rf)[\\w$]*','authored'],
 ['R17','\\bconsole\\s*\\.\\s*(?:time(?:End|Log)?|profile(?:End)?)\\s*\\(','authored'],
 ['R18','\\bperformance\\s*\\.\\s*(?:mark|measure|clearMarks|clearMeasures)\\s*\\(','authored']
].map(([id,pattern,scope])=>({id,pattern:new RegExp(pattern,'gim'),scope}));

function ensure(value,message){if(!value)throw Error(message);}
function safeName(value,directory=false,pattern=false){
 ensure(typeof value==='string'&&value.length>0,'entry path must be a nonempty string');
 const name=directory&&value.endsWith('/')?value.slice(0,-1):value;
 ensure(!/[\\:\x00-\x1f\x7f<>"|?]/.test(name)&&(pattern||!name.includes('*'))&&!name.startsWith('/'),'unsafe entry path '+JSON.stringify(value));
 ensure(name.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[. ]$/.test(part)),'unsafe entry path '+JSON.stringify(value));
 return name;
}
function contained(root,filename){
 const absolute=path.resolve(root,filename),relative=path.relative(root,absolute);
 ensure(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'path leaves its root: '+filename);
 return absolute;
}
function fileInside(root,filename){
 const absolute=contained(root,filename),real=fs.realpathSync(absolute),relative=path.relative(fs.realpathSync(root),real);
 ensure(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'source link leaves its root: '+filename);
 ensure(fs.statSync(real).isFile(),'not a file: '+filename);return absolute;
}
function inventory(root){
 ensure(fs.statSync(root).isDirectory(),'not a directory: '+root);
 const files=new Map(),spellings=new Map();
 function walk(dir,prefix=''){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const name=safeName(prefix+entry.name),folded=name.normalize('NFC').toLowerCase(),absolute=contained(root,name),stat=fs.lstatSync(absolute);
   ensure(!spellings.has(folded),'duplicate or case-colliding path: '+name);spellings.set(folded,name);
   ensure(!stat.isSymbolicLink(),'symbolic link in inventory: '+name);
   if(stat.isDirectory())walk(absolute,name+'/');else{ensure(stat.isFile(),'non-file entry: '+name);files.set(name,absolute);}
  }
 }
 walk(root);return files;
}
const CRC_TABLE=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=CRC_TABLE[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}

// Read both ZIP indexes and payloads; never trust an extraction tool's file count.
function parseZip(bytes){
 const need=(at,length,end=bytes.length)=>ensure(Number.isSafeInteger(at)&&at>=0&&length>=0&&at+length<=end,'truncated ZIP structure');
 need(0,22);let end=-1;
 for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(bytes.readUInt32LE(at)===0x06054b50&&at+22+bytes.readUInt16LE(at+20)===bytes.length){end=at;break;}
 ensure(end>=0,'ZIP end record is missing or has trailing bytes');
 const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),offset=bytes.readUInt32LE(end+16);
 ensure(bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0&&bytes.readUInt16LE(end+8)===count,'multi-disk ZIP is unsupported');
 ensure(count!==0xffff&&size!==0xffffffff&&offset!==0xffffffff,'ZIP64 is unsupported');
 ensure(offset+size===end,'ZIP directory byte range does not match its end record');
 const entries=new Map(),spellings=new Set(),ranges=[];let at=offset,payloadBytes=0,totalBytes=0,directories=0;
 const decode=(buffer,flags)=>{
  ensure(flags&0x800||buffer.every(n=>n<128),'non-ASCII ZIP names must declare UTF-8');
  return new TextDecoder('utf-8',{fatal:true}).decode(buffer);
 };
 for(let i=0;i<count;i++){
  need(at,46,end);ensure(bytes.readUInt32LE(at)===0x02014b50,'invalid ZIP directory signature');
  const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),crc=bytes.readUInt32LE(at+16),compressed=bytes.readUInt32LE(at+20),length=bytes.readUInt32LE(at+24);
  const names=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),local=bytes.readUInt32LE(at+42);
  ensure(!(flags&1)&&(method===0||method===8),'encrypted ZIP or unsupported compression');
  ensure(bytes.readUInt16LE(at+34)===0&&compressed!==0xffffffff&&length!==0xffffffff&&local!==0xffffffff,'split archive or ZIP64 entry');
  ensure(((bytes.readUInt32LE(at+38)>>>16)&0o170000)!==0o120000,'symbolic link in ZIP');
  need(at+46,names+extra+comment,end);
  const rawName=bytes.subarray(at+46,at+46+names),decoded=decode(rawName,flags),directory=decoded.endsWith('/'),name=safeName(decoded,directory),folded=name.normalize('NFC').toLowerCase();
  ensure(!spellings.has(folded),'duplicate or case-colliding ZIP path: '+name);spellings.add(folded);
  need(local,30,offset);ensure(bytes.readUInt32LE(local)===0x04034b50,'invalid local ZIP signature: '+name);
  const localNames=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28),dataAt=local+30+localNames+localExtra;
  need(local+30,localNames+localExtra,offset);need(dataAt,compressed,offset);
  ensure(bytes.readUInt16LE(local+6)===flags&&bytes.readUInt16LE(local+8)===method,'ZIP local metadata differs: '+name);
  ensure(rawName.equals(bytes.subarray(local+30,local+30+localNames)),'ZIP local name differs: '+name);
  let dataEnd=dataAt+compressed;
  if(flags&8){
   need(dataEnd,12,offset);const signature=bytes.readUInt32LE(dataEnd)===0x08074b50?4:0;need(dataEnd,12+signature,offset);
   ensure(bytes.readUInt32LE(dataEnd+signature)===crc&&bytes.readUInt32LE(dataEnd+signature+4)===compressed&&bytes.readUInt32LE(dataEnd+signature+8)===length,'ZIP descriptor differs: '+name);dataEnd+=12+signature;
  }else ensure(bytes.readUInt32LE(local+14)===crc&&bytes.readUInt32LE(local+18)===compressed&&bytes.readUInt32LE(local+22)===length,'ZIP local sizes or checksum differ: '+name);
  const payload=bytes.subarray(dataAt,dataAt+compressed),body=method===8?zlib.inflateRawSync(payload,{maxOutputLength:Math.max(1,length)}):payload;
  ensure(body.length===length&&crc32(body)===crc,'ZIP payload size or checksum differs: '+name);
  if(directory){ensure(length===0,'nonempty directory entry: '+name);directories++;}else{entries.set(name,{bytes:length,sha256:sha(body)});totalBytes+=length;payloadBytes+=compressed;}
  ranges.push([local,dataEnd]);at+=46+names+extra+comment;
 }
 ensure(at===end,'ZIP directory count or byte size differs');let cursor=0;
 for(const [start,finish] of ranges.sort((a,b)=>a[0]-b[0])){ensure(start===cursor,'ZIP payload ranges overlap or contain unindexed bytes');cursor=finish;}
 ensure(cursor===offset,'ZIP payload byte total differs');return {entries,records:count,directories,uncompressedBytes:totalBytes,compressedPayloadBytes:payloadBytes};
}

function packageRecord(release,requested){
 ensure(release&&/^\d+\.\d+\.\d+(?:[-.][a-z0-9.-]+)?$/i.test(release.version),'invalid release version');
 ensure(Array.isArray(release.packages)&&release.packages.length>0,'release has no packages');
 const record=requested?release.packages.find(item=>item.file===requested):release.packages.length===1?release.packages[0]:null;
 ensure(record,'select exactly one package with --package');safeName(record.file);
 ensure(Number.isSafeInteger(record.bytes)&&record.bytes>=0&&/^[a-f0-9]{64}$/i.test(record.sha256),'invalid ZIP size or SHA-256');
 ensure(Array.isArray(record.entries)&&record.entries.length>0,'package has no entries');const entries=new Map(),spellings=new Set();
 for(const entry of record.entries){
  const name=safeName(entry.path),folded=name.normalize('NFC').toLowerCase();ensure(!spellings.has(folded),'duplicate manifest entry: '+name);spellings.add(folded);
  ensure(Number.isSafeInteger(entry.bytes)&&entry.bytes>=0&&/^[a-f0-9]{64}$/i.test(entry.sha256),'invalid entry size or SHA-256: '+name);entries.set(name,entry);
 }
 return {record,entries};
}
function scanTokens(name,text,authored){
 const hits=[];
 for(const rule of RULES){
  if(rule.scope==='authored'&&!authored)continue;
  for(const [kind,value] of [['filename',name],['text',text]]){
   rule.pattern.lastIndex=0;for(const match of value.matchAll(rule.pattern))hits.push({rule:rule.id,path:name,kind,line:kind==='text'?value.slice(0,match.index).split('\n').length:null,token:match[0].slice(0,160)});
  }
 }
 return hits;
}
function htmlEntities(value){
 const names={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
 return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(all,key)=>{
  if(key[0]!=='#')return names[key.toLowerCase()];const point=parseInt(key.slice(/^#x/i.test(key)?2:1),/^#x/i.test(key)?16:10);
  return point<=0x10ffff?String.fromCodePoint(point):all;
 });
}
function localReference(from,value,pattern=false){
 const ref=htmlEntities(value).trim();if(!ref||ref.startsWith('#')||/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref))return null;
 const clean=ref.split(/[?#]/,1)[0];if(!clean)return null;const decoded=decodeURIComponent(clean);
 ensure(!/[\\:\x00-\x1f\x7f]/.test(decoded),'unsafe local reference in '+from);
 const joined=path.posix.normalize(decoded.startsWith('/')?decoded.slice(1):path.posix.join(path.posix.dirname(from),decoded));return safeName(joined,false,pattern);
}
function htmlReferences(text){
 const refs=[];let base='';
 const withoutBodies=text.replace(/<!--[\s\S]*?-->/g,'').replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi,'$1</script>');
 for(const tag of withoutBodies.matchAll(/<([a-z][\w:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)){
  for(const attr of tag[0].matchAll(/\s(src|href|xlink:href|poster|data|srcset|imagesrcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)){
   const key=attr[1].toLowerCase(),value=attr[2]??attr[3]??attr[4];if(key==='data'&&tag[1].toLowerCase()!=='object')continue;
   if(tag[1].toLowerCase()==='base'&&key==='href'){base=value;continue;}
   if(key.endsWith('srcset')){
    // Data URLs contain commas; keep their entire URL token together.
    let rest=value.trim();while(rest){const data=/^data:/i.test(rest),match=(data?/^\S+/:/^[^,\s]+/).exec(rest);if(!match){rest=rest.slice(1).trimStart();continue;}
     const url=match[0];refs.push(url.replace(/,+$/,''));rest=rest.slice(url.length);if(!url.endsWith(',')){const comma=rest.indexOf(',');rest=comma<0?'':rest.slice(comma+1);}rest=rest.trimStart();}
   }else refs.push(value);
  }
 }
 return {refs,base};
}
function manifestReferences(manifest){
 const refs=[],add=value=>{if(typeof value==='string')refs.push(value);else if(Array.isArray(value))value.forEach(add);else if(value&&typeof value==='object')Object.values(value).forEach(add);};
 add(manifest.icons);for(const key of ['action','browser_action','page_action']){add(manifest[key]?.default_popup);add(manifest[key]?.default_icon);}
 add(manifest.background?.service_worker);add(manifest.background?.scripts);add(manifest.background?.page);
 for(const entry of manifest.content_scripts||[]){add(entry.js);add(entry.css);}
 for(const entry of manifest.web_accessible_resources||[])add(typeof entry==='string'?entry:entry.resources);
 add(manifest.options_page);add(manifest.options_ui?.page);add(manifest.devtools_page);add(manifest.chrome_url_overrides);add(manifest.sandbox?.pages);
 add(manifest.side_panel?.default_path);add(manifest.storage?.managed_schema);add(manifest.theme?.images);
 for(const entry of manifest.declarative_net_request?.rule_resources||[])add(entry.path);
 for(const entry of manifest.nacl_modules||[])add(entry.path);
 for(const entry of manifest.file_browser_handlers||[])add(entry.default_icon);
 if(manifest.default_locale)add('_locales/'+manifest.default_locale+'/messages.json');return refs;
}
function featureReferences(api){
 const refs=new Set(),seen=new Set();
 function visit(value){
  if(typeof value==='string'){if(/\.(?:[cm]?js|css|html?|json|svg|png|jpe?g|webp|gif|woff2?|ttf|mp4|webm|pdf)(?:[?#].*)?$/i.test(value))refs.add(value);return;}
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const item of Object.values(value))visit(item);
 }
 if(!api||typeof api.resolve!=='function'||!Array.isArray(api.catalogue))throw Error('feature catalogue API is missing');
 for(const key of ['catalogue','core','order','staticJS','dashboardCSS','startupCSS','nativeCSS','assets'])visit(api[key]);
 visit(api.resolve());for(const preset of ['full','lite','custom'])visit(api.resolve({preset,custom:[]}));
 for(const feature of api.catalogue)visit(api.resolve({preset:'custom',custom:[feature.id]}));return [...refs].sort();
}

function auditRelease({unpackedDir,manifestPath=path.join(ROOT,'dist/release-manifest.json'),sourceRoot=ROOT,packageName,outputPath}={}){
 ensure(unpackedDir,'an unpacked directory is required');unpackedDir=path.resolve(unpackedDir);manifestPath=path.resolve(manifestPath);sourceRoot=path.resolve(sourceRoot);
 const errors=[],attempt=(label,fn)=>{try{return fn();}catch(error){errors.push(label+': '+error.message);return null;}},check=(value,message)=>{if(!value)errors.push(message);};
 const summary={schemaVersion:1,ok:false,checkedAt:new Date().toISOString(),version:null,inputs:{unpackedDir,manifestPath,sourceRoot},zip:null,
  counts:{manifestEntries:0,unpackedFiles:0,sourceExtensionFiles:0,uncompressedBytes:0,sourceBytes:0,jsAttempted:0,jsChecked:0,textFiles:0,manifestReferences:0,htmlReferences:0,cssReferences:0,featureAssets:0},
  maximumAuthoredLine:{bytes:0,path:null,line:null,limit:LIMIT},forbiddenTokenCount:0,forbiddenMatches:[],vendor:[],errors};
 const release=attempt('release manifest',()=>JSON.parse(fs.readFileSync(manifestPath,'utf8'))),selected=release&&attempt('release schema',()=>packageRecord(release,packageName));
 if(selected){
  summary.version=release.version;const {record,entries}=selected,sourceExtension=path.join(sourceRoot,'extension');summary.counts.manifestEntries=entries.size;
  const unpacked=attempt('unpacked inventory',()=>inventory(unpackedDir)),source=attempt('source inventory',()=>inventory(sourceExtension));
  const archivePath=attempt('ZIP path',()=>fileInside(path.dirname(manifestPath),record.file)),zipBytes=archivePath&&attempt('ZIP read',()=>fs.readFileSync(archivePath));
  let archive=null;
  if(zipBytes){
   const digest=sha(zipBytes);summary.inputs.archive=archivePath;summary.zip={file:record.file,bytes:zipBytes.length,sha256:digest,files:0,records:0,uncompressedBytes:0};
   check(zipBytes.length===record.bytes,'ZIP byte size differs from release manifest');check(digest===record.sha256.toLowerCase(),'ZIP SHA-256 differs from release manifest');
   archive=attempt('ZIP structure',()=>parseZip(zipBytes));
   if(archive){Object.assign(summary.zip,{files:archive.entries.size,records:archive.records,directories:archive.directories,uncompressedBytes:archive.uncompressedBytes,compressedPayloadBytes:archive.compressedPayloadBytes});check(archive.entries.size===entries.size,'ZIP file count differs from release manifest');}
  }
  if(source){summary.counts.sourceExtensionFiles=source.size;for(const name of source.keys())check(entries.has(name),'source extension file omitted from release: '+name);}
  const bodies=new Map(),trusted=new Set();
  if(unpacked){
   summary.counts.unpackedFiles=unpacked.size;check(unpacked.size===entries.size,'unpacked file count differs from release manifest');
   for(const [name,absolute] of unpacked){check(entries.has(name),'unexpected unpacked file: '+name);const body=attempt('read '+name,()=>fs.readFileSync(absolute));if(body){bodies.set(name,body);summary.counts.uncompressedBytes+=body.length;}}
  }
  if(archive)for(const name of archive.entries.keys())check(entries.has(name),'unexpected ZIP file: '+name);
  let expectedBytes=0;
  for(const [name,entry] of entries){
   expectedBytes+=entry.bytes;const body=bodies.get(name),zipEntry=archive?.entries.get(name),expectedHash=entry.sha256.toLowerCase();
   check(!!body,'missing unpacked file: '+name);if(body){check(body.length===entry.bytes,'unpacked byte size differs: '+name);check(sha(body)===expectedHash,'unpacked SHA-256 differs: '+name);}
   if(archive){check(!!zipEntry,'missing ZIP file: '+name);if(zipEntry){check(zipEntry.bytes===entry.bytes,'ZIP entry byte size differs: '+name);check(zipEntry.sha256===expectedHash,'ZIP entry SHA-256 differs: '+name);}}
   const sourcePath=attempt('source path '+name,()=>source?.get(name)||fileInside(sourceRoot,name)),sourceBody=sourcePath&&attempt('source read '+name,()=>fs.readFileSync(sourcePath));
   if(sourceBody){summary.counts.sourceBytes+=sourceBody.length;check(sourceBody.length===entry.bytes,'source byte size differs: '+name);check(sha(sourceBody)===expectedHash,'source SHA-256 differs: '+name);
    if(body&&sourceBody.equals(body)&&sha(body)===expectedHash&&zipEntry?.sha256===expectedHash)trusted.add(name);}
  }
  check(summary.counts.uncompressedBytes===expectedBytes,'unpacked total bytes differ from release manifest');check(summary.counts.sourceBytes===expectedBytes,'source total bytes differ from release manifest');
  if(archive)check(archive.uncompressedBytes===expectedBytes,'ZIP uncompressed total bytes differ from release manifest');
  const texts=new Map();
  for(const [name,body] of bodies){
   const authored=!!source?.has(name)&&!name.startsWith('vendor/');let text='';
   if(TEXT.test(name)||!path.posix.extname(name)&&!body.includes(0)){
    const decoded=attempt('UTF-8 '+name,()=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body));if(decoded!==null){text=decoded;texts.set(name,text);summary.counts.textFiles++;}
    if(authored&&decoded!==null){let line=0;for(const value of text.split('\n')){line++;const bytes=Buffer.byteLength(value.endsWith('\r')?value.slice(0,-1):value);if(bytes>summary.maximumAuthoredLine.bytes)Object.assign(summary.maximumAuthoredLine,{bytes,path:name,line});check(bytes<=LIMIT,'authored line exceeds '+LIMIT+' bytes: '+name+':'+line+' ('+bytes+')');}}
   }
   summary.forbiddenMatches.push(...scanTokens(name,text,authored));
  }
  summary.forbiddenTokenCount=summary.forbiddenMatches.length;check(summary.forbiddenTokenCount===0,'removed content token matches: '+summary.forbiddenTokenCount);
  for(const [name,pinned] of PINS){const body=bodies.get(name),actual=body?sha(body):null;summary.vendor.push({path:name,sha256:actual,expectedSha256:pinned,ok:actual===pinned});check(actual===pinned,'pinned vendor SHA-256 differs: '+name);}
  const requireAsset=(from,ref,kind,glob=false)=>attempt(kind+' reference '+from+' -> '+ref,()=>{
   const name=localReference(from,ref,glob);if(name===null){ensure(kind!=='manifest','manifest resource must be local');return;}
   summary.counts[kind==='manifest'?'manifestReferences':kind==='HTML'?'htmlReferences':kind==='CSS'?'cssReferences':'featureAssets']++;
   if(glob&&/[*?]/.test(name)){const pattern=new RegExp('^'+name.split('*').map(escapeRE).join('.*')+'$');ensure([...entries.keys()].some(item=>pattern.test(item)&&bodies.has(item)),'resource pattern matches no files: '+name);}
   else ensure(entries.has(name)&&bodies.has(name),'local resource is missing: '+name);
  });
  const manifest=texts.has('manifest.json')&&attempt('extension manifest',()=>JSON.parse(texts.get('manifest.json')));
  check(!!manifest,'extension manifest is missing or invalid');
  if(manifest){check(manifest.manifest_version===3,'extension manifest is not Manifest V3');check(manifest.version===release.version,'extension version differs from release manifest');attempt('manifest references',()=>{for(const ref of manifestReferences(manifest))requireAsset('manifest.json',ref,'manifest',true);});}
  for(const [name,text] of texts){
   if(/\.html?$/i.test(name))attempt('HTML references '+name,()=>{
    const {refs,base}=htmlReferences(text);let from=name;
    if(base){ensure(!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(base),'external HTML base is unsupported');const resolved=localReference(name,base);ensure(resolved,'empty HTML base');from=base.split(/[?#]/,1)[0].endsWith('/')?resolved+'/index.html':resolved;}
    for(const ref of refs)requireAsset(from,ref,'HTML');
   });
   if(/\.css$/i.test(name)){
    const css=text.replace(/\/\*[\s\S]*?\*\//g,'');
    for(const match of css.matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi))requireAsset(name,match[1]??match[2]??match[3],'CSS');
    for(const match of css.matchAll(/@import\s+(?:"([^"]+)"|'([^']+)')/gi))requireAsset(name,match[1]??match[2],'CSS');
   }
  }
  check(trusted.has('features.js'),'feature catalogue is missing or not identical to ZIP, manifest and source');
  if(trusted.has('features.js')){
   const refs=attempt('feature catalogue',()=>{
    const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}}),code='var module={exports:{}};\n'+texts.get('features.js')+'\nJSON.stringify(('+featureReferences.toString()+')(module.exports));';
    return JSON.parse(new vm.Script(code,{filename:'features.js'}).runInContext(context,{timeout:2000}));
   });
   if(refs)for(const ref of refs)requireAsset('features.js',ref,'feature');
  }
  if(unpacked)for(const [name,absolute] of unpacked)if(/\.[cm]?js$/i.test(name)){
   summary.counts.jsAttempted++;const result=spawnSync(process.execPath,['--check',absolute],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024,windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
   if(result.error){errors.push('node --check could not run for '+name+': '+result.error.message);break;}
   if(result.status===0)summary.counts.jsChecked++;else errors.push('node --check failed for '+name+': '+(result.stderr||result.stdout||'exit '+result.status).trim().slice(0,4000));
  }
 }
 summary.ok=errors.length===0;const version=summary.version||'3.2.1',destination=path.resolve(outputPath||path.join(path.dirname(manifestPath),'audit-'+version+'.json'));
 const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b,outputRelative=path.relative(unpackedDir,destination);
 ensure(!same(destination,manifestPath),'summary output must not overwrite the release manifest');
 if(summary.inputs.archive)ensure(!same(destination,summary.inputs.archive),'summary output must not overwrite the archive');
 ensure(outputRelative==='..'||outputRelative.startsWith('..'+path.sep)||path.isAbsolute(outputRelative),'summary output must be outside the unpacked directory');
 ensure(path.extname(destination).toLowerCase()==='.json','summary output must be a JSON file');
 fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(summary,null,2)+'\n');return {...summary,outputPath:destination};
}

function main(args=process.argv.slice(2)){
 const positional=[],options={};
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(arg==='--help'||arg==='-h'){console.log('Usage: node scripts/release-audit.cjs <unpacked-directory> [release-manifest.json] [--source checkout] [--package archive-name] [--output summary.json]');return 0;}
  if(arg.startsWith('--')){const key={'--source':'sourceRoot','--package':'packageName','--output':'outputPath'}[arg];ensure(key&&args[i+1]&&!args[i+1].startsWith('--'),'unknown option or missing value: '+arg);options[key]=args[++i];}else positional.push(arg);
 }
 ensure(positional.length>=1&&positional.length<=2,'expected an unpacked directory and optional release manifest; use --help');
 const result=auditRelease({...options,unpackedDir:positional[0],...(positional[1]?{manifestPath:positional[1]}:{})});
 if(result.ok)console.log('Release '+result.version+' audit passed: '+result.counts.unpackedFiles+' files, '+result.counts.jsChecked+' syntax checks, '+result.forbiddenTokenCount+' removed tokens.\nSHA-256 '+result.zip.sha256+'\n'+result.outputPath);
 else{console.error('Release audit failed ('+result.errors.length+' findings). '+result.outputPath);for(const error of result.errors.slice(0,30))console.error('- '+error);if(result.errors.length>30)console.error('See the summary JSON for all findings.');}return result.ok?0:1;
}
if(require.main===module){try{process.exitCode=main();}catch(error){console.error('Release audit failed: '+error.message);process.exitCode=1;}}
module.exports={auditRelease,parseZip,scanTokens,main};
