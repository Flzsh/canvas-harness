const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClient}=require('../extension/api.js');
const response=(body,status=200,link='')=>({ok:status>=200&&status<300,status,headers:{get:n=>n==='link'?link:'application/json'},json:async()=>body});
test('pagination loads later assignments and never sends a write request',async()=>{
 const calls=[]; const client=createClient({origin:'https://school.instructure.com',fetchImpl:async(url,options)=>{calls.push({url,options});return url.includes('page=2')?response([{id:2}]):response([{id:1}],200,'<https://school.instructure.com/api/v1/courses/7/assignments?page=2>; rel="next"');}});
 assert.deepEqual(await client.list('/api/v1/courses/7/assignments'),[{id:1},{id:2}]);
 assert.equal(calls.length,2);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.credentials,'same-origin');
});
test('rejects cross-origin pagination before sending credentials',async()=>{
 let calls=0;const client=createClient({origin:'https://school.instructure.com',fetchImpl:async()=>{calls++;return response([],200,'<https://example.com/api/v1/courses>; rel="next"');}});
 await assert.rejects(client.list('/api/v1/courses'),/outside|origin/i);assert.equal(calls,1);
});
test('does not turn expired login into an empty workload',async()=>{
 const client=createClient({origin:'https://school.instructure.com',fetchImpl:async()=>response({},401)});
 await assert.rejects(client.list('/api/v1/courses'),e=>e.code==='auth');
});
test('refuses arbitrary non-API paths and endpoints',async()=>{
 const client=createClient({origin:'https://school.instructure.com',fetchImpl:async()=>{throw Error('should not send');}});
 await assert.rejects(client.list('/login'),/endpoint|path/i);await assert.rejects(client.list('/api/v1/accounts'),/endpoint|path/i);
});
test('partial course failure preserves successful courses and reports exactly the failed course',async()=>{
 const client=createClient({origin:'https://school.instructure.com',fetchImpl:async(url)=>{
 if(url.includes('/profile'))return response({id:9,name:'Test Student'});
 if(url.includes('/courses?'))return response([{id:1,name:'Chemistry'},{id:2,name:'Latin'}]);
 if(url.includes('/courses/1/assignments'))return response([{id:12,name:'Lab',published:true},{id:13,published:false}]);
 return response({},403);
 }});
 const snapshot=await client.loadSnapshot(); assert.equal(snapshot.user.id,9);assert.equal(snapshot.courses.length,2);assert.deepEqual(snapshot.assignments.map(a=>a.id),[12]);assert.equal(snapshot.errors.length,1);assert.equal(snapshot.errors[0].courseId,'2');assert.equal(snapshot.partial,true);
});
test('HTML login response is recognized even with status 200',async()=>{
 const client=createClient({origin:'https://school.instructure.com',fetchImpl:async()=>({ok:true,status:200,headers:{get:()=> 'text/html'},json:async()=>{throw new SyntaxError('HTML');}})});
 await assert.rejects(client.list('/api/v1/courses'),e=>e.code==='auth');
});
test('rate limit is actionable and never silently treated as no assignments',async()=>{
 const client=createClient({origin:'https://school.instructure.com',fetchImpl:async()=>response({},429)});
 await assert.rejects(client.list('/api/v1/courses'),e=>e.code==='rate');
});
