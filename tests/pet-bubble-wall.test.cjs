'use strict';
// Biscuit's bubble stays by the pony. Its left limit is where the page's column starts (a side rail stands over the pet
// layer); that used to be guessed from the ledges in view alone. With a module carried to the right, Up next made Wide and
// the page scrolled, the only ledge in view was far right, and the bubble jumped to the window's right edge while the pony
// stood in the middle (seen on the joined 4.2 copy, 2026-11-23; the same rule was in 4.0.199).
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./pony-fixture.cjs');
function page({main=true}={}){
 const f=fixture({frame:'none'});
 // the one ledge in view: a ruled line far to the right
 const line=new f.Element('line');line.rect=f.box(1300,450,300,40);line.borders={borderTopWidth:'1px',borderTopStyle:'solid',borderTopColor:'rgb(20, 20, 20)'};f.lines.push(line);f.panels[0].append(line);
 if(main){const column=new f.Element('rd-main');column.rect=f.box(100,300,1400,350);const all=f.container.querySelectorAll.bind(f.container);f.container.querySelectorAll=sel=>sel==='.rd-main'?[column]:all(sel);}
 f.advance(1400);f.controller.say('A synthetic reminder');f.advance(500);
 const x=Number(/translate\((-?\d+)px/.exec(String(f.bubble?.style.transform||''))?.[1]);assert.ok(Number.isFinite(x),'the bubble is placed');
 return {f,x,width:f.bubble.rect.width,tail:parseFloat(f.bubble.style['--pet-tail-x'])};
}
test('the bubble stands over the pony when the only ledge in view is far to the right',()=>{
 const {f,x,width,tail}=page();
 assert.ok(f.node._x<1200,'the pony is on the floor, left of that ledge');
 assert.ok(x<=f.node._x&&f.node._x<=x+width,'the pony is under its bubble (bubble '+x+' to '+(x+width)+', pony '+f.node._x+')');
 assert.ok(Math.abs(x+tail-f.node._x)<1,'and the tail points at it');
 assert.ok(x>=100-8,'never left of the column (the rail is there)');
 f.controller.destroy();
});
test('a page with no main column keeps the limit read from its ledges',()=>{
 const {f,x}=page({main:false});
 assert.equal(x,1300+18-26,'the ledge decides, as before');
 f.controller.destroy();
});
