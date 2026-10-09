(async function(){
 'use strict';
 // Artificial preview only. Not included in the install ZIP. No Canvas requests.
 const now=new Date().toISOString(),user={id:'subject-gallery-preview',name:'Demo Student',short_name:'Demo'};
 const courseNames=['Chemistry','Calculus AB','English','World History','Spanish','AP Biology','Physics'];
 const demoGrades=[[94,'A'],[91,'A-'],[97,'A+'],[88,'B+'],[85,'B'],[93,'A'],[null,null]];
 const courses=courseNames.map((name,i)=>({id:String(101+i),name,course_code:name,enrollments:[{type:'StudentEnrollment',computed_current_score:demoGrades[i][0],computed_current_grade:demoGrades[i][1]}]}));
 const activities=[
  ['101','Reaction rates: lab preparation',9,'<p>Read the experiment guide and prepare your observations table before our next lab.</p><h3>Before class</h3><ol><li>Read the introduction and safety notes.</li><li>Explain how temperature affects reaction rate.</li><li>Draw a results table with space for three trials.</li></ol><p>Bring your notebook. We will collect the results together in class.</p>'],
  ['102','Derivatives: practice set',26,'<p>Complete questions 1–8 on the practice sheet. Show your reasoning and mark one question you would like to discuss.</p>'],
  ['103','A close reading: chapter three',31,'<p>Choose one passage from chapter three. Annotate its imagery and bring a short reflection to our discussion.</p>'],
  ['104','Mapping the trade routes',50,'<p>Label the main routes on your map and connect two traded goods to their places of origin.</p>'],
  ['105','Prepare a short conversation',53,'<p>Practise a two-minute conversation using this week’s vocabulary. Bring your notes to class.</p>'],
  ['106','Cell transport: compare and explain',75,'<p>Compare diffusion, osmosis and active transport. Include a labelled sketch of each process.</p>'],
  ['107','Motion graphs: a quick investigation',98,'<p>Sketch position and velocity graphs for a journey with two stops. Explain how the graphs relate.</p>'],
  ['101','Lab notes: interpreting the results',57,'<p>Use your observations to compare the three trials. Include one source of uncertainty.</p>'],
  ['102','Limits and continuity: reflection',81,'<p>Write a short explanation of continuity using a graph of your choice.</p>']
 ];
 const assignments=activities.map(([id,name,hours,description],i)=>({id:String(401+i),course_id:id,name,due_at:new Date(Date.now()+hours*3600000).toISOString(),points_possible:10,published:true,description,submission_types:['on_paper'],submission:{workflow_state:'unsubmitted'},html_url:location.origin+'/courses/'+id+'/assignments/'+(401+i)}));
 const snapshot={origin:location.origin,user,courses,assignments,fetchedAt:now,errors:[],partial:false};
 const base=courseId=>({origin:location.origin,accountId:user.id,courseId,fetchedAt:now,errors:[]});
 const client={
  async loadCourseResources(id){
   const name=courses.find(c=>c.id===id)?.name||'Course',url=location.origin+'/courses/'+id;
   return {...base(id),modules:[{id:'m-'+id,name:'This week',position:1,items:[{id:'mi-'+id,title:id==='101'?'Reaction rates: experiment guide':'Weekly study guide',type:'Page',page_url:'study-guide',html_url:url+'/pages/study-guide'},{id:'mf-'+id,title:'Practice & class notes',type:'File',content_id:'f-'+id,html_url:url+'/files/f-'+id}]}],pages:[],files:[{id:'f-'+id,display_name:'Practice & class notes.pdf',filename:'practice-notes.pdf',content_type:'application/pdf',url:url+'/files/f-'+id+'/download'}],frontPage:{title:name+' · This week',url:'weekly-guide',html_url:url+'/pages/weekly-guide',body:id==='101'?'<h2>Our next lab</h2><p>We are investigating what changes the speed of a reaction.</p><p>Start with the experiment guide below, then complete your preparation questions. Bring your safety glasses and notebook.</p>':'<h2>This week in '+name+'</h2><p>Begin with the weekly study guide. Use the practice notes to prepare your questions for class.</p>'},syllabusBody:''};
  },
  async loadCourseUpdates(id){return {...base(id),announcements:[{id:'notice-'+id,title:id==='101'?'A note before the lab':'Getting ready for our next class',message:id==='101'?'<p>Please bring your notebook and safety glasses. The experiment guide is in This week.</p>':'<p>The study guide and practice notes are ready. Bring one question to discuss.</p>',posted_at:now,html_url:location.origin+'/courses/'+id+'/discussion_topics/notice-'+id,author:{display_name:'Your teacher'}}],tabs:[]};},
  async listInbox(){return {...base(),conversations:[],truncated:false};}
 };
 const store=ReserveStorage.createStore({accountId:user.id,origin:location.origin});await store.load();
 const shadow=document.getElementById('reserve-preview').attachShadow({mode:'open'});
 for(const [file,style] of [['literata-latin.woff2','normal'],['literata-latin-italic.woff2','italic']])document.fonts.add(new FontFace('Literata',"url('../extension/fonts/"+file+"')",{weight:'200 900',style,display:'swap'}));
 for(const file of ['app.css','dashboard.css','workspace.css','refresh.css','subject-art.css','customize.css','gpa.css']){const link=document.createElement('link');link.rel='stylesheet';link.href='../extension/'+file;shadow.append(link);}
 const area=document.createElement('div');shadow.append(area);ReserveDashboard.mount(area,{snapshot,store,demo:true,refresh:async()=>snapshot,materialClient:client});
})();
