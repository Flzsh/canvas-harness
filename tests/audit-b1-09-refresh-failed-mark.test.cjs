'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{req,ext}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-09: a Refresh that Canvas failed never showed as failed. The session resolves a failed refresh with null, so the
// dashboard's "Refresh failed" status (the refresh button's red mark and "click to try again") was never reached.
const user={id:'7'},snapshot=()=>({user,origin:'https://school.instructure.com',courses:[],assignments:[],fetchedAt:new Date().toISOString()});
const timeout=()=>Object.assign(Error('Canvas took too long to respond. Refresh to try again.'),{code:'timeout'});
test('B1-09 a refresh the student asked for reports Canvas failing; background refreshes stay quiet',async()=>{
 const {createSession}=req('session.js'),statuses=[];
 const session=createSession({client:{profile:async()=>user,loadSnapshot:async()=>{throw timeout();}},createStore:()=>({load:async()=>{},readCache:async()=>snapshot(),destroy(){}}),onSnapshot:()=>{},onStatus:text=>statuses.push(text)});
 await session.start();
 await assert.rejects(session.refresh({report:true}),/took too long/,'the press hears that it failed');
 assert.equal(await session.refresh(),null,'a background refresh still resolves quietly');
 assert.ok(statuses.includes('Canvas took too long to respond. Refresh to try again.'));
 session.destroy();
});
test('B1-09 the dashboard\'s Refresh asks the session to report a failure',()=>{
 assert.ok(/refresh:\(\)=>session\.refresh\(\{report:true\}\)/.test(fs.readFileSync(ext('content.js'),'utf8')),'content.js hands the dashboard a refresh that reports failure');
});
