'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Kind=require('../extension/study-kind.js');
const item={id:'authored-work',kind:'assignment',title:'Habitat observations',instructions:'Write an evidence-based account of the habitat.'};
test('notes is a supported remembered Help correction for the same work',()=>{const result=Kind.inferHelp({item,preference:{shape:'notes',itemId:item.id}});assert.equal(result.shape,'notes');assert.ok(result.sources.includes('preference'));});
test('a notes preference cannot survive cancellation or override an explicit new Help request',()=>{assert.notEqual(Kind.inferHelp({item,preference:'notes',typed:'Actually no'}).shape,'notes');assert.equal(Kind.inferHelp({item,preference:'notes',typed:'Quiz me on this habitat.'}).shape,'practice');});
test('a stored notes correction for another item is not applied here',()=>{assert.notEqual(Kind.inferHelp({item,preference:{shape:'notes',itemId:'other-authored-work'}}).shape,'notes');});
