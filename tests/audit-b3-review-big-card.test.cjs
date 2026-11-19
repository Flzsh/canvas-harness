'use strict';
// Audit B3 (2026-11-14): the Review deck's "Big card" choice is saved with the deck (review-deck.js rememberBig,
// review-deck-model.js cleanDeck keeps settings.bigCard === true), but the account cleaner in storage.js rebuilt the
// deck's settings from the two daily limits only, so the choice was gone after the save and after every reload.
const test=require('node:test'),assert=require('node:assert/strict'),{createStore,validateBackup}=require('../extension/storage.js'),M=require('../extension/review-deck-model.js');
const origin='https://school.instructure.com';
function memory(){const saved=new Map();return {saved,adapter:{read:async k=>structuredClone(saved.get(k)),write:async(k,v)=>saved.set(k,structuredClone(v))}};}

test('Big card survives the account save and a reload',async()=>{
 const {adapter}=memory(),store=createStore({origin,accountId:'7',adapter});await store.load();
 await store.update(data=>{const next=M.cleanDeck(data.settings?.reviewDecks);next.settings.bigCard=true;data.settings.reviewDecks=M.cleanDeck(next);});
 assert.equal(store.get().settings.reviewDecks.settings.bigCard,true,'kept right after the save');
 const again=createStore({origin,accountId:'7',adapter});await again.load();
 assert.equal(again.get().settings.reviewDecks.settings.bigCard,true,'kept after a reload');
 await again.update(data=>{delete data.settings.reviewDecks.settings.bigCard;});
 assert.equal('bigCard' in again.get().settings.reviewDecks.settings,false,'turning it off leaves no trace');
});

test('a backup keeps Big card only as true, like the deck model',()=>{
 for(const [value,kept] of [[true,true],[false,false],['true',false],[1,false]]){
  const data=validateBackup({format:'reserve-backup',version:1,data:{settings:{reviewDecks:{settings:{newPerDay:12,bigCard:value}}}}});
  assert.equal(data.settings.reviewDecks.settings.bigCard===true,kept,JSON.stringify(value));
  assert.equal(data.settings.reviewDecks.settings.newPerDay,12);
 }
});
