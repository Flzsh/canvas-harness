'use strict';
// The land painter (themes/train/painter.js) run in Node with a WebGL2 that only listens: every program it makes, every uniform it
// sets and every draw it asks for is written down, so a test can see where a sprite is drawn and from which cell, without a GPU.
// paint(source, scene, moments) -> {calls, looks, motion}: the painter is made, shown the scene (its pictures read), then drawn once
// at each moment (ms on its clock; a still frame, as when it rests or is shown again); calls: [what, program, uniform, ...values]
// in order, with ['moment', ms] before each moment's calls; looks: what its own peek saw at each moment. refuse: a pattern of
// shader source this GPU will not build.
const vm=require('node:vm');
// a program is named by what its fragment shader declares (the sprite's two programs and the land's; the rest by their first uniform)
const nameOf=fs=>/uniform vec4 uCell,uCell2,uQuad,uShadow,uTurn,uPivot;/.test(fs)?'spriteT':/uniform vec4 uCell;uniform vec4 uQuad;/.test(fs)?'sprite':/uFlowMax/.test(fs)?'land':/uPAlpha/.test(fs)?'part':(/uniform \w+ (\w+)/.exec(fs)||[,'?'])[1];
function listeningGL(calls,shaders,refuse=null){
 let id=1,current=null;
 const gl={
  createProgram(){return {id:id++,srcs:[],names:[],tag:''};},
  createShader(type){return {id:id++,type,src:''};},
  shaderSource(s,src){s.src=src;},
  attachShader(p,s){p.srcs.push(s.src);},
  linkProgram(p){p.names=[...new Set(p.srcs.flatMap(src=>[...src.matchAll(/uniform\s+\w+\s+([^;]+);/g)].flatMap(m=>m[1].split(',').map(n=>n.trim()))))];p.fs=p.srcs[1]||'';p.tag=/uniform float uK,uSince,/.test(p.srcs[0]||'')?'burst':nameOf(p.fs);shaders[p.tag]=p.fs;},
  getShaderParameter(s){return !(refuse&&refuse.test(s.src));},
  getProgramParameter(p,what){return what==='ACTIVE_UNIFORMS'?p.names.length:true;},
  getActiveUniform(p,i){return {name:p.names[i]};},
  getUniformLocation(p,name){return {p,name};},
  useProgram(p){current=p;calls.push(['use',p.tag]);},
  drawArrays(){calls.push(['draw',current?.tag]);},
  drawArraysInstanced(mode,first,count,n){calls.push(['drawn',current?.tag,n]);},
  getExtension(){return null;},isContextLost(){return false;},getParameter(){return 0;},getQueryParameter(){return 0;},
 };
 return new Proxy(gl,{get(t,k){
  if(k in t)return t[k];
  if(typeof k!=='string')return undefined;
  if(/^[A-Z0-9_]+$/.test(k))return k;
  if(/^uniform/.test(k))return (loc,...v)=>{if(loc)calls.push([k,loc.p.tag,loc.name,...v]);};
  if(/^create/.test(k))return ()=>({id:id++});
  return ()=>{};
 }});
}
// sizes of the pictures a scene names (the sheet's is the scene's own)
const sizeOf=(name,sheet)=>/^sprites-/.test(name)?sheet:/^land-/.test(name)?[4096,256]:/^page-/.test(name)?[4096,1738]:/^under/.test(name)?[2048,900]:[1024,563];
async function paint(source,scene,moments,{sheet=[840,34],width=1440,height=900,refuse=null}={}){
 const calls=[],shaders={};let T=0;
 const gl=listeningGL(calls,shaders,refuse),canvas={className:'',width:0,height:0,setAttribute(){},getContext:()=>gl,addEventListener(){},remove(){}};
 const doc={createElement:()=>canvas,documentElement:{clientWidth:width,clientHeight:height}};
 const env={performance:{now:()=>T},devicePixelRatio:1,requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},
  createImageBitmap:async blob=>{const [w,h]=sizeOf(blob.name,sheet);return {width:w,height:h,close(){}};},
  ReserveSceneThemes:{travel:{at:()=>({v:0,a:0,x:0}),bounds:{surge:11}},reader:base=>async url=>({ok:true,blob:async()=>({name:url.slice(base.length)})})}};
 vm.createContext(env);vm.runInContext(source,env);
 const P=env.ReserveTrainPainter,painter=P.make(doc,'ext://train/',{on:{}});
 if(!painter)throw Error('the painter was not made');
 painter.look(true);
 const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
 const looks=[];
 painter.show(scene);await flush();
 if(!painter.drawn)throw Error('the painter did not draw');
 calls.length=0;
 for(const ms of moments){T=ms;calls.push(['moment',ms]);painter.show(scene);await flush();looks.push({ms,sprites:JSON.parse(JSON.stringify(painter.stats.sprites||[]))});}
 return {calls:JSON.parse(JSON.stringify(calls)),looks,shaders,motion:P.motion};
}
// one record per draw of a program: the moment, and every uniform it has set by then since it was put in use
function drawsOf(calls,program){
 const out=[];let cur=null,ms=null;
 for(const c of calls){
  if(c[0]==='moment'){ms=c[1];cur=null;continue;}
  if(c[0]==='use'){cur=c[1]===program?{ms,uniforms:{}}:null;continue;}
  if(!cur)continue;
  if(/^uniform/.test(c[0]))cur.uniforms[c[2]]=c.slice(3);
  if(c[0]==='draw'){out.push(cur);cur={ms,uniforms:{...cur.uniforms}};}
 }
 return out;
}
// a land as the land's page shows it to the painter (page.js): the window's strips, the page's travelling layers, a sheet of one
// stage, High; its sprites from the live file given (liveOf reads it first)
const sceneOf=(live,{moving=1,stage='noon',land='test'}={})=>({land,hours:[[stage,1]],info:{stages:{},move:[[1,39],[2,78],[3,234]],live:1,sprites:1},
 lands:{layers:[{speed:0,still:true},{speed:1.2},{speed:3}]},live,win:{x:-180,y:36},k:.36,page:{x:-260,top:330},moving,epoch:0,ride:{},quality:2,floor:0});
