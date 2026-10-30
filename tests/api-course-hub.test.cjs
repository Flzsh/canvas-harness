const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClient}=require('../extension/api.js');

function response(body,{status=200,link='',redirected=false,type='basic'}={}){
  return {
    ok:status>=200&&status<300,
    status,
    redirected,
    type,
    headers:{get:name=>name==='link'?link:name==='content-type'?'application/json':null},
    json:async()=>body,
  };
}

test('course updates and inbox are lazy and validate identity/course ids before network',async()=>{
  let calls=0;
  const client=createClient({fetchImpl:async()=>{calls++;return response({id:'5'});}});
  assert.equal(calls,0);
  await assert.rejects(client.loadCourseUpdates('7'),e=>e.code==='auth');
  await assert.rejects(client.listInbox(),e=>e.code==='auth');
  await assert.rejects(client.loadCourseUpdates('../7',{user:{id:'5'}}),e=>e.code==='endpoint');
  assert.equal(calls,0);

  const ac=new AbortController();ac.abort();
  await assert.rejects(client.loadCourseUpdates('7',{user:{id:'5'},signal:ac.signal}),e=>e.code==='cancelled');
  assert.equal(calls,0);
});

test('loadCourseUpdates verifies ownership, reads announcements and visible tabs, and never writes',async()=>{
  const calls=[];let profiles=0,active=0,maxActive=0;
  const client=createClient({fetchImpl:async(url,options)=>{
    calls.push({url,options});active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,2));active--;
    if(url.includes('/users/self/profile')){profiles++;return response({id:'5'});}
    if(url.includes('/api/v1/announcements?'))return response([
      {id:'10',title:'Lab change',message:'<p>Bring goggles.</p>',posted_at:'2026-09-13T18:00:00Z',user_name:'Dr. Rivera',html_url:'https://school.instructure.com/courses/7/discussion_topics/10',read_state:'unread',published:true,locked_for_user:false},
      {id:'11',title:'Draft',message:'hidden',posted_at:'2026-09-13T17:00:00Z',published:false},
      {id:'12',title:'Locked',message:'hidden',posted_at:'2026-09-13T16:00:00Z',published:true,locked_for_user:true},
    ]);
    if(url.includes('/courses/7/tabs'))return response([
      {id:'home',label:'Home',html_url:'/courses/7',type:'internal',position:1},
      {id:'context_external_tool_4',label:'Class tool',html_url:'/courses/7/external_tools/4',type:'external',position:2},
      {id:'grades',label:'Grades',html_url:'/courses/7/grades',type:'internal',hidden:true,position:3},
    ]);
    throw Error('unexpected '+url);
  }});

  const result=await client.loadCourseUpdates('7',{user:{id:'5'}});
  assert.equal(result.origin,'https://school.instructure.com');
  assert.equal(result.accountId,'5');
  assert.equal(result.courseId,'7');
  assert.equal(profiles,2);
  assert.equal(maxActive,2);
  assert.deepEqual(result.announcements.map(x=>x.id),['10']);
  assert.equal(result.announcements[0].message,'<p>Bring goggles.</p>');
  assert.equal(result.announcements[0].user_name,'Dr. Rivera');
  assert.equal(result.announcements[0].read_state,'unread');
  assert.deepEqual(result.tabs.map(x=>x.id),['home','context_external_tool_4']);
  assert.deepEqual(result.errors,[]);
  assert.ok(calls.every(call=>call.options.method==='GET'));
  assert.ok(calls.some(call=>/\/api\/v1\/announcements\?/.test(call.url)&&/context_codes(?:%5B%5D|\[\])=course_7/i.test(call.url)&&/active_only=true/.test(call.url)));
  assert.ok(calls.some(call=>/\/api\/v1\/courses\/7\/tabs/.test(call.url)));
});

test('course update source failures stay partial while auth and account swaps are fatal',async()=>{
  const partial=createClient({fetchImpl:async url=>{
    if(url.includes('/profile'))return response({id:'5'});
    if(url.includes('/announcements?'))return response({}, {status:500});
    if(url.includes('/courses/7/tabs'))return response([{id:'home',label:'Home',html_url:'/courses/7'}]);
    throw Error('unexpected '+url);
  }});
  const result=await partial.loadCourseUpdates('7',{user:{id:'5'}});
  assert.deepEqual(result.announcements,[]);
  assert.equal(result.tabs.length,1);
  assert.equal(result.errors.length,1);
  assert.equal(result.errors[0].source,'announcements');

  const auth=createClient({fetchImpl:async url=>{
    if(url.includes('/profile'))return response({id:'5'});
    if(url.includes('/announcements?'))return response({}, {status:401});
    if(url.includes('/courses/7/tabs'))return response([]);
    throw Error('unexpected '+url);
  }});
  await assert.rejects(auth.loadCourseUpdates('7',{user:{id:'5'}}),e=>e.code==='auth');

  let profiles=0;
  const swapped=createClient({fetchImpl:async url=>{
    if(url.includes('/profile'))return response({id:String(++profiles===1?5:6)});
    if(url.includes('/announcements?')||url.includes('/courses/7/tabs'))return response([]);
    throw Error('unexpected '+url);
  }});
  await assert.rejects(swapped.loadCourseUpdates('7',{user:{id:'5'}}),e=>e.code==='auth');
});

