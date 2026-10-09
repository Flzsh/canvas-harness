'use strict';
const {fail}=require('./errors.cjs');
const MAX_IN=262144,MAX_OUT=65536;
class Decoder {
 constructor(onMessage){this.onMessage=onMessage;this.header=Buffer.alloc(4);this.headerUsed=0;this.body=null;this.used=0;this.failed=false;}
 push(chunk){
  if(this.failed)throw fail('INVALID_REQUEST','Native frame decoder is closed.');
  try{
   let offset=0;
   while(offset<chunk.length){
    if(!this.body){const n=Math.min(4-this.headerUsed,chunk.length-offset);chunk.copy(this.header,this.headerUsed,offset,offset+n);this.headerUsed+=n;offset+=n;if(this.headerUsed<4)continue;
     const length=this.header.readUInt32LE();if(!length||length>MAX_IN)throw fail('LIMIT_EXCEEDED','Invalid native frame length.');this.body=Buffer.alloc(length);this.used=0;
    }
    const n=Math.min(this.body.length-this.used,chunk.length-offset);chunk.copy(this.body,this.used,offset,offset+n);this.used+=n;offset+=n;
    if(this.used===this.body.length){let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(this.body));}catch{throw fail('INVALID_REQUEST','Invalid UTF-8 or JSON native frame.');}
     this.body=null;this.headerUsed=0;this.used=0;this.onMessage(value);
    }
   }
  }catch(error){this.failed=true;throw error;}
 }
 end(){if(this.body||this.headerUsed)throw fail('INVALID_REQUEST','Truncated native frame.');}
}
function encode(value){const body=Buffer.from(JSON.stringify(value));if(!body.length||body.length>MAX_OUT)throw fail('LIMIT_EXCEEDED','Outbound native frame exceeds its limit.');const head=Buffer.alloc(4);head.writeUInt32LE(body.length);return Buffer.concat([head,body]);}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function exact(value,keys){if(!object(value)||Object.keys(value).some(k=>!keys.includes(k)))throw fail('INVALID_REQUEST','Request contains an unsupported field.');}
function validId(id){return typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id);}
function validate(value){
 if(!object(value)||!validId(value.id))throw fail('INVALID_REQUEST','Request needs a valid id.');
 const fields={status:[],authenticate:['reauthorize'],models:[],chat:['model','messages'],cancel:['targetId'],signout:[]};
 if(!Object.hasOwn(fields,value.op))throw fail('INVALID_REQUEST','Unsupported request operation.');
 exact(value,['id','op',...fields[value.op]]);
 if(value.op==='authenticate'&&value.reauthorize!==undefined&&typeof value.reauthorize!=='boolean')throw fail('INVALID_REQUEST','Invalid authentication request.');
 if(value.op==='cancel'&&(!validId(value.targetId)||value.targetId===value.id))throw fail('INVALID_REQUEST','Cancel needs another valid targetId.');
 if(value.op==='chat'){
  if(typeof value.model!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value.model))throw fail('INVALID_REQUEST','Choose a valid model.');
  if(!Array.isArray(value.messages)||!value.messages.length||value.messages.length>80)throw fail('INVALID_REQUEST','Chat needs 1–80 messages.');
  let total=0;for(const m of value.messages){exact(m,['role','content']);if(!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim())throw fail('INVALID_REQUEST','Each message needs a user or assistant role and text content.');
   const size=Buffer.byteLength(m.content);total+=size;if(size>196608||total>196608)throw fail('LIMIT_EXCEEDED','Message context exceeds the text limit.');
  }
  if(value.messages.at(-1).role!=='user')throw fail('INVALID_REQUEST','The last message must be from the user.');
 }
 return value;
}
module.exports={Decoder,encode,validate,validId,MAX_IN,MAX_OUT};
