// A course keeps its default colour when it is moved: the default went by the course's place in the student's own
// order, so dragging one course in the sidebar repainted it and every course it passed (the rail, the Review deck's
// boxes, the course pages). The default now goes by the course's Canvas order; a colour the student chose still wins.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','extension');
// the public tree spreads long lines (scripts/readable-lines.cjs): the code is read joined up
const flat=file=>fs.readFileSync(path.join(dir,file),'utf8').replace(/\n\s*/g,'');

test('Home and the sidebar: the default colour follows the Canvas order, not the place in the list',()=>{
  const js=flat('dashboard.js');
  assert.match(js,/validColor\(pref\.color,COURSE_COLORS\[\(course\._index\?\?index\)%COURSE_COLORS\.length\]\)/);
  assert.doesNotMatch(js,/COURSE_COLORS\[index%COURSE_COLORS\.length\]/);
  assert.match(js,/_index:index\}\)\)/,'the Canvas order is kept on each course before the sort');
});

test('the course pages pick the same colour the same way',{skip:!fs.existsSync(path.join(dir,'app.js'))},()=>{
  const js=flat('app.js');
  assert.match(js,/COLORS\[\(course\.originalIndex\?\?index\)%COLORS\.length\]/);
  assert.doesNotMatch(js,/COLORS\[index%COLORS\.length\]/);
});
