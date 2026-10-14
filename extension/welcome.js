/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Opened once, when Canvas Harness is first installed (background.js): the student sets their school's Canvas
// address before visiting Canvas, including a school's own address, which needs the browser's permission.
'use strict';
const school=document.getElementById('school-url'),status=document.getElementById('status');
ReserveSchool.saved().then(origin=>{if(origin&&!school.value)school.value=origin;}).catch(()=>{});
ReserveSchool.list().catch(()=>{});
document.getElementById('setup').addEventListener('submit',async event=>{
 event.preventDefault();
 try{
  const result=await ReserveSchool.open(school.value,{onAsk:host=>{status.textContent='Your browser will ask to let Canvas Harness use '+host+'. It asks for that site only.';}});
  status.textContent=result.message||(result.ok?'Opening Canvas…':'');if(!result.ok)school.focus();
 }catch{status.textContent='Could not open Canvas. Check the address and try again.';}
});
