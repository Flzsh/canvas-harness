'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const settle=()=>new Promise(setImmediate);
function fixture(theme='light'){
 const attrs=new Map(),classes=new Set(),links=[],events=new Set(),mediaEvents=new Set(),errors=[];
 const html={classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},getAttribute:name=>attrs.get(name)??null,setAttribute:(name,value)=>attrs.set(name,value),removeAttribute:name=>attrs.delete(name)};
 const doc={documentElement:html,head:{append(link){links.push(link);}},createElement(){return {remove(){const i=links.indexOf(this);if(i>=0)links.splice(i,1);}};}};
 let reads=0,writes=0;
 const adapter={read:async()=>{reads++;return vm.runInContext('({theme:'+JSON.stringify(theme)+'})',env);},write:async()=>{writes++;},subscribe:fn=>{events.add(fn);return()=>events.delete(fn);}};
 const media={matches:false,addEventListener:(_name,fn)=>mediaEvents.add(fn),removeEventListener:(_name,fn)=>mediaEvents.delete(fn)};
 const env=vm.createContext({URL,Intl,document:doc,location:new URL('https://school.instructure.com/courses/7/modules'),setTimeout,clearTimeout});
 for(const file of ['site.js','native-appearance.js','native-page.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),env,{filename:file});
 const controller=env.ReserveNativePage.create({adapter,media,styleURL:'local-native-page.css',onError:error=>errors.push(error)});
 return {env,controller,attrs,classes,links,events,mediaEvents,errors,get reads(){return reads;},get writes(){return writes;}};
}
test('ordinary native pages still apply chosen appearance after CSS loads and remove the gate on teardown',async()=>{
 const f=fixture();await f.controller.start();assert.equal(f.reads,1);assert.equal(f.links.length,1);assert.equal(f.classes.size,0);
 f.links[0].onload();await settle();assert.equal(f.classes.has('reserve-native-enabled'),true);assert.equal(f.attrs.get('data-reserve-native-theme'),'light');
 f.controller.destroy();assert.equal(f.classes.size,0);assert.equal(f.attrs.size,0);assert.equal(f.links.length,0);assert.equal(f.events.size,0);assert.equal(f.mediaEvents.size,0);assert.equal(f.writes,0);assert.deepEqual(f.errors,[]);
});
test('original native appearance never opts into CSS',async()=>{
 const f=fixture('original');await f.controller.start();assert.equal(f.classes.size,0);assert.equal(f.attrs.size,0);assert.equal(f.links.length,0);f.controller.destroy();
});
test('an appearance stylesheet finishing after navigation cannot opt an assignment into CSS',async()=>{
 const f=fixture();await f.controller.start();f.env.location=new URL('https://school.instructure.com/courses/7/assignments/12?module_item_id=25');
 f.links[0].onload();await settle();assert.equal(f.classes.size,0);assert.equal(f.attrs.size,0);assert.equal(f.links.length,0);assert.deepEqual(f.errors,[]);f.controller.destroy();
});
test('late preference reads on an assignment never load native CSS',async()=>{
 const f=fixture();f.env.location=new URL('https://school.instructure.com/courses/7/assignments/12/submissions/new');
 await f.controller.start();assert.equal(f.classes.size,0);assert.equal(f.attrs.size,0);assert.equal(f.links.length,0);f.controller.destroy();
});
