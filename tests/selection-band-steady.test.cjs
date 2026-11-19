'use strict';
// Owner, 2026-11-16: "when I select a course to either use in ai or archive, the banner theme shrinks then extend for no
// reason". Measured in the real dashboard (job X): selecting one item turned the desk's toolbar from its one wrapping row
// into a grid with a selection area (refresh.css asked the row `:has(.rd-selection-slot:empty)`), so the row grew 47-60 px,
// the desk moved down by as much, and every theme's band (scene-themes.js / data-theme.js measureBand: the band reaches
// where .rd-main starts) grew and shrank with each select / Archive / Undo / Clear. These pin the cause away: nothing in
// the row's layout may depend on what the selection slot holds, and the slot itself stays out of the row's flow.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ext=path.resolve(__dirname,'../extension');
const SHEETS=['app.css','dashboard.css','workspace.css','refresh.css','customize.css','selection.css','responsive-layout.css','widgets.css','scene-themes.css','study-band.css'];
const strip=text=>text.replace(/\/\*[\s\S]*?\*\//g,'');
function parse(text){
 const out=[],stack=[];let buf='';
 for(const ch of strip(text)){
  if(ch==='{'){stack.push(buf.replace(/\s+/g,' ').trim());buf='';}
  else if(ch==='}'){const sel=stack.pop();if(sel&&!sel.startsWith('@')&&buf.trim())out.push({sel,at:stack.filter(s=>s.startsWith('@')).join(' '),body:Object.fromEntries(buf.split(';').map(d=>d.trim()).filter(Boolean).map(d=>{const i=d.indexOf(':');return [d.slice(0,i).trim(),d.slice(i+1).trim()];}))});buf='';}
  else buf+=ch;
 }
 return out;
}
const rules=SHEETS.flatMap(file=>parse(fs.readFileSync(path.join(ext,file),'utf8')).map(r=>({...r,file})));
// the themes' own sheets too (a scene's theme.css could restyle the row)
for(const dir of fs.readdirSync(path.join(ext,'themes'))){const f=path.join(ext,'themes',dir,'theme.css');if(fs.existsSync(f))rules.push(...parse(fs.readFileSync(f,'utf8')).map(r=>({...r,file:'themes/'+dir+'/theme.css'})));}

test('no rule lays the desk toolbar out by what its selection slot holds',()=>{
 const asking=rules.filter(r=>/rd-desk-toolbar[^,{]*:has\([^)]*selection/.test(r.sel)||/:has\([^)]*rd-selection-slot/.test(r.sel)&&/rd-desk-toolbar|rd-workspace|\.rd-main|\.rd\b(?![-\w])/.test(r.sel.replace(/:has\([^)]*\)/g,'')));
 assert.deepEqual(asking.map(r=>r.file+': '+r.sel),[],'a selection must not restyle the row (or anything that holds it)');
 const layoutProps=['display','grid-template-columns','grid-template-rows','grid-template-areas','grid-template','margin','margin-bottom','margin-top','gap','row-gap','min-height','height','flex-wrap','padding','padding-bottom','padding-top'];
 const bySelection=rules.filter(r=>/rd-selection/.test(r.sel)&&/rd-desk-toolbar\s*$|rd-desk-toolbar\.rd-desk-toolbar\s*$/.test(r.sel.split(',').map(s=>s.trim()).find(s=>/rd-desk-toolbar/.test(s))||'')&&Object.keys(r.body).some(p=>layoutProps.includes(p)));
 assert.deepEqual(bySelection.map(r=>r.file+': '+r.sel),[],'no rule keyed on a selection sets the row\'s box');
});

test('no grid area is kept for the selection in the toolbar row',()=>{
 const areas=rules.filter(r=>Object.entries(r.body).some(([p,v])=>/^grid-template(-areas)?$/.test(p)&&/selection/.test(v)));
 assert.deepEqual(areas.map(r=>r.file+': '+r.sel+' '+r.at),[],'a selection area would be a column or row that opens and closes');
 assert.ok(!rules.some(r=>/rd-selection-slot/.test(r.sel)&&/grid-area/.test(Object.keys(r.body).join(' '))),'the slot is not a grid cell');
});

test('the selection slot hangs over the row: out of its flow at every width',()=>{
 const slot=rules.filter(r=>r.sel==='.rd .rd-selection-slot'&&r.file==='selection.css');
 assert.equal(slot.length,1,'one base rule for the slot');
 assert.equal(slot[0].body.position,'absolute','the bar is an overlay, so the row keeps its height');
 assert.equal(slot[0].at,'','at every width');
 // nothing at any width puts it back into the flow
 const back=rules.filter(r=>/rd-selection-slot(?![-\w])/.test(r.sel)&&r.body.position&&r.body.position!=='absolute');
 assert.deepEqual(back.map(r=>r.file+': '+r.sel+' '+r.at),[]);
 // and the row keeps one look: the wrapping row it has with nothing selected
 const row=rules.filter(r=>r.sel==='.rd[data-workspace=work] .rd-desk-toolbar.rd-desk-toolbar'&&r.file==='refresh.css');
 assert.equal(row.length,1);assert.equal(row[0].body.display,'flex');assert.equal(row[0].body['flex-wrap'],'wrap');assert.equal(row[0].body['margin-bottom'],'8px');
 assert.ok(!rules.some(r=>SHEETS.indexOf(r.file)>SHEETS.indexOf('refresh.css')&&/\.rd\[data-workspace=work\] \.rd-desk-toolbar$/.test(r.sel)&&r.body.display&&r.body.display!=='flex'),'no later sheet turns the row into something else');
});

test('the band measures the desk, which the slot can no longer move (the cause, not the band, was fixed)',()=>{
 // The bands still follow the desk: a real change of the row (a font, Edit Home, the Help band) still re-fits them.
 // (data-theme.js has no band in this build: theme packs with their own band are not in it)
 const scene=fs.readFileSync(path.join(ext,'scene-themes.js'),'utf8');
 assert.match(scene,/const BAND='\.rd-main, \.ch-band-host'/);
 // and the view still renders the slot in the row, where the floating copy and the selection logic look for it
 const view=fs.readFileSync(path.join(ext,'dashboard-view.js'),'utf8');
 assert.match(view,/<div class="rd-selection-slot" data-rd-key="selection-slot">\$\{selectionBar\(\)\}<\/div>/);
});

// Job F's real-page pass (2026-11-16) saw, once, at 1000 wide with the course dock, the Home title shrink to 1x1 px and the
// heading grow 18 px as a second item was selected. Not reproduced with the circles themselves (1 to 5 items, 800 / 1000 /
// 1100 wide, every course layout: nothing moves); the pictures show a course page instead (a drawn course title hides the
// text title by design), reached when that pointer press landed on the course dock lying over the list's lower rows. This
// pins the selection side of it: the heading and the toolbar row are drawn the same whatever the count, so a longer label
// ("2 selected", "Archive 2") can only change the bar, which hangs outside the row's flow.
test('selecting 1, 2, 3 or 5 items never changes the heading or the toolbar row (only the bar in its out-of-flow slot)',async t=>{
 const {fixture,idle}=require('./dashboard-small-dom-fixture.cjs');
 const soon=new Date(Date.now()+2*86400000).toISOString(),extra=[20,21].map(id=>({id:String(id),course_id:'8',name:'Reading '+id,due_at:soon,submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}}));
 const f=fixture({},extra);t.after(()=>f.view.destroy());await idle();
 const heading=html=>html.slice(html.indexOf('<div class="rd-workspace-heading"'),html.indexOf('<div class="rd-selection-other'));
 const row=html=>{const a=html.indexOf('<div class="rd-desk-toolbar"'),b=html.indexOf('<div class="rd-main',a);return html.slice(a,b<0?undefined:b).replace(/(<div class="rd-selection-slot" data-rd-key="selection-slot">)[\s\S]*?(<\/div>(?:<div class="rd-arrange-guide"|<\/div>|$))/,'$1$2');};
 const h0=heading(f.element.innerHTML),r0=row(f.element.innerHTML);
 assert.ok(h0.length>100&&r0.length>100,'the heading and the row are found');
 const ids=['17','18','19','20','21'];let n=0;
 for(const want of [1,2,3,5]){
  while(n<want){f.click('select-item',ids[n]);n++;}await idle();
  const html=f.element.innerHTML;
  assert.match(html,new RegExp('<span role="status">'+want+' selected</span>'),'the bar counts '+want);
  assert.equal(heading(html),h0,'the heading (and its title) are the same with '+want+' selected');
  assert.equal(row(html),r0,'the toolbar row outside the slot is the same with '+want+' selected');
 }
 f.click('selection-clear');await idle();assert.equal(heading(f.element.innerHTML),h0);assert.equal(row(f.element.innerHTML),r0);
 // and nothing in the stylesheets keys the heading or the title on a selection
 const keyed=rules.filter(r=>/rd-selection|data-selection-away|select-item|aria-pressed/.test(r.sel)&&/rd-workspace-heading|rd-course-heading|\bh1\b/.test(r.sel));
 assert.deepEqual(keyed.map(r=>r.file+': '+r.sel),[]);
});
