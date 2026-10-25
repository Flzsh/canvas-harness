'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('exact values cover spoken clocks, fractional minutes and seconds',()=>{
 const V=require('../extension/biscuit-values.js'),s={now:Date.parse('2026-10-22T16:00:00Z'),timeZone:'America/New_York'};
 assert.equal(V.slots('five and a half minutes',s).minutes,5.5);assert.equal(V.slots('focus \u2212 90 seconds',s).minutes,1.5);assert.equal(V.slots('ten more mins on that session not a reminder',s).minutes,10);
 assert.equal(V.slots('at twenty past seven tonight',s).minute,1160);assert.equal(V.slots('at nine twenty tonight',s).minute,1280);assert.equal(V.slots('quarter to eight tonight',s).minute,1185);
 assert.equal(V.slots('one hundred and ten minutes',s).minutes,110);assert.equal(V.slots('one hour and a half',s).minutes,90);assert.equal(V.slots('three quarters of an hour',s).minutes,45);
});
