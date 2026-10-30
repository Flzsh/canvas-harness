'use strict';
// Owner, 2026-10-26: "For google docs, read them for github and paste for extension". Help reads a Google Doc an
// assignment links with the student's own Google session (GitHub installs, docs.google.com allowed); store installs
// and docs it cannot open stay on the card as unread so the student can paste them.
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../extension/google-docs.js');
const ID='16fBj8Zfu9qdZKhYy1Ct9zxrSVLkOSCLyjfgMfUHelvw',PUB='2PACX-1vQ'+'a'.repeat(40);
const page=body=>'<html><head><title>T</title><style>.x{}</style></head><body><script>var a="<p>no</p>"</script><div class="app-container"><div class="doc-content">'+body+'</div></div></body></html>';
const chromeWith=({store=false,granted=true}={})=>({runtime:{getManifest:()=>store?{update_url:'https://clients2.google.com/service/update2/crx'}:{}},permissions:{contains:async q=>granted&&q.origins.includes('https://docs.google.com/*')}});

test('Google links in an assignment are found once each, with their link text, editor and published Docs apart from Slides and Sheets',()=>{
 const html=`<p>Read the <a href="https://docs.google.com/document/d/${ID}/edit?usp=sharing">essay prompt</a>,
  again <a href='https://docs.google.com/document/u/1/d/${ID}/view'>here</a>, the <a href="https://docs.google.com/document/d/e/${PUB}/pub">rubric</a>,
  the <a href="https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit">slides</a> and <a href="/courses/7/files/9">a Canvas file</a>.</p>`;
 assert.deepEqual(G.links(html),[{kind:'document',id:ID,title:'essay prompt'},{kind:'published',id:PUB,title:'rubric'},{kind:'presentation',id:'1AbCdEfGhIjKlMnOpQrStUvWxYz',title:'slides'}]);
 assert.equal(G.url({kind:'document',id:ID}),'https://docs.google.com/document/d/'+ID+'/mobilebasic');
 assert.equal(G.url({kind:'published',id:PUB}),'https://docs.google.com/document/d/e/'+PUB+'/pub');
});

test('the text is the document\'s own: paragraphs and list items kept, scripts and page chrome left out, entities decoded',()=>{
 const t=G.text(page('<p class="c1"><span>CL Analytical Essay</span></p><p>You will write a nuanced essay &amp; cite two sources.</p><ul><li>Thesis</li><li>Evidence</li></ul><table><tr><td>A</td><td>B</td></tr></table>'));
 assert.equal(t,'CL Analytical Essay\nYou will write a nuanced essay & cite two sources.\n\n• Thesis\n• Evidence\nA | B');
 assert.equal(G.text('<html><body><p>Sign in to continue</p></body></html>'),'','a page without the document is not its text');
});

test('reading: store installs paste, a missing permission asks for it, a doc the student cannot open is private, a readable doc gives its text',async()=>{
 const doc={kind:'document',id:ID,title:'essay prompt'},urls=[];
 const fetch=status=>async(url,init)=>{urls.push([url,init.credentials,init.redirect]);return status==='redirect'?{type:'opaqueredirect',status:0}:{type:'basic',status,text:async()=>page('<p>Prompt text</p>')};};
 assert.deepEqual(await G.read(doc,{chrome:chromeWith({store:true}),fetch:fetch(200)}),{error:'paste'});
 assert.deepEqual(await G.read(doc,{chrome:chromeWith({granted:false}),fetch:fetch(200)}),{error:'permission'});
 assert.deepEqual(await G.read(doc,{chrome:chromeWith(),fetch:fetch('redirect')}),{error:'private'});
 assert.deepEqual(await G.read(doc,{chrome:chromeWith(),fetch:fetch(404)}),{error:'private'});
 assert.deepEqual(await G.read({kind:'presentation',id:'x'.repeat(24),title:'s'},{chrome:chromeWith(),fetch:fetch(200)}),{error:'paste'},'Slides and Sheets are pasted');
 assert.deepEqual(await G.read(doc,{chrome:chromeWith(),fetch:fetch(200)}),{text:'Prompt text'});
 assert.deepEqual(urls.at(-1),['https://docs.google.com/document/d/'+ID+'/mobilebasic','include','manual']);
});

test('an assignment read lists the Google Docs its instructions link',async()=>{
 const D=require('../extension/agent-data.js'),origin='https://school.instructure.com',user={id:'9'};
 const item={id:'12',courseId:'7',name:'Analytical Essay',description:`<p>Prompt: <a href="https://docs.google.com/document/d/${ID}/edit">essay prompt</a></p>`,dueAt:'2026-10-30T21:00:00Z',points:100,submissionTypes:['online_upload']};
 const r=D.build({now:Date.parse('2026-10-26T16:00:00Z'),context:{user,s:{timeZone:'America/New_York'},courses:[{id:'7',name:'English'}],items:[item],aiResources:[],aiUpdates:[]},data:{tasks:{},customTasks:[],toolbox:{},focus:{}},aids:{},memory:[],modules:[],runs:[],baseline:{},grades:false});
 const client={origin,profile:async()=>user,readAssignment:async()=>({id:12,name:item.name,description:item.description})};
 const result=await D.createReader({index:r.index,client,user,origin,signal:new AbortController().signal}).read({what:'assignment',id:'assignment:7:12'});
 assert.equal(result.error,undefined,result.error);assert.deepEqual(result.google,[{kind:'document',id:ID,title:'essay prompt'}]);
});

