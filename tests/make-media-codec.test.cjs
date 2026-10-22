'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const Media=require('../extension/media-store.js'),Common=require('../extension/pack-common.js'),Theme=require('../extension/theme-pack.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;},box=(tag,...parts)=>{const body=Buffer.concat(parts);return Buffer.concat([be(body.length+8),Buffer.from(tag),body]);};
function mp4({width=32,height=24,duration=1,external=false}={}){
 const timing=Buffer.alloc(100);timing.writeUInt32BE(1000,12);timing.writeUInt32BE(duration*1000,16);const track=Buffer.alloc(84);track.writeUInt32BE(width*65536,76);track.writeUInt32BE(height*65536,80);const handler=Buffer.alloc(24);handler.write('vide',8);
 const url=Buffer.alloc(4);url.writeUInt32BE(external?0:1);const dref=box('dref',Buffer.alloc(4),be(1),box('url ',url));
 return Buffer.concat([box('ftyp',Buffer.from('isom'),be(0),Buffer.from('isom')),box('moov',box('mvhd',timing),box('trak',box('tkhd',track),box('mdia',box('hdlr',handler),box('minf',box('dinf',dref))))),box('mdat',Buffer.from([1]))]);
}
function webm({width=32,height=24,duration=1}={}){
 const element=(id,body)=>{assert.ok(body.length<127);return Buffer.concat([Buffer.from(id,'hex'),Buffer.from([128|body.length]),body]);};const integer=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};const ticks=Buffer.alloc(8);ticks.writeDoubleBE(duration*1000);
 const header=element('1a45dfa3',element('4282',Buffer.from('webm'))),info=element('1549a966',Buffer.concat([element('2ad7b1',integer(1000000)),element('4489',ticks)])),track=element('1654ae6b',element('ae',Buffer.concat([element('83',Buffer.from([1])),element('e0',Buffer.concat([element('b0',integer(width)),element('ba',integer(height))]))]))),cluster=element('1f43b675',Buffer.from([0]));
 return Buffer.concat([header,element('18538067',Buffer.concat([info,track,cluster]))]);
}
function webp(animated=false){const pixels=Buffer.from([0x30,1,0,0x9d,1,0x2a,1,0,1,0]),chunk=(tag,body)=>{const size=Buffer.alloc(4);size.writeUInt32LE(body.length);return Buffer.concat([Buffer.from(tag),size,body,Buffer.alloc(body.length%2)]);};const body=animated?Buffer.concat([chunk('VP8X',Buffer.from([2,0,0,0,0,0,0,0,0,0])),chunk('ANIM',Buffer.alloc(6)),chunk('ANMF',Buffer.concat([Buffer.alloc(16),chunk('VP8 ',pixels)]))]):chunk('VP8 ',pixels),size=Buffer.alloc(4);size.writeUInt32LE(body.length+4);return Buffer.concat([Buffer.from('RIFF'),size,Buffer.from('WEBP'),body]);}
const jpeg=Buffer.from([255,216,255,192,0,8,8,0,1,0,1,1,255,218,0,2,0,255,217]);
for(const [type,bytes]of [['image/png',png],['image/gif',gif],['image/webp',webp()],['image/jpeg',jpeg],['video/mp4',mp4()],['video/webm',webm()]])test('shared media container codec checks '+type+' without DOM or IO',()=>{
 const info=Media.inspectPortable(bytes,type);assert.ok(info.width>0&&info.height>0);assert.equal(info.kind,type.startsWith('video')?'video':'image');assert.deepEqual(Common.inspectMedia(bytes,type),info);assert.throws(()=>Media.inspectPortable(bytes.subarray(0,5),type));assert.throws(()=>Media.inspectPortable(Buffer.alloc(bytes.length),type));
});
test('portable video metadata uses the existing duration, size and dimension limits',()=>{
 for(const bytes of [mp4({width:1921}),mp4({height:16001}),mp4({duration:3601}),mp4({duration:0}),webm({width:1921}),webm({duration:3601}),webm({duration:0})])assert.throws(()=>Media.inspectPortable(bytes,bytes[0]===0x1a?'video/webm':'video/mp4'),/dimensions|3600 s/);
 for(const [type,bytes]of [['video/mp4',mp4({duration:61})],['video/webm',webm({duration:61})]])assert.equal(Media.inspectPortable(bytes,type,{loop:{start:1,end:60},still:2}).duration,61);
 assert.throws(()=>Media.inspectPortable(mp4({external:true}),'video/mp4'),/External/);assert.equal(Media.inspectPortable(webp(true),'image/webp').animated,true);assert.equal(Media.inspectPortable(gif,'image/gif').animated,false);
});
test('all media hashes precede codecs and browser-decoding failures retain field diagnostics',async()=>{
 const asset=(bytes,type)=>({type,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')}),pack={format:'chtheme',version:1,name:'Media',colors:{light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#555555',line:'#cccccc',accent:'#0055aa'}},background:{asset:'photo'},assets:{photo:asset(png,'image/png')}};let prepared=0;
 const deps={media:{prepare:async()=>{prepared++;throw Error('Decoder rejected pixels');}}};pack.assets.photo.sha256='0'.repeat(64);await assert.rejects(()=>Theme.validate(pack,deps),/photo.sha256/);assert.equal(prepared,0);pack.assets.photo=asset(png,'image/png');await assert.rejects(()=>Theme.validate(pack,deps),/assets.photo: Decoder rejected pixels/);assert.equal(prepared,1);
 const font=fs.readFileSync(path.join(__dirname,'../extension/fonts/literata-latin.woff2'));delete pack.background;pack.assets={font:asset(font,'font/woff2')};pack.title={asset:'font',family:'Literata',weight:100,license:'OFL-1.1'};const result=await Theme.validate(pack);assert.equal(result.pack.title.weight,100);assert.equal(result.media.length,0);
});