test('listInbox reads only the first 100 summary rows, reports truncation, and never opens a conversation',async()=>{
  const calls=[];let profiles=0;
  const rows=Array.from({length:100},(_,index)=>({
    id:String(index+1),subject:'Subject '+(index+1),workflow_state:index===0?'unread':'read',last_message:'Preview '+(index+1),last_message_at:`2026-09-${String((index%9)+1).padStart(2,'0')}T12:00:00Z`,context_name:'Chemistry',context_code:'course_7',
  }));
  const client=createClient({fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('/profile')){profiles++;return response({id:'5'});}
    if(url.includes('/api/v1/conversations?'))return response(rows,{link:'<https://school.instructure.com/api/v1/conversations?per_page=100&page=2>; rel="next"'});
    throw Error('unexpected '+url);
  }});
  const result=await client.listInbox({user:{id:'5'}});
  assert.equal(profiles,2);
  assert.equal(result.conversations.length,100);
  assert.equal(result.truncated,true);
  assert.deepEqual(result.errors,[]);
  assert.equal(result.conversations[0].workflow_state,'unread');
  assert.equal(result.conversations[0].last_message,'Preview 1');
  assert.equal(result.conversations[0].context_code,'course_7');
  assert.equal(calls.filter(call=>/\/api\/v1\/conversations\?/.test(call.url)).length,1);
  assert.ok(calls.every(call=>call.options.method==='GET'));
  assert.ok(!calls.some(call=>/\/api\/v1\/conversations\/\d+/.test(call.url)));
  assert.ok(!calls.some(call=>/auto_mark_as_read/.test(call.url)));
});

test('listInbox can report a nonfatal source error but auth remains fatal',async()=>{
  const partial=createClient({fetchImpl:async url=>{
    if(url.includes('/profile'))return response({id:'5'});
    if(url.includes('/conversations?'))return response({}, {status:403});
    throw Error('unexpected '+url);
  }});
  const result=await partial.listInbox({user:{id:'5'}});
  assert.deepEqual(result.conversations,[]);
  assert.equal(result.truncated,false);
  assert.equal(result.errors[0].source,'conversations');

  const auth=createClient({fetchImpl:async url=>url.includes('/profile')?response({id:'5'}):response({}, {status:401})});
  await assert.rejects(auth.listInbox({user:{id:'5'}}),e=>e.code==='auth');
});

test('allowlist permits only the new read-only summary endpoints and rejects individual conversation/API variants',async()=>{
  let calls=0;
  const client=createClient({fetchImpl:async()=>{calls++;return response([]);}});
  await assert.rejects(client.list('/api/v1/conversations/12'),e=>e.code==='endpoint');
  await assert.rejects(client.list('/api/v1/conversations/mark_all_as_read'),e=>e.code==='endpoint');
  await assert.rejects(client.list('/api/v1/announcements/12'),e=>e.code==='endpoint');
  await assert.rejects(client.list('/api/v1/courses/7/tabs/grades'),e=>e.code==='endpoint');
  await assert.rejects(client.list('https://user:pass@school.instructure.com/api/v1/conversations'),e=>e.code==='endpoint'||e.code==='origin');
  assert.equal(calls,0);
});

test('full message reads explicitly preserve unread status and verify identity before and after',async()=>{
 const calls=[];const client=createClient({fetchImpl:async(url,options)=>{calls.push({url,options});return response(url.includes('/profile')?{id:'5'}:{id:'12',workflow_state:'unread',messages:[{body:'Complete instructions beyond the summary.'}]});}});
 const raw=await client.readConversation('12',{user:{id:'5'}});assert.equal(raw.conversation.workflow_state,'unread');assert.equal(calls.filter(c=>c.url.includes('/profile')).length,2);
 const read=calls.find(c=>c.url.includes('/conversations/12'));assert.equal(new URL(read.url).searchParams.get('auto_mark_as_read'),'false');assert.ok(calls.every(c=>c.options.method==='GET'));
});
test('conversation detail allowlist rejects missing, true, or duplicate read-status flags before network',async()=>{
 let calls=0;const client=createClient({fetchImpl:async()=>{calls++;return response([]);}});
 for(const query of ['', '?auto_mark_as_read=true','?auto_mark_as_read=false&auto_mark_as_read=true'])await assert.rejects(client.list('/api/v1/conversations/12'+query),e=>e.code==='endpoint');assert.equal(calls,0);
});
test('full message reads reject account swaps and wrong conversation results',async()=>{
 let profiles=0;const client=createClient({fetchImpl:async url=>response(url.includes('/profile')?{id:String(++profiles===1?5:6)}:{id:'12',messages:[]})});
 await assert.rejects(client.readConversation('12',{user:{id:'5'}}),e=>e.code==='auth');
 const wrong=createClient({fetchImpl:async url=>response(url.includes('/profile')?{id:'5'}:{id:'13',messages:[]})});await assert.rejects(wrong.readConversation('12',{user:{id:'5'}}),e=>e.code==='data');
});
