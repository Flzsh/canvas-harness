'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./pony-fixture.cjs');

test('roam settings immediately move the same mounted pet between the page and paddock',t=>{
 const f=fixture({paddock:true}),mounted=f.node;t.after(()=>f.controller.destroy());
 assert.equal(mounted._y,301);
 f.setPet({roam:'home'});
 assert.equal(f.node,mounted,'changing settings must keep the existing pet node');
 assert.equal(mounted._y,823,'home immediately selects the paddock');
 f.setPet({roam:'page'});
 assert.equal(f.node,mounted);
 assert.equal(mounted._y,301,'page immediately selects the workspace ledge');
});

test('the pet stay action also moves immediately without an external sync',t=>{
 const f=fixture({paddock:true}),mounted=f.node;t.after(()=>f.controller.destroy());
 for(const [roam,y]of [['home',823],['page',301]]){
  mounted.emit('click');
  const stay=new f.Element('pet-item',{petAction:'stay'});f.bubble.append(stay);
  f.bubble.emit('click',{target:stay});
  assert.equal(f.pet.roam,roam);
  assert.equal(f.node,mounted);
  assert.equal(mounted._y,y);
 }
});

for(const motion of ['walk','jump'])test('changing roam cancels an active '+motion+' aimed at the previous ledge',t=>{
 const f=fixture({paddock:true,extra:motion==='jump'}),mounted=f.node;t.after(()=>f.controller.destroy());
 if(motion==='walk'){f.startWalk();f.advance(300);assert.match(mounted.dataset.pose,/^(walk|trot)$/);}
 else{f.advance(1400);f.random(.22,...Array(9).fill(.5));f.advance(6400);assert.equal(mounted.dataset.pose,'fall');}
 f.setPet({roam:'home'});
 assert.equal(f.node,mounted);
 assert.equal(mounted._y,823,'home wins over pending '+motion);
 f.advance(900);
 assert.equal(mounted._y,823,'old motion cannot restore the page ledge');
 f.setPet({roam:'page'});
 assert.equal(mounted._y,301);
 f.advance(900);
 assert.equal(mounted._y,301,'old motion cannot restore the paddock');
});

test('roam change during a drag releases the old pointer movement',t=>{
 const f=fixture({paddock:true}),mounted=f.node;t.after(()=>f.controller.destroy());
 const x=mounted._x,y=mounted._y;
 mounted.emit('pointerdown',{button:0,pointerId:7,clientX:x,clientY:y});
 mounted.emit('pointermove',{pointerId:7,clientX:x+120,clientY:y+100});
 assert.equal(mounted.dataset.grabbed,'true');
 f.setPet({roam:'home'});
 assert.equal(f.node,mounted);
 assert.equal(mounted.dataset.grabbed,'false');
 assert.equal(mounted._y,823);
 mounted.emit('pointermove',{pointerId:7,clientX:500,clientY:400});
 mounted.emit('pointerup',{pointerId:7,clientX:500,clientY:400});
 f.advance(900);
 assert.equal(mounted._y,823);
});

test('home without a paddock uses the floor, and off still hides the pet',t=>{
 const f=fixture(),mounted=f.node;t.after(()=>f.controller.destroy());
 f.setPet({roam:'home'});
 assert.equal(f.node,mounted);
 assert.equal(mounted._y,995,'missing paddock falls back to the viewport floor');
 f.advance(900);
 assert.equal(mounted._y,995);
 f.setPet({roam:'off'});
 assert.equal(f.node,undefined,'off still unmounts');
 f.setPet({roam:'page'});
 assert.equal(f.node._y,301,'showing the pet again starts on the page');
});
