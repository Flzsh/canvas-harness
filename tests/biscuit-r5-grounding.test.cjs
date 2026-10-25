'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Engine=require('../extension/biscuit-engine.js');
const pack={tier:'basic',features:{charMax:0},models:{action:{labels:['open/find'],scale:1,weights:{bias:[1],'w:open':[1]}},item:{labels:['yes'],scale:1,weights:{bias:[1]}}}},s={now:1792730000000,courses:[{id:'class',name:'Paleobotany'}],pages:[{id:'page',title:'Bennettitalean leaf structure',courseId:'class'}]};
test('unsupported multiword input does not return an arbitrary course',()=>{const result=Engine.create({pack}).evaluate('zorbled flarnocks',s);assert.equal(result.action,'none');assert.equal(result.items.length,0);assert.match(result.message,/match/i);});
test('new loaded vocabulary remains searchable without having appeared in training',()=>{const result=Engine.create({pack}).evaluate('Bennettitalean leaf structure',s);assert.notEqual(result.action,'none');});
