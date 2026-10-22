'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture,teardown}=require('./pets-fixture.cjs');

async function messages(scope){
 const courses=[{id:'7',name:'Chemistry',shortName:'Chemistry'}],origin='https://school.instructure.com';
 const context={URL,Date,Map,Set,AbortController,ReserveSite:{origin:()=>origin},
  ReserveUI:{...require('../extension/ui-utils.js'),safeRichHTML:text=>text},
  ReserveCourseHubModel:{normalizeInbox:value=>value.conversations}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/course-hub-ui.js'),'utf8'),context);
 const ui=context.ReserveCourseHubUI.create({
  user:{id:'5'},
  store:{owner:{origin,accountId:'5'},get:()=>({resourcePins:[]})},
  client:{listInbox:async()=>({origin,accountId:'5',conversations:[{
   id:'1',subject:'Worksheet reminder',courseId:'7',excerpt:'Show every calculation',
   unread:true,url:origin+'/conversations',updatedAt:'2026-10-21T12:00:00Z'
  }]})}
 });
 let html;
 try{ui.setCourse(scope);await ui.loadInbox();html=ui.renderInbox(courses);}
 finally{ui.destroy();}
 assert.match(html,/class="rd-inbox"/);
 assert.match(html,/<details class="rd-message"/);
 assert.doesNotMatch(html,/class="rd-main/);

 const f=fixture({frame:'none'});
 try{
  f.container.dataset.workspace='inbox';f.panels[0].remove();
  const stack=[f.container],nodes=[];
  for(const match of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)){
   const tag=match[1];
   if(match[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}
   const cls=match[2].match(/class="([^"]*)"/)?.[1]||'',el=new f.Element(cls);
   el.tagName=tag.toUpperCase();el.control=['summary','a','button','input','select','label'].includes(tag);
   stack.at(-1).append(el);nodes.push(el);
   if(!['input','br','hr','img','path'].includes(tag))stack.push(el);
  }
  const summary=nodes.find(node=>node.tagName==='SUMMARY');
  const list=nodes.find(node=>node.className==='rd-message-list');
  assert.ok(summary&&list);
  summary.rect=f.box(0,935,1800,65);f.blockers.push(summary);
  return {base:f,summary,list};
 }catch(error){teardown(f);throw error;}
}

for(const scope of ['all','7'])test('Messages '+scope+' keeps Biscuit still when repeated invalidations find no free floor',async t=>{
 const {base:f,summary,list}=await messages(scope);
 t.after(()=>teardown(f));
 const start={x:f.node._x,y:f.node._y};f.advance(1400);f.clear();
 for(let i=0;i<24;i++){
  f.mutate([
   {type:'attributes',attributeName:'data-unread',target:summary},
   {type:'childList',target:list,addedNodes:[],removedNodes:[]}
  ]);
  f.container.emit('scroll',{target:list});f.resize(f.container);f.advance(150);
  assert.equal(f.node._x,start.x,'an unchanged occupied floor must not select a random destination');
  assert.equal(f.node._y,start.y,'no fallback jump off the same floor');
  assert.notEqual(f.node.dataset.pose,'fall');
 }
 assert.equal(f.writes.filter(write=>write.el===f.node&&write.key==='transform').length,0);
 assert.ok(f.rafCalls<=24,'existing invalidations still coalesce');
});

test('Messages can plan an ordinary walk after its floor becomes free',async t=>{
 const {base:f,list}=await messages('all');t.after(()=>teardown(f));
 const x=f.node._x;f.advance(1400);f.blockers.length=0;
 f.mutate([{type:'childList',target:list,addedNodes:[],removedNodes:[]}]);f.advance(100);
 assert.equal(f.node._x,x,'making space does not itself start a walk');
 f.random(.1,...Array(9).fill(.65));f.advance(6000);f.clear();f.advance(1000);
 assert.ok(f.node._x>x,'the next planned walk still runs');
 assert.equal(f.node.dataset.pose,'walk');
 assert.deepEqual(f.reads,{rect:0,style:0,hit:0,range:0,offset:0},'movement retains the geometry cache');
});
