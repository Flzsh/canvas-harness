'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash,webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../extension/market-bridge.js'),'utf8'),BASE='https://flzsh.github.io/canvas-harness-packs/',UPDATE='Update Canvas Harness to add this',bytes=Buffer.from('{"feature":"math"}');
const entry=(patch={})=>({id:'known',name:'Known',kind:'feature',file:'files/known.json',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...patch});
async function click(catalog,id='known'){
 const sent=[],posts=[],requests=[],handlers=[],button={nodeType:1,getAttribute:()=>id,closest:()=>button},location={href:BASE+'index.html',origin:new URL(BASE).origin};
 const document={contains:value=>value===button,addEventListener:(type,fn)=>{if(type==='click')handlers.push(fn);}},window={postMessage:message=>posts.push(structuredClone(message))},chrome={runtime:{sendMessage:async message=>{sent.push(structuredClone(message));return message.type==='market-installed'?{ok:true,installed:[]}:{ok:true};}}};
 const fetch=async(url,options)=>{requests.push({url,options});const response=new Response(url.endsWith('/packs.json')?JSON.stringify(catalog):bytes);Object.defineProperty(response,'url',{value:url});return response;};
 vm.runInNewContext(source,{window,document,location,chrome,fetch,URL,TextDecoder,Uint8Array,crypto:webcrypto,btoa},{filename:'market-bridge.js'});assert.equal(handlers.length,1);await handlers[0]({isTrusted:true,target:button,preventDefault(){}});return {sent,posts,requests,installs:sent.filter(m=>m.type==='market-install')};
}
test('future catalogue kinds are skipped without checking their unsupported file or schema',async()=>{
 const future={id:'future',kind:'future-format',name:null,file:'https://outside.example/code.js',size:-1,sha256:'not a hash',future:{code:true}};
 for(const catalog of [[future,entry(),{...future,id:'next'}],{packs:[entry(),future]},[entry(),{...future,id:'known'}]]){const h=await click(catalog);assert.equal(h.installs.length,1);assert.deepEqual(h.installs[0].entry,entry());assert.equal(h.installs[0].bytes,bytes.toString('base64'));assert.equal(h.requests.length,2);assert.equal(h.posts.at(-1).state,'added');}
});
test('clicking a future kind reports the exact update instruction before a pack download',async()=>{
 for(const catalog of [[entry(),entry({id:'future',kind:'script'})],{packs:[{id:'future',kind:'future',file:'../unsafe'}]}]){const h=await click(catalog,'future');assert.equal(h.installs.length,0);assert.equal(h.requests.length,1);assert.deepEqual(h.posts.at(-1),{ch:'market',id:'future',state:'failed',reason:UPDATE});}
});
test('skipping future entries keeps every known catalogue validation and duplicate check',async()=>{
 const future={id:'future',kind:'new-kind'};
 for(const patch of [{file:'../escape.json'},{size:0},{size:40000001},{sha256:'0'.repeat(63)},{name:' bad'},{id:'__proto__'},{kind:null},{kind:42}]){const h=await click([future,entry(),entry({id:'bad',...patch})]);assert.equal(h.installs.length,0);assert.equal(h.requests.length,1);assert.equal(h.posts.at(-1).state,'failed');assert.notEqual(h.posts.at(-1).reason,UPDATE);}
 const duplicate=await click([future,entry(),entry()]);assert.equal(duplicate.installs.length,0);assert.equal(duplicate.posts.at(-1).reason,'Duplicate market pack id');
});
for(const kind of ['kit','course-art','feature','theme','pet','preset'])test('a future entry does not prevent a known '+kind+' install',async()=>{const h=await click([{id:'future',kind:'later'},entry({kind})]);assert.equal(h.installs.length,1);assert.equal(h.installs[0].entry.kind,kind);assert.equal(h.posts.at(-1).state,'added');});
