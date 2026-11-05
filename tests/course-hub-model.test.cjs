const test=require('node:test');
const assert=require('node:assert/strict');
const Hub=require('../extension/course-hub-model.js');

test('exports classic-script/CommonJS Course Hub model API and rejects unsafe Canvas URLs',()=>{
  assert.equal(global.ReserveCourseHubModel,Hub);
  for(const name of ['normalizeUpdates','normalizeInbox','safeURL'])assert.equal(typeof Hub[name],'function',name);
  assert.equal(Hub.safeURL('/courses/7/external_tools/4'),'https://school.instructure.com/courses/7/external_tools/4');
  assert.equal(Hub.safeURL('https://school.instructure.com/courses/7/pages/home'),'https://school.instructure.com/courses/7/pages/home');
  assert.equal(Hub.safeURL('javascript:alert(1)'),'');
  assert.equal(Hub.safeURL('https://user:pass@school.instructure.com/courses/7'),'');
  assert.equal(Hub.safeURL('https://example.com/course'),'');
  assert.equal(Hub.safeURL('/api/v1/courses/7'),'');
});

test('normalizeUpdates keeps only published unlocked announcements and sorts newest first',()=>{
  const result=Hub.normalizeUpdates({courseId:'7',announcements:[
    {id:'1',title:'Older',message:'<p>Old</p>',posted_at:'2026-09-10T12:00:00Z',user_name:'Teacher A',html_url:'/courses/7/discussion_topics/1',read_state:'read',published:true},
    {id:'2',title:'Newest',message:'<p>New</p>',posted_at:'2026-09-13T12:00:00Z',author:{display_name:'Teacher B'},html_url:'https://school.instructure.com/courses/7/discussion_topics/2',read_state:'unread',published:true},
    {id:'3',title:'Draft',message:'draft',posted_at:'2026-09-14T12:00:00Z',published:false},
    {id:'4',title:'Locked',message:'locked',posted_at:'2026-09-14T12:00:00Z',published:true,locked_for_user:true},
    {id:'5',title:'Deleted',message:'deleted',posted_at:'2026-09-14T12:00:00Z',workflow_state:'deleted'},
  ],tabs:[]});
  assert.deepEqual(result.announcements.map(x=>x.id),['2','1']);
  assert.deepEqual(result.announcements[0],{
    id:'2',title:'Newest',body:'<p>New</p>',author:'Teacher B',postedAt:'2026-09-13T12:00:00.000Z',url:'https://school.instructure.com/courses/7/discussion_topics/2',unread:true,
  });
  assert.equal(result.announcements[1].unread,false);
});

test('normalizeUpdates preserves native visible same-course tabs including Canvas external-tool launch routes',()=>{
  const result=Hub.normalizeUpdates({courseId:'7',announcements:[],tabs:[
    {id:'assignments',label:'Assignments',html_url:'/courses/7/assignments',type:'internal',position:3},
    {id:'tool',label:'Class Tool',html_url:'/courses/7/external_tools/4',type:'external',position:2},
    {id:'home',label:'Home',html_url:'/courses/7',type:'internal',position:1},
    {id:'hidden',label:'Hidden',html_url:'/courses/7/files',hidden:true,position:4},
    {id:'foreign',label:'Foreign',html_url:'https://example.com/resource',type:'external',position:5},
    {id:'api',label:'API',html_url:'/api/v1/courses/7',position:6},
    {id:'other-course',label:'Wrong course',html_url:'/courses/8',position:7},
  ]});
  assert.deepEqual(result.tabs,[
    {id:'home',label:'Home',url:'https://school.instructure.com/courses/7',type:'internal'},
    {id:'tool',label:'Class Tool',url:'https://school.instructure.com/courses/7/external_tools/4',type:'external'},
    {id:'assignments',label:'Assignments',url:'https://school.instructure.com/courses/7/assignments',type:'internal'},
  ]);
});

test('normalizeInbox uses only explicit course context metadata, sorts recent summaries, and builds native Canvas links',()=>{
  const rows=Hub.normalizeInbox({conversations:[
    {id:'10',subject:'Lab reminder',last_message:'Bring goggles',last_message_at:'2026-09-13T19:00:00Z',workflow_state:'unread',context_code:'course_7',context_name:'Chemistry'},
    {id:'11',subject:'Group note',last_message:'See you',last_message_at:'2026-09-13T20:00:00Z',workflow_state:'read',context_code:'group_4',context_name:'Lab group'},
    {id:'12',subject:'No explicit context',last_message:'Hello',last_message_at:'2026-09-12T20:00:00Z',workflow_state:'read',context_name:'Biology',audience_contexts:{courses:{'9':['StudentEnrollment']}}},
  ]});
  assert.deepEqual(rows.map(x=>x.id),['11','10','12']);
  assert.deepEqual(rows[1],{
    id:'10',subject:'Lab reminder',excerpt:'Bring goggles',updatedAt:'2026-09-13T19:00:00.000Z',url:'https://school.instructure.com/conversations/10',unread:true,courseId:'7',courseName:'Chemistry',
  });
  assert.equal(rows[0].courseId,null);
  assert.equal(rows[0].courseName,'Lab group');
  assert.equal(rows[2].courseId,null,'audience_contexts must not invent a course association');
  assert.equal(rows[2].courseName,'Biology','Display supplied context names without inventing a course id');
});

test('normalizeInbox ignores invalid conversation ids and never reuses untrusted URLs',()=>{
  const rows=Hub.normalizeInbox({conversations:[
    {id:'abc',subject:'Bad id',html_url:'javascript:alert(1)'},
    {id:'15',subject:'Safe row',last_message:'Preview',last_message_at:'not-a-date',html_url:'https://example.com/phish',workflow_state:'unread'},
  ]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'15');
  assert.equal(rows[0].updatedAt,null);
  assert.equal(rows[0].url,'https://school.instructure.com/conversations/15');
});
