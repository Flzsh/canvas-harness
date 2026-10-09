'use strict';
const crypto=require('node:crypto');
const http=require('node:http');
const {AUTH,API,jsonRequest}=require('./http.cjs');
const {fail,checkAbort}=require('./errors.cjs');
const SCOPE='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const TERMINAL_REFRESH=new Set(['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused']);
const random=()=>crypto.randomBytes(32).toString('base64url');
// Issued IDs are opaque. The documentation's oaiapp_ prefix is an example, not an identity check.
const clientValid=v=>typeof v==='string'&&v!=='dynamic_agent_client'&&/^[A-Za-z0-9._:-]{1,256}$/.test(v);
function same(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function createAttempt({port,hostId,registration,reauthorize=false}){
 if(!Number.isInteger(port)||port<1||port>65535)throw fail('AUTH_INVALID','Invalid callback port.');
 const verifier=random(),state=random(),nonce=random(),redirectUri=`http://127.0.0.1:${port}/auth/callback`,clientId=registration?.clientId;
 if(clientId&&!clientValid(clientId))throw fail('AUTH_INVALID','Saved OAuth client is invalid.');
 const url=new URL('/api/accounts/authorize',AUTH);url.search=new URLSearchParams({client_id:clientId||'dynamic_agent_client',ext_agent_host_id:hostId,response_type:'code',redirect_uri:redirectUri,scope:SCOPE,resource:API,state,nonce,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')}).toString();
 if(!clientId)url.searchParams.set('agent_name_hint','Canvas Harness');if(reauthorize)url.searchParams.set('prompt','consent');
 return {url:url.href,verifier,state,nonce,redirectUri,clientId,subject:registration?.subject};
}
function readCallback(url,attempt){
 for(const key of ['state','code','client_id','error'])if(url.searchParams.getAll(key).length>1)throw fail('AUTH_INVALID','Repeated OAuth callback parameter.');
 if(!same(url.searchParams.get('state'),attempt.state))throw fail('AUTH_INVALID','OAuth state did not match.');
 if(url.searchParams.has('error'))throw fail('AUTH_DENIED','Sign-in was declined or could not be authorized.');
 const supplied=url.searchParams.get('client_id'),clientId=supplied||attempt.clientId;
 if(!clientValid(clientId)||attempt.clientId&&supplied&&supplied!==attempt.clientId)throw fail('AUTH_INVALID','OAuth client did not match this registration.');
 const code=url.searchParams.get('code');if(!code||code.length>8192)throw fail('AUTH_INVALID','OAuth callback has no valid code.');
 return {code,clientId};
}
function verifyIdToken(token,{jwks,clientId,nonce,now=Date.now()}){
 try{
  if(typeof token!=='string'||token.length>32768)throw Error();const parts=token.split('.');if(parts.length!==3||parts.some(v=>!/^[A-Za-z0-9_-]+$/.test(v)))throw Error();
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(!['RS256','ES256'].includes(header.alg)||typeof header.kid!=='string'||header.crit!==undefined)throw Error();
  const keys=jwks?.keys?.filter(k=>k.kid===header.kid&&(!k.use||k.use==='sig')&&(!k.alg||k.alg===header.alg)&&(!k.key_ops||k.key_ops.includes('verify')));
  if(keys?.length!==1)throw Error();const jwk=keys[0];if(header.alg==='RS256'&&jwk.kty!=='RSA'||header.alg==='ES256'&&(jwk.kty!=='EC'||jwk.crv!=='P-256'))throw Error();
  const key=crypto.createPublicKey({key:jwk,format:'jwk'});if(header.alg==='RS256'&&(key.asymmetricKeyDetails?.modulusLength||0)<2048)throw Error();
  if(!crypto.verify('sha256',Buffer.from(`${parts[0]}.${parts[1]}`),{key,...(header.alg==='ES256'?{dsaEncoding:'ieee-p1363'}:{})},Buffer.from(parts[2],'base64url')))throw Error();
  const aud=claims.aud,seconds=Math.floor(now/1000);
  if(claims.iss!==AUTH||!(aud===clientId||Array.isArray(aud)&&aud.includes(clientId))||Array.isArray(aud)&&aud.length>1&&claims.azp!==clientId||claims.azp&&claims.azp!==clientId)throw Error();
  if(!Number.isInteger(claims.exp)||claims.exp<=seconds||claims.nbf!==undefined&&(!Number.isInteger(claims.nbf)||claims.nbf>seconds+30)||claims.iat!==undefined&&(!Number.isInteger(claims.iat)||claims.iat>seconds+30))throw Error();
  if(typeof claims.sub!=='string'||!claims.sub||claims.sub.length>512||nonce!==undefined&&!same(claims.nonce,nonce))throw Error();
  return claims;
 }catch{throw fail('AUTH_INVALID','OpenAI identity token validation failed. Start sign-in again.');}
}
function tokenRecord(result,{clientId,identity,now=Date.now(),previous}){
 const validSecret=v=>typeof v==='string'&&v.length>0&&v.length<=32768&&!/[\r\n]/.test(v);
 if(!result||!validSecret(result.access_token)||!validSecret(result.refresh_token)||String(result.token_type).toLowerCase()!=='bearer'||!Number.isFinite(result.expires_in)||result.expires_in<=0||result.expires_in>86400)throw fail('AUTH_INVALID','Invalid token response.');
 const scope=result.scope??previous?.scope;if(typeof scope!=='string'||scope.length>4096)throw fail('AUTH_INVALID','Invalid token permission response.');
 const scopes=new Set(scope.split(/\s+/));return {clientId,subject:identity.sub,label:typeof identity.email==='string'&&identity.email.length<=254?identity.email:'ChatGPT account',accessToken:result.access_token,refreshToken:result.refresh_token,idToken:result.id_token||previous?.idToken,scope,expiresAt:now+result.expires_in*1000,planUsageEnabled:scopes.has('chatgpt.tokens.use.direct')&&scopes.has('resource.invoke')};
}
async function discovery(fetchImpl,signal){
 const doc=await jsonRequest(fetchImpl,`${AUTH}/.well-known/openid-configuration`,{signal});
 if(doc.issuer!==AUTH||doc.authorization_endpoint!==`${AUTH}/api/accounts/authorize`||doc.token_endpoint!==`${AUTH}/api/accounts/oauth/token`||doc.jwks_uri!==`${AUTH}/.well-known/jwks.json`)throw fail('AUTH_INVALID','OpenAI authentication discovery has unexpected endpoints.');
 if(doc.revocation_endpoint&&(new URL(doc.revocation_endpoint).origin!==AUTH||new URL(doc.revocation_endpoint).username||new URL(doc.revocation_endpoint).password))throw fail('AUTH_INVALID','Unexpected revocation endpoint.');
 return doc;
}
async function receiveAuthorization({hostId,registration,reauthorize,openBrowser,signal,onOpening,timeoutMs=300000}){
 checkAbort(signal);let attempt,settled=false,resolveResult,rejectResult,timer;
 const result=new Promise((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});result.catch(()=>{});
 const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?rejectResult(error):resolveResult(value);};
 const server=http.createServer({maxHeaderSize:8192},(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Type','text/plain; charset=utf-8');
  const host=`127.0.0.1:${server.address()?.port}`;
  if(req.method!=='GET'||req.headers.host!==host||!req.url||req.url.length>16384||!attempt){res.writeHead(400).end('Invalid callback.');return;}
  let url;try{url=new URL(req.url,`http://${host}`);}catch{res.writeHead(400).end('Invalid callback.');return;}
  if(url.origin!==`http://${host}`||url.pathname!=='/auth/callback'||settled){res.writeHead(404).end('Not found.');return;}
  try{const callback=readCallback(url,attempt);res.end('Sign-in received. You may close this tab and return to Canvas Harness.');finish(null,{...callback,attempt});}
  catch(error){res.writeHead(400).end('Sign-in could not be verified. Return to Canvas Harness.');if(same(url.searchParams.get('state'),attempt.state))finish(error);}
 });
 server.requestTimeout=5000;server.headersTimeout=5000;server.keepAliveTimeout=1000;
 const aborted=()=>finish(fail('CANCELLED','Sign-in cancelled.'));signal?.addEventListener('abort',aborted,{once:true});
 try{
  await new Promise((resolve,reject)=>{server.once('error',()=>reject(fail('AUTH_INVALID','Cannot start the local authentication callback.')));server.listen(0,'127.0.0.1',resolve);});
  checkAbort(signal);attempt=createAttempt({port:server.address().port,hostId,registration,reauthorize});
  timer=setTimeout(()=>finish(fail('AUTH_TIMEOUT','Sign-in timed out. Start again when ready.')),timeoutMs);
  onOpening?.();await openBrowser(attempt.url,signal);checkAbort(signal);return await result;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',aborted);server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
class OAuth {
 constructor({store,fetchImpl=globalThis.fetch,openBrowser,now=Date.now}){this.store=store;this.fetch=fetchImpl;this.openBrowser=openBrowser;this.now=now;this.refreshing=null;}
 async authenticate({signal,onOpening,reauthorize=false}={}){
  const doc=await discovery(this.fetch,signal),meta=this.store.metadata;
  const {code,clientId,attempt}=await receiveAuthorization({hostId:meta.hostId,registration:meta.registration,reauthorize,openBrowser:this.openBrowser,signal,onOpening});
  // Retain an issued registration even if the code exchange fails. No token is persisted before identity validation.
  await this.store.saveMetadata({...meta,registration:{...meta.registration,clientId}});
  const result=await jsonRequest(this.fetch,doc.token_endpoint,{method:'POST',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code,code_verifier:attempt.verifier,redirect_uri:attempt.redirectUri,resource:API}).toString()});
  const jwks=await jsonRequest(this.fetch,doc.jwks_uri,{signal});const identity=verifyIdToken(result.id_token,{jwks,clientId,nonce:attempt.nonce,now:this.now()});
  if(attempt.subject&&identity.sub!==attempt.subject)throw fail('AUTH_INVALID','Sign-in returned a different account than the selected registration.');
  const record=tokenRecord(result,{clientId,identity,now:this.now()});checkAbort(signal);
  await this.store.saveMetadata({...this.store.metadata,registration:{clientId,subject:identity.sub,label:record.label}});await this.store.saveTokens(record);checkAbort(signal);return record;
 }
 async access(signal){
  checkAbort(signal);let record=this.store.tokens;if(!record)throw fail('AUTH_REQUIRED','Choose Sign in with ChatGPT to authorize this companion.');
  if(!record.planUsageEnabled)throw fail('PLAN_PERMISSION_REQUIRED','Sign-in succeeded, but ChatGPT plan usage is not enabled. Enable it through Sign in with ChatGPT.');
  if(record.expiresAt>this.now()+60000)return record.accessToken;
  if(!this.refreshing)this.refreshing=this.refresh(signal).finally(()=>{this.refreshing=null;});await this.refreshing;checkAbort(signal);record=this.store.tokens;
  if(!record?.planUsageEnabled)throw fail('PLAN_PERMISSION_REQUIRED','ChatGPT plan permission is missing. Authorize plan usage again.');return record.accessToken;
 }
 async refresh(signal){
  const old=this.store.tokens;if(!old)throw fail('AUTH_REQUIRED','Sign in again.');
  let result;try{result=await jsonRequest(this.fetch,`${AUTH}/api/accounts/oauth/token`,{method:'POST',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:old.clientId,refresh_token:old.refreshToken,resource:API}).toString()});}
  catch(error){if(TERMINAL_REFRESH.has(error.details?.providerCode)){await this.store.clearTokens();throw fail('AUTH_REQUIRED','Your renewable ChatGPT session expired or was revoked. Sign in again.');}throw error;}
  let identity={sub:old.subject,email:old.label};if(result.id_token){const jwks=await jsonRequest(this.fetch,`${AUTH}/.well-known/jwks.json`,{signal});identity=verifyIdToken(result.id_token,{jwks,clientId:old.clientId,now:this.now()});if(identity.sub!==old.subject)throw fail('AUTH_INVALID','Renewed identity does not match this account.');}
  const record=tokenRecord(result,{clientId:old.clientId,identity,now:this.now(),previous:old});await this.store.saveTokens(record);
 }
 async signout(signal){
  const record=this.store.tokens;let remoteRevoked=!record&&!this.store.unreadableTokens;
  try{if(record){const doc=await discovery(this.fetch,signal);if(!doc.revocation_endpoint)throw Error();const response=await require('./http.cjs').request(this.fetch,doc.revocation_endpoint,{method:'POST',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:record.refreshToken,token_type_hint:'refresh_token',client_id:record.clientId}).toString()});remoteRevoked=response.status===200;await response.body?.cancel();}}
  catch{remoteRevoked=false;}finally{await this.store.clearTokens();}
  return {remoteRevoked,...(!remoteRevoked?{warning:'Local credentials cleared; remote revocation was not confirmed. Disconnect Canvas Harness in ChatGPT Settings.'}:{})};
 }
}
module.exports={OAuth,createAttempt,readCallback,verifyIdToken,tokenRecord,receiveAuthorization,discovery};
