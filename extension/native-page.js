/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function(root){
 'use strict';
 const KEY='folio:native-appearance',VERSION_KEY='reserveNativeAppearanceV';
 const attributes=['data-reserve-native-theme','data-reserve-reading-width','data-reserve-native-text','data-reserve-native-accent'];
 function browserAdapter(){return {
  // The first read after 2.15 moves an untouched Forest to Clay once and saves version 2.
  read:async()=>{
   const local=root.chrome.storage.local,value=(await local.get(KEY))[KEY]??null,version=(await local.get(VERSION_KEY))[VERSION_KEY];
   const step=root.ReserveNativeAppearance?.migrate?.(value,version);
   if(!step||step.version===version)return value;
   await local.set(step.changed?{[KEY]:step.value,[VERSION_KEY]:step.version}:{[VERSION_KEY]:step.version});
   return step.value;
  },
  write:value=>root.chrome.storage.local.set({[KEY]:value}),
  subscribe:fn=>{const listener=(changes,area)=>{if(area==='local'&&Object.hasOwn(changes,KEY))fn(changes[KEY].newValue??null);};root.chrome.storage.onChanged.addListener(listener);return()=>root.chrome.storage.onChanged.removeListener(listener);}
 };}
 function create({document:doc=root.document,adapter=browserAdapter(),media=root.matchMedia('(prefers-color-scheme: dark)'),styleURL=root.chrome?.runtime?.getURL('native-page.css'),onError=()=>{}}={}){
  let dead=false,revision=0,link,loading,cancelLoad;
  const html=doc.documentElement,previous=new Map(attributes.map(name=>[name,html.getAttribute(name)]));
  function restore(){for(const [name,value]of previous){if(value===null)html.removeAttribute(name);else html.setAttribute(name,value);}}
  function styles(){
   if(loading)return loading;
   loading=new Promise((resolve,reject)=>{
    link=doc.createElement('link');link.rel='stylesheet';link.href=styleURL;
    const finish=error=>{clearTimeout(timeout);link.onload=null;link.onerror=null;cancelLoad=null;error?reject(error):resolve();};
    const timeout=setTimeout(()=>finish(Error('Canvas appearance took too long to load. Your original page remains available.')),8000);
    cancelLoad=()=>finish(Error('Appearance was closed.'));
    link.onload=()=>finish();link.onerror=()=>finish(Error('Canvas appearance could not load. Your original page remains available.'));doc.head.append(link);
   }).catch(error=>{link?.remove();link=null;loading=null;throw error;});return loading;
  }
  const controller=root.ReserveNativeAppearance.create({adapter,media,onError,apply:(prefs,theme)=>{
   const version=++revision;if(theme==='original'){restore();return;}
   styles().then(()=>{if(dead||version!==revision)return;html.setAttribute(attributes[0],theme);html.setAttribute(attributes[1],prefs.readingWidth);html.setAttribute(attributes[2],prefs.textSize);html.setAttribute(attributes[3],prefs.accent);}).catch(error=>{if(dead||version!==revision)return;restore();onError(error);});
  }});
  return {start:()=>controller.start(),get:()=>controller.get(),set:value=>controller.set(value),subscribe:fn=>controller.subscribe(fn),destroy(){if(dead)return;dead=true;revision++;controller.destroy();restore();cancelLoad?.();link?.remove();}};
 }
 root.ReserveNativePage={create,browserAdapter,KEY,VERSION_KEY};if(typeof module==='object'&&module.exports)module.exports=root.ReserveNativePage;
})(globalThis);
