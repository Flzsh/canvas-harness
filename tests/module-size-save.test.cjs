'use strict';
// A module's size menu (Narrow / Normal / Wide) and its Pin save through pinModule(). The public widgets.js called it
// without defining it, so every size choice failed with "Could not save: pinModule is not defined. Your work has not
// been changed." (seen on the real page 2026-11-14, 4.0 Preview 7, Home > a module's "size and place" menu).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.join(__dirname,'..','extension','widgets.js'),src=fs.readFileSync(file,'utf8');
test('every bare call to pinModule in widgets.js has a definition in the same file',()=>{
 const calls=(src.match(/(?<![.\w])pinModule\(/g)||[]).length,defs=(src.match(/function pinModule\(/g)||[]).length;
 assert.ok(calls>=2,'the size menu and Pin call it');
 assert.equal(defs,1,'pinModule is defined once');
});
test('pinModule keeps a placed or resized module in the kept list, once, and can take it out again',()=>{
 const keys=new Set(['work','context','reader','timer']);
 const sandbox={globalThis:null,ReserveWorkspaceArrange:{isKey:k=>keys.has(k)},console};sandbox.globalThis=sandbox;sandbox.window=sandbox;sandbox.self=sandbox;
 vm.createContext(sandbox);
 vm.runInContext(src,sandbox,{filename:'widgets.js'});
 const W=sandbox.ReserveWidgets;assert.equal(typeof W?.pinModule,'function','exported');
 const data={toolbox:{agentPins:['context','gone']}};
 assert.equal(W.pinModule(data,'reader'),true);
 assert.deepEqual([...data.toolbox.agentPins].sort(),['context','reader'],'adds it and drops keys that are no module');
 assert.equal(W.pinModule(data,'reader'),false,'a second time changes nothing');
 assert.equal(W.pinModule(data,'reader',false),true);
 assert.deepEqual([...data.toolbox.agentPins],['context']);
 assert.equal(W.pinModule(data,'nope'),false,'an unknown module is refused');
});
