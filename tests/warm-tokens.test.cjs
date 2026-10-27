'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../extension/refresh.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
function rule(selector){
 const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].trim()===selector);
 assert.ok(rules.length,selector);
 return Object.assign({},...rules.map(m=>Object.fromEntries(m[2].split(';').map(line=>line.trim()).filter(Boolean).map(line=>{const i=line.indexOf(':');return [line.slice(0,i).trim(),line.slice(i+1).trim()];}))));
}

test('workspace tabs have no tinted track or sliding pill',()=>{
 const track=rule('.rd .rd-workspace-tabs.t-tabs'),pill=rule('.rd .rd-workspace-tabs .t-tabs-pill');
 assert.equal(track.background,'none');assert.equal(track.padding,'0');assert.equal(pill.display,'none');
 assert.equal(rule('.rd .rd-workspace-tabs .t-tab')['font-weight'],'450','the public labels keep their regular weight');
});

test('the selected workspace tab is underlined by hand',()=>{
 const line=rule('.rd .rd-workspace-tabs .t-tab[aria-selected=true]::after');
 assert.equal(line.content,'""');assert.equal(line.position,'absolute');assert.equal(line.height,'8px');
 assert.match(line['-webkit-mask'],/^url\("data:image\/svg\+xml,/);
 assert.match(line.mask,/^url\("data:image\/svg\+xml,/);
});
