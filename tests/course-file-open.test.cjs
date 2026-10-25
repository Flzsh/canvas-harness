// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../extension/course-file-open.js');
function fixture(kind='pdf'){
 const nodes=[],revoked=[],opened=[],owner={origin:'https://canvas.example.edu',accountId:'7'},item={id:'cf-abcd1',kind:'file',title:'Reading',name:'My reading.'+kind,type:kind==='pdf'?'application/pdf':kind==='txt'?'text/plain':'',size:8};
 const node=tag=>{const n={tag,dataset:{},children:[],setAttribute(){},addEventListener(k,fn){this[k]=fn;},append(...kids){this.children.push(...kids);},remove(){this.removed=true;},click(){opened.push(this);},showModal(){this.open=true;},close(){this.open=false;}};nodes.push(n);return n;};
 const env={document:{createElement:node},URL:{createObjectURL:()=> 'blob:local',revokeObjectURL:url=>revoked.push(url)},setTimeout:fn=>{fn();return 0;},clearTimeout(){},ReservePdfHostController:{openLocal:async info=>opened.push(info),closeLocal:()=>opened.push('close')}};
 const blob=new Blob([kind==='pdf'?'%PDF-1.7':'<script>plain</script>'],{type:item.type});
 const files={list:course=>course==='5'?[item]:[],getFile:async()=>blob},container={append:n=>nodes.push(n)},store={owner};
 return {ui:O.create({store,files,container,root:env}),env,files,item,opened,revoked,nodes};
}
test('a local PDF uses the existing reader with its real owner and local identity',async()=>{
 const f=fixture();await f.ui.open('5',f.item.id);assert.equal(f.opened.length,1);assert.equal(f.opened[0].id,f.item.id);assert.deepEqual(f.opened[0].owner,{origin:'https://canvas.example.edu',accountId:'7'});assert.ok(f.opened[0].blob instanceof Blob);f.ui.destroy();assert.ok(f.opened.includes('close'));
});
test('unknown courses and removed items never reach the reader',async()=>{
 const f=fixture();await assert.rejects(f.ui.open('6',f.item.id),/no longer|not saved/);assert.equal(f.opened.length,0);f.ui.destroy();await assert.rejects(f.ui.open('5',f.item.id),/changed|closed/);
});
test('ordinary documents download with their original name and release their URL',async()=>{
 const f=fixture('docx');await f.ui.open('5',f.item.id);const a=f.opened[0];assert.equal(a.download,'My reading.docx');assert.equal(a.href,'blob:local');f.ui.destroy();assert.ok(f.revoked.includes('blob:local'));
});
test('text is rendered as text and cleaned up with the account workspace',async()=>{
 const f=fixture('txt');await f.ui.open('5',f.item.id);const pre=f.nodes.find(n=>n.tag==='pre');assert.equal(pre.textContent,'<script>plain</script>');const dialog=f.nodes.find(n=>n.tag==='dialog');assert.equal(dialog.open,true);f.ui.destroy();assert.equal(dialog.removed,true);
});
test('an image that the browser cannot display retains its named download',async()=>{
 const f=fixture('heic');await f.ui.open('5',f.item.id);const img=f.nodes.find(n=>n.tag==='img');assert.ok(img);assert.equal(typeof img.error,'function');img.error();assert.equal(img.hidden,true);assert.match(f.nodes.find(n=>n.tag==='p').textContent,/could not be displayed/);const download=f.nodes.find(n=>n.tag==='a');assert.equal(download.download,'My reading.heic');assert.equal(download.href,'blob:local');f.ui.destroy();assert.ok(f.revoked.includes('blob:local'));
});
test('an account switch while a file read is pending cannot open the previous account file',async()=>{
 const f=fixture();let done;const p=new Promise(resolve=>done=resolve);const create=f.env.ReservePdfHostController.openLocal;f.env.ReservePdfHostController.openLocal=async v=>{await p;return create(v);};
 const wait=f.ui.open('5',f.item.id);f.ui.destroy();done();await assert.rejects(wait,/account changed/);assert.deepEqual(f.opened,['close']);
});
test('suspending personal viewers cancels pending reads and closes the local reader without disabling future opens',async()=>{
 const f=fixture('txt');await f.ui.open('5',f.item.id);const dialog=f.nodes.find(n=>n.tag==='dialog');f.ui.close();assert.equal(dialog.removed,true);assert.ok(f.opened.includes('close'));assert.ok(f.revoked.includes('blob:local'));
 const get=f.files.getFile;let release;f.files.getFile=()=>new Promise(resolve=>release=resolve);const opening=f.ui.open('5',f.item.id);f.ui.close();release(await get());await opening;assert.equal(f.nodes.filter(n=>n.tag==='dialog'&&n.open).length,0);f.files.getFile=get;
 await f.ui.open('5',f.item.id);assert.equal(new Set(f.nodes.filter(n=>n.tag==='dialog'&&n.open)).size,1);f.ui.destroy();
});
