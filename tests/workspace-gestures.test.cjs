const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./gesture-fixture.cjs');
const M=require('../extension/workspace-arrange.js');

test('dropping below one panel preserves the neighbouring full-height column',()=>{
 const s={};M.change(s,{type:'dock',key:'reader',target:'work',edge:'bottom'});
 assert.deepEqual(s.workspaceLayout,{axis:'x',children:['context',{axis:'y',children:['work','reader']}]});
 const g=M.grid(s.workspaceLayout,1200);assert.equal(g.cells.context.row,'1 / 3');assert.equal(g.cells.work.row,'1 / 2');assert.equal(g.cells.reader.row,'2 / 3');assert.equal(g.cells.reader.column,g.cells.work.column);
 M.change(s,{type:'dock',key:'reader',target:'context',edge:'left'});assert.deepEqual(s.workspaceLayout,{axis:'x',children:['reader','context','work']});
});
test('all edge permutations preserve exactly one of each panel and reject malformed saved trees',()=>{
 let s={};for(const key of M.PANELS)for(const target of M.PANELS)for(const edge of ['left','right','top','bottom']){M.change(s,{type:'dock',key,target,edge});assert.deepEqual(M.leaves(M.snapshot(s).layout).sort(),[...M.PANELS].sort());M.cleanSaved(s);}
 for(const value of [{axis:'z',children:M.PANELS},{axis:'x',children:['work','work','reader']},{axis:'y',children:['context','work']},{axis:'x',children:[{axis:'x',children:[{axis:'x',children:[{axis:'x',children:M.PANELS},'reader']},'work']},'context']}])assert.throws(()=>M.cleanLayout(value),/Invalid workspaceLayout/);
});
test('narrow display adapts the layout without overwriting the saved desktop arrangement',()=>{
 const s={};M.change(s,{type:'dock',key:'reader',target:'work',edge:'bottom'});const before=JSON.stringify(s);const g=M.grid(s.workspaceLayout,380);assert.equal(new Set(Object.values(g.cells).map(c=>c.column)).size,1);assert.equal(JSON.stringify(s),before);assert.notEqual(M.grid(s.workspaceLayout,1600).cells.context.column,M.grid(s.workspaceLayout,1600).cells.work.column);
});
test('course reorder keeps hidden IDs and artwork, with undo and no-op protection',()=>{
 const s={courseOrder:['99','1','2','3'],coursePrefs:{1:{titleArt:{svg:'keep'}}}};
 assert.equal(M.change(s,{type:'course-move',key:'1',target:'2',position:'after',ids:['1','2','3','4']}),true);assert.deepEqual(s.courseOrder,['99','2','1','3','4']);assert.equal(s.coursePrefs[1].titleArt.svg,'keep');M.change(s,{type:'undo'});assert.deepEqual(s.courseOrder,['99','1','2','3']);
 assert.equal(M.change(s,{type:'course-move',key:'1',target:'1',position:'after'}),false);assert.equal(M.change(s,{type:'course-move',key:'all',target:'1',position:'before'}),false);
});
test('short taps do not unlock or save, and movement before the hold cancels permanently',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
 f.controller.pointerdown(f.event('work'));t.mock.timers.tick(100);f.controller.pointerup(f.event('work'));t.mock.timers.tick(600);assert.equal(f.controller.dragging(),false);assert.equal(f.calls.length,0);
 f.controller.pointerdown(f.event('work'));f.controller.pointermove({...f.event('work'),clientX:45});f.controller.pointermove(f.event('work'));t.mock.timers.tick(600);assert.equal(f.controller.dragging(),false);assert.equal(f.calls.length,0);f.controller.destroy();
});
test('hold feedback waits 250 ms, then lifts; release locks immediately and suppresses navigation',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.controller.pointerdown(f.event('work'));
 assert.equal(f.panels.work.dataset.hold,undefined);t.mock.timers.tick(249);assert.equal(f.panels.work.dataset.hold,undefined);
 t.mock.timers.tick(1);assert.equal(f.panels.work.dataset.hold,'true');assert.equal(f.controller.dragging(),false);
 t.mock.timers.tick(169);assert.equal(f.controller.dragging(),false);t.mock.timers.tick(1);assert.equal(f.controller.dragging(),true);
 f.controller.pointerup(f.event('work'));assert.equal(f.controller.active(),false);assert.equal(f.container.dataset.arranging,'false');
 assert.equal(f.controller.click(f.event('work')),true);assert.equal(f.calls.length,0);
 f.controller.pointerdown(f.event('reader'));assert.equal(f.controller.dragging(),false);t.mock.timers.tick(100);f.controller.pointerup(f.event('reader'));assert.equal(f.controller.dragging(),false);f.controller.destroy();
});

