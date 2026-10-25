'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./play-tools-fixture.cjs');
test('armed Play tools leave Biscuit slip controls usable',()=>{
 const f=fixture({mountOptions:{ours:'.pet-layer'}}),layer=f.document.createElement('div'),button=f.document.createElement('button');layer.className='pet-layer';layer.append(button);f.document.body.append(layer);f.api.pick('bomb');
 assert.notEqual(f.dispatch('pointerdown',button).prevented,true);assert.notEqual(f.dispatch('click',button).prevented,true);assert.equal(f.original.parentNode,f.page);f.api.destroy();f.finish();
});
test('a quiz-taking transition disables an already held Play tool',()=>{
 let allowed=true;const f=fixture({mountOptions:{allowed:()=>allowed}});f.api.pick('bomb');allowed=false;assert.notEqual(f.dispatch('click').prevented,true);f.dispatch('pointermove');assert.equal(f.api.tool,null);f.api.pick('hammer');assert.equal(f.api.tool,null);assert.equal(f.original.parentNode,f.page);f.api.destroy();f.finish();
});
test('closing the dashboard releases Play input interception and its tray',()=>{
 const f=fixture();f.api.pick('hammer');f.api.destroy();f.finish();assert.equal(f.box.querySelector('.chb-box'),null);assert.notEqual(f.dispatch('click').prevented,true);assert.notEqual(f.dispatch('pointerdown').prevented,true);assert.equal(f.api.physicsView.running,false);assert.equal(f.original.parentNode,f.page);
});
