'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./gesture-fixture.cjs'),M=require('../extension/workspace-arrange.js'),G=require('../extension/workspace-gestures.js');
function setup(){
 const f=fixture();f.controller.destroy();const observers=[],counts={width:0,height:0,writes:0,grid:0};
 const desk=f.container.querySelector('.rd-main'),win=f.container.ownerDocument.defaultView;
 win.ResizeObserver=class{constructor(fn){this.fn=fn;this.nodes=new Set();observers.push(this);}observe(n){this.nodes.add(n);}unobserve(n){this.nodes.delete(n);}disconnect(){this.nodes.clear();}};
 Object.defineProperty(desk,'clientWidth',{get(){counts.width++;return desk.rect.width;}});
 for(const node of Object.values(f.panels))Object.defineProperty(node,'offsetHeight',{configurable:true,get(){counts.height++;return node.rect.height;}});
 for(const node of [desk,...Object.values(f.panels)]){node.style.getPropertyValue=k=>node.style[k]||'';const put=node.style.setProperty;node.style.setProperty=(k,v)=>{counts.writes++;put(k,v);};}
 const model={...M,grid(...args){counts.grid++;return M.grid(...args);}};
 const controller=G.create({container:f.container,getSettings:()=>f.settings,onChange:c=>{f.calls.push(c);M.change(f.settings,c);return true;}},model);
 const sizes=()=>{for(const o of observers){const entries=[...o.nodes].map(target=>({target,contentRect:{width:target.rect.width,height:target.rect.height},borderBoxSize:[{inlineSize:target.rect.width,blockSize:target.rect.height}]}));if(entries.length)o.fn(entries);}f.tick(20);};
 return {...f,controller,counts,observers,desk,sizes};
}
test('unchanged observer-known desk and panels do no geometry reads or layout work',()=>{
 const f=setup();f.controller.sync();f.sizes();const before={...f.counts};f.controller.sync();f.controller.sync();assert.deepEqual(f.counts,before);f.controller.destroy();
});
test('unknown dimensions are all read before the first grid style write',()=>{
 const f=setup(),events=[];for(const node of Object.values(f.panels))Object.defineProperty(node,'offsetHeight',{configurable:true,get(){events.push('read');return node.rect.height;}});
 for(const node of [f.desk,...Object.values(f.panels)]){const put=node.style.setProperty;node.style.setProperty=(...args)=>{events.push('write');put(...args);};}
 f.controller.sync();assert.equal(events.slice(events.indexOf('write')).includes('read'),false);f.controller.destroy();
});
test('ResizeObserver panel changes reuse known sizes and update rows',()=>{
 const f=setup();f.controller.sync();f.sizes();const before={...f.counts};f.panels.work.rect.height=700;f.sizes();assert.equal(f.counts.height,before.height);assert.equal(f.counts.width,before.width);assert.ok(f.counts.writes>before.writes);f.controller.destroy();
});
test('replaced panels invalidate placement even when keys and dimensions match',()=>{
 const f=setup();f.controller.sync();f.sizes();const old=f.panels.work,next=old.cloneNode(true);Object.defineProperty(next,'offsetHeight',{get:()=>400});f.desk.insertBefore(next,old);old.remove();f.controller.sync();assert.ok(next.style['--rd-panel-column']);assert.ok(next.style['--rd-panel-row']);f.controller.destroy();
});

test('observer width changes resolve the layout without synchronous geometry reads',()=>{
 const f=setup();f.controller.sync();f.sizes();const before={...f.counts},wide=f.panels.reader.style['--rd-panel-column'];f.desk.rect.width=380;f.sizes();assert.equal(f.counts.width,before.width);assert.equal(f.counts.height,before.height);assert.notEqual(f.panels.reader.style['--rd-panel-column'],wide);const settled={...f.counts};f.controller.sync();assert.deepEqual(f.counts,settled);f.controller.destroy();
});
test('Assignments restores its fixed layout after a saved vertical arrangement',()=>{
 const f=setup();f.settings.workspaceLayout={axis:'y',children:['context','work','reader']};f.controller.sync();f.sizes();f.container.dataset.workPage='assignments';f.controller.sync();assert.equal(f.panels.work.style['--rd-panel-column'],'1 / 2');assert.equal(f.panels.reader.style['--rd-panel-column'],'2 / 3');f.controller.destroy();
});

test('preview height observations keep an active keyboard rearrangement available to commit',async()=>{
 const f=setup();f.controller.sync();f.sizes();f.controller.keydown({target:f.grips.reader,key:' ',preventDefault(){}});f.controller.keydown({key:'ArrowDown',preventDefault(){}});assert.equal(f.controller.dragging(),true);f.panels.work.rect.height=300;f.sizes();assert.equal(f.controller.dragging(),true);f.controller.keydown({key:'Enter',preventDefault(){}});await Promise.resolve();await Promise.resolve();assert.equal(f.calls.length,1);f.controller.destroy();
});
test('a real desk resize still cancels the active rearrangement',()=>{
 const f=setup();f.controller.sync();f.sizes();f.controller.keydown({target:f.grips.reader,key:' ',preventDefault(){}});f.desk.rect.width=700;f.sizes();assert.equal(f.controller.dragging(),false);assert.equal(f.calls.length,0);f.controller.destroy();
});
