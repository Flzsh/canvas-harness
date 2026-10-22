/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Reuse the public account server's serializer for Market and media writes.
 * This helper installs no runtime listener or alternate validator.
 */
(function(root){
 'use strict';
 function run(key,fn){
  const shared=root.ReserveStorage?.runAccountWrite;
  if(typeof shared!=='function')return Promise.reject(Error('The account writer is unavailable. Reload Canvas Harness.'));
  return shared(key,fn);
 }
 root.ReserveAccountWrites=Object.freeze({run});
})(globalThis);
