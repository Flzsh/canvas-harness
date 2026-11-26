'use strict';
// Job biscuit-42 (2026-11-22): an invented student in the shape petInfo() (widgets.js) hands Biscuit.
// Made-up courses, teachers and work only. No real people, no real Canvas data.
// "now" is Tuesday 8 December 2026, 4:10 PM in New York (UTC-5).
const DAY = 864e5;
const wall = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h + 5, mi);
const NOW = wall(2026, 12, 8, 16, 10);
function world({ at = NOW, grades = true, extra = {} } = {}) {
  const now = at, iso = v => new Date(v).toISOString();
  // a due time on day offset d (0 = Tuesday 8 Dec), local h:mi
  const due = (d, h = 23, mi = 59) => iso(wall(2026, 12, 8, h, mi) + d * DAY);
  const courses = [
    { id: '301', name: 'AP Biology - Okafor', shortName: 'AP Bio', course_code: 'BIO 410', color: '#3E7D5A', score: 88.6 },
    { id: '302', name: 'Algebra II Honors', shortName: 'Algebra II', course_code: 'MATH 220H', color: '#2E6BA8', score: 92.1 },
    { id: '303', name: 'English 10: World Literature', shortName: 'English 10', course_code: 'ENG 10', color: '#7A4E9E', score: 95.3 },
    { id: '304', name: 'AP US History', shortName: 'APUSH', course_code: 'HIS 300', color: '#A87A12', score: 84.0 },
    { id: '305', name: 'Spanish III', shortName: 'Spanish 3', course_code: 'SPA 300', color: '#B54B26', score: 90.7 },
    { id: '306', name: 'Conceptual Physics', shortName: 'Physics', course_code: 'PHY 100', color: '#0F7C8C', score: 79.5 },
    { id: '307', name: 'Studio Art I', shortName: 'Studio Art', course_code: 'ART 101', color: '#9E4E6A', score: 98.0 }
  ];
  // [id, title, courseId, day offset, hour, minute, state, points, extra]
  const rows = [
    ['b1', 'Cell Respiration Worksheet', '301', 0, 23, 59, 'open', 20],
    ['b2', 'Photosynthesis Lab Report', '301', 2, 23, 59, 'open', 50],
    ['b3', 'Unit 4 Test: Energy in Cells', '301', 3, 8, 0, 'open', 100, { workKind: 'quiz' }],
    ['b4', 'Enzyme Lab Pre-lab Questions', '301', -2, 23, 59, 'missing', 10],
    ['a1', 'Problem Set 7.3: Logarithms', '302', 1, 23, 59, 'open', 25],
    ['a2', 'Quiz 7A', '302', 2, 9, 0, 'open', 30, { workKind: 'quiz', submissionTypes: ['online_quiz'], quizId: '8801' }],
    ['a3', 'Problem Set 7.2: Exponential Growth', '302', -1, 23, 59, 'submitted', 25],
    ['e1', 'Things Fall Apart Ch. 10-13 Reading Response', '303', 1, 23, 59, 'open', 15],
    ['e2', 'Literary Analysis Essay Draft', '303', 6, 23, 59, 'open', 100],
    ['e3', 'Vocab Quiz 9', '303', 3, 10, 0, 'open', 20, { workKind: 'quiz' }],
    ['h1', 'Chapter 12 Reading Notes', '304', 2, 23, 59, 'open', 10],
    ['h2', 'DBQ Practice: Reconstruction', '304', 7, 23, 59, 'open', 60],
    ['h3', 'Gilded Age Timeline', '304', -3, 23, 59, 'missing', 20],
    ['s1', 'Preterite vs Imperfect Practice', '305', 0, 23, 59, 'open', 10],
    ['s2', 'Oral Presentation: Mi familia', '305', 9, 9, 0, 'open', 50],
    ['p1', 'Momentum Problems', '306', 2, 23, 59, 'open', 20],
    ['p2', 'Lab: Collisions', '306', -5, 23, 59, 'graded', 40, { score: 31 }],
    ['r1', 'Self-Portrait Sketch', '307', 4, 23, 59, 'open', 30]
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
    { id: 'f1', title: 'Cellular Respiration slides.pdf', name: 'Cellular Respiration slides.pdf', courseId: '301', kind: 'file', url: 'https://school.invalid/courses/301/files/5001', size: 2400000, updatedAt: iso(now - 4 * DAY) },
    { id: 'f2', title: 'Logarithm rules sheet.pdf', name: 'Logarithm rules sheet.pdf', courseId: '302', kind: 'file', url: 'https://school.invalid/courses/302/files/5002', size: 180000, updatedAt: iso(now - 2 * DAY) },
    { id: 'f3', title: 'Things Fall Apart study guide.pdf', name: 'Things Fall Apart study guide.pdf', courseId: '303', kind: 'file', url: 'https://school.invalid/courses/303/files/5003', size: 320000, updatedAt: iso(now - 6 * DAY) }
  ];
  const pages = [
    { id: 'syllabus:302', title: 'Algebra II Honors syllabus', courseId: '302', body: '<p>Homework is due at 11:59 PM. Late work loses 10% a day.</p>', url: '/courses/302/assignments/syllabus' },
    { id: 'pg1', title: 'Spanish presentation rubric', courseId: '305', body: '<p>Fluency 10, vocabulary 10, grammar 10.</p>', url: 'https://school.invalid/courses/305/pages/rubric' }
  ];
  const announcements = [
    { id: 'n1', title: 'Collisions lab grades posted', message: '<p>Lab grades are in. Corrections are due next week.</p>', courseId: '306', postedAt: iso(now - 0.4 * DAY), unread: true, url: 'https://school.invalid/courses/306/discussion_topics/6001' },
    { id: 'n2', title: 'Bring your sketchbook Friday', message: '<p>We start the self-portrait unit. Bring your sketchbook.</p>', courseId: '307', postedAt: iso(now - 1.2 * DAY), unread: false, url: 'https://school.invalid/courses/307/discussion_topics/6002' }
  ];
  const messages = [
    { id: 'm1', subject: 'Lab partners for Thursday', title: 'Lab partners for Thursday', lastMessage: 'Please pair up before class.', participants: ['Course Teacher'], workflowState: 'unread', at: iso(now - 0.2 * DAY), url: 'https://school.invalid/conversations#/m1' }
  ];
  const s = {
    now, timeZone: 'America/New_York', ai: true,
    pet: { name: 'Biscuit', knowledge: 'most', roam: 'page', nudges: 'helpful' },
    companion: { name: 'Biscuit' },
    settings: { showGrades: grades, bedtime: '22:30', timeZone: 'America/New_York' }, showGrades: grades,
    courses: courses.map(c => grades ? c : { ...c, score: undefined }),
    assignments, workItems: assignments, planner: assignments, personalTasks: [], local: {},
    files, pages, modules: [], announcements, messages, unreadAnnouncements: announcements.filter(a => a.unread).length,
    grades: grades ? [...courses.map(c => ({ id: 'course-grade-' + c.id, title: c.name, courseId: c.id, value: c.score, text: String(c.score) })), ...assignments.filter(a => Number.isFinite(a.score)).map(a => ({ id: 'grade-' + a.id, title: a.title, courseId: a.courseId, value: a.score, score: a.score, points: a.points }))] : [],
    reminders: [], notes: [{ id: 'scratchpad', title: 'Your notes', text: 'ask about lab partners' }], bookmarks: [], links: [],
    features: [], homeModules: [], tabs: ['home', 'assignments', 'planner', 'materials', 'messages', 'grades'],
    pageKind: 'dashboard', pathname: '/', focus: { running: false }, focusHistory: [], studyAids: {}, newWork: [],
    ...extra
  };
  return s;
}
module.exports = { world, wall, NOW, DAY };
