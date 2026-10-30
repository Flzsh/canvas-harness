/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// Device appearance only. Extension pages never read an account's personal data.
// Every page reads the record directly, but changes go through the background worker
// (serve), which applies them one at a time: two pages saving at once cannot undo each other.
(function(root){
 'use strict';
 const KEY='reserve:appearance',TARGET='ch-appearance',FIELDS=['theme','motion','nightArt','pet','sceneTheme'],SCENES=['','starry','sea','stars','blueprint'],clone=value=>structuredClone(value);
 const defaults=()=>({theme:'light',motion:'gentle',nightArt:0,pet:true,sceneTheme:''});
 let pending=Promise.resolve();
 function queue(fn){const next=pending.catch(()=>{}).then(fn);pending=next;return next;}
 const valid=(key,item)=>
  key==='theme'?
   ['light','dark'].includes(item):
   key==='motion'?['gentle','still','off'].includes(item):key==='nightArt'?Number.isInteger(item)&&item>=0&&item<=100:key==='sceneTheme'?SCENES.includes(item):key==='pet'&&typeof item==='boolean';
 function patch(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose a valid preference.');
  const out={};
  for(const [key,item]of Object.entries(value)){if(!valid(key,item))throw Error('Invalid '+key+' preference.');out[key]=item;}
  return out;
 }
 function fromData(data){
  return {
   theme:data.settings?.theme==='dark'?'dark':'light',
   motion:data.settings?.motion||'gentle',
   nightArt:data.settings?.nightArt??0,
   pet:data.pet?.enabled!==false,
   sceneTheme:SCENES.includes(data.settings?.sceneTheme)?data.settings.sceneTheme:''
  };
 }
 function apply(data,value){
  Object.assign(data.settings,{theme:value.theme,motion:value.motion,nightArt:value.nightArt,sceneTheme:value.sceneTheme});
  data.pet.enabled=value.pet;
  return data;
 }
 function personal(data){const out=clone(data);for(const key of ['theme','motion','nightArt','sceneTheme'])delete out.settings[key];delete out.pet.enabled;return out;}
 // Stored values: keep each valid field, fall back to the default for anything damaged.
 function clean(value){const out=defaults();if(value&&typeof value==='object')for(const key of FIELDS)if(valid(key,value[key]))out[key]=value[key];return out;}
 // A record saved before the first dashboard visit after an update lists the fields chosen
 // so far ("chosen"); the other fields still come from the account's older settings.
 const chosenOf=saved=>saved&&typeof saved==='object'&&Array.isArray(saved.chosen)?saved.chosen.filter(key=>FIELDS.includes(key)):null;
 function seedHere(adapter,older){
  return queue(async()=>{
   const latest=await adapter.read(KEY),chosen=chosenOf(latest);
   if(latest!=null&&!chosen)return clean(latest);
   const kept=clean(latest),value=clean(older);for(const key of chosen||[])value[key]=kept[key];
   await adapter.write(KEY,value);return value;
  });
 }
 function writeHere(adapter,changes){
  return queue(async()=>{
   const saved=await adapter.read(KEY),chosen=saved==null?[]:chosenOf(saved),next={...clean(saved),...changes};
   await adapter.write(KEY,chosen?{...next,chosen:[...new Set([...chosen,...Object.keys(changes)])]}:next);return next;
  });
 }
 // Pages and content scripts ask the worker; if it cannot answer, the change is applied here.
 function messenger(){
  const runtime=root.chrome?.runtime;
  if(typeof runtime?.sendMessage!=='function'||!runtime.id||typeof root.importScripts==='function')return null;
  return async(request,adapter)=>{
   let reply;try{reply=await runtime.sendMessage({target:TARGET,...request});}catch{}
   if(reply?.ok===true)return clean(reply.value);
   if(reply?.ok===false)throw Error(reply.error||'Could not save.');
   return request.op==='seed'?seedHere(adapter,request.value):writeHere(adapter,patch(request.value));
  };
 }
 async function read(adapter,seed){
  const saved=await adapter.read(KEY);
  if(!seed||(saved!=null&&!chosenOf(saved)))return clean(saved);
  // Recheck where writes are serialized, so migration cannot replace a choice.
  const older=fromData(seed);
  return adapter.remote?adapter.remote({op:'seed',value:older},adapter):seedHere(adapter,older);
 }
 function write(adapter,value){
  const changes=patch(value);
  return adapter.remote?adapter.remote({op:'write',value:changes},adapter):writeHere(adapter,changes);
 }
 // Background worker only.
 function serve({runtime=root.chrome?.runtime,local=root.chrome?.storage?.local}={}){
  if(!runtime?.onMessage||!local)return;
  const adapter={read:async key=>(await local.get(key))[key],write:(key,value)=>local.set({[key]:value})};
  runtime.onMessage.addListener((message,sender,reply)=>{
   if(message?.target!==TARGET||sender?.id!==runtime.id)return;
   (async()=>{
    if(message.op==='seed')return seedHere(adapter,clean(message.value));
    if(message.op==='write')return writeHere(adapter,patch(message.value));
    throw Error('Unknown appearance request.');
   })().then(value=>reply({ok:true,value}),error=>reply({ok:false,error:String(error?.message||error)}));
   return true;
  });
 }
 function create({local=root.chrome.storage.local,events=root.chrome.storage.onChanged,remote=messenger()}={}){
  const adapter={read:async key=>(await local.get(key))[key],write:(key,value)=>local.set({[key]:value}),remote},listeners=new Set();
  let current=defaults(),dead=false,revision=0;
  async function load(){
   const turn=++revision,value=await read(adapter);
   if(!dead&&turn===revision){current=value;for(const fn of listeners){try{fn(clone(current));}catch{}}}
   return clone(current);
  }
  async function set(value){await write(adapter,value);return load();}
  const changed=(changes,area)=>{if(area==='local'&&changes[KEY])load().catch(()=>{});};
  events?.addListener(changed);
  return {load,set,get:()=>clone(current),subscribe:fn=>{
   listeners.add(fn);
   return()=>listeners.delete(fn);
  },destroy(){dead=true;revision++;listeners.clear();events?.removeListener(changed);}};
 }
 const api={KEY,run:queue,create,patch,fromData,apply,personal,read,write,serve,messenger};root.ReservePagePreferences=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
