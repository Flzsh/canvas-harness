'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{mount,settle}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-11: Home reached from the Assignments page by a module's own way (Make it yours > Edit Home, the Help band, Biscuit)
// kept the Assignments page's "All" view: Home listed every assignment, done ones too, with no view button pressed.
test('B1-11 Home opened from the Assignments page by a module button shows Up next, not All',async()=>{
 let options;const board={create:o=>{options=o;return {sync(){},close(){},click:()=>false,keydown:()=>false,input:()=>false,change:()=>false,editing:()=>false,planUI:()=>({}),finished(){},destroy(){}};}};
 const f=mount({initialState:{workspace:'assignments'},extra:{ReserveWidgets:board}});await settle();
 assert.equal(f.view.getState().mode,'all','the Assignments page opens on All');
 options.go('work');await settle();
 const state=f.view.getState();
 assert.equal(state.workspace,'work');assert.equal(state.mode,'actionable');
 f.view.destroy();
});
