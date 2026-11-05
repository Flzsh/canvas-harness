const {test}=require('node:test'),assert=require('node:assert/strict');const {escapeHTML,safeURL,color}=require('../extension/ui-utils.js');
test('assignment and course names cannot become executable markup',()=>assert.equal(escapeHTML('<img onerror="alert(1)">'), '&lt;img onerror=&quot;alert(1)&quot;&gt;'));
test('unsafe link schemes are blocked while course links resolve to School',()=>{assert.equal(safeURL('javascript:alert(1)'),'#');assert.equal(safeURL('data:text/html,x'),'#');assert.equal(safeURL('/courses/7'),'https://school.instructure.com/courses/7');});
test('custom course colors cannot inject additional CSS',()=>{assert.equal(color('red; background:url(https://x)'),'#286452');assert.equal(color('#123ABC'),'#123ABC');});
