'use strict';
// Job biscuit-42, round 2 (2026-11-22): a second invented student, for set C only (so the round 2 fixes are measured on
// courses and work they were not written against). Made-up courses, teachers and work; no real people or Canvas data.
// "now" is Wednesday 16 December 2026, 8:20 PM in New York (UTC-5).
const DAY = 864e5;
const wall = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h + 5, mi);
const NOW = wall(2026, 12, 16, 20, 20);
function world({ at = NOW, grades = true, extra = {} } = {}) {
  const now = at, iso = v => new Date(v).toISOString();
  const due = (d, h = 23, mi = 59) => iso(wall(2026, 12, 16, h, mi) + d * DAY);
  const courses = [
    { id: '401', name: 'Honors Chemistry', shortName: 'Chem H', course_code: 'CHM 210', color: '#B54B26', score: 82.3 },
    { id: '402', name: 'AP Calculus AB', shortName: 'Calc AB', course_code: 'MTH 400', color: '#2E6BA8', score: 91.0 },
    { id: '403', name: 'American Literature', shortName: 'Am Lit', course_code: 'ENG 11', color: '#7A4E9E', score: 88.8 },
    { id: '404', name: 'World History II', shortName: 'World Hist', course_code: 'HIS 202', color: '#A87A12', score: 93.5 },
    { id: '405', name: 'French II', shortName: 'French 2', course_code: 'FRE 200', color: '#0F7C8C', score: 76.2 },
    { id: '406', name: 'Computer Science Principles', shortName: 'CSP', course_code: 'CS 150', color: '#3E7D5A', score: 99.1 },
    { id: '407', name: 'Health & Wellness', shortName: 'Health', course_code: 'HLT 100', color: '#9E4E6A', score: 95.0 }
  ];
  // [id, title, courseId, day offset, hour, minute, state, points, extra]
  const rows = [
    ['c1', 'Stoichiometry Practice', '401', 0, 23, 59, 'open', 20],
    ['c2', 'Gas Laws Lab Writeup', '401', 2, 23, 59, 'open', 50],
    ['c3', 'Chapter 5 Test', '401', 5, 8, 0, 'open', 100, { workKind: 'quiz' }],
    ['m1', 'Derivatives Worksheet 4', '402', 1, 23, 59, 'open', 15],
    ['m2', 'Unit 3 Quiz', '402', 1, 10, 0, 'open', 30, { workKind: 'quiz', submissionTypes: ['online_quiz'], quizId: '9901' }],
    ['m3', 'Related Rates Homework', '402', -2, 23, 59, 'missing', 15],
    ['l1', 'The Great Gatsby Ch. 4-6 Questions', '403', 1, 23, 59, 'open', 20],
    ['l2', 'Argument Essay Final', '403', 6, 23, 59, 'open', 100],
    ['l3', 'Poetry Annotation', '403', -1, 23, 59, 'submitted', 10],
    ['w1', 'Industrial Revolution Notes', '404', 2, 23, 59, 'open', 10],
    ['w2', 'Imperialism Map Project', '404', 7, 23, 59, 'open', 60],
    ['f1', 'Vocabulaire Unité 6', '405', 0, 23, 59, 'open', 10],
    ['f2', 'Passé Composé Quiz', '405', 2, 9, 0, 'open', 25, { workKind: 'quiz' }],
    ['f3', 'Listening Journal 3', '405', -4, 23, 59, 'missing', 10],
    ['s1', 'Python Loops Exercise', '406', 3, 23, 59, 'open', 20],
    ['s2', 'Create Task Draft', '406', 8, 23, 59, 'open', 100],
    ['g2', 'Algorithms Quiz', '406', -3, 10, 0, 'graded', 30, { workKind: 'quiz', score: 27 }],
    ['h1', 'Nutrition Log', '407', 2, 15, 0, 'open', 10],
    ['h2', 'CPR Skills Check', '407', -6, 23, 59, 'graded', 20, { score: 18 }]
  ];
  const cname = id => courses.find(c => c.id === id).name;
  const assignments = rows.map(([id, title, courseId, d, h, mi, state, points, more = {}]) => ({
    id, title, name: title, courseId, course: cname(courseId), courseName: cname(courseId), kind: 'assignment',
    workKind: more.workKind || 'assignment', dueAt: due(d, h, mi), dueDay: '', points,
    url: `https://school.invalid/courses/${courseId}/assignments/${id}`,
    description: title + '.', missing: state === 'missing', submitted: ['submitted', 'graded'].includes(state),
    state: state === 'graded' ? 'graded' : state === 'submitted' ? 'submitted' : 'unsubmitted',
    done: ['submitted', 'graded'].includes(state), estimate: 0, steps: 0, stepsDone: 0, pinned: false,
    submissionTypes: more.submissionTypes || ['online_upload'], ...(more.quizId ? { quizId: more.quizId } : {}),
    ...(grades && Number.isFinite(more.score) ? { score: more.score } : {})
  }));
  const files = [
    { id: 'fc1', title: 'Ideal Gas Law notes.pdf', name: 'Ideal Gas Law notes.pdf', courseId: '401', kind: 'file', url: 'https://school.invalid/courses/401/files/7001', size: 900000, updatedAt: iso(now - 3 * DAY) },
    { id: 'fc2', title: 'Derivative rules.pdf', name: 'Derivative rules.pdf', courseId: '402', kind: 'file', url: 'https://school.invalid/courses/402/files/7002', size: 150000, updatedAt: iso(now - 8 * DAY) },
    { id: 'fc3', title: 'Gatsby reading guide.pdf', name: 'Gatsby reading guide.pdf', courseId: '403', kind: 'file', url: 'https://school.invalid/courses/403/files/7003', size: 280000, updatedAt: iso(now - 2 * DAY) }
  ];
  const pages = [
    { id: 'syllabus:401', title: 'Honors Chemistry syllabus', courseId: '401', body: '<p>Labs are due Friday at 11:59 PM.</p>', url: '/courses/401/assignments/syllabus' }
  ];
  const announcements = [
    { id: 'nc1', title: 'Unit 3 quiz reminder', message: '<p>Our Unit 3 quiz is Thursday in class. Bring a pencil.</p>', courseId: '402', postedAt: iso(now - 0.3 * DAY), unread: true, url: 'https://school.invalid/courses/402/discussion_topics/8001' },
    { id: 'nc2', title: 'Bring headphones', message: '<p>We have a listening activity next class.</p>', courseId: '405', postedAt: iso(now - 1.5 * DAY), unread: false, url: 'https://school.invalid/courses/405/discussion_topics/8002' }
  ];
  const messages = [
    { id: 'mc1', subject: 'Group project roles', title: 'Group project roles', lastMessage: 'Please pick a role by Friday.', participants: ['Course Teacher'], workflowState: 'unread', at: iso(now - 0.1 * DAY), url: 'https://school.invalid/conversations#/mc1' }
  ];
  return {
    now, timeZone: 'America/New_York', ai: true,
    pet: { name: 'Biscuit', knowledge: 'most', roam: 'page', nudges: 'helpful' },
    companion: { name: 'Biscuit' },
    settings: { showGrades: grades, bedtime: '22:30', timeZone: 'America/New_York' }, showGrades: grades,
    courses: courses.map(c => grades ? c : { ...c, score: undefined }),
    assignments, workItems: assignments, planner: assignments, personalTasks: [], local: {},
    files, pages, modules: [], announcements, messages, unreadAnnouncements: announcements.filter(a => a.unread).length,
    grades: grades ? [...courses.map(c => ({ id: 'course-grade-' + c.id, title: c.name, courseId: c.id, value: c.score, text: String(c.score) })), ...assignments.filter(a => Number.isFinite(a.score)).map(a => ({ id: 'grade-' + a.id, title: a.title, courseId: a.courseId, value: a.score, score: a.score, points: a.points }))] : [],
    reminders: [], notes: [{ id: 'scratchpad', title: 'Your notes', text: 'pick a project role' }], bookmarks: [], links: [],
    features: [], homeModules: [], tabs: ['home', 'assignments', 'planner', 'materials', 'messages', 'grades'],
    pageKind: 'dashboard', pathname: '/', focus: { running: false }, focusHistory: [], studyAids: {}, newWork: [],
    ...extra
  };
}
module.exports = { world, wall, NOW, DAY };