test('hold lift captures the stable workspace and never leaves a persistent movement mode',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.controller.pointerdown(f.event('work'));t.mock.timers.tick(419);assert.equal(f.controller.dragging(),false);t.mock.timers.tick(1);assert.equal(f.controller.dragging(),true);assert.equal(f.panels.work.dataset.lifted,'true');
 assert.equal(f.container.captured,1,'capture belongs to the stable workspace, not a card moved in the DOM');assert.equal(f.panels.work.captured,undefined);
 f.controller.pointerup(f.event('work'));assert.equal(f.controller.active(),false);assert.equal(f.controller.click(f.event('work')),true);assert.equal(f.calls.length,0);f.controller.destroy();
});
test('Escape, pointercancel, and second touch cancel without a save or undo entry',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
 for(const cancel of [()=>f.controller.keydown({key:'Escape',preventDefault(){}}),()=>f.controller.pointercancel({pointerId:1}),()=>f.controller.pointerdown({...f.event('reader'),isPrimary:false,pointerId:2})]){f.controller.pointerdown(f.event('work'));t.mock.timers.tick(430);assert.equal(f.controller.dragging(),true);cancel();assert.equal(f.controller.dragging(),false);assert.equal(f.calls.length,0);assert.equal(f.settings.workspaceUndo,undefined);}
 f.controller.destroy();
});
test('a held pointer commits the visibly previewed spatial destination exactly once',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.controller.pointerdown(f.event('reader',850,120));t.mock.timers.tick(430);f.controller.pointermove({...f.event('reader'),clientX:560,clientY:489});f.tick(20);
 assert.equal(f.toolbar.querySelector('.rd-snap-preview').textContent,'');assert.match(f.toolbar.querySelector('.rd-snap-preview').attrs['aria-label'],/below Up next/);f.controller.pointerup({...f.event('reader'),clientX:560,clientY:489});await Promise.resolve();await Promise.resolve();assert.equal(f.calls.length,1);assert.equal(f.calls[0].edge,'bottom');f.controller.pointerup(f.event('reader'));assert.equal(f.calls.length,1);f.controller.destroy();
});
test('keyboard and click destinations use the same reducer, and failed saves restore the model',async()=>{
 const f=fixture();f.controller.keydown({target:f.grips.reader,key:' ',preventDefault(){}});assert.equal(f.toolbar.querySelector('.rd-place-choices'),null);assert.ok(f.toolbar.querySelector('.rd-move-hud'));f.controller.keydown({key:'ArrowDown',preventDefault(){}});f.settings.fail=true;f.controller.keydown({key:'Enter',preventDefault(){}});await Promise.resolve();await Promise.resolve();assert.equal(f.settings.workspaceLayout,undefined);assert.match(f.toolbar.querySelector('.rd-arrange-live').textContent,/could not be saved/);assert.equal(f.controller.dragging(),false);f.controller.destroy();
});

