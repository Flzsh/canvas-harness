'use strict';
// A ChatGPT turn that ends with thinking only is a stopped turn (live, 2026-10-25: it searched Drive, then wrote nothing),
// so the engine can retry once in a fresh chat instead of waiting forever.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Delivery=require('../extension/ai-delivery-web.js'),turnId='turn-5c0a1b2d-e3f4',fence='```';
const user={message:{author:{role:'user'},content:{content_type:'text',parts:['[[Canvas Harness agent '+turnId+']]\nprompt']}},children:['t']};
const thinking={message:{author:{role:'assistant'},content:{content_type:'thoughts'},status:'finished_successfully',end_turn:false},children:[]};
const answer={message:{author:{role:'assistant'},content:{content_type:'text',parts:[fence+'json\n{"cards":[]}\n'+fence]},status:'finished_successfully',end_turn:true},children:[]};
function read(mapping,stream,{later}={}){let reads=0;const fetch=async url=>{const json=url.endsWith('/api/auth/session')?{accessToken:'tok'}:url.endsWith('/stream_status')?{status:stream}:{mapping:later&&reads++>0?later:mapping};return {ok:true,json:async()=>json};};
 return Delivery.chatRecord({fetch,conversationURL:'https://chatgpt.com/c/6ade43ee-27bc-83ea',turnId,since:0,detail:true});}
