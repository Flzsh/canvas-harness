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
    var liveEnrollments = enrollments.filter(function(e){return (isStudentEnrollment(e)||isUntypedEnrollment(e))&&(!e.enrollment_state||e.enrollment_state==='active');});
    var courseEnrollment = liveEnrollments[0] || enrollment;
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
      nickname:stringValue(raw.nickname),
      myGroups:Array.isArray(raw.myGroups)?raw.myGroups:[],
      timeZone:stringValue(raw.time_zone||raw.timeZone),
      termStartAt:normalizedDateString(raw.term&&raw.term.start_at||raw.termStartAt),
      termEndAt:normalizedDateString(raw.term&&raw.term.end_at||raw.termEndAt),
      workflowState:stringValue(raw.workflow_state||raw.workflowState),
      enrollmentState:stringValue(courseEnrollment&&courseEnrollment.enrollment_state),
      courseSectionId:courseEnrollment&&courseEnrollment.course_section_id!=null?String(courseEnrollment.course_section_id):null,
      courseSectionIds:liveEnrollments.filter(function(e){return e.course_section_id!=null;}).map(function(e){
        return String(e.course_section_id);
      }).filter(function(v,i,a){
        return a.indexOf(v)===i;
      }),
      url: '/courses/' + encodeURIComponent(id),
      image: image,
      // The enrollment term (Canvas sends enrollment_term_id; the term's name only with include[]=term).
      termId: stringValue(raw.enrollment_term_id !== undefined && raw.enrollment_term_id !== null ?
        raw.enrollment_term_id :
        raw.term && raw.term.id !== undefined ? raw.term.id : raw.termId),
      applyAssignmentGroupWeights:raw.apply_assignment_group_weights===true,
      latePolicy:raw.late_policy||null,
      termName: stringValue(raw.term && raw.term.name !== undefined ? raw.term.name : raw.termName),
    };
  }

  // Courses that are not classes (2.17). Canvas lists school resources (a name-pronunciation tool,
  // a counseling group) beside the real courses. A course is non-academic when
  //   - its drawing is the pronunciation or the counseling one (course-art.js
  //     decides by the Canvas name and code; the same words are kept here for
  //     pages and tests that run without the art), or
  //   - it sits in the account's default term ("Default Term", or term 1 where
  //     Canvas sent no term name) while more than half of the student's courses
  //     that have a term share one other term.
  // Such courses start hidden. settings.shownCourses holds the ones the student
  // chose to show again and settings.hiddenCourses the ones hidden by hand, so
  // an explicit choice always wins.
  var NON_ACADEMIC_NAME = /name ?coach|pronunc|counsel|advis|college office/;
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
    var quiz=raw.quiz&&typeof raw.quiz==='object'?raw.quiz:null;
    // Canvas repeats discussion requirements on topics, assignments and checkpoints.
    var topic=raw.discussion_topic&&typeof raw.discussion_topic==='object'?raw.discussion_topic:raw;
    var replyCount=raw.reply_to_entry_required_count??topic.reply_to_entry_required_count;
    var count=function(value){return Number.isInteger(value)&&value>=0?value:null;};

    return {
      id: id,
      courseId: courseId,
      courseName: stringValue(course.name),
      name: stringValue(raw.name),
      description: typeof raw.description === 'string' && raw.description.trim() ? raw.description : typeof topic.message==='string'?topic.message:'',
      dueAt: normalizedDateString(raw.due_at!==undefined?raw.due_at:quiz&&quiz.due_at),
      unlockAt: normalizedDateString(raw.unlock_at!==undefined?raw.unlock_at:quiz&&quiz.unlock_at),
      lockAt: normalizedDateString(raw.lock_at!==undefined?raw.lock_at:quiz&&quiz.lock_at),
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
      gradingType:stringValue(raw.grading_type),
      assignmentGroupId:nullableString(raw.assignment_group_id),
      assignmentGroup:raw.assignment_group?
        {
          id:stringValue(raw.assignment_group.id),
          name:stringValue(raw.assignment_group.name),
          weight:finiteNumber(raw.assignment_group.group_weight),
          groupWeight:finiteNumber(raw.assignment_group.group_weight),
          weighted:course.applyAssignmentGroupWeights===true||course.apply_assignment_group_weights===true
        }:
        null,
      extraCredit:raw.is_extra_credit===true,
      optionalForGrade:raw.omit_from_final_grade===true||
        raw.is_extra_credit===true||
        !!(raw.assignment_group&&(course.applyAssignmentGroupWeights===true||course.apply_assignment_group_weights===true)&&raw.assignment_group.group_weight===0),
      hasSubAssignments:raw.has_sub_assignments===true,
      replyToEntryRequiredCount:count(replyCount),
      requireInitialPost:typeof raw.require_initial_post==='boolean'?raw.require_initial_post:typeof topic.require_initial_post==='boolean'?topic.require_initial_post:null,
      userCanSeePosts:typeof raw.user_can_see_posts==='boolean'?raw.user_can_see_posts:typeof topic.user_can_see_posts==='boolean'?topic.user_can_see_posts:null,
      checkpoints:(Array.isArray(raw.sub_assignments)?
        raw.sub_assignments:
        Array.isArray(raw.checkpoints)?raw.checkpoints:Array.isArray(topic.checkpoints)?topic.checkpoints:[]).map(function(c){
        return {
          id:stringValue(c.id),
          tag:stringValue(c.sub_assignment_tag||c.tag),
          name:stringValue(c.name),
          requiredCount:count(c.required_count??((c.sub_assignment_tag||c.tag)==='reply_to_entry'?replyCount:null)),
          dueAt:normalizedDateString(c.due_at),
          unlockAt:normalizedDateString(c.unlock_at),
          lockAt:normalizedDateString(c.lock_at),
          points:finiteNumber(c.points_possible),
          done:!!(c.submission&&/^(submitted|graded)$/.test(c.submission.workflow_state))
        };
      }),
      quizId:nullableString(raw.quiz_id||quiz&&quiz.id),
      quiz: quiz ?
        {
          quizId:String(quiz.id),
          quizType:stringValue(quiz.quiz_type),
          timeLimit:finiteNumber(quiz.time_limit),
          allowedAttempts:Number.isInteger(quiz.allowed_attempts)?quiz.allowed_attempts:null,
          scoringPolicy:stringValue(quiz.scoring_policy),
          oneQuestionAtATime:quiz.one_question_at_a_time===true,
          cantGoBack:quiz.cant_go_back===true,
          requireLockdownBrowser:quiz.require_lockdown_browser===true,
          unlockAt:normalizedDateString(quiz.unlock_at),
          lockAt:normalizedDateString(quiz.lock_at),
          dueAt:normalizedDateString(quiz.due_at)
        } :
        null,
      updatedAt: normalizedDateString(raw.updated_at),
      // how the work is handed in, for preparing it: attempts, group, peer review, file types, the outside tool, the
      // document to annotate
      allowedAttempts: Number.isInteger(raw.allowed_attempts) && (raw.allowed_attempts > 0 || raw.allowed_attempts === -1) ? raw.allowed_attempts : null,
      attemptsUsed: submission && Number.isInteger(submission.attempt) ? submission.attempt : null,
      groupWork: raw.group_category_id != null,
      groupCategoryId:nullableString(raw.group_category_id),
      individuallyGraded:raw.grade_group_students_individually===true,
      gradeGroupStudentsIndividually:raw.grade_group_students_individually===true,
      myGroup:(course.myGroups||[]).find(function(g){return String(g.groupCategoryId)===String(raw.group_category_id);})||null,
      peerReviews: raw.peer_reviews === true,
      peerReviewsAt: normalizedDateString(raw.peer_reviews_assign_at),
      allowedExtensions: Array.isArray(raw.allowed_extensions) ? raw.allowed_extensions.slice(0, 20).map(function (value) { return String(value).slice(0, 12); }) : [],
      externalTool: toolHost(raw.external_tool_tag_attributes && raw.external_tool_tag_attributes.url),
      annotatableAttachmentId: raw.annotatable_attachment_id != null && /^\d+$/.test(String(raw.annotatable_attachment_id)) ? String(raw.annotatable_attachment_id) : null,
      lockExplanation: typeof raw.lock_explanation === 'string' ? raw.lock_explanation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) : '',
      optional: raw.omit_from_final_grade === true,
    };
  }
  function toolHost(value) {
    try { var url = new URL(String(value || '')); return url.protocol === 'https:' ? url.hostname.replace(/^(?:www|api)\./, '').slice(0, 80) : ''; } catch (error) { return ''; }
  }
  function latePolicyText(p){
    if(!p||typeof p!=='object')return '';
    var parts=[];
    if(p.late_submission_deduction_enabled===true&&Number.isFinite(p.late_submission_deduction))
      parts.push('Late work loses '+p.late_submission_deduction+'% per '+stringValue(p.late_submission_interval||'interval'));
    if(p.late_submission_deduction_enabled===false)parts.push('No automatic late deduction');
    if(p.late_submission_minimum_percent_enabled===true&&Number.isFinite(p.late_submission_minimum_percent))parts.push('late deductions stop at '+p.late_submission_minimum_percent+'%');
    if(p.missing_submission_deduction_enabled===true&&Number.isFinite(p.missing_submission_deduction))parts.push('missing-work deduction '+p.missing_submission_deduction+'%');
    return parts.length?'Course late policy: '+parts.join(', '):'';
  }
  // Prefer distinct requirements over repeated background, while preserving their source order.
  function smartCut(text,max){
    text=String(text||'');if(text.length<=max)return text;max=Math.max(0,Math.floor(max));if(max<40)return text.slice(0,max);
    var rows=text.split(/\n+|(?<=[.!?;])\s+/).flatMap(function(t){var out=[];for(var i=0;i<t.length;i+=1500)out.push(t.slice(i,i+1500));return out;}),seen=new Set(),parts=[],used=0,room=max-32;
    rows.forEach(function(t,i){
      if(!t.trim()||max<=40000&&seen.has(t))return;
      seen.add(t);
      var score=(/\b(?:must|required?|deadline|due|rubric|criteria|submit|bring|keep|return|before|after|policy|late|makeup|retake|calibration)\b/i.test(t)?8:0)+(/\d/.test(t)?5:0)+(i===0||i===rows.length-1?4:0);
      parts.push({i:i,text:t,score:score});
    });
    var selected=[];
    parts.sort(function(a,b){return b.score-a.score||a.i-b.i;}).forEach(function(p){
      var available=room-used;
      if(available<24)return;
      var body=p.text.length>available?p.text.slice(0,available-4)+' ...':p.text;
      selected.push({i:p.i,text:body});
      used+=body.length+2;
    });
    return ('[Excerpts; source shortened]\n'+selected.sort(function(a,b){return a.i-b.i;}).map(function(p){return p.text;}).join('\n\n')).slice(0,max);
  }

  // One formatter per time zone, and the answer per instant: a new Intl.DateTimeFormat on every call cost ~50-70 us,
  // and a render asks for every assignment's day (work-model insights, the planner, the toolbox).
  // Both caches are bounded; a bad zone still throws RangeError because a formatter is only cached once it is built.
  var dayKeyFormatters = new Map();
  var dayKeyMemo = new Map();
  function dayKey(value, timeZone) {
    var date = validDate(value);
    if (!date) return null;

    var zone = timeZone || DEFAULT_TIME_ZONE;
    var memo = zone + '|' + date.getTime();
    if (dayKeyMemo.has(memo)) return dayKeyMemo.get(memo);
    var formatter = dayKeyFormatters.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      if (dayKeyFormatters.size >= 12) dayKeyFormatters.clear();
      dayKeyFormatters.set(zone, formatter);
    }
    var parts = formatter.formatToParts(date);
    var values = {};

    for (var index = 0; index < parts.length; index += 1) {
      var part = parts[index];
      if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
        values[part.type] = part.value;
      }
    }

    var key = !values.year || !values.month || !values.day ? null : values.year + '-' + values.month + '-' + values.day;
    if (dayKeyMemo.size >= 4096) dayKeyMemo.clear();
    dayKeyMemo.set(memo, key);
    return key;
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

  function focusState(focus, now) {
    var f = focus || {}, at = typeof now === 'number' ? now : Date.now();
    var minutes = Number.isFinite(f.minutes) && f.minutes > 0 && Number.isFinite(f.minutes * 60) ? f.minutes : 25;
    var total = minutes * 60, running = !!f.endsAt, remaining = Number.isFinite(f.remaining) ? Math.max(0, f.remaining) : total;
    var left = running ? Math.max(0, (f.endsAt - at) / 1000) : remaining;
    // elapsed stores time in this phase before the current run; remaining anchors that run.
    var elapsed = (Number.isFinite(f.elapsed) ? Math.max(0, f.elapsed) : Math.max(0, total - remaining)) + (running ? Math.max(0, remaining - left) : 0);
    var paused = !running && !f.stoppedAt && !f.completedAt && left > 0 && (!!f.pausedAt || elapsed > 0 || left < total);
    return {
      minutes:minutes,
      total:total,
      running:running,
      paused:paused,
      active:running||paused,
      left:left,
      elapsed:elapsed,
      progress:Math.max(0,Math.min(1,1-left/total)),
      sessions:f.sessions||0,
      phase:f.phase==='break'?'break':'focus'
    };
  }

  function resetFocus(focus, minutes, now) {
    var at = typeof now === 'number' ? now : Date.now();
    if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(at + minutes * 60000) || at + minutes * 60000 > 8640000000000000) return null;
    var next = Object.assign({}, focus, {
      minutes:minutes,
      remaining:minutes*60,
      elapsed:0,
      pausedAt:0,
      stoppedAt:0,
      endsAt:at+minutes*60000,
      completedAt:0,
      completedMinutes:0,
      breakUntil:0
    });
    ['phase','focusMinutes','breakMinutes','cycles','cycle'].forEach(function (key) { delete next[key]; });
    return next;
  }

  // A focus session runs in the planner but may end while the dashboard (or
  // nothing) is open. Every view settles it through this one rule, once.
  function settleFocus(data, now) {
    var focus = data && data.focus;
    var at = typeof now === 'number' ? now : Date.now();
    if (!focus || !Number.isFinite(focus.endsAt) || !focus.endsAt || focus.stoppedAt || at < focus.endsAt) return false;
    var completed = false;
    var sequence = (focus.phase==='focus'||focus.phase==='break') &&
      Number.isInteger(focus.cycles) &&
      focus.cycles>0 &&
      focus.cycles<=1000 &&
      Number.isInteger(focus.cycle) &&
      focus.cycle>0 &&
      focus.cycle<=focus.cycles &&
      Number.isFinite(focus.focusMinutes) &&
      focus.focusMinutes>0 &&
      Number.isFinite(focus.breakMinutes) &&
      focus.breakMinutes>=0;
    while (focus.endsAt && at>=focus.endsAt) {
      var ended = focus.endsAt, rest = focus.phase==='break';
      focus.elapsed = focusState(focus, ended).elapsed;
      focus.endsAt = null;
      focus.remaining = 0;
      if (!rest) {
        focus.completedAt = ended;
        focus.completedMinutes = focus.elapsed / 60;
        focus.sessions = (Number.isInteger(focus.sessions) ? focus.sessions : 0) + 1;
        completed = true;
      } else {
        focus.breakUntil = 0;
        focus.completedAt = 0;
      }
      if (!sequence) break;
      var phase = !rest && focus.breakMinutes>0 ? 'break' : focus.cycle<focus.cycles ? 'focus' : null;
      if (!phase) break;
      var minutes = phase==='break' ? focus.breakMinutes : focus.focusMinutes, until = ended+minutes*60000;
      if (!Number.isFinite(until) || until>8640000000000000 || until<=ended) break;
      if (phase==='focus') focus.cycle+=1;
      Object.assign(focus,{phase:phase,minutes:minutes,remaining:minutes*60,elapsed:0,pausedAt:0,completedAt:0,endsAt:until,breakUntil:phase==='break'?until:0});
    }
    // Views use this result to reward focus. A break transition still persists, but earns no reward.
    return completed;
  }

  // "mm:ss" left in a running or paused session; stopped and finished sessions have no clock.
  function focusClock(focus, now) {
    if (!focus || focus.stoppedAt) return '';
    var state = focusState(focus, now);
    if (!state.active) return '';
    var left = Math.ceil(state.left);
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
    latePolicyText:latePolicyText,
    smartCut:smartCut,
    courseLabel: courseLabel,
    settleFocus: settleFocus,
    focusClock: focusClock,
    focusState: focusState,
    resetFocus: resetFocus,
    dayKey: dayKey,
    dueBucket: dueBucket,
    isComplete: isComplete,
    isWorkComplete: isWorkComplete,
    selectAssignments: selectAssignments,
    exportICS: exportICS,
  };
});
