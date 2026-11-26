'use strict';
require('../extension/site.js');
// Roadmap item 3 (4.2): "Daily help becomes a widget". Help, the daily AI help band, is one of Home's modules: the
// student places it, sizes it and takes it off like the others. Old saved layouts load as they were, with the band on top
// across the whole width, until the student moves it. Taking it off is still Edit Home's Help switch (showHelp), so the
// rule that nothing is sent on its own while Help is off keeps working unchanged.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../extension/workspace-arrange.js'),Customization=require('../extension/customization-model.js'),Band=require('../extension/study-band.js');
const {dom,descendants}=require('./study-fixture.cjs');
const DEFAULT=A.DEFAULT.layout,clone=v=>JSON.parse(JSON.stringify(v));

test('old saved layouts load exactly as they were; Help is drawn on top across the whole width until it is moved',()=>{
 const layouts=[undefined,{axis:'x',children:['context','work','reader']},{axis:'y',children:[{axis:'x',children:['week','timer']},{axis:'x',children:['context','work','reader']}]},{axis:'x',children:[{axis:'y',children:['context','notes']},'work','reader']}];
 for(const workspaceLayout of layouts){
  const settings=workspaceLayout?{workspaceLayout:clone(workspaceLayout)}:{},before=clone(settings);
  const saved=A.snapshot(settings).layout;assert.deepEqual(A.leaves(saved).includes('help'),false,'the saved layout is not touched');assert.deepEqual(settings,before);
  const drawn=A.drawn(settings);assert.deepEqual(drawn,A.split('y',['help',saved]));assert.equal(drawn.children[0],'help');
  const cells=A.grid(drawn,1400).cells,columns=Object.values(cells).map(c=>c.column).filter(c=>c!==cells.help.column);
  assert.equal(cells.help.row.split(' / ')[0],'1','on top');assert.ok(columns.every(c=>Number(c.split(' / ')[1])<=Number(cells.help.column.split(' / ')[1])),'across every column');
  assert.equal(cells.help.column.split(' / ')[0],'1');
  // and it survives settings cleaning and backups as it is
  assert.deepEqual(A.drawn(Customization.cleanSettings(clone(settings))),drawn);
 }
 assert.deepEqual(A.drawn({showHelp:false}),DEFAULT,'Help off: not drawn, nothing else moves');
});

test('moving Help puts it where it was dropped; Undo move gives back the band on top',()=>{
 const s={};assert.equal(A.change(s,{type:'dock',key:'help',target:'reader',edge:'bottom'}),true);
 assert.deepEqual(A.drawn(s),{axis:'x',children:['context','work',{axis:'y',children:['reader','help']}]});assert.equal(s.showHelp,true);
 assert.equal(A.change(s,{type:'undo'}),true);assert.deepEqual(A.drawn(s),{axis:'y',children:['help',DEFAULT]});
 // Top / Bottom / Left / Right in its menu
 for(const edge of ['top','bottom','left','right']){const t={};A.change(t,{type:'dock',key:'help',target:A.ROOT,edge});assert.ok(A.leaves(A.drawn(t)).includes('help'),edge);assert.deepEqual(A.leaves(A.drawn(t)).filter(k=>k!=='help'),['context','work','reader']);}
});

test('a module dropped beside or onto Help while it has no place yet lands where the student saw Help; nothing is lost',()=>{
 const s={};A.change(s,{type:'add',key:'week'});const before=A.leaves(A.drawn(s));
 assert.equal(A.change(s,{type:'dock',key:'week',target:'help',edge:'right'}),true);
 assert.deepEqual(A.drawn(s),{axis:'y',children:[{axis:'x',children:['help','week']},{axis:'x',children:['context','work','reader']}]});
 const t={};A.change(t,{type:'add',key:'notes'});A.change(t,{type:'swap',key:'notes',target:'help'});
 assert.deepEqual(A.leaves(A.drawn(t)).sort(),[...before.filter(k=>k!=='week'),'notes'].sort(),'a swap keeps every module');
 assert.deepEqual(A.leaves(A.drawn(t))[0],'notes','the module took Help\'s place on top');
});

