'use strict';
// Edge sometimes runs the registered add-ons (storage.js among them) before the manifest's page-start group (gpa-model.js,
// personal-work.js). storage.js used to take the GPA model while loading, held null for the whole page, and the store threw
// "Cannot read properties of null (reading 'defaults')": Canvas Harness showed Canvas's cards until a reload (every sign-in).
// It now looks the models up when first used.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../extension',name),'utf8');

test('storage.js loaded before the GPA and personal-work models still makes a working store once they are there',async()=>{
 const ctx=vm.createContext({structuredClone,console,setTimeout,clearTimeout,queueMicrotask,URL,TextEncoder,TextDecoder});
 ctx.globalThis=ctx;
 // the registered add-ons in their own order (site.js, page-preferences.js and customization-model.js come before storage.js)
 for(const name of ['site.js','page-preferences.js','customization-model.js','storage.js'])vm.runInContext(read(name),ctx,{filename:name});
 assert.equal(ctx.CanvasHarnessGPA,undefined,'the model is not there while storage.js loads');
 vm.runInContext(read('gpa-model.js'),ctx,{filename:'gpa-model.js'});
 if(fs.existsSync(path.join(__dirname,'../extension/personal-work.js')))vm.runInContext(read('personal-work.js'),ctx,{filename:'personal-work.js'});
 const state={},adapter={read:async k=>structuredClone(state[k]),write:async(k,v)=>{state[k]=structuredClone(v);},subscribe:()=>()=>{}};
 const store=ctx.ReserveStorage.createStore({accountId:'1',adapter});
 const data=await store.load();
 assert.ok(data&&data.settings,'the store loads its defaults');
 assert.ok(data.gpa===undefined||typeof data.gpa==='object','the GPA preferences come from the model found at first use');
});
