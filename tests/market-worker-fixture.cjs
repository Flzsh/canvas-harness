'use strict';
const vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto'),{read}=require('./market-fixture.cjs');
const plain=value=>JSON.parse(JSON.stringify(value)),key='reserve:v1:https://school.instructure.com:7';
function event(){const listeners=[];return {addListener:fn=>listeners.push(fn),removeListener:fn=>listeners.splice(listeners.indexOf(fn),1),emit:(...args)=>listeners.map(fn=>fn(...args))};}
function worker({indexedDB,saved={}}={}){
 const data={'reserve:features':{preset:'custom',custom:['math']},[key]:{version:1,settings:{coursePrefs:{},overviewArt:{}}},...structuredClone(saved)},runtime={id:'test',getManifest:()=>JSON.parse(read('manifest.json')),getURL:file=>'chrome-extension://test/'+file,onMessage:event(),onInstalled:event(),onStartup:event(),onConnect:event()},onChanged=event();let media={media:[],kits:[],meta:[]},env;
 const local={async get(keys){return structuredClone(keys===null?data:Object.fromEntries([].concat(keys).filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]])));},async set(values){const changes={};for(const [k,v]of Object.entries(values)){changes[k]={oldValue:data[k],newValue:structuredClone(v)};data[k]=structuredClone(v);}onChanged.emit(changes,'local');},async remove(keys){for(const name of [].concat(keys))delete data[name];}};
 const chrome={runtime,storage:{local,onChanged},tabs:{onRemoved:event()},permissions:{contains:async()=>true,onAdded:event(),onRemoved:event()},scripting:{getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},updateContentScripts:async()=>{}}};
 env=vm.createContext({indexedDB,chrome,URL,Blob,ArrayBuffer,Uint8Array,TextEncoder,TextDecoder,crypto:webcrypto,structuredClone,atob,btoa,setTimeout,clearTimeout,AbortSignal,console,fetch:async url=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>String(url).includes('/profile')?{id:'7'}:[{id:'10',name:'Biology'}]})});
 require('./market-fixture.cjs').loadMarketSite(env);
 env.importScripts=(...files)=>files.forEach(file=>vm.runInContext(read(file),env,{filename:file}));vm.runInContext(read('background.js'),env,{filename:'background.js'});
 const market={id:'test',frameId:0,tab:{id:4},url:'https://flzsh.github.io/canvas-harness-packs/'},popup={id:'test',url:'chrome-extension://test/popup.html'};
 const request=(message,sender=market)=>new Promise(resolve=>{const handlers=runtime.onMessage.emit(message,sender,result=>resolve(plain(result)));if(!handlers.includes(true))resolve(undefined);});
 const client=vm.createContext({chrome:{storage:{local},runtime:{sendMessage:message=>request(message,popup)}}});vm.runInContext(read('packs.js'),client,{filename:'packs.js'});
 return {data,env,request,chrome,local,popup,client:client.ReservePacks,get media(){return data['reserve:market-media:'+JSON.stringify(['https://school.instructure.com','7'])+':index']||{media:[],kits:[]};}};
}
function message(kind,value,id='one'){const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value));return {type:'market-install',entry:{id,name:'Pack',kind,file:id+(kind==='kit'?'.chkit':kind==='course-art'?'.chpack':'.json'),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},bytes:bytes.toString('base64')};}
function featureClient(h,sender=h.popup){const client=vm.createContext({URL,chrome:{storage:h.chrome.storage,runtime:{id:'test',sendMessage:message=>h.request(message,sender)}}});vm.runInContext(read('features.js'),client,{filename:'features.js'});return client.ReserveFeatures;}
module.exports={event,worker,message,featureClient};
