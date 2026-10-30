const {test}=require('node:test'),assert=require('node:assert/strict'),{wallTimeToISO}=require('../extension/ui-utils.js');
test('personal deadline uses the selected timezone independently of the device',()=>{
 assert.equal(wallTimeToISO('2026-09-11T15:00','America/New_York'),'2026-09-11T19:00:00.000Z');
 assert.equal(wallTimeToISO('2026-09-11T15:00','Asia/Shanghai'),'2026-09-11T07:00:00.000Z');
});
test('nonexistent daylight-saving times and impossible calendar dates are rejected',()=>{
 assert.throws(()=>wallTimeToISO('2026-03-08T02:30','America/New_York'),/exist|clock/i);
 assert.throws(()=>wallTimeToISO('2026-02-30T15:00','America/New_York'),/valid|date/i);
});
test('repeated fall-back wall time selects the earlier occurrence consistently',()=>{
 assert.equal(wallTimeToISO('2026-11-01T01:30','America/New_York'),'2026-11-01T05:30:00.000Z');
});
