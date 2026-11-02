'use strict';
// AI plan step 5 (owner, 2026-11-02: the band flips at the first finished card): Help cards arrive one at a time. The
// band turns to the first page once, when the run's first card is made; later cards and Ready leave the student where
// they are, an open card stays in view (the same element) when a new card ranks ahead of it, and nothing flips twice.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js');
const {dom,storage,descendants}=require('./study-fixture.cjs');
const scope='https://canvas.test|7',zone='America/New_York',now=Date.parse('2026-10-28T16:00:00Z');
const ask=headline=>({v:1,kind:'ask',title:headline,headline,size:'l',importance:2,points:[{text:headline+' first.',src:'Canvas'}],next:'',gaps:[]});
const help=(headline,{at=now,...rest}={})=>({v:1,kind:'ask',title:headline,itemId:'',courseId:'',savedAt:at,day:'2026-10-28',progress:{},prepare:true,data:ask(headline),...rest});
const all=(root,cls)=>descendants(root).filter(n=>String(n.className||'').split(' ').includes(cls));
function band(aids){const d=dom(),host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false})},store=UI.createStore(env),view=Band.renderBand(host,aids,{env,scope,store,timeZone:zone,now:()=>now,onProgress:()=>{}});
 return {host,view,headlines:()=>[...new Set(all(host,'ch-band-headline'))].map(n=>n.textContent)};}
const old={a:help('Old A',{at:now-180e3,runId:'r0a',rank:1}),b:help('Old B',{at:now-120e3,runId:'r0b',rank:1}),c:help('Old C',{at:now-60e3,runId:'r0c',rank:1})};

test('the run\'s first card turns the band to the first page once; the next card and Ready leave the page the student chose',async()=>{
 const f=band(old);await f.view.loaded;assert.ok(f.view.state.pages>1,'more than one page to move between');
 f.view.flip(1);assert.equal(f.view.state.page,1);
 f.view.prepare({id:'run-1',state:'gathering',revision:1,made:0});assert.equal(f.view.state.page,1,'no card yet: nothing moves');
 const one={...old,n1:help('New one',{runId:'run-1',rank:1})};f.view.update(one);
 f.view.prepare({id:'run-1',state:'gathering',revision:2,made:1});assert.equal(f.view.state.page,0,'the first card: the first page');
 assert.ok(f.headlines().includes('New one'));
 f.view.flip(1);
 f.view.update({...one,n2:help('New two',{runId:'run-1',rank:2,at:now+1})});f.view.prepare({id:'run-1',state:'gathering',revision:3,made:2});
 assert.equal(f.view.state.page,1,'a later card does not move the band');
 f.view.prepare({id:'run-1',state:'publishing',revision:4,made:2});f.view.prepare({id:'run-1',state:'cards-ready',revision:5,made:2,progress:'Ready · 2 cards'});
 assert.equal(f.view.state.page,1,'Ready does not flip a second time');
});

test('a run whose first card the band did not see arrive still turns to the first page at Ready, as before',async()=>{
 const f=band(old);await f.view.loaded;f.view.flip(1);
 f.view.prepare({id:'run-2',state:'gathering',revision:1,made:0});
 f.view.update({...old,n:help('New card',{runId:'run-2',rank:1})});
 f.view.prepare({id:'run-2',state:'cards-ready',revision:5,made:1,progress:'Ready · 1 card'});
 assert.equal(f.view.state.page,0);
});

test('a band opened in the middle of a run that already has cards does not jump',async()=>{
 const f=band(old);await f.view.loaded;f.view.flip(1);
 f.view.prepare({id:'run-3',state:'gathering',revision:7,made:1});assert.equal(f.view.state.page,1);
});

test('an open card stays in view with its built content when a new card ranks ahead of it',async()=>{
 const f=band(old);await f.view.loaded;
 const key=Object.keys(old).find(k=>old[k].data.headline===f.headlines()[0]),cardOf=()=>all(f.host,'ch-band-card').find(c=>c.dataset.aidKey===key);
 f.view.grow(key,true);assert.equal(cardOf()?.dataset.open,'true');const content=all(cardOf(),'ch-band-scroll')[0];assert.ok(content);
 // the same saved cards come back as new objects from storage, with one new card ranked first
 f.view.update({...structuredClone(old),n:help('New card',{runId:'run-4',rank:1,at:now+5})});
 assert.ok(cardOf(),'the open card is still on the page shown');assert.equal(f.view.state.page,1,'its page moved with it');
 assert.equal(all(cardOf(),'ch-band-scroll')[0],content,'its content was kept, not built again');
 f.view.flip(0);assert.deepEqual(f.headlines().slice(0,1),['New card'],'the new card is on the first page');
});
