'use strict';
// After Enter on "what is due tomorrow" Biscuit opens the first thing and shows the list again with Undo. The action's
// message says the whole list in one sentence; as the card's heading that was five bold lines over the same list (seen
// 2026-11-23, in 4.0.199 too). The heading stays the list's own; the sentence is still what is read out.
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../extension/biscuit-answer.js');
const rows=['Translate lines 1-20','Reaction rates: lab preparation','Partial derivatives: practice set','Close reading: chapter three','Reading quiz: Nicomachean Ethics II'].map((name,i)=>({type:'work',id:'1'+i,name}));
const list={v:1,kind:'list',title:'Due tomorrow',summary:'5 things · about 3 h',rows,notes:[],acts:[],follow:[]};
const sentence='5 things due tomorrow: Translate lines 1-20 (Latin Literature Sem 1, 12:59 AM) and Reaction rates: lab preparation (Chemistry-Section A, 1:59 AM) and Partial derivatives: practice set (Multivariable Calculus, 2:59 AM) and 2 more.';
test('an action on a list keeps the list\'s heading when its message says the list again',()=>{
 const a=A.result('find',{}, {ok:true,message:sentence},{},list);
 assert.equal(a.title,'Due tomorrow');assert.equal(a.summary,'5 things · about 3 h');
 assert.equal(a.text,sentence,'the sentence is still the text that is read out');
 assert.equal(a.rows.length,5,'and the rows are the list');assert.equal(a.kind,'done');
});
test('a message that is not the list again stays the heading',()=>{
 assert.equal(A.result('open',{}, {ok:true,message:'Opened Translate lines 1-20.'},{},list).title,'Opened Translate lines 1-20.');
 assert.equal(A.result('complete',{}, {ok:true,message:'Marked done.'},{},list).title,'Marked done.');
 assert.equal(A.result('find',{}, {ok:true,message:sentence},{},{...list,rows:rows.slice(0,1)}).title,sentence,'one row is not a list');
 assert.equal(A.result('find',{}, {ok:true,message:sentence},{},null).title,sentence,'nothing before it: the message is all there is');
});
test('a failed action still says what went wrong',()=>{
 const a=A.result('find',{}, {ok:false,message:sentence},{},list);assert.equal(a.kind,'error');assert.equal(a.title,sentence);
});
