/* Canvas Harness focus room backdrop (focus-scene.html). Draws the built-in scenes, shows the student's own photo or
   video, and plays the room's sounds: white, pink and brown noise and rain, all made here, plus a sound file of the
   student's own. Their files live in this extension's storage (IndexedDB) on this device. Only the focus room on a
   supported Canvas page can talk to it, and it only answers with what it stored. */
(function(){
 'use strict';
 const Model=globalThis.ReserveFocusRoomModel;
 const $=id=>document.getElementById(id);
 const canvas=$('scene'),photo=$('photo'),video=$('video'),own=$('own');
 // The page that framed this one. Inside the extension it must be a supported Canvas site; a local preview may use
 // its own origin (http://localhost or 127.0.0.1) and nothing else.
 const parentOrigin=(location.ancestorOrigins&&location.ancestorOrigins[0])||'';
 const LOCAL=/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
 const allowed=origin=>!!origin&&origin===parentOrigin&&(globalThis.ReserveSite?.supported?.(origin)||LOCAL.test(location.origin)&&LOCAL.test(origin));
 const tell=message=>{if(parentOrigin&&window.parent!==window)window.parent.postMessage({type:'reserve-focus-scene',...message},parentOrigin);};

 /* ---- the student's own files ---- */
 const DB='reserve-focus-room',STORE='media';
 let dbp=null;
 function db(){
  return dbp||(dbp=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));
 }
 async function run(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,mode),r=fn(t.objectStore(STORE));t.oncomplete=()=>resolve(r?.result);t.onerror=t.onabort=()=>reject(t.error||Error('Storage failed'));});}
 const read=kind=>run('readonly',s=>s.get(kind));
 const write=(kind,file)=>run('readwrite',s=>s.put({blob:file,name:String(file.name||kind).slice(0,120),type:file.type,size:file.size,at:Date.now()},kind));
 const remove=kind=>run('readwrite',s=>s.delete(kind));
 const urls={};
 async function urlFor(kind){
  if(urls[kind])return urls[kind];
  const rec=await read(kind).catch(()=>null);
  if(!rec?.blob){tell({op:'missing',kind});return '';}
  return urls[kind]=URL.createObjectURL(rec.blob);
 }
 function forget(kind){if(urls[kind]){URL.revokeObjectURL(urls[kind]);delete urls[kind];}}

 /* ---- scenes ---- */
 const renderer=globalThis.ReserveFocusSceneRenderer.create(canvas);
 let scene='plain',theme='light',still=false;
 const draw=()=>renderer.show({scene,theme,still});
 async function show(next){
  scene=next;
  const media=next==='photo'||next==='video'?next:'';
  canvas.hidden=!renderer.supports(next);photo.hidden=media!=='photo';video.hidden=media!=='video';
  if(media!=='video'){video.pause();video.removeAttribute('src');video.load();}
  if(media){
   const url=await urlFor(media);if(scene!==next)return;
   if(!url){canvas.hidden=false;scene='plain';draw();return;}
   if(media==='photo')photo.src=url;
   else{if(video.src!==url)video.src=url;if(still)video.pause();else video.play().catch(()=>{});}
  }else photo.removeAttribute('src');
  draw();
 }

 /* ---- sound: noise made here, plus the student's own file ---- */
 let ac=null,master=null,soundRequest=0;const layers={};
 function buffer(kind){
  const len=ac.sampleRate*4,b=ac.createBuffer(1,len,ac.sampleRate),d=b.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
  for(let i=0;i<len;i++){
   const w=Math.random()*2-1;
   if(kind==='pink'){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926;}
   else if(kind==='brown'){last=(last+.02*w)/1.02;d[i]=last*3.5;}
   else d[i]=w*.4;
  }
  return b;
 }
 function audio(){
  if(ac)return ac;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  ac=new AC();master=ac.createGain();master.gain.value=0;master.connect(ac.destination);
  for(const kind of ['white','pink','brown','rain']){
   const src=ac.createBufferSource();src.buffer=buffer(kind==='rain'?'white':kind);src.loop=true;
   const gain=ac.createGain();gain.gain.value=0;let tail=src;
   if(kind==='rain'){const hp=ac.createBiquadFilter();hp.type='highpass';hp.frequency.value=900;const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=6500;
    // a slow swell before the level, so the rain comes and goes a little and is silent at zero
    const swell=ac.createGain(),lfo=ac.createOscillator(),depth=ac.createGain();swell.gain.value=.8;lfo.frequency.value=.08;depth.gain.value=.2;lfo.connect(depth);depth.connect(swell.gain);lfo.start();
    src.connect(hp);hp.connect(lp);lp.connect(swell);tail=swell;}
   tail.connect(gain);gain.connect(master);src.start();layers[kind]=gain;
  }
  const ownGain=ac.createGain();ownGain.gain.value=0;ac.createMediaElementSource(own).connect(ownGain);ownGain.connect(master);layers.own=ownGain;
  return ac;
 }
 const LEVEL={white:.35,pink:.6,brown:.9,rain:.7,own:1};
 async function sound(s){
  const request=++soundRequest;
  const on=!!s?.on&&Model.SOUNDS.some(k=>s[k]>0);
  if(!on){if(ac){master.gain.setTargetAtTime(0,ac.currentTime,.25);setTimeout(()=>{if(master.gain.value<.01){ac.suspend().catch(()=>{});own.pause();}},1200);}return;}
  if(!audio())return;
  await ac.resume().catch(()=>{});
  if(request!==soundRequest)return;
  for(const k of Model.SOUNDS)layers[k].gain.setTargetAtTime((Number(s[k])||0)*LEVEL[k],ac.currentTime,.3);
  master.gain.setTargetAtTime(Math.max(0,Math.min(1,Number(s.volume)||0)),ac.currentTime,.3);
  if(s.own>0){const url=await urlFor('audio');if(request!==soundRequest)return;if(url){if(own.src!==url)own.src=url;own.play().catch(()=>{});}}else own.pause();
 }

 /* ---- messages from the focus room ---- */
 window.addEventListener('message',async event=>{
  if(event.source!==window.parent||!allowed(event.origin))return;
  const m=event.data;if(!m||m.type!=='reserve-focus-room')return;
  if(m.op==='scene'){theme=m.theme==='dark'?'dark':'light';still=!!m.still;await show(Model.SCENES.includes(m.scene)?m.scene:'plain');}
  else if(m.op==='sound')sound(m.sound);
  else if(m.op==='store'&&Model.MEDIA[m.kind]&&m.file instanceof Blob){
   const problem=Model.checkMedia(m.kind,m.file);if(problem){tell({op:'error',kind:m.kind,message:problem});return;}
   try{await write(m.kind,m.file);forget(m.kind);tell({op:'stored',kind:m.kind,meta:{name:String(m.file.name||m.kind).slice(0,120),type:m.file.type,size:m.file.size}});
    if(scene===m.kind)show(scene);}
   catch{tell({op:'error',kind:m.kind,message:'The file could not be saved on this device.'});}
  }
  else if(m.op==='remove'&&Model.MEDIA[m.kind]){await remove(m.kind).catch(()=>{});forget(m.kind);if(m.kind==='audio')own.removeAttribute('src');if(scene===m.kind)show('plain');tell({op:'removed',kind:m.kind});}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){video.pause();}else{if(!video.hidden&&!still)video.play().catch(()=>{});draw();}});
 tell({op:'ready'});
})();
