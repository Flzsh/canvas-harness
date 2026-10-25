#!/usr/bin/env node
'use strict';
/* Offline benchmark tooling. No test runner, network, providers or new deps. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { ACTIONS, normalizeAction, kindToken, pipelineLabels, convertFixture, compoundVariants, expectedVariants, inferenceSession } = require('./biscuit-labels.cjs');
const {isDeepStrictEqual:equal}=require('node:util');
const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/biscuit-situations.json');
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const copy = value => JSON.parse(JSON.stringify(value));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const percent = (n, total) => total ? Math.round(n / total * 10000) / 100 : null;
function merge(base, patch) {
  const result = { ...object(base) };
  for (const [key, value] of Object.entries(object(patch))) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe world key');
    result[key] = value && typeof value === 'object' && !Array.isArray(value) ? merge(result[key], value) : value;
  }
  return result;
}
function resolveWorld(data, row, options={}) {
  const ref = row.world;
  let snapshot;
  if (typeof ref === 'string') snapshot = data.worlds[ref];
  else if (ref?.base) snapshot = merge(data.worlds[ref.base], ref.patch);
  else snapshot = ref;
  if (!snapshot || !object(snapshot).timeZone) throw new Error('Missing serialized world for selected row');
  const moment = object(row.moment);
  snapshot = merge(snapshot, moment.snapshot || {});
  for (const key of ['now', 'timeZone', 'view', 'activeCourseId', 'selectedItemId', 'pathname']) if (moment[key] !== undefined) snapshot[key] = moment[key];
  if (!Number.isFinite(snapshot.now)) throw new Error('Selected row has no numeric clock');
  return options.copy===false?snapshot:copy(snapshot);
}

function targetOf(row, fields) {
  return fields.itemId ?? fields.courseId ?? row.itemId ?? row.courseId ?? row.id;
}
function candidates(raw) {
  if (raw === null || raw === undefined || raw === false) return [];
  const value = object(raw);
  const next = object(executableLead(value));
  const rawItems = Array.isArray(value.items) ? value.items : Array.isArray(raw) ? raw : [];
  const defaultAction = next.action || value.action || value.intent;
  function one(row, fallback) {
    row = object(row);
    const fields = object(row.fields || row.data);
    const itemId = targetOf(row, fields);
    return { action: normalizeAction(row.action || row.intent || fallback), ...(itemId === undefined ? {} : { itemId: String(itemId) }) };
  }
  const ranked = rawItems.map(row => one(row, value.action || defaultAction));
  // next is authoritative for the action the assistant proposes to execute.
  if (Object.keys(next).length) {
    const lead = one(next, defaultAction);
    if (lead.itemId === undefined && ranked.length) lead.itemId = ranked[0].itemId;
    ranked.unshift(lead);
  } else if (!ranked.length && (value.action || value.intent)) ranked.push(one(value, defaultAction));
  const unique = [];
  const seen = new Set();
  for (const candidate of ranked) {
    const key = JSON.stringify(candidate);
    if (!seen.has(key)) { seen.add(key); unique.push(candidate); }
  }
  return unique;
}
function alternatives(expected) {
  return [expected, ...(expected.alternatives || [])].map(value => ({ ...(value.action === undefined ? {} : { action: normalizeAction(value.action) }), ...(value.itemId === undefined ? {} : { itemId: String(value.itemId) }) }));
}
function matches(actual, expected) {
  const candidate = actual || { action: 'none' };
  return alternatives(expected).some(wanted => (wanted.action === undefined || wanted.action === candidate.action) && (wanted.itemId === undefined || wanted.itemId === candidate.itemId));
}
function allowsAction(expected, action) { return alternatives(expected).some(value => value.action === action || value.action === undefined); }
const list = value => Array.isArray(value) ? value : [];
/* Independent pipeline labels may be on expected or the row; duplicate declarations must agree.
 * route: 'local'|'ai'. context: an exact set of nonempty string item ids, including [].
 * help: null|'none' for no sent help; 'ask' for custom questions; a study-kind token for build;
 * an array of plausible kind tokens accepts one matching kind with its proper ask/build mode.
 * Objects: {kind,mode?}, {plausibleKinds:[tokens],mode?}, or {mode:'choice',kind?:null,kinds:[tokens]}.
 * {kinds:[tokens]} also means choice. Choice sets match exactly; plausible arrays never mean choice.
 * {mode:'ask',kind?:'ask',kinds?:[]} and {kind:null} are explicit ask/no-help forms.
 * Unknown keys, empty alternatives, malformed/conflicting labels and impossible local sends reject.
 * Missing labels stay ineligible; never infer them from engine actions or a local .ai offer.
 */
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const sameSet = (a, b) => a.length === b.length && a.every(value => b.includes(value));
function observedPipeline(result, failed) {
  const route = !failed && ['local', 'ai'].includes(result?.route) ? result.route : null;
  const routingValid = !!route && (!owns(result, 'routing') || record(result.routing) && result.routing.route === route);
  if (route !== 'ai') return { route, routingValid, context: [], contextValid: route === 'local', help: null, helpValid: route === 'local' };
  const handoffs = [result.handoff, result.next?.fields?.handoff].filter(value => value !== undefined);
  let contextValid = !!handoffs.length, helpValid = !!handoffs.length;
  const context = new Set(), contexts = [], helps = [];
  for (const handoff of handoffs) {
    if (!record(handoff)) { contextValid = helpValid = false; continue; }
    const ids = Array.isArray(handoff.contextIds) ? handoff.contextIds : [], sources = Array.isArray(handoff.sources) ? handoff.sources : [];
    const validIds = ids.filter(value => typeof value === 'string' && !!value.trim()), sourceIds = sources.filter(value => record(value) && typeof value.id === 'string' && !!value.id.trim()).map(value => value.id);
    for (const id of [...validIds, ...sourceIds]) context.add(id);
    if (!Array.isArray(handoff.contextIds) || !Array.isArray(handoff.sources) || ids.length !== validIds.length || sources.length !== sourceIds.length || sources.some(value => typeof value?.label !== 'string' || typeof value?.text !== 'string') || !sameSet([...new Set(validIds)], [...new Set(sourceIds)])) contextValid = false;
    contexts.push([...new Set([...validIds, ...sourceIds])]);
    const { mode, kind, kinds } = handoff;
    const validKinds = Array.isArray(kinds) && kinds.every(kindToken) && new Set(kinds).size === kinds.length;
    const valid = validKinds && (mode === 'ask' && kind === 'ask' || mode === 'build' && kindToken(kind) && kind !== 'ask' || mode === 'choice' && kind === null && kinds.length > 0 && !kinds.includes('ask'));
    if (!valid) helpValid = false;
    helps.push({ mode, kind, kinds: validKinds ? [...kinds].sort() : [] });
  }
  if (contexts.length > 1 && !contexts.every(value => sameSet(value, contexts[0]))) contextValid = false;
  if (helps.length > 1 && !helps.every(value => JSON.stringify(value) === JSON.stringify(helps[0]))) helpValid = false;
  return { route, routingValid, context: [...context], contextValid, help: helps[0] || null, helpValid };
}
function scorePipeline(labels, result, failed = false) {
  const actual = observedPipeline(result, failed), routing = { eligible: owns(labels, 'route'), correct: null }, context = { eligible: owns(labels, 'context'), truePositives: 0, falsePositives: 0, falseNegatives: 0, valid: null, exact: null, precisionPct: null, recallPct: null }, kind = { eligible: owns(labels, 'help'), aiEligible: owns(labels, 'help') && labels.help.mode !== null, correct: null };
  if (routing.eligible) routing.correct = actual.routingValid && actual.route === labels.route;
  if (context.eligible) {
    context.truePositives = actual.context.filter(id => labels.context.includes(id)).length;
    context.falsePositives = actual.context.length - context.truePositives; context.falseNegatives = labels.context.length - context.truePositives;
    context.valid = !failed && actual.contextValid; context.exact = context.valid && !context.falsePositives && !context.falseNegatives;
    context.precisionPct = percent(context.truePositives, context.truePositives + context.falsePositives); context.recallPct = percent(context.truePositives, context.truePositives + context.falseNegatives);
  }
  if (kind.eligible) {
    const wanted = labels.help, sent = actual.help;
    kind.correct = !failed && actual.helpValid && (wanted.mode === null ? actual.route === 'local' : actual.route === 'ai' && !!sent && (wanted.mode === 'choice' ? sent.mode === 'choice' && sent.kind === null && sameSet(sent.kinds, wanted.kinds) : wanted.kinds.includes(sent.kind) && sent.mode === (sent.kind === 'ask' ? 'ask' : 'build')));
  }
  return { routing, context, kind };
}
function partialDeep(actual, expected) {
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => owns(actual, index) && partialDeep(actual[index], value));
  if (record(expected)) return record(actual) && Object.entries(expected).every(([key, value]) => owns(actual, key) && partialDeep(actual[key], value));
  return Object.is(actual, expected);
}
function alternativeFields(base, patch) {
  if (!record(base) || !record(patch)) return patch;
  return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(patch)])].map(key => [key, owns(patch, key) ? alternativeFields(base[key], patch[key]) : base[key]]));
}
function scoreFields(expected, result, failed = false) {
  const variants = [expected, ...(expected.alternatives || []).map(value => ({ ...expected, ...value, ...(owns(expected, 'fields') && owns(value, 'fields') ? { fields: alternativeFields(expected.fields, value.fields) } : {}) }))];
  const labeled = variants.filter(value => owns(value, 'fields')), eligible = labeled.length > 0;
  if (!eligible) return { eligible: false, correct: null };
  const next = executableLead(result);
  const lead = candidates(result)[0];
  const correct = !failed && record(next) && owns(next, 'fields') && record(next.fields) && labeled.some(value => matches(lead, { ...value, alternatives: [] }) && partialDeep(next.fields, value.fields));
  return { eligible: true, correct: !!correct };
}
/* Executable sequences come only from runtime steps/actions/operations/requests. Ranked cards are never steps. */
function executableLead(result){
 if(['actions','operations','requests'].some(key=>owns(result||{},key))){const observed=observedActions(result);if(observed.valid&&observed.steps.length)return observed.steps[0].next;}
 const next=result?.next;return next?.action==='batch'?next.fields?.steps?.[0]:next;
}
function observedActions(result){
 const sources=[];let valid=record(result);
 function atom(value){
  if(!record(value))return null;
  const next=record(value.next)?value.next:value,action=normalizeAction(next.action);
  if(typeof next.action!=='string'||!ACTIONS.includes(action)||owns(next,'fields')&&!record(next.fields))return null;
  return {...value,action,items:[],next:{...next,action}};
 }
 function sequence(values){if(!Array.isArray(values)||!values.length)return null;const steps=values.map(atom);return steps.every(Boolean)?steps:null;}
 const next=result?.next;
 if(next?.action==='batch')sources.push(sequence(next.fields?.steps));
 for(const key of ['actions','operations','requests'])if(owns(result||{},key))sources.push(sequence(result[key]));
 if(!sources.length){const step=atom(record(next)?{...result,next}:result);return {valid:!!step,explicit:false,steps:step?[step]:[]};}
 if(sources.some(value=>!value))valid=false;
 const steps=sources.find(Boolean)||[],signature=values=>values.map(value=>({action:value.next.action,fields:value.next.fields,itemId:targetOf(value.next,object(value.next.fields))}));
 for(const values of sources.filter(Boolean))if(!equal(signature(values),signature(steps)))valid=false;
 if(record(next)&&next.action!=='batch'){
  const lead=atom({...result,next});if(!lead||!equal(signature([lead]),signature(steps.slice(0,1))))valid=false;
 }
 const requests=Array.isArray(result?.requests)?sequence(result.requests):null;
 return {valid,explicit:true,steps:steps.map((step,index)=>requests?.[index]?{...requests[index],next:step.next}:step)};
}
function matchOperations(matrix,key,ordered){
 if(ordered)return matrix.map((row,index)=>row[index]?.[key]?index:null);
 const owners=new Map();
 function assign(index,seen){for(let actual=0;actual<(matrix[index]?.length||0);actual++){if(!matrix[index][actual][key]||seen.has(actual))continue;seen.add(actual);if(!owners.has(actual)||assign(owners.get(actual),seen)){owners.set(actual,index);return true;}}return false;}
 for(let index=0;index<matrix.length;index++)assign(index,new Set());
 const matched=new Map([...owners].map(([actual,index])=>[index,actual]));return matrix.map((_,index)=>matched.has(index)?matched.get(index):null);
}
function scoreCompound(expected,result,failed=false){
 const variants=compoundVariants(expected);if(!variants)return {eligible:false,correct:null};
 const observed=observedActions(result),scores=variants.map((variant,variantIndex)=>{
  const matrix=variant.actions.map(wanted=>observed.steps.map(actual=>{
   const next=actual.next,lead={action:normalizeAction(next.action),...(targetOf(next,object(next.fields))===undefined?{}:{itemId:String(targetOf(next,object(next.fields)))})},choices=expectedVariants(wanted);
   const action=choices.some(value=>value.action===undefined||normalizeAction(value.action)===lead.action),ranking=choices.some(value=>matches(lead,{...value,alternatives:[]})),fields=scoreFields(wanted,actual,failed);
   const complete=choices.some(value=>{const p=scorePipeline(pipelineLabels({expected:value}),actual,failed),f=scoreFields(value,actual,failed);return matches(lead,{...value,alternatives:[]})&&(!f.eligible||f.correct)&&(!p.routing.eligible||p.routing.correct)&&(!p.context.eligible||p.context.exact)&&(!p.kind.eligible||p.kind.correct);});
   return {action,ranking,fields:ranking&&(!fields.eligible||fields.correct),complete};
  })),matched=Object.fromEntries(['action','ranking','fields','complete'].map(key=>[key,matchOperations(matrix,key,variant.ordered!==false)])),valid=!failed&&observed.valid&&observed.steps.length===variant.actions.length;
  return {eligible:true,variantIndex,required:variant.actions.length,observed:observed.steps.length,valid:!failed&&observed.valid,actionCorrect:valid&&matched.action.every(value=>value!==null),rankingCorrect:valid&&matched.ranking.every(value=>value!==null),fieldsEligible:variant.actions.some(value=>expectedVariants(value).some(choice=>owns(choice,'fields'))),fieldsCorrect:valid&&matched.fields.every(value=>value!==null),correct:valid&&matched.complete.every(value=>value!==null),matched:!failed&&observed.valid?matched.complete.filter(value=>value!==null).length:0,perAction:matched.complete.map((actualIndex,index)=>({action:index+1,observedIndex:actualIndex??matched.ranking[index]??matched.action[index],correct:!failed&&observed.valid&&actualIndex!==null}))};
 });
 return scores.find(value=>value.correct)||scores.sort((a,b)=>Number(b.rankingCorrect)-Number(a.rankingCorrect)||b.matched-a.matched)[0];
}
/* Fields are independent of top-K and inspect only the actual executable next.fields. */
function pipelineCounts() { return { action: { eligible: 0, correct: 0 }, fields: { eligible: 0, correct: 0 }, ranking: { eligible: 0, top1: 0, top3: 0, targetErrors: 0 }, routing: { eligible: 0, correct: 0 }, context: { eligible: 0, truePositives: 0, falsePositives: 0, falseNegatives: 0, exact: 0, invalid: 0 }, kind: { eligible: 0, correct: 0, aiEligible: 0, aiCorrect: 0 } }; }
function addPipeline(group, scored) {
  for (const step of ['action', 'fields', 'routing', 'kind']) if (scored[step]?.eligible) { group[step].eligible++; if (scored[step].correct) group[step].correct++; }
  if (scored.kind.aiEligible) { group.kind.aiEligible++; if (scored.kind.correct) group.kind.aiCorrect++; }
  if (scored.ranking?.eligible) { group.ranking.eligible++; if (scored.ranking.top1) group.ranking.top1++; if (scored.ranking.top3) group.ranking.top3++; if (scored.ranking.targetError) group.ranking.targetErrors++; }
  if (scored.context.eligible) {
    group.context.eligible++;
    for (const key of ['truePositives', 'falsePositives', 'falseNegatives']) group.context[key] += scored.context[key];
    if (scored.context.exact) group.context.exact++; if (!scored.context.valid) group.context.invalid++;
  }
}
function finishPipeline(group) {
  for (const step of ['action', 'fields', 'routing', 'kind']) group[step].accuracyPct = percent(group[step].correct, group[step].eligible);
  for (const key of ['top1', 'top3']) group.ranking[key + 'Pct'] = percent(group.ranking[key], group.ranking.eligible);
  group.kind.aiAccuracyPct = percent(group.kind.aiCorrect, group.kind.aiEligible);
  const context = group.context;
  context.precisionPct = percent(context.truePositives, context.truePositives + context.falsePositives); context.recallPct = percent(context.truePositives, context.truePositives + context.falseNegatives); context.exactPct = percent(context.exact, context.eligible);
  return group;
}
const REPLY_STOP = new Set('a an the my me i you your our is are was were be been of to for in on at by from with about and or as it that this these those here there please can could would will do does did have has had get got task work assignment course class file instructions feedback comment comments teacher points'.split(' '));
const REPLY_WORDS = { mon: 'monday', tue: 'tuesday', tues: 'tuesday', wed: 'wednesday', thu: 'thursday', thurs: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday', tmr: 'tomorrow', tmrw: 'tomorrow', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
const replyTokens = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/<[^>]*>/g, ' ').replace(/\b(?:don't|doesn't|isn't|aren't|can't)\b/gi, ' not ').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.map(word => REPLY_WORDS[word] || word.replace(/^0+(?=\d)/, '')) || [];
const hasPhrase = (message, phrase) => { const wanted = replyTokens(phrase).join(' '); return !!wanted && (' ' + replyTokens(message).join(' ') + ' ').includes(' ' + wanted + ' '); };
function factRule(source, line = '', title = '', identity = false) {
  const label = new Set(replyTokens(title)), query = new Set(replyTokens(line));
  const terms = [...new Set(replyTokens(source).filter(word => !REPLY_STOP.has(word) && (identity || !label.has(word))))];
  if (!terms.length) return null;
  const fresh = terms.filter(word => !query.has(word)), numbers = terms.filter(word => /^\d+$/.test(word));
  return message => {
    const actual = new Set(replyTokens(message)), hits = terms.filter(word => actual.has(word)).length;
    return hits >= Math.min(terms.length, Math.max(2, Math.ceil(terms.length * (identity ? .7 : .5)))) && (identity || fresh.filter(word => actual.has(word)).length >= Math.min(2, fresh.length)) && (!numbers.length || (identity ? numbers.every(word => actual.has(word)) : numbers.some(word => actual.has(word)))) && (!terms.some(word => ['no', 'not', 'never', 'without'].includes(word)) || ['no', 'not', 'never', 'without'].some(word => actual.has(word)));
  };
}
function entities(snapshot) {
  const result = [], seen = new Set();
  for (const [key, kind] of [['workItems', 'assignment'], ['assignments', 'assignment'], ['personalTasks', 'assignment'], ['tasks', 'assignment'], ['teachers', 'teacher'], ['courses', 'course'], ['announcements', 'announcement'], ['grades', 'grade'], ['files', 'file'], ['materials', 'file'], ['notes', 'note'], ['bookmarks', 'bookmark']]) {
    for (const row of list(snapshot[key])) {
      if (!row || row.id === undefined || row.id === null || seen.has(kind + ':' + row.id)) continue;
      seen.add(kind + ':' + row.id); result.push({ ...row, id: String(row.id), entityKind: kind });
    }
  }
  return result;
}
const titleOf = row => row.title || row.name || '';
const dueQuery = line => /\bdue\b|\boverdue\b|\b(?:late|missing)\s+(?:work|tasks?|assignments?|homework)\b/i.test(line);
const question = line => /^(?:what|which|who|where|when|how|is|are|do|does|did|can|could|have|has)\b/i.test(line.trim()) || /\?\s*$/.test(line);
const hoursQuery = line => /\boffice\s+hours\b|\bwhen\b.*\b(?:available|ask|meet)\b|\bavailability\b/i.test(line);
function categoryOf(row, targets) {
  const tags = new Set(list(row.tags)), action = normalizeAction(row.expected.action);
  if (action === 'plan') return 'plan';
  if (dueQuery(row.line)) return 'due';
  if (['feedback', 'teacher-feedback', 'grade-feedback'].some(tag => tags.has(tag)) || targets[0]?.entityKind === 'grade' && /\b(?:feedback|comment|marks?|wrong|say|change)\b/i.test(row.line)) return 'feedback';
  if (tags.has('grades') || targets[0]?.entityKind === 'grade') return 'grades';
  if (tags.has('announcement') || targets[0]?.entityKind === 'announcement') return 'announcement';
  if (hoursQuery(row.line) && targets.some(target => target.entityKind === 'teacher' || target.entityKind === 'course')) return 'office-hours';
  if (tags.has('teacher') || targets[0]?.entityKind === 'teacher') return 'teacher';
  if (tags.has('instructions') || targets[0]?.entityKind === 'assignment' && question(row.line)) return 'instructions';
  return action === 'open/find' ? 'retrieval' : ACTIONS.includes(action) ? action : 'item-only';
}
function windowsOf(line) {
  const words = new Set(replyTokens(line)), windows = [];
  for (const word of ['today', 'tonight', 'tomorrow', 'weekend', 'week', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'morning', 'afternoon', 'evening']) if (words.has(word)) windows.push(word === 'tonight' ? ['tonight', 'this evening'] : [word]);
  const date = /\b\d{4}-\d{2}-\d{2}\b/.exec(line); if (date) windows.push([date[0]]);
  return windows;
}
const coversWindows = (message, windows) => windows.every(choices => choices.some(value => hasPhrase(message, value)));
function durationsOf(line) {
  const normalized = replyTokens(line.replace(/(\d)\.(\d)/g, '$1decimal$2')).join(' ');
  return [...normalized.matchAll(/\b(\d+(?:decimal\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/g)].map(match => Number(match[1].replace('decimal', '.')) * (/^h/.test(match[2]) ? 60 : 1));
}
function localParts(value, snapshot) {
  const at = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(at)) return null;
  try { return Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: snapshot.timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at).map(part => [part.type, part.value])); } catch (_) { return null; }
}
const calendarDay = parts => parts ? Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86400000 : NaN;
function dateRule(value, snapshot) {
  const parts = localParts(value, snapshot), now = localParts(snapshot.now, snapshot);
  if (!parts || !now) return () => false;
  const month = new Date(Date.UTC(2000, Number(parts.month) - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }), delta = calendarDay(parts) - calendarDay(now), hour = Number(parts.hour), minute = Number(parts.minute), suffix = hour < 12 ? 'am' : 'pm';
  const dates = [parts.year + '-' + parts.month + '-' + parts.day, parts.month + '/' + parts.day, month + ' ' + parts.day, month.slice(0, 3) + ' ' + parts.day, parts.day + ' ' + month, parts.day + ' ' + month.slice(0, 3)];
  if (delta === 0) dates.push('today', 'tonight'); if (delta === 1) dates.push('tomorrow'); if (delta >= 0 && delta < 7) dates.push(parts.weekday);
  const clocks = [hour + ':' + parts.minute, (hour % 12 || 12) + ':' + parts.minute + ' ' + suffix];
  if (!minute) clocks.push((hour % 12 || 12) + ' ' + suffix, ...(hour === 12 ? ['noon'] : hour === 0 ? ['midnight'] : []));
  return message => dates.some(date => hasPhrase(message, date)) && clocks.some(clock => hasPhrase(message, clock));
}
function pendingWork(snapshot, rows) {
  return rows.filter(row => row.entityKind === 'assignment' && !row.done && !row.completed && !snapshot.local?.[row.id]?.checkedOff && snapshot.local?.[row.id]?.progress !== 'done');
}
function dueWork(line, snapshot, rows) {
  const now = calendarDay(localParts(snapshot.now, snapshot)), words = new Set(replyTokens(line)), weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let start = now, end = now;
  const weekday = weekdays.find(day => words.has(day)), exact = /\b\d{4}-\d{2}-\d{2}\b/.exec(line);
  if (exact) start = end = Date.parse(exact[0] + 'T00:00:00Z') / 86400000;
  else if (words.has('tomorrow')) start = end = now + 1;
  else if (weekday) start = end = now + (weekdays.indexOf(weekday) - new Date(now * 86400000).getUTCDay() + 7) % 7;
  else if (words.has('week') || words.has('weekend')) { const monday = now - (new Date(now * 86400000).getUTCDay() + 6) % 7; start = words.has('weekend') ? monday + 5 : now; end = monday + 6; }
  const course = rows.find(row => row.entityKind === 'course' && [titleOf(row), row.shortName, row.course_code].some(name => name && hasPhrase(line, name)));
  const courseId = course?.id ?? (/\bthis\s+(?:course|class)\b/i.test(line) ? snapshot.activeCourseId : undefined);
  return pendingWork(snapshot, rows).filter(row => {
    if (courseId !== undefined && String(row.courseId) !== String(courseId)) return false;
    const at = typeof (row.dueAt ?? row.due_at) === 'number' ? row.dueAt ?? row.due_at : Date.parse(row.dueAt ?? row.due_at), day = calendarDay(localParts(at, snapshot));
    return /\boverdue\b|\b(?:late|missing)\b/i.test(line) ? row.missing || at < snapshot.now : day >= start && day <= end;
  });
}
function planBlocks(message, titles, allTitles = titles) {
  const blocks = message.split(/[;\n]|,(?!\d)|\.\s+/).map(part => {
    const named = titles.some(check => check(part)), grounded = allTitles.some(check => check(part)), rest = /\b(?:break|rest)\b/i.test(part), durations = durationsOf(part);
    if (!durations.length) for (const match of part.matchAll(/\b(\d{1,2}):(\d{2})\s*(?:-|\u2013|\u2014|to)\s*(\d{1,2}):(\d{2})\b/g)) {
      const [start, end] = [Number(match[1]) * 60 + Number(match[2]), Number(match[3]) * 60 + Number(match[4])];
      if (Number(match[1]) < 24 && Number(match[3]) < 24 && Number(match[2]) < 60 && Number(match[4]) < 60 && end > start) durations.push(end - start);
    }
    return { named, durations: grounded || rest ? durations.filter(value => value > 0) : [] };
  });
  const minutes = blocks.flatMap(block => block.durations);
  return { named: blocks.some(block => block.named && block.durations.length), total: minutes.reduce((sum, value) => sum + value, 0) };
}
function planWindows(message, windows, snapshot) {
  if (coversWindows(message, windows)) return true;
  const actual = windowsOf(message), clocks = [...message.matchAll(/\b(\d{1,2}):(\d{2})\b/g)].filter(match => Number(match[1]) < 24 && Number(match[2]) < 60);
  if (!clocks.length) return false;
  const local = localParts(snapshot.now, snapshot), today = calendarDay(local);
  if (!local) return false;
  const requested = windows.map(choices => choices[0]), tomorrow = requested.includes('tomorrow'), current = requested.some(value => ['today', 'tonight'].includes(value));
  const expectedDay = today + (tomorrow ? 1 : 0), date = new Date(expectedDay * 86400000), iso = date.toISOString().slice(0, 10), day = date.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const dated = hasPhrase(message, iso) || hasPhrase(message, day);
  const conflicting = actual.some(choices => !requested.includes(choices[0]) && ![iso, day.toLowerCase()].includes(choices[0]));
  if (conflicting) return false;
  if (tomorrow && dated) return requested.filter(value => value !== 'tomorrow').every(value => hasPhrase(message, value));
  return current && !requested.some(value => !['today', 'tonight'].includes(value)) && (dated || !actual.length);
}
function automaticReplyExpectation(row, snapshot) {
  const rows = entities(snapshot), targets = alternatives(row.expected).flatMap(wanted => rows.filter(entity => entity.id === wanted.itemId)), category = categoryOf(row, targets), windows = windowsOf(row.line);
  if (category === 'plan') {
    const pending = pendingWork(snapshot, rows), selected = targets.length ? pending.filter(work => targets.some(target => target.entityKind === 'course' ? String(work.courseId) === target.id : work.id === target.id)) : pending;
    const titles = selected.map(target => factRule(titleOf(target), '', '', true)).filter(Boolean), allTitles = pending.map(target => factRule(titleOf(target), '', '', true)).filter(Boolean), requested = durationsOf(row.line), budget = /\b(?:have|available|free|budget|within|up to)\b/i.test(row.line);
    return { category, test: message => {
      const blocks = planBlocks(message, titles, allTitles), empty = !targets.length && !pending.length && /\b(?:no|nothing)\b.*\b(?:unfinished|pending|work|tasks?|assignments?)\b.*\bplan\b/i.test(message);
      return planWindows(message, windows, snapshot) && (empty || blocks.named && requested.every(value => budget ? blocks.total <= value : Math.abs(blocks.total - value) < .01));
    } };
  }
  if (category === 'due') {
    const due = targets.length ? targets : dueWork(row.line, snapshot, rows), checks = due.map(target => ({ title: factRule(titleOf(target), '', '', true), date: dateRule(target.dueAt ?? target.due_at, snapshot) }));
    return { category, test: message => checks.length ? checks.some(check => check.title?.(message) && (/\bwhen\b|\bwhat\s+(?:time|date)\b/i.test(row.line) ? check.date(message) : coversWindows(message, windows))) : /\b(?:nothing|none)\b.*\bdue\b|\bno\b.*\b(?:work|tasks?|assignments?|homework)\b.*\bdue\b/i.test(message) && coversWindows(message, windows) };
  }
  if (allowsAction(row.expected, 'none') || allowsAction(row.expected, 'ai')) return { category, test: null };
  const checks = [];
  for (const target of targets) {
    const title = titleOf(target), kind = target.entityKind;
    let check;
    if ((kind === 'teacher' || kind === 'course') && hoursQuery(row.line)) {
      const hours = target.officeHours || rows.find(value => value.entityKind === 'teacher' && value.courseId === (kind === 'course' ? target.id : target.courseId))?.officeHours;
      const detail = factRule(hours, row.line, title), exact = replyTokens(hours).filter(word => /^\d+$/.test(word) || /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/.test(word));
      if (detail) check = message => detail(message) && exact.every(word => replyTokens(message).includes(word));
    } else if ((kind === 'teacher' || kind === 'course') && question(row.line) && (category === 'teacher' || /\b(?:who|teaches|teacher|runs)\b/i.test(row.line))) {
      const names = kind === 'teacher' ? [target.name || title] : [target.teacher || target.teacherName, ...list(target.teachers).map(value => typeof value === 'string' ? value : value.name)];
      const namesOnly = names.filter(Boolean).map(name => factRule(String(name).replace(/\b(?:dr|mr|mrs|ms|professor)\b\.?\s*/gi, ''), '', '', true)).filter(Boolean);
      if (namesOnly.length) check = message => namesOnly.some(test => test(message));
    } else if (kind === 'grade' && category === 'feedback') check = factRule(target.feedback || target.teacherComments || target.comments, row.line, title);
    else if (kind === 'grade' && question(row.line)) {
      const score = target.score ?? target.value ?? target.grade ?? target.points, possible = target.possible ?? target.pointsPossible;
      if (score !== undefined && score !== null && String(score).trim()) check = message => possible === undefined || possible === null ? hasPhrase(message, score) : [score + '/' + possible, score + ' of ' + possible, score + ' out of ' + possible, score + ' points out of ' + possible].some(value => hasPhrase(message, value));
    } else if (kind === 'announcement' && question(row.line) && !/\b(?:where is the announcement|where can i (?:find|open))\b/i.test(row.line)) check = factRule(target.body || target.message || target.description, row.line, title);
    else if (kind === 'assignment' && /\bwhen\b|\bwhat\s+(?:time|date)\b/i.test(row.line) && (target.dueAt ?? target.due_at) !== undefined) {
      const named = factRule(title, '', '', true), date = dateRule(target.dueAt ?? target.due_at, snapshot);
      check = message => !!named?.(message) && date(message);
    } else if (kind === 'assignment' && question(row.line) && !/^(?:which|what)\s+(?!(?:does|do|did|is|are|was|were|should|can|could|would)\b)(?:(?:\w+)\s+){0,2}(?:task|work|lab|assignment|poem|prototype)\b/i.test(row.line)) check = factRule(target.instructions || target.description, row.line, title);
    else if (question(row.line)) check = factRule(title, '', '', true);
    if (check) checks.push(check);
  }
  return { category, test: checks.length ? message => checks.some(check => check(message)) : null };
}
function replyExpectation(row, snapshot) {
  const automatic = automaticReplyExpectation(row, snapshot), required = ['replyContains', 'answerContains'].flatMap(key => typeof row.expected[key] === 'string' ? [row.expected[key]] : list(row.expected[key]));
  return required.length ? { category: automatic.category, test: message => (!automatic.test || automatic.test(message)) && required.every(value => hasPhrase(message, value)) } : automatic;
}
function timing(values) {
  const sorted = values.map(value => value.ms).sort((a, b) => a - b);
  const round = value => Math.round(value * 10000) / 10000;
  return { unit: 'ms', count: sorted.length, mean: round(sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1)), p50: round(sorted[Math.max(0, Math.ceil(sorted.length * .5) - 1)] || 0), p95: round(sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] || 0), max: round(sorted.at(-1) || 0), under15msPct: percent(sorted.filter(ms => ms < 15).length, sorted.length), perLine: values.map(({ id, ms }) => ({ id, ms: round(ms) })) };
}
function validateRow(data, row, kind) {
  if (!row || typeof row.id !== 'string' || !['tune', 'heldout'].includes(row.split)) throw new Error('Invalid selected row metadata');
  if (typeof row.line !== 'string' || !row.moment || !row.world || !row.expected) throw new Error('Selected row is missing its world, moment, line or expectation');
  resolveWorld(data, row,{copy:false});
  for (const key of ['replyContains', 'answerContains']) if (row.expected[key] !== undefined && (typeof row.expected[key] !== 'string' && !Array.isArray(row.expected[key]) || (typeof row.expected[key] === 'string' ? [row.expected[key]] : list(row.expected[key])).some(value => typeof value !== 'string' || !value.trim()))) throw new Error('Invalid selected reply specifics');
  if (kind !== 'offer') pipelineLabels(row);
  if (kind === 'offer' && typeof row.expected.offer !== 'boolean') throw new Error('Selected offer needs expected.offer');
  if (kind !== 'offer' || row.expected.offer) {
    const compound=compoundVariants(row.expected);
    if(compound){for(const variant of compound)for(const step of variant.actions)for(const expectation of expectedVariants(step))if(expectation.action&&!ACTIONS.includes(normalizeAction(expectation.action)))throw new Error('Selected expectation has an unknown stable action');return;}
    for (const expectation of alternatives(row.expected)) {
      if (!expectation.action && !expectation.itemId) throw new Error('Selected row has an empty expectation');
      if (expectation.action && !ACTIONS.includes(expectation.action)) throw new Error('Selected expectation has an unknown stable action');
    }
  }
}
function invoke(call, timings, id, offer = false) {
  const start = performance.now();
  try {
    const result = call();
    if (result && typeof result.then === 'function') throw new Error('Biscuit evaluation must be synchronous');
    if (!(offer && (result === null || result === undefined || result === false)) && (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.action !== 'string' || !Array.isArray(result.items))) throw new Error('Biscuit result does not implement the documented contract');
    return { result, error: false };
  } catch (_) {
    // Aggregate error counts only: never print exception messages containing input.
    return { result: null, error: true };
  } finally { timings.push({ id, ms: performance.now() - start }); }
}
function scoreSituations(data, rows, engine, options={}) {
  let top1 = 0, top3 = 0, errors = 0, local = 0, wrongAI = 0, localWrongAI = 0, mutations = 0, wrongMutationAction = 0, mutationTargetErrors = 0, wrongAction = 0, unwantedMutations = 0;
  const times = [], byAction = {}, byCategory = {}, byFamily = {}, byNeed = {}, byStep = pipelineCounts(), perRow = [], replySpecifics = { eligible: 0, misses: 0 }, execution = { learned: 0, rules: 0, guard: 0, unknown: 0, fallback: 0 };
  const mutable = new Set(['plan', 'complete', 'setting', 'feature', 'module', 'reminder', 'note', 'bookmark', 'focus', 'focus-control']);
  for (const row of rows) {
    validateRow(data, row, 'situation');
    const snapshot = resolveWorld(data, row), session = inferenceSession(row.session || {}), reply = replyExpectation(row, snapshot), labels = pipelineLabels(row);
    const called = invoke(() => engine.evaluate(row.line, snapshot, session), times, row.id);
    const observedExecution = !called.error && record(called.result?.execution) ? called.result.execution : {};
    execution[['learned', 'rules', 'guard'].includes(observedExecution.stage) ? observedExecution.stage : 'unknown']++;
    if (observedExecution.fallback === true) execution.fallback++;
    const ranked = candidates(called.result), lead = ranked[0] || { action: 'none' };
    const compound=scoreCompound(row.expected,called.result,called.error);
    const first = !called.error && matches(lead, row.expected);
    const three = !called.error && (ranked.length ? ranked.slice(0, 3).some(value => matches(value, row.expected)) : matches(null, row.expected));
    if (called.error) errors++;
    if (first) top1++;
    if (three) top3++;
    const actionOK = allowsAction(row.expected, lead.action);
    const pipeline = { action: { eligible: true, correct: !called.error && actionOK }, fields: scoreFields(row.expected, called.result, called.error), ranking: { eligible: true, top1: first, top3: three, targetError: !called.error && actionOK && !first }, ...scorePipeline(labels, called.result, called.error), ...(compound.eligible?{compound}:{}) };
    addPipeline(byStep, pipeline); perRow.push({ row: perRow.length + 1, ...pipeline });
    if(options.onRow)options.onRow(perRow.length-1,reply.category);
    if (!actionOK || called.error) wrongAction++;
    if (!allowsAction(row.expected, 'ai') && !allowsAction(row.expected, 'none')) { local++; if (lead.action === 'ai') localWrongAI++; }
    if (!allowsAction(row.expected, 'ai') && lead.action === 'ai') wrongAI++;
    for (const [prefix, groups] of [['family:', byFamily], ['need:', byNeed]]) for (const tag of new Set(list(row.tags).filter(value => typeof value === 'string' && value.startsWith(prefix) && value.length > prefix.length))) {
      const key = tag.slice(prefix.length);
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid metric tag');
      const tagged = groups[key] ||= { count: 0, top1: 0, top3: 0, wrongToAI: 0, localCount: 0, localWrongAI: 0, errors: 0, byStep: pipelineCounts() };
      tagged.count++; if (first) tagged.top1++; if (three) tagged.top3++; if (called.error) tagged.errors++;
      if (!allowsAction(row.expected, 'ai') && lead.action === 'ai') tagged.wrongToAI++;
      if (!allowsAction(row.expected, 'ai') && !allowsAction(row.expected, 'none')) { tagged.localCount++; if (lead.action === 'ai') tagged.localWrongAI++; }
      addPipeline(tagged.byStep, pipeline);
    }
    if (row.mutation === true) {
      mutations++;
      if (!actionOK || called.error) wrongMutationAction++;
      else if (!first) mutationTargetErrors++;
    }
    if (mutable.has(lead.action) && !actionOK) unwantedMutations++;
    const expectedAction = row.expected.action || 'item-only';
    const group = byAction[expectedAction] ||= { count: 0, top1: 0, top3: 0 };
    group.count++; if (first) group.top1++; if (three) group.top3++;
    const category = byCategory[reply.category] ||= { count: 0, top1Misses: 0, top3Misses: 0, wrongAction: 0, targetErrors: 0, errors: 0, replySpecifics: { eligible: 0, misses: 0 }, byStep: pipelineCounts() };
    addPipeline(category.byStep, pipeline);
    category.count++; if (!first) category.top1Misses++; if (!three) category.top3Misses++; if (!actionOK || called.error) category.wrongAction++; if (actionOK && !called.error && !first) category.targetErrors++; if (called.error) category.errors++;
    if (reply.test) {
      replySpecifics.eligible++; category.replySpecifics.eligible++;
      if (called.error || typeof called.result?.message !== 'string' || !called.result.message.trim() || !reply.test(called.result.message)) { replySpecifics.misses++; category.replySpecifics.misses++; }
    }
  }
  for (const group of Object.values(byAction)) { group.top1Pct = percent(group.top1, group.count); group.top3Pct = percent(group.top3, group.count); }
  replySpecifics.missPct = percent(replySpecifics.misses, replySpecifics.eligible);
  for (const group of Object.values(byCategory)) { group.replySpecifics.missPct = percent(group.replySpecifics.misses, group.replySpecifics.eligible); finishPipeline(group.byStep); }
  for (const group of [...Object.values(byFamily), ...Object.values(byNeed)]) {
    finishPipeline(group.byStep); group.top1Pct = percent(group.top1, group.count); group.top3Pct = percent(group.top3, group.count);
    group.actionAccuracyPct = group.byStep.action.accuracyPct; group.fieldsAccuracyPct = group.byStep.fields.accuracyPct;
    group.wrongToAIPct = percent(group.wrongToAI, group.count); group.wrongToAILocalPct = percent(group.localWrongAI, group.localCount);
  }
  finishPipeline(byStep);
  return { count: rows.length, top1, top1Pct: percent(top1, rows.length), top3, top3Pct: percent(top3, rows.length), actionAccuracyPct: byStep.action.accuracyPct, fieldsAccuracyPct: byStep.fields.accuracyPct, wrongToAI: wrongAI, wrongToAIPct: percent(wrongAI, rows.length), wrongToAILocalPct: percent(localWrongAI, local), localCount: local, wrongAction, wrongActionPct: percent(wrongAction, rows.length), mutationCount: mutations, wrongMutationAction, wrongMutationActionPct: percent(wrongMutationAction, mutations), mutationTargetErrors, unwantedMutations, errors, byAction, replySpecifics, byCategory, byFamily, byNeed, byStep, execution, perRow, timing: timing(times) };
}
function scoreOffers(data, rows, engine) {
  let expectedOffers = 0, expectedNone = 0, emitted = 0, correct = 0, unwanted = 0, falsePositives = 0, missed = 0, errors = 0, correctNone = 0;
  const times = [];
  for (const row of rows) {
    validateRow(data, row, 'offer');
    const snapshot = resolveWorld(data, row), state = copy(row.state || {}), memory = copy(row.memory || {});
    const called = invoke(() => engine.offer(snapshot, state, memory), times, row.id, true);
    const ranked = candidates(called.result), lead = ranked[0];
    const present = !!lead && lead.action !== 'none';
    if (called.error) errors++;
    if (present) emitted++;
    if (row.expected.offer) {
      expectedOffers++;
      if (!called.error && present && matches(lead, row.expected)) correct++;
      else { missed++; if (present) unwanted++; }
    } else {
      expectedNone++;
      if (present) { unwanted++; falsePositives++; }
      else if (!called.error) correctNone++;
    }
  }
  return { count: rows.length, expectedOffers, expectedNoOffer: expectedNone, emitted, correctOffers: correct, correctNoOffer: correctNone, precisionPct: percent(correct, emitted), recallPct: percent(correct, expectedOffers), accuracyPct: percent(correct + correctNone, rows.length), unwantedOffers: unwanted, unwantedOfferPct: percent(unwanted, rows.length), unwantedNoOfferPct: percent(falsePositives, expectedNone), missedOffers: missed, errors, timing: timing(times) };
}
function selectRows(data, split, kind) {
  // Filter before resolving worlds, validation, scoring or reporting. In tune mode
  // nothing downstream is handed a held-out situation, even though JSON is parsed.
  return (kind === 'offer' ? data.offers : data.situations).filter(row => split === 'all' || row.split === split);
}
const TIERS = Object.freeze(['basic', 'more', 'most']);

