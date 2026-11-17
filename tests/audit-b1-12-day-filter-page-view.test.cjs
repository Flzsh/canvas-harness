'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{mount,settle}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-12: on the Assignments page, choosing a day in the week strip and clicking it again to clear it left the page on
// Up next instead of its own All view (the day filter predates All and always fell back to Up next).
test('B1-12 clearing a day on the Assignments page returns to All; on Home to Up next',async()=>{
 const f=mount({initialState:{workspace:'assignments'}});await settle();
 f.click('day',{day:'2026-11-06'});await settle();
 assert.equal(f.view.getState().day,'2026-11-06');
 f.click('day',{day:'2026-11-06'});await settle();
 assert.equal(f.view.getState().day,'');assert.equal(f.view.getState().mode,'all');
 f.view.destroy();
 const home=mount();await settle();
 home.click('day',{day:'2026-11-06'});await settle();home.click('day',{day:'2026-11-06'});await settle();
 assert.equal(home.view.getState().mode,'actionable');
 home.view.destroy();
});
