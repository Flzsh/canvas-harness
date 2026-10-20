'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Host=require('../extension/pdf-host.js'),Model=require('../extension/pdf-model.js');
test('a dormant host rechecks the vanilla route before intercepting later Canvas interactions',()=>{
 let vanilla=true,clickListener,prevented=false;
 const origin='https://school.instructure.com',href=origin+'/files/42/download';
 const document={addEventListener(type,fn){if(type==='click')clickListener=fn;},removeEventListener(){},createElement(){throw Error('No DOM work is allowed after leaving the vanilla route.');}};
 const root={document,location:{href:origin+'/courses/7/assignments/12',origin},ReserveSite:{supported:()=>true,vanillaPage:()=>vanilla},ReservePdfModel:Model};
 const host=Host.create({root});vanilla=false;
 const element={href,textContent:'Lesson.pdf',getAttribute:key=>key==='href'?href:null,closest:selector=>selector.startsWith('a[href]')?element:null};
 assert.doesNotThrow(()=>clickListener({button:0,target:element,preventDefault(){prevented=true;}}));assert.equal(prevented,false);host.destroy();
});
