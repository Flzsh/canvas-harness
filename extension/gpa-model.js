/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. MIT. */
(function (root, factory) {
  'use strict';
  const api = factory();
  root.CanvasHarnessGPA = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (typeof define === 'function' && define.amd) define([], function () { return api; });
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Editable starting rules, not a school's official conversion or transcript policy.
  const LETTERS = Object.freeze(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F']);
  const MINIMUMS = Object.freeze([97, 93, 90, 87, 83, 80, 77, 73, 70, 67, 63, 60, 0]);
  const POINTS43 = Object.freeze([4.3, 4, 3.7, 3.3, 3, 2.7, 2.3, 2, 1.7, 1.3, 1, 0.7, 0]);
  const LEVELS = Object.freeze(['regular', 'honors', 'ap', 'custom']);
  const NON_GPA = /^(?:P|PASS(?:ED)?|S|SATISFACTORY|I|INC|INCOMPLETE|NP|N\/P|NO PASS|U|UNSATISFACTORY|W|WF|WITHDRAWN|CR|CREDIT|NC|NO CREDIT|AU|AUDIT|EX|EXCUSED|IP|IN PROGRESS|N\/A|NOT GRADED|UNGRADED)$/i;
  const REASONS = Object.freeze({
    hidden: 'Grades hidden by Canvas',
    'non-gpa': 'Pass, incomplete, or another non-GPA grade',
    missing: 'No grade available for this scope',
    'invalid-score': 'No usable percentage or letter grade',
    'period-unavailable': 'No current-period grade source',
    'non-academic': 'Non-academic course; excluded by default',
    unselected: 'Course not selected in Canvas Harness',
    excluded: 'Excluded in this calculator',
    'zero-credits': 'Credits set to zero'
  });
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max = 300) => typeof value === 'string' ? value.slice(0, max).trim() : '';

  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function letter(value) {
    const candidate = text(value, 80).toUpperCase();
    return LETTERS.includes(candidate) ? candidate : null;
  }
  function bounded(value, min, max, label) {
    const parsed = number(value);
    if (parsed === null || parsed < min || parsed > max) throw Error(label + ' must be a number from ' + min + ' to ' + max + '.');
    return parsed;
  }
  function idOf(value) {
    if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) return null;
    const id = String(value);
    return id && id.length <= 200 && !['__proto__', 'constructor', 'prototype'].includes(id) ? id : null;
  }
  function defaults() {
    return {
      version: 1,
      scope: 'overall',
      weighted: false,
      weightedCap: null,
      bonusOnFail: false,
      presets: {regular: 0, honors: 0.5, ap: 1},
      rules: LETTERS.map((name, i) => ({letter: name, min: MINIMUMS[i], points4: Math.min(4, POINTS43[i]), points43: POINTS43[i]})),
      courses: {}
    };
  }
  function cleanRules(input) {
    if (!Array.isArray(input) || input.length !== LETTERS.length) throw Error('Keep all 13 letter rows, from A+ through F.');
    const result = input.map((row, i) => {
      if (!record(row) || row.letter !== LETTERS[i]) throw Error('Keep the conversion rows in order from A+ through F.');
      const min = number(row.min);
      if (min === null || min < 0) throw Error(row.letter + ': minimum percentage must be a nonnegative number.');
      return {letter: row.letter, min, points4: bounded(row.points4, 0, 10, row.letter + ' 4.0-table points'), points43: bounded(row.points43, 0, 10, row.letter + ' 4.3-table points')};
    });
    for (let i = 1; i < result.length; i++) {
      if (result[i - 1].min <= result[i].min) throw Error('Minimum percentages must decrease strictly from A+ to F, without duplicates.');
    }
    if (result[result.length - 1].min !== 0) throw Error('The F row must begin at 0% so every nonnegative percentage has a band.');
    return result;
  }

  // Strict on supplied invalid values. A caller can retain its last good preferences
  // when this throws; missing fields alone receive defaults. Never mutate the input.
  function cleanPreferences(input) {
    const out = defaults();
    if (input === null || input === undefined) return out;
    if (!record(input)) throw Error('GPA preferences must be an object.');
    for (const key of ['__proto__', 'constructor', 'prototype']) if (own(input, key)) throw Error('GPA preferences contain an unsafe key.');
    if (own(input, 'version') && input.version !== 1) throw Error('Unsupported GPA preferences version.');
    if (own(input, 'scope')) {
      if (!['overall', 'current-period'].includes(input.scope)) throw Error('Choose overall or current-period grades.');
      out.scope = input.scope;
    }
    for (const key of ['weighted', 'bonusOnFail']) {
      if (!own(input, key)) continue;
      if (typeof input[key] !== 'boolean') throw Error(key + ' must be true or false.');
      out[key] = input[key];
    }
    if (own(input, 'weightedCap')) out.weightedCap = input.weightedCap === null ? null : bounded(input.weightedCap, 4, 10, 'Weighted point cap');
    if (own(input, 'presets')) {
      if (!record(input.presets)) throw Error('Weighting presets must be an object.');
      for (const key of ['regular', 'honors', 'ap']) if (own(input.presets, key)) out.presets[key] = bounded(input.presets[key], 0, 5, key + ' bonus');
    }
    if (own(input, 'rules')) out.rules = cleanRules(input.rules);
    if (own(input, 'courses')) {
      if (!record(input.courses)) throw Error('Course preferences must be an object.');
      const entries = Object.entries(input.courses);
      if (entries.length > 1000) throw Error('GPA preferences support up to 1,000 courses.');
      for (const [id, item] of entries) {
        if (!idOf(id) || !record(item)) throw Error('A GPA course preference has an invalid identifier or value.');
        const course = {credits: 1, level: 'regular', bonus: 0, override: null};
        if (own(item, 'included')) {
          if (typeof item.included !== 'boolean') throw Error('Course inclusion must be true or false.');
          course.included = item.included;
        }
        if (own(item, 'credits')) course.credits = bounded(item.credits, 0, 30, 'Course credits');
        if (own(item, 'bonus')) course.bonus = bounded(item.bonus, 0, 5, 'Custom course bonus');
        if (own(item, 'level')) {
          if (!LEVELS.includes(item.level)) throw Error('Choose regular, honors, AP/IB, or a custom bonus.');
          course.level = item.level;
        }
        if (own(item, 'override') && item.override !== null && item.override !== '') {
          course.override = letter(item.override);
          if (!course.override) throw Error('A what-if grade must be a letter from A+ through F.');
        }
        out.courses[id] = course;
      }
    }
    return out;
  }
  function percentageLetter(value, rules) {
    const score = number(value);
    if (score === null || score < 0) return null;
    return rules.find(row => score >= row.min)?.letter || null;
  }
  function hidden(course) {
    return course.hideFinalGrades === true || course.hide_final_grades === true || course.scoreScope === 'hidden';
  }
  function canvasGrade(course, scope, rules) {
    const empty = reason => ({letter: null, percent: null, label: null, source: null, reason});
    if (hidden(course)) return empty('hidden');
    let score, raw;
    if (scope === 'current-period') {
      if (course.scoreScope !== 'current-period') return empty('period-unavailable');
      score = number(course.score); raw = text(course.grade);
    } else {
      score = number(course.overallScore); raw = text(course.overallGrade);
      // This fallback is only within the same explicitly identified overall scope.
      if (course.scoreScope === 'overall') {
        if (score === null) score = number(course.score);
        if (!raw) raw = text(course.grade);
      }
    }
    if (NON_GPA.test(raw)) return {...empty('non-gpa'), label: raw};
    const exact = letter(raw);
    if (exact) return {letter: exact, percent: score !== null && score >= 0 ? score : null, label: raw, source: 'canvas-letter', reason: null};
    const converted = percentageLetter(score, rules);
    if (converted) return {letter: converted, percent: score, label: raw || null, source: 'percentage', reason: null};
    return {...empty(score !== null && score < 0 ? 'invalid-score' : 'missing'), label: raw || null};
  }

  function calculate(courses, input) {
    const prefs = cleanPreferences(input), rows = [], seen = new Set(), exclusions = {}, periods = new Map();
    let ignored = 0, countedCourses = 0, totalCredits = 0, sum4 = 0, sum43 = 0, weighted4 = 0, weighted43 = 0, whatIfCount = 0;
    for (const course of Array.isArray(courses) ? courses : []) {
      const id = record(course) ? idOf(course.id) : null;
      if (!id || seen.has(id)) { ignored++; continue; }
      seen.add(id);
      const preference = own(prefs.courses, id) ? prefs.courses[id] : {credits: 1, level: 'regular', bonus: 0, override: null};
      const actual = canvasGrade(course, prefs.scope, prefs.rules), isHidden = hidden(course);
      const manual = !isHidden && preference.override !== null;
      const grade = manual ? preference.override : actual.letter;
      const academic = course.academic !== false && course.isAcademic !== false && course.nonAcademic !== true;
      const selected = course.selected !== false;
      const include = own(preference, 'included') ? preference.included : !!grade && academic && selected;
      const bonus = preference.level === 'custom' ? preference.bonus : prefs.presets[preference.level];
      let reason = null;
      if (isHidden) reason = 'hidden';
      else if (preference.included === false) reason = 'excluded';
      else if (!grade) reason = actual.reason || 'missing';
      else if (!include) reason = !academic ? 'non-academic' : !selected ? 'unselected' : 'excluded';
      else if (preference.credits === 0) reason = 'zero-credits';
      const points = grade ? prefs.rules.find(row => row.letter === grade) : null;
      const appliedBonus = points && (grade !== 'F' || prefs.bonusOnFail) ? bonus : 0;
      const capped = value => prefs.weightedCap === null ? value : Math.min(value, prefs.weightedCap);
      const period = text(course.gradingPeriodTitle, 200) || (course.gradingPeriodId != null ? 'Period ' + text(String(course.gradingPeriodId), 100) : 'Unlabelled current period');
      const row = {
        id, name: text(course.shortName) || text(course.name) || 'Untitled course',
        include, counted: reason === null, eligible: !!grade && !isHidden, reason, reasonText: reason ? REASONS[reason] : '',
        scope: prefs.scope, periodLabel: manual ? 'What-if grade' : prefs.scope === 'overall' ? 'Overall' : period,
        source: manual ? 'manual' : actual.source, manual,
        letter: grade, percent: manual ? null : actual.percent,
        canvasLabel: actual.label, canvasPercent: actual.percent,
        credits: preference.credits, level: preference.level, bonus, appliedBonus,
        points4: points?.points4 ?? null, points43: points?.points43 ?? null,
        weighted4: points ? capped(points.points4 + appliedBonus) : null,
        weighted43: points ? capped(points.points43 + appliedBonus) : null
      };
      rows.push(row);
      if (reason) { exclusions[reason] = (exclusions[reason] || 0) + 1; continue; }
      countedCourses++; totalCredits += row.credits;
      sum4 += row.points4 * row.credits; sum43 += row.points43 * row.credits;
      weighted4 += row.weighted4 * row.credits; weighted43 += row.weighted43 * row.credits;
      if (manual) whatIfCount++;
      else if (prefs.scope === 'current-period') periods.set(period.toLowerCase(), period);
    }
    const average = sum => totalCredits > 0 ? sum / totalCredits : null;
    const basicRules = defaults().rules;
    return {
      scope: prefs.scope,
      unweighted: {scale4: average(sum4), scale43: average(sum43)},
      weighted: prefs.weighted ? {scale4: average(weighted4), scale43: average(weighted43)} : null,
      countedCourses, totalCredits, excludedCourses: rows.length - countedCourses, totalCourses: rows.length,
      exclusions, rows, whatIfCount,
      periods: Array.from(periods.values()), mixedPeriods: periods.size > 1,
      customRules: prefs.rules.some((row, i) => ['min', 'points4', 'points43'].some(key => row[key] !== basicRules[i][key])),
      warnings: ignored ? [ignored + ' duplicate or invalid course record' + (ignored === 1 ? ' was' : 's were') + ' ignored.'] : []
    };
  }

  return Object.freeze({defaults, cleanPreferences, calculate, cleanRules, percentageLetter, number, letter, LETTERS, LEVELS, REASONS});
});