test('taking Help off is the Help switch (nothing sent on its own); adding it back puts it on top again',()=>{
 const s={};A.change(s,{type:'dock',key:'help',target:'reader',edge:'bottom'});A.change(s,{type:'remove',key:'help'});
 assert.equal(s.showHelp,false);assert.equal(A.leaves(s.workspaceLayout).includes('help'),false);assert.equal(A.leaves(A.drawn(s)).includes('help'),false);
 A.change(s,{type:'help',value:true});assert.equal(s.showHelp,true);assert.deepEqual(A.drawn(s).children[0],'help');
 const t={};A.change(t,{type:'help',value:false});assert.equal(t.showHelp,false);A.change(t,{type:'add',key:'help'});assert.equal(t.showHelp,true);assert.equal(A.drawn(t).children[0],'help');
 // the old switch path still works, and off is off however Help was placed
 const u={};A.change(u,{type:'dock',key:'help',target:'work',edge:'left'});A.change(u,{type:'help',value:false});assert.equal(u.showHelp,false);assert.equal(A.leaves(A.drawn(u)).includes('help'),false);assert.equal(u.helpLayout,undefined);
});

test('Help is sized like the others and its width comes back with Undo move',()=>{
 assert.deepEqual(A.cleanSizes({help:'l',notes:'s'}),{help:'l',notes:'s'});assert.ok(A.isKey('help'));assert.ok(A.isExtra('help'));assert.ok(A.removable('help'));assert.equal(A.label('help'),'Help');
 assert.ok(A.WEIGHT.help>1&&A.MIN_WIDTH.help>=360,'it asks for a fair share of a row, and stays wide enough for its cards');
 // (fix-42: Help's width is kept on its own, settings.helpSize, never in moduleSize, which a build before 4.2 refuses;
 // a record a 4.2 preview wrote with it in moduleSize reads the same)
 for(const start of [{helpSize:'l'},{moduleSize:{help:'l'}}]){const s=clone(start);A.change(s,{type:'dock',key:'help',target:'reader',edge:'right'});A.setSize(s,'help','s');assert.equal(A.sizes(s).help,'s');A.change(s,{type:'undo'});assert.deepEqual(A.sizes(s),{help:'l'});assert.equal(s.helpSize,'l');assert.deepEqual(s.moduleSize,{});}
 assert.match(A.controls('help'),/data-arrange-grip/);assert.match(A.controls('help'),/data-rd-action="module-menu" data-widget="help"/);assert.match(A.controls('help'),/data-rd-action="widget-remove" data-widget="help"/);
 assert.doesNotThrow(()=>A.cleanLayout({axis:'y',children:['help',{axis:'x',children:['context','work','reader']}]}));
});

test('a layout preset keeps the added modules in their row; Help goes back to its own place on top',()=>{
 const s={};A.change(s,{type:'add',key:'week'});A.change(s,{type:'dock',key:'help',target:'week',edge:'right'});const previous=A.snapshot(s).layout;assert.ok(A.leaves(previous).includes('help'));
 A.resetCore(s,previous);assert.ok(A.leaves(s.workspaceLayout).includes('week'));assert.equal(A.leaves(s.workspaceLayout).includes('help'),false);assert.equal(s.helpLayout,undefined);assert.equal(A.drawn(s).children[0],'help');
});

// Home's desk: the band's host is the Help module there, and nowhere else.
function desk(settings,{ai=true,workPage=''}={}){
 const source=fs.readFileSync(path.join(__dirname,'../extension/dashboard-view.js'),'utf8'),i=source.indexOf('function desk(');
 assert.ok(i>0);return {source,i};
}
test('Home draws Help as a module of the desk (the band host), never above it; not on the Assignments page or without Your AI',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../extension/dashboard-view.js'),'utf8');
 assert.match(src,/blocks\.help='<div class="ch-band-host rd-help-module" data-rd-key="help-band" data-help-band data-arrange-key="help" aria-label="Help"><\/div>'/);
 assert.match(src,/if\(enabled\('ai'\)&&c\.s\.showHelp!==false\)blocks\.help=/);
 assert.equal((src.match(/data-help-band/g)||[]).length,1,'one host, inside the desk');
 assert.match(src,/if\(c\.workPage==='assignments'\)return `<div class="rd-main rd-desk" data-rd-key="main">\$\{blocks\.work\}\$\{blocks\.reader\}<\/div>`;/,'the Assignments page has no Help, as before');
 assert.match(src,/A\.leaves\(A\.drawn\(c\.s\)\)/,'the desk follows the drawn layout');
});

