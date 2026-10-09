'use strict';
const {fail,checkAbort}=require('./errors.cjs');
const AUTH='https://auth.openai.com',API='https://api.openai.com/v1';
function safeCode(value){return typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,100}$/.test(value)?value:undefined;}
async function boundedText(response,limit=1048576){
 if(!response.body)return '';const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw fail('LIMIT_EXCEEDED','Provider response exceeds the supported size.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
}
async function providerError(response){
 let body;try{body=JSON.parse(await boundedText(response,65536));}catch{body=null;}
 const providerCode=safeCode(body?.error?.code||body?.error),status=response.status;
 const details={httpStatus:status,bodyShape:body?.error?'error':body?.detail?'detail':body?'other':'unreadable'};
 if(providerCode)details.providerCode=providerCode;
 const requestId=safeCode(response.headers.get('x-request-id'));if(requestId)details.requestId=requestId;
 const retry=response.headers.get('retry-after');if(retry&&/^\d{1,6}$/.test(retry))details.retryAfterSeconds=Number(retry);
 if(providerCode==='subscription_sharing_user_not_eligible')return fail('NOT_ELIGIBLE','ChatGPT plan usage is unavailable for this account or workspace. Check its policy; repeated sign-in will not fix eligibility.',details);
 if(status===429)return fail('RATE_LIMITED','ChatGPT plan or app usage is limited. Check ChatGPT Settings → Usage and retry later; no request was retried.',details);
 if(status===401)return fail('AUTH_REQUIRED','OpenAI did not accept this authorization. Check the selected account and plan permission; sign in again if the session was revoked.',details);
 if(status===403)return fail('FORBIDDEN','The account, workspace, region or app permission does not allow this request. Check access before trying again.',details);
 if(providerCode==='model_not_found'||status===404)return fail('MODEL_UNAVAILABLE','This model or endpoint is unavailable. Refresh the model list and choose an available model.',details);
 if(status>=500)return fail('UNAVAILABLE','OpenAI is temporarily unavailable. Your saved authorization was kept. Try again later.',details);
 return fail('STREAM_FAILED','OpenAI rejected the request. Check model availability and integration permissions.',details);
}
async function request(fetchImpl,url,options={},timeout=20000){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!['auth.openai.com','api.openai.com'].includes(u.host))throw fail('AUTH_INVALID','Unexpected provider endpoint.');
 checkAbort(options.signal);
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(timeout)]);
 try{return await fetchImpl(url,{...options,redirect:'error',signal});}catch(error){checkAbort(options.signal);if(signal.aborted)throw fail('UNAVAILABLE','The provider did not respond in time. Try again later.');if(error?.code&&error.name==='CompanionError')throw error;throw fail('NETWORK','Cannot reach OpenAI. Check the connection and retry when ready.');}
}
async function jsonRequest(fetchImpl,url,options={}){
 const response=await request(fetchImpl,url,options);if(!response.ok)throw await providerError(response);
 try{return JSON.parse(await boundedText(response));}catch(error){if(error?.name==='CompanionError')throw error;throw fail('AUTH_INVALID','Provider returned an invalid JSON response.');}
}
module.exports={AUTH,API,request,jsonRequest,boundedText,providerError,safeCode};
