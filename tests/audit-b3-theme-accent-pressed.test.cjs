'use strict';
// Audit B3 (2026-11-14): with a theme or scene in use, Make it yours > Look > Accent color saves the pick into that
// look's own palette (dashboard.js saveAppearance), but the six accent buttons kept showing the account's accent as
// pressed: after choosing Forest on Under the Sea, "Clay" still looked chosen and Forest did not.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createDOM}=require('./addons-fixture.cjs'),Customization=require('../extension/customization-model.js');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
function look(settings){
 const env=vm.createContext({ReserveCustomization:Customization,ReserveFeatures:{enabled:()=>true},ReserveWidgets:{FRAMES:[['pen','Pen line','']]},ReservePacks:{isCurrent:()=>false}});
 for(const file of ['make-your-own.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});
 const html=env.ReserveCustomizeUI.render({s:{...Customization.defaults,accent:'clay',...settings},customizeOpen:true,customizeTab:'look',allCourses:[],courses:[],makeOwn:{catalogue:[],busy:false}});
 const doc=createDOM('<html><body>'+html+'</body></html>');
 return Object.fromEntries(['clay','forest','indigo','rose','ocean','amber'].map(key=>[key,doc.querySelector('[data-accent="'+key+'"]')?.getAttribute('aria-pressed')]));
}
const scene=(theme,accent)=>({theme,sceneTheme:'sea',makeYourOwn:{theme:null,pet:null,installed:{},adjustments:{'builtin:scene:sea':{colors:{[theme]:{accent}}}}}});
test('the pressed accent is the one the scene uses now, in light and in dark',()=>{
 assert.equal(look(scene('light','#367964')).forest,'true','Forest (light) is pressed');
 assert.equal(look(scene('light','#367964')).clay,'false','the account accent is not');
 assert.equal(look(scene('dark','#9bd1b4')).forest,'true','Forest (dark) is pressed');
 const own=look({sceneTheme:'sea',makeYourOwn:{theme:null,pet:null,installed:{}}});
 assert.ok(Object.values(own).every(value=>value==='false'),'the scene’s own accent is none of the six');
});
test('without a theme or scene the account accent stays the pressed one',()=>{
 assert.equal(look({accent:'rose'}).rose,'true');assert.equal(look({accent:'rose'}).clay,'false');
});
