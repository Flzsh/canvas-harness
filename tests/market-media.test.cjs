'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{webcrypto}=require('node:crypto'),{read,settle}=require('./market-fixture.cjs');
const ref=()=>({mediaId:webcrypto.randomUUID(),name:'Image',type:'image/webp',kind:'image',width:100,height:50,palette:[]});
test('worker shares one offscreen creation across PDF and media callers',async()=>{
 const calls=[],env=vm.createContext({Blob,Uint8Array,atob,btoa,importScripts(){},chrome:{offscreen:{async hasDocument(){calls.push('has');return false;},async createDocument(value){calls.push(value);}},runtime:{async sendMessage(){return {ok:true,asset:ref(),data:btoa('clean')};}}}});vm.runInContext(read('media-reference.js'),env);vm.runInContext(read('media-store.js'),env);vm.runInContext(read('market-media.js'),env);
 await Promise.all([env.ReservePackMedia.ensure(),env.ReservePackMedia.prepare(new Blob(['input'],{type:'image/png'}),'banner','Image')]);assert.equal(calls.filter(c=>c==='has').length,1);assert.equal(calls.filter(c=>typeof c==='object').length,1);assert.deepEqual(JSON.parse(JSON.stringify(calls[1])),{url:'ai-offscreen.html',reasons:['WORKERS','BLOBS'],justification:'Read local PDFs and validate local pack media.'});
});
test('worker revalidates prepared media references, output bounds and poster types',async()=>{
 let response={ok:true,asset:ref(),data:btoa('clean')};const sent=[],env=vm.createContext({Blob,Uint8Array,atob,btoa,importScripts(){},chrome:{offscreen:{async hasDocument(){return true;}},runtime:{async sendMessage(value){sent.push(value);return response;}}}});vm.runInContext(read('media-reference.js'),env);vm.runInContext(read('media-store.js'),env);vm.runInContext(read('market-media.js'),env);
 const blob=new Blob(['input'],{type:'image/png'}),prepared=await env.ReservePackMedia.prepare(blob,'title','Image');assert.equal(await prepared.blob.text(),'clean');assert.equal(sent[0].data,btoa('input'));assert.equal(sent[0].target,'ch-pack-media');
 for(const bad of [{ok:false,error:'bad'},{ok:true,asset:{...ref(),width:2401},data:btoa('x')},{ok:true,asset:ref(),data:btoa('x'),poster:{type:'image/png',data:btoa('x')}},{ok:true,asset:ref(),data:'A'.repeat(4000004)}]){response=bad;await assert.rejects(env.ReservePackMedia.prepare(blob,'banner','Image'));}
 await assert.rejects(env.ReservePackMedia.prepare(new Blob([]),'banner','Image'));
});
test('offscreen media requests authenticate worker senders, use real media rules, and reject malformed media',async()=>{
 const listeners=[],runtime={id:'test',getURL:file=>'chrome-extension://test/'+file,onMessage:{addListener:fn=>listeners.push(fn)}},env=vm.createContext({Blob,URL,Uint8Array,crypto:webcrypto,atob,btoa,setTimeout,clearTimeout,chrome:{runtime},createImageBitmap:async()=>({width:1,height:1,close(){}}),document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8Array([50,80,90,255])})}),toBlob:fn=>fn(new Blob(['clean'],{type:'image/webp'}))})}});vm.runInContext(read('media-reference.js'),env);vm.runInContext(read('media-store.js'),env);vm.runInContext(read('market-media.js'),env);
 const message={target:'ch-pack-media',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',type:'image/png',slot:'banner',name:'Image'};
 const request=(sender,patch={})=>new Promise(resolve=>{const handled=listeners[0]({...message,...patch},sender,reply=>resolve({handled:true,reply}));if(handled!==true)resolve({handled});});
 for(const sender of [{id:'other'},{id:'test',tab:{id:1}},{id:'test',url:'chrome-extension://test/popup.html'}])assert.equal((await request(sender)).handled,undefined);
 const good=await request({id:'test',url:'chrome-extension://test/background.js'});assert.equal(good.reply.ok,true);assert.equal(atob(good.reply.data),'clean');assert.equal(good.reply.asset.type,'image/webp');
 for(const patch of [{type:'text/html'},{slot:'icon'},{data:''},{data:'!'},{data:'A'.repeat(40000004)}])assert.equal((await request({id:'test'},patch)).reply?.ok,false);
});

test('worker carries selected video timing and revalidates returned framing against the stored source',async()=>{
 const R=require('../extension/media-reference.js'),asset={...ref(),type:'video/mp4',kind:'video',duration:120},selection={loop:{start:65,end:80},still:72},sent=[];let response={ok:true,asset,data:btoa('source'),poster:{type:'image/png',data:btoa('poster')},framing:selection};
 const env=vm.createContext({Blob,Uint8Array,atob,btoa,importScripts(){},ReserveMediaReference:R,chrome:{offscreen:{async hasDocument(){return true;}},runtime:{async sendMessage(value){sent.push(value);return response;}}}});vm.runInContext(read('market-media.js'),env);
 const prepared=await env.ReservePackMedia.prepare(new Blob(['input'],{type:'video/mp4'}),'background','Clip',selection);assert.deepEqual(JSON.parse(JSON.stringify(sent[0].options)),selection);assert.deepEqual(JSON.parse(JSON.stringify(prepared.framing)),selection);assert.equal(await prepared.poster.text(),'poster');
 for(const framing of [{loop:{start:0,end:61}},{still:121},{loop:{start:80,end:65}},{url:'https://outside.test'}]){response={...response,framing};await assert.rejects(env.ReservePackMedia.prepare(new Blob(['input'],{type:'video/mp4'}),'card','Clip',selection));}
 const before=sent.length;await assert.rejects(env.ReservePackMedia.prepare(new Blob(['input'],{type:'video/mp4'}),'banner','Clip',{loop:{start:0,end:61}}));assert.equal(sent.length,before);
});
