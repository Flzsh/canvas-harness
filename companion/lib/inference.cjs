'use strict';
const {API,request,jsonRequest,providerError}=require('./http.cjs');
const {fail,checkAbort}=require('./errors.cjs');
const {validate}=require('./protocol.cjs');
const MAX_EVENT=2097152,MAX_TEXT=1048576,MAX_STREAM=8388608;
function assertTextOutput(item){if(item&&!['message','reasoning'].includes(item.type))throw fail('TOOL_RESPONSE_REJECTED','The provider returned a non-text action. No action was executed.');}
async function consumeSSE(response,onDelta,{signal}={}){
 if(!response.body||!/^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type')||''))throw fail('STREAM_FAILED','OpenAI did not return a supported response stream.');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let parts=[],lineBytes=0,data=[],eventSize=0,total=0,textBytes=0,completed=false;
 function dispatch(){
  if(!data.length)return;const raw=data.join('\n');data=[];eventSize=0;if(raw==='[DONE]')return;
  let event;try{event=JSON.parse(raw);}catch{throw fail('STREAM_FAILED','OpenAI sent an invalid stream event.');}
  if(!event||typeof event.type!=='string')throw fail('STREAM_FAILED','OpenAI sent an invalid stream event.');
  if(event.type==='response.output_item.added'||event.type==='response.output_item.done')assertTextOutput(event.item);
  if(/function_call|custom_tool|mcp_call|web_search_call|computer_call/.test(event.type))throw fail('TOOL_RESPONSE_REJECTED','The provider returned a tool action. No action was executed.');
  if(event.type==='response.output_text.delta'||event.type==='response.refusal.delta'){
   if(typeof event.delta!=='string')throw fail('STREAM_FAILED','OpenAI sent an invalid text event.');textBytes+=Buffer.byteLength(event.delta);if(textBytes>MAX_TEXT)throw fail('LIMIT_EXCEEDED','The answer exceeded the supported text limit.');
   // Bound each native-messaging reply even when a provider batches deltas.
   for(let i=0;i<event.delta.length;){let end=Math.min(i+8192,event.delta.length);if(end<event.delta.length&&/[\uD800-\uDBFF]/.test(event.delta[end-1]))end--;onDelta(event.delta.slice(i,end));i=end;}
  }
  if(['response.failed','response.incomplete','error'].includes(event.type)){
   const providerCode=require('./http.cjs').safeCode(event.response?.error?.code||event.error?.code||event.code),details=providerCode?{providerCode}:{};
   if(['subscription_sharing_usage_limit_exceeded','rate_limit_exceeded'].includes(providerCode))throw fail('RATE_LIMITED','ChatGPT plan or app usage is limited. Check ChatGPT Settings → Usage before retrying.',details);
   if(providerCode==='subscription_sharing_user_not_eligible')throw fail('NOT_ELIGIBLE','ChatGPT plan usage is unavailable for this account or workspace.',details);
   throw fail(event.type==='response.incomplete'?'STREAM_INCOMPLETE':'STREAM_FAILED','OpenAI did not complete this answer. Partial text is incomplete; retry only when ready.',details);
  }
  if(event.type==='response.completed'){
   if(event.response?.status!=='completed')throw fail('STREAM_FAILED','The final response did not confirm successful completion.');
   if(event.response.output!==undefined&&!Array.isArray(event.response.output))throw fail('STREAM_FAILED','The final response is invalid.');
   for(const item of event.response.output||[])assertTextOutput(item);completed=true;
  }
 }
 function line(value){if(value.endsWith('\r'))value=value.slice(0,-1);if(value===''){dispatch();return;}if(value.startsWith('data:')){const part=value.slice(5).replace(/^ /,'');eventSize+=Buffer.byteLength(part);if(eventSize>MAX_EVENT)throw fail('LIMIT_EXCEEDED','Provider stream event exceeded the size limit.');data.push(part);}}
 try{
  while(!completed){checkAbort(signal);const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_STREAM)throw fail('LIMIT_EXCEEDED','Provider stream exceeded the size limit.');
   let decoded;try{decoded=decoder.decode(value,{stream:true});}catch{throw fail('STREAM_FAILED','OpenAI sent invalid UTF-8.');}
   const lines=decoded.split('\n');for(let i=0;i<lines.length&&!completed;i++){lineBytes+=Buffer.byteLength(lines[i]);if(lineBytes>MAX_EVENT)throw fail('LIMIT_EXCEEDED','Provider stream line exceeded the size limit.');parts.push(lines[i]);if(i<lines.length-1){line(parts.join(''));parts=[];lineBytes=0;}}
  }
  checkAbort(signal);if(!completed)throw fail('STREAM_INCOMPLETE','The connection ended before OpenAI confirmed completion. Partial text is incomplete; no retry was sent.');
 }catch(error){checkAbort(signal);if(error?.name==='CompanionError')throw error;throw fail('STREAM_INCOMPLETE','The response stream was interrupted before completion. No retry was sent.');}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
class Inference {
 constructor({oauth,fetchImpl=globalThis.fetch}){this.oauth=oauth;this.fetch=fetchImpl;}
 async models(signal){
  const access=await this.oauth.access(signal),result=await jsonRequest(this.fetch,`${API}/models`,{signal,headers:{Authorization:`Bearer ${access}`}});
  if(!Array.isArray(result.models))throw fail('STREAM_FAILED','OpenAI returned an unsupported model catalog.');
  return result.models.filter(m=>m&&m.visibility==='list'&&typeof m.slug==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(m.slug)).slice(0,80).map(m=>({id:m.slug,name:typeof m.display_name==='string'?m.display_name.slice(0,160):m.slug}));
 }
 async chat({model,messages},onDelta,signal){
  validate({id:'internal',op:'chat',model,messages});const access=await this.oauth.access(signal);
  const response=await request(this.fetch,`${API}/responses`,{method:'POST',signal,headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({model,input:messages.map(({role,content})=>({role,content})),store:false,stream:true})},600000);
  if(!response.ok)throw await providerError(response);await consumeSSE(response,onDelta,{signal});
 }
}
module.exports={Inference,consumeSSE};
