/* Exact quantity conversion only; note payloads always retain the original text. */
(function(root){
 'use strict';
 const numbers={
  zero:0,
  one:1,
  two:2,
  three:3,
  four:4,
  five:5,
  six:6,
  seven:7,
  eight:8,
  nine:9,
  ten:10,
  eleven:11,
  twelve:12,
  thirteen:13,
  fourteen:14,
  fifteen:15,
  sixteen:16,
  seventeen:17,
  eighteen:18,
  nineteen:19,
  twenty:20,
  thirty:30,
  forty:40,
  fifty:50,
  sixty:60,
  seventy:70,
  eighty:80,
  ninety:90,
  hundred:100,
  uno:1,
  dos:2,
  tres:3,
  cuatro:4,
  cinco:5,
  seis:6,
  siete:7,
  ocho:8,
  nueve:9,
  diez:10,
  once:11,
  doce:12,
  trece:13,
  catorce:14,
  quince:15,
  dieciseis:16,
  diecisiete:17,
  dieciocho:18,
  diecinueve:19,
  veinte:20,
  treinta:30,
  cuarenta:40,
  cincuenta:50,
  soixante:60,
  deux:2,
  trois:3,
  quatre:4,
  cinq:5,
  six:6,
  sept:7,
  huit:8,
  neuf:9,
  dix:10,
  onze:11,
  douze:12,
  treize:13,
  quatorze:14,
  quinze:15,
  seize:16,
  vingt:20,
  trente:30,
  quarante:40,
  cinquante:50
 };
 const spokenClock=/\b(at|from|until|till|to|finish|end|start|leave|keep|keeping|between|evening|morning|afternoon|today|tomorrow|tonight)\s+(twenty(?:[ -](?:one|two|three))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s+((?:oh|zero)\s+(?:one|two|three|four|five|six|seven|eight|nine)|(?:twenty|thirty|forty|fifty)(?:[ -](?:one|two|three|four|five|six|seven|eight|nine))?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)(?![a-z])/g;
 function spokenClocks(text,map){
  return text.replace(spokenClock,(all,prefix,hour,minute,index)=>{
   if(/^\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?|percent|points?)\b/.test(text.slice(index+all.length)))return all;
   const number=v=>v.split(/[ -]+/).reduce((n,w)=>n+(w==='oh'?0:map[w]??NaN),0),h=number(hour),m=number(minute);
   return Number.isInteger(h)&&h>=0&&h<=23&&Number.isInteger(m)&&m>=0&&m<=59?prefix+' '+String(h)+':'+String(m).padStart(2,'0'):all;
  });
 }
 let normalizationCache=null;
 function cacheFor(map,keys){
  if(normalizationCache&&keys.length===normalizationCache.keys.length){
   let same=true;
   for(let i=0;i<keys.length;i++)if(keys[i]!==normalizationCache.keys[i]||!Object.is(map[keys[i]],normalizationCache.values[i])){same=false;break;}
   if(same)return normalizationCache;
  }
  if(!keys.length||keys.length>128)return null;
  let length=0;
  for(const key of keys)if((length+=key.length)>2048||!/^[a-z]+$/.test(key)||typeof map[key]!=='number')return null;
  const words=keys.join('|');
  return normalizationCache={
   keys,
   values:keys.map(key=>map[key]),
   hundred:new RegExp('\\b(?:('+words+')[ -]+)?hundred(?:[ -]+and)?(?:[ -]+('+words+'))?(?:[ -]+('+words+'))?\\b','g'),
   number:new RegExp('\\b('+words+')(?:[ -]+('+words+'))?\\b','g'),
   text:new Map()
  };
 }
 function normalize(input,data={}){
  let text=String(input).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(?<=[a-z])-(?=[a-z])/g,' ').replace(/[\u2010-\u2015\u2212]/g,'-'),map={...numbers,...data.numbers};
  if(!Object.hasOwn(data.numbers||{},'once'))delete map.once;
  text=text.replace(/\bonce(?=\s+(?:minutos?|horas?|segundos?)\b)/g,'11').replace(/\b(a las|hasta las|son las)\s+once\b/g,'$1 11');
  text=spokenClocks(text,map);
  text=text.replace(/\b(tomorrow|today|tonight|demain|manana|at|by|until|till|from|to|for|focus|start|concentration)(?=\d)/g,'$1 ').replace(/(?<=[\p{L}])(?=\d{1,2}:\d{2}(?!\d))/gu,' ').replace(/(?<=[\p{L}])(?=\d+(?:\.\d+)?\s*-?\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)\b)/gu,' ').replace(/\ba las(?=\d)/g,'a las ').replace(/\u660e\u5929(?:\u672c\u5730)?/g,'tomorrow at ').replace(/(\d+(?:\.\d+)?)\s*\u5206\u949f/g,'$1 minutes ');
  const key=text,names=Object.keys(map),memo=cacheFor(map,names);
  if(memo&&memo.text.has(key))return memo.text.get(key);
  text=multilingual(text);
  const keys=memo?'':names.join('|');
  text=text.replace(
   memo?memo.hundred:new RegExp('\\b(?:('+keys+')[ -]+)?hundred(?:[ -]+and)?(?:[ -]+('+keys+'))?(?:[ -]+('+keys+'))?\\b','g'),
   (_,a,b,c)=>String((a?map[a]:1)*100+(b?map[b]:0)+(c?map[c]:0)));
  text=text.replace(memo?memo.number:new RegExp('\\b('+keys+')(?:[ -]+('+keys+'))?\\b','g'),(all,a,b)=>{
   const first=map[a];
   return b&&first>=20&&first<100&&first%10===0&&map[b]<10?String(first+map[b]):String(first)+(b?' '+map[b]:'');
  });
  text=text.replace(/\b(\d+(?:\.\d+)?)\s+hours?\s+and\s+(?:a\s+)?half\b/g,(_,n)=>String(Number(n)+.5)+' hours').replace(
   /\b(\d+)\s+quarters?\s+of\s+(?:an?|one|1)\s+hour\b/g,
   (_,n)=>String(Number(n)*15)+' minutes');
  text=text.replace(/\b(\d+(?:\.\d+)?)\s+and\s+(?:a\s+)?half\b/g,(_,n)=>String(Number(n)+.5)).replace(/\bfrom\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+(minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/g,'from $1 $3 to $2 $3').replace(/\b(?:more|extra|additional|less|fewer)\b/g,' ').replace(
   /\b(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)\b/g,
   (_,n)=>String(Number(n)/60)+' minutes');
  text=text.replace(/\b(\d+(?:\.\d+)?)\s+minutes?\s+and\s+(?:a\s+)?half\b/g,(_,n)=>String(Number(n)+.5)+' minutes');
  text=text.replace(/(?<![\d:])\b(\d{1,2}|half|quarter)\s+(past|to)\s+(\d{1,2})\b(?!:)/g,(all,m,d,h,index)=>{
   let minute=m==='half'?30:m==='quarter'?15:Number(m),hour=Number(h);
   const before=text.slice(Math.max(0,index-24),index);
   if(hour<1||hour>12||minute<=0||minute>=60||/\b(?:from|between)\s*$/.test(before)||/^\d+$/.test(m)&&d==='to'&&!/\bat\s*$/.test(before)&&minute<15)return all;
   if(d==='to'){hour=(hour+11)%12;minute=60-minute;}
   return 'at '+hour+':'+String(minute).padStart(2,'0');
  });
  text=text.replace(/\b(at|by|from|until|till|to)\s+(\d{1,2})\s+(\d{1,2})(?=\s*(?:[ap]m|tonight|today|tomorrow|in the|morning|evening|afternoon|and|then|for|$))/g,'$1 $2:$3');
  if(memo&&key.length<=2048&&text.length<=2048){if(memo.text.size>=128)memo.text.delete(memo.text.keys().next().value);memo.text.set(key,text);}
  return text;
 }
 function multilingual(input){
  const digit={'\u96f6':0,'\u4e00':1,'\u4e8c':2,'\u4e24':2,'\u4e09':3,'\u56db':4,'\u4e94':5,'\u516d':6,'\u4e03':7,'\u516b':8,'\u4e5d':9},
   chinese=v=>v.includes('\u5341')?(v[0]==='\u5341'?10:digit[v[0]]*10)+(v.endsWith('\u5341')?0:digit[v.at(-1)]):Number.isFinite(Number(v))?Number(v):digit[v];
  return input.replace(/[\u96f6\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+/g,v=>String(chinese(v))).replace(/\u8fc7(\d+)\u5206\u949f/g,'in $1 minutes ').replace(
   /\u660e\u65e9(\d+)\u70b9(\d+)?\u5206?/g,
   (_,h,m)=>'tomorrow at '+h+':'+String(m||0).padStart(2,'0')+' ').replace(
   /\u63d0\u9192\u6211[\uff1a:]?/g,
   'remind me: ').replace(
   /\b(?:tmrw|tmr|2moro)\b/g,
   'tomorrow').replace(
   /\b(?:tn|tnite|tonite)\b/g,
   'tonight').replace(
   /\b(\d{1,2})ish\b/g,
   '$1').replace(
   /\b(\d{1,2})\s+h\s*(\d{2})\b/g,
   '$1:$2').replace(
   /\b(?:ma\u00f1ana|manana|demain)\b/g,
   'tomorrow').replace(
   /\b(?:hoy|aujourd.hui)\b/g,
   'today').replace(
   /\b(?:ce soir|esta noche)\b/g,
   'tonight').replace(
   /\b(?:dans|en)\s+(?=\d)/g,
   'in ').replace(
   /\ba las\s+(?=\d|[a-z]+\b)/g,
   'at ').replace(
   /\bminutos?\b/g,
   'minutes').replace(
   /\bhoras?\b/g,
   'hours').replace(
   /\bsegundos?\b/g,
   'seconds').replace(
   /\bde\s+([a-z]+|\d{1,2})\s+a\s+([a-z]+|\d{1,2})\s+de la tarde\b/g,
   'from $1 pm to $2 pm').replace(
   /\b(?:un|an?)\s+hour\s+and\s+(?:a\s+)?quarter\b/g,
   '75 minutes');
 }
 function slots(input,s={},data={}){
  const Parse=root.ReserveBiscuitParse||(typeof module==='object'&&module.exports?require('./biscuit-parse.js'):null),text=normalize(input,data),out=Parse.slots(text,s);
  if(out.startMinute!==undefined)out.minute=out.startMinute;
  return out;
 }
 function quantities(input,data={}){
  const text=normalize(input,data),out=[];
  for(const m of text.matchAll(/(?<![\p{L}\p{N}.])([+\-]?\s*(?:\d+(?:\.\d+)?|\.\d+))\s*-?\s*(minutes?|mins?|m|hours?|hrs?|h|seconds?|secs?|s)\b/gu)){
   if(/\b(?:not|instead of|rather than)\s*$/.test(text.slice(Math.max(0,m.index-40),m.index)))continue;
   const factor=/^h/.test(m[2])?60:/^s/.test(m[2])?1/60:1,minutes=Number(m[1].replace(/\s/g,''))*factor,previous=out.at(-1),end=m.index+m[0].length;
   if(previous&&factor<previous.factor&&previous.minutes>=0&&minutes>=0&&/^\s*(?:and\s*)?$/.test(text.slice(previous.end,m.index))){
    previous.minutes+=minutes;
    previous.end=end;
    previous.factor=factor;
   }
   else out.push({minutes,index:m.index,end,factor});
  }
  return out;
 }
 function fieldQuantity(input,role){
  const text=normalize(input),
   all=quantities(text),
   patterns={timer:/\b(?:add|extend|shorten|subtract|reduce|cut|set|reset|remaining)\b/gi,focus:/\bfocus\b|\bconcentration\b|\bconcentrate\b|专注/gi,reminder:/\b(?:remind(?:er)?|warn(?:ing)?|alert|ping|rappel|aviso)\b|提醒/gi,duration:/\b(?:length|duration|duree|working|estimate)\b|时长/gi},
   pattern=patterns[role];
  if(!pattern)return null;
  const hits=[];
  for(const m of text.matchAll(pattern))
   for(const value of all){
    const forward=value.index>=m.index+m[0].length,
     between=forward?text.slice(m.index+m[0].length,value.index):text.slice(value.end,m.index),
     clean=between.replace(/\b(?:for|of|de|to|is|be|become|should|now|a|an|the|me|in|exactly)\b/gi,'').replace(/[\s:,-]/g,'');
    if(clean&&!(role==='reminder'&&!forward&&/^(?:advance|early|prior)$/i.test(clean)))continue;
    hits.push({...value,distance:between.length,forward});
   }
  hits.sort((a,b)=>a.distance-b.distance||Number(b.forward)-Number(a.forward));
  if(hits.length)return hits[0];
  if(role==='duration'){const m=/\b(?:duration|length|duree)\s*[:=]?\s*(\d+(?:\.\d+)?)\b/i.exec(text);if(m)return {minutes:Number(m[1]),index:m.index,end:m.index+m[0].length};}
  return null;
 }
 const api={numbers,normalize,slots,quantities,fieldQuantity};root.ReserveBiscuitValues=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
