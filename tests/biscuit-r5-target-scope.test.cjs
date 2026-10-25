'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Learn=require('../extension/biscuit-learn.js'),Intent=require('../extension/biscuit-intent.js');
test('ruled-out target nouns do not enter positive learned matching',()=>{const c=Learn.context('Find the instrument manual, not the field assignment.',{}, {},[]);assert.ok(c.q.includes('manual'));assert.ok(!c.positive.q.includes('assignment'));assert.ok(!c.kindCues.includes('work'));});
test('later requests do not become the first retrieval target',()=>{const c=Learn.context('Find the observation chart then the signed form task.',{}, {},[]);assert.ok(c.q.includes('chart'));assert.ok(!c.q.includes('signed'));});
test('target scoping retains a policy question with an internal negative',()=>{assert.match(Intent.targetText('Find the policy about not disturbing nests.'),/not disturbing nests/);});
