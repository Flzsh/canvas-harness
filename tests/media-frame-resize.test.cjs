'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createDOM,settle}=require('./market-fixture.cjs');
const Frame=require('../extension/media-frame.js');
const image={mediaId:'11111111-1111-4111-8111-111111111111',name:'Banner.jpg',type:'image/webp',kind:'image',width:2400,height:660,palette:[]};
function fixture(t,value){
 const document=createDOM('<html><body><div class="rd">'+Frame.render(value)+'</div></body></html>'),container=document.querySelector('.rd'),node=container.querySelector('[data-ch-frame]'),observers=[];let width=400,height=110,scale=1,reads=0;
 node.getBoundingClientRect=()=>{reads++;return {width:width*scale,height:height*scale,left:0,top:0,right:width*scale,bottom:height*scale};};
 for(const child of node.children){child.pause=()=>{};child.load=()=>{};}
 const env=vm.createContext({document,URL:{createObjectURL:()=> 'blob:local',revokeObjectURL(){}},IntersectionObserver:class{observe(){}unobserve(){}disconnect(){}},ResizeObserver:class{constructor(fn){this.fn=fn;this.targets=new Set();observers.push(this);}observe(node){this.targets.add(node);}unobserve(node){this.targets.delete(node);}disconnect(){this.targets.clear();}},getComputedStyle:()=>({display:'block',visibility:'visible'})});
 vm.runInContext(fs.readFileSync(require.resolve('../extension/media-frame.js'),'utf8'),env);
 const controller=env.ReserveMediaFrame.createController(container,{async get(){return {asset:Frame.asset(value),blob:new Blob(['image']),poster:new Blob(['still'])};}},{motion:()=>false,onError:error=>assert.fail(error.message)});t.after(()=>controller.destroy());controller.sync();
 const length=(value,size)=>parseFloat(value)*(String(value).endsWith('%')?size/100:1),bounds=child=>[length(child.style.width,width),length(child.style.height,height),length(child.style.left,width),length(child.style.top,height)];
 return {node,controller,bounds,get reads(){return reads;},resize(w,h,{notify=true,visualScale=1}={}){width=w;height=h;scale=visualScale;if(notify)for(const observer of observers)if(observer.targets.has(node))observer.fn([{target:node,contentRect:{width,height}}]);}};
}
function near(actual,expected){for(let i=0;i<expected.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<1e-7,`${actual} follows container: expected ${expected}`);}
test('hydrated images, video stills and SVG follow proportional container resizes before observer delivery',async t=>{
 for(const asset of [image,{...image,animated:true,type:'image/gif'},{...image,kind:'video',type:'video/mp4',duration:12,width:1920,height:528},{name:'Banner.svg',svg:'<svg viewBox="0 0 2400 660"><rect width="2400" height="660"/></svg>'}]){
  const h=fixture(t,{asset,focus:{x:.5,y:.5},zoom:1,fit:'contain',height:'medium'});await settle();for(const child of h.node.children)near(h.bounds(child),[400,110,0,0]);
  h.resize(800,220,{notify:false});for(const child of h.node.children)near(h.bounds(child),[800,220,0,0]);
  h.resize(200,55,{notify:false});for(const child of h.node.children)near(h.bounds(child),[200,55,0,0]);
  const reads=h.reads;for(let i=0;i<4;i++)h.controller.update();assert.equal(h.reads,reads,'playback updates do not measure layout');
 }
});
test('aspect changes use observer layout dimensions for fill, fit, zoom and focus under a visual transform',async t=>{
 for(const [fit,zoom,focus,expected]of [['contain',1,{x:.5,y:.5},[240,66,0,33]],['cover',1,{x:.5,y:.5},[480,132,-120,0]],['cover',2,{x:.25,y:.75},[960,264,-120,-132]]]){
  const h=fixture(t,{asset:image,fit,zoom,focus,height:'medium'});await settle();const reads=h.reads;h.resize(240,132,{visualScale:.42});assert.equal(h.reads,reads,'resize uses delivered dimensions without measuring layout');for(const child of h.node.children)near(h.bounds(child),expected);
  h.resize(0,0);h.resize(240,132);for(const child of h.node.children)near(h.bounds(child),expected);
 }
});