test('sideways movement at heading height swaps positions without introducing a vertical split',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
 f.controller.pointerdown(f.event('work',450,120));t.mock.timers.tick(250);assert.equal(f.panels.work.dataset.hold,'true');assert.equal(f.grips.work.parentNode.dataset.hold,undefined,'hold covers the complete surface');
 t.mock.timers.tick(170);f.controller.pointermove(f.event('work',950,120));f.tick(20);
 assert.equal(f.toolbar.querySelector('.rd-snap-preview').textContent,'');assert.match(f.toolbar.querySelector('.rd-snap-preview').attrs['aria-label'],/Swap/);
 f.controller.pointerup(f.event('work',950,120));await Promise.resolve();await Promise.resolve();
 assert.equal(f.calls[0].type,'swap');assert.deepEqual(f.settings.workspaceLayout,{axis:'x',children:['context','reader','work']});
 M.change(f.settings,{type:'undo'});assert.deepEqual(M.snapshot(f.settings).layout,M.DEFAULT.layout);f.controller.destroy();
});

test('swapping across an existing stacked layout exchanges slots without moving the third panel',()=>{
 const layout={axis:'x',children:[{axis:'y',children:['work','reader']},'context']};
 const result=M.swap(layout,'work','context');assert.deepEqual(result,{axis:'x',children:[{axis:'y',children:['context','reader']},'work']});assert.deepEqual(M.swap(result,'work','context'),layout);
});

test('a drop clears its proxy, placeholder and hidden source without waiting for animation completion',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture({motion:true});
 f.controller.pointerdown(f.event('work',450,120));t.mock.timers.tick(420);f.controller.pointermove(f.event('work',950,120));f.tick(20);f.controller.pointerup(f.event('work',950,120));
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.toolbar.querySelector('.rd-lift-ghost'),null);assert.equal(f.toolbar.querySelector('.rd-snap-preview'),null);assert.equal(f.panels.work.dataset.lifted,undefined);assert.equal(f.container.dataset.arrangeDragging,undefined);
 assert.ok(f.animations.length>0);for(const animation of f.animations){assert.ok(animation.options.duration<=300);animation.cancel();}
 await Promise.resolve();assert.equal(f.panels.work.dataset.lifted,undefined);f.controller.destroy();
});

test('a diagonal move to the bottom of a shorter panel creates a stack rather than a sideways swap',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.panels.work.rect.height=200;f.panels.work.rect.bottom=300;
 f.controller.pointerdown(f.event('reader',950,120));t.mock.timers.tick(420);f.controller.pointermove(f.event('reader',570,298));f.tick(20);f.controller.pointerup(f.event('reader',570,298));
 await Promise.resolve();await Promise.resolve();assert.equal(f.calls[0].type,'dock');assert.equal(f.calls[0].edge,'bottom');assert.deepEqual(f.settings.workspaceLayout,{axis:'x',children:['context',{axis:'y',children:['work','reader']}]});f.controller.destroy();
});


test('mouse clicks and context menus cannot unlock movement or create placement controls',()=>{
 const f=fixture();f.controller.click({...f.event('work'),detail:1});assert.equal(f.controller.active(),false);assert.equal(f.controller.dragging(),false);assert.equal(f.toolbar.querySelector('.rd-place-choices'),null);
 assert.equal(f.controller.contextmenu(f.event('reader')),false);assert.equal(f.controller.active(),false);assert.equal(f.controller.dragging(),false);assert.equal(f.calls.length,0);f.controller.destroy();
});
test('a floating course preserves rail styling context and original dimensions, then cleans up on cancel',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();const card=f.cards['1'];
 f.controller.pointerdown({...f.event('work'),target:card,clientX:20,clientY:20});t.mock.timers.tick(420);
 const ghost=f.toolbar.querySelector('.rd-lift-ghost'),rail=ghost.querySelector('.rd-course-rail');assert.ok(rail,'original rail selectors must still apply to the floating course');assert.equal(rail.style['--rd-rail-row-h'],card.rect.height+'px');assert.equal(ghost.style.width,card.rect.width+'px');assert.equal(rail.children[0].dataset.arrangeCourse,'1');assert.notEqual(rail.children[0],card);
 assert.equal(f.container.querySelector('.rd-shell').querySelector('.rd-course-rail').children[0],card,'the measured original remains in the real rail');
 f.controller.pointercancel({pointerId:1});assert.equal(f.toolbar.querySelector('.rd-lift-ghost'),null);assert.equal(card.dataset.lifted,undefined);f.controller.destroy();
});