test('the band\'s bar becomes the module\'s heading with its grip, menu and remove at the end; without arrange it is as before',async()=>{
 const d=dom(),host=new d.Element('div'),env={document:d.document},tools=new d.Element('span');tools.className='rd-arrange-tools';tools.nodeType=1;
 const view=Band.renderBand(host,{},{env,arrange:{head:'help',tools:doc=>{assert.equal(doc,d.document);return tools;}}});await view.loaded;
 const bar=descendants(host).find(n=>n.className==='ch-band-toolbar');assert.equal(bar.dataset.arrangeHead,'help');assert.ok(bar.children.includes(tools),'in the bar (widgets.css orders it last)');view.destroy();
 const plainHost=new d.Element('div'),plain=Band.renderBand(plainHost,{},{env});await plain.loaded;
 const plainBar=descendants(plainHost).find(n=>n.className==='ch-band-toolbar');assert.equal(plainBar.dataset.arrangeHead,undefined);assert.ok(!descendants(plainHost).some(n=>n.className==='rd-arrange-tools'));plain.destroy();
 // a broken tools maker never stops the band
 const h3=new d.Element('div'),v3=Band.renderBand(h3,{},{env,arrange:{head:'help',tools:()=>{throw Error('x');}}});await v3.loaded;assert.ok(descendants(h3).some(n=>n.className==='ch-band-toolbar'));v3.destroy();
});

test('gestures lay out and preview drops on the drawn layout (Help included)',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../extension/workspace-gestures.js'),'utf8');
 assert.match(src,/function applyLayout\(layout=drawnLayout\(\)\)/);assert.match(src,/M\.dock\(drawnLayout\(\),c\.key,c\.target,c\.edge\)/);assert.match(src,/M\.swap\(drawnLayout\(\),c\.key,c\.target\)/);
});

test('Biscuit can move Help to the top, make it wide, show and hide it',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../extension/widgets.js'),'utf8');
 assert.doesNotMatch(src,/Help stays above the Home modules/);
 assert.match(src,/if\(!\['show','hide','top','wide'\]\.includes\(action\)\)return false;const A=Arrange\(\);/);
 // the same steps on a settings record
 const s={};A.change(s,{type:'help',value:true});A.change(s,{type:'dock',key:'help',target:A.ROOT,edge:'top'});assert.equal(A.leaves(A.drawn(s))[0],'help');
});

test('Help\'s place is saved beside the layout, never in it, so a build before 4.2 still loads the record; a stale place is let go',()=>{
 const s={};A.change(s,{type:'add',key:'notes'});A.change(s,{type:'dock',key:'help',target:'reader',edge:'bottom'});assert.equal(A.change(s,{type:'dock',key:'notes',target:'work',edge:'right'}),true);
 for(const tree of [s.workspaceLayout,s.workspaceUndo.layout])assert.equal(A.leaves(tree).includes('help'),false,'no Help in a layout an older build reads');
 assert.ok(A.leaves(s.helpLayout).includes('help'));assert.ok(A.leaves(s.workspaceUndo.helpLayout).includes('help'),'the undo copy keeps it beside its layout too');
 assert.deepEqual(A.strip(s.helpLayout),s.workspaceLayout);
 // the same record cleaned as a backup: kept
 const clean=Customization.cleanSettings(clone(s));assert.deepEqual(clean.helpLayout,s.helpLayout);assert.deepEqual(A.drawn(clean),A.drawn(s));
 // an older build moved something meanwhile (its layout no longer matches Help's): Help is drawn on top again, nothing else lost
 const older={...clone(s),workspaceLayout:{axis:'x',children:['work','context','reader','notes']}};
 assert.deepEqual(A.drawn(older),{axis:'y',children:['help',{axis:'x',children:['work','context','reader','notes']}]});
 // a Market layout pack never places Help: it keeps the student's own Help switch and place rules
 const src=fs.readFileSync(path.join(__dirname,'../extension/preset-pack.js'),'utf8');assert.match(src,/if\(!keep\(key\)\|\|key==='help'\)tree=m\.prune\(tree,key\);/);
});
