'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Intent=require('../extension/biscuit-intent.js'),Selection=require('../extension/biscuit-selection.js'),Engine=require('../extension/biscuit-engine.js');
const now=Date.UTC(2030,2,12,12),snapshot=()=>({now,timeZone:'UTC',courses:[{id:'C',name:'Coastal Inquiry'}],selectedItemId:'guide',pages:[{id:'guide',title:'Accommodation guide',courseId:'C',text:'Approved formats and the school accommodation procedure.'}]}),pack={tier:'basic',features:{charMax:0},patterns:[],models:{action:{labels:['open/find'],weights:{}},item:{weights:{page:[10],title:[1]}}}};
test('source anaphora retains its nearest stated source without changing action scope',()=>{
 for(const [prefix,goal]of [['The unread chemistry approval from Mira Chen arrived at 14:20.','Could you find it?'],['The corrected coastal notice replaces the earlier room.','Can you retrieve its attachment?']]){const raw=prefix+' '+goal,action=Intent.requestSpan(raw),source=Intent.sourceSpan(raw);assert.ok(!action.includes(prefix));assert.ok(source.includes(prefix.slice(0,-1)),source);assert.ok(source.endsWith(action));}
});
test('an explicit new source object excludes unrelated background from its scope',()=>{
 const raw='The original announcement describes an earlier room. Could you open this accommodation guide?';assert.equal(Intent.sourceSpan(raw),Intent.requestSpan(raw));assert.equal(Selection.sourceIntent(raw).kind,null);assert.equal(Selection.sourceIntent(raw).otherContainer,true);
 const literal='Save a personal note exactly "The announcement says find its attachment."';assert.equal(Intent.sourceSpan(literal),Intent.requestSpan(literal));
});
test('requested document and control ownership precedes message and approval topics',()=>{
 for(const line of ['Who approved this accommodation guide?','Show the notification controls for Canvas messages.','Open the reference page about Inbox conversations.']){const intent=Selection.sourceIntent(line);assert.equal(intent.kind,null,line);assert.equal(intent.otherContainer,true,line);}
 const result=Engine.create({pack}).evaluate('Who approved this accommodation guide?',snapshot());assert.equal(result.items[0].id,'guide');assert.notEqual(result.action,'none');assert.doesNotMatch(result.message,/No matching conversation/);
});
test('explicit unavailable conversations still abstain, while inferred approval is not an authoritative empty container',()=>{
 const s=snapshot(),result=Engine.create({pack}).evaluate('Open the unread conversation about accommodation.',s);assert.equal(result.action,'none');assert.match(result.message,/No matching unread conversation/);
 assert.equal(Selection.sourceIntent('Who approved this?').explicit,false);assert.equal(Selection.sourceIntent('Open the approval conversation.').explicit,true);
});
test('a current replacement request does not inherit the antecedent original preference',()=>{
 const raw='The original notice said room 104. Could you find its replacement?',intent=Selection.sourceIntent(raw);assert.equal(intent.kind,'announcement');assert.equal(intent.original,false);assert.equal(intent.correction,true);
});
