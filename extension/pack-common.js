/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Portable pack validation. Node checks media containers and metadata; browser import also decodes through ReserveMedia. */
(function(root){
 'use strict';
 const limits=Object.freeze({fileBytes:40000000}),imageTypes=['image/svg+xml','image/png','image/webp','image/jpeg','image/gif','image/avif'],videoTypes=['video/mp4','video/webm'];
 const kits=root.ReserveCustomKits||(typeof module==='object'&&module.exports?require('./custom-kits.js'):null),H=kits?.helpers,encoder=new TextEncoder();
 if(!H)throw Error('Load custom-kits.js before pack-common.js.');
 const bytes=value=>encoder.encode(value),own=(value,key)=>Object.hasOwn(value,key),path=(base,key)=>base+'.'+String(key);
 class ValidationError extends Error{constructor(problems){super(problems.join('\n'));this.name='PackValidationError';this.problems=[...problems];}}
 function context(){
  const problems=[],add=(field,message)=>problems.push(field+': '+message),attempt=(field,fn)=>{
    try{return fn();}catch(error){add(field,error.message);return undefined;}
  };
  const record=(value,allowed,field,required=[])=>{
   if(!H.plain(value)){add(field,'expected a plain object with data properties');return {};}
   const out={};for(const key of Reflect.ownKeys(value)){
    if(typeof key!=='string'||!allowed.includes(key)){add(path(field,key),'unknown field');continue;}
    try{
      const candidate=Object.create(null);
      Object.defineProperty(candidate,key,Object.getOwnPropertyDescriptor(value,key));
      const item=H.record(candidate,[key],field);
      Object.defineProperty(out,key,{value:item[key],enumerable:true,configurable:true,writable:true});
    }catch{add(path(field,key),'expected an enumerable data property, not an accessor');}
   }
   for(const key of required)if(!own(out,key))add(path(field,key),'required field');return out;
  };
  const array=(value,field,min=0,max=64)=>{
   if(!H.plain(value,true)||value.length<min||value.length>max){add(field,'expected an array of '+min+'-'+max+' entries');return [];}
   const out=[];for(const key of Reflect.ownKeys(value))if(key!=='length'&&(typeof key!=='string'||!/^\d+$/.test(key)||Number(key)>=value.length))add(path(field,key),'unknown array field');
   for(let i=0;i<value.length;i++){
     const d=Object.getOwnPropertyDescriptor(value,String(i));
     if(!d||!own(d,'value')||!d.enumerable){add(field+'['+i+']','expected a data property, not a hole or accessor');out.push(undefined);}else out.push(d.value);
   }
   return out;
  };
  const text=(value,field,max=Infinity)=>{
    if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\p{C}\u2028\u2029]/u.test(value)){
      add(field,'expected '+(max===Infinity?'nonempty printable text':'1-'+max+' printable characters'));
      return '';
    }
    return value.trim();
  };
  const choice=(value,allowed,field)=>{if(!allowed.includes(value))add(field,'expected '+allowed.map(x=>JSON.stringify(x)).join(', '));return value;};
  const number=(value,field,min,max,integer=false)=>{
    if(!Number.isFinite(value)||integer&&!Number.isInteger(value)||value<min||value>max)add(field,'expected '+(integer?'an integer':'a number')+' from '+min+' to '+max);
    return value;
  };
  return {problems,used:new Set(),add,attempt,record,array,text,choice,number,finish(){if(problems.length)throw new ValidationError(problems);}};
 }
 function read(source,c){
  let value=source;if(typeof source==='string'){
   if(source.length>limits.fileBytes||bytes(source).length>limits.fileBytes){c.add('$','JSON exceeds 40000000 bytes');return {};}
   try{value=JSON.parse(source);}catch{c.add('$','malformed JSON');return {};}
  }
  const active=new Set();
  function visit(v,field,depth){
   if(depth>16){c.add(field,'document nesting is too deep');return null;}
   if(v===null||typeof v==='boolean'||typeof v==='string')return v;
   if(typeof v==='number'&&Number.isFinite(v))return v;
   if(!H.plain(v)&&!H.plain(v,true)){c.add(field,'expected portable JSON data, without custom prototypes');return null;}
   if(active.has(v)){c.add(field,'cyclic objects are not portable JSON');return null;}active.add(v);
   const arr=Array.isArray(v),out=arr?[]:{};
   if(arr){
     for(let i=0;i<v.length;i++){
       const d=Object.getOwnPropertyDescriptor(v,String(i));
       if(!d||!own(d,'value')||!d.enumerable){c.add(field+'['+i+']','expected an enumerable data property');out.push(null);}else out.push(visit(d.value,field+'['+i+']',depth+1));
     }
   }
   for(const key of Reflect.ownKeys(v)){
    if(arr&&(key==='length'||typeof key==='string'&&/^\d+$/.test(key)&&Number(key)<v.length))continue;
    if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)){c.add(path(field,key),'unsafe or non-JSON field');continue;}
    const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!own(d,'value')||!d.enumerable){c.add(path(field,key),'expected an enumerable data property, not an accessor');continue;}
    if(arr){c.add(path(field,key),'unknown array field');continue;}
    Object.defineProperty(out,key,{value:visit(d.value,path(field,key),depth+1),enumerable:true,writable:true,configurable:true});
   }active.delete(v);return out;
  }
  const clean=visit(value,'$',0);if(bytes(JSON.stringify(clean)).length>limits.fileBytes)c.add('$','JSON exceeds 40000000 bytes');return clean;
 }
 function header(source,format,allowed,required,c){
   const value=read(source,c),input=c.record(value,['format','version','name','by',...allowed],'$',['format','version','name',...required]);
   c.choice(input.format,[format],'$.format');
   c.choice(input.version,[1],'$.version');
   const pack={format,version:1,name:c.text(input.name,'$.name',40)};
   if(own(input,'by')){if(typeof input.by!=='string'||input.by.length>60||/[\p{C}\u2028\u2029]/u.test(input.by))c.add('$.by','expected at most 60 printable characters');else pack.by=input.by.trim();}
   return {input,pack};
 }
 function dependency(global,file){return root[global]||(typeof module==='object'&&module.exports?require('./'+file+'.js'):null);}
 const artwork=()=>dependency('ReserveCustomArt','custom-art'),codec=()=>dependency('ReserveMedia','media-store');
 function assetId(value,field,c){
   if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value)||['__proto__','constructor','prototype'].includes(value)){c.add(field,'expected a local asset ID using letters, digits, - and _');return '';}
   return value;
 }
 function assets(value,c,types=imageTypes.concat(videoTypes,'font/woff2')){
  if(!H.plain(value)){c.add('$.assets','expected a plain asset map');return {};}
  const keys=Object.keys(value),input=c.record(value,keys,'$.assets'),out={};let svgTotal=0,mediaTotal=0;
  for(const key of keys){
   const field='$.assets.'+key;if(!assetId(key,field,c))continue;
   const part=c.record(input[key],['type','data','sha256'],field,['type','data','sha256']);c.choice(part.type,types,field+'.type');
   if(typeof part.sha256!=='string'||!/^[a-f0-9]{64}$/.test(part.sha256))c.add(field+'.sha256','expected a lowercase SHA-256 hex digest');
   const size=c.attempt(field+'.data',()=>H.base64Size(part.data));
   if(size!==undefined){
     if(part.type==='image/svg+xml'){if(size>artwork().limits.fileBytes)c.add(field+'.data','SVG exceeds '+artwork().limits.fileBytes+' bytes');svgTotal+=size;}
     else if(part.type==='font/woff2'){if(size>2000000)c.add(field+'.data','font exceeds 2000000 bytes');}
     else{if(size>codec().limits.inputBytes)c.add(field+'.data','media exceeds '+codec().limits.inputBytes+' bytes');mediaTotal+=size;}
   }
   out[key]={type:part.type,data:part.data,sha256:part.sha256};
  }
  if(svgTotal>artwork().limits.totalBytes)c.add('$.assets','total SVG artwork exceeds '+artwork().limits.totalBytes+' bytes');
  if(mediaTotal>codec().limits.totalBytes)c.add('$.assets','total media exceeds '+codec().limits.totalBytes+' bytes');
  return out;
 }
 function reference(id,map,types,field,c){
   const key=assetId(id,field,c);
   if(key)c.used.add(key);
   if(key&&!own(map,key))c.add(field,'missing asset '+key);else if(key&&!types.includes(map[key].type))c.add(field,'unsupported asset type '+map[key].type);
   return key;
 }
 function extractSVG(markup){
   const match=/\bsrc="data:image\/svg\+xml;charset=utf-8,([^"]*)"/.exec(markup);
   if(!match)throw Error('Artwork renderer did not supply an isolated SVG');
   return decodeURIComponent(match[1]);
 }
 function animatedSVG(svg){
  if(/<(?:animate|animateTransform|animateMotion|set)(?:\s|\/?>)/.test(svg))return true;
  const css=[...svg.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map(m=>m[1]).concat([...svg.matchAll(/\sstyle="([^"]*)"/g)].map(m=>m[1]));
  for(const source of css){
   if(/@(?:-webkit-)?keyframes\b/i.test(source))return true;
   for(const m of source.matchAll(/(?:^|[;{])\s*((?:-webkit-)?(?:animation(?:-name)?|transition(?:-property)?))\s*:\s*([^;{}]*)/gi)){
    const key=m[1].replace(/^-webkit-/,''),value=m[2].replace(/\s*!important\s*$/i,'').trim().toLowerCase();
    for(const group of value.split(/,(?![^()]*\))/)){
     if(/^(?:none|initial|unset|revert|revert-layer)\s*$/.test(group.trim()))continue;
     if(key==='animation-name'||key==='transition-property')return true;
     const words=group.replace(/(?:cubic-bezier|steps|linear)\([^)]*\)/g,' ').split(/\s+/).filter(Boolean),keywords=/^(?:none|initial|unset|revert|revert-layer|ease|linear|ease-in|ease-out|ease-in-out|step-start|step-end|infinite|normal|reverse|alternate|alternate-reverse|forwards|backwards|both|running|paused|allow-discrete|normal)$/;
     if(words.some(word=>!keywords.test(word)&&!/^[-+]?(?:\d*\.)?\d+(?:ms|s)?$/.test(word)))return true;
    }
   }
  }return false;
 }
 function svgInfo(data,name){
   let text;
   try{text=new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{throw Error('SVG must use valid UTF-8');}
   const art=artwork(),
     clean=art.importSVG(text,name),
     still=extractSVG(art.render(clean,{motion:false,fit:'contain'})),
     box=/\bviewBox="([^"]+)"/.exec(clean.svg)?.[1].trim().split(/[\s,]+/).map(Number),
     width=box?.[2]||Number(/\bwidth="([\d.]+)"/.exec(clean.svg)?.[1])||300,
     height=box?.[3]||Number(/\bheight="([\d.]+)"/.exec(clean.svg)?.[1])||150;
   return {svg:clean.svg,still,width,height,animated:animatedSVG(clean.svg)};
 }
 const ascii=(b,at,n)=>String.fromCharCode(...b.subarray(at,at+n));
 function inspectMedia(b,type,options={}){return codec().inspectPortable(b,type,options);}
 function dataURL(b,type){let text='';for(let at=0;at<b.length;at+=8192)text+=String.fromCharCode(...b.subarray(at,at+8192));return 'data:'+type+';base64,'+btoa(text);}
 function rasterStill(b,info){
  const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
  if(info.type==='image/gif'){
   let at=13+(b[10]&128?3*(1<<((b[10]&7)+1)):0),control;const head=b.subarray(0,at),blocks=()=>{for(let n=b[at++];n;n=b[at++])at+=n;};
   while(at<b.length){
     const start=at,tag=b[at++];
     if(tag===33){const label=b[at++];blocks();if(label===249)control=b.subarray(start,at);}
     else if(tag===44){
       const local=b[at+8];
       at+=9+(local&128?3*(1<<((local&7)+1)):0);
       at++;
       blocks();
       return dataURL(join([head,...(control?[control]:[]),b.subarray(start,at),new Uint8Array([59])]),info.type);
     }
     else break;
   }
  }else if(info.type==='image/png'){
   const v=new DataView(b.buffer,b.byteOffset,b.byteLength),shared=[],pixels=[];let header,first,seenPixels=false,excluded=false;
   const chunk=(tag,data)=>{
     const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);
     view.setUint32(0,data.length);
     out.set(bytes(tag),4);
     out.set(data,8);
     let crc=-1;
     for(const value of out.subarray(4,-4)){crc^=value;for(let i=0;i<8;i++)crc=crc>>>1^(-(crc&1)&0xedb88320);}
     view.setUint32(out.length-4,(crc^-1)>>>0);
     return out;
   };
   for(let at=8;at<b.length;){const n=v.getUint32(at),tag=ascii(b,at+4,4),p=at+8,end=p+n+4;
    if(tag==='IHDR')header=b.slice(p,p+n);
    else if(tag==='fcTL'){
      if(first)break;
      if(n!==26)throw Error('Invalid APNG first frame control');
      first={width:v.getUint32(p+4),height:v.getUint32(p+8),x:v.getUint32(p+12),y:v.getUint32(p+16)};
      excluded=seenPixels;
      if(!first.width||
        !first.height||
        first.x+first.width>info.width||
        first.y+first.height>info.height||
        !excluded&&(first.x||first.y||first.width!==info.width||first.height!==info.height))
        throw Error('APNG first frame exceeds its drawing box');
    }
    else if(tag==='IDAT'){seenPixels=true;if(first&&!excluded)pixels.push(b.subarray(at,end));}
    else if(tag==='fdAT'){if(!first||!excluded||n<4)throw Error('Invalid APNG first frame pixels');if(n>4)pixels.push(chunk('IDAT',b.subarray(p+4,p+n)));}
    else if(!seenPixels&&!['acTL','IEND'].includes(tag))shared.push(b.subarray(at,end));at=end;
   }
   if(!first||!pixels.length)throw Error('APNG has no complete first animation frame');
   const h=new DataView(header.buffer,header.byteOffset,header.byteLength);
   h.setUint32(0,first.width);
   h.setUint32(4,first.height);
   const url=dataURL(join([b.subarray(0,8),chunk('IHDR',header),...shared,...pixels,chunk('IEND',new Uint8Array())]),info.type);
   if(!first.x&&!first.y&&first.width===info.width&&first.height===info.height)return url;
   return 'data:image/svg+xml;charset=utf-8,'+
     encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+
       info.width+
       '" height="'+
       info.height+
       '" viewBox="0 0 '+
       info.width+
       ' '+
       info.height+
       '"><image x="'+
       first.x+
       '" y="'+
       first.y+
       '" width="'+
       first.width+
       '" height="'+
       first.height+
       '" href="'+
       url+
       '"/></svg>');
  }else if(info.type==='image/webp'){
   const v=new DataView(b.buffer,b.byteOffset,b.byteLength),u24=at=>b[at]+b[at+1]*256+b[at+2]*65536;let background='none';
   for(let at=12;at<b.length;){const tag=ascii(b,at,4),n=v.getUint32(at+4,true),p=at+8;if(tag==='ANIM')background='rgba('+b[p+2]+','+b[p+1]+','+b[p]+','+(b[p+3]/255)+')';if(tag==='ANMF'){
     const x=u24(p)*2,y=u24(p+3)*2,width=u24(p+6)+1,height=u24(p+9)+1,replace=!!(b[p+15]&2);if(x+width>info.width||y+height>info.height)throw Error('WebP first frame exceeds its drawing box');
     const chunks=[];
     let alpha=false;
     for(let q=p+16;q<p+n;){
       if(q+8>p+n)throw Error('Truncated WebP first frame');
       const name=ascii(b,q,4),length=v.getUint32(q+4,true),end=q+8+length+(length%2);
       if(end>p+n||!['ALPH','VP8 ','VP8L'].includes(name))throw Error('Invalid WebP first frame chunk');
       if(name==='ALPH'||name==='VP8L'&&!!(b[q+12]&16))alpha=true;
       chunks.push(b.subarray(q,end));
       q=end;
     }
     const header=new Uint8Array(30),h=new DataView(header.buffer),length=chunks.reduce((n,c)=>n+c.length,0);
     header.set(bytes('RIFF'),0);
     header.set(bytes('WEBPVP8X'),8);
     h.setUint32(4,4+length,true);
     const meta=inspectMedia(join([header.subarray(0,12),...chunks]),info.type);
     if(meta.width!==width||meta.height!==height)throw Error('Invalid WebP first frame dimensions');
     h.setUint32(16,10,true);
     header[20]=alpha?16:0;
     for(let i=0;i<3;i++){header[24+i]=((width-1)>>>8*i)&255;header[27+i]=((height-1)>>>8*i)&255;}
     h.setUint32(4,22+length,true);
     const frame=join([header,...chunks]),url=dataURL(frame,info.type);
     if(!x&&!y&&width===info.width&&height===info.height&&(replace||!alpha||background==='none'||background.endsWith(',0)')))return url;
     const back=replace?
       '<path d="M0 0H'+info.width+'V'+info.height+'H0zM'+x+' '+y+'h'+width+'v'+height+'h-'+width+'z" fill="'+background+'" fill-rule="evenodd"/>':
       '<rect width="100%" height="100%" fill="'+background+'"/>';
     return 'data:image/svg+xml;charset=utf-8,'+
       encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+
         info.width+
         '" height="'+
         info.height+
         '" viewBox="0 0 '+
         info.width+
         ' '+
         info.height+
         '">'+
         back+
         '<image x="'+
         x+
         '" y="'+
         y+
         '" width="'+
         width+
         '" height="'+
         height+
         '" href="'+
         url+
         '"/></svg>');
    }at=p+n+(n%2);}
  }throw Error('Animated raster has no complete first frame');
 }
 async function inspectFont(b){
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength),bad=message=>{
    throw Error('Invalid WOFF2 '+message);
  },need=(at,n)=>{if(at<0||n<0||at+n>b.length)bad('truncated container');},u16=at=>{need(at,2);return v.getUint16(at);},u32=at=>{need(at,4);return v.getUint32(at);};
  if(b.length<48||ascii(b,0,4)!=='wOF2'||u32(8)!==b.length||!u16(12)||u16(14)!==0||!u32(20))bad('header, length or compressed size');
  const tags=['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB','EBSC','JSTF','MATH','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gvar','hsty','just','lcar','mort','morx','opbd','prop','trak','Zapf','Silf','Glat','Gloc','Feat','Sill'];
  let at=48,originalSize=0,streamSize=0;const entries=[],seen=new Set(),collection=u32(4)===0x74746366;
  const byte=()=>{
    need(at,1);
    return b[at++];
  },base128=()=>{
    let n=0;
    for(let i=0;i<5;i++){const value=byte();if(!i&&value===128)bad('noncanonical UIntBase128');n=n*128+(value&127);if(n>4294967295)bad('UIntBase128 overflow');if(!(value&128))return n;}
    bad('unterminated UIntBase128');
  },short255=()=>{const code=byte();if(code===253){const n=u16(at);at+=2;return n;}return code===254?byte()+506:code===255?byte()+253:code;};
  for(let i=0;i<u16(12);i++){
   const flags=byte(),index=flags&63,version=flags>>>6;
   let tag=tags[index];
   if(index===63){need(at,4);tag=ascii(b,at,4);at+=4;if(!/^[\x20-\x7e]{4}$/.test(tag))bad('table tag');}
   if(seen.has(tag)&&!collection)bad('duplicate table '+tag);
   seen.add(tag);
   const original=base128(),glyf=tag==='glyf'||tag==='loca';
   if(glyf?![0,3].includes(version):version!==0&&!(tag==='hmtx'&&version===1))bad('unsupported table transformation for '+tag);
   const transformed=glyf?version===0:version!==0,length=transformed?base128():original;
   if(tag==='loca'&&transformed&&length!==0)bad('transformed loca length must be zero');
   originalSize+=Math.ceil(original/4)*4;streamSize+=length;if(originalSize>4294967295||streamSize>4294967295)bad('declared table sizes overflow');entries.push({tag,original,length,transformed});
  }
  function pair(list){
    const glyf=list.find(v=>v.tag==='glyf'),loca=list.find(v=>v.tag==='loca');
    if(!!glyf!==!!loca||glyf&&glyf.transformed!==loca.transformed)bad('glyf and loca tables must use matching transformations');
  }
  if(!collection)pair(entries);
  let minimum=12+16*entries.length+originalSize;
  if(collection){
   const version=u32(at);
   at+=4;
   if(![0x10000,0x20000].includes(version))bad('collection version');
   const count=short255();
   if(!count)bad('empty collection');
   minimum=12+4*count+(version===0x20000?12:0)+originalSize;
   const used=new Set();
   for(let i=0;i<count;i++){
     const n=short255();
     if(!n||n>entries.length)bad('collection table count');
     need(at,4);
     at+=4;
     minimum+=12+16*n;
     const font=new Set(),names=new Set();
     for(let j=0;j<n;j++){
       const index=short255();
       if(index>=entries.length||font.has(index)||names.has(entries[index].tag))bad('collection table index');
       font.add(index);
       names.add(entries[index].tag);
       used.add(index);
     }
     pair([...font].map(index=>entries[index]));
   }
   if(used.size!==entries.length||u32(16)<minimum)bad('collection reconstructed size');
  }else if(u32(16)!==minimum)bad('reconstructed SFNT size does not match the table directory');
  const compressedStart=at,compressedEnd=at+u32(20);
  need(compressedStart,u32(20));
  if(!streamSize)bad('empty table stream');
  let end=compressedEnd;
  const metaOffset=u32(28),metaLength=u32(32),metaOriginal=u32(36),privateOffset=u32(40),privateLength=u32(44);
  function padding(start,last){if(last<start||last-start>3)bad('unexpected gap or trailing bytes');for(let i=start;i<last;i++)if(b[i]!==0)bad('nonzero block padding');}
  function block(offset,length,label){if(offset%4||!length)bad(label+' offset or length');need(offset,length);padding(end,offset);end=offset+length;}
  if(metaOffset){if(!metaOriginal)bad('metadata original length');block(metaOffset,metaLength,'metadata');}else if(metaLength||metaOriginal)bad('metadata fields without a metadata block');
  if(privateOffset)block(privateOffset,privateLength,'private block');else if(privateLength)bad('private length without a private block');padding(end,b.length);
  if(typeof module==='object'&&module.exports){
   const verify=(start,length,expected,label)=>new Promise((resolve,reject)=>{
    const decoder=require('node:zlib').createBrotliDecompress();
    let total=0;
    decoder.on('data',chunk=>{total+=chunk.length;if(total>expected)decoder.destroy(Error('decompressed bytes exceed the declared length'));});
    decoder.on('error',error=>reject(Error('Invalid WOFF2 '+label+' Brotli stream: '+error.message)));
    decoder.on('end',()=>{if(total!==expected||decoder.bytesWritten!==length)reject(Error('Invalid WOFF2 '+label+' compressed or decompressed length'));else resolve();});
    decoder.end(b.subarray(start,start+length));
   });await verify(compressedStart,u32(20),streamSize,'table');if(metaOffset)await verify(metaOffset,metaLength,metaOriginal,'metadata');
  }
  return {tables:entries.length,compressedStart,compressedLength:u32(20),streamSize,metadata:!!metaOffset,private:!!privateOffset};
 }
 async function processAssets(pack,c,deps={}){
  const support=c.record(deps,['media'],'deps'),decoded=[],infos={},media=[];
  if(['chtheme','chpet'].includes(pack.format))for(const key of Object.keys(pack.assets||{}))if(!c.used.has(key))c.add('$.assets.'+key,'assets.'+key+' is not used');
  for(const [key,asset]of Object.entries(pack.assets||{})){
    const field='$.assets.'+key;
    if(typeof asset.data!=='string'||typeof asset.sha256!=='string'||!/^[a-f0-9]{64}$/.test(asset.sha256)||c.problems.some(problem=>problem.startsWith(field+'.data:')))continue;
    const original=H.decode64(asset.data);
    if(await H.sha256(original)!==asset.sha256)c.add(field+'.sha256','SHA-256 hash mismatch');
    decoded.push({key,asset,original});
  }
  c.finish();
  let total=0;
  for(const {key,asset,original}of decoded){const field='$.assets.'+key;try{
   if(asset.type==='image/svg+xml'){
     const info=svgInfo(original,key+'.svg');
     asset.svg=info.svg;
     asset.still=info.still;
     asset.width=info.width;
     asset.height=info.height;
     asset.animated=info.animated;
     infos[key]=info;
     total+=bytes(info.svg).length;
     if(total>artwork().limits.totalBytes)throw Error('Normalized SVG artwork exceeds the aggregate budget');
   }
   else if(asset.type==='font/woff2'){await inspectFont(original);infos[key]={animated:false};}
   else{
     const frame=pack.format==='chtheme'?[pack.banner,pack.background].find(value=>value?.asset===key):null,
       options=frame?{...(frame.loop?{loop:frame.loop}:{}),...(typeof frame.still==='number'?{still:frame.still}:{})}:{},
       info=inspectMedia(original,asset.type,options);
     infos[key]=info;
     asset.width=info.width;
     asset.height=info.height;
     asset.animated=info.animated;
     if(info.duration!==undefined)asset.duration=info.duration;
     if(pack.format==='chpet'){
       if(info.width>4*pack.size[0]||info.height>4*pack.size[1])throw Error('Raster dimensions must be at most 4x size');
       if(info.animated)asset.firstFrame=rasterStill(original,info);
     }
     const blob=new Blob([original],{type:asset.type}),selected=support.media||codec();
    if(support.media||root.document&&typeof root.createImageBitmap==='function'){
      if(typeof selected.prepare!=='function')throw Error('Media codec must expose prepare');
      const prepared=await selected.prepare(blob,'banner',key.trim().slice(0,160),options);
      if(!prepared||!(prepared.blob instanceof Blob))throw Error('Media codec returned no prepared blob');
      const ref=codec().cleanReference(prepared.asset,'banner'),max=ref.kind==='video'?codec().limits.videoBytes:codec().limits.imageBytes;
      if(prepared.blob.type!==ref.type||
        !prepared.blob.size||
        prepared.blob.size>max||
        prepared.poster&&
          (ref.kind!=='video'&&!ref.animated||
            !(prepared.poster instanceof Blob)||
            !['image/png','image/webp'].includes(prepared.poster.type)||
            !prepared.poster.size||
            prepared.poster.size>codec().limits.imageBytes))
        throw Error('Media codec returned invalid prepared bytes');
      media.push(prepared);
    }
    else{
      const crypto=root.crypto||(typeof module==='object'&&module.exports?require('node:crypto').webcrypto:null),{animated:unused,...metadata}=info;
      media.push({asset:{mediaId:crypto.randomUUID(),name:key,...metadata,palette:[]},blob,validation:'container'});
    }
   }
  }catch(error){c.add(field,error.message);}}
  return {media,infos};
 }
 function portable(pack){
   const out={...pack};
   if(pack.assets){
     out.assets={};
     for(const [key,asset]of Object.entries(pack.assets)){const {svg,still,animated,firstFrame,width,height,duration,...wire}=asset;out.assets[key]=wire;}
   }
   return JSON.parse(JSON.stringify(out));
 }
 async function importPack(file,format,validate,deps={}){
  if(!file||typeof file!=='object'||typeof file.text!=='function'||!Number.isSafeInteger(file.size)||file.size<1||file.size>limits.fileBytes)
    throw new ValidationError(['$: provide a nonempty local .'+format+' file of at most 40000000 bytes']);
  if(file.name!==undefined&&(typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.'+format)))throw new ValidationError(['$.name: file extension must be .'+format]);
  let source;
  try{
    source=typeof file.arrayBuffer==='function'?new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()):await file.text();
  }catch{throw new ValidationError(['$: file must use valid UTF-8']);}
  return validate(source,deps);
 }
 async function problems(validate,source,deps={}){try{await validate(source,deps);return [];}catch(error){return error.problems||[error.message];}}
 const api=Object.freeze({
   limits,
   imageTypes,
   videoTypes,
   ValidationError,
   context,
   header,
   dependency,
   assets,
   reference,
   assetId,
   processAssets,
   portable,
   importPack,
   problems,
   inspectMedia,
   inspectFont,
   animatedSVG,
   own,
   bytes
 });
 root.ReservePackCommon=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
