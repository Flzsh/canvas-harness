(async function(){
 'use strict';
 // Artificial preview only. Not included in the install ZIP. No Canvas requests.
 const now=new Date().toISOString(),user={id:'share-preview',name:'Demo Student',short_name:'Demo'};
 const courses=[{id:'101',name:'Course One',course_code:'Course One'},{id:'102',name:'Course Two',course_code:'Course Two'}];
 const assignments=courses.map((c,i)=>({id:String(401+i),course_id:c.id,name:'Practice activity '+(i+1),due_at:new Date(Date.now()+(i+1)*86400000).toISOString(),points_possible:10,published:true,description:'<p>This is artificial preview content. Your own assignments load after you sign into Canvas.</p>',submission_types:['on_paper'],submission:{workflow_state:'unsubmitted'},html_url:location.origin+'/courses/'+c.id+'/assignments/'+(401+i)}));
 const snapshot={origin:location.origin,user,courses,assignments,fetchedAt:now,errors:[],partial:false};
 const base=(courseId)=>({origin:location.origin,accountId:user.id,courseId,fetchedAt:now,errors:[]});
 const client={
  async loadCourseResources(id){return {...base(id),modules:[],pages:[],files:[],frontPage:{title:'Class guide',body:'<p>Artificial course guide for previewing the Canvas Harness.</p>'},syllabusBody:''};},
  async loadCourseUpdates(id){return {...base(id),announcements:[],tabs:[]};},
  async listInbox(){return {...base(),conversations:[],truncated:false};}
 };
 const store=ReserveStorage.createStore({accountId:user.id,origin:location.origin});await store.load();
 const shadow=document.getElementById('reserve-preview').attachShadow({mode:'open'});
 for(const [file,style] of [['literata-latin.woff2','normal'],['literata-latin-italic.woff2','italic']])document.fonts.add(new FontFace('Literata',"url('../extension/fonts/"+file+"')",{weight:'200 900',style,display:'swap'}));
 for(const file of ['app.css','dashboard.css','workspace.css','refresh.css','customize.css']){const link=document.createElement('link');link.rel='stylesheet';link.href='../extension/'+file;shadow.append(link);}
 const area=document.createElement('div');shadow.append(area);ReserveDashboard.mount(area,{snapshot,store,demo:true,refresh:async()=>snapshot,materialClient:client});
})();
