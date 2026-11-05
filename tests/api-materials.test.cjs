const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClient}=require('../extension/api.js');

function response(body,{status=200,link='',url='',redirected=false}={}){
  return {
    ok:status>=200&&status<300,
    status,
    url,
    redirected,
    headers:{get:name=>name==='link'?link:name==='content-type'?'application/json':null},
    json:async()=>body,
  };
}

test('course resources are lazy, reject missing identity and invalid ids before network',async()=>{
  let calls=0;
  const client=createClient({fetchImpl:async()=>{calls++;return response({id:'9'});}});
  assert.equal(calls,0);
  await assert.rejects(client.loadCourseResources('7'),e=>e.code==='auth');
  assert.equal(calls,0);
  await assert.rejects(client.loadCourseResources('../7',{user:{id:'9'}}),e=>e.code==='endpoint');
  assert.equal(calls,0);
  await assert.rejects(client.readCoursePage('7','unit%2fsecret',{user:{id:'9'}}),e=>e.code==='endpoint');
  assert.equal(calls,0);
});

test('loads one course resource catalog, falls back for incomplete inline module items, paginates, and stays read-only',async()=>{
  const calls=[];
  let active=0,maxActive=0,profileCalls=0;
  const client=createClient({fetchImpl:async(url,options)=>{
    calls.push({url,options});active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,2));
    active--;
    if(url.includes('/users/self/profile')){profileCalls++;return response({id:'9',name:'Student'});}
    if(url.includes('/courses/7/modules/11/items')&&url.includes('page=2'))return response([{id:'103',type:'Page',title:'Lesson',page_url:'lesson'}]);
    if(url.includes('/courses/7/modules/11/items'))return response(
      [{id:'101',type:'File',title:'Worksheet',content_id:'55'},{id:'102',type:'Assignment',title:'Lab',content_id:'501'}],
      {link:'<https://school.instructure.com/api/v1/courses/7/modules/11/items?include%5B%5D=content_details&per_page=100&page=2>; rel="next"'},
    );
    if(url.includes('/courses/7/modules?'))return response([{id:'11',name:'Unit 1',items_count:3,items:[{id:'101',type:'File',title:'Worksheet',content_id:'55'}]}]);
    if(url.includes('/courses/7/pages?'))return response([{page_id:'70',url:'extra-page',title:'Extra page',html_url:'https://school.instructure.com/courses/7/pages/extra-page'}]);
    if(url.includes('/courses/7/files?'))return response([{id:'55',display_name:'Worksheet.pdf',url:'https://school.instructure.com/files/55/download'}]);
    if(url.includes('/courses/7/front_page'))return response({page_id:'71',url:'home',title:'Course Home',body:'<p>Home</p>'});
    if(url.includes('/courses/7?'))return response({id:'7',syllabus_body:'<p>Syllabus</p>'});
    throw Error('unexpected '+url);
  }});

  const result=await client.loadCourseResources('7',{user:{id:'9'}});
  assert.equal(result.origin,'https://school.instructure.com');
  assert.equal(result.accountId,'9');
  assert.equal(result.courseId,'7');
  assert.deepEqual(result.modules[0].items.map(item=>item.id),['101','102','103']);
  assert.equal(result.pages.length,1);
  assert.equal(result.files.length,1);
  assert.equal(result.frontPage.title,'Course Home');
  assert.equal(result.syllabusBody,'<p>Syllabus</p>');
  assert.deepEqual(result.errors,[]);
  assert.equal(profileCalls,2);
  assert.ok(maxActive<=3,`max active requests was ${maxActive}`);
  assert.ok(calls.every(call=>call.options.method==='GET'));
  assert.ok(calls.every(call=>call.options.credentials==='same-origin'));
  assert.ok(calls.some(call=>/include(?:%5B%5D|\[\])=items/i.test(call.url)));
  assert.ok(calls.some(call=>/include(?:%5B%5D|\[\])=content_details/i.test(call.url)));
});

test('partial source errors are preserved while auth is fatal',async()=>{
  const user={id:'9'};
  const partial=createClient({fetchImpl:async url=>{
    if(url.includes('/profile'))return response({id:'9'});
    if(url.includes('/modules?'))return response([]);
    if(url.includes('/pages?'))return response({}, {status:500});
    if(url.includes('/files?'))return response([{id:'1',display_name:'Guide.pdf'}]);
    if(url.includes('/front_page'))return response({}, {status:404});
    if(/\/courses\/7\?/.test(url))return response({id:'7',syllabus_body:''});
    throw Error('unexpected '+url);
  }});
  const result=await partial.loadCourseResources('7',{user});
  assert.equal(result.files.length,1);
  assert.equal(result.frontPage,null);
  assert.equal(result.errors.length,1);
  assert.equal(result.errors[0].source,'pages');

  const fatal=createClient({fetchImpl:async url=>{
    if(url.includes('/profile'))return response({id:'9'});
    if(url.includes('/pages?'))return response({}, {status:401});
    if(url.includes('/modules?')||url.includes('/files?'))return response([]);
    if(url.includes('/front_page'))return response({}, {status:404});
    if(/\/courses\/7\?/.test(url))return response({id:'7'});
    return response([]);
  }});
  await assert.rejects(fatal.loadCourseResources('7',{user}),e=>e.code==='auth');
});

test('account swap after material loading is fatal',async()=>{
  let profiles=0;
  const client=createClient({fetchImpl:async url=>{
    if(url.includes('/profile'))return response({id:String(++profiles===1?9:10)});
    if(url.includes('/modules?')||url.includes('/pages?')||url.includes('/files?'))return response([]);
    if(url.includes('/front_page'))return response({}, {status:404});
    if(/\/courses\/7\?/.test(url))return response({id:'7'});
    throw Error('unexpected '+url);
  }});
  await assert.rejects(client.loadCourseResources('7',{user:{id:'9'}}),e=>e.code==='auth');
});

test('readCoursePage verifies ownership before and after and returns only the Canvas body',async()=>{
  let profiles=0;
  const client=createClient({fetchImpl:async url=>{
    if(url.includes('/profile')){profiles++;return response({id:'9'});}
    if(url.includes('/courses/7/pages/unit-1-vectors'))return response({url:'unit-1-vectors',body:'<table><tr><td>Vectors</td></tr></table>'});
    throw Error('unexpected '+url);
  }});
  const body=await client.readCoursePage('7','unit-1-vectors',{user:{id:'9'}});
  assert.equal(body,'<table><tr><td>Vectors</td></tr></table>');
  assert.equal(profiles,2);
});

test('resource allowlist rejects encoded traversal, credentials, arbitrary endpoints, and redirect responses',async()=>{
  let calls=0;
  const client=createClient({fetchImpl:async()=>{calls++;return response([], {redirected:true,url:'https://school.instructure.com/login'});}});
  await assert.rejects(client.list('/api/v1/courses/7/pages/%2e%2e'),e=>e.code==='endpoint');
  await assert.rejects(client.list('https://user:pass@school.instructure.com/api/v1/courses/7/files'),e=>e.code==='endpoint'||e.code==='origin');
  await assert.rejects(client.list('/api/v1/courses/7/quizzes/99/questions'),e=>e.code==='endpoint');
  assert.equal(calls,0);
  await assert.rejects(client.list('/api/v1/courses/7/files'),e=>e.code==='redirect');
  assert.equal(calls,1);
});
