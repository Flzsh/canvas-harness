'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createClient}=require('../extension/api.js'),storage=require('../extension/storage.js'),core=require('../extension/core.js');
const response=(data,link='')=>({ok:true,status:200,headers:{get:key=>key==='content-type'?'application/json':key==='link'?link:null},json:async()=>data});
test('other Canvas schools use only their own authenticated origin',async()=>{
 const calls=[];const client=createClient({origin:'https://another-school.instructure.com',fetchImpl:async(url,options)=>{calls.push({url,options});return response({id:'42'});}});
 assert.equal((await client.profile()).id,'42');assert.equal(calls[0].url,'https://another-school.instructure.com/api/v1/users/self/profile');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.method,'GET');
});
test('pagination cannot cross to a second valid Canvas school',async()=>{
 let calls=0;const client=createClient({origin:'https://school-a.instructure.com',fetchImpl:async()=>{calls++;return response([],'<https://school-b.instructure.com/api/v1/courses?page=2>; rel="next"');}});
 await assert.rejects(client.list('/api/v1/courses'),e=>e.code==='origin');assert.equal(calls,1);
});
test('unsupported hosts, lookalikes, insecure sites, credentials and ports are rejected before fetching',()=>{
 for(const origin of ['https://instructure.com.attacker.example','http://school.instructure.com','https://user:secret@school.instructure.com','https://school.instructure.com:8443','https://example.org'])assert.throws(()=>createClient({origin,fetchImpl:async()=>{throw Error('must not fetch');}}),e=>e.code==='origin');
});
test('the same account number at different schools never shares personal data or backups',async()=>{
 const data={},adapter={read:async k=>structuredClone(data[k]),write:async(k,v)=>{data[k]=structuredClone(v);}};
 const a=storage.createStore({accountId:'42',origin:'https://school-a.instructure.com',adapter}),b=storage.createStore({accountId:'42',origin:'https://school-b.instructure.com',adapter});
 await a.load();await a.update(s=>{s.tasks['7']={notes:'Only school A',pinned:true};});await b.load();assert.deepEqual(b.get().tasks,{});assert.throws(()=>storage.validateBackup(a.exportBackup(),b.owner),/different Canvas account or site/);
});
test('general edition preserves unfamiliar course names instead of interpreting teacher suffixes',()=>{
 for(const name of ['Art-Design','Computer Science: Data Structures','Research — Section 2'])assert.equal(core.courseLabel(name).title,name);
});
test('shipping code has no fixed original-school URL or school-specific label',()=>{
 const dir=require('node:path').join(__dirname,'../extension');for(const f of fs.readdirSync(dir).filter(f=>/\.(js|html|json)$/.test(f)))assert.ok(!/wra\.instructure\.com|Western Reserve Academy|WRA Canvas/.test(fs.readFileSync(dir+'/'+f,'utf8')),f);
});
test('gradebook links render the current school as usable href attributes',()=>{
 const vm=require('node:vm'),path=require('node:path'),ctx=vm.createContext({URL,Intl,location:{origin:'https://school-b.instructure.com'}});
 for(const f of ['site.js','grades-view.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),ctx);
 const html=ctx.ReserveGradesView.render({s:{showGrades:false},state:{courseId:'all'},courses:[{id:'12',name:'Example course',color:'#123456'}],items:[]},{E:String,icon:()=>'',scoreText:()=>'',gradePeriodLabel:()=>''});
 assert.match(html,/href="https:\/\/school-b\.instructure\.com\/courses\/12\/grades"/);assert.match(html,/href="https:\/\/school-b\.instructure\.com\/grades"/);assert.ok(!html.includes('globalThis'));
});
test('session passes the verified client school to the personal store',async()=>{
 const {createSession}=require('../extension/session.js');let owner;
 const session=createSession({client:{origin:'https://school-b.instructure.com',profile:async()=>({id:'42'}),loadSnapshot:async()=>({origin:'https://school-b.instructure.com',user:{id:'42'},courses:[],assignments:[]})},createStore:args=>{owner=args;return {load:async()=>{},readCache:async()=>null,writeCache:async()=>{},destroy(){}};},onSnapshot:()=>{}});
 await session.start();assert.deepEqual(owner,{accountId:'42',origin:'https://school-b.instructure.com'});session.destroy();
});
