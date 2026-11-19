'use strict';
// Audit B3 (2026-11-14): with a theme or scene in use, a named accent (Clay, Forest, Iris...) is saved into that look's
// own palette for the mode the student is in. In Dark it was saved as the LIGHT page's colour (ACCENTS), although Canvas Harness
// itself uses the dark set (DARK_ACCENTS) in Dark: "Forest" on a dark theme became #367964, a dark green on a dark page.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const js=fs.readFileSync(path.join(__dirname,'../extension/dashboard.js'),'utf8');
const tables=js.match(/const ACCENTS=\{[^}]*\};\s*const DARK_ACCENTS=\{[^}]*\};/)[0];
const definition=js.match(/    function saveAppearance\(key,value\)\{[\s\S]*?\n    \}\n(?=    function saveLayoutPreset)/)[0];
function harness(mode){
 const calls=[],env={fieldEnabled:()=>true,makeWrites:Promise.resolve(),makeOwn:{state:{theme:{colors:{light:{},dark:{}}}},action:async(...args)=>{calls.push(args);}},lookSelection:()=>({key:'pack:garden',layer:{}}),settings:()=>({theme:mode}),root:{},savePersonal:async()=>true};
 vm.createContext(env);
 const save=vm.runInContext('(function(){'+tables+definition+'return {save:saveAppearance,ACCENTS,DARK_ACCENTS};})()',env);
 return {...save,calls,env};
}
test('a named accent under a theme is the colour Canvas Harness itself uses in that mode',async()=>{
 const dark=harness('dark');await dark.save('accent','forest');await dark.env.makeWrites;
 assert.deepEqual(dark.calls[0].slice(0,2),['adjust','pack:garden']);
 assert.equal(dark.calls[0][2].patch.colors.dark.accent,dark.DARK_ACCENTS.forest,'Dark keeps the dark Forest');
 const light=harness('light');await light.save('accent','forest');await light.env.makeWrites;
 assert.equal(light.calls[0][2].patch.colors.light.accent,light.ACCENTS.forest,'Light keeps the light Forest');
 const own=harness('dark');await own.save('accent','#123456');await own.env.makeWrites;
 assert.equal(own.calls[0][2].patch.colors.dark.accent,'#123456','a colour of the student’s own is kept as it is');
});
