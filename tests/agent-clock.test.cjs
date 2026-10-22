'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Clock=require('../extension/agent-clock.js'),Ask=require('../extension/pony-ask.js');
test('agent time helpers are available without loading any pony feature',()=>{const env={};vm.runInNewContext(fs.readFileSync(require.resolve('../extension/agent-clock.js'),'utf8'),env);assert.equal(env.CanvasHarnessAgentClock.calendar('America/New_York')(Date.parse('2026-10-21T02:00:00Z')).day,'2026-10-20');assert.equal(env.ReservePonyAsk,undefined);assert.equal(env.CanvasHarnessAgentClock.wall('2026-10-21',480,'Asia/Kolkata'),Date.parse('2026-10-21T02:30:00Z'));});
test('pony compatibility reexports the shared functions and preserves DST gaps and folds',()=>{assert.equal(Ask.calendar,Clock.calendar);assert.equal(Ask.wall,Clock.wall);assert.equal(Clock.wall('2026-03-08',150,'America/New_York'),null);assert.equal(Clock.wall('2026-11-01',90,'America/New_York',Date.parse('2026-11-01T05:45:00Z')),Date.parse('2026-11-01T06:30:00Z'));});

test('missing and invalid zones use the public site timezone across clock parser and brain',()=>{
 const box={Intl,ReserveSite:{timeZone:()=> 'Pacific/Auckland'}};for(const name of ['agent-clock.js','biscuit-parse.js','pony-brain.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../extension/'+name),'utf8'),box);
 const now=Date.parse('2026-05-11T16:00:00Z');for(const zone of [undefined,'Invalid/Timezone']){
  assert.equal(box.CanvasHarnessAgentClock.calendar(zone)(now).day,'2026-05-12');
  const reminder=box.ReserveBiscuitParse.parse('remind me tomorrow at 8am to Pack bag',{now,timeZone:zone})[0];assert.equal(reminder.fields.at,Date.parse('2026-05-12T20:00:00Z'));
  assert.equal(box.ReservePonyBrain.evaluate({now,timeZone:zone,assignments:[{id:'1',dueAt:now+3600000}]}).dueToday,1);
 }
});

test('an invalid site timezone falls back to the device timezone then UTC',()=>{
 const box={Intl,ReserveSite:{timeZone:()=> 'Invalid/Timezone'}};vm.runInNewContext(fs.readFileSync(require.resolve('../extension/agent-clock.js'),'utf8'),box);
 assert.equal(box.CanvasHarnessAgentClock.defaultTimeZone(),Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
 const DateTimeFormat=function(locale,options){if(!options)throw Error('Device timezone unavailable');return new Intl.DateTimeFormat(locale,options);},fallback={Intl:{DateTimeFormat},ReserveSite:{timeZone(){throw Error('Site timezone unavailable');}}};vm.runInNewContext(fs.readFileSync(require.resolve('../extension/agent-clock.js'),'utf8'),fallback);
 assert.equal(fallback.CanvasHarnessAgentClock.defaultTimeZone(),'UTC');assert.equal(fallback.CanvasHarnessAgentClock.calendar()(Date.parse('2026-05-11T16:00:00Z')).minute,960);
});
