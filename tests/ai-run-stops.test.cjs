'use strict';
// A run in the Help band (owner, 2026-10-30): Canvas moved a worksheet's updated_at 19 seconds after the request went to
// the AI, the run stopped, and the frozen track still said "Reading ..." beside the message, which looked like lag.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Canvas=require('../extension/ai-canvas.js');
const ID='assignment:5:9',SEEN='2026-10-30T10:00:00Z',LATER='2026-10-30T10:02:00Z';
const run=()=>({snapshot:{index:[[ID,{what:'assignment',courseId:'5',canvasId:'9',title:'Worksheet',version:SEEN}]]}});
const reading=value=>Canvas.create({client:{readAssignment:async()=>value},scope:'s',store:{get:()=>({customTasks:[]})},run:{},local:{get:async()=>({})},fetchImpl:async()=>{throw Error('No network in this test.');},now:()=>0});

test('a new Canvas time alone never stops a run, before an action or while reading: the newest text is what gets read',async()=>{
 const value={id:9,name:'Worksheet',description:'<p>Questions 1 to 9.</p>',updated_at:LATER,published:true},api=reading(value);
 await api.validate(run(),[ID]);
 const result=await api.reader(run()).read({what:'assignment',id:ID});
 assert.equal(result.fatal,undefined);assert.equal(result.error,undefined);assert.match(result.text,/Questions 1 to 9/);
});

for(const [name,value]of [['locked',{locked_for_user:true}],['unpublished',{published:false}]])test('a source that is now '+name+' still stops the run, with its Refresh Canvas message',async()=>{
 const api=reading({id:9,name:'Worksheet',description:'<p>Text</p>',updated_at:SEEN,...value});
 await assert.rejects(api.validate(run(),[ID]),/Canvas instructions changed/);
 const result=await api.reader(run()).read({what:'assignment',id:ID});
 assert.equal(result.fatal,true);assert.equal(result.code,'source-changed');
});

test('the band hides its drawn track with the attribute: an SVG element has no hidden property, so a stopped run would keep its last step',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../extension/study-band.js'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../extension/study-band.css'),'utf8');
 assert.match(js,/track=svg\('svg',\{class:'ch-progress'/);
 assert.match(js,/track\.toggleAttribute\?\.\('hidden',!live\)/);assert.doesNotMatch(js,/\btrack\.hidden\s*=/);
 assert.match(css,/\.ch-progress\[hidden\]\{display:none\}/);
});
