'use strict';
const {validate,validId}=require('./protocol.cjs');
const {fail,publicError,checkAbort}=require('./errors.cjs');
const HOST='org.flzsh.canvas_harness_ai';
class Service {
 constructor({store,oauth,inference,send}){this.store=store;this.oauth=oauth;this.inference=inference;this.send=send;this.active=null;this.signingOut=false;this.verified=false;this.ids=new Set();this.closed=false;}
 status(){const token=this.store.tokens;return {protocol:1,host:HOST,authorized:!!token,verified:this.verified&&!!token,account:token?{label:token.label}:null,storage:this.store.mode,planUsageEnabled:!!token?.planUsageEnabled,busy:this.signingOut?'signout':this.active?.op||null,...(this.store.warning?{warning:this.store.warning}:{})};}
 async handle(raw){
  const id=validId(raw?.id)?raw.id:null;
  try{
   if(this.closed)return;const message=validate(raw);
   if(this.ids.has(id))throw fail('DUPLICATE_ID','Request IDs must not be reused on this connection.');
   if(this.ids.size>=10000)throw fail('LIMIT_EXCEEDED','This connection reached its request limit. Reconnect before sending another request.');this.ids.add(id);
   if(message.op==='status'){this.send({id,type:'status',...this.status()});return;}
   if(message.op==='cancel'){const active=this.active,cancelled=!!active&&active.id===message.targetId&&!this.signingOut;if(cancelled)active.controller.abort();this.send({id,type:'done',reason:'cancelled',targetId:message.targetId,cancelled});return;}
   if(message.op==='signout'){
    if(this.signingOut)throw fail('BUSY','Sign-out is already in progress.');this.signingOut=true;this.verified=false;
    this.signoutController=new AbortController();
    this.signoutTask=(async()=>{if(this.active){this.active.controller.abort();await this.active.promise.catch(()=>{});}const result=await this.oauth.signout(this.signoutController.signal);if(!this.closed)this.send({id,type:'auth',state:'signed_out',authorized:false,verified:false,...result});})();
    try{await this.signoutTask;}finally{this.signingOut=false;this.signoutTask=null;this.signoutController=null;}
    return;
   }
   if(this.active||this.signingOut)throw fail('BUSY','Wait for the current operation or cancel it first.');
   const active={id,op:message.op,controller:new AbortController(),promise:null};this.active=active;
   active.promise=(async()=>{
    const signal=active.controller.signal;
    try{
     if(message.op==='authenticate'){
      this.verified=false;await this.oauth.authenticate({signal,reauthorize:message.reauthorize===true,onOpening:()=>this.send({id,type:'auth',state:'opening_browser'})});checkAbort(signal);
      this.send({id,type:'auth',state:'authorized',...this.status(),busy:null});
     }else if(message.op==='models'){
      const models=await this.inference.models(signal);checkAbort(signal);this.send({id,type:'models',models,verified:false});
     }else if(message.op==='chat'){
      await this.inference.chat(message,text=>{checkAbort(signal);this.send({id,type:'delta',text});},signal);checkAbort(signal);this.verified=true;this.send({id,type:'done',reason:'completed',verified:true});
     }
    }catch(error){checkAbort(signal);if(['AUTH_REQUIRED','PLAN_PERMISSION_REQUIRED','FORBIDDEN','NOT_ELIGIBLE'].includes(error.code))this.verified=false;throw error;}
    finally{if(this.active===active)this.active=null;}
   })();
   await active.promise;
  }catch(error){if(!this.closed)this.send({id,type:'error',...publicError(error)});}
 }
 async close(){this.closed=true;this.signoutController?.abort();if(this.active){this.active.controller.abort();await this.active.promise?.catch(()=>{});}await this.signoutTask?.catch(()=>{});this.store.tokens=null;}
}
module.exports={Service,HOST};
