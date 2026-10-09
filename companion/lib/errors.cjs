'use strict';
class CompanionError extends Error {
 constructor(code,message,details={}){super(message);this.name='CompanionError';this.code=code;this.details=details;}
}
const fail=(code,message,details)=>new CompanionError(code,message,details);
function publicError(error){
 if(error instanceof CompanionError)return {code:error.code,message:error.message,...error.details};
 if(error?.name==='AbortError')return {code:'CANCELLED',message:'Request cancelled.'};
 if(error?.name==='TimeoutError')return {code:'UNAVAILABLE',message:'The provider did not respond in time. Try again later.'};
 return {code:'INTERNAL',message:'The companion could not finish this request. Reconnect and try again.'};
}
function checkAbort(signal){if(signal?.aborted)throw fail('CANCELLED','Request cancelled.');}
module.exports={CompanionError,fail,publicError,checkAbort};
