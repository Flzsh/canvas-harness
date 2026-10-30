'use strict';
/* Independent static-review contracts, authored before the integer-key correction.
   UNRUN. Only the staged Learn source is read; no datasets or models are loaded. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const variant='proposed';assert.ok(['before','proposed'].includes(variant));
function load(){const env=vm.createContext({}),module={exports:{}};env.module=module;new vm.Script(fs.readFileSync(path.join(__dirname,'../extension/biscuit-learn.js'),'utf8')).runInContext(env);const Learn=module.exports;
 const oracle=new vm.Script('(function(model,x,kind,row){const bag={...x};bag["help:"+kind]=1;bag["help:"+kind+"|"+row.kind]=1;return ReserveBiscuitLearn.score(model,bag,true);})').runInContext(env);return {Learn,oracle};}
test('Proxy integer own keys are scored in the copied object integer order',()=>{
 const h=load(),x=new Proxy({'1':1e16,'2':-1e16,'3':1},{ownKeys:()=>['3','2','1']}),m={weights:{'1':[1],'2':[1],'3':[1]},scale:1};
 assert.equal(h.oracle(m,x,'ask',{kind:'file'}),1);assert.equal(h.Learn.scoreWithHelp(m,x,'ask',{kind:'file'}),1);
});
test('integer boundaries, leading zero names and symbol getters preserve complete snapshots',()=>{
 const h=load();function run(overlay){const calls=[],symbol=Symbol('s'),source={'4294967294':1e16,'4294967295':-1e16,'01':1,'3':2};Object.defineProperty(source,symbol,{enumerable:true,get(){calls.push('symbol');return 9;}});
  const x=new Proxy(source,{ownKeys:()=>['01','4294967295',symbol,'4294967294','3']}),m={weights:{'4294967294':[1],'4294967295':[1],'01':[1],'3':[1]},scale:1};return {score:overlay?h.Learn.scoreWithHelp(m,x,'ask',{kind:'file'}):h.oracle(m,x,'ask',{kind:'file'}),calls};}
 assert.deepEqual(run(true),run(false));
});
test('accessor fallback retains the last spread value when Help names already exist',()=>{
 const h=load();function run(overlay){const calls=[],x={get 'help:ask'(){calls.push('help');return 700;},a:2,get 'help:ask|file'(){calls.push('typed');return -99;}},m={weights:{a:[3],'help:ask':[5],'help:ask|file':[7]},scale:1};return {score:overlay?h.Learn.scoreWithHelp(m,x,'ask',{kind:'file'}):h.oracle(m,x,'ask',{kind:'file'}),calls};}
 assert.deepEqual(run(true),run(false));assert.equal(run(true).score,18);
});
