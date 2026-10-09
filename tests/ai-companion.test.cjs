'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const modulePath=path.join(__dirname,'../companion/lib/protocol.cjs');

test('native framing handles fragmented UTF-8 and concatenated messages',()=>{
 const {Decoder,encode}=require(modulePath);const got=[];const d=new Decoder(x=>got.push(x));
 const bytes=Buffer.concat([encode({id:'one',op:'status'}),encode({id:'two',text:'π🦊'})]);
 for(const byte of bytes)d.push(Buffer.from([byte]));d.end();
 assert.deepEqual(got,[{id:'one',op:'status'},{id:'two',text:'π🦊'}]);
});

test('native framing refuses oversized, zero, truncated and invalid UTF-8 frames',()=>{
 const {Decoder,MAX_IN}=require(modulePath);for(const n of [0,MAX_IN+1,0xffffffff]){
 const d=new Decoder(()=>assert.fail('must not deliver'));const h=Buffer.alloc(4);h.writeUInt32LE(n);assert.throws(()=>d.push(h),/frame/i);}
 const d=new Decoder(()=>{});d.push(Buffer.from([3,0,0,0,123]));assert.throws(()=>d.end(),/truncat/i);
 const bad=new Decoder(()=>{});assert.throws(()=>bad.push(Buffer.from([2,0,0,0,0xff,0xff])),/UTF|JSON|frame/i);
});

test('chat validation rejects tool injection, arbitrary roles and byte-limit overflow',()=>{
 const {validate}=require(modulePath);const base={id:'q',op:'chat',model:'gpt-example',messages:[{role:'user',content:'Hi'}]};
 assert.deepEqual(validate(base),base);
 for(const value of [{...base,tools:[]},{...base,url:'https://evil.test'}, {...base,messages:[{role:'system',content:'x'}]}, {...base,messages:[{role:'user',content:'x',tools:[]}]}, {...base,messages:[{role:'user',content:'🦊'.repeat(50000)}]}])assert.throws(()=>validate(value),/request|message|field|limit/i);
 assert.equal(validate({...base,messages:[{role:'user',content:'x'.repeat(100000)}]}).messages[0].content.length,100000);
 assert.equal(Buffer.byteLength(validate({...base,messages:[{role:'user',content:'🦊'.repeat(49152)}]}).messages[0].content),196608);
 assert.throws(()=>validate({...base,messages:[{role:'user',content:'🦊'.repeat(49152)+'a'}]}),/limit/i);
 assert.throws(()=>validate({...base,messages:[{role:'user',content:'x'.repeat(100000)},{role:'user',content:'y'.repeat(100000)}]}),/limit/i);
});