// sprites without any of the motion words, of every kind the engine knew before them: frames in a row and in rows with a dissolve,
// a bob, a shadow, a loop box, one that faces the other way, one fixed to the train, one in the window, the rest under the room
const PLAIN={v:1,layers:[],sprites:[
 {id:'ship',frame:[0,0,84,34],frames:4,fps:5,layer:1.6,at:[1480,1690],scale:1,path:{vx:-9,bob:[2,.4]},shadow:[116,85,154,.5],stages:'all'},
 {id:'plane',frame:[0,0,84,34],frames:10,fps:10,layer:.6,at:[600,120],scale:.8,path:{vx:80},stages:'all'},
 {id:'kite',frame:[84,0,84,34],layer:.6,at:[2400,200],scale:1.5,path:{vx:30},face:'left',stages:'all'},
 {id:'grip',frame:[0,0,84,17],frames:16,cols:5,tween:1,fps:4.8,layer:2,at:[2885,1433],scale:1.7,stages:'all'},
 {id:'boat',frame:[168,0,84,34],layer:3,at:[900,1900],scale:2,path:{vx:12,vy:-3,loop:[600,1700,1600,2000]},stages:['noon','night']},
 {id:'lamp',frame:[252,0,40,34],layer:1,at:[3000,1300],scale:1,fixed:true,stages:'all'},
 {id:'edge',frame:[0,0,84,34],layer:2.2,at:[4090,1200],scale:1.1,path:{vx:-40},stages:'all'}]};
const MOMENTS=[1000,2500,7250,33333.5,61001];
// the same with GL's own memory: a uniform keeps its value in its program until it is set again, whatever is put in use between;
// one record per draw of the program with every uniform it holds then
function statesOf(calls,program){
 const held={},out=[];let cur=null,ms=null;
 for(const c of calls){
  if(c[0]==='moment'){ms=c[1];continue;}
  if(c[0]==='use'){cur=c[1];continue;}
  if(/^uniform/.test(c[0])){(held[c[1]]||(held[c[1]]={}))[c[2]]=c.slice(3);continue;}
  if((c[0]==='draw'||c[0]==='drawn')&&cur===program)out.push({ms,count:c[2],uniforms:{...held[program]}});
 }
 return out;
}
module.exports={paint,drawsOf,statesOf,sceneOf,PLAIN,MOMENTS,listeningGL};
