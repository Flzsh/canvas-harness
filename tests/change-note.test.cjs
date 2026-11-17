'use strict';
// The change note (job X, 2026-11-16; the lead picked the slip): after Archive or Mark done on Home, one drawn slip says
// what Canvas Harness changed, each thing with its course and day, puts back one or all, merges a second change, folds out of the
// way and leaves; an overlay at the dashboard's root, so it never moves the page (the "N archived in Canvas Harness / Undo" pill sat
// in the toolbar's row). Since 4.0.168 it comes FOLDED, one line that lies over none of the page's controls (open, its list
// covered the reader's buttons: the function check of 4.0.167); Show opens the list.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const View=require('../extension/dashboard-view.js');
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg class="rd-icon" data-i="${name}"></svg>`;
const two=[{id:'17',name:'Gas laws',course:'Chemistry',color:'#C96442',due:'Thu, Nov 19',kind:'archive'},{id:'18',name:'Essay <draft>',course:'English',color:'#5B7FA3',due:'',kind:'archive'}];

test('the slip names every thing with its course and day, Put back for each, Undo all first in the tab order',()=>{
 const {said,html}=View.noteHTML({entries:two,state:'open'},{E,icon});
 assert.equal(said,'2 archived in Canvas Harness: Gas laws, Essay <draft>','the count and the first names, for a screen reader');
 assert.match(html,/<b class="rd-note-count">2<\/b> <span>archived<\/span> <small>in Canvas Harness<\/small>/);
 assert.match(html,/data-note-id="17" style="--rd-note-c:#C96442"/);
 assert.match(html,/<span class="rd-note-name">Gas laws<\/span><span class="rd-note-meta"><span class="rd-note-course">Chemistry<\/span><span class="rd-note-day">Thu, Nov 19<\/span>/);
 assert.match(html,/Essay &lt;draft&gt;/,'names are escaped');
 assert.equal((html.match(/data-rd-action="note-undo"/g)||[]).length,2,'one Put back per thing');
 assert.match(html,/data-rd-action="note-undo" data-id="18" aria-label="Put back: Essay &lt;draft&gt;"><svg class="rd-icon" data-i="undo"><\/svg><span>Put back<\/span>/,'a drawing and a name');
 const order=[...html.matchAll(/data-rd-action="([a-z-]+)"/g)].map(m=>m[1]);
 assert.deepEqual(order,['selection-undo','note-close','note-undo','note-undo'],'Undo all is the first control in the tab order');
 assert.match(html,/class="rd-button rd-button--primary rd-note-all" data-rd-action="selection-undo" ><svg class="rd-icon" data-i="undo"><\/svg><span>Undo all<\/span>/);
 assert.match(html,/data-rd-action="note-close" ><svg class="rd-icon" data-i="close"><\/svg><span>Close<\/span>/);
 assert.doesNotMatch(html,/<p class="rd-note-(?!title)/,'no description sentences under the controls');
});

test('one thing says Undo with no second control; Mark done says Marked done; a mix says put away and marks each; many names are cut to three',()=>{
 const one=View.noteHTML({entries:[two[0]],state:'open'},{E,icon});
 assert.match(one.html,/<span>Undo<\/span>/);assert.doesNotMatch(one.html,/note-undo/,'one thing: the Undo of the note is its Put back');
 assert.equal(one.said,'1 archived in Canvas Harness: Gas laws');
 const done=View.noteHTML({entries:[{...two[0],kind:'done'}],state:'open'},{E,icon});
 assert.equal(done.said,'Marked done: Gas laws');assert.match(done.html,/<span>Marked done<\/span>/);
 const mixed=View.noteHTML({entries:[{...two[0],kind:'done'},two[1]],state:'open'},{E,icon});
 assert.equal(mixed.said,'2 put away in Canvas Harness: Gas laws, Essay <draft>');assert.match(mixed.html,/<span class="rd-note-kind">Marked done<\/span>[\s\S]*<span class="rd-note-kind">Archived<\/span>/);
 const five=['A','B','C','D','E'].map((name,i)=>({id:String(i),name,course:'',color:'',due:'',kind:'archive'}));
 assert.equal(View.noteHTML({entries:five,state:'folded'},{E,icon}).said,'5 archived in Canvas Harness: A, B, C, and 2 more');
});

test('folded keeps Undo all first, then Show and Close; done says what was put back and offers nothing more; busy marks Undo',()=>{
 const folded=View.noteHTML({entries:two,state:'folded'},{E,icon}).html;
 assert.doesNotMatch(folded,/rd-note-list/);
 assert.deepEqual([...folded.matchAll(/data-rd-action="([a-z-]+)"/g)].map(m=>m[1]),['selection-undo','note-open','note-close']);
 assert.match(folded,/data-rd-action="note-open" aria-expanded="false"/);
 const done=View.noteHTML({entries:[],state:'done',putBack:2},{E,icon});
 assert.equal(done.said,'Put back 2 on your list');assert.doesNotMatch(done.html,/data-rd-action/);
 const busy=View.noteHTML({entries:two,state:'open',busy:true},{E,icon}).html;
 assert.match(busy,/data-rd-action="selection-undo" aria-disabled="true" aria-busy="true"/);
 // folded with one thing: its name is on the line (escaped); with more, or open, the line has no name
 const one=View.noteHTML({entries:[two[1]],state:'folded'},{E,icon}).html;
 assert.match(one,/<small>in Canvas Harness<\/small> <span class="rd-note-one">Essay &lt;draft&gt;<\/span><\/p>/);
 assert.match(View.noteHTML({entries:[{...two[0],kind:'done'}],state:'folded'},{E,icon}).html,/<span>Marked done<\/span> <span class="rd-note-one">Gas laws<\/span>/);
 assert.doesNotMatch(folded,/rd-note-one/);assert.doesNotMatch(View.noteHTML({entries:[two[0]],state:'open'},{E,icon}).html,/rd-note-one/);
});

test('the slip ships alone: no look switch, no other looks in its stylesheet or code; Off and reduced motion: it just appears',()=>{
 const css=fs.readFileSync(require.resolve('../extension/selection.css'),'utf8'),js=fs.readFileSync(require.resolve('../extension/dashboard.js'),'utf8');
 // one look: the note's rules key only on its own states, and nothing switches it from the page's storage
 const keyed=new Set([...css.matchAll(/\.rd-note[\w-]*\[([\w-]+)/g)].map(m=>m[1]));
 for(const k of keyed)assert.ok(['data-enter','data-new','data-bump','data-state','data-turn','hidden','aria-disabled'].includes(k),'the note keys only on its own states: '+k);
 assert.doesNotMatch(js,/localStorage[^;]*note|note[^;]*localStorage/i);
 // while it shows the dashboard says so and Biscuit's layer lies under it (4.0.170: the pony stood on Undo and took the press meant for it)
 assert.ok(css.includes('.rd[data-note-on] .pet-layer {z-index:1080}'));assert.ok(/\.rd \.rd-note \{[^}]*z-index:1090/.test(css),'the slip itself is above that');
 assert.equal((js.match(/setAttribute\?\.\('data-note-on',''\)/g)||[]).length,1);assert.equal((js.match(/removeAttribute\?\.\('data-note-on'\)/g)||[]).length,2,'taken off wherever the slip is hidden');
 assert.ok(css.includes('@media (prefers-reduced-motion:reduce) {.rd .rd-note,.rd .rd-note * {animation:none!important;transition:none!important}}'));
 assert.ok(css.includes('.rd:is([data-motion-style=off],[data-kb]) .rd-note,.rd:is([data-motion-style=off],[data-kb]) .rd-note * {animation:none!important;transition:none!important}'));
 assert.ok(js.includes("const off=container.dataset.motionStyle==='off'||container.hasAttribute?.('data-kb')||!!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;"),'and it goes at once there');
});

// ---- the note's life on Home, in the dashboard itself (a small DOM: the dashboard's own node and the note's)
const {fixture,idle}=require('./dashboard-small-dom-fixture.cjs');

test('Archive draws the slip at the dashboard root, out of the page, as one line; Show opens each thing with its course',async t=>{
 const f=fixture();t.after(()=>f.view.destroy());
 f.click('select-item','17');f.click('select-item','18');f.click('selection-archive');await idle();
 const n=f.note();assert.ok(n,'the note is drawn');assert.equal(n.parentNode,f.element,'at the dashboard root, beside the page, never inside it');
 assert.equal(n.getAttribute('data-rd-keep'),'','renders keep it');
 assert.equal(n.getAttribute('data-state'),'folded','it comes as one line');assert.match(n.html,/2<\/b> <span>archived/);assert.doesNotMatch(n.html,/rd-note-list/);
 assert.deepEqual([...n.html.matchAll(/data-rd-action="([a-z-]+)"/g)].map(m=>m[1]),['selection-undo','note-open','note-close']);assert.equal(n.getAttribute('data-enter'),'','it rises in');
 f.click('note-open');assert.equal(n.getAttribute('data-state'),'open');assert.equal(n.getAttribute('data-turn'),'','the paper settles as it opens');
 assert.match(n.html,/Gas laws[\s\S]*Chemistry/);assert.match(n.html,/Essay draft[\s\S]*English/);
 assert.equal(n.children[0].getAttribute('role'),'status');assert.match(n.children[0].textContent,/^2 archived in Canvas Harness: (Gas laws, Essay draft|Essay draft, Gas laws)$/);
 assert.doesNotMatch(f.element.innerHTML,/archived in Canvas Harness/,'the toolbar row no longer holds an archived pill');
 assert.equal(f.data.tasks['17'].checkedOff,true);assert.equal(f.data.tasks['18'].checkedOff,true);
});

test('a second Archive joins the slip (newest first), while open and while folded, and Undo all puts every one back',async t=>{
 const f=fixture({tasks:{'19':{checkedOff:false,notes:'keep'}}});t.after(()=>f.view.destroy());
 f.click('select-item','17');f.click('selection-archive');await idle();
 const n=f.note();assert.match(n.html,/<span class="rd-note-one">Gas laws<\/span>/,'one thing: its name on the line');
 f.click('note-open');assert.equal(n.getAttribute('data-state'),'open');
 f.click('select-item','19');f.click('selection-archive');await idle();
 assert.equal(n.getAttribute('data-state'),'open','a change while the list is open joins it there');assert.equal(n.children[0].textContent,'2 archived in Canvas Harness: Rates lab, Gas laws','merged while open, newest first');
 assert.equal(n.getAttribute('data-turn'),null,'and the paper does not settle again');
 f.fire(8000);assert.equal(n.getAttribute('data-state'),'folded');assert.equal(n.getAttribute('data-turn'),'','it settles as it folds');
 f.click('select-item','18');f.click('selection-archive');await idle();
 assert.equal(n.getAttribute('data-state'),'folded','a change while folded leaves it folded');assert.equal(n.children[0].textContent,'3 archived in Canvas Harness: Essay draft, Rates lab, Gas laws');
 assert.match(n.html,/<b class="rd-note-count">3<\/b>/);assert.doesNotMatch(n.html,/rd-note-list/);assert.equal(n.getAttribute('data-turn'),null,'the line stays still');
 f.click('selection-undo');await idle();
 assert.equal(f.data.tasks['17'].checkedOff,undefined,'back to no value');assert.equal(f.data.tasks['19'].checkedOff,false,'back to the value it had');assert.equal(f.data.tasks['19'].notes,'keep');assert.equal(f.data.tasks['18'].checkedOff,undefined);
 assert.equal(n.getAttribute('data-state'),'done');assert.equal(n.children[0].textContent,'Put back 3 on your list');
 f.fire(1800);assert.equal(n.getAttribute('data-state'),'leaving','it leaves after a moment');
});

test('Put back takes one thing back and leaves the others listed; the last one ends the note',async t=>{
 const f=fixture();t.after(()=>f.view.destroy());
 f.click('select-item','17');f.click('select-item','18');f.click('selection-archive');await idle();
 f.click('note-open');f.click('note-undo','18');await idle();
 assert.equal(f.data.tasks['18'].checkedOff,undefined);assert.equal(f.data.tasks['17'].checkedOff,true);
 const n=f.note();assert.equal(n.children[0].textContent,'1 archived in Canvas Harness: Gas laws');assert.doesNotMatch(n.html,/Essay draft/);
 f.click('selection-undo');await idle();assert.equal(f.data.tasks['17'].checkedOff,undefined);assert.equal(n.getAttribute('data-state'),'done');
});

test('Mark done joins the note; putting it back anywhere takes it off',async t=>{
 const f=fixture();t.after(()=>f.view.destroy());
 f.click('check-off','19');await idle();
 const n=f.note();assert.equal(n.children[0].textContent,'Marked done: Rates lab');assert.equal(n.getAttribute('data-state'),'folded');assert.match(n.html,/<span>Marked done<\/span> <span class="rd-note-one">Rates lab<\/span>/);
 f.click('note-open');assert.match(n.html,/Rates lab[\s\S]*Chemistry/);
 f.click('select-item','17');f.click('selection-archive');await idle();assert.equal(n.children[0].textContent,'2 put away in Canvas Harness: Gas laws, Rates lab');
 f.click('undo-check-off','19');await idle();assert.equal(f.data.tasks['19'].checkedOff,false);assert.equal(n.children[0].textContent,'1 archived in Canvas Harness: Gas laws');
});

test('a failed save keeps the note and its Undo; Close and Escape end it without changing anything',async t=>{
 const f=fixture();t.after(()=>f.view.destroy());
 f.click('select-item','17');f.click('selection-archive');await idle();
 f.store.fail=true;f.click('selection-undo');await idle();f.store.fail=false;
 const n=f.note();assert.equal(f.data.tasks['17'].checkedOff,true);assert.equal(n.getAttribute('data-state'),'folded');assert.match(n.html,/selection-undo/);
 f.click('note-close');assert.equal(n.getAttribute('data-state'),'leaving');assert.equal(f.data.tasks['17'].checkedOff,true,'closing changes nothing');
 f.click('select-item','18');f.click('selection-archive');await idle();assert.equal(n.getAttribute('data-state'),'folded','after a Close the next change comes folded again');
 n.listeners.keydown({key:'Escape',stopPropagation(){}});assert.equal(n.getAttribute('data-state'),'leaving');
});

test('Show opens the list; it folds again after a quiet moment (Undo all stays) and opens again on Show',async t=>{
 const f=fixture();t.after(()=>f.view.destroy());
 f.click('select-item','17');f.click('select-item','18');f.click('selection-archive');await idle();
 const n=f.note();assert.equal(n.getAttribute('data-state'),'folded');f.fire(8000);assert.equal(n.getAttribute('data-state'),'folded','left alone it stays one line');
 f.click('note-open');assert.equal(n.getAttribute('data-state'),'open');assert.equal((n.html.match(/data-rd-action="note-undo"/g)||[]).length,2);
 f.fire(8000);assert.equal(n.getAttribute('data-state'),'folded');assert.match(n.html,/selection-undo/);assert.match(n.html,/note-open/);
 f.click('note-open');assert.equal(n.getAttribute('data-state'),'open');
});