const keyPair=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...keyPair.publicKey.export({format:'jwk'}),kid:'fixture-key',alg:'RS256',use:'sig'};
function jwt(claims={},key=keyPair.privateKey,header={}){
 const head=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid,...header})).toString('base64url');
 const body=Buffer.from(JSON.stringify({iss:'https://auth.openai.com',aud:'oaiapp_test',sub:'test-subject',nonce:'test-nonce',exp:2000000000,iat:1700000000,...claims})).toString('base64url');
 return `${head}.${body}.${crypto.sign('RSA-SHA256',Buffer.from(`${head}.${body}`),key).toString('base64url')}`;
}
test('ID-token validation verifies signature, issuer, audience, nonce and expiry',()=>{
 const {verifyIdToken}=require('../companion/lib/oauth.cjs');const options={jwks:{keys:[jwk]},clientId:'oaiapp_test',nonce:'test-nonce',now:1800000000000};
 assert.equal(verifyIdToken(jwt(),options).sub,'test-subject');
 for(const claims of [{iss:'https://evil.test'},{aud:'other'},{nonce:'other'},{exp:1700000000},{sub:''},{nbf:1900000000}])assert.throws(()=>verifyIdToken(jwt(claims),options),/token|identity/i);
 const wrong=crypto.generateKeyPairSync('rsa',{modulusLength:2048});assert.throws(()=>verifyIdToken(jwt({},wrong.privateKey),options),/token|signature/i);
 assert.throws(()=>verifyIdToken(jwt({},keyPair.privateKey,{alg:'none'}),options),/token|algorithm/i);
});
test('OAuth authorization uses dynamic registration, exact loopback, fresh PKCE and safe returning registration',()=>{
 const {createAttempt}=require('../companion/lib/oauth.cjs');const first=createAttempt({port:54321,hostId:'urn:uuid:123'}),second=createAttempt({port:54322,hostId:'urn:uuid:123',registration:{clientId:'oaiapp_test',subject:'test-subject'}});
 const u=new URL(first.url);assert.equal(u.origin,'https://auth.openai.com');assert.equal(u.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(u.searchParams.get('redirect_uri'),'http://127.0.0.1:54321/auth/callback');
 assert.equal(u.searchParams.get('code_challenge'),crypto.createHash('sha256').update(first.verifier).digest('base64url'));assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.match(u.searchParams.get('scope'),/chatgpt.tokens.use.direct/);
 const v=new URL(second.url);assert.equal(v.searchParams.get('client_id'),'oaiapp_test');assert.equal(v.searchParams.has('agent_name_hint'),false);assert.notEqual(first.state,second.state);assert.notEqual(first.nonce,second.nonce);
});
test('OAuth callback rejects wrong state, missing issued ID and changed returning client',()=>{
 const {createAttempt,readCallback}=require('../companion/lib/oauth.cjs');const a=createAttempt({port:12345,hostId:'urn:uuid:test'});
 assert.throws(()=>readCallback(new URL('http://127.0.0.1/auth/callback?code=x&state=bad&client_id=oaiapp_test'),a),/state/i);
 assert.throws(()=>readCallback(new URL(`http://127.0.0.1/auth/callback?code=x&state=${a.state}`),a),/client/i);
 const returned=createAttempt({port:12345,hostId:'urn:uuid:test',registration:{clientId:'oaiapp_test',subject:'test-subject'}});
 assert.throws(()=>readCallback(new URL(`http://127.0.0.1/auth/callback?code=x&state=${returned.state}&client_id=oaiapp_other`),returned),/client/i);
 assert.deepEqual(readCallback(new URL(`http://127.0.0.1/auth/callback?code=x&state=${a.state}&client_id=oaiapp_test`),a),{code:'x',clientId:'oaiapp_test'});
});
test('token grants cannot mistake identity-only authorization for plan permission',()=>{
 const {tokenRecord}=require('../companion/lib/oauth.cjs');const result={access_token:'fake-access',refresh_token:'fake-refresh',id_token:'fake-id',token_type:'Bearer',expires_in:3600,scope:'openid email'};
 const record=tokenRecord(result,{clientId:'oaiapp_test',identity:{sub:'subject',email:'test@example.test'},now:1000});assert.equal(record.planUsageEnabled,false);
 assert.equal(tokenRecord({...result,scope:'openid resource.invoke chatgpt.tokens.use.direct'}, {clientId:'oaiapp_test',identity:{sub:'subject'},now:1000}).planUsageEnabled,true);
 assert.throws(()=>tokenRecord({...result,token_type:'MAC'},{clientId:'oaiapp_test',identity:{sub:'s'},now:1000}),/token/i);
});

function sse(events,chunks=7){const bytes=Buffer.from(events.map(e=>typeof e==='string'?e:`data: ${JSON.stringify(e)}\r\n\r\n`).join(''));return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=chunks)c.enqueue(bytes.subarray(i,i+chunks));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});}
test('SSE emits Unicode deltas and succeeds only at completed response',async()=>{
 const {consumeSSE}=require('../companion/lib/inference.cjs');const text=[];
 await consumeSSE(sse([{type:'response.output_text.delta',delta:'π 🦊'},{type:'response.completed',response:{status:'completed',output:[]}}]),t=>text.push(t));assert.equal(text.join(''),'π 🦊');
 for(const events of [[{type:'response.output_text.delta',delta:'partial'}],['data: [DONE]\n\n'],[{type:'response.incomplete',response:{status:'incomplete'}}],[{type:'response.failed',response:{error:{message:'SECRET'}}}]])await assert.rejects(consumeSSE(sse(events),()=>{}),e=>['STREAM_INCOMPLETE','STREAM_FAILED'].includes(e.code)&&!e.message.includes('SECRET'));
});
test('SSE refuses tool calls, conflicting terminal status and excessive events',async()=>{
 const {consumeSSE}=require('../companion/lib/inference.cjs');
 await assert.rejects(consumeSSE(sse([{type:'response.output_item.added',item:{type:'function_call',name:'shell'}}]),()=>{}),{code:'TOOL_RESPONSE_REJECTED'});
 await assert.rejects(consumeSSE(sse([{type:'response.completed',response:{status:'failed'}}]),()=>{}),{code:'STREAM_FAILED'});
 await assert.rejects(consumeSSE(sse(['data: '+ 'x'.repeat(2097153)],4096),()=>{}),{code:'LIMIT_EXCEEDED'});
});
test('inference constructs text-only body, uses exact endpoint and never retries 429',async()=>{
 const {Inference}=require('../companion/lib/inference.cjs');const calls=[];const api=new Inference({oauth:{access:async()=>'fixture-secret'},fetchImpl:async(url,options)=>{calls.push({url,options});return sse([{type:'response.completed',response:{status:'completed',output:[]}}]);}});
 await api.chat({model:'gpt-example',messages:[{role:'user',content:'Hi'}]},()=>{});
 assert.equal(calls[0].url,'https://api.openai.com/v1/responses');assert.deepEqual(JSON.parse(calls[0].options.body),{model:'gpt-example',input:[{role:'user',content:'Hi'}],store:false,stream:true});assert.equal(calls[0].options.redirect,'error');
 let attempts=0;const limited=new Inference({oauth:{access:async()=>'fixture'},fetchImpl:async()=>{attempts++;return new Response(JSON.stringify({detail:'untrusted SECRET'}),{status:429,headers:{'retry-after':'30','x-request-id':'req_example'}});}});
 await assert.rejects(limited.chat({model:'gpt-example',messages:[{role:'user',content:'Hi'}]},()=>{}),e=>e.code==='RATE_LIMITED'&&e.details.retryAfterSeconds===30&&!e.message.includes('SECRET'));assert.equal(attempts,1);
});
function memoryStore(tokens=null){return {metadata:{hostId:'urn:uuid:test'},tokens,mode:'memory-only',async saveTokens(value){this.tokens=value;},async clearTokens(){this.tokens=null;},async saveMetadata(value){this.metadata=value;}};}
test('concurrent token refresh rotates exactly once and retains registration',async()=>{
 const {OAuth}=require('../companion/lib/oauth.cjs');const store=memoryStore({clientId:'oaiapp_test',subject:'subject',label:'Account',accessToken:'expired',refreshToken:'old-refresh',scope:'resource.invoke chatgpt.tokens.use.direct',planUsageEnabled:true,expiresAt:0});let calls=0;
 const oauth=new OAuth({store,now:()=>1000,fetchImpl:async(url,options)=>{calls++;const form=new URLSearchParams(options.body);assert.equal(form.get('refresh_token'),'old-refresh');assert.equal(form.has('scope'),false);await new Promise(resolve=>setTimeout(resolve,5));return Response.json({access_token:'new-access',refresh_token:'new-refresh',token_type:'Bearer',expires_in:3600});}});
 assert.deepEqual(await Promise.all([oauth.access(),oauth.access(),oauth.access()]),['new-access','new-access','new-access']);assert.equal(calls,1);assert.equal(store.tokens.refreshToken,'new-refresh');assert.equal(store.tokens.clientId,'oaiapp_test');
});
test('terminal refresh errors clear tokens while temporary failure preserves them',async()=>{
 const {OAuth}=require('../companion/lib/oauth.cjs');for(const [status,code,cleared] of [[400,'invalid_grant',true],[503,'server_error',false]]){
 const store=memoryStore({clientId:'oaiapp_test',subject:'s',refreshToken:'fixture',planUsageEnabled:true,expiresAt:0});const oauth=new OAuth({store,fetchImpl:async()=>Response.json({error:code},{status})});await assert.rejects(oauth.access());assert.equal(store.tokens===null,cleared);}
});
test('memory-only storage never writes token material to disk',async(t)=>{
 const {Store}=require('../companion/lib/storage.cjs');const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-store-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=await Store.open({dir,platform:'linux'});await store.saveTokens({accessToken:'DO-NOT-WRITE',refreshToken:'PRIVATE'});assert.equal(store.mode,'memory-only');
 const all=fs.readdirSync(dir).map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('');assert.equal(all.includes('DO-NOT-WRITE'),false);assert.equal(all.includes('PRIVATE'),false);await store.clearTokens();assert.equal(store.tokens,null);
});

