'use strict';
// Course dock 3.7 (owner, 2026-10-27: the dock was "very basic, no animation of the icon, or animation itself, no
// customization or adjustment"): its settings, its place and size by hand, its card, Cards and the motion switches.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const M=require('../extension/customization-model.js');
const css=fs.readFileSync(path.join(__dirname,'..','extension','customize.css'),'utf8');

test('the dock keeps its shelf, look, switches, size and place as validated settings',()=>{
 assert.deepEqual([M.defaults.dockShelf,M.defaults.dockStyle,M.defaults.dockNamesAlways,M.defaults.dockCounts,M.defaults.dockLively,M.defaults.dockHide,M.defaults.dockScale,M.defaults.dockShift],['kraft','tiles',false,true,true,false,1,0]);
 const out=M.cleanSettings({dockShelf:'paper',dockStyle:'cards',dockHide:true,dockScale:1.234,dockShift:-.5});
 assert.deepEqual([out.dockShelf,out.dockStyle,out.dockHide,out.dockScale,out.dockShift],['paper','cards',true,1.23,-.5]);
 for(const bad of [{dockScale:2},{dockScale:.5},{dockShift:1.5},{dockShelf:'wood'},{dockStyle:'list'},{dockCounts:'yes'}])assert.throws(()=>M.cleanSettings(bad),/Invalid/,JSON.stringify(bad));
});

test('the dock draws its place, size, hiding, cards and card; Still stops every move',()=>{
 for(const rule of ['.rd[data-dock-size] .rd-dock{--rd-dock-size:calc(54px * var(--rd-dock-scale,1))}','left:calc(var(--rd-dock-center,50%) + var(--rd-dock-shift,0px))','.rd[data-dock-hide=true] .rd-dock:is([data-near],:focus-within,[data-dragging]){translate:-50% 0}','.rd .rd-dock-card>.rd-frame{position:absolute;inset:0;z-index:-1','.rd[data-dock-counts=false] .rd-dock .rd-dock-seal{display:none}','.rd .rd-dock-menu{position:fixed;'])assert.ok(css.includes(rule),rule);
 for(const shelf of ['kraft','none'])assert.match(css,new RegExp(`\\.rd\\[data-dock-shelf=${shelf}\\]`));
 // Either spelling: the public build's subject check writes the :is() list out in full.
 assert.match(css,/\[data-motion-style=still\]\) \.rd-dock (?::is\(\.rd-dock-it,\.rd-dock-tile,\.rd-dock-name,\.rd-dock-seal\)|\.rd-dock-it,[^{]*\.rd-dock-seal)\{animation:none!important;transition:none!important\}/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{\.rd \.rd-dock (?::is|\.rd-dock-it,)/);
 for(const k of ['rd-dock-swing','rd-dock-seal','rd-dock-pop'])assert.match(css,new RegExp('@keyframes '+k+'\\{'));
});
