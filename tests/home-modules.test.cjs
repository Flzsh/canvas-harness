const test=require('node:test'),assert=require('node:assert/strict');
require('../extension/site.js');
const A=require('../extension/workspace-arrange.js'),C=require('../extension/customization-model.js');
const fresh=()=>({...structuredClone(C.defaults),courseOrder:[]});
// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).
test('presets and the panel-order choice keep added modules; saved layouts with modules pass validation',()=>{
 const s=fresh();A.change(s,{type:'add',key:'clock'});A.change(s,{type:'add',key:'notes'});
 const before=A.snapshot(s);s.deskOrder='work-first';A.resetCore(s,before.layout);
 assert.deepEqual(A.snapshot(s).order,['clock','notes','work','reader','context']);
 assert.deepEqual(C.cleanSettings(s).workspaceLayout,s.workspaceLayout);
 assert.throws(()=>A.cleanLayout({axis:'x',children:['work','reader']}),/workspaceLayout/,'a layout must hold all three panels');
 assert.throws(()=>A.cleanLayout({axis:'x',children:['context','work','reader','work']}),/workspaceLayout/);
 assert.throws(()=>A.cleanLayout({axis:'x',children:['context','work','reader','weather']}),/workspaceLayout/,'unknown modules are refused');
 assert.throws(()=>C.cleanSettings({...s,panelFrame:'glow'}),/panelFrame/);
});
test('a narrow page wraps to two columns before it stacks to one, and modules get widths by weight',()=>{
 const tree={axis:'x',children:['context','work','reader']},col=g=>Object.fromEntries(Object.entries(g.cells).map(([k,v])=>[k,v.column+' | '+v.row]));
 assert.equal(new Set(Object.values(A.grid(tree,1200).cells).map(c=>c.row)).size,1,'three columns when there is room');
 const two=A.grid(tree,700);assert.equal(two.cells.context.row,two.cells.work.row);assert.notEqual(two.cells.reader.row,two.cells.work.row,'two and one at 700px');
 const one=A.grid(tree,280);assert.equal(new Set(Object.values(one.cells).map(c=>c.row)).size,3,'one column on a phone');
 const mixed=A.grid({axis:'x',children:['timer','work']},1000);assert.match(mixed.columns,/^minmax\(0,0\.3\d+fr\) minmax\(0,0\.6\d+fr\)$/,'a timer takes less of the row than the work list');
});
test('one column puts the work first, and the Focus preset shows the work beside its details',()=>{
 assert.deepEqual(A.legacyOrder({deskOrder:'stacked'}),['work','reader','context']);
 assert.equal(C.presets.focus.deskOrder,'work-first');assert.equal(C.presets.focus.showCourseInformation,false);assert.equal(C.presets.focus.courseNavigation,'topbar');
});
