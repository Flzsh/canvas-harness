// B2 audit (2026-11-14): the Focus room's "today" tally after a page load. Fails on the untouched 4.0.164 copy.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../extension/focus-room.js'),'utf8');
// One Canvas page load: a fresh copy of focus-room.js over the same browser storage, and a dashboard with no room open.
function pageLoad(saved){
 const localStorage={getItem:key=>saved.has(key)?saved.get(key):null,setItem:(key,value)=>{saved.set(key,String(value));},removeItem:key=>saved.delete(key)};
 const win={addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},matchMedia:()=>({matches:false}),innerWidth:1440,innerHeight:900};
 const doc={defaultView:win,addEventListener(){},removeEventListener(){},fullscreenElement:null,activeElement:null,visibilityState:'visible'};
 const container={ownerDocument:doc,dataset:{},children:[],getAttribute:()=>null,hasAttribute:()=>false,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},getRootNode:()=>doc};
 const env=vm.createContext({console,Date,Math,JSON,Promise,Map,Set,WeakMap,WeakSet,Array,Object,String,Number,localStorage,ReserveFeatures:{enabled:()=>true},ReserveCore:require('../extension/core.js'),location:{pathname:'/'}});
 env.globalThis=env;vm.runInContext(source,env,{filename:'focus-room.js'});
 const F=env.ReserveFocusRoom;let focus=null;
 const store={owner:{accountId:'7'},get:()=>({focus})};
 const room=F.create({container,store});
 return {F,room,set focus(value){focus=value;},get today(){return F.tally(focus,Date.now());}};
}

test('sessions finished today stay counted after Canvas loads a new page (the tally\'s day and base are kept with the other prefs)',()=>{
 const saved=new Map(),now=Date.now(),earlier=now-2*864e5;
 const first=pageLoad(saved);
 first.focus={minutes:25,remaining:1500,sessions:2,completedAt:earlier};first.room.sync();
 assert.equal(first.today,0,'nothing finished yet today');
 // three sessions finished on this page
 first.focus={minutes:25,remaining:1500,sessions:5,completedAt:now};first.room.sync();
 assert.equal(first.today,3);
 first.room.destroy();
 // the student opens an assignment and comes back: a new page, the same planner record
 const second=pageLoad(saved);second.focus={minutes:25,remaining:1500,sessions:5,completedAt:now};
 assert.equal(second.today,3,'still three today after the page load');
 second.room.destroy();
});
