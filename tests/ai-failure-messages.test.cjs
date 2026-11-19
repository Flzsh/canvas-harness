'use strict';
// AI help turned on, things going wrong (stability check 2026-11-14): each stop says what happened in plain words
// instead of raw browser text, and none of them throws out of the delivery.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Delivery=require('../extension/ai-delivery-web.js'),DeliveryAPI=require('../extension/ai-delivery-api.js');
const turnId='turn-5c0a1b2d-e3f4',CHAT='https://chatgpt.com/c/6adff4f1-c5cc-83ea',START='https://chatgpt.com/?temporary-chat=true';
const inspectTurn=()=>{},readStudyBlock=()=>{},insertDraft=()=>{},setEffort=()=>{};
async function deliver({tab,receipt,exec,now=100000,sourceTabGone=false,fresh=false}){
 const chrome={permissions:{contains:async()=>true},storage:{session:{get:async()=>({}),set:async()=>{}},local:{get:async()=>({})}},
  windows:{get:async()=>({type:'normal'})},
  tabs:{get:async id=>{if(id===1){if(sourceTabGone)throw Error('No tab with id: 1.');return {id:1,windowId:3};}if(!tab)throw Error('No tab with id: '+id);return {id,status:'complete',...tab};},
   update:async(id,o)=>({id,...o}),create:async o=>({id:9,...o})},
  scripting:{executeScript:async o=>exec(o)}};
 const d=Delivery.create({chrome,fetch:async()=>({ok:false}),inject:{inspectTurn,readStudyBlock,insertDraft,setEffort},
  providers:{get:()=>({label:'ChatGPT',url:'https://chatgpt.com/',origins:['https://chatgpt.com/*']})},now:()=>now,scriptTimeout:20});
 const run={provider:'chatgpt',kind:'ask',scope:'s',sourceTab:1,turns:[{id:turnId,text:'x',expectedKind:'prepare',deliveryReceipt:receipt,...(fresh?{fresh:true}:{})}],turnIndex:0,lease:{epoch:1}};
 return d.deliver(run.turns[0],async()=>{},{run,guard:async()=>{},claimProvider:async()=>{}});
}

test('offline or an error page in the AI tab: a plain message and Open chat, not raw browser text',async()=>{
 const out=await deliver({tab:{url:START},receipt:{v:1,tabId:5,origin:'https://chatgpt.com',conversationURL:START,status:'target',at:99000},
  exec:async()=>{throw Error('Frame with ID 0 is showing error page');}});
 assert.equal(out.status,'needs-you');assert.match(out.needsYou.reason,/page did not load\. Check your connection/);assert.equal(out.needsYou.action,'Open chat');
 assert.doesNotMatch(out.needsYou.reason,/Frame with ID/);
});

test('the Canvas tab that asked was closed before the chat opened: said so, with Try again',async()=>{
 const out=await deliver({tab:null,receipt:undefined,exec:async()=>[{result:{status:'ready'}}],sourceTabGone:true,fresh:true});
 assert.equal(out.status,'needs-you');assert.match(out.needsYou.reason,/Canvas tab that asked was closed/);assert.equal(out.needsYou.action,'Try again');
});

test('a usage limit with nothing made names the limit and keeps the AI\'s own words',async()=>{
 const exec=async o=>o.func===readStudyBlock?[{result:{status:'provider-error',message:'You\'ve reached',limit:true,text:'You\'ve reached your limit. Try again after 5:00 PM.'}}]:[{result:{status:'sent'}}];
 const out=await deliver({tab:{url:CHAT},receipt:{v:1,tabId:5,origin:'https://chatgpt.com',conversationURL:CHAT,status:'sent',sentAt:99000,at:1000},exec});
 // (job W, 4.0.167: the site's name and its own words, and that nothing more was sent)
 assert.match(out.needsYou.reason,/^ChatGPT says: You've reached your limit\. Try again after 5:00 PM\. Nothing more was sent\. Try again later, or choose another AI in Your AI\.$/);
 assert.equal(out.needsYou.manual,true,'nothing is sent again on its own');
});

test('an API key refused by the provider says "API key problem.", not "may have been sent"',async()=>{
 const api={generate:async(scope,payload,o)=>{await o.beforeSend();throw Error('API key problem.');}};
 const out=await DeliveryAPI.create({api}).deliver({text:'x',messages:[]},async()=>{},{run:{scope:'s',connectionRevision:1},guard:async()=>{},signal:new AbortController().signal});
 assert.equal(out.needsYou.reason,'API key problem.');
 const unclear={generate:async(scope,payload,o)=>{await o.beforeSend();throw Error('Failed to fetch');}};
 const maybe=await DeliveryAPI.create({api:unclear}).deliver({text:'x',messages:[]},async()=>{},{run:{scope:'s',connectionRevision:1},guard:async()=>{},signal:new AbortController().signal});
 assert.match(maybe.needsYou.reason,/may have been sent/,'an unclear failure after the send still says it may have gone');
});
