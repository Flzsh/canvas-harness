'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../extension/themes/stars/sky.js'),'utf8');
function fixture({hidden=false,reduced=false,search='?embed'}={}){
 const events=new Map(),documentEvents=new Map(),reducedEvents=new Map(),calls=[],messages=[];
 const target=map=>({addEventListener:(name,fn)=>map.set(name,fn),removeEventListener:(name,fn)=>{if(map.get(name)===fn)map.delete(name);}});
 const canvas={hidden:true,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:300})},poster={hidden:false};
 const document={...target(documentEvents),documentElement:target(new Map()),hidden,visibilityState:hidden?'hidden':'visible',getElementById:id=>id==='c'?canvas:poster};
 const media={...target(reducedEvents),matches:reduced},parent={postMessage:(data,origin)=>messages.push({data,origin})};
 const env={...target(events),document,parent,location:{search},URLSearchParams,matchMedia:()=>media,ReserveSceneThemes:{createStarSky:()=>{
  calls.push(['create']);return {pause:value=>calls.push(['pause',value]),aim:(...args)=>calls.push(['aim',...args]),resize:()=>calls.push(['resize']),destroy:()=>calls.push(['destroy'])};
 }}};
 vm.runInNewContext(source,env,{filename:'themes/stars/sky.js'});
 return {env,events,documentEvents,reducedEvents,document,canvas,poster,calls,messages,parent,visibility(value){document.hidden=value;document.visibilityState=value?'hidden':'visible';documentEvents.get('visibilitychange')?.();},reduce(value){media.matches=value;reducedEvents.get('change')?.();},message(data,sender=parent){events.get('message')?.({source:sender,data});}};
}
test('Starfield helper rests without creating a renderer when hidden, still or reduced',()=>{
 for(const options of [{hidden:true},{reduced:true},{search:'?embed&still'}]){const h=fixture(options);assert.equal(h.canvas.hidden,true);assert.equal(h.poster.hidden,false);assert.equal(h.calls.length,0);assert.equal(h.messages.length,1);assert.equal(h.messages[0].origin,'*');}
});
test('Starfield helper shares one renderer and pauses on live visibility and motion changes',()=>{
 const h=fixture();assert.equal(h.canvas.hidden,false);assert.deepEqual(h.calls,[['create'],['pause',false]]);
 h.visibility(true);assert.deepEqual(h.calls.at(-1),['pause',true]);assert.equal(h.poster.hidden,false);h.visibility(false);h.reduce(true);assert.equal(h.canvas.hidden,true);h.reduce(false);assert.equal(h.canvas.hidden,false);assert.equal(h.calls.filter(call=>call[0]==='create').length,1);
 h.events.get('pagehide')();assert.deepEqual(h.calls.at(-1),['destroy']);assert.equal(h.events.size,0);assert.equal(h.documentEvents.size,0);assert.equal(h.reducedEvents.size,0);
});
test('only its embedding parent can pause or aim the packaged sky and coordinates are bounded',()=>{
 const h=fixture(),before=h.calls.length;h.message({pause:true},{});h.message({lens:1,x:.5,y:.5,inside:true},{});assert.equal(h.calls.length,before);
 h.message({lens:1,x:2,y:.5,inside:true});assert.equal(h.calls.length,before);h.message({lens:1,x:.25,y:.5,inside:true});assert.deepEqual(h.calls.at(-1),['aim',.25,.5,true]);
 h.message({pause:true});assert.equal(h.canvas.hidden,true);const paused=h.calls.length;h.message({lens:1,x:.5,y:.5,inside:true});assert.equal(h.calls.length,paused);h.message({pause:false});assert.equal(h.canvas.hidden,false);
});
