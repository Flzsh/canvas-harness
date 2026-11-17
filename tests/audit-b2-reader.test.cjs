// B2 audit (2026-11-14): the PDF reader inside its frame. Each test fails on the untouched 4.0.164 copy and passes with its patch.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./audit-b2-reader-fixture.cjs');
const M=require('../extension/pdf-model.js'),KEY=M.storageKey('https://school.instructure.com','7','42');
const tool=(h,label)=>h.get('tool-buttons').children.find(n=>n.attrs['aria-label']===label);
const hide=h=>{h.doc.hidden=true;h.listeners.get('visibilitychange')();},show=h=>{h.doc.hidden=false;h.listeners.get('visibilitychange')();};

test('a sticky note being typed is kept when the student switches tabs, as a text box being typed already is',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const slot=h.reader.state.slots[0],top=slot.node.getBoundingClientRect().top;
 // a text box typed and left open: saved as the tab hides (the reader's existing rule)
 await tool(h,'Text box').fire('click');await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:40,clientY:top+300});
 slot.node.querySelector('.text-editor').value='Typed on the page';await tool(h,'Text box').fire('click');
 // a sticky note typed, its dialog still open, then another tab
 await tool(h,'Sticky note').fire('click');await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:30,clientY:top+40});
 assert.equal(h.get('note-editor').open,true);h.get('note-text').value='Ask about question 4 in class';
 hide(h);await h.settle();
 assert.equal(h.get('note-editor').open,false,'the dialog still closes while the tab is hidden');
 assert.deepEqual(h.storage[KEY].annotations.map(a=>a.text).sort(),['Ask about question 4 in class','Typed on the page']);
 show(h);await h.settle();
 assert.deepEqual(h.reader.state.annotations.annotations.map(a=>[a.type,a.text]).sort(),[['note','Ask about question 4 in class'],['text','Typed on the page']]);
});

test('a sticky note being typed is kept when Canvas leaves the page (a click outside the reader) as a text box is',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const slot=h.reader.state.slots[0];
 await tool(h,'Sticky note').fire('click');await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:30,clientY:slot.node.getBoundingClientRect().top+40});
 h.get('note-text').value='Check the second graph';h.listeners.get('pagehide')();await h.settle();
 assert.deepEqual(h.storage[KEY].annotations.map(a=>a.text),['Check the second graph']);
});

test('a sticky note being typed is kept when the page asks the reader to close (another PDF opened from Canvas)',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const slot=h.reader.state.slots[0];
 await tool(h,'Sticky note').fire('click');await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:30,clientY:slot.node.getBoundingClientRect().top+40});
 h.get('note-text').value='Quote this in the essay';assert.equal(await h.reader.close(7),true);
 assert.deepEqual(h.storage[KEY].annotations.map(a=>a.text),['Quote this in the essay']);
});

test('an empty sticky note left open is not saved when the tab hides',async t=>{
 const h=fixture();t.after(()=>h.reader.destroy());await h.initialise();await h.settle();
 const slot=h.reader.state.slots[0];
 await tool(h,'Sticky note').fire('click');await h.get('pages').fire('pointerdown',{target:slot.node,button:0,clientX:30,clientY:slot.node.getBoundingClientRect().top+40});
 h.get('note-text').value='   ';hide(h);await h.settle();show(h);await h.settle();
 assert.deepEqual(h.reader.state.annotations.annotations,[]);
});
