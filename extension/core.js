/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function (root, factory) {
  'use strict';

  var api = factory();
  root.ReserveCore = api;

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_TIME_ZONE = globalThis.ReserveSite.timeZone();
  var DEFAULT_ORIGIN = (globalThis.ReserveSite.origin());
  var ONLINE_SUBMISSION_TYPES = {
    basic_lti_launch: true,
    discussion_topic: true,
    external_tool: true,
    media_recording: true,
    online_quiz: true,
    online_text_entry: true,
    online_upload: true,
    online_url: true,
    student_annotation: true,
  };

  function stringValue(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function nullableString(value) {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
  }

  function finiteNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
      var converted = Number(value);
      return Number.isFinite(converted) ? converted : null;
    }
    return null;
  }

  function validDate(value) {
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
    }
    if (typeof value === 'string' && value.trim() === '') return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    if (value === null || value === undefined || typeof value === 'boolean') return null;

    var date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function normalizedDateString(value) {
    var date = validDate(value);
    return date ? date.toISOString() : null;
  }

  function isStudentEnrollment(candidate) {
    return candidate && (candidate.type === 'StudentEnrollment' || candidate.type === 'student');
  }

  function isUntypedEnrollment(candidate) {
    return (
      candidate &&
      typeof candidate === 'object' &&
      (candidate.type === null || candidate.type === undefined || candidate.type === '')
    );
  }

  function hasOverallGradeData(candidate) {
    return (
      finiteNumber(candidate && candidate.computed_current_score) !== null ||
      nullableString(candidate && candidate.computed_current_grade) !== null
    );
  }

  function hasCurrentPeriod(candidate) {
    return nullableString(candidate && candidate.current_grading_period_id) !== null;
  }

  function selectCourseEnrollment(enrollments) {
    var students = [];
    var untyped = [];

    for (var index = 0; index < enrollments.length; index += 1) {
      var candidate = enrollments[index];
      if (!candidate || typeof candidate !== 'object') continue;
      if (isStudentEnrollment(candidate)) students.push(candidate);
      else if (isUntypedEnrollment(candidate)) untyped.push(candidate);
    }

    var eligible = students.length > 0 ? students : untyped;
    if (eligible.length === 0) return null;

    for (var periodIndex = 0; periodIndex < eligible.length; periodIndex += 1) {
      if (hasCurrentPeriod(eligible[periodIndex])) return eligible[periodIndex];
    }
    for (var gradeIndex = 0; gradeIndex < eligible.length; gradeIndex += 1) {
      if (hasOverallGradeData(eligible[gradeIndex])) return eligible[gradeIndex];
    }
    return eligible[0];
  }

  function normalizeCourse(raw) {
    raw = raw || {};
    var id = String(raw.id);
    var enrollments = Array.isArray(raw.enrollments) ? raw.enrollments : [];
    var enrollment = selectCourseEnrollment(enrollments);
    var hideFinalGrades = raw.hide_final_grades === true;
    var periodId = enrollment ? nullableString(enrollment.current_grading_period_id) : null;
    var periodTitle = enrollment ? nullableString(enrollment.current_grading_period_title) : null;
    var periodSelected = periodId !== null;
    var overallScore = hideFinalGrades || !enrollment ? null : finiteNumber(enrollment.computed_current_score);
    var overallGrade = hideFinalGrades || !enrollment ? null : nullableString(enrollment.computed_current_grade);
    var score = null;
    var grade = null;
    var scoreScope = hideFinalGrades ? 'hidden' : periodSelected ? 'current-period' : 'overall';

    if (!hideFinalGrades && enrollment) {
      if (periodSelected) {
        score = finiteNumber(enrollment.current_period_computed_current_score);
        grade = nullableString(enrollment.current_period_computed_current_grade);
      } else {
        score = overallScore;
        grade = overallGrade;
      }
    }

    var image = nullableString(raw.image_download_url);
    if (image === null) image = nullableString(raw.image_url);

    return {
      id: id,
      name: stringValue(raw.name),
      code: stringValue(raw.course_code !== undefined ? raw.course_code : raw.code),
      score: score,
      grade: grade,
      scoreScope: scoreScope,
      overallScore: overallScore,
      overallGrade: overallGrade,
      gradingPeriodId: periodId,
      gradingPeriodTitle: periodTitle,
      hideFinalGrades: hideFinalGrades,
      url: '/courses/' + encodeURIComponent(id),
      image: image,
      // The enrollment term (Canvas sends enrollment_term_id; the term's name only with include[]=term).
      termId: stringValue(raw.enrollment_term_id !== undefined && raw.enrollment_term_id !== null ? raw.enrollment_term_id : raw.term && raw.term.id !== undefined ? raw.term.id : raw.termId),
      termName: stringValue(raw.term && raw.term.name !== undefined ? raw.term.name : raw.termName),
    };
  }

  // Courses that are not classes (2.17). Canvas lists school resources (NameCoach,
  // College Counseling) beside the real courses. A course is non-academic when
  //   - its drawing is the pronunciation or the counseling one (course-art.js
  //     decides by the Canvas name and code; the same words are kept here for
  //     pages and tests that run without the art), or
  //   - it sits in the account's default term ("Default Term", or term 1 where
  //     Canvas sent no term name) while more than half of the student's courses
  //     that have a term share one other term.
  // Such courses start hidden. settings.shownCourses holds the ones the student
  // chose to show again and settings.hiddenCourses the ones hidden by hand, so
  // an explicit choice always wins.
  var NON_ACADEMIC_NAME = /namecoach|name coach|pronunc|counsel|advis|college office/;
  function nonAcademicKind(course) {
    var art = typeof globalThis !== 'undefined' ? globalThis.ReserveCourseArt : null;
    if (art && typeof art.kind === 'function') {
      var kind = art.kind({ id: String(course.id), name: course.name, originalName: course.originalName, code: course.code });
      return kind === 'voice' || kind === 'counseling';
    }
    return NON_ACADEMIC_NAME.test([course.originalName, course.name, course.code].filter(Boolean).join(' ').toLowerCase());
  }
  function nonAcademicCourseIds(courses) {
    var list = (Array.isArray(courses) ? courses : []).filter(function (course) { return course && course.id !== undefined && course.id !== null; });
    var counts = {}, withTerm = 0, main = '';
    list.forEach(function (course) {
      var term = stringValue(course.termId);
      if (!term) return;
      withTerm += 1; counts[term] = (counts[term] || 0) + 1;
      if (!main || counts[term] > counts[main]) main = term;
    });
    var shared = !!main && counts[main] >= 2 && counts[main] * 2 > withTerm;
    var out = new Set();
    list.forEach(function (course) {
      var term = stringValue(course.termId), name = stringValue(course.termName).trim();
      var defaultTerm = name ? /^default(?: term)?$/i.test(name) : term === '1';
      if (nonAcademicKind(course) || (shared && term && term !== main && defaultTerm)) out.add(String(course.id));
    });
    return out;
  }
  // Every id that is hidden right now: hidden by hand, or non-academic and never shown by hand.
  function hiddenCourseIds(courses, settings) {
    var s = settings || {};
    var hidden = new Set((Array.isArray(s.hiddenCourses) ? s.hiddenCourses : []).map(String));
    var shown = new Set((Array.isArray(s.shownCourses) ? s.shownCourses : []).map(String));
    nonAcademicCourseIds(courses).forEach(function (id) { if (!shown.has(id)) hidden.add(id); });
    return hidden;
  }
  // The one way a visibility choice is stored: the two lists never share an id.
  function setCourseVisible(settings, id, visible) {
    id = String(id);
    var without = function (list) { return (Array.isArray(list) ? list : []).map(String).filter(function (x) { return x !== id; }); };
    settings.hiddenCourses = without(settings.hiddenCourses);
    settings.shownCourses = without(settings.shownCourses);
    (visible ? settings.shownCourses : settings.hiddenCourses).push(id);
    return settings;
  }

  // Course naming conventions differ by school. Preserve the supplied title.
  function courseLabel(name) {
    return {title:stringValue(name).replace(/\s+/g,' ').trim(),teacher:'',sub:'',tag:'',subject:''};
  }

  function hasOnlineSubmissionType(types) {
    for (var index = 0; index < types.length; index += 1) {
      if (ONLINE_SUBMISSION_TYPES[types[index]]) return true;
    }
    return false;
  }

  function submissionState(submission, submissionTypes) {
    if (submission && typeof submission === 'object') {
      if (submission.excused === true) return 'excused';

      var workflow = stringValue(submission.workflow_state).toLowerCase();
      if (workflow === 'graded') return 'graded';
      if (workflow === 'submitted' || workflow === 'pending_review') return 'submitted';
      if (workflow === 'unsubmitted') return 'unsubmitted';

      if (validDate(submission.graded_at)) return 'graded';
      if (validDate(submission.submitted_at)) return 'submitted';
      if (finiteNumber(submission.attempt) !== null && finiteNumber(submission.attempt) > 0) {
        return 'submitted';
      }
      if (submission.missing === true) return 'unsubmitted';

      return hasOnlineSubmissionType(submissionTypes) ? 'unsubmitted' : 'unknown';
    }

    return hasOnlineSubmissionType(submissionTypes) ? 'unsubmitted' : 'unknown';
  }

  function hasSubmissionEvidence(submission) {
    if (!submission || typeof submission !== 'object') return false;

    var attempt = finiteNumber(submission.attempt);
    if (attempt !== null && attempt > 0) return true;
    if (validDate(submission.submitted_at)) return true;

    var submissionType = nullableString(submission.submission_type);
    return submissionType !== null && submissionType.toLowerCase() !== 'none';
  }

  function safeCanvasAssignmentUrl(value, courseId, assignmentId) {
    var fallback =
      '/courses/' + encodeURIComponent(courseId) + '/assignments/' + encodeURIComponent(assignmentId);
    if (typeof value !== 'string' || value.trim() === '') return fallback;

    var text = value.trim();
    if (/^\/courses\//.test(text)) return text;

    try {
      var parsed = new URL(text);
      if (parsed.protocol === 'https:' && parsed.origin === DEFAULT_ORIGIN && !parsed.username && !parsed.password) {
        return parsed.href;
      }
    } catch (_error) {
      return fallback;
    }

    return fallback;
  }

  function normalizeAssignment(raw, course) {
    raw = raw || {};
    course = course || {};

    var id = String(raw.id);
    var courseId = String(course.id);
    var submissionTypes = Array.isArray(raw.submission_types)
      ? raw.submission_types.map(function (value) {
          return String(value);
        })
      : [];
    var rubric = Array.isArray(raw.rubric) ? raw.rubric.slice() : [];
    var submission = raw.submission && typeof raw.submission === 'object' ? raw.submission : null;

    return {
      id: id,
      courseId: courseId,
      courseName: stringValue(course.name),
      name: stringValue(raw.name),
      description: typeof raw.description === 'string' ? raw.description : '',
      dueAt: normalizedDateString(raw.due_at),
      unlockAt: normalizedDateString(raw.unlock_at),
      lockAt: normalizedDateString(raw.lock_at),
      url: safeCanvasAssignmentUrl(raw.html_url, courseId, id),
      points: finiteNumber(raw.points_possible),
      score: submission && !(Object.prototype.hasOwnProperty.call(submission,'posted_at') && !submission.posted_at) ? finiteNumber(submission.score) : null,
      grade: submission && !(Object.prototype.hasOwnProperty.call(submission,'posted_at') && !submission.posted_at) ? nullableString(submission.grade) : null,
      gradedAt: normalizedDateString(submission && submission.graded_at),
      gradeMatchesCurrentSubmission: submission && typeof submission.grade_matches_current_submission === 'boolean' ? submission.grade_matches_current_submission : null,
      state: submissionState(submission, submissionTypes),
      missing: submission ? submission.missing === true : false,
      late: submission ? submission.late === true : false,
      redoRequested: submission ? submission.redo_request === true : false,
      hasSubmission: hasSubmissionEvidence(submission),
      locked: raw.locked_for_user === true || raw.locked === true,
      submissionTypes: submissionTypes,
      rubric: rubric,
      updatedAt: normalizedDateString(raw.updated_at),
    };
  }

  function dayKey(value, timeZone) {
    var date = validDate(value);
    if (!date) return null;

    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || DEFAULT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    var parts = formatter.formatToParts(date);
    var values = {};

    for (var index = 0; index < parts.length; index += 1) {
      var part = parts[index];
      if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
        values[part.type] = part.value;
      }
    }

    if (!values.year || !values.month || !values.day) return null;
    return values.year + '-' + values.month + '-' + values.day;
  }

  function dayOrdinal(key) {
    if (typeof key !== 'string') return null;
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!match) return null;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
  }

  function isComplete(item) {
    if (!item) return false;
    if (item.personal === true) return item.state === 'done';
    if (item.state === 'excused') return true;
    if (item.missing === true || item.redoRequested === true) return false;
    return item.state === 'submitted' || item.state === 'graded';
  }

  // A local check-off clears personal work queues, never Canvas submission state.
  function isWorkComplete(item, localItem) {
    return isComplete(item) || localItem?.checkedOff === true;
  }

  function dueBucket(item, now, timeZone) {
    if (isComplete(item)) return 'completed';

    var due = validDate(item && item.dueAt);
    if (!due) return 'undated';

    var nowDate = validDate(now === undefined ? Date.now() : now);
    if (!nowDate) nowDate = new Date();
    if (due.getTime() < nowDate.getTime()) return 'overdue';

    var zone = timeZone || DEFAULT_TIME_ZONE;
    var nowDay = dayOrdinal(dayKey(nowDate, zone));
    var dueDay = dayOrdinal(dayKey(due, zone));
    if (nowDay === null || dueDay === null) return 'later';

    var difference = dueDay - nowDay;
    if (difference <= 0) return 'today';
    if (difference === 1) return 'tomorrow';
    if (difference <= 7) return 'week';
    return 'later';
  }

  function searchText(value) {
    var text = stringValue(value);
    if (typeof text.normalize === 'function') text = text.normalize('NFD');
    return text.replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function compareText(left, right) {
    var a = searchText(left);
    var b = searchText(right);
    if (a < b) return -1;
    if (a > b) return 1;

    a = stringValue(left);
    b = stringValue(right);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function tieByNameAndId(left, right) {
    var nameResult = compareText(left && left.name, right && right.name);
    if (nameResult !== 0) return nameResult;
    return compareText(left && left.id, right && right.id);
  }

  function localState(local, item) {
    var id = String(item && item.id);
    if (!local || typeof local !== 'object') return {};
    if (!Object.prototype.hasOwnProperty.call(local, id)) return {};
    var value = local[id];
    return value && typeof value === 'object' ? value : {};
  }

  function dueMs(item) {
    var date = validDate(item && item.dueAt);
    return date ? date.getTime() : null;
  }

  function dueDayDifference(item, now, timeZone) {
    var due = validDate(item && item.dueAt);
    if (!due) return null;

    var nowDate = validDate(now);
    if (!nowDate) nowDate = new Date();
    var zone = timeZone || DEFAULT_TIME_ZONE;
    var nowDay = dayOrdinal(dayKey(nowDate, zone));
    var dueDay = dayOrdinal(dayKey(due, zone));
    if (nowDay === null || dueDay === null) return null;
    return dueDay - nowDay;
  }

  function selectAssignments(items, options) {
    var source = Array.isArray(items) ? items : [];
    options = options || {};

    var query = searchText(options.query || '');
    var courseId = options.courseId === undefined ? 'all' : String(options.courseId);
    var view = options.view || 'open';
    var sort = options.sort || 'due';
    var now = options.now === undefined ? Date.now() : options.now;
    var timeZone = options.timeZone || DEFAULT_TIME_ZONE;
    var local = options.local || {};

    var selected = source.filter(function (item) {
      if (!item) return false;
      if (courseId !== 'all' && String(item.courseId) !== courseId) return false;

      if (query) {
        var haystack = searchText(item.name) + '\n' + searchText(item.courseName);
        if (haystack.indexOf(query) === -1) return false;
      }

      var bucket = dueBucket(item, now, timeZone);
      var localItem = localState(local, item);

      if (view === 'all') return true;
      if (view === 'open') return !isWorkComplete(item, localItem);
      if (view === 'today') {
        return !isWorkComplete(item, localItem) && dueDayDifference(item, now, timeZone) === 0;
      }
      if (view === 'overdue') return !isWorkComplete(item, localItem) && bucket === 'overdue';
      if (view === 'week') {
        var dayDifference = dueDayDifference(item, now, timeZone);
        return !isWorkComplete(item, localItem) && dayDifference !== null && dayDifference >= 0 && dayDifference <= 7;
      }
      if (view === 'undated') return bucket === 'undated';
      if (view === 'completed') return isWorkComplete(item, localItem);
      if (view === 'pinned') return localItem.pinned === true;
      if (view === 'in-progress') return localItem.progress === 'in-progress' && !isWorkComplete(item, localItem);
      return true;
    });

    selected.sort(function (left, right) {
      var result = 0;

      if (sort === 'course') {
        result = compareText(left.courseName, right.courseName);
      } else if (sort === 'points') {
        var leftPoints = finiteNumber(left.points);
        var rightPoints = finiteNumber(right.points);
        if (leftPoints === null && rightPoints !== null) result = 1;
        else if (leftPoints !== null && rightPoints === null) result = -1;
        else if (leftPoints !== null && rightPoints !== null && leftPoints !== rightPoints) {
          result = rightPoints - leftPoints;
        }
      } else if (sort === 'priority') {
        var leftPinned = localState(local, left).pinned === true;
        var rightPinned = localState(local, right).pinned === true;
        if (leftPinned !== rightPinned) {
          result = leftPinned ? -1 : 1;
        } else {
          var leftPriorityDue = dueMs(left);
          var rightPriorityDue = dueMs(right);
          if (leftPriorityDue === null && rightPriorityDue !== null) result = 1;
          else if (leftPriorityDue !== null && rightPriorityDue === null) result = -1;
          else if (
            leftPriorityDue !== null &&
            rightPriorityDue !== null &&
            leftPriorityDue !== rightPriorityDue
          ) {
            result = leftPriorityDue - rightPriorityDue;
          }
        }
      } else {
        var leftDue = dueMs(left);
        var rightDue = dueMs(right);
        if (leftDue === null && rightDue !== null) result = 1;
        else if (leftDue !== null && rightDue === null) result = -1;
        else if (leftDue !== null && rightDue !== null && leftDue !== rightDue) {
          result = leftDue - rightDue;
        }
      }

      return result !== 0 ? result : tieByNameAndId(left, right);
    });

    return selected;
  }

  function formatUTC(value) {
    var date = validDate(value);
    if (!date) return null;
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }

  function escapeICSText(value) {
    return stringValue(value)
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  }

  function utf8Bytes(character) {
    var code = character.codePointAt(0);
    if (code <= 0x7f) return 1;
    if (code <= 0x7ff) return 2;
    if (code <= 0xffff) return 3;
    return 4;
  }

  function foldICSLine(line) {
    var physicalLines = [];
    var current = '';
    var currentBytes = 0;

    for (var _iterator = line[Symbol.iterator](), step; !(step = _iterator.next()).done; ) {
      var character = step.value;
      var bytes = utf8Bytes(character);
      if (currentBytes + bytes > 75 && current !== '') {
        physicalLines.push(current);
        current = ' ' + character;
        currentBytes = 1 + bytes;
      } else {
        current += character;
        currentBytes += bytes;
      }
    }

    physicalLines.push(current);
    return physicalLines.join('\r\n');
  }

  function safeOrigin(value) {
    try {
      var parsed = new URL(value || DEFAULT_ORIGIN);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return DEFAULT_ORIGIN;
      return parsed.origin;
    } catch (_error) {
      return DEFAULT_ORIGIN;
    }
  }

  function safeSourceUrl(item, origin) {
    var fallback =
      origin +
      '/courses/' +
      encodeURIComponent(String(item.courseId)) +
      '/assignments/' +
      encodeURIComponent(String(item.id));
    var value = item && item.url;

    if (typeof value !== 'string' || value.trim() === '') return fallback;

    try {
      var parsed = new URL(value.trim(), origin + '/');
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    } catch (_error) {
      return fallback;
    }
    return fallback;
  }

  function uidPart(value) {
    return encodeURIComponent(String(value));
  }

  function exportICS(items, options) {
    options = options || {};
    var nowValue = options.now === undefined ? Date.now() : options.now;
    var stamp = formatUTC(nowValue) || formatUTC(Date.now());
    var origin = safeOrigin(options.origin || DEFAULT_ORIGIN);
    var source = Array.isArray(items) ? items : [];
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Canvas Harness Canvas Companion//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (var index = 0; index < source.length; index += 1) {
      var item = source[index];
      if (!item || isComplete(item)) continue;

      var start = formatUTC(item.dueAt);
      if (!start) continue;

      var sourceUrl = safeSourceUrl(item, origin);
      var descriptionParts = [];
      if (item.courseName) descriptionParts.push(stringValue(item.courseName));
      if (item.description) descriptionParts.push(stringValue(item.description));
      descriptionParts.push('Source: ' + sourceUrl);

      lines.push('BEGIN:VEVENT');
      lines.push(
        'UID:reserve-' + uidPart(item.courseId) + '-' + uidPart(item.id) + '@' + new URL(origin).hostname,
      );
      lines.push('DTSTAMP:' + stamp);
      lines.push('DTSTART:' + start);
      lines.push('SUMMARY:' + escapeICSText(item.name));
      lines.push('DESCRIPTION:' + escapeICSText(descriptionParts.join('\n')));
      lines.push('URL:' + sourceUrl);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return (
      lines
        .map(function (line) {
          return foldICSLine(line);
        })
        .join('\r\n') + '\r\n'
    );
  }

  // A focus session runs in the planner but may end while the dashboard (or
  // nothing) is open. Every view settles it through this one rule, once.
  function settleFocus(data, now) {
    var focus = data && data.focus;
    var at = typeof now === 'number' ? now : Date.now();
    if (!focus || !focus.endsAt || at < focus.endsAt) return false;
    focus.endsAt = null;
    focus.remaining = 0;
    focus.sessions = (Number.isInteger(focus.sessions) ? focus.sessions : 0) + 1;
    return true;
  }

  // "mm:ss" left in a running session, or '' when none is running.
  function focusClock(focus, now) {
    if (!focus || !focus.endsAt) return '';
    var at = typeof now === 'number' ? now : Date.now();
    var left = Math.max(0, Math.ceil((focus.endsAt - at) / 1000));
    var pad = function (value) {
      return (value < 10 ? '0' : '') + value;
    };
    return pad(Math.floor(left / 60)) + ':' + pad(left % 60);
  }

  // A course colour that is safe to carry text, rings and motif strokes. A fixed
  // 80/20 course/ink mix left light colours (#F0C419, #C9A227, #7FB3D5) at 2-3:1,
  // so the mix walks from 80% course toward ink (#141413) in oklab, 5% at a time,
  // until it reads at 4.5:1 on the ivory page (#FAF9F5) and 3:1 on the course's
  // own 28% wash over the rail (#F3F1EA).
  var INK = '#141413', PAGE = '#FAF9F5', RAIL = '#F3F1EA';
  function hexRGB(hex) {
    return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; });
  }
  function toLinear(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function fromLinear(v) { return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function oklab(rgb) {
    var l = rgb.map(toLinear);
    var L = Math.cbrt(0.4122214708 * l[0] + 0.5363325363 * l[1] + 0.0514459929 * l[2]);
    var M = Math.cbrt(0.2119034982 * l[0] + 0.6806995451 * l[1] + 0.1073969566 * l[2]);
    var S = Math.cbrt(0.0883024619 * l[0] + 0.2817188376 * l[1] + 0.6299787005 * l[2]);
    return [0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S, 1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S, 0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S];
  }
  function fromOklab(lab) {
    var L = Math.pow(lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2], 3);
    var M = Math.pow(lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2], 3);
    var S = Math.pow(lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2], 3);
    return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S]
      .map(function (v) { return Math.min(1, Math.max(0, fromLinear(v))); });
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) { return Math.round(v * 255).toString(16).padStart(2, '0'); }).join('').toUpperCase();
  }
  function luminance(rgb) {
    var l = rgb.map(toLinear);
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function courseInk(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return INK;
    var course = hexRGB(hex), ink = oklab(hexRGB(INK)), from = oklab(course), rail = hexRGB(RAIL), page = hexRGB(PAGE);
    var wash = course.map(function (v, i) { return v * 0.28 + rail[i] * 0.72; });
    for (var share = 80; share >= 0; share -= 5) {
      var p = share / 100, rgb = fromOklab(from.map(function (v, i) { return v * p + ink[i] * (1 - p); }));
      // Checked on the 8-bit colour that is actually emitted.
      var shown = hexRGB(toHex(rgb));
      if (contrast(shown, page) >= 4.5 && contrast(shown, wash) >= 3) return toHex(rgb);
    }
    return INK;
  }

  return {
    courseInk: courseInk,
    normalizeCourse: normalizeCourse,
    nonAcademicCourseIds: nonAcademicCourseIds,
    hiddenCourseIds: hiddenCourseIds,
    setCourseVisible: setCourseVisible,
    normalizeAssignment: normalizeAssignment,
    courseLabel: courseLabel,
    settleFocus: settleFocus,
    focusClock: focusClock,
    dayKey: dayKey,
    dueBucket: dueBucket,
    isComplete: isComplete,
    isWorkComplete: isWorkComplete,
    selectAssignments: selectAssignments,
    exportICS: exportICS,
  };
});
