'use strict';
// The Focus room makes its audio context ahead of the click (it held up the room's first frame when made at the click),
// but only once the page has had a press or a key: made before that, the browser refuses to start it and logs "The
// AudioContext was not allowed to start" on the extension's error page (owner, 2026-10-29).
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createDOM}=require('./addons-fixture.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
function setup({activated}){
 const document=createDOM('<html><body><div class="rd" data-motion-style="gentle"><main class="rd-shell"><button type="button" data-rd-action="room-open">Room</button></main></div></body></html>');
 const Element=document.createElement('div').constructor;Object.defineProperty(Element.prototype,'ownerDocument',{configurable:true,get:()=>document});
 const container=document.querySelector('.rd'),made=[];
 class AudioContext{constructor(){made.push(this);this.state='suspended';this.currentTime=0;this.destination={};}createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}},connect(x){return x;},disconnect(){}};}createDynamicsCompressor(){return this.createGain();}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}}
 const env=vm.createContext({console,Date,Math,JSON,Promise,Map,Set,Array,Object,String,Number,ReserveFeatures:{enabled:()=>true},ReserveCore:require('../extension/core.js'),location:{pathname:'/'},
  matchMedia:()=>({matches:false}),innerWidth:1440,innerHeight:900,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms||0,5)),clearTimeout,setInterval:()=>0,clearInterval(){},addEventListener(){},removeEventListener(){},
  getComputedStyle:()=>({getPropertyValue:()=>''}),AudioContext,navigator:activated===undefined?{}:{userActivation:{hasBeenActive:activated,isActive:false}}});
 env.globalThis=env;
 vm.runInContext(read('focus-room-art.js'),env);vm.runInContext(read('focus-room.js'),env);
 const room=env.ReserveFocusRoom.create({container,store:{owner:{accountId:'7'},get:()=>({focus:{}})},task:()=>null});
 const button=container.querySelector('[data-rd-action="room-open"]');
 const fire=type=>button.dispatchEvent({type,bubbles:true,target:button,composedPath:()=>[button],preventDefault(){},stopPropagation(){}});
 return {made,fire,room,env};
}

test('resting on Room before any press on the page makes no audio context; the press on Room makes it',()=>{
 const s=setup({activated:false});s.fire('pointerover');assert.equal(s.made.length,0,'no context the browser would refuse');
 s.env.navigator.userActivation.hasBeenActive=true;s.fire('pointerdown');assert.equal(s.made.length,1,'the press counts as one, so the context is made ahead of the click');
 s.fire('pointerover');s.fire('pointerdown');assert.equal(s.made.length,1,'made once');s.room.destroy?.();
});

test('after an earlier press on the page, resting on Room makes it ahead as before; a browser without the activation API keeps the old behaviour',()=>{
 const a=setup({activated:true});a.fire('pointerover');assert.equal(a.made.length,1);a.room.destroy?.();
 const b=setup({activated:undefined});b.fire('pointerover');assert.equal(b.made.length,1);b.room.destroy?.();
});