// Scoring-only public prerequisite. No fixture discovery, training, freeze or sealed-set CLI.
function guardError(code, message) { const error = new Error(message); error.code = code; return error; }
function requireFreshTier(tier, rules) {
  try {
    const Rules = rules || require(path.join(ROOT, 'extension/biscuit-rules.js'));
    if (!TIERS.includes(tier) || typeof Rules.get !== 'function' || typeof Rules.validate !== 'function') throw new Error('Unavailable tier API');
    let selected;
    for (const name of TIERS.slice(0, TIERS.indexOf(tier) + 1)) {
      const model = Rules.get(name), index = TIERS.indexOf(name);
      if (!record(model) || model.tier !== name || (index ? model.extends !== TIERS[index - 1] : model.extends !== undefined)) throw new Error('Unavailable tier ancestry');
      Rules.validate(model, name);
      if (!record(model.models) || Object.values(model.models).some(value => !record(value) || value.delta !== undefined && value.delta !== false)) throw new Error('Unresolved model delta');
      selected = model;
    }
    return selected;
  } catch (_) { throw guardError('BISCUIT_FRESH_TIER', 'Requested fresh tier or its validated ancestry is unavailable'); }
}
module.exports={ACTIONS,TIERS,normalizeAction,candidates,matches,resolveWorld,pipelineLabels,scorePipeline,partialDeep,scoreFields,observedActions,scoreCompound,requireFreshTier,selectRows,scoreSituations,scoreOffers};
