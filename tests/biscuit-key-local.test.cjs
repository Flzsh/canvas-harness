'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../extension/biscuit-parse.js'),M=require('../extension/customization-model.js'),F=require('../extension/features.js'),B=require('../extension/pony-brain.js'),W=require('../extension/workspace-arrange.js');
const ctx={now:Date.parse('2026-05-11T16:00:00Z'),timeZone:'America/New_York',courses:[],workItems:[]},first=q=>P.parse(q,ctx)[0];
test('Biscuit setting values stay aligned with every customization enum and boolean',()=>{
 for(const [key,values] of Object.entries(M.enums))for(const value of values)assert.deepEqual(first('set '+key+' to '+(value||'none')).fields,{key,value});
 for(const [key,value] of Object.entries(M.defaults))if(typeof value==='boolean')for(const on of [true,false])assert.deepEqual(first('set '+key+' '+on).fields,{key,value:on});
});
// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).
test('new command typos remain local and note text retains its own spelling and case',()=>{
 for(const [text,intent,fields] of [['drak mode','setting',{key:'theme',value:'dark'}],['trun off play tools','feature',{id:'play',on:false}],['blueprnit theme','setting',{key:'sceneTheme',value:'blueprint'}],['show grdaes','setting',{key:'showGrades',value:true}],['wrtie down Brign Gogles','note',{text:'Brign Gogles'}],['ntoe: Brign Gogles','note',{text:'Brign Gogles'}]]){const result=first(text);assert.equal(result.intent,intent,text);assert.deepEqual(result.fields,fields,text);}
});
test('quiet uses the supplied local clock across midnight and DST without mutating context',()=>{
 const parse=(q,now,timeZone)=>P.parse(q,{...ctx,now:Date.parse(now),timeZone})[0];assert.equal(parse('quiet until 1','2026-05-12T03:30:00Z','America/New_York').fields.minutes,90);assert.equal(parse('quiet until 4am','2026-03-08T06:00:00Z','America/New_York').fields.minutes,120);assert.equal(parse('quiet until 3pm','2026-05-11T08:30:00Z','Asia/Kolkata').fields.minutes,60);assert.deepEqual(P.parse('quiet for 0 minutes',ctx),[]);
});
test('warm local parsing of a 200-character line stays below 2 ms on average',()=>{
 for(const text of ['dark mode','remind me tomorrow at 7pm to '+ 'bring goggles '.repeat(20),'unfamiliar '.repeat(30)]){const line=text.padEnd(200,' ').slice(0,200);first(line);const start=performance.now();for(let i=0;i<500;i++)first(line);assert.ok((performance.now()-start)/500<2);}
});
