'use strict';
// CSS contracts for the page-filling dashboard and its independently scrolling workspace column.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function declarations(file,selector){
 const css=fs.readFileSync(path.join(__dirname,'../extension',file),'utf8').replace(/\/\*[\s\S]*?\*\//g,''),escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return [...css.matchAll(new RegExp('(?:^|(?<=[{}]))\\s*'+escaped+'\\s*\\{([^{}]*)\\}','g'))].map(match=>new Map(match[1].split(';').filter(part=>part.includes(':')).map(part=>{const colon=part.indexOf(':');return [part.slice(0,colon).trim(),part.slice(colon+1).trim()];})));
}

test('the workspace fills the viewport on desktop and mobile without rounded outer corners',()=>{
 const rules=declarations('workspace.css','.rd'),heights=rules.filter(rule=>rule.has('min-height')),corners=rules.filter(rule=>rule.has('border-radius'));
 assert.ok(heights.length>=2,'desktop and mobile declare their viewport height');assert.ok(corners.length>0);
 for(const rule of heights)assert.equal(rule.get('min-height'),'100dvh');
 for(const rule of corners)assert.equal(rule.get('border-radius'),'0');
});

test('the dashboard keeps square outer corners in every root rule, including mobile',()=>{
 const rules=declarations('dashboard.css','.rd').filter(rule=>rule.has('border-radius'));
 assert.ok(rules.length>=2,'desktop and mobile both set their outer corners');
 for(const rule of rules)assert.equal(rule.get('border-radius'),'0');
});

test('the desktop workspace scroll column disables browser scroll anchoring',()=>{
 const rules=declarations('refresh.css','.rd:not([data-course-navigation=topbar]) .rd-shell > .rd-workspace');assert.equal(rules.length,1);
 assert.equal(rules[0].get('overflow-y'),'auto');assert.equal(rules[0].get('overscroll-behavior'),'contain');assert.equal(rules[0].get('overflow-anchor'),'none');
});

test('dashboard rendering forwards the complete quick-upload state into customization',t=>{
 const {fixture}=require('./dashboard-heading-fixture.cjs'),received=[];
 const quickUpload={phase:'review'},draft='Artwork draft',fileName='course-art.txt',error='Choose a course';
 const f=fixture({setup:({env})=>{
  const render=env.ReserveDashboardView.render;
  env.ReserveCustomizeUI.render=context=>{received.push(context);return '';};
  env.ReserveDashboardView.render=(context,...args)=>render({...context,quickUpload,quickPackDraft:draft,quickPackFileName:fileName,quickPackError:error,quickPackLoading:true},...args);
 }});
 t.after(()=>f.dashboard.destroy());
 assert.ok(received.length>0);
 const context=received.at(-1);
 assert.equal(context.quickUpload,quickUpload);
 assert.deepEqual([context.quickPackDraft,context.quickPackFileName,context.quickPackError,context.quickPackLoading],[draft,fileName,error,true]);
 f.dashboard.setStatus('Still reviewing');
 assert.equal(received.at(-1).quickUpload,quickUpload);
});
