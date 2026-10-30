/* Reuse API secret/quota/revision guards. An ambiguous dispatch is never repeated. */
(function(root){'use strict';const api={create({api,now=()=>Date.now()}){async function step(turn,checkpoint,{run,guard,signal}){
  if(turn.deliveryReceipt)return {status:'needs-you',receipt:turn.deliveryReceipt,needsYou:{reason:'The API request may have been sent. Import its reply or start a new run.',action:'Review settings'}};
  await guard();let receipt;
  try{
    const answer=await api.generate(run.scope,{text:turn.text,messages:turn.messages},{revision:run.connectionRevision,signal,beforeSend:async()=>{
      await guard();
      receipt={v:1,status:'dispatch-intent',at:now()};
      await checkpoint(receipt);
      await guard();
    }});
    await guard();
    if(answer?.status!=='answer')throw Error(answer?.message||'The API did not return an answer.');
    return {status:'reply',receipt:{...receipt,status:'sent'},reply:answer.text};
  }
  catch(error){return {status:'needs-you',receipt,needsYou:{reason:receipt?'The API request may have been sent. Review or import its reply.':String(error.message||error),action:'Review settings'}};}
 }return {deliver:step,observe:step,recover:step,cancel:async()=>({stoppedLocally:true,remoteMayContinue:true})};}};
 root.CanvasHarnessDeliveryAPI=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
