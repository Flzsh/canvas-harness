'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Engine=require('../extension/biscuit-engine.js');
const world=()=>({now:Date.parse('2026-10-22T16:00:00Z'),timeZone:'America/New_York',companion:{name:'Maple'},catalogue:[{id:'pack:maple',name:'Maple',kind:'pet'}],workItems:[],courses:[]});
test('real engine retains catalogue commands, unknown-name gating and current companion identity',()=>{
 const E=Engine.create(),s=world();assert.equal(E.evaluate('use Maple',s).next.action,'installed');assert.equal(E.evaluate('use Maple',s).next.fields.id,'pack:maple');assert.equal(E.evaluate('who are you',s).next.fields.action,'name');assert.equal(E.evaluate('use Imaginary pet',s).action,'none');assert.equal(E.evaluate('give Maple a treat',s).next.fields.action,'treat');
});
