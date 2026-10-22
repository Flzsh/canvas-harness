// Adapted from Gary Wu's pull request #43 to Canvas Harness.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture({on=true,quiz=false,reject=false}={}){
 const Core=require('../extension/core.js'),focus={minutes:25,remaining:500,elapsed:1000,pausedAt:1,endsAt:null,sessions:2,phase:'focus',focusMinutes:25,breakMinutes:5,cycles:4,cycle:2},listeners={};
 class Node{
  constructor(cls=''){this.dataset={};this.classList={contains:value=>value===cls};this.children=[];this.hidden=false;this.inert=false;this.values={};this.priority={};this.style={getPropertyValue:key=>this.values[key]||'',getPropertyPriority:key=>this.priority[key]||'',setProperty:(key,value,priority)=>{this.values[key]=value;this.priority[key]=priority||'';},removeProperty:key=>{delete this.values[key];delete this.priority[key];}};this.nodes={};}
  append(node){if(node.parentNode)node.remove();node.parentNode=this;this.children.push(node);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}setAttribute(){}focus(){this.focused=true;}
  querySelector(key){return this.nodes[key]||=new Node();}querySelectorAll(){return [this.querySelector('stop')];}
 }
 const doc={activeElement:new Node(),fullscreenElement:null,createElement:()=>new Node(),addEventListener:(type,fn)=>listeners[type]=fn,removeEventListener:type=>delete listeners[type],exitFullscreen:async()=>{doc.fullscreenElement=null;listeners.fullscreenchange?.();}},container=new Node(),shell=new Node(),sky=new Node('tk-sky');container.ownerDocument=doc;container.append(shell);container.append(sky);container.requestFullscreen=async()=>{if(reject)throw Error('Denied');doc.fullscreenElement=container;listeners.fullscreenchange?.();};
 const env=vm.createContext({ReserveFeatures:{enabled:()=>on},ReserveCore:Core,location:{pathname:quiz?'/courses/7/quizzes/8/take':'/'}});vm.runInContext(fs.readFileSync(require.resolve('../extension/focus-room.js'),'utf8'),env);
 const room=env.ReserveFocusRoom.create({container,store:{get:()=>({focus})}});
 return {room,container,shell,sky,doc,listeners,focus,setOn:value=>on=value,get panel(){return container.children.find(node=>node.className==='ch-room-view');}};
}
test('focus room uses the existing focus clock, cycles and dashboard scene without writes or its own timer',async()=>{
 const f=fixture(),before=structuredClone(f.focus);await f.room.open();assert.equal(f.doc.fullscreenElement,f.container);assert.equal(f.shell.hidden,true);assert.equal(f.shell.inert,true);assert.equal(f.sky.hidden,false);assert.deepEqual(f.focus,before);
 assert.equal(f.panel.querySelector('[data-rd-timer-text]').textContent,'08:20');assert.equal(f.panel.querySelector('[data-ch-room-cycle]').textContent,'2 / 4');assert.equal(f.panel.querySelector('[data-rd-action="timer-toggle"]').textContent,'Resume');
 f.focus.phase='break';f.focus.remaining=300;f.room.sync();assert.equal(f.panel.querySelector('[data-ch-room-phase]').textContent,'Break');assert.equal(f.panel.querySelector('[data-rd-timer-text]').textContent,'05:00');
 assert.doesNotMatch(f.panel.innerHTML,/<video|<iframe|<audio|<canvas/);f.room.destroy();
});
test('focus room closes on native fullscreen exit and restores the exact dashboard state',async()=>{
 const f=fixture();f.shell.hidden=true;f.shell.style.setProperty('display','grid');const previous=f.doc.activeElement;await f.room.open();await f.doc.exitFullscreen();assert.equal(f.room.isOpen(),false);assert.equal(f.shell.hidden,true);assert.equal(f.shell.inert,false);assert.equal(f.shell.style.getPropertyValue('display'),'grid');assert.equal(previous.focused,true);f.room.destroy();assert.equal(f.listeners.fullscreenchange,undefined);
});
test('focus room stays inert while off and on quiz-taking pages and closes when disabled',async()=>{
 for(const options of [{on:false},{quiz:true}]){const f=fixture(options);assert.equal(await f.room.open(),false);assert.equal(f.panel,undefined);f.room.destroy();}
 const f=fixture();await f.room.open();f.setOn(false);f.room.sync();assert.equal(f.room.isOpen(),false);assert.equal(f.shell.hidden,false);f.room.destroy();
});
test('focus room reports fullscreen failure and Escape recovers the dashboard without touching the timer',async()=>{
 const f=fixture({reject:true});await f.room.open();assert.equal(f.panel.querySelector('[role="status"]').textContent,'Full screen unavailable');let prevented=false;assert.equal(f.room.keydown({key:'Escape',preventDefault(){prevented=true;}}),true);assert.equal(prevented,true);assert.equal(f.room.isOpen(),false);assert.equal(f.focus.remaining,500);f.room.destroy();
});
