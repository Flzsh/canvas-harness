"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const extension=path.join(__dirname,'../extension');
const event=()=>({listeners:new Set(),addListener(fn){this.listeners.add(fn);},removeListener(fn){this.listeners.delete(fn);}});

test('real public worker installs account serialization for Canvas and a permitted custom school',async()=>{
 const custom='https://canvas.example.edu',data={'reserve:sites':[custom]},writes=[];
 const runtime={id:'test',onMessage:event(),onConnect:event(),getURL:file=>'chrome-extension://test/'+file};
 const local={get:async key=>({[key]:structuredClone(data[key])}),set:async values=>{
  for(const [key,value]of Object.entries(values)){writes.push(key);data[key]=structuredClone(value);}
 }};
 const context=vm.createContext({URL,Intl,TextEncoder,structuredClone,AbortController,setTimeout,clearTimeout,
  chrome:{runtime,storage:{local},permissions:{contains:async()=>true}}});
 context.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(extension,file),'utf8'),context,{filename:file});};
 vm.runInContext(fs.readFileSync(path.join(extension,'background.js'),'utf8'),context,{filename:'background.js'});
 const request=(message,origin)=>new Promise(resolve=>{
  const sender={id:'test',frameId:0,tab:{id:1},url:origin+'/dashboard'};
  let handled=false;
  for(const listener of runtime.onMessage.listeners)if(listener(message,sender,resolve)===true)handled=true;
  if(!handled)resolve(undefined);
 });
 for(const origin of ['https://school.instructure.com',custom]){
  const key='reserve:v1:'+origin+':7',value={tasks:{'1':{notes:'Keep this note'}}};
  const first=await request({target:'ch-account-write',key,value},origin);
  assert.equal(first?.ok,true,'the real worker handles the account request');
  const stale=await request({target:'ch-account-write',key,value:{tasks:{}}},origin);
  assert.equal(stale?.conflict,true);assert.equal(data[key].tasks['1'].notes,'Keep this note');
 }
 assert.equal(writes.length,2);
});