test('thinking only and a finished stream reads as stopped',async()=>{
 assert.deepEqual(await read({u:user,t:thinking},'COMPLETE'),{stopped:true});
});
test('thinking only while the stream is still going keeps waiting',async()=>{
 assert.deepEqual(await read({u:user,t:thinking},'IS_STREAMING'),{});
 assert.deepEqual(await read({u:{...user,children:[]}},'COMPLETE'),{},'nothing has begun yet');
});
test('an answer that lands between the two reads is kept, not called stopped',async()=>{
 const got=await read({u:user,t:thinking},'COMPLETE',{later:{u:user,t:{...thinking,children:['r']},r:answer}});assert.ok(got.reply?.includes('"cards"'));
});
test('the plain form still returns the answer text only',async()=>{
 const fetch=async url=>({ok:true,json:async()=>url.endsWith('/api/auth/session')?{accessToken:'tok'}:{mapping:{u:user,t:{...thinking,children:['r']},r:answer}}});
 assert.match(await Delivery.chatRecord({fetch,conversationURL:'https://chatgpt.com/c/6ade43ee-27bc-83ea',turnId,since:0}),/"cards"/);
});
test('the instructions keep the AI on the message instead of connected apps',()=>{
 const Study=require('../extension/study-prompts.js');for(const m of [Study.buildPrepare({brief:'x',now:0,timeZone:'UTC'}),Study.buildAsk({question:'q',brief:'x',now:0,timeZone:'UTC'})])assert.match(m,/do not search Drive, connected apps, files or the web/);
});
test('a new ChatGPT chat opens as a temporary chat and a Claude chat as incognito by default; switched off, the normal new chat',async()=>{
 const open=async (flag,id='chatgpt',url='https://chatgpt.com/',model='')=>{const created=[];
  const chrome={permissions:{contains:async()=>true},storage:{session:{get:async()=>({}),set:async()=>{}},local:{get:async key=>key==='ch-ai-temporary-chat'&&flag===false?{[key]:false}:key==='ch-ai-test-model'&&model?{[key]:model}:{}}},
   windows:{get:async()=>({type:'normal'})},tabs:{get:async id=>id===1?{id:1,windowId:1}:{id,status:'loading',url:''},create:async o=>{created.push(o.url);return {id:5,url:o.url};},update:async()=>{throw Error('no update');}}};
  const delivery=Delivery.create({chrome,inject:{},providers:{get:()=>({url,origins:[new URL(url).origin+'/*']})},now:()=>1000});
  const receipts=[],result=await delivery.deliver({id:turnId,text:'x',expectedKind:'prepare',fresh:true},async r=>{receipts.push(r);},{run:{provider:id,kind:'ask',scope:'s',sourceTab:1,turns:[],turnIndex:0},guard:async()=>{},claimProvider:async()=>{}});
  return {created,result,receipt:receipts.at(-1)};};
 const on=await open(true);assert.deepEqual(on.created,['https://chatgpt.com/?temporary-chat=true']);assert.equal(on.receipt.conversationURL,'https://chatgpt.com/?temporary-chat=true');assert.equal(on.result.status,'waiting');
 const off=await open(false);assert.deepEqual(off.created,['https://chatgpt.com/']);
 assert.deepEqual((await open(true,'claude','https://claude.ai/new')).created,['https://claude.ai/new?incognito']);
 assert.deepEqual((await open(true,'deepseek','https://chat.deepseek.com/')).created,['https://chat.deepseek.com/'],'an AI without such a mode opens its normal new chat');
 assert.deepEqual((await open(true,'chatgpt','https://chatgpt.com/','gpt-6-instant')).created,['https://chatgpt.com/?temporary-chat=true&model=gpt-6-instant'],'the test switch picks the model');
 assert.deepEqual((await open(false,'chatgpt','https://chatgpt.com/','gpt-5-6-mini')).created,['https://chatgpt.com/?model=gpt-5-6-mini']);
 assert.deepEqual((await open(true,'chatgpt','https://chatgpt.com/','x y')).created,['https://chatgpt.com/?temporary-chat=true'],'never an odd value');
 assert.deepEqual((await open(true,'claude','https://claude.ai/new','gpt-6-instant')).created,['https://claude.ai/new?incognito'],'ChatGPT only');
});
test('a typed draft that is ready is sent even when the chat took longer than the composer window to get there',async()=>{
 const clicks=[],chrome={permissions:{contains:async()=>true},storage:{session:{get:async()=>({}),set:async()=>{}},local:{get:async()=>({})}},tabs:{get:async id=>({id,status:'complete',url:'https://chatgpt.com/'})},scripting:{executeScript:async({args})=>{if(args[0]?.mode==='click'){clicks.push(1);return [{result:{status:'waiting',clicked:true}}];}return [{result:{status:'ready'}}];}}};
 const delivery=Delivery.create({chrome,inject:{inspectTurn:()=>{}},providers:{get:()=>({url:'https://chatgpt.com/',origins:['https://chatgpt.com/*']})},now:()=>200000});
 const receipt={v:1,tabId:5,origin:'https://chatgpt.com',conversationURL:'https://chatgpt.com/',status:'staged',at:100000},saved=[];
 const result=await delivery.deliver({id:turnId,text:'x',expectedKind:'prepare',fresh:true,deliveryReceipt:receipt},async r=>{saved.push(r);},{run:{provider:'chatgpt',kind:'ask',scope:'s',sourceTab:1,turns:[],turnIndex:0,lease:{epoch:1}},guard:async()=>{},claimProvider:async()=>{}});
 assert.equal(result.status,'waiting');assert.equal(clicks.length,1,'Send was clicked');assert.equal(saved.at(-1).status,'send-intent');
});
test('a Claude reply is read from Claude\'s chat record; a finished turn with no text is stopped; an unfinished one waits',async()=>{
 const conv=messages=>({chat_messages:messages}),human={uuid:'h1',index:0,sender:'human',content:[{type:'text',text:'[[Canvas Harness agent '+turnId+']]\nprompt'}]};
 const read=messages=>{const fetch=async url=>({ok:true,json:async()=>url.endsWith('/api/organizations')?[{uuid:'org-aaaaaaaa'}]:conv(messages)});return Delivery.claudeRecord({fetch,conversationURL:'https://claude.ai/chat/75e0f3b7-5e0e-458a?incognito',turnId});};
 assert.deepEqual(await read([human,{uuid:'a1',index:1,sender:'assistant',parent_message_uuid:'h1',stop_reason:'end_turn',content:[{type:'thinking',thinking:'...'},{type:'text',text:fence+'json\n{"cards":[]}\n'+fence}]}]),{reply:fence+'json\n{"cards":[]}\n'+fence});
 assert.deepEqual(await read([human,{uuid:'a1',index:1,sender:'assistant',parent_message_uuid:'h1',stop_reason:'end_turn',content:[{type:'thinking',thinking:'...'}]}]),{stopped:true});
 assert.deepEqual(await read([human,{uuid:'a1',index:1,sender:'assistant',parent_message_uuid:'h1',stop_reason:null,content:[{type:'text',text:'partial'}]}]),{},'still writing');
 assert.deepEqual(await read([{...human,content:[{type:'text',text:'someone else'}]}]),{},'never another chat\'s turn');
});
test('ChatGPT dropping ?model= from a new chat\'s address is the same chat, not a moved one',async()=>{
 const url='https://chatgpt.com/?temporary-chat=true&model=gpt-6-instant',seen=[];
 const chrome={permissions:{contains:async()=>true},storage:{session:{get:async()=>({}),set:async()=>{}},local:{get:async()=>({})}},tabs:{get:async id=>({id,status:'complete',url:'https://chatgpt.com/?temporary-chat=true'})},scripting:{executeScript:async({args})=>{seen.push(args[0]?.mode||'inspect');return [{result:{status:'ready'}}];}}};
 const delivery=Delivery.create({chrome,inject:{inspectTurn:()=>{}},providers:{get:()=>({url:'https://chatgpt.com/',origins:['https://chatgpt.com/*']})},now:()=>2000});
 const receipt={v:1,tabId:7,origin:'https://chatgpt.com',conversationURL:url,status:'target',at:1000},run={provider:'chatgpt',kind:'ask',scope:'s',sourceTab:1,turns:[{id:turnId,text:'x',expectedKind:'prepare',deliveryReceipt:receipt}],turnIndex:0};
 const result=await delivery.deliver(run.turns[0],async()=>{},{run,guard:async()=>{},claimProvider:async()=>{}});
 assert.notEqual(result.needsYou?.reason,'Return to the original chat');assert.ok(seen.length>0,'the chat page was checked');
});
test('a chat tab the browser froze right after the send is read from the chat its address names',async()=>{
 const frozen={id:7,status:'complete',frozen:true,url:'https://chatgpt.com/c/6adff4f1-c5cc-83ea?temporary-chat=true'},asked=[];
 const fetch=async url=>{asked.push(url);return {ok:true,json:async()=>url.endsWith('/api/auth/session')?{accessToken:'tok'}:url.endsWith('/stream_status')?{status:'COMPLETE'}:{mapping:{u:user,t:{...thinking,children:['r']},r:answer}}};};
 const chrome={permissions:{contains:async()=>true},storage:{session:{get:async()=>({}),set:async()=>{}},local:{get:async()=>({})}},tabs:{get:async()=>frozen},scripting:{executeScript:()=>new Promise(()=>{})}};
 const delivery=Delivery.create({chrome,fetch,inject:{inspectTurn:()=>{}},providers:{get:()=>({url:'https://chatgpt.com/',origins:['https://chatgpt.com/*']})},now:()=>100000,scriptTimeout:50});
 const receipt={v:1,tabId:7,origin:'https://chatgpt.com',conversationURL:'https://chatgpt.com/?temporary-chat=true&model=gpt-5-6-mini',status:'send-intent',at:1000,intentAt:2000},run={provider:'chatgpt',kind:'ask',scope:'s',sourceTab:1,turns:[{id:turnId,text:'x',expectedKind:'prepare',deliveryReceipt:receipt}],turnIndex:0};
 const result=await delivery.deliver(run.turns[0],async()=>{},{run,guard:async()=>{},claimProvider:async()=>{}});
 assert.equal(result.status,'reply');assert.match(result.reply,/"cards"/);assert.equal(result.receipt.conversationURL,frozen.url);assert.ok(asked.some(u=>u.includes('6adff4f1-c5cc-83ea')),'the chat its address names');
});
