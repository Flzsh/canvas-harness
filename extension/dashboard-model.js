/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function (root, factory) {
  'use strict';

  var Core = root.ReserveCore;
  if (!Core && typeof module === 'object' && module.exports) {
    Core = require('./core.js');
  }

  var api = factory(Core || {});
  root.ReserveDashboardModel = api;

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';

  var DAY = 86400000;
  var DEFAULT_TIME_ZONE = 'America/New_York';
  var dayFormatters = new Map();
  var zoneCache = new Map();
  var KNOWN_MODES = {
    actionable: true,
    upcoming: true,
    today: true,
    tomorrow: true,
    week: true,
    overdue: true,
    dated: true,
    undated: true,
    pinned: true,
    planned: true,
    ready: true,
    missing: true,
    completed: true,
  };

  function own(object, key) {
    return !!object && Object.prototype.hasOwnProperty.call(object, key);
  }

  function safeNow(value) {
    var date = value instanceof Date ? value : new Date(value === undefined ? Date.now() : value);
    return Number.isFinite(date.getTime()) ? date.getTime() : Date.now();
  }

  function dateMs(value) {
    if (value === null || value === undefined || value === '') return null;
    var date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }

  function normalizeTimeZone(value) {
    var timeZone = typeof value === 'string' && value ? value : DEFAULT_TIME_ZONE;
    if (zoneCache.has(timeZone)) return zoneCache.get(timeZone);
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timeZone }).format(new Date(0));
      if (zoneCache.size >= 12) zoneCache.clear();
      zoneCache.set(timeZone, timeZone);
      return timeZone;
    } catch (_error) {
      return DEFAULT_TIME_ZONE;
    }
  }

  function localDayKey(value, timeZone) {
    var ms = dateMs(value);
    if (ms === null) return null;
    var zone = normalizeTimeZone(timeZone);

    if (!dayFormatters.has(zone)) {
      if (dayFormatters.size >= 12) dayFormatters.clear();
      dayFormatters.set(zone, new Intl.DateTimeFormat('en-US', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}));
    }
    var formatter = dayFormatters.get(zone);
    var values = {};
    var parts = formatter.formatToParts(new Date(ms));
    for (var index = 0; index < parts.length; index += 1) {
      if (parts[index].type === 'year' || parts[index].type === 'month' || parts[index].type === 'day') {
        values[parts[index].type] = parts[index].value;
      }
    }
    return values.year && values.month && values.day
      ? values.year + '-' + values.month + '-' + values.day
      : null;
  }

  function dayOrdinal(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return null;
    var parts = key.split('-');
    return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) / DAY;
  }

  function dayDifference(value, now, timeZone) {
    var dueKey = localDayKey(value, timeZone);
    var nowKey = localDayKey(now, timeZone);
    var dueOrdinal = dayOrdinal(dueKey);
    var nowOrdinal = dayOrdinal(nowKey);
    if (dueOrdinal === null || nowOrdinal === null) return null;
    return dueOrdinal - nowOrdinal;
  }

  function complete(item) {
    if (typeof Core.isComplete === 'function') return Core.isComplete(item);
    if (!item) return false;
    if (item.state === 'excused') return true;
    if (item.missing === true || item.redoRequested === true) return false;
    return item.state === 'submitted' || item.state === 'graded';
  }

  function normalizedSearch(value) {
    var text = value === null || value === undefined ? '' : String(value);
    if (typeof text.normalize === 'function') text = text.normalize('NFD');
    return text.replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function compareText(left, right) {
    var a = normalizedSearch(left);
    var b = normalizedSearch(right);
    if (a < b) return -1;
    if (a > b) return 1;
    a = left === null || left === undefined ? '' : String(left);
    b = right === null || right === undefined ? '' : String(right);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function compareDueNameId(left, right) {
    var leftDue = dateMs(left && left.dueAt);
    var rightDue = dateMs(right && right.dueAt);
    if (leftDue === null && rightDue !== null) return 1;
    if (leftDue !== null && rightDue === null) return -1;
    if (leftDue !== null && rightDue !== null && leftDue !== rightDue) return leftDue - rightDue;
    var nameResult = compareText(left && left.name, right && right.name);
    if (nameResult !== 0) return nameResult;
    return compareText(left && left.id, right && right.id);
  }

  function localItem(local, item) {
    if (!local || typeof local !== 'object') return {};
    var id = String(item && item.id);
    if (!own(local, id)) return {};
    var value = local[id];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function pinned(local, item) {
    return localItem(local, item).pinned === true;
  }

  function validDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function workComplete(item, local) {
    return complete(item) || localItem(local, item).checkedOff === true;
  }

  function filterAssignments(items, options) {
    options = options || {};
    var source = Array.isArray(items) ? items : [];
    var now = safeNow(options.now);
    var timeZone = normalizeTimeZone(options.timeZone);
    var mode = own(KNOWN_MODES, options.mode) ? options.mode : 'actionable';
    var courseId = options.courseId === undefined ? 'all' : String(options.courseId);
    var query = typeof options.query === 'string' ? options.query : '';
    var q = normalizedSearch(query.trim());
    var day = validDay(options.day) ? options.day : '';
    var local = options.local && typeof options.local === 'object' ? options.local : {};
    var cutoff = now - 14 * DAY;
    var searching = !!q && mode === 'actionable' && !day;

    var scoped = source.filter(function (item) {
      if (!item) return false;
      if (courseId !== 'all' && String(item.courseId) !== courseId) return false;
      if (!q) return true;
      // courseSearch carries the full Canvas name (teacher, cohort) after a rename.
      var haystack = normalizedSearch(item.name) + '\n' + normalizedSearch(item.courseName) + '\n' + normalizedSearch(item.courseSearch) + '\n' + normalizedSearch(item.personal ? item.source?.title : '');
      return haystack.indexOf(q) !== -1;
    });

    var olderCount = scoped.filter(function (item) {
      var due = dateMs(item.dueAt);
      return !workComplete(item, local) && due !== null && due < cutoff;
    }).length;

    var selected;
    if (day) {
      selected = scoped.filter(function (item) {
        return !workComplete(item, local) && localDayKey(item.dueAt, timeZone) === day;
      });
    } else if (searching) {
      selected = scoped.slice();
    } else {
      selected = scoped.filter(function (item) {
        var due = dateMs(item.dueAt);
        var isComplete = workComplete(item, local);
        var difference = due === null ? null : dayDifference(due, now, timeZone);

        if (mode === 'actionable') return !isComplete && ((due !== null && due >= cutoff) || (item.personal === true && localItem(local,item).plannedDate === localDayKey(now,timeZone)));
        if (mode === 'upcoming') return !isComplete && due !== null && due >= now;
        if (mode === 'today') return !isComplete && due !== null && difference === 0;
        if (mode === 'tomorrow') return !isComplete && due !== null && difference === 1;
        if (mode === 'week') return !isComplete && due !== null && difference !== null && difference >= 0 && difference <= 6;
        if (mode === 'overdue') return !isComplete && due !== null && due < now && due >= cutoff;
        if (mode === 'dated') return due !== null;
        if (mode === 'undated') return due === null;
        if (mode === 'pinned') return pinned(local, item);
        if (mode === 'planned') return !isComplete && localItem(local,item).plannedDate === localDayKey(now,timeZone);
        if (mode === 'ready') return !isComplete && localItem(local,item).progress === 'done';
        if (mode === 'missing') return !isComplete && (item.missing === true || item.redoRequested === true) && due !== null && due >= cutoff;
        if (mode === 'completed') return isComplete;
        return false;
      });
    }

    function searchRank(item) {
      if (!searching) return 0;
      var due = dateMs(item.dueAt);
      if (!workComplete(item, local) && due !== null && due >= cutoff) return 0;
      if (!workComplete(item, local) && due === null) return 1;
      return 2;
    }

    selected.sort(function (left, right) {
      var rankResult = searchRank(left) - searchRank(right);
      if (rankResult !== 0) return rankResult;

      if (mode === 'completed') {
        var leftChecked = localItem(local, left).checkedOff === true;
        var rightChecked = localItem(local, right).checkedOff === true;
        if (leftChecked !== rightChecked) return leftChecked ? -1 : 1;
        var leftDate = dateMs(left.dueAt), rightDate = dateMs(right.dueAt);
        if (leftDate !== null && rightDate !== null && leftDate !== rightDate) return rightDate - leftDate;
      }

      // The Home shelf owns bookmarks; its deadline list stays chronological.
      if (mode === 'actionable' && options.prioritizePins !== false) {
        var leftPinned = pinned(local, left);
        var rightPinned = pinned(local, right);
        if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
      }
      return compareDueNameId(left, right);
    });

    return {
      items: selected,
      olderCount: olderCount,
      totalScoped: scoped.length,
      searching: searching,
    };
  }

  function summary(items, options) {
    options = options || {};
    var source = Array.isArray(items) ? items : [];
    var now = safeNow(options.now);
    var timeZone = normalizeTimeZone(options.timeZone);
    var courseId = options.courseId === undefined ? 'all' : String(options.courseId);
    var cutoff = now - 14 * DAY;
    var local = options.local || {};
    var counts = { today: 0, tomorrow: 0, week: 0, overdue: 0, undated: 0 };

    source.forEach(function (item) {
      if (!item) return;
      if (courseId !== 'all' && String(item.courseId) !== courseId) return;
      if (workComplete(item, local)) return;

      var due = dateMs(item.dueAt);
      if (due === null) {
        counts.undated += 1;
        return;
      }

      var difference = dayDifference(due, now, timeZone);
      if (difference === 0) counts.today += 1;
      if (difference === 1) counts.tomorrow += 1;
      if (difference !== null && difference >= 0 && difference <= 6) counts.week += 1;
      if (due < now && due >= cutoff) counts.overdue += 1;
    });

    return counts;
  }

  function cleanState(input) {
    var value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    var query = own(value, 'query') && typeof value.query === 'string' ? value.query.slice(0, 200) : '';
    var courseId = own(value, 'courseId') && (value.courseId === 'all' || (typeof value.courseId === 'string' && /^\d+$/.test(value.courseId)))
      ? value.courseId
      : 'all';
    var mode = own(value, 'mode') && typeof value.mode === 'string' && own(KNOWN_MODES, value.mode)
      ? value.mode
      : 'actionable';
    var day = own(value, 'day') && validDay(value.day) ? value.day : '';
    var limit = 60;
    if (own(value, 'limit') && typeof value.limit === 'number' && Number.isFinite(value.limit)) {
      limit = Math.max(60, Math.min(500, Math.floor(value.limit)));
    }

    return { query: query, courseId: courseId, mode: mode, day: day, limit: limit };
  }

  function durationText(milliseconds, overdue) {
    var absolute = Math.abs(milliseconds);
    if (absolute < 3600000) {
      var minutes = Math.max(1, Math.ceil(absolute / 60000));
      return (overdue ? 'Overdue by ' : 'Due in ') + minutes + ' min';
    }
    var hours = Math.max(1, Math.round(absolute / 3600000));
    return (overdue ? 'Overdue by ' : 'Due in ') + hours + ' h';
  }

  function deadlineHint(item, options) {
    options = options || {};

    if (complete(item)) {
      if (item && item.state === 'excused') return 'Excused';
      if (item && item.state === 'graded') return 'Graded';
      return 'Submitted';
    }

    var due = dateMs(item && item.dueAt);
    if (due === null) return 'No due date';

    var now = safeNow(options.now);
    var timeZone = normalizeTimeZone(options.timeZone);
    var difference = dayDifference(due, now, timeZone);
    var delta = due - now;

    if (delta < 0) {
      if (difference !== null && difference < 0) return 'Overdue by ' + Math.abs(difference) + ' d';
      return durationText(delta, true);
    }

    if (difference === 1) return 'Due tomorrow';
    if (difference !== null && difference > 1) return 'Due in ' + difference + ' d';
    if (delta === 0) return 'Due now';
    return durationText(delta, false);
  }

  function cleanCourseView(input, courseId) {
    var value=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
    var state=cleanState(Object.assign({},value,{courseId:courseId}));
    return Object.assign(state,{
      selectedId:typeof value.selectedId==='string'&&/^(?:\d{1,30}|local-[\w-]{1,100})$/.test(value.selectedId)?value.selectedId:null,
      readerTab:value.readerTab==='plan'?'plan':'details',
      readerOpen:value.readerOpen===true,
      readerScroll:typeof value.readerScroll==='number'&&Number.isFinite(value.readerScroll)?Math.max(0,Math.min(1000000,value.readerScroll)):0
    });
  }

  function createCourseMemory(initial) {
    var entries=new Map();
    var valid=id=>typeof id==='string'&&(id==='all'||/^\d{1,30}$/.test(id));
    function remember(id,value){
      if(!valid(id))return;
      entries.delete(id);entries.set(id,cleanCourseView(value,id));
      while(entries.size>64)entries.delete(entries.keys().next().value);
    }
    if(Array.isArray(initial))for(var entry of initial.slice(-64))if(Array.isArray(entry)&&entry.length===2)remember(entry[0],entry[1]);
    return {
      remember,
      recall(id,fallback){return cleanCourseView(entries.get(id)||fallback,id);},
      prune(ids){var visible=new Set(['all',...(Array.isArray(ids)?ids:[])]);for(var id of entries.keys())if(!visible.has(id))entries.delete(id);},
      serialize(){return Array.from(entries,([id,value])=>[id,Object.assign({},value)]);}
    };
  }

  return {
    filterAssignments: filterAssignments,
    summary: summary,
    cleanState: cleanState,
    cleanCourseView: cleanCourseView,
    createCourseMemory: createCourseMemory,
    deadlineHint: deadlineHint,
  };
});