test('service serializes work, cancels by target ID and never leaks raw errors',async()=>{
 const {Service}=require('../companion/lib/service.cjs');const replies=[],store=memoryStore();let entered;
 const ready=new Promise(r=>entered=r);const service=new Service({store,send:x=>replies.push(x),oauth:{},inference:{chat:async(_request,_delta,signal)=>{entered();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('SECRET','AbortError')),{once:true}));}}});
 const chat=service.handle({id:'chat1',op:'chat',model:'gpt-example',messages:[{role:'user',content:'Hi'}]});await ready;
 await service.handle({id:'models1',op:'models'});assert.equal(replies.at(-1).code,'BUSY');await service.handle({id:'cancel1',op:'cancel',targetId:'chat1'});await chat;
 assert.equal(replies.find(x=>x.id==='chat1').code,'CANCELLED');assert.equal(replies.find(x=>x.id==='cancel1').cancelled,true);assert.equal(JSON.stringify(replies).includes('SECRET'),false);
 await service.handle({id:'chat1',op:'status'});assert.equal(replies.at(-1).code,'DUPLICATE_ID');
});
test('service only marks verified after completion and signout aborts auth before clearing',async()=>{
 const {Service}=require('../companion/lib/service.cjs');const replies=[],store=memoryStore({planUsageEnabled:true,label:'Example'});let finished=false;
 const service=new Service({store,send:x=>replies.push(x),oauth:{signout:async()=>{assert.equal(finished,true);await store.clearTokens();return {remoteRevoked:true};}},inference:{chat:async(_r,delta)=>delta('Answer')}});
 await service.handle({id:'s1',op:'status'});assert.equal(replies.at(-1).verified,false);
 await service.handle({id:'c1',op:'chat',model:'gpt-example',messages:[{role:'user',content:'Hi'}]});assert.equal(replies.at(-1).verified,true);
 let entered;const ready=new Promise(r=>entered=r);service.oauth.authenticate=async({signal})=>{entered();try{await new Promise((r,j)=>signal.addEventListener('abort',()=>j(new DOMException('cancel','AbortError')),{once:true}));}finally{finished=true;}};
 const auth=service.handle({id:'a1',op:'authenticate'});await ready;await service.handle({id:'out',op:'signout'});await auth;
 assert.equal(replies.at(-1).state,'signed_out');assert.equal(replies.at(-1).authorized,false);assert.equal(store.tokens,null);
});
test('encrypted storage writes ciphertext only and restores a validated record',async(t)=>{
 const {Store}=require('../companion/lib/storage.cjs');const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-crypto-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 // Substitute only the OS cryptography boundary; persistence is the real implementation.
 const key=crypto.randomBytes(32);const crypt=async(mode,data)=>{if(mode==='Protect'){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(data),c.final(),c.getAuthTag()]);}const c=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(0,12));c.setAuthTag(data.subarray(-16));return Buffer.concat([c.update(data.subarray(12,-16)),c.final()]);};
 const store=await Store.open({dir,platform:'win32',crypt});await store.saveMetadata({...store.metadata,registration:{clientId:'oaiapp_test',subject:'s'}});
 await store.saveTokens({clientId:'oaiapp_test',subject:'s',accessToken:'NEVER-PLAINTEXT',refreshToken:'PRIVATE',expiresAt:12345});assert.equal(fs.readFileSync(path.join(dir,'tokens.dpapi')).includes(Buffer.from('NEVER-PLAINTEXT')),false);
 const again=await Store.open({dir,platform:'win32',crypt});assert.equal(again.tokens.accessToken,'NEVER-PLAINTEXT');await again.clearTokens();assert.equal(fs.existsSync(path.join(dir,'tokens.dpapi')),false);
});
test('full mocked OAuth uses the issued client, verifies nonce, and persists only validated identity',async()=>{
 const {OAuth}=require('../companion/lib/oauth.cjs');const store=memoryStore();let nonce,authorization,exchange;
 const oauth=new OAuth({store,now:()=>1800000000000,openBrowser:async url=>{authorization=new URL(url);nonce=authorization.searchParams.get('nonce');const callback=new URL(authorization.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({state:authorization.searchParams.get('state'),code:'fixture-code',client_id:'oaiapp_test'}).toString();const r=await fetch(callback);assert.equal(r.status,200);},fetchImpl:async(url,options)=>{
  if(url.endsWith('openid-configuration'))return Response.json({issuer:'https://auth.openai.com',authorization_endpoint:'https://auth.openai.com/api/accounts/authorize',token_endpoint:'https://auth.openai.com/api/accounts/oauth/token',jwks_uri:'https://auth.openai.com/.well-known/jwks.json'});
  if(url.endsWith('jwks.json'))return Response.json({keys:[jwk]});exchange=new URLSearchParams(options.body);return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',id_token:jwt({nonce}),token_type:'Bearer',expires_in:3600,scope:'openid resource.invoke chatgpt.tokens.use.direct'});
 }});
 await oauth.authenticate();assert.equal(exchange.get('client_id'),'oaiapp_test');assert.equal(exchange.get('redirect_uri'),authorization.searchParams.get('redirect_uri'));assert.equal(exchange.has('client_secret'),false);assert.equal(store.tokens.subject,'test-subject');assert.equal(store.tokens.planUsageEnabled,true);
});
test('installer plan requires exact extension IDs and quotes safe executable paths',()=>{
 const {buildPlan}=require('../companion/install.cjs');const p=buildPlan({extensionIds:['abcdefghijklmnopabcdefghijklmnop'],nodePath:'C:\\Program Files\\nodejs\\node.exe',installDir:'C:\\Users\\Example\\AI'});
 assert.deepEqual(p.manifest.allowed_origins,['chrome-extension://abcdefghijklmnopabcdefghijklmnop/']);assert.equal(p.manifest.name,'org.flzsh.canvas_harness_ai');assert.match(p.launcher,/"C:\\Program Files\\nodejs\\node.exe"/);
 for(const extensionIds of [['*'],['chrome-extension://abc/'],['a'.repeat(31)],['a'.repeat(32),'*']])assert.throws(()=>buildPlan({extensionIds,nodePath:'C:\\node.exe',installDir:'C:\\AI'}));
 assert.throws(()=>buildPlan({extensionIds:['a'.repeat(32)],nodePath:'C:\\%evil%\\node.exe',installDir:'C:\\AI'}));
});

test('native host speaks framed JSON, rejects unknown origins and releases its lock on EOF',async(t)=>{
 const {spawn}=require('node:child_process');const {Decoder,encode}=require(modulePath);
 const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-host-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const config=path.join(dir,'host-config.json'),origin='chrome-extension://'+'a'.repeat(32)+'/';
 fs.writeFileSync(config,JSON.stringify({host:'org.flzsh.canvas_harness_ai',protocol:1,allowedOrigins:[origin],dataDir:path.join(dir,'data'),storageMode:'memory-only'}));
 async function launch(caller,input){return await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'../companion/host.cjs'),'--config',config,caller],{windowsHide:true,stdio:['pipe','pipe','pipe']});const messages=[];let stderr='';const timeout=setTimeout(()=>{child.kill();reject(Error('Native host timeout'));},5000);const decoder=new Decoder(message=>{messages.push(message);if(input)child.stdin.end();});child.stdout.on('data',data=>{try{decoder.push(data);}catch(e){child.kill();reject(e);}});child.stderr.on('data',data=>stderr+=data);child.on('error',reject);child.on('close',code=>{clearTimeout(timeout);try{decoder.end();resolve({code,messages,stderr});}catch(e){reject(e);}});child.stdin.on('error',()=>{});if(input)child.stdin.write(encode(input));else child.stdin.end();});}
 const ok=await launch(origin,{id:'status1',op:'status'});assert.equal(ok.code,0);assert.equal(ok.stderr,'');assert.equal(ok.messages.length,1);assert.equal(ok.messages[0].authorized,false);assert.equal(ok.messages[0].verified,false);assert.equal(ok.messages[0].storage,'memory-only');assert.equal(fs.existsSync(path.join(dir,'data/runtime.lock')),false);
 const bad=await launch('chrome-extension://'+'b'.repeat(32)+'/');assert.equal(bad.code,1);assert.equal(bad.messages[0].code,'FORBIDDEN');assert.equal(fs.existsSync(path.join(dir,'data/runtime.lock')),false);
});
test('native host refuses oversized framing and exits without allocating a payload',async()=>{
 const {Decoder}=require(modulePath);const d=new Decoder(()=>assert.fail('oversized frame was delivered'));const header=Buffer.from([255,255,255,127]);assert.throws(()=>d.push(header),{code:'LIMIT_EXCEEDED'});assert.throws(()=>d.push(Buffer.from('{}')),/closed/);
});
test('OAuth listener rejects bad state without consuming the valid attempt and closes on cancellation',async()=>{
 const {receiveAuthorization}=require('../companion/lib/oauth.cjs');const controller=new AbortController();let address;
 await assert.rejects(receiveAuthorization({hostId:'urn:uuid:test',signal:controller.signal,openBrowser:async url=>{const auth=new URL(url);address=new URL(auth.searchParams.get('redirect_uri'));address.search='state=wrong&code=fake&client_id=oaiapp_test';assert.equal((await fetch(address)).status,400);controller.abort();}}),{code:'CANCELLED'});
 await assert.rejects(fetch(address));
});
test('signout reports unconfirmed revocation but always clears local credentials',async()=>{
 const {OAuth}=require('../companion/lib/oauth.cjs');const store=memoryStore({refreshToken:'fake-secret',clientId:'oaiapp_test'});const oauth=new OAuth({store,fetchImpl:async()=>{throw Error('connection includes fake-secret');}});
 const result=await oauth.signout();assert.equal(store.tokens,null);assert.equal(result.remoteRevoked,false);assert.equal(JSON.stringify(result).includes('fake-secret'),false);assert.match(result.warning,/ChatGPT Settings/);
});
test('memory fallback after DPAPI failure never creates a plaintext credential file',async(t)=>{
 const {Store}=require('../companion/lib/storage.cjs');const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-fallback-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=await Store.open({dir,platform:'win32',crypt:async()=>{throw Error('DPAPI unavailable');}});assert.equal(store.mode,'memory-only');await store.saveTokens({accessToken:'NO-FILE',refreshToken:'NO-FILE'});assert.equal(fs.readdirSync(dir).some(file=>file!=='registration.json'),false);assert.match(store.warning,/memory-only/);
});
test('profile locking refuses a second host and releases only its own lock',async(t)=>{
 const {acquireLock}=require('../companion/lib/storage.cjs');const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-lock-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const release=await acquireLock(dir);
 await assert.rejects(acquireLock(dir),{code:'HOST_BUSY'});await release();const release2=await acquireLock(dir);await release2();assert.equal(fs.existsSync(path.join(dir,'runtime.lock')),false);
});