function setup({docs,pasted}){
 const Runner=require('../extension/ai-runner.js'),fence='```';
 const canvas={reader:()=>({cache:new Map(),read:async req=>({id:req.id,text:'TEXT of '+req.id,...(req.id==='assignment:7:12'?{google:[{kind:'document',id:ID,title:'essay prompt'},{kind:'presentation',id:'1AbCdEfGhIjKlMnOpQrStUvWxYz',title:'slides'}]}:{})})}),validate:async()=>{}};
 let saved=null;const results={saveCards:async(run,cards)=>{saved=cards;return cards.length;}};
 const runner=Runner.create({canvas,results,docs,account:{get:()=>({settings:{timeZone:'UTC'},toolbox:{}}),sync:async()=>{}},adapter:{},now:()=>Date.parse('2026-10-26T16:00:00Z'),uuid:()=>'x'});
 const run={id:'run-g',kind:'ask',state:'gathering',mode:'prepare',phase:'deliver',picks:[{ref:'H1',make:'auto',focus:'',sources:[]}],pickIndex:0,made:[],errors:[],turns:[],messages:[],refs:{H1:{id:'12',courseId:'7',title:'Analytical Essay'}},instructions:{standingText:''},settings:{},...(pasted?{pasted,pastedTitle:'essay prompt'}:{}),
  snapshot:{index:[['assignment:7:12',{id:'assignment:7:12',what:'assignment',title:'Analytical Essay',courseId:'7',item:{courseName:'English'}}]],snapshot:{items:[]},brief:{text:'brief'}}};
 const ctx={save:async r=>r,guard:async()=>{},signal:new AbortController().signal};
 const reply=text=>{run.turns.push({id:'turn-'+run.turns.length,reply:fence+'json\n'+text+'\n'+fence});run.turnIndex=run.turns.length-1;run.state='awaiting-reply';};
 return {runner,run,ctx,reply,saved:()=>saved};
}
const essayCard='{"kind":"examples","title":"Analytical Essay","problems":[{"type":"Thesis","problem":"Write a thesis.","steps":["Name the claim.","Name the reasons."],"answer":"A thesis."},{"type":"Evidence","problem":"Pick evidence.","steps":["Find a passage.","Explain it."],"answer":"A passage."}],"gaps":[]}';

test('Help reads the Doc the assignment links into its materials; Slides it cannot read are named, never guessed, and kept on the card',async()=>{
 const asked=[],docs={read:async g=>{asked.push(g.id);return g.kind==='document'?{text:'The prompt asks for a nuanced analytical essay.'}:{error:'paste'};}};
 const {runner,run,ctx,reply,saved}=setup({docs});
 await runner.step(run,ctx);assert.equal(run.state,'asking');
 const msg=run.messages[0].content;assert.match(msg,/Google Doc: essay prompt/);assert.match(msg,/nuanced analytical essay/);assert.match(msg,/Linked but not readable[\s\S]*"slides" \(Google Slides\)[\s\S]*Do not guess what it says/);
 reply(essayCard);await runner.step(run,ctx);while(['gathering','asking'].includes(run.state)&&run.pickIndex<run.picks.length)await runner.step(run,ctx);
 if(run.state==='gathering')await runner.step(run,ctx);
 assert.deepEqual(saved()?.[0]?.unread,[{kind:'presentation',id:'1AbCdEfGhIjKlMnOpQrStUvWxYz',title:'slides',reason:'paste'}]);
 await runner.step({...run,state:'gathering',pickIndex:0,made:[]},ctx);assert.equal(asked.filter(id=>id===ID).length,1,'a Doc is read once per run');
});

test('a store install pastes: the Doc stays unread on the card; the pasted text comes back as the student\'s own source',async()=>{
 const docs={read:async()=>({error:'paste'})};
 const first=setup({docs});await first.runner.step(first.run,first.ctx);assert.match(first.run.messages[0].content,/"essay prompt" \(Google Doc\)/);assert.doesNotMatch(first.run.messages[0].content,/Google Doc: essay prompt/);
 assert.deepEqual(first.run.picks[0].unread.map(u=>[u.title,u.reason]),[['essay prompt','paste'],['slides','paste']]);
 const second=setup({docs,pasted:'Write 1200 words on how two novels use their setting.'});await second.runner.step(second.run,second.ctx);
 const msg=second.run.messages[0].content;assert.match(msg,/Pasted by the student: essay prompt\n?[\s\S]*Write 1200 words/);assert.deepEqual(second.run.picks[0].unread.map(u=>u.title),['slides'],'the pasted Doc is no longer unread');
});
test('a long course name never cuts the item off a card\'s headline',async()=>{
 const {runner,run,ctx,reply,saved}=setup({docs:{read:async()=>({text:'The prompt.'})}});run.snapshot.index[0][1].item.courseName='English: World Lit & The City';
 await runner.step(run,ctx);reply(essayCard);await runner.step(run,ctx);await runner.step(run,ctx);
 assert.equal(saved()[0].headline,'English: Analytical Essay');
});
