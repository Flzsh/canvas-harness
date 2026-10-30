const {test}=require('node:test'),assert=require('node:assert/strict'),Storage=require('../extension/storage.js');
function stores(){const data=new Map(),adapter={read:async k=>structuredClone(data.get(k)),write:async(k,v)=>data.set(k,structuredClone(v))};return {a:Storage.createStore({accountId:'5',adapter}),b:Storage.createStore({accountId:'6',adapter}),data};}
const catalog=(id='7')=>({origin:'https://school.instructure.com',accountId:'5',courseId:id,modules:[],pages:[],files:[],fetchedAt:new Date().toISOString()});
test('material caches reject account confusion and are not exported in personal backups',async()=>{
 const {a,b}=stores();await a.writeResourceCache(catalog());assert.equal((await a.readResourceCache('7')).courseId,'7');assert.equal(await b.readResourceCache('7'),null);
 await assert.rejects(a.writeResourceCache({...catalog(),accountId:'6'}),/another account/);assert.equal(a.exportBackup().data.modules,undefined);
});
test('saved document shortcuts survive backup roundtrip and reject credential or script links',async()=>{
 const {a}=stores();await a.update(d=>{d.resourcePins.push({id:'module:10:11',courseId:'7',title:'Worksheet',url:'https://school.instructure.com/courses/7/files/21',category:'Worksheet'});d.tasks['17']={notes:'Keep this note'};});
 const restored=Storage.validateBackup(a.exportBackup(),a.owner);assert.equal(restored.resourcePins[0].title,'Worksheet');assert.equal(restored.tasks['17'].notes,'Keep this note');
 for(const url of ['javascript:alert(1)','https://user:secret@example.com'])await assert.rejects(a.update(d=>{d.resourcePins[0].url=url;}),/Invalid saved material link/);
 assert.equal(a.get().resourcePins[0].url,'https://school.instructure.com/courses/7/files/21');
});
test('materials cache keeps at most six recently written courses',async()=>{
 const {a,data}=stores();for(let i=1;i<=8;i++)await a.writeResourceCache({...catalog(String(i)),fetchedAt:new Date(1700000000000+i*1000).toISOString()});
 const cache=[...data.entries()].find(([k])=>k.endsWith(':materials'))[1];assert.equal(Object.keys(cache).length,6);assert.equal(await a.readResourceCache('1'),null);assert.ok(await a.readResourceCache('8'));
});