test('Windows DPAPI helper round-trips synthetic data without writing a credential file',{skip:process.platform!=='win32'},async()=>{
 const {dpapi}=require('../companion/lib/process.cjs');const original=Buffer.from('synthetic-companion-test-'+crypto.randomBytes(16).toString('hex'));
 const encrypted=await dpapi('Protect',original);assert.equal(encrypted.includes(original),false);assert.deepEqual(await dpapi('Unprotect',encrypted),original);
});
test('SSE displays refusal text and preserves actionable rate-limit failures',async()=>{
 const {consumeSSE}=require('../companion/lib/inference.cjs');let text='';await consumeSSE(sse([{type:'response.refusal.delta',delta:'I cannot help with that.'},{type:'response.completed',response:{status:'completed',output:[]}}]),t=>text+=t);assert.equal(text,'I cannot help with that.');
 await assert.rejects(consumeSSE(sse([{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded',message:'SECRET'}}}]),()=>{}),e=>e.code==='RATE_LIMITED'&&!e.message.includes('SECRET'));
});
test('installer refuses filesystem roots and shell-substitution paths',()=>{
 const {buildPlan}=require('../companion/install.cjs');for(const installDir of ['C:\\','C:\\AI%bad%','C:\\AI!bad','\\\\server\\share\\AI'])assert.throws(()=>buildPlan({extensionIds:['a'.repeat(32)],nodePath:'C:\\node.exe',installDir}));
});

test('generated Windows launcher passes the caller through and preserves protocol-only stdout',{skip:process.platform!=='win32'},async(t)=>{
 const {spawn}=require('node:child_process');const {buildPlan}=require('../companion/install.cjs');const {Decoder,encode}=require(modulePath);const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-launcher-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const id='a'.repeat(32),origin=`chrome-extension://${id}/`,plan=buildPlan({extensionIds:[id],nodePath:process.execPath,installDir:dir});
 fs.writeFileSync(plan.manifest.path,plan.launcher);fs.writeFileSync(plan.configPath,JSON.stringify({...plan.config,storageMode:'memory-only'}));
 fs.writeFileSync(path.join(dir,'host.cjs'),`require(${JSON.stringify(path.join(__dirname,'../companion/host.cjs'))}).main();`);
 const result=await new Promise((resolve,reject)=>{const child=spawn(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',['/d','/s','/c',`""${plan.manifest.path}" ${origin}"`],{windowsHide:true,windowsVerbatimArguments:true,stdio:['pipe','pipe','pipe']});let stderr='';const replies=[];const timer=setTimeout(()=>{child.kill();reject(Error('Launcher timeout'));},5000);const decoder=new Decoder(message=>{replies.push(message);child.stdin.end();});child.stdout.on('data',data=>{try{decoder.push(data);}catch(e){child.kill();reject(e);}});child.stderr.on('data',data=>stderr+=data);child.stdin.on('error',()=>{});child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve({code,stderr,replies});});child.stdin.write(encode({id:'launcher',op:'status'}));});
 assert.equal(result.code,0,result.stderr);assert.equal(result.stderr,'');assert.equal(result.replies.length,1);assert.equal(result.replies[0].id,'launcher');assert.equal(result.replies[0].authorized,false);
});
test('DPAPI-unavailable fallback discards obsolete unreadable ciphertext before a new session',async(t)=>{
 const {Store}=require('../companion/lib/storage.cjs');const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-obsolete-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.writeFileSync(path.join(dir,'tokens.dpapi'),'synthetic-obsolete-ciphertext');
 const store=await Store.open({dir,platform:'win32',crypt:async()=>{throw Error('unavailable');}});assert.equal(store.unreadableTokens,true);await store.saveTokens({accessToken:'new-memory-only',refreshToken:'new-memory-only'});assert.equal(fs.existsSync(path.join(dir,'tokens.dpapi')),false);
});

test('explicit memory-only mode reports an unreadable saved session when signing out',async(t)=>{
 const {Store}=require('../companion/lib/storage.cjs');const {OAuth}=require('../companion/lib/oauth.cjs');const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-explicit-memory-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.writeFileSync(path.join(dir,'tokens.dpapi'),'synthetic-old-ciphertext');
 const store=await Store.open({dir,platform:'memory-only'});const oauth=new OAuth({store,fetchImpl:async()=>assert.fail('No readable token to revoke')});const result=await oauth.signout();assert.equal(result.remoteRevoked,false);assert.match(result.warning,/not confirmed/);assert.equal(fs.existsSync(path.join(dir,'tokens.dpapi')),false);
});

test('service preserves cancellation even when a lower layer reports another failure',async()=>{
 const {Service}=require('../companion/lib/service.cjs');const {fail}=require('../companion/lib/errors.cjs');const replies=[];let entered;const ready=new Promise(resolve=>entered=resolve);
 const service=new Service({store:memoryStore(),oauth:{},send:value=>replies.push(value),inference:{models:async signal=>{entered();await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));throw fail('AUTH_INVALID','Interrupted provider JSON body');}}});
 const active=service.handle({id:'catalog',op:'models'});await ready;await service.handle({id:'stop',op:'cancel',targetId:'catalog'});await active;assert.equal(replies.find(reply=>reply.id==='catalog').code,'CANCELLED');
});

test('issued client IDs are opaque and the registration placeholder is never persisted',async(t)=>{
 const {createAttempt,readCallback}=require('../companion/lib/oauth.cjs');const {Store}=require('../companion/lib/storage.cjs');const dir=fs.mkdtempSync(path.join(__dirname,'../companion/.test-client-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=await Store.open({dir,platform:'memory-only'});
 const attempt=createAttempt({port:54321,hostId:store.metadata.hostId});const callback=new URL(attempt.redirectUri);callback.search=new URLSearchParams({state:attempt.state,code:'fixture-code',client_id:'issued.client-v2_123'}).toString();assert.equal(readCallback(callback,attempt).clientId,'issued.client-v2_123');
 await store.saveMetadata({...store.metadata,registration:{clientId:'issued.client-v2_123'}});assert.equal(new URL(createAttempt({port:54322,hostId:store.metadata.hostId,registration:store.metadata.registration}).url).searchParams.get('client_id'),'issued.client-v2_123');
 for(const clientId of ['dynamic_agent_client','has spaces','bad\nvalue','x'.repeat(257)]){callback.searchParams.set('client_id',clientId);assert.throws(()=>readCallback(callback,attempt));await assert.rejects(store.saveMetadata({...store.metadata,registration:{clientId}}));}
});
