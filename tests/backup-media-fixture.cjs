'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash,webcrypto}=require('node:crypto');
const Refs=require('../extension/media-reference.js'),Art=require('../extension/custom-art.js');
const owner={origin:'https://school.instructure.com',accountId:'7'},scope=value=>JSON.stringify([value.origin,value.accountId]);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),clone=value=>structuredClone(value),plain=value=>JSON.parse(JSON.stringify(value));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk94AAAAASUVORK5CYII=','base64');
const asset=(n=1,extra={})=>({mediaId:id(n),name:'Pixel.png',type:'image/png',kind:'image',width:1,height:1,palette:[],...extra});
const wire=(bytes=png,type='image/png',digest=true)=>({type,size:bytes.length,data:Buffer.from(bytes).toString('base64'),...(digest?{sha256:createHash('sha256').update(bytes).digest('hex')}:{})});
const row=(n=1,extra={})=>({asset:asset(n),bytes:wire(),...extra});
const payload=(assets=[row()],kits=[])=>({version:1,assets,kits});
const kit=(n=100,appearance={})=>({id:id(n),name:'My kit '+n,appearance,accent:'#123abc',font:'serif',bannerSize:'large'});
const settings=ref=>({overviewArt:{bannerArt:ref},coursePrefs:{'12':{name:'Synthetic course',color:'#123abc'}}});
function localRow(ref=asset(),bytes=png,poster){return {asset:ref,blob:new Blob([bytes],{type:ref.type}),...(poster?{poster:new Blob([poster],{type:'image/png'})}:{})};}
function stored(row,who=owner){return {...row,key:scope(who)+':'+row.asset.mediaId,owner:scope(who),createdAt:1,holds:[id(990)]};}
function localStore(rows=[],kits=[],{enumerate=true,listing}={}){
 const calls=[],api={async listKits(){calls.push(['kits']);return clone(kits);},async get(key){calls.push(['get',key]);return clone(rows.find(row=>row.asset.mediaId===key)||null);},close(){throw Error('Borrowed localStore must not be closed');}};
 if(enumerate)api.listAssets=async()=>{calls.push(['assets']);return clone(listing??rows);};return {api,calls};
}
function shared(rows=[],kits=[],{legacy=false,digests=false,who=owner,missing}={}){
 const base='reserve:market-media:'+scope(who),values=new Map(),reads=[];
 const entries=rows.map(r=>({key:scope(who)+':'+r.asset.mediaId,owner:scope(who),asset:clone(r.asset),createdAt:1,holds:[id(990)],blob:legacy?{...r.bytes}:{type:r.bytes.type,size:r.bytes.size},...(r.poster?{poster:legacy?{...r.poster}:{type:r.poster.type,size:r.poster.size}}:{})}));
 if(!digests)for(const entry of entries)if(legacy){delete entry.blob.sha256;if(entry.poster)delete entry.poster.sha256;}
 const index={version:legacy?1:2,media:entries,kits:kits.map(k=>({key:scope(who)+':'+k.id,owner:scope(who),kit:clone(k)})),meta:[{key:scope(who),owner:scope(who),revision:id(991)}]};
 values.set(base+(legacy?'':':index'),index);
 if(!legacy)for(const r of rows){const blob={...r.bytes},poster=r.poster?{...r.poster}:undefined;if(!digests){delete blob.sha256;if(poster)delete poster.sha256;}values.set(base+':asset:'+r.asset.mediaId,{blob,...(poster?{poster}:{})});}
 const adapter={async read(key){reads.push(key);return values.has(key)?clone(values.get(key)):missing;},write(){throw Error('Backup must not write');},remove(){throw Error('Backup must not remove');}};
 return {adapter,values,reads,index,base};
}
function environment(extra={}){
 const env=vm.createContext({Blob,URL,TextEncoder,Uint8Array,crypto:webcrypto,btoa:value=>Buffer.from(value,'latin1').toString('base64'),ReserveMediaReference:Refs,ReserveCustomArt:Art,...extra});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/backup-media.js'),'utf8'),env,{filename:'backup-media.js'});return {env,api:env.ReserveBackupMedia};
}
function indexed(rows=[],kits=[],{listed=true,raceMissing=false,leakForeign=false,readError=false}={}){
 const calls=[];let closes=0,upgradeAborts=0;
 const api={async databases(){calls.push(['databases']);return listed?[{name:'reserve-media-v1',version:2}]:[];},open(...args){calls.push(['open',...args]);const request={};
  const db={objectStoreNames:{contains:name=>['media','kits','meta'].includes(name)},close(){closes++;},transaction(names,mode){calls.push(['transaction',names,mode]);let done=0;const tx={abort(){queueMicrotask(()=>tx.onabort?.());},objectStore(name){return {index(index){calls.push(['index',name,index]);return {getAll(who){calls.push(['getAll',name,who]);const read={};queueMicrotask(()=>{if(readError){read.onerror?.();tx.onerror?.();return;}const values=name==='media'?rows:kits;read.result=clone(leakForeign?values:values.filter(row=>row.owner===who));read.onsuccess?.();if(++done===names.length)queueMicrotask(()=>tx.oncomplete?.());});return read;}};}};}};return tx;}};
  request.result=db;request.transaction={abort(){upgradeAborts++;queueMicrotask(()=>request.onerror?.());}};queueMicrotask(()=>{if(raceMissing)request.onupgradeneeded?.();else request.onsuccess?.();});return request;}};
 return {api,calls,get closes(){return closes;},get upgradeAborts(){return upgradeAborts;}};
}
module.exports={owner,scope,id,clone,plain,png,asset,wire,row,payload,kit,settings,localRow,stored,localStore,shared,environment,indexed};
