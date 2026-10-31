'use strict';
// Big card (owner, 2026-10-29): one press brings the card to the middle of the room, large, for a small screen or for
// reading closely. The choice is kept with the deck; Escape puts the card back down before it folds the room.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../extension/review-deck-model.js');require('../extension/review-deck-art.js');const UI=require('../extension/review-deck.js');
const DAY='2026-10-20',ORIGIN='https://school.instructure.com',CSS=fs.readFileSync(path.join(__dirname,'../extension/review-deck.css'),'utf8');
const card=(front='term',back='answer',extra={})=>M.makeCard({front,back,course:'5',today:DAY,...extra});
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(cards=[],{settings}={}){
 let data={settings:{reviewDecks:M.cleanDeck({cards,...(settings?{settings}:{})}),moduleSize:{}}};const time=Date.parse(DAY+'T12:00:00Z');
 const context={user:{id:'7'},origin:ORIGIN,s:{timeZone:'UTC',moduleSize:{}},courses:[{id:'5',name:'Chemistry',color:'#356E5D'}],items:[]};
 const store={owner:{accountId:'7',origin:ORIGIN},get(){return structuredClone(data);},async update(fn){const next=structuredClone(data);fn(next);data=next;return structuredClone(data);}};
 const ui=UI.create({container:{querySelector:()=>null},store,getContext:()=>context,onChange:()=>{},isEnabled:()=>true,isSelected:()=>true,now:()=>time});
 return {ui,action:(name,values={})=>ui.action('review-deck-'+name,values),input:(name,value)=>ui.input('review-deck-'+name,value),get data(){return structuredClone(data);}};
}
const inPage={tagName:'DIV',closest:sel=>sel==='[data-review-deck]'?{}:null};
const key=(ui,k)=>ui.keydown({key:k,target:inPage,preventDefault(){}});

test('studying in the room, a drawn Big card control beside Edit lifts the card and keeps the choice with the deck',async()=>{
 const f=fixture([card('molar mass of H2O','18 g/mol')]);await f.action('start',{course:'all'});await tick();
 let page=f.ui.renderReviewDeck();
 assert.match(page,/data-rv-mode="study" data-rv-big="false"/);assert.match(page,/<span class="rv-veil" data-rd-key="rv-veil" aria-hidden="true"><\/span>/,'the veil is always there, so it can fade both ways');
 assert.match(page,/<button type="button" class="rv-pencil rv-bigbtn" data-rd-key="rv-big" data-rd-action="review-deck-big" aria-pressed="false" aria-keyshortcuts="B"><span class="rv-big-art" aria-hidden="true"><svg class="rv-bigart"[^]*?<\/span><span>Big card<\/span><\/button>/,'a drawing and a name, no description');
 await f.action('big');await tick();page=f.ui.renderReviewDeck();
 assert.match(page,/data-rv-big="true"/);assert.match(page,/aria-pressed="true"/);
 assert.equal(f.data.settings.reviewDecks.settings.bigCard,true,'kept with the deck');
 await f.action('big');await tick();assert.match(f.ui.renderReviewDeck(),/data-rv-big="false"/);assert.equal('bigCard' in f.data.settings.reviewDecks.settings,false,'off leaves no trace');
});

test('a deck saved with a big card opens big; B changes it, and Escape puts the card down before the room folds',async()=>{
 const f=fixture([card('hola','hello'),card('adios','bye')],{settings:{newPerDay:20,maxReviews:200,bigCard:true}});await f.action('start',{course:'all'});await tick();
 assert.match(f.ui.renderReviewDeck(),/data-rv-big="true"/);
 assert.equal(key(f.ui,'Escape'),true);await tick();const page=f.ui.renderReviewDeck();
 assert.match(page,/data-rv-mode="study" data-rv-big="false"/,'Escape set the card down and the room is still open');
 assert.equal(key(f.ui,'b'),true);await tick();assert.match(f.ui.renderReviewDeck(),/data-rv-big="true"/);
});

test('the big card belongs to the room: the module never offers it, and home and done never draw it',async()=>{
 const f=fixture([card()],{settings:{newPerDay:20,maxReviews:200,bigCard:true}});
 assert.match(f.ui.renderReviewDeck(),/data-rv-mode="home" data-rv-big="false"/);
 await f.action('start',{course:'all'});await tick();
 assert.doesNotMatch(f.ui.renderModule({s:{moduleSize:{review:'l'}}}),/rv-bigbtn/);
});

test('the deck keeps bigCard only as true, and saving the daily limits keeps it',async()=>{
 assert.deepEqual(M.cleanDeck({settings:{bigCard:true}}).settings,{newPerDay:10,maxReviews:100,bigCard:true});
 for(const v of [false,'true',1,null])assert.equal('bigCard' in M.cleanDeck({settings:{bigCard:v}}).settings,false);
 const f=fixture([card()],{settings:{newPerDay:20,maxReviews:200,bigCard:true}});
 await f.action('tab',{tab:'settings'});f.input('new-per-day','12');await f.action('save-limits');await tick();
 assert.deepEqual(f.data.settings.reviewDecks.settings,{newPerDay:12,maxReviews:200,bigCard:true});
});

test('the big card sits in the middle at 5:3 under a 1180 px cap, its text grows with it, and the room fades behind a veil',()=>{
 // (the measures sit on the card and its grade row, not on the room: an inherited property there restyled the drawing)
 assert.match(CSS,/\.rv-room\[data-rv-big=true\] :is\(\.rv-cardwrap,\.rv-study \.rv-under\)\{--bw:min\(calc\(100cqw - 96px\),calc\(\(100cqh - 206px\) \/ \.6\),1180px\);/);
 assert.match(CSS,/\.rv-room\[data-rv-big=true\] \.rv-cardwrap\{left:calc\(50cqw - var\(--bw\) \/ 2\);width:var\(--bw\);bottom:auto;top:var\(--bt\);z-index:2\}/);
 assert.match(CSS,/\.rv-room\[data-rv-big=true\] \.rv-face \.rv-q\{font-size:clamp\(18px,6cqw,66px\)\}/);
 assert.match(CSS,/\.rv-room \.rv-veil\{[^}]*opacity:0;pointer-events:none;transition:opacity \.32s ease\}/);assert.match(CSS,/\.rv-room\[data-rv-big=true\] \.rv-veil\{opacity:\.9;pointer-events:auto\}/);
});
