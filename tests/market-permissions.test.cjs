'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{read,fixture,settle}=require('./market-fixture.cjs');
const HOST='https://flzsh.github.io/*',URL_MARKET='https://flzsh.github.io/canvas-harness-packs/';
function controls(env,{grant=true,present=false,optional=false}={}){
 const calls=[],registered=new Map();env.chrome.runtime.getManifest=()=>({permissions:optional?['storage']:['storage','scripting'],optional_permissions:optional?['scripting']:[],optional_host_permissions:[HOST]});
 env.chrome.permissions={async request(value){calls.push(['request',structuredClone(value)]);present=grant;return grant;},async contains(value){calls.push(['contains',structuredClone(value)]);return present;}};
 env.chrome.scripting={async getRegisteredContentScripts(value){calls.push(['inspect',structuredClone(value)]);return [...registered.values()];},async registerContentScripts(value){calls.push(['register',structuredClone(value)]);for(const script of value)registered.set(script.id,structuredClone(script));},async unregisterContentScripts(value){calls.push(['unregister',structuredClone(value)]);for(const id of value.ids)registered.delete(id);}};
 vm.runInContext(read('market.js'),env,{filename:'market.js'});return {calls,registered,present:value=>{present=value;}};
}
test('popup requests only optional market host on the click, registers isolated bridge, then opens',async t=>{
 const h=await fixture(t),c=controls(h.context);await h.open('addons');assert.deepEqual(c.calls,[]);h.click('.ap-market-open');assert.equal(c.calls[0][0],'request','permission request runs in the click stack');await settle();
 assert.deepEqual(c.calls[0],['request',{origins:[HOST]}]);assert.deepEqual(c.registered.get('ch-market'),{id:'ch-market',matches:[URL_MARKET+'*'],js:['market-bridge.js'],runAt:'document_idle',allFrames:false,world:'ISOLATED',persistAcrossSessions:true});assert.deepEqual(h.opened,[{url:URL_MARKET}]);
});
test('popup denial or registration failure still opens the market without claiming installation',async t=>{
 for(const fail of ['denied','registration']){const h=await fixture(t),c=controls(h.context,{grant:fail!=='denied'});if(fail==='registration')h.context.chrome.scripting.registerContentScripts=async()=>{throw Error('Unavailable');};await h.open('addons');h.click('.ap-market-open');await settle();assert.deepEqual(h.opened,[{url:URL_MARKET}]);assert.equal(c.registered.size,0);}
});
test('optional scripting is requested with the host in one user gesture; required scripting is unchanged',async t=>{
 const h=await fixture(t),c=controls(h.context,{optional:true});await h.open('addons');h.click('.ap-market-open');await settle();assert.deepEqual(c.calls[0],['request',{origins:[HOST],permissions:['scripting']}]);assert.ok(c.registered.has('ch-market'));
});
test('registration recovery is idempotent and removal unregisters the bridge',async()=>{
 const env=vm.createContext({URL,chrome:{runtime:{},tabs:{async create(){}}}}),c=controls(env,{present:true});await env.ReserveMarket.sync();await env.ReserveMarket.sync();assert.equal(c.calls.filter(c=>c[0]==='register').length,1);c.present(false);await env.ReserveMarket.sync();assert.equal(c.registered.size,0);assert.deepEqual(c.calls.at(-1),['unregister',{ids:['ch-market']}]);
});
