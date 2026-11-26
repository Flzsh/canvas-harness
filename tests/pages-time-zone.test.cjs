'use strict';
require('../extension/site.js');
// fix-42 (review-42 finding 7): Messages and Materials show their days and times in the student's own zone
// (settings.timeZone, as Home and the Planner do), not the laptop's. The same moment is drawn three ways for three zones,
// so a laptop in any zone fails if the setting is not used. (Sample data only.)
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const M=require('../extension/material-model.js'),Model=require('../extension/course-hub-model.js'),U=require('../extension/ui-utils.js');
// Nov 22, 1:30 AM in New York; Nov 21, 10:30 PM in Los Angeles; Nov 22, 3:30 PM in Tokyo
const NOW=Date.parse('2026-11-22T06:30:00Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}}
const settle=()=>new Promise(setImmediate);
const base={ReserveSite:{...require('../extension/site.js'),origin:()=>'https://school.instructure.com'},URL,Map,Set,AbortController,Date:Clock,document:{createElement:()=>({content:{querySelectorAll:()=>[]}})},ReserveCourseArt:{mini:(course,{place})=>`<svg class="rd-mini" data-place="${place}" data-course="${course.id}"></svg>`}};
const courses=[{id:'7',name:'Chemistry',shortName:'Chemistry',color:'#a05252'}];
function messages(zone){
 const raw={origin:'https://school.instructure.com',accountId:'5',errors:[],conversations:[{id:'1',subject:'Lab goggles',workflow_state:'read',last_message:'Bring goggles',last_message_at:'2026-11-21T23:00:00Z',context_code:'course_7',context_name:'Course 7',message_count:2,properties:[],participants:[{id:'5',name:'Sample Student'},{id:'t7',name:'Course Teacher'}]}]};
 const client={listInbox:async()=>structuredClone(raw),readConversation:async id=>({origin:raw.origin,accountId:'5',conversation:{id,participants:[{id:'5',name:'Sample Student'},{id:'t7',name:'Course Teacher'}],messages:[{id:'b',author_id:'t7',created_at:'2026-11-21T13:05:00Z',body:'See you in lab'},{id:'a',author_id:'5',created_at:'2025-12-31T23:30:00Z',body:'Happy new year'}]}})};
 const store={owner:{origin:raw.origin,accountId:'5'},get:()=>({resourcePins:[]}),update:async fn=>fn({resourcePins:[]})};
 const context={...base,ReserveUI:{...U,safeRichHTML:body=>body},ReserveMaterials:M,ReserveCourseHubModel:Model,ReserveDashboardView:{drawing:key=>`<svg data-drawing="${key}"></svg>`}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/course-hub-ui.js'),'utf8'),context);
 return context.ReserveCourseHubUI.create({store,user:{id:'5'},client,getTimeZone:()=>zone});
}
function materials(zone){
 const raw={origin:'https://school.instructure.com',accountId:'5',courseId:'7',modules:[],pages:[],files:[{id:'21',display_name:'Gas worksheet.pdf',updated_at:'2026-11-21T23:00:00Z',url:'/files/21'}],fetchedAt:'2026-11-21T13:05:00Z',errors:[]};
 const store={owner:{origin:raw.origin,accountId:'5'},get:()=>({resourcePins:[],settings:{},tasks:{}}),update:async()=>{},readResourceCache:async()=>null,writeResourceCache:async()=>{}};
 const client={loadCourseResources:async()=>structuredClone(raw),readCoursePage:async()=>'<p>Teacher page.</p>'};
 const context={...base,ReserveMaterials:M,ReserveUI:{escapeHTML:U.escapeHTML,safeRichHTML:html=>html}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/materials-ui.js'),'utf8'),context);
 return context.ReserveMaterialsUI.create({store,user:{id:'5'},client,getTimeZone:()=>zone});
}

test('a conversation\'s day and its letters\' times are the student\'s zone\'s, the year only when it is another year there',async()=>{
 for(const [zone,day,first,second] of [['America/New_York','Yesterday','Dec 31, 2025, 6:30 PM','Nov 21, 8:05 AM'],['America/Los_Angeles','Today','Dec 31, 2025, 3:30 PM','Nov 21, 5:05 AM'],['Asia/Tokyo','Today','Jan 1, 8:30 AM','Nov 21, 10:05 PM']]){
  const ui=messages(zone);await ui.loadInbox();let html=ui.renderInbox(courses);
  assert.match(html,new RegExp(`<time datetime="2026-11-21T23:00:00(?:\\.000)?Z">${day}</time>`),zone+': the row\'s day');
  ui.handle('hub-open-message',{message:'1'});await settle();html=ui.renderInbox(courses);
  const times=[...html.matchAll(/<article class="rd-letter"[^>]*><header>[\s\S]*?<time datetime="[^"]*">([^<]*)<\/time>/g)].map(m=>m[1]);
  assert.deepEqual(times,[first,second],zone+': oldest to newest, each in the zone');ui.destroy?.();
 }
});

test('a material\'s day, its full time and the shelf\'s "Saved" time are the student\'s zone\'s',async()=>{
 for(const [zone,day,full,saved] of [['America/New_York','Yesterday','Nov 21, 2026, 6:00 PM','Saved Nov 21, 8:05 AM'],['America/Los_Angeles','Today','Nov 21, 2026, 3:00 PM','Saved Nov 21, 5:05 AM'],['Asia/Tokyo','Today','Nov 22, 2026, 8:00 AM','Saved Nov 21, 10:05 PM']]){
  const ui=materials(zone);await ui.load('7');const html=ui.renderLibrary({id:'7',name:'Chemistry',color:'#a05252'},{sharedHeading:true});
  assert.match(html,new RegExp(`<time datetime="2026-11-21T23:00:00(?:\\.000)?Z" title="${full}">${day}</time>`),zone);
  assert.ok(html.includes(`>${saved}</span>`),zone+': '+saved);ui.destroy?.();
 }
});

test('Home hands both pages the student\'s zone; without one they use the school\'s, as the rest of Canvas Harness',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../extension/dashboard.js'),'utf8');
 // (the public file spreads each call over lines: the call and the lines after it)
 for(const name of ['ReserveMaterialsUI','ReserveCourseHubUI']){const lines=src.split('\n'),at=lines.findIndex(line=>line.includes(name+'?.create({'));assert.ok(at>=0&&lines.slice(at,at+14).join('\n').includes('getTimeZone:()=>personal.settings?.timeZone,'),name);}
 for(const file of ['course-hub-ui.js','materials-ui.js']){const s=fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
  assert.match(s,/return root\.ReserveSite\?\.timeZone\?\.\(\);\};/,file);assert.doesNotMatch(s,/toLocale(?:Date)?String\(/,file+': no laptop-zone formatting left');}
});
