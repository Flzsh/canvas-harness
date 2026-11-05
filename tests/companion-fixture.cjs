'use strict';
function pack(name='Maple'){
 const assets={};for(const pose of ['stand','walk','sleep']){const still=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 48"><title>${pose} still</title><path d="M8 40h80"/></svg>`;assets[pose]={type:'image/svg+xml',data:'PHN2Zy8+',svg:still.replace(' still',' moving'),still};}
 return {format:'chpet',version:1,name,size:[96,48],ground:40,faces:'left',poses:{stand:'stand',walk:'walk',sleep:'sleep'},assets};
}
function personal(name='Maple',id='local-maple'){const row={id,name,kind:'pet'};return {pet:{name:'Biscuit',enabled:true,coat:'sage',harness:'forest',gear:'collar',treats:1},settings:{makeYourOwn:{pet:row,theme:null,installed:{[id]:row}}}};}
const event=()=>{const listeners=new Set();return {listeners,addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),emit:(...args)=>[...listeners].map(fn=>fn(...args))};},deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};},settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
module.exports={pack,personal,event,deferred,settle};
