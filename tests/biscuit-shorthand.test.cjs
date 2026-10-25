'use strict';
// Owner screenshot 2026-10-23: "calculus hw" answered with the course home page. Schoolwork shorthand reads as the work it
// names, so the homework ranks above a page that only repeats the course name.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Engine=require('../extension/biscuit-engine.js');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'..','extension','biscuit-rules','basic.json'),'utf8')),engine=Engine.create({pack});
const home='Contact Information. Office Hours Tuesday and Thursday. Course Content Unit 1: Vectors Unit 2: Differentiation. Multivariable Calculus resources, course syllabus, textbook.';
const s={now:Date.parse('2026-10-23T18:00:00Z'),timeZone:'America/New_York',courses:[{id:'501',name:'CL Multivariable Calculus'},{id:'502',name:'CL English: World Literature'}],workItems:[{id:'h6',courseId:'501',title:'Homework #6',dueAt:Date.parse('2026-10-22T03:59:00Z'),missing:true},{id:'h7',courseId:'501',title:'Homework #7',dueAt:Date.parse('2026-10-24T03:59:00Z')},{id:'e1',courseId:'502',title:'Essay draft',dueAt:Date.parse('2026-10-26T03:59:00Z')}],pages:[{id:'home-501',courseId:'501',title:'Multivariable Calculus Home Page',body:home,text:home}]};
for(const line of ['calculus hw','Calculus HW','math hw','calculus homework'])test(`"${line}" finds the calculus homework, not the home page`,()=>{const r=engine.evaluate(line,s);assert.match(String(r.items?.[0]?.title),/^Homework #[67]$/);});
test('times and chat shorthand are left as typed',()=>{const r=engine.evaluate('remind me at 7:30pm tmrw',s);assert.match(JSON.stringify(r),/7:30/);});
