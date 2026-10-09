'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {dpapi}=require('./process.cjs');
const {fail}=require('./errors.cjs');
async function read(file){try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>262144)throw fail('STORAGE','Invalid companion storage file.');return await fs.readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function atomic(file,bytes){
 const tmp=file+'.'+crypto.randomBytes(12).toString('hex')+'.tmp';let handle;
 try{handle=await fs.open(tmp,'wx',0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;await fs.rename(tmp,file);}
 finally{await handle?.close().catch(()=>{});await fs.unlink(tmp).catch(()=>{});}
}
class Store {
 static async open({dir,platform=process.platform,crypt=dpapi}){
  if(!path.isAbsolute(dir))throw fail('STORAGE','Companion storage needs an absolute directory.');await fs.mkdir(dir,{recursive:true,mode:0o700});
  const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw fail('STORAGE','Companion storage must be a private directory.');if(platform!=='win32')await fs.chmod(dir,0o700);
  const store=new Store(dir,crypt);const meta=await read(store.metaPath);
  if(meta){try{store.metadata=JSON.parse(meta.toString('utf8'));}catch{throw fail('STORAGE','Companion registration metadata is damaged.');}}
  else await store.saveMetadata({hostId:'urn:uuid:'+crypto.randomUUID()});
  store.validateMetadata(store.metadata);
  if(platform==='win32'){
   const encrypted=await read(store.tokenPath);
   // If DPAPI is unavailable, remain explicitly memory-only. Never write a plaintext fallback.
   try{if(encrypted)store.tokens=JSON.parse((await crypt('Unprotect',encrypted)).toString('utf8'));else await crypt('Protect',Buffer.from('Canvas Harness storage availability probe'));store.mode='windows-dpapi';}
   catch{store.mode='memory-only';store.tokens=null;store.unreadableTokens=!!encrypted;store.warning='Windows protected storage is unavailable. Sign-in is memory-only for this connection.';}
  }else{
   store.unreadableTokens=!!await read(store.tokenPath);
   if(store.unreadableTokens)store.warning='Memory-only storage cannot read the previous encrypted session. Disconnect the previous session in ChatGPT Settings.';
  }
  if(store.tokens){const t=store.tokens;if(typeof t.accessToken!=='string'||typeof t.refreshToken!=='string'||t.clientId!==store.metadata.registration?.clientId||t.subject!==store.metadata.registration?.subject||!Number.isFinite(t.expiresAt))throw fail('STORAGE','Saved authorization does not match the registration.');}
  return store;
 }
 constructor(dir,crypt){this.dir=dir;this.crypt=crypt;this.metaPath=path.join(dir,'registration.json');this.tokenPath=path.join(dir,'tokens.dpapi');this.metadata=null;this.tokens=null;this.mode='memory-only';this.unreadableTokens=false;}
 validateMetadata(value){
  if(!value||Object.keys(value).some(k=>!['hostId','registration'].includes(k))||typeof value.hostId!=='string'||!/^urn:uuid:[0-9a-f-]{36}$/i.test(value.hostId))throw fail('STORAGE','Invalid companion host metadata.');
  if(value.registration){const r=value.registration;if(Object.keys(r).some(k=>!['clientId','subject','label'].includes(k))||typeof r.clientId!=='string'||r.clientId==='dynamic_agent_client'||!/^[A-Za-z0-9._:-]{1,256}$/.test(r.clientId)||r.subject!==undefined&&(typeof r.subject!=='string'||r.subject.length>512)||r.label!==undefined&&(typeof r.label!=='string'||r.label.length>254))throw fail('STORAGE','Invalid companion registration.');}
 }
 async saveMetadata(value){this.validateMetadata(value);await atomic(this.metaPath,JSON.stringify(value));this.metadata=value;}
 async saveTokens(value){const data=Buffer.from(JSON.stringify(value));if(data.length>131072)throw fail('STORAGE','Credential record exceeds its limit.');
  if(this.mode==='windows-dpapi'){const encrypted=await this.crypt('Protect',data);await atomic(this.tokenPath,encrypted);}
  else {const obsolete=this.unreadableTokens;await fs.unlink(this.tokenPath).catch(error=>{if(error.code!=='ENOENT')throw fail('STORAGE','Could not discard the previous encrypted session. Sign out before starting a new session.');});this.unreadableTokens=false;if(obsolete)this.warning+=' An older session could not be revoked; disconnect it in ChatGPT Settings.';}
  this.tokens=value;
 }
 async clearTokens(){this.tokens=null;this.unreadableTokens=false;await fs.unlink(this.tokenPath).catch(error=>{if(error.code!=='ENOENT')throw fail('STORAGE','Could not remove saved authorization. Close other companion processes and sign out again.');});}
}
async function acquireLock(dir){
 await fs.mkdir(dir,{recursive:true,mode:0o700});const file=path.join(dir,'runtime.lock'),record=JSON.stringify({pid:process.pid,nonce:crypto.randomUUID()});let handle;
 try{handle=await fs.open(file,'wx',0o600);await handle.writeFile(record);await handle.close();}
 catch(error){await handle?.close().catch(()=>{});if(error.code==='EEXIST')throw fail('HOST_BUSY','Another companion connection owns this profile. Close it before reconnecting; see the setup guide for stale-lock recovery.');throw fail('STORAGE','Cannot lock the companion profile.');}
 return async()=>{try{if((await fs.readFile(file,'utf8'))===record)await fs.unlink(file);}catch{}};
}
module.exports={Store,acquireLock};
