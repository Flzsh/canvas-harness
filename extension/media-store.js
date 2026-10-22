/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Canvas Harness local media. Bytes stay in this browser; saved preferences contain random references only. */
(function(root){
 'use strict';
 const refs=root.ReserveMediaReference||(typeof module==='object'&&module.exports?require('./media-reference.js'):null);
 if(!refs)throw Error('Load media-reference.js before media-store.js.');
 const {limits,cleanReference,referenced,cleanPackDocument,validateVideo,videoTiming}=refs;
 const slots=Object.freeze({banner:Object.freeze({width:2400,height:1600}),card:Object.freeze({width:1200,height:1200}),background:Object.freeze({width:3840,height:2400}),title:Object.freeze({width:1440,height:800})});
 const images=['image/png','image/jpeg','image/webp','image/gif','image/avif'],videos=['video/mp4','video/webm'],uuid=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,color=/^#[\da-f]{6}$/i;
 const E=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fail=message=>{throw Error(message);},record=v=>v&&typeof v==='object'&&!Array.isArray(v);
 function nameOf(value){if(typeof value!=='string'||!value.trim()||value.length>160||/[\x00-\x1f\x7f]/.test(value))fail('Choose a valid file name.');return value.trim();}
 function dimensions(width,height,maxWidth){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>maxWidth||height>16000||width*height>48000000)fail('Media dimensions are too large.');}
 function videoSource({size,width,height,duration},input=false){if(!Number.isSafeInteger(size)||size<=0||size>limits.videoBytes)fail(input?'This video is too large to shrink here. Try one under 30 MB.':'Video must be at most 30 MB.');if(input){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>16000||height>16000||width*height>48000000)fail('This video is too large to shrink here. Try one under 1920 pixels wide.');}else dimensions(width,height,limits.videoWidth);if(!Number.isFinite(duration)||duration<=0||duration>limits.sourceDuration)fail(input?'This video is too long to shrink here. Try one no longer than 3600 s.':'Video must be at most 3600 s.');}
 const ascii=(b,at,n)=>String.fromCharCode(...b.subarray(at,at+n));
 function inspectPortable(b,type,options={}){
  if(!ArrayBuffer.isView(b)||b.BYTES_PER_ELEMENT!==1||!b.byteLength||b.byteLength>limits.inputBytes)fail('Media exceeds the input byte limit.');
  const view=new DataView(b.buffer,b.byteOffset,b.byteLength),need=(at,n)=>{if(at<0||n<0||at+n>b.length)throw Error('Truncated '+type+' container');},u16=(at,le=false)=>{need(at,2);return view.getUint16(at,le);},u32=(at,le=false)=>{need(at,4);return view.getUint32(at,le);};let width=0,height=0,duration,animated=false;
  if(type==='image/png'){
   if(ascii(b,0,8)!=='\x89PNG\r\n\x1a\n')throw Error('Invalid PNG signature');let at=8,first=true,pixels=false,end=false;
   while(at<b.length){need(at,12);const n=u32(at),tag=ascii(b,at+4,4);need(at+8,n+4);if(first){if(tag!=='IHDR'||n!==13)throw Error('PNG needs an IHDR');width=u32(at+8);height=u32(at+12);first=false;}else if(tag==='IHDR')throw Error('Duplicate PNG header');if(tag==='IDAT')pixels=true;if(tag==='acTL')animated=true;at+=n+12;if(tag==='IEND'){if(n||at!==b.length)throw Error('Invalid PNG end');end=true;break;}}
   if(!pixels||!end)throw Error('PNG needs image data and IEND');
  }else if(type==='image/jpeg'){
   if(b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)throw Error('Invalid JPEG signature or end');let at=2,scan=false;
   while(at<b.length-2){if(b[at++]!==255)throw Error('Invalid JPEG marker');while(b[at]===255)at++;const tag=b[at++];if(tag===218){scan=true;break;}if(tag===1||tag>=208&&tag<=215)continue;const n=u16(at);if(n<2)throw Error('Invalid JPEG segment');need(at,n);if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(tag)){if(n<8)throw Error('Invalid JPEG dimensions');height=u16(at+3);width=u16(at+5);dimensions(width,height,100000);}at+=n;}if(!scan)throw Error('JPEG needs an image scan');
  }else if(type==='image/gif'){
   if(!['GIF87a','GIF89a'].includes(ascii(b,0,6)))throw Error('Invalid GIF signature');need(0,13);width=u16(6,true);height=u16(8,true);let at=13+(b[10]&128?3*(1<<((b[10]&7)+1)):0),frames=0,end=false;
   const blocks=()=>{for(;;){need(at,1);const n=b[at++];if(!n)break;need(at,n);at+=n;}};
   while(at<b.length){const tag=b[at++];if(tag===59){end=at===b.length;break;}if(tag===33){need(at++,1);blocks();}else if(tag===44){need(at,9);const local=b[at+8],w=u16(at+4,true),h=u16(at+6,true);if(!w||!h||u16(at,true)+w>width||u16(at+2,true)+h>height)throw Error('Invalid GIF image');at+=9+(local&128?3*(1<<((local&7)+1)):0);need(at++,1);blocks();if(++frames>limits.animationFrames||frames>1&&frames*width*height>limits.animationPixels)fail('Animated picture has too many frames or pixels.');}else throw Error('Invalid GIF block');}if(!end||!frames)throw Error('GIF needs a complete image and trailer');animated=frames>1;
  }else if(type==='image/webp'){
   if(ascii(b,0,4)!=='RIFF'||ascii(b,8,4)!=='WEBP'||u32(4,true)+8!==b.length)throw Error('Invalid WebP container');let at=12,pixels=false,frames=0;
   while(at<b.length){need(at,8);const tag=ascii(b,at,4),n=u32(at+4,true),p=at+8;need(p,n);if(tag==='VP8X'){if(n!==10)throw Error('Invalid WebP extended header');animated=!!(b[p]&2);width=1+b[p+4]+b[p+5]*256+b[p+6]*65536;height=1+b[p+7]+b[p+8]*256+b[p+9]*65536;}if(tag==='VP8 '){if(n<10||ascii(b,p+3,3)!=='\x9d\x01\x2a')throw Error('Invalid WebP VP8 frame');const w=u16(p+6,true)&16383,h=u16(p+8,true)&16383;dimensions(w,h,100000);if(!width){width=w;height=h;}pixels=true;}if(tag==='VP8L'){if(n<5||b[p]!==47)throw Error('Invalid WebP lossless frame');const bits=u32(p+1,true),w=(bits&16383)+1,h=((bits>>>14)&16383)+1;dimensions(w,h,100000);if(!width){width=w;height=h;}pixels=true;}if(tag==='ANMF'){if(n<24||!width||!height)throw Error('Invalid animated WebP frame');const u24=at=>b[at]+b[at+1]*256+b[at+2]*65536;if(u24(p)*2+u24(p+6)+1>width||u24(p+3)*2+u24(p+9)+1>height)throw Error('WebP frame exceeds its picture');if(++frames>limits.animationFrames||frames*width*height>limits.animationPixels)fail('Animated picture has too many frames or pixels.');pixels=true;animated=true;}at=p+n+(n%2);}if(at!==b.length||!pixels||animated&&!frames)throw Error('WebP needs complete image data');
  }else if(type==='image/avif'){
   let boxes=0,brand=false,meta=false,payload=false,primary,properties=[],associations=new Map(),found=[];
   function walk(start,end,depth=0,inProperties=false){if(depth>8)throw Error('AVIF nesting is too deep');let at=start,index=0;while(at<end){if(++boxes>50000)throw Error('Too many AVIF boxes');if(at+8>end)throw Error('Truncated AVIF box');let n=u32(at),head=8;const tag=ascii(b,at+4,4);if(n===1){if(at+16>end)throw Error('Truncated AVIF box');n=u32(at+8)*4294967296+u32(at+12);head=16;}else if(!n)n=end-at;if(!Number.isSafeInteger(n)||n<head||at+n>end)throw Error('Invalid AVIF box length');const p=at+head,last=at+n,local=(q,n)=>{if(q<p||q+n>last)throw Error('Truncated AVIF '+tag);};index++;
    if(tag==='ftyp'){local(p,8);if(depth||at||brand||(last-p)%4)throw Error('Invalid AVIF brands');const brands=[ascii(b,p,4)];for(let q=p+8;q<last;q+=4)brands.push(ascii(b,q,4));if(!brands.includes('avif')||brands.includes('avis'))throw Error('Choose a still AVIF photo');brand=true;}
    else if(tag==='meta'){local(p,4);if(depth||meta||u32(p)!==0)throw Error('Invalid AVIF metadata');meta=true;walk(p+4,last,depth+1);}
    else if(tag==='iprp')walk(p,last,depth+1);
    else if(tag==='ipco'){if(properties.length)throw Error('Duplicate AVIF properties');walk(p,last,depth+1,true);}
    else if(tag==='ispe'&&inProperties){local(p,12);if(last-p!==12||u32(p)!==0)throw Error('Invalid AVIF dimensions');const size={width:u32(p+4),height:u32(p+8)};dimensions(size.width,size.height,100000);properties[index]=size;found.push(size);}
    else if(tag==='pitm'){local(p,6);const version=b[p];if(version>1)throw Error('Invalid AVIF primary image');local(p,version?8:6);if(primary!==undefined)throw Error('Duplicate AVIF primary image');primary=version?u32(p+4):u16(p+4);}
    else if(tag==='ipma'){local(p,8);const version=b[p],flags=u32(p)&16777215,count=u32(p+4);if(version>1||flags>1||count>50000)throw Error('Invalid AVIF image properties');let q=p+8;for(let i=0;i<count;i++){local(q,version?5:3);const id=version?u32(q):u16(q);q+=version?4:2;const count=b[q++],list=[];for(let j=0;j<count;j++){local(q,flags?2:1);list.push(flags?u16(q)&32767:b[q]&127);q+=flags?2:1;}if(associations.has(id))throw Error('Duplicate AVIF image properties');associations.set(id,list);}if(q!==last)throw Error('Invalid AVIF image properties');}
    else if((tag==='mdat'&&!depth||tag==='idat'&&depth===1)&&last>p)payload=true;at=last;
   }}
   walk(0,b.length);if(!brand||!meta||!payload||!found.length)throw Error('AVIF needs image dimensions and local image data');const selected=associations.get(primary)?.map(i=>properties[i]).find(Boolean);if(primary!==undefined&&!selected)throw Error('AVIF primary image needs dimensions');const size=selected||found.reduce((a,v)=>v.width*v.height>a.width*a.height?v:a);width=size.width;height=size.height;
  }else if(type==='video/mp4'){
   if(ascii(b,4,4)!=='ftyp'||u32(0)<16)throw Error('Invalid MP4 signature');let boxes=0,video=false,payload=false;
   function walk(start,end,depth=0){if(depth>8)throw Error('MP4 nesting is too deep');let at=start;while(at<end){if(++boxes>50000)throw Error('Too many MP4 boxes');need(at,8);let n=u32(at),head=8;const tag=ascii(b,at+4,4);if(n===1){need(at,16);n=u32(at+8)*4294967296+u32(at+12);head=16;}else if(n===0)n=end-at;if(!Number.isSafeInteger(n)||n<head||at+n>end)throw Error('Invalid MP4 box length');const p=at+head,last=at+n;if(['moov','trak','mdia','minf','stbl','dinf'].includes(tag))walk(p,last,depth+1);if(tag==='mdat'&&n>head)payload=true;if(tag==='hdlr'){need(p,12);if(ascii(b,p+8,4)==='vide')video=true;}if(tag==='tkhd'){if(n<head+84)throw Error('Invalid MP4 track header');width=Math.max(width,u32(last-8)/65536);height=Math.max(height,u32(last-4)/65536);}if(tag==='mvhd'){need(p,20);const v=b[p],scale=u32(p+(v===1?20:12)),d=v===1?u32(p+24)*4294967296+u32(p+28):u32(p+16);if(![0,1].includes(v)||!scale)throw Error('Invalid MP4 timing');duration=d/scale;}if(tag==='dref'){need(p,8);let q=p+8;for(let i=0;i<u32(p+4);i++){need(q,12);const size=u32(q);if(size<12||q+size>last||ascii(b,q+4,4)!=='url '||(u32(q+8)&1)!==1)throw Error('External MP4 data references are forbidden');q+=size;}if(q!==last)throw Error('Invalid MP4 data references');}at=last;}}
   walk(0,b.length);if(!video||!payload)throw Error('MP4 needs a video track and local media data');animated=true;
  }else if(type==='video/webm'){
   let elements=0,scale=1000000,ticks,docType='',video=false,payload=false;
   const vint=(at,id=false)=>{need(at,1);let mask=128,n=1;while(n<=8&&!(b[at]&mask)){mask>>=1;n++;}if(n>(id?4:8))throw Error('Invalid WebM variable integer');need(at,n);let value=id?b[at]:b[at]&(mask-1),unknown=!id&&value===mask-1;for(let i=1;i<n;i++){value=value*256+b[at+i];unknown=unknown&&b[at+i]===255;}return {n,value,unknown};};
   const integer=(at,n)=>{if(n<1||n>8)throw Error('Invalid WebM integer');let value=0;for(let i=0;i<n;i++)value=value*256+b[at+i];return value;};
   function walk(start,end,depth=0){if(depth>8)throw Error('WebM nesting is too deep');let at=start;while(at<end){if(++elements>50000)throw Error('Too many WebM elements');const id=vint(at,true),size=vint(at+id.n),p=at+id.n+size.n,last=size.unknown?end:p+size.value;if(!Number.isSafeInteger(last)||last>end||last<p)throw Error('Invalid WebM element length');const tag=id.value,n=last-p;if([0x1a45dfa3,0x18538067,0x1549a966,0x1654ae6b,0xae,0xe0].includes(tag))walk(p,last,depth+1);else if(tag===0x4282)docType=ascii(b,p,n);else if(tag===0x2ad7b1)scale=integer(p,n);else if(tag===0x4489){if(![4,8].includes(n))throw Error('Invalid WebM duration');ticks=n===4?view.getFloat32(p):view.getFloat64(p);}else if(tag===0xd7)integer(p,n);else if(tag===0x83&&integer(p,n)===1)video=true;else if(tag===0xb0)width=Math.max(width,integer(p,n));else if(tag===0xba)height=Math.max(height,integer(p,n));else if(tag===0x1f43b675&&n>0)payload=true;at=last;}}
   if(u32(0)!==0x1a45dfa3)throw Error('Invalid WebM signature');walk(0,b.length);duration=ticks*scale/1e9;if(docType!=='webm'||!video||!payload)throw Error('WebM needs its document type, video track and local cluster');animated=true;
  }else throw Error('Unsupported media type');
  const video=videos.includes(type);if(video)validateVideo({size:b.length,width,height,duration},options);else dimensions(width,height,100000);return {type,kind:video?'video':'image',width,height,...(video?{duration}:{}),animated};
 }
 // Deterministic k-means on a 64px sample; transparent pixels contribute no colour.
 function palette(pixels){
  const points=[];for(let i=0;i+3<pixels.length;i+=4)if(pixels[i+3]>=128)points.push([pixels[i],pixels[i+1],pixels[i+2]]);
  if(!points.length)return ['#a9522f','#367964','#5f5ccc'];const centers=[points[0].slice()],distance=(a,b)=>a.reduce((n,v,i)=>n+(v-b[i])**2,0);
  while(centers.length<3){let best=points[0],far=-1;for(const p of points){const d=Math.min(...centers.map(c=>distance(p,c)));if(d>far){far=d;best=p;}}centers.push(best.slice());}
  for(let step=0;step<8;step++){const sums=centers.map(()=>[0,0,0,0]);for(const p of points){const ds=centers.map(c=>distance(p,c)),n=ds.indexOf(Math.min(...ds));for(let i=0;i<3;i++)sums[n][i]+=p[i];sums[n][3]++;}for(let n=0;n<3;n++)if(sums[n][3])centers[n]=sums[n].slice(0,3).map(v=>v/sums[n][3]);}
  return centers.map(c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''));
 }
 function canvas(width,height){if(!root.document?.createElement)fail('Photos are unavailable in this browser.');const c=root.document.createElement('canvas');c.width=width;c.height=height;if(!c.getContext('2d'))fail('Photos are unavailable in this browser.');return c;}
 function bounded(task,message,release=()=>{}){return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{done=true;reject(Error(message));},limits.decodeMs);Promise.resolve(task).then(value=>{if(done){release(value);return;}done=true;clearTimeout(timer);resolve(value);},error=>{if(done)return;done=true;clearTimeout(timer);reject(error);});});}
 const encode=(c,type)=>bounded(new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Photo could not be encoded.')),type,.88)),'Photo encoding took too long.');
 async function encoded(c){let b;try{b=await encode(c,'image/webp');}catch(error){if(error?.message==='Photo encoding took too long.')throw error;}if(!b||b.type!=='image/webp')b=await encode(c,'image/png');if(!b?.size||!['image/webp','image/png'].includes(b.type)||b.size>limits.imageBytes)fail('Photo must encode below 3 MB.');return b;}
 function sample(source,width,height){const scale=Math.min(64/width,64/height),c=canvas(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))),g=c.getContext('2d');g.drawImage(source,0,0,c.width,c.height);return palette(g.getImageData(0,0,c.width,c.height).data);}
 function waitMedia(video,event,start){return new Promise((resolve,reject)=>{let timer,settled=false;const done=error=>{if(settled)return;settled=true;clearTimeout(timer);video.removeEventListener(event,ok);video.removeEventListener('error',bad);error?reject(error):resolve();},ok=()=>done(),bad=()=>done(Error('This video could not be read.'));video.addEventListener(event,ok);video.addEventListener('error',bad);timer=setTimeout(()=>done(Error('This video could not be read.')),limits.decodeMs);try{start?.();}catch{bad();}});}
 async function seek(video,time){if(Number.isFinite(video.currentTime)&&Math.abs(video.currentTime-time)>.001)await waitMedia(video,'seeked',()=>{video.currentTime=time;});}
 // MediaRecorder WebM commonly omits Duration. Add it without decoding again;
 // indexed containers that would need offset rewriting keep their source loop.
 function timedWebM(b,duration){
  const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
  const vint=(at,end,id=false)=>{if(at>=end)throw Error('Truncated WebM');let mask=128,n=1;while(n<=8&&!(b[at]&mask)){mask>>=1;n++;}if(n>(id?4:8)||at+n>end)throw Error('Invalid WebM integer');let value=id?b[at]:b[at]&(mask-1),unknown=!id&&value===mask-1;for(let i=1;i<n;i++){value=value*256+b[at+i];unknown=unknown&&b[at+i]===255;}return {n,value,unknown};};
  const element=(at,end)=>{const id=vint(at,end,true),size=vint(at+id.n,end),p=at+id.n+size.n,last=size.unknown?end:p+size.value;if(!Number.isSafeInteger(last)||last<p||last>end)throw Error('Invalid WebM length');return {id:id.value,start:at,p,last};};
  const size=n=>{let length=1;while(n>=2**(7*length)-1)length++;const out=new Uint8Array(length);for(let i=length-1;i>=0;i--){out[i]=n%256;n=Math.floor(n/256);}out[0]|=1<<(8-length);return out;},wrap=(id,body)=>join([new Uint8Array(id),size(body.length),body]);
  const header=element(0,b.length),segment=element(header.last,b.length);if(header.id!==0x1a45dfa3||segment.id!==0x18538067||segment.last!==b.length)throw Error('Invalid WebM recording');let info,scale=1000000;const parts=[];
  for(let at=segment.p;at<segment.last;){const row=element(at,segment.last);if([0x114d9b74,0x1c53bb6b].includes(row.id))throw Error('WebM recording has indexed offsets');if(row.id===0x1549a966){if(info)throw Error('Duplicate WebM timing');info=row;}parts.push(row);at=row.last;}
  if(!info)throw Error('WebM recording needs timing');const fields=[];
  for(let at=info.p;at<info.last;){const row=element(at,info.last);if(row.id===0x2ad7b1){if(row.last-row.p<1||row.last-row.p>8)throw Error('Invalid WebM time scale');scale=0;for(let q=row.p;q<row.last;q++)scale=scale*256+b[q];}if(row.id!==0x4489)fields.push(b.subarray(row.start,row.last));at=row.last;}
  if(!Number.isSafeInteger(scale)||scale<=0)throw Error('Invalid WebM time scale');const ticks=new Uint8Array(8);new DataView(ticks.buffer).setFloat64(0,duration*1e9/scale);fields.push(wrap([0x44,0x89],ticks));const timing=wrap([0x15,0x49,0xa9,0x66],join(fields));
  return join([b.subarray(0,header.last),wrap([0x18,0x53,0x80,0x67],join(parts.map(row=>row===info?timing:b.subarray(row.start,row.last))))]);
 }
 async function recordedVideo(blob,width,height,duration){
  let b=new Uint8Array(await bounded(Blob.prototype.arrayBuffer.call(blob),'This video could not be read.')),info;try{info=inspectPortable(b,blob.type);}catch(error){if(blob.type!=='video/webm')throw error;b=timedWebM(b,duration);info=inspectPortable(b,blob.type);}
  if(info.width!==width||info.height!==height||Math.abs(info.duration-duration)>.5||b.length>limits.videoBytes)fail('This video could not be trimmed.');return {blob:new Blob([b],{type:blob.type}),duration:info.duration};
 }
 async function trimVideo(video,loop,size){
  const capture=size?null:video.captureStream||video.mozCaptureStream,Recorder=root.MediaRecorder;if(!size&&typeof capture!=='function'||typeof Recorder!=='function'||typeof root.MediaStream!=='function')return null;
  let stream,output,recorder;try{
   const type=['video/webm','video/mp4'].find(type=>typeof Recorder.isTypeSupported!=='function'||Recorder.isTypeSupported(type));if(!type)return null;
   await seek(video,loop.start);const c=size?canvas(size.width,size.height):null,g=c?.getContext('2d');if(c){if(typeof c.captureStream!=='function')return null;g.drawImage(video,0,0,c.width,c.height);stream=c.captureStream(30);}else stream=capture.call(video);const tracks=stream.getVideoTracks();if(!tracks.length)return null;output=new root.MediaStream(tracks);recorder=new Recorder(output,{mimeType:type,videoBitsPerSecond:2500000});
   const recorded=await new Promise(resolve=>{let ended=false,stopping=false,total=0,frame,wall;const chunks=[],timer=setTimeout(()=>finish(null),(loop.end-loop.start)*1000+limits.decodeMs),clean=()=>{clearTimeout(timer);clearTimeout(frame);clearTimeout(wall);video.removeEventListener('timeupdate',tick);video.removeEventListener('ended',last);video.removeEventListener('error',bad);recorder.removeEventListener('dataavailable',data);recorder.removeEventListener('stop',stop);recorder.removeEventListener('error',bad);};
    const finish=value=>{if(ended)return;ended=true;clean();video.pause();try{if(recorder.state!=='inactive')recorder.stop();}catch{}resolve(value);},bad=()=>finish(null),data=e=>{if(!e.data?.size)return;total+=e.data.size;if(total>limits.videoBytes){finish(null);return;}chunks.push(e.data);},stop=()=>{const at=video.currentTime,actual=(recorder.mimeType||type).split(';')[0];if(!stopping||!chunks.length||at<loop.end-.1||at>loop.end+.5||!videos.includes(actual)){finish(null);return;}finish(new Blob(chunks,{type:actual}));},end=()=>{if(stopping||ended)return;stopping=true;video.pause();try{recorder.stop();}catch{finish(null);}},tick=()=>{if(video.currentTime>=loop.end)end();},last=()=>{if(video.currentTime>=loop.end-.1)end();else finish(null);};
    const draw=()=>{if(ended||stopping)return;try{g.drawImage(video,0,0,c.width,c.height);tick();if(!ended&&!stopping)frame=setTimeout(draw,1000/30);}catch{finish(null);}};
    video.addEventListener('timeupdate',tick);video.addEventListener('ended',last);video.addEventListener('error',bad);recorder.addEventListener('dataavailable',data);recorder.addEventListener('stop',stop);recorder.addEventListener('error',bad);try{recorder.start();if(c){wall=setTimeout(last,Math.min(limits.duration,loop.end-loop.start)*1000);frame=setTimeout(draw,1000/30);}video.play()?.catch?.(bad);}catch{finish(null);}
   });return recorded?await recordedVideo(recorded,size?.width||video.videoWidth,size?.height||video.videoHeight,loop.end-loop.start):null;
  }catch{return null;}finally{for(const track of new Set([...(stream?.getTracks()||[]),...(output?.getTracks()||[])])){try{track.stop();}catch{}}}
 }
 async function prepare(blob,slot='banner',name=blob?.name||'Artwork',options={}){
  if(!(blob instanceof Blob)||!blob.size||!Object.hasOwn(slots,slot)||!images.concat(videos).includes(blob.type)||slot==='title'&&!['image/png','image/webp','image/avif'].includes(blob.type))fail('Choose a supported photo or video.');
  name=nameOf(name);if(blob.size>limits.inputBytes)fail(videos.includes(blob.type)?'This video is too large to shrink here. Try one under 30 MB.':'File must be at most 30 MB.');if(!record(options)||Object.keys(options).some(k=>!['loop','still'].includes(k)))fail('Choose a valid video loop and still.');
  // Yield before decoding so the caller's busy state is painted.
  await new Promise(resolve=>setTimeout(resolve,0));
  const mediaId=root.crypto.randomUUID();
  if(images.includes(blob.type)){
   let bitmap;try{
    const bytes=new Uint8Array(await bounded(Blob.prototype.arrayBuffer.call(blob),'This photo could not be read.')),info=inspectPortable(bytes,blob.type),animated=info.animated&&['image/gif','image/webp'].includes(blob.type),box=slots[slot];
    if(options.loop!==undefined||options.still!==undefined&&options.still!==0)fail('Loop and still selection is available for videos.');
    if(animated&&(blob.size>limits.imageBytes||info.width>box.width||info.height>box.height))fail('Animated picture is too large. Choose a smaller picture.');
    if(typeof root.createImageBitmap!=='function')fail('Photos are unavailable in this browser.');bitmap=await bounded(Promise.resolve().then(()=>root.createImageBitmap(blob)),'This photo could not be read.',b=>b?.close?.());dimensions(bitmap.width,bitmap.height,100000);
    if(animated&&(bitmap.width!==info.width||bitmap.height!==info.height))fail('This photo could not be read.');
    const scale=Math.min(1,(animated?Math.min(960,box.width):box.width)/bitmap.width,(animated?Math.min(960,box.height):box.height)/bitmap.height),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale)),c=canvas(width,height);c.getContext('2d').drawImage(bitmap,0,0,width,height);const colours=sample(c,width,height),safe=await encoded(c);
    return animated?{asset:{mediaId,name,type:blob.type,kind:'image',width:info.width,height:info.height,palette:colours,animated:true},blob,poster:safe}:{asset:{mediaId,name,type:safe.type,kind:'image',width,height,palette:colours},blob:safe};
   }catch(error){if(/^(Photo|Photos|Media|Animated picture|Loop and still)/.test(error?.message||''))throw error;fail('This photo could not be read.');}finally{bitmap?.close?.();}
  }
  const shrinkError='This video could not be shrunk in this browser. Try one under 1920 pixels wide.';let video,url,shrinking=false;
  try{if(!root.document?.createElement||!root.URL?.createObjectURL)fail(shrinkError);video=root.document.createElement('video');url=root.URL.createObjectURL(blob);video.muted=true;video.defaultMuted=true;video.volume=0;video.playsInline=true;video.preload='metadata';await waitMedia(video,'loadedmetadata',()=>{video.src=url;video.load();});const width=video.videoWidth,height=video.videoHeight,duration=video.duration;videoSource({size:blob.size,width,height,duration},true);const framing=videoTiming(duration,options),box=slots[slot],fit=Math.min(1,box.width/width,box.height/height,limits.videoWidth/width,limits.videoWidth/height),size={width:Math.max(1,Math.round(width*fit)),height:Math.max(1,Math.round(height*fit))};shrinking=fit<1;
   if(video.readyState<2)await waitMedia(video,'loadeddata',()=>{video.preload='auto';});
   await seek(video,Math.min(framing.still,Math.max(0,duration-.001)));
   const colours=sample(video,width,height),scale=Math.min(1,960/width,960/height),c=canvas(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)));c.getContext('2d').drawImage(video,0,0,c.width,c.height);const poster=await encoded(c),trim=shrinking||options.loop!==undefined&&framing.still>=framing.loop.start&&framing.still<=framing.loop.end&&(framing.loop.start>0||framing.loop.end<duration)?await trimVideo(video,framing.loop,shrinking?size:undefined):null;
   if(shrinking&&!trim)fail(shrinkError);const length=trim?.duration||framing.loop.end-framing.loop.start;return {asset:{mediaId,name,type:trim?.blob.type||blob.type,kind:'video',width:shrinking?size.width:width,height:shrinking?size.height:height,duration:trim?length:duration,palette:colours},blob:trim?.blob||blob,poster,framing:trim?{loop:{start:0,end:length},still:Math.max(0,Math.min(length,framing.still-framing.loop.start))}:framing};
  }catch(error){if(/^Invalid .*framing/.test(error?.message||''))fail('Choose a valid video loop and still.');if(/^(This video|Choose a valid video|Video loop must)/.test(error?.message||''))throw error;fail(shrinking?shrinkError:'This video could not be read. Try an MP4 or WebM video.');}finally{try{video?.pause();video?.removeAttribute('src');video?.load();}catch{}finally{if(url)root.URL.revokeObjectURL(url);}}
 }
 function planBudget(records,incoming,used=new Set(),budget=limits.totalBytes){
  const added=incoming.reduce((sum,r)=>sum+r.blob.size+(r.poster?.size||0),0);if(added>budget)fail('Media storage is full.');
  let total=records.reduce((sum,r)=>sum+r.blob.size+(r.poster?.size||0),0)+added;const remove=[];
  for(const r of records.filter(r=>!used.has(r.asset.mediaId)).sort((a,b)=>a.createdAt-b.createdAt||a.asset.mediaId.localeCompare(b.asset.mediaId))){if(total<=budget)break;remove.push(r.asset.mediaId);total-=r.blob.size+(r.poster?.size||0);}
  if(total>budget)fail('Media storage is full.');return remove;
 }
 function ownerScope(owner){if(!owner?.accountId||typeof owner.origin!=='string'||!/^https:\/\/[^/]+$/.test(owner.origin))fail('A verified account is required for media.');return JSON.stringify([owner.origin,String(owner.accountId)]);}
 const packKinds=['theme','pet','preset'],documentScopes=new Set(),packId=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(v)&&!['__proto__','constructor','prototype'].includes(v);
 async function packMediaBudget(storage,base,scope){if(!root.ReservePacks&&!documentScopes.has(scope))return limits.totalBytes;const raw=(await storage.get(base+':packs'))[base+':packs'];if(raw===undefined)return limits.totalBytes;if(!record(raw)||raw.version!==1||!Array.isArray(raw.documents)||raw.documents.length>50)fail('Invalid pack storage.');let used=0;for(const row of raw.documents){if(!Number.isSafeInteger(row?.bytes)||row.bytes<1||(used+=row.bytes)>limits.totalBytes)fail('Invalid pack storage.');}return limits.totalBytes-used;}
 // Portable pack documents share the account media pool. Their inline binary,
 // font and SVG bytes never enter the small personal-preferences record.
 function packDocuments(owner){
  const scope=ownerScope(owner),base='reserve:market-media:'+scope,key=base+':packs',documentKey=id=>base+':pack:'+id,storage=root.chrome?.storage?.local,worker=typeof root.importScripts==='function';
  async function index(){if(!storage?.get)fail('Shared pack storage is unavailable.');const raw=(await storage.get(key))[key];if(raw===undefined)return [];documentScopes.add(scope);if(!record(raw)||raw.version!==1||!Array.isArray(raw.documents)||raw.documents.length>50)fail('Invalid pack storage.');const ids=new Set();let bytes=0;return raw.documents.map(row=>{if(!record(row)||Object.keys(row).some(k=>!['id','name','kind','installedAt','bytes'].includes(k))||!packId(row.id)||ids.has(row.id)||!packKinds.includes(row.kind)||typeof row.name!=='string'||!row.name.trim()||row.name.length>120||/[\p{C}\u2028\u2029]/u.test(row.name)||!Number.isSafeInteger(row.installedAt)||row.installedAt<0||!Number.isSafeInteger(row.bytes)||row.bytes<1||(bytes+=row.bytes)>limits.totalBytes)fail('Invalid pack storage.');ids.add(row.id);return structuredClone(row);});}
  async function getPack(id){if(!packId(id))fail('Invalid pack id.');const row=(await index()).find(p=>p.id===id);if(!row)return null;const doc=cleanPackDocument((await storage.get(documentKey(id)))[documentKey(id)]);if(doc.id!==id||doc.name!==row.name||doc.kind!==row.kind||doc.installedAt!==row.installedAt||new TextEncoder().encode(JSON.stringify(doc)).length!==row.bytes)fail('Stored pack is incomplete.');return doc;}
  async function listPacks(){return (await index()).map(({bytes,...row})=>row);}
  async function updatePacks({put=[],remove=[],order}={}){
   if(!worker)fail('Pack writes require the worker.');if(!Array.isArray(put)||!Array.isArray(remove)||put.length>50||remove.length>50||remove.some(id=>!packId(id))||order!==undefined&&(!Array.isArray(order)||order.length>50||order.some(id=>!packId(id))||new Set(order).size!==order.length))fail('Invalid pack update.');
   const docs=put.map(cleanPackDocument);if(new Set(docs.map(d=>d.id)).size!==docs.length)fail('Duplicate pack.');
   return sharedWrite(base,async()=>{
    const rows=await index(),deleted=new Set(remove),values={},replacements=new Map();
    for(const doc of docs){const bytes=new TextEncoder().encode(JSON.stringify(doc)).length;replacements.set(doc.id,{id:doc.id,name:doc.name,kind:doc.kind,installedAt:doc.installedAt,bytes});values[documentKey(doc.id)]=doc;}
    let next=rows.filter(row=>!deleted.has(row.id)||replacements.has(row.id)).map(row=>replacements.get(row.id)||row);
    for(const row of replacements.values())if(!next.some(old=>old.id===row.id))next.push(row);
    // Rollback can restore removed rows to their old order without rewriting
    // independent documents or their bytes. New independent rows remain present.
    if(order){const known=new Set(order),byId=new Map(next.map(row=>[row.id,row]));next=order.filter(id=>byId.has(id)).map(id=>byId.get(id)).concat(next.filter(row=>!known.has(row.id)));}
    if(next.length>50)fail('At most 50 packs.');const current=(await storage.get(base+':index'))[base+':index'],media=current===undefined?(await storage.get(base))[base]:current,mediaBytes=(media?.media||[]).reduce((n,row)=>n+(row.blob?.size||0)+(row.poster?.size||0),0);
    if(next.reduce((n,row)=>n+row.bytes,0)+mediaBytes>limits.totalBytes)fail('Media storage is full.');await storage.set({...values,[key]:{version:1,documents:next}});documentScopes.add(scope);
    for(const id of deleted)if(!replacements.has(id)){try{await storage.remove?.(documentKey(id));}catch{}}return next.map(({bytes,...row})=>row);
   });
  }
  return {getPack,listPacks,updatePacks,putPack:doc=>updatePacks({put:[doc]}),removePack:id=>updatePacks({remove:[id]})};
 }
 function cleanMedia(item){if(!record(item))fail('Invalid stored media.');const asset=cleanReference(item.asset,'background');if(!(item.blob instanceof Blob)||item.blob.type!==asset.type||!item.blob.size||item.blob.size>(asset.kind==='video'?limits.videoBytes:limits.imageBytes)||item.poster!==undefined&&(!(item.poster instanceof Blob)||asset.kind!=='video'&&!asset.animated||!['image/png','image/webp'].includes(item.poster.type)||!item.poster.size||item.poster.size>limits.imageBytes))fail('Invalid stored media.');return {asset,blob:item.blob,...(item.poster?{poster:item.poster}:{})};}
 function cleanKit(kit){if(!record(kit)||!uuid.test(kit.id)||typeof kit.name!=='string'||!kit.name.trim()||kit.name.length>40||/[\x00-\x1f\x7f]/.test(kit.name)||!['system','humanist','serif'].includes(kit.font)||!['compact','standard','large'].includes(kit.bannerSize)||!(['clay','forest','indigo','rose','ocean','amber'].includes(kit.accent)||color.test(kit.accent)))fail('Invalid kit.');const model=root.ReserveCustomization||(typeof module==='object'&&module.exports?require('./customization-model.js'):null);return {id:kit.id,name:kit.name.trim(),appearance:model.cleanAppearance(kit.appearance),accent:kit.accent,font:kit.font,bannerSize:kit.bannerSize};}
 const sharedWrites=new Map();
 function sharedWrite(key,change){if(root.ReserveAccountWrites?.run)return root.ReserveAccountWrites.run(key,change);const next=(sharedWrites.get(key)||Promise.resolve()).catch(()=>{}).then(change);sharedWrites.set(key,next);return next.finally(()=>{if(sharedWrites.get(key)===next)sharedWrites.delete(key);});}
 function blobInfo(raw,types,max,empty=false){if(!record(raw)||!types.includes(raw.type)||!Number.isSafeInteger(raw.size)||raw.size<(empty?0:1)||raw.size>max||typeof raw.data!=='string'||raw.data.length!==4*Math.ceil(raw.size/3))fail('Invalid shared media bytes.');return raw;}
 function decodeBlob(raw){const bytes=new Uint8Array(raw.size);let offset=0;for(let at=0;at<raw.data.length;at+=32768){const part=raw.data.slice(at,at+32768);let binary;try{if(at+part.length<raw.data.length&&part.includes('='))fail('Invalid shared media bytes.');binary=root.atob(part);if(root.btoa(binary)!==part)fail('Invalid shared media bytes.');}catch{fail('Invalid shared media bytes.');}if(binary.length>bytes.length-offset)fail('Invalid shared media bytes.');for(let i=0;i<binary.length;i++)bytes[offset++]=binary.charCodeAt(i);}if(offset!==bytes.length)fail('Invalid shared media bytes.');return new Blob([bytes],{type:raw.type});}
 async function encodeBlob(blob,max){const bounded=Blob.prototype.slice.call(blob,0,max+1,blob.type);if(bounded.size>max||bounded.size!==blob.size)fail('Invalid stored media.');const bytes=new Uint8Array(await bounded.arrayBuffer());let data='';for(let at=0;at<bytes.length;at+=24576)data+=root.btoa(String.fromCharCode(...bytes.subarray(at,at+24576)));return {type:blob.type,size:bytes.length,data};}
 async function encodeMedia(item){const safe=cleanMedia(item);return {asset:safe.asset,blob:await encodeBlob(safe.blob,safe.asset.kind==='video'?limits.videoBytes:limits.imageBytes),...(safe.poster?{poster:await encodeBlob(safe.poster,limits.imageBytes)}:{})};}
 function decodeMedia(value){if(!record(value)||Object.keys(value).some(k=>!['asset','blob','poster'].includes(k)))fail('Invalid stored media.');const asset=cleanReference(value.asset,'background'),blob=blobInfo(value.blob,[asset.type],asset.kind==='video'?limits.videoBytes:limits.imageBytes),poster=value.poster===undefined?undefined:blobInfo(value.poster,['image/png','image/webp'],limits.imageBytes);return cleanMedia({asset,blob:decodeBlob(blob),...(poster?{poster:decodeBlob(poster)}:{})});}
 // Shared storage has a small index and independently addressed JSON-safe byte records.
 // Only the worker migrates or writes; Canvas can still read a legacy pool during an interrupted migration.
 const sharedReads=new Map(),assetReads=new Map(),migrations=new Map();
 function sharedRead(storage,key){if(sharedReads.has(key))return sharedReads.get(key);const task=Promise.resolve().then(()=>storage.get(key)).then(saved=>saved[key]);sharedReads.set(key,task);return task.finally(()=>{if(sharedReads.get(key)===task)sharedReads.delete(key);});}
 function byteInfo(raw,types,max,encoded=false,empty=false){if(encoded)return blobInfo(raw,types,max,empty);if(!record(raw)||!types.includes(raw.type)||!Number.isSafeInteger(raw.size)||raw.size<(empty?0:1)||raw.size>max||Object.keys(raw).some(k=>!['type','size'].includes(k)))fail('Invalid shared media bytes.');return {type:raw.type,size:raw.size};}
 function sharedIndex(raw,scope,legacy=false){
  if(raw===undefined)return {media:[],kits:[],meta:[]};if(!record(raw)||raw.version!==(legacy?1:2)||!Array.isArray(raw.media)||!Array.isArray(raw.kits)||raw.kits.length>200||!Array.isArray(raw.meta)||raw.meta.length>1)fail('Invalid shared media storage.');const ids=new Set(),kitIds=new Set();let total=0;
  const media=raw.media.map(row=>{const asset=cleanReference(row?.asset,'background');if(row.owner!==scope||row.key!==scope+':'+asset.mediaId||ids.has(asset.mediaId)||!Number.isSafeInteger(row.createdAt)||row.createdAt<0||!Array.isArray(row.holds)||row.holds.some(t=>typeof t!=='string'||!uuid.test(t)))fail('Invalid shared media record.');ids.add(asset.mediaId);const blob=byteInfo(row.blob,[asset.type],asset.kind==='video'?limits.videoBytes:limits.imageBytes,legacy),poster=row.poster===undefined?undefined:byteInfo(row.poster,['image/png','image/webp'],limits.imageBytes,legacy,true);total+=blob.size+(poster?.size||0);if(total>limits.totalBytes)fail('Media storage is full.');return {key:row.key,owner:scope,asset,createdAt:row.createdAt,holds:row.holds.slice(),blob:{type:blob.type,size:blob.size},...(poster?{poster:{type:poster.type,size:poster.size}}:{})};});
  const kits=raw.kits.map(row=>{const kit=cleanKit(row?.kit);if(row.owner!==scope||row.key!==scope+':'+kit.id||kitIds.has(kit.id))fail('Invalid shared kit record.');kitIds.add(kit.id);for(const id of referenced({overviewArt:kit.appearance}))if(!ids.has(id))fail('Kit media is missing.');return {key:row.key,owner:scope,kit};});
  const meta=raw.meta.map(row=>{if(!record(row)||row.owner!==scope||row.key!==scope||typeof row.revision!=='string'||!uuid.test(row.revision))fail('Invalid shared media revision.');return {key:scope,owner:scope,revision:row.revision};});return {media,kits,meta};
 }
 function sharedBytes(row,raw){const blob=blobInfo(raw?.blob,[row.blob.type],row.asset.kind==='video'?limits.videoBytes:limits.imageBytes),poster=raw.poster===undefined?undefined:blobInfo(raw.poster,['image/png','image/webp'],limits.imageBytes,true);if(blob.size!==row.blob.size||!!poster!==!!row.poster||poster&&(poster.size!==row.poster.size||poster.type!==row.poster.type))fail('Invalid shared media bytes.');return cleanMedia({asset:row.asset,blob:decodeBlob(blob),...(poster?{poster:decodeBlob(poster)}:{})});}
 const sameBytes=(a,b)=>!!a&&!!b&&a.type===b.type&&a.size===b.size&&a.data===b.data;
 function sharedAdapter(scope){
  const key='reserve:market-media:'+scope,indexKey=key+':index',assetKey=id=>key+':asset:'+id,storage=root.chrome?.storage?.local,worker=typeof root.importScripts==='function';if(!storage?.get||!storage?.set)fail('Shared market media storage is unavailable.');
  async function verifiedBytes(id,bytes){const name=assetKey(id);await storage.set({[name]:bytes});const copy=(await storage.get(name))[name];if(!sameBytes(bytes.blob,copy?.blob)||!!bytes.poster!==!!copy.poster||bytes.poster&&!sameBytes(bytes.poster,copy.poster))fail('Could not verify shared media bytes.');}
  async function load(migrate=false){
   const index=await sharedRead(storage,indexKey);if(index!==undefined)return {state:sharedIndex(index,scope)};
   const legacy=await sharedRead(storage,key),state=sharedIndex(legacy,scope,true);if(!legacy)return {state};
   if(!migrate){
    if(!worker){let task=migrations.get(scope);if(!task){const [origin,accountId]=JSON.parse(scope);task=marketRequest({type:'market-media-migrate',owner:{origin,accountId}});migrations.set(scope,task);}try{await task;const copied=await sharedRead(storage,indexKey);if(copied!==undefined)return {state:sharedIndex(copied,scope)};}catch{}finally{if(migrations.get(scope)===task)migrations.delete(scope);}}
    return {state,legacy};
   }
   try{
    await root.ReserveMarketHolds?.ready;
    for(let i=0;i<state.media.length;i++){const row=state.media[i],raw=legacy.media[i];sharedBytes(row,raw);await verifiedBytes(row.asset.mediaId,{blob:raw.blob,...(raw.poster?{poster:raw.poster}:{})});}
    // Reclaim legacy holds whose document did not survive the browser session.
    if(root.chrome.storage.session){const saved=(await root.chrome.storage.session.get('reserve:market-holds'))['reserve:market-holds']||{};for(const row of state.media)row.holds=row.holds.filter(token=>{const owner=saved[token]?.owner;return owner&&JSON.stringify([owner.origin,String(owner.accountId)])===scope;});}
    // A single index write publishes the complete, verified copy. The legacy pool is untouched on failure.
    const next={version:2,...state};await storage.set({[indexKey]:next});const copy=(await storage.get(indexKey))[indexKey];if(JSON.stringify(copy)!==JSON.stringify(next)){await storage.remove?.(indexKey);fail('Could not verify shared media index.');}
    try{await storage.remove?.(key);}catch{}return {state};
   }catch(error){if((await storage.get(indexKey))[indexKey]!==undefined)throw error;return {state,legacy,migrationError:error};}
  }
  const readState=()=>worker?sharedWrite(key,()=>load(true)):load();
  async function save(state,before){
   const budget=await packMediaBudget(storage,key,scope);if(state.media.reduce((n,r)=>n+r.blob.size+(r.poster?.size||0),0)>budget)fail('Media storage is full.');
   const media=[];for(const row of state.media){if(row.blob instanceof Blob){const item=cleanMedia(row),bytes={blob:await encodeBlob(item.blob,item.asset.kind==='video'?limits.videoBytes:limits.imageBytes),...(item.poster?{poster:await encodeBlob(item.poster,limits.imageBytes)}:{})};await verifiedBytes(item.asset.mediaId,bytes);media.push({...row,blob:{type:item.blob.type,size:item.blob.size},...(item.poster?{poster:{type:item.poster.type,size:item.poster.size}}:{})});}else media.push(row);}
   const next={version:2,...sharedIndex({version:2,...state,media},scope)};await storage.set({[indexKey]:next});
   const keep=new Set(media.map(row=>row.asset.mediaId));for(const row of before.media)if(!keep.has(row.asset.mediaId)){try{await storage.remove?.(assetKey(row.asset.mediaId));}catch{}}
  }
  return {market:true,budget:()=>packMediaBudget(storage,key,scope),async get(id){const name=assetKey(id);if(assetReads.has(name))return assetReads.get(name);const task=(async()=>{const {state,legacy}=await readState(),row=state.media.find(r=>r.asset.mediaId===id);if(!row)return null;const raw=legacy?legacy.media.find(r=>r.asset.mediaId===id):await sharedRead(storage,name);return {...row,...sharedBytes(row,raw)};})();assetReads.set(name,task);try{return await task;}finally{if(assetReads.get(name)===task)assetReads.delete(name);}},transact(change,write=false){if(write&&!worker)return Promise.reject(Error('Market media writes require the worker.'));const run=async()=>{const loaded=write?await load(true):await readState(),state=loaded.state,before={media:state.media.slice()},result=change(state);if(write){if(loaded.migrationError)throw loaded.migrationError;await save(state,before);}return result;};return write?sharedWrite(key,run):run();}};
 }
 async function marketRequest(message){if(!root.chrome?.runtime?.sendMessage)fail('The market worker is unavailable.');const reply=await root.chrome.runtime.sendMessage(message);if(reply?.ok!==true)fail(typeof reply?.error==='string'?reply.error:typeof reply?.reason==='string'?reply.reason:'Market operation failed.');}
 function contentHolds(){const state=root.__chMarketMediaHolds||= {active:new Set(),listening:false},runtime=root.chrome?.runtime;if(!state.listening&&runtime?.onMessage?.addListener){runtime.onMessage.addListener((message,sender,reply)=>{if(message?.target!=='ch-market-holds-live'||!Array.isArray(message.tokens)||!runtime.id||sender?.id!==runtime.id||sender.tab||sender.url!==undefined&&sender.url!=='chrome-extension://'+runtime.id+'/background.js')return;reply({tokens:[...new Set(message.tokens.filter(token=>state.active.has(token)))]});});state.listening=true;}return state.active;}
 function createPackStore(owner,{readUsed}={}){
  const scope=ownerScope(owner),store={...createStore(owner,{adapter:sharedAdapter(scope),readUsed,shared:false}),...packDocuments(owner)};
  if(typeof root.importScripts==='function'){
   const accountKey=`reserve:v1:${owner.origin}:${owner.accountId}`;
   return {...store,stageBackup:(payload,options)=>stageBackupMedia(owner,store,payload,options),removeKit:(id,options)=>sharedWrite(accountKey,async()=>{await options?.recheck?.();return store.removeKit(id,options);}),release(token,{accountWriteLease}={}){
    const release=()=>store.release(token,{collect:true});
    if(accountWriteLease===undefined)return sharedWrite(accountKey,release);
    // Only the exact caller already holding this account queue can avoid a
    // second acquisition. Other tasks and stale/foreign capabilities cannot.
    if(!root.ReserveStorage?.ownsAccountWrite(accountWriteLease,accountKey))return Promise.reject(Error('Invalid account write capability.'));
    return release();
   }};
  }
  const target={origin:owner.origin,accountId:String(owner.accountId)},tokens=new Set(),active=contentHolds(),pending=new Map(),releasing=new Map();let closed=false;
  async function release(token){if(releasing.has(token))return releasing.get(token);if(!tokens.has(token))return;const task=(async()=>{await pending.get(token)?.catch(()=>{});if(!tokens.has(token))return;await marketRequest({type:'market-media-hold',op:'release',owner:target,token});tokens.delete(token);active.delete(token);})();releasing.set(token,task);try{await task;}finally{if(releasing.get(token)===task)releasing.delete(token);}}
  return {...store,async reserve(ids,token){if(closed)fail('Market media store is closed.');if(!uuid.test(token))fail('Invalid media reservation.');const wanted=[...new Set(ids)];if(wanted.some(id=>typeof id!=='string'||!uuid.test(id)))fail('Kit media is missing.');if(!wanted.length)return;tokens.add(token);active.add(token);const task=marketRequest({type:'market-media-hold',op:'reserve',owner:target,ids:wanted,token});pending.set(token,task);try{await task;}finally{if(pending.get(token)===task)pending.delete(token);}},release,async removeKit(id){if(!uuid.test(id))fail('Invalid kit removal.');await marketRequest({type:'market-kit-remove',kitId:id,owner:target});},close(){if(closed)return;closed=true;for(const token of tokens)active.delete(token);for(const token of tokens)void release(token).catch(()=>{});store.close();}};
 }
 async function stageBackupMedia(owner,store,payload,{accountWriteLease,localStore,conflicts,preserveIds=false}={}){
  const accountKey=`reserve:v1:${owner.origin}:${owner.accountId}`,active=()=>root.ReserveStorage?.ownsAccountWrite(accountWriteLease,accountKey);
  if(!active())fail('Invalid account write capability.');
  if(!record(payload)||payload.version!==1||!Array.isArray(payload.assets)||!Array.isArray(payload.kits)||payload.assets.length>2000||payload.kits.length>200)fail('Invalid backup media.');
  const items=payload.assets.map(cleanMedia),kits=payload.kits.map(cleanKit),scope=ownerScope(owner),base='reserve:market-media:'+scope,storage=root.chrome.storage.local,db=sharedAdapter(scope),token=root.crypto.randomUUID(),mediaIds=Object.create(null),kitIds=Object.create(null);
  if(items.reduce((n,row)=>n+row.blob.size+(row.poster?.size||0),0)>limits.totalBytes)fail('Combined backup media exceeds 60 MB.');
  const view=localStore||createStore(owner),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),hash=async blob=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
  const equal=async(a,b)=>!a||same(a.asset,b.asset)&&a.blob.type===b.blob.type&&a.blob.size===b.blob.size&&!!a.poster===!!b.poster&&await hash(a.blob)===await hash(b.blob)&&(!a.poster||a.poster.type===b.poster.type&&a.poster.size===b.poster.size&&await hash(a.poster)===await hash(b.poster));
  const rewrite=value=>{if(Array.isArray(value))return value.map(rewrite);if(!record(value))return value;return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,key==='mediaId'&&mediaIds[v]?mediaIds[v]:rewrite(v)]));};
  let before,addedMedia=[],addedKits=[],staged=false,finished=false,previousIndex;
  try{
   const occupied=new Set(items.map(row=>row.asset.mediaId));
   for(const item of items){const id=item.asset.mediaId;if(conflicts?.mediaIds.includes(id)||!await equal(await view.get(id),item)||!await equal(await store.get(id),item)){if(preserveIds)fail('Destination media conflicts with existing bytes.');let next;do{next=root.crypto.randomUUID();}while(occupied.has(next)||await view.get(next)||await store.get(next));mediaIds[id]=next;occupied.add(next);item.asset={...item.asset,mediaId:next};}}
   const existingKits=await view.listKits(),sharedKits=await store.listKits(),occupiedKits=new Set([...existingKits,...sharedKits,...kits].map(kit=>kit.id));
   const restoredKits=kits.map(raw=>{const kit=rewrite(raw);if(conflicts?.kitIds.includes(kit.id)||[...existingKits,...sharedKits].some(old=>old.id===kit.id&&!same(old,kit))){let next;do{next=root.crypto.randomUUID();}while(occupiedKits.has(next));kitIds[kit.id]=next;occupiedKits.add(next);kit.id=next;}return kit;});
   previousIndex=(await storage.get(base+':index'))[base+':index'];
   await db.transact(state=>{
    before=structuredClone(state);const now=Date.now();
    for(const item of items){const old=state.media.find(row=>row.asset.mediaId===item.asset.mediaId);if(old){if(!same(old.asset,item.asset)||old.blob.size!==item.blob.size||old.blob.type!==item.blob.type)fail('Media changed during backup restore.');}else{const row={...item,key:scope+':'+item.asset.mediaId,owner:scope,createdAt:now,holds:[]};state.media.push(row);addedMedia.push(row);}}
    for(const kit of restoredKits){const old=state.kits.find(row=>row.kit.id===kit.id);if(old){if(!same(old.kit,kit))fail('Kits changed during backup restore.');}else{const row={key:scope+':'+kit.id,owner:scope,kit};state.kits.push(row);addedKits.push(row);}}
    if(state.kits.length>200)fail('Too many restored kits.');for(const row of state.kits)for(const id of referenced({overviewArt:row.kit.appearance}))if(!state.media.some(r=>r.asset.mediaId===id))fail('Kit media is missing.');
    // Pin both incoming and preexisting bytes while account publication runs.
    state.media=state.media.map(row=>({...row,holds:[...new Set([...(row.holds||[]),token])]}));state.meta=[{key:scope,owner:scope,revision:root.crypto.randomUUID()}];staged=true;
   },true);
  }catch(error){if(staged)try{await rollback();}catch(rollbackError){throw Error(error.message+'; media rollback failed: '+rollbackError.message);}throw error;}finally{if(!localStore)view.close();}
  async function cleanupOrphans(){await sharedWrite(base,async()=>{
   const raw=(await storage.get(base+':index'))[base+':index'],present=new Set(raw?.media?.map(row=>row.asset.mediaId)||[]);
   for(const row of addedMedia)if(!present.has(row.asset.mediaId)){const name=base+':asset:'+row.asset.mediaId,saved=(await storage.get(name))[name];if(saved?.blob&&sameBytes(saved.blob,await encodeBlob(row.blob,row.blob.size))&&!!saved.poster===!!row.poster&&(!row.poster||sameBytes(saved.poster,await encodeBlob(row.poster,row.poster.size))))await storage.remove(name);}
   if(previousIndex===undefined&&raw?.version===2&&!raw.media.length&&!raw.kits.length&&!raw.meta.length)await storage.remove(base+':index');
  });}
  async function rollback(){
   if(finished)return;if(!active())fail('Invalid account write capability.');
   const used=referenced((await storage.get(accountKey))[accountKey]?.settings);for(const id of refs.undoReferences((await storage.get('reserve:packs:receipts'))['reserve:packs:receipts'],owner))used.add(id);
   if(before)await db.transact(state=>{
    state.kits=state.kits.filter(row=>!addedKits.some(added=>added.key===row.key&&same(added.kit,row.kit)));
    const pins=new Set(used);for(const row of state.kits)for(const id of referenced({overviewArt:row.kit.appearance}))pins.add(id);
    state.media=state.media.map(row=>({...row,holds:(row.holds||[]).filter(hold=>hold!==token)})).filter(row=>!addedMedia.some(added=>added.key===row.key&&same(added.asset,row.asset))||row.holds.length||pins.has(row.asset.mediaId));
    if(same(state.media,before.media)&&same(state.kits,before.kits))state.meta=before.meta;
   },true);
   await cleanupOrphans();finished=true;
  }
  return {mediaIds,kitIds,async commit({finalize=true}={}){if(finished)return;if(!active())fail('Invalid account write capability.');await store.release(token);if(finalize)finished=true;},seal(){finished=true;},rollback};
 }
 function indexedAdapter(owner){
  const tables=['media','kits','meta'];let opened;const open=()=>opened||=new Promise((resolve,reject)=>{if(!root.indexedDB){reject(Error('Local media storage is unavailable.'));return;}const request=root.indexedDB.open('reserve-media-v1',2);request.onupgradeneeded=()=>{for(const name of tables)if(!request.result.objectStoreNames.contains(name)){const s=request.result.createObjectStore(name,{keyPath:'key'});s.createIndex('owner','owner');}};request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};request.onerror=()=>reject(Error('Local media storage is unavailable.'));});
  async function transact(change,write=false){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(tables,write?'readwrite':'readonly'),state={},before={};let count=0,result,error;
   tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error||Error('Could not save local media.'));
   for(const name of tables){const store=tx.objectStore(name),request=store.index('owner').getAll(owner);request.onsuccess=()=>{state[name]=request.result;before[name]=state[name].slice();if(++count!==tables.length)return;try{result=change(state);if(write)for(const key of tables){const s=tx.objectStore(key),keep=new Set(state[key].map(r=>r.key));for(const old of before[key])if(!keep.has(old.key))s.delete(old.key);for(const row of state[key])if(!before[key].includes(row))s.put(row);}}catch(e){error=e;tx.abort();}};}
  });}
  return {transact,close(){opened?.then(db=>db.close()).catch(()=>{});}};
 }
 function createStore(owner,{adapter,readUsed,shared=!adapter}={}){
  const scope=ownerScope(owner),db=adapter||indexedAdapter(scope),key=id=>scope+':'+id,packs=shared&&root.chrome?.storage?.local?createPackStore(owner,{readUsed}):null;
  const revision=s=>(s.meta||[]).find(r=>r.owner===scope)?.revision||0,bump=s=>{s.meta=(s.meta||[]).filter(r=>r.owner!==scope);s.meta.push({key:scope,owner:scope,revision:root.crypto.randomUUID()});};
  const read=fn=>db.transact(state=>fn({media:state.media.filter(r=>r.owner===scope),kits:state.kits.filter(r=>r.owner===scope),meta:state.meta}));
  // A hold spans IndexedDB and the preference save. Web Locks let another tab
  // recover abandoned holds after a crash, while live publishers remain pinned.
  // Page Web Locks cannot recover reservations that span extension and Canvas origins.
  const locks=db.market?null:root.navigator?.locks,holding=new Map(),lockName=token=>'reserve-media:'+scope+':'+token;
  async function acquire(token){if(!token||holding.has(token)||!locks)return;let unlock;const until=new Promise(resolve=>{unlock=resolve;});holding.set(token,unlock);await new Promise((resolve,reject)=>{locks.request(lockName(token),async()=>{resolve();await until;}).catch(reject);});}
  const clearHold=(s,token)=>{s.media=s.media.map(r=>r.owner===scope&&r.holds?.includes(token)?{...r,holds:r.holds.filter(t=>t!==token)}:r);bump(s);};
  async function recover(){if(!locks)return;const tokens=await read(s=>[...new Set(s.media.flatMap(r=>r.holds||[]))]);for(const token of tokens)if(!holding.has(token))await locks.request(lockName(token),{ifAvailable:true},async lock=>{if(lock)await db.transact(s=>clearHold(s,token),true);});}
  async function currentUsed(fallback){
   const settingsKey=`reserve:v1:${owner.origin}:${owner.accountId}`;let used;
   if(readUsed)used=new Set(await readUsed());else if(root.chrome?.storage?.local?.get){const saved=await root.chrome.storage.local.get(settingsKey);used=referenced(saved[settingsKey]?.settings);}else if(root.localStorage?.getItem){const saved=JSON.parse(root.localStorage.getItem(settingsKey)||'null');used=referenced(saved?.settings);}else used=new Set(typeof fallback==='function'?fallback():fallback);
   if(root.chrome?.storage?.local?.get){const saved=await root.chrome.storage.local.get('reserve:packs:receipts');for(const id of refs.undoReferences(saved['reserve:packs:receipts'],owner))used.add(id);}return used;
  }

  const get=async id=>{if(!uuid.test(id))return null;const row=db.get?await db.get(id):await read(s=>s.media.find(r=>r.asset.mediaId===id)),local=row?(({holds,...publicRecord})=>publicRecord)(row):null;return local||(packs?await packs.get(id):null);};
  async function putMany(items,{usedIds=new Set(),confirm=async()=>false,kit=null,hold=null}={}){
   if(!Array.isArray(items)||items.length>4)fail('Invalid media batch.');
   if(hold!==null&&!uuid.test(hold))fail('Invalid media reservation.');
   const checked=items.map(item=>{const safe=cleanMedia(item);return {...safe,holds:hold?[hold]:[],createdAt:Date.now(),owner:scope,key:key(safe.asset.mediaId)};});
   if(new Set(checked.map(r=>r.key)).size!==checked.length)fail('Duplicate media.');
   await acquire(hold);await recover();
   let used;const pins=s=>{const out=new Set(used);for(const r of s.media)if(r.holds?.length)out.add(r.asset.mediaId);for(const row of s.kits)for(const id of referenced({overviewArt:row.kit.appearance}))out.add(id);for(const id of referenced({overviewArt:kit?.appearance}))out.add(id);return out;};
   const consent=new Set();for(let attempt=0;attempt<8;attempt++){
   const before=await read(revision),budget=db.budget?await db.budget():limits.totalBytes;used=await currentUsed(usedIds);const proposal=await read(s=>revision(s)===before?planBudget(s.media,checked,pins(s),budget):null);if(!proposal)continue;
   const ask=proposal.filter(id=>!consent.has(id));if(ask.length){if(!await confirm(ask))fail('Media storage is full.');for(const id of ask)consent.add(id);}
   const committed=await db.transact(state=>{if(revision(state)!==before)return false;const own={media:state.media.filter(r=>r.owner===scope),kits:state.kits.filter(r=>r.owner===scope)},required=planBudget(own.media,checked,pins(own),budget);if(required.some(id=>!consent.has(id)))return false;if(checked.some(r=>own.media.some(old=>old.key===r.key)))fail('Duplicate media.');
    const removed=new Set(required);state.media=state.media.filter(r=>r.owner!==scope||!removed.has(r.asset.mediaId));state.media.push(...checked);
    if(kit){const safe=cleanKit(kit);for(const id of referenced({overviewArt:safe.appearance}))if(!state.media.some(r=>r.owner===scope&&r.asset.mediaId===id))fail('Kit media is missing.');if(own.kits.length>=100)fail('Remove a kit before saving another.');state.kits.push({key:key(safe.id),owner:scope,kit:safe});}bump(state);return true;
   },true);
   if(committed)return checked.map(r=>r.asset);
   }fail('Media storage changed. Try again.');
  }
  async function reserve(ids,token,{accountWriteLease}={}){if(!uuid.test(token))fail('Invalid media reservation.');const wanted=new Set(ids);if([...wanted].some(id=>typeof id!=='string'||!uuid.test(id)))fail('Kit media is missing.');const remote=packs?await read(s=>new Set([...wanted].filter(id=>!s.media.some(r=>r.asset.mediaId===id)))):new Set();await acquire(token);try{await db.transact(s=>{for(const id of wanted)if(!remote.has(id)&&!s.media.some(r=>r.owner===scope&&r.asset.mediaId===id))fail('Kit media is missing.');s.media=s.media.map(r=>r.owner===scope&&wanted.has(r.asset.mediaId)?{...r,holds:[...new Set([...(r.holds||[]),token])]}:r);bump(s);},true);if(remote.size)await packs.reserve(remote,token);}catch(error){await release(token,accountWriteLease===undefined?undefined:{accountWriteLease}).catch(()=>{});throw error;}}
  async function release(token,{collect=false,accountWriteLease}={}){try{const used=collect&&db.market?await currentUsed():null,results=await Promise.allSettled([db.transact(s=>{clearHold(s,token);if(used){for(const row of s.kits.filter(r=>r.owner===scope))for(const ref of referenced({overviewArt:row.kit.appearance}))used.add(ref);s.media=s.media.filter(r=>r.owner!==scope||used.has(r.asset.mediaId)||r.holds?.length);}},true),...(packs?[packs.release(token,accountWriteLease===undefined?undefined:{accountWriteLease})]:[])]),error=results.find(r=>r.status==='rejected');if(error)throw error.reason;}finally{holding.get(token)?.();holding.delete(token);}}
  async function saveKit(kit,options){const safe=cleanKit(kit),missing=packs?await read(s=>new Set([...referenced({overviewArt:safe.appearance})].filter(id=>!s.media.some(r=>r.asset.mediaId===id)))):new Set();if(!missing.size)return putMany([],{...options,kit:safe});const token=root.crypto.randomUUID();try{await packs.reserve(missing,token);const items=[];for(const id of missing){const item=await packs.get(id);if(!item)fail('Kit media is missing.');items.push(item);}return await putMany(items,{...options,kit:safe});}finally{await packs.release(token).catch(()=>{});}}
  async function listKits(){const local=await read(s=>s.kits.map(r=>r.kit)),ids=new Set(local.map(kit=>kit.id));return packs?local.concat((await packs.listKits()).filter(kit=>!ids.has(kit.id))):local;}
  async function removeKit(id,{mediaIds=[]}={}){if(!uuid.test(id)||!Array.isArray(mediaIds)||mediaIds.some(id=>!uuid.test(id)))fail('Invalid kit removal.');if(packs&&!await read(s=>s.kits.some(r=>r.kit.id===id)))return packs.removeKit(id);const used=await currentUsed();await db.transact(s=>{s.kits=s.kits.filter(r=>r.owner!==scope||r.kit.id!==id);for(const row of s.kits.filter(r=>r.owner===scope))for(const ref of referenced({overviewArt:row.kit.appearance}))used.add(ref);s.media=s.media.filter(r=>r.owner!==scope||!mediaIds.includes(r.asset.mediaId)||used.has(r.asset.mediaId)||r.holds?.length);bump(s);},true);}
  return {get,putMany,reserve,release,saveKit,listKits,removeKit,close(){db.close?.();packs?.close();}};
 }
 function render(asset,{kind='banner',className='',fit='contain',position='right',playback=false}={}){
  const a=cleanReference(asset,kind),style=`object-fit:${fit==='cover'?'cover':'contain'};object-position:${['left','center','right'].includes(position)?position:'right'}`,attrs=`class="ch-media ${E(className)}" data-ch-media="${a.mediaId}" data-rd-key="media-${a.mediaId}-${playback?'live':'still'}" style="${style}" aria-hidden="true"`;
  return a.kind==='video'&&playback?`<video ${attrs} muted loop playsinline preload="auto" tabindex="-1"></video>`:`<img ${attrs}${a.kind==='video'?' data-ch-poster="true"':''} alt="" decoding="async">`;
 }
 // Loading a saved banner only opens a blob URL. Decoding, palette extraction and encoding happen on import alone.
 function createController(container,store,{motion=()=>true,onError=()=>{}}={}){
  const doc=container.ownerDocument||root.document,reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)'),nodes=new Map();let dead=false;
  const hidden=()=>{if(doc.hidden||doc.visibilityState==='hidden')return true;for(let el=container;el;el=el.parentElement||el.getRootNode?.().host){if(el.hidden||el.getAttribute?.('aria-hidden')==='true')return true;const css=root.getComputedStyle?.(el);if(css&&(css.display==='none'||css.visibility==='hidden'))return true;}return false;};
  function update(){if(dead)return;for(const [node,entry]of nodes)if(node.tagName==='VIDEO'||entry.animated){const still=reduced?.matches||!motion(),pause=hidden()||!entry.inView||still||!entry.loaded;if(node.tagName==='VIDEO'){node.muted=node.defaultMuted=true;node.volume=0;if(pause){entry.playing=false;node.pause();if(still&&node.readyState>=1&&node.currentTime!==0)node.currentTime=0;}else if(!entry.playing){entry.playing=true;node.play()?.catch?.(()=>{entry.playing=false;});}}else if(entry.loaded){const url=pause?entry.stillURL:entry.liveURL;if(node.getAttribute('src')!==url)node.src=url;}}}
  const intersection=root.IntersectionObserver?new root.IntersectionObserver(entries=>{for(const e of entries){const n=nodes.get(e.target);if(n)n.inView=e.isIntersecting;}update();}):null;
  function drop(node,entry){intersection?.unobserve?.(node);if(node.tagName==='VIDEO'){node.pause();node.removeEventListener('volumechange',entry.silence);node.removeEventListener('loadeddata',entry.ready);node.removeEventListener('play',entry.guard);}node.removeAttribute('src');node.removeAttribute('poster');for(const url of entry.urls)root.URL.revokeObjectURL(url);nodes.delete(node);}
  function sync(){if(dead)return;const wanted=new Set(container.querySelectorAll('[data-ch-media]'));for(const [node,entry]of nodes)if(!wanted.has(node)||entry.id!==node.dataset.chMedia)drop(node,entry);
   for(const node of wanted){if(nodes.has(node))continue;const entry={id:node.dataset.chMedia,urls:[],inView:!intersection,loaded:false,playing:false};nodes.set(node,entry);intersection?.observe(node);
    if(node.tagName==='VIDEO'){node.muted=node.defaultMuted=node.loop=node.playsInline=true;node.volume=0;entry.silence=()=>{node.muted=true;node.volume=0;};entry.guard=()=>update();entry.ready=()=>{entry.loaded=true;update();};node.addEventListener('volumechange',entry.silence);node.addEventListener('loadeddata',entry.ready);node.addEventListener('play',entry.guard);}
    store.get(entry.id).then(r=>{if(dead||nodes.get(node)!==entry)return;if(!r)throw Error('Saved media is missing.');entry.animated=node.tagName!=='VIDEO'&&node.dataset.chPoster!=='true'&&r.asset?.animated===true;const b=node.dataset.chPoster==='true'?r.poster:r.blob;if(!b||entry.animated&&!r.poster)throw Error('Saved media is missing.');const url=root.URL.createObjectURL(b);entry.urls.push(url);entry.liveURL=url;if(node.tagName==='VIDEO'||entry.animated){if(r.poster){const poster=root.URL.createObjectURL(r.poster);entry.urls.push(poster);entry.stillURL=poster;if(node.tagName==='VIDEO')node.poster=poster;}}if(!entry.animated)node.src=url;if(node.tagName!=='VIDEO')entry.loaded=true;update();}).catch(error=>{if(!dead&&nodes.get(node)===entry){entry.loaded=false;node.removeAttribute('src');node.removeAttribute('poster');for(const url of entry.urls)root.URL.revokeObjectURL(url);entry.urls.length=0;onError(error);}});
   }scroll();
  }
  doc.addEventListener('visibilitychange',update);reduced?.addEventListener?.('change',update);
  const observer=root.MutationObserver?new root.MutationObserver(update):null;observer?.observe(container,{attributes:true,attributeFilter:['hidden','style','class','data-motion-style']});for(let el=container.parentElement||container.getRootNode?.().host;el;el=el.parentElement)observer?.observe(el,{attributes:true,attributeFilter:['hidden','style','class','aria-hidden']});
  const scroll=()=>{if(!intersection)for(const [node,e]of nodes){const b=node.getBoundingClientRect?.();e.inView=!!b&&b.bottom>0&&b.top<(root.innerHeight||10000);}update();};doc.addEventListener('scroll',scroll,true);root.addEventListener?.('resize',scroll);
  return {sync,update,destroy(){dead=true;intersection?.disconnect();observer?.disconnect();doc.removeEventListener('visibilitychange',update);doc.removeEventListener('scroll',scroll,true);root.removeEventListener?.('resize',scroll);reduced?.removeEventListener?.('change',update);for(const [node,e]of nodes)drop(node,e);}};
 }
 const api={limits,slots,inspectPortable,prepare,cleanReference,cleanMedia,encodeMedia,decodeMedia,cleanPackDocument,validateVideo,videoTiming,palette,referenced,planBudget,createStore,createPackStore,render,createController};root.ReserveMedia=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
