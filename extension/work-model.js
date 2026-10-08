/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function (root, factory) {
  'use strict';

  var Core = root.ReserveCore;
  if (!Core && typeof module === 'object' && module.exports) {
    Core = require('./core.js');
  }

  var api = factory(Core || {});
  root.ReserveWorkModel = api;

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';

  var DAY = 86400000;
  var DEFAULT_TIME_ZONE = 'America/New_York';

  function own(object, key) {
    return !!object && Object.prototype.hasOwnProperty.call(object, key);
  }

  function validMs(value) {
    if (value === null || value === undefined || value === '') return null;
    var date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }

  function nowMs(value) {
    var parsed = validMs(value === undefined ? Date.now() : value);
    return parsed === null ? Date.now() : parsed;
  }

  function safeTimeZone(value) {
    var timeZone = typeof value === 'string' && value ? value : DEFAULT_TIME_ZONE;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timeZone }).format(new Date(0));
      return timeZone;
    } catch (_error) {
      return DEFAULT_TIME_ZONE;
    }
  }

  function dayKey(value, timeZone) {
    var ms = validMs(value);
    if (ms === null) return null;
    var zone = safeTimeZone(timeZone);

    if (typeof Core.dayKey === 'function') {
      try {
        return Core.dayKey(ms, zone);
      } catch (_error) {
        // Fall through to the local calendar formatter.
      }
    }

    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    var parts = formatter.formatToParts(new Date(ms));
    var values = {};
    for (var index = 0; index < parts.length; index += 1) {
      var part = parts[index];
      if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
        values[part.type] = part.value;
      }
    }
    return values.year && values.month && values.day
      ? values.year + '-' + values.month + '-' + values.day
      : null;
  }

  function complete(item) {
    if (typeof Core.isComplete === 'function') return Core.isComplete(item);
    if (!item) return false;
    if (item.state === 'excused') return true;
    if (item.missing === true || item.redoRequested === true) return false;
    return item.state === 'submitted' || item.state === 'graded';
  }

  function localState(local, item) {
    if (!local || typeof local !== 'object' || Array.isArray(local)) return {};
    var id = String(item && item.id);
    if (!own(local, id)) return {};
    var value = local[id];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function textCompare(left, right) {
    var a = left === null || left === undefined ? '' : String(left);
    var b = right === null || right === undefined ? '' : String(right);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function dueNameIdCompare(left, right) {
    var leftDue = validMs(left && left.dueAt);
    var rightDue = validMs(right && right.dueAt);
    if (leftDue === null && rightDue !== null) return 1;
    if (leftDue !== null && rightDue === null) return -1;
    if (leftDue !== null && rightDue !== null && leftDue !== rightDue) return leftDue - rightDue;
    var name = textCompare(left && left.name, right && right.name);
    return name !== 0 ? name : textCompare(left && left.id, right && right.id);
  }

  function gradeTime(item) {
    var graded = validMs(item && item.gradedAt);
    if (graded !== null) return graded;
    return validMs(item && item.updatedAt);
  }

  function gradeCompare(left, right) {
    var leftTime = gradeTime(left);
    var rightTime = gradeTime(right);
    if (leftTime === null && rightTime !== null) return 1;
    if (leftTime !== null && rightTime === null) return -1;
    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return rightTime - leftTime;
    var name = textCompare(left && left.name, right && right.name);
    return name !== 0 ? name : textCompare(left && left.id, right && right.id);
  }

  function recommendationRank(item, state, now, cutoff, today) {
    var due = validMs(item && item.dueAt);
    var plannedToday = state.plannedDate === today;
    var pinned = state.pinned === true;
    var recentDated = due !== null && due >= cutoff;

    if (!(recentDated || plannedToday || pinned)) return null;
    if (state.progress === 'done') return null;

    if (recentDated && due <= now + DAY) return 0;
    if (state.progress === 'in-progress') return 1;
    if (pinned || plannedToday) return 2;
    return 3;
  }

  function recommendationReason(item, state, rank, now) {
    var due = validMs(item && item.dueAt);
    if (rank === 0) return due !== null && due < now ? 'Overdue in Canvas' : 'Due within 24 hours';
    if (rank === 1) return 'You already started this';
    if (rank === 2) return state.pinned === true ? 'Pinned by you' : 'In your plan for today';
    return 'Your next deadline';
  }

  function insights(items, local, options) {
    var source = Array.isArray(items) ? items : [];
    local = local && typeof local === 'object' && !Array.isArray(local) ? local : {};
    options = options || {};

    var now = nowMs(options.now);
    var timeZone = safeTimeZone(options.timeZone);
    var courseId = options.courseId === undefined ? 'all' : String(options.courseId);
    var today = dayKey(now, timeZone);
    var cutoff = now - 14 * DAY;

    var scoped = source.filter(function (item) {
      if (!item) return false;
      return courseId === 'all' || String(item.courseId) === courseId;
    });

    var planned = [];
    var ready = [];
    var missing = [];
    var recentGrades = [];
    var recommendationCandidates = [];
    var minutes = 0;
    var unestimated = 0;

    scoped.forEach(function (item) {
      var state = localState(local, item);
      var isComplete = complete(item) || state.checkedOff === true;

      if (!isComplete && today && state.plannedDate === today) {
        planned.push(item);
        if (typeof state.estimate === 'number' && Number.isFinite(state.estimate) && state.estimate > 0) {
          minutes += state.estimate;
        } else {
          unestimated += 1;
        }
      }

      if (!isComplete && state.progress === 'done') ready.push(item);

      var due = validMs(item.dueAt);
      if (
        !isComplete && item.state !== 'excused' &&
        (item.missing === true || item.redoRequested === true) &&
        due !== null &&
        due >= cutoff
      ) {
        missing.push(item);
      }

      if (
        item.state === 'graded' &&
        item.missing !== true &&
        item.redoRequested !== true &&
        typeof item.score === 'number' &&
        Number.isFinite(item.score)
      ) {
        recentGrades.push(item);
      }

      if (!isComplete) {
        var rank = recommendationRank(item, state, now, cutoff, today);
        if (rank !== null) {
          recommendationCandidates.push({ item: item, state: state, rank: rank });
        }
      }
    });

    planned.sort(dueNameIdCompare);
    ready.sort(dueNameIdCompare);
    missing.sort(dueNameIdCompare);
    recentGrades.sort(gradeCompare);
    if (recentGrades.length > 5) recentGrades.length = 5;

    recommendationCandidates.sort(function (left, right) {
      if (left.rank !== right.rank) return left.rank - right.rank;
      return dueNameIdCompare(left.item, right.item);
    });

    var next = null;
    if (recommendationCandidates.length > 0) {
      var first = recommendationCandidates[0];
      next = {
        item: first.item,
        reason: recommendationReason(first.item, first.state, first.rank, now),
      };
    }

    return {
      next: next,
      planned: planned,
      minutes: minutes,
      unestimated: unestimated,
      ready: ready,
      missing: missing,
      recentGrades: recentGrades,
    };
  }

  return { insights: insights };
});
