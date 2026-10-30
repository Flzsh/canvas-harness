const {test}=require('node:test'),assert=require('node:assert/strict');
global.ReserveNativeAppearance=require('../extension/native-appearance.js');
const NativePage=require('../extension/native-page.js');
const tick=()=>new Promise(setImmediate);
function fixture(initial=null,prior={}){
 const attrs=new Map(Object.entries(prior)),classes=new Set(),links=[],errors=[];let stored=initial,notify;
 const html={classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const document={documentElement:html,head:{append:x=>links.push(x)},createElement:()=>({remove(){this.removed=true;}})};
 const adapter={read:async()=>stored,write:async p=>{stored=p;},subscribe:f=>{notify=f;return()=>{notify=null;};}};
 const page=NativePage.create({document,adapter,media:{matches:false},styleURL:'native-page.css',onError:e=>errors.push(e)});
 return {page,attrs,classes,links,errors,external:p=>notify?.(p)};
}
test('original appearance performs no stylesheet load or native attribute changes',async()=>{
 const f=fixture(null,{'data-school':'school'});await f.page.start();assert.equal(f.links.length,0);assert.deepEqual([...f.attrs],[['data-school','school']]);f.page.destroy();
});
test('theme attributes publish only after CSS load and never replace native document nodes',async()=>{
 const f=fixture({theme:'dark'});await f.page.start();assert.equal(f.attrs.size,0);assert.equal(f.links.length,1);f.links[0].onload();await tick();assert.equal(f.attrs.get('data-reserve-native-theme'),'light');assert.equal(f.attrs.get('data-reserve-reading-width'),'comfortable');await f.page.set({accent:'rose'});await tick();assert.equal(f.attrs.get('data-reserve-native-accent'),'rose');assert.equal(f.links.length,1);f.page.destroy();assert.equal(f.attrs.size,0);assert.ok(f.links[0].removed);
});
test('returning to original while CSS is pending cannot apply a stale theme',async()=>{
 const f=fixture({theme:'dark'});await f.page.start();await f.page.set({theme:'original'});f.links[0].onload();await tick();assert.equal(f.attrs.size,0);f.page.destroy();
});
test('external preference changes win while the stylesheet is loading',async()=>{
 const f=fixture({theme:'dark'});await f.page.start();f.external({theme:'light',textSize:'large'});f.links[0].onload();await tick();assert.equal(f.attrs.get('data-reserve-native-theme'),'light');assert.equal(f.attrs.get('data-reserve-native-text'),'large');f.page.destroy();
});
test('stylesheet failure keeps the native page available and a later choice can retry',async()=>{
 const f=fixture({theme:'dark'});await f.page.start();f.links[0].onerror();await tick();assert.equal(f.attrs.size,0);assert.match(f.errors[0].message,/original page remains available/);assert.ok(f.links[0].removed);await f.page.set({theme:'light'});assert.equal(f.links.length,2);f.links[1].onload();await tick();assert.equal(f.attrs.get('data-reserve-native-theme'),'light');f.page.destroy();
});
test('destroy cancels pending CSS and restores exact preexisting appearance attributes',async()=>{
 const prior={'data-school':'school','data-reserve-native-text':'external'},f=fixture({theme:'dark'},prior);await f.page.start();f.page.destroy();await tick();assert.deepEqual(Object.fromEntries(f.attrs),prior);assert.equal(f.errors.length,0);assert.equal(f.links[0].onload,null);assert.ok(f.links[0].removed);
});
test('native storage adapter isolates its visual key and passes corrupt false values for validation',async()=>{
 let listener;const writes=[];global.chrome={storage:{local:{get:async key=>key===NativePage.KEY?{[NativePage.KEY]:false}:{},set:async p=>writes.push(p)},onChanged:{addListener:f=>listener=f,removeListener:f=>assert.equal(listener,f)}}};
 const adapter=NativePage.browserAdapter(),received=[];assert.equal(await adapter.read(),false);
 // The first read after 2.15 records the appearance version once; a corrupt value itself is left for validation.
 assert.deepEqual(writes,[{[NativePage.VERSION_KEY]:2}]);writes.length=0;
 const unsubscribe=adapter.subscribe(v=>received.push(v));listener({personal:{newValue:'private'}},'local');listener({[NativePage.KEY]:{newValue:{theme:'dark'}}},'sync');assert.equal(received.length,0);listener({[NativePage.KEY]:{newValue:false}},'local');listener({[NativePage.KEY]:{}},'local');assert.deepEqual(received,[false,null]);await adapter.write({theme:'light'});assert.deepEqual(writes,[{[NativePage.KEY]:{theme:'light'}}]);unsubscribe();delete global.chrome;
});
test('the first read after 2.15 moves an untouched Forest to Clay once; a Forest chosen later sticks',async()=>{
 const storage={[NativePage.KEY]:{theme:'dark',accent:'forest'}},writes=[];
 global.chrome={storage:{local:{get:async key=>({[key]:structuredClone(storage[key])}),set:async p=>{writes.push(structuredClone(p));Object.assign(storage,structuredClone(p));}},onChanged:{addListener(){},removeListener(){}}}};
 try{
  const adapter=NativePage.browserAdapter();
  assert.deepEqual(await adapter.read(),{theme:'dark',accent:'clay'});
  assert.deepEqual(writes,[{[NativePage.KEY]:{theme:'dark',accent:'clay'},[NativePage.VERSION_KEY]:2}],'the move and its version are saved together');
  assert.deepEqual(await adapter.read(),{theme:'dark',accent:'clay'});assert.equal(writes.length,1,'later reads write nothing');
  await adapter.write({theme:'dark',accent:'forest'});writes.length=0;
  assert.deepEqual(await adapter.read(),{theme:'dark',accent:'forest'},'Forest chosen again is kept');assert.equal(writes.length,0);
  storage[NativePage.KEY]={accent:'rose'};delete storage[NativePage.VERSION_KEY];
  assert.deepEqual(await adapter.read(),{accent:'rose'},'another accent is never moved');assert.deepEqual(writes,[{[NativePage.VERSION_KEY]:2}]);
 }finally{delete global.chrome;}
});
