'use strict';
// A made-up student in the shape petInfo() (widgets.js) hands Biscuit. No real people or courses.
// variant: 'normal' | 'long' (long names, 40+ items) | 'empty' (no work at all)
const DAY = 864e5;
function wall(y, mo, d, h, mi) { // America/New_York in November 2026 = UTC-5
  return Date.UTC(y, mo - 1, d, h + 5, mi);
}
function world({ at = wall(2026, 11, 14, 0, 50), variant = 'normal', grades = false, extra = {} } = {}) {
  const now = at, iso = v => new Date(v).toISOString();
  const dueOn = (dayOffset, h = 23, mi = 59) => { const base = new Date(now - 5 * 3600e3); base.setUTCHours(0, 0, 0, 0); return iso(base.getTime() + dayOffset * DAY + (h + 5) * 3600e3 + mi * 60e3); };
  let courses = [
    { id: '10', name: 'Chemistry 11-Birch', shortName: 'Chemistry', course_code: 'CHEM 10', color: '#B54B26', score: 91.4 },
    { id: '20', name: 'Vector Calculus-Hart', shortName: 'Calculus', course_code: 'MATH 20', color: '#2E6BA8', score: 87.2 },
    { id: '30', name: 'English: Modern Fiction', shortName: 'Modern Fiction', course_code: 'ENG 30', color: '#7A4E9E', score: 94.0 },
    { id: '40', name: 'Latin Reading', shortName: 'Latin', course_code: 'LAT 40', color: '#A87A12', score: 89.5 },
    { id: '50', name: 'Engineering Design-Stone', shortName: 'Engineering', course_code: 'ENGR 50', color: '#3E7D5A', score: 96.1 },
    { id: '60', name: 'Marine Biology 2', shortName: 'Marine Bio', course_code: 'BIO 60', color: '#0F7C8C', score: 92.3 }
  ];
  const desc = t => `<p>${t}</p><p>Answer every question and show your work. Use the <a href="https://school.instructure.com/courses/10/files/9001">worksheet PDF</a> and the <a href="https://example.org/reading">reading</a>.</p><ol><li>Part one</li><li>Part two</li></ol>`;
  // [id, title, courseId, due day offset, hour, state, points]
  let rows = [
    ['101', 'Monday, November 9, 2026', '40', -5, 8, 'missing', 10],
    ['102', 'Homework for Monday, 11/9/2026', '40', -5, 8, 'missing', 10],
    ['103', 'Homework for Wednesday, 11/11/2026', '40', -3, 8, 'missing', 10],
    ['104', 'Homework for Wednesday, 11/11/2026', '20', -3, 23, 'open', 15],
    ['105', 'Equilibrium Worksheet', '10', 0, 23, 'open', 20],
    ['106', 'Kinetics Test', '10', 4, 8, 'open', 100],
    ['107', 'Partial Derivatives Practice Set', '20', 1, 23, 'open', 25],
    ['108', 'Close Reading: Chapter Three', '30', 2, 23, 'open', 15],
    ['109', 'Solar Car Build', '50', 3, 15, 'open', 50],
    ['110', 'Plate Count Data Sheet', '60', 1, 23, 'open', 10],
    ['111', 'Cardboard Bridge', '50', -9, 23, 'missing', 30],
    ['112', 'Aeneid Quiz II', '40', 2, 8, 'open', 40],
    ['113', 'Titration Lab Report', '10', -1, 23, 'submitted', 50],
    ['114', 'Essay Outline: The Gilded Age', '30', -6, 23, 'graded', 40],
    ['115', 'Reporter Construct Notes', '60', 5, 23, 'open', 15]
  ];
  if (variant === 'long') {
    courses = courses.map(c => ({ ...c, name: c.name + ' — Advanced Seminar Section B (Fall Semester 2026-27)' }));
    rows = rows.map(r => [r[0], r[1] + ': complete all of the assigned problems from the packet and annotate the sources carefully', ...r.slice(2)]);
    for (let k = 0; k < 30; k++) rows.push([String(200 + k), `Weekly practice ${k + 1}: problems ${k * 3 + 1}-${k * 3 + 3} from the long review packet`, courses[k % 6].id, (k % 9) - 3, 23, k % 7 === 0 ? 'missing' : 'open', 10 + k]);
  }
  if (variant === 'empty') rows = [];
  const name = id => courses.find(c => c.id === id).name;
  const assignments = rows.map(([id, title, courseId, d, h, state, points], i) => ({
    id, title, name: title, courseId, course: name(courseId), courseName: name(courseId), kind: 'assignment', workKind: /test|quiz/i.test(title) ? 'quiz' : 'assignment',
    dueAt: dueOn(d, h, h === 8 ? 0 : 59), dueDay: '', points, url: `https://school.instructure.com/courses/${courseId}/assignments/${id}`,
    description: desc(title + '.'), missing: state === 'missing', submitted: ['submitted', 'graded'].includes(state), state: state === 'graded' ? 'graded' : state === 'submitted' ? 'submitted' : 'unsubmitted',
    done: ['submitted', 'graded'].includes(state), estimate: 0, steps: 0, stepsDone: 0, pinned: id === '106', submissionTypes: ['online_upload'],
    ...(grades && state === 'graded' ? { score: Math.round(points * 0.9) } : {})
  }));
  const files = variant === 'empty' ? [] : [
    { id: 'f1', title: 'Equilibrium notes.pdf', name: 'Equilibrium notes.pdf', courseId: '10', kind: 'file', url: 'https://school.instructure.com/courses/10/files/9001', size: 482000, updatedAt: iso(now - 3 * DAY) },
    { id: 'f2', title: 'Kinetics review sheet.pdf', name: 'Kinetics review sheet.pdf', courseId: '10', kind: 'file', url: 'https://school.instructure.com/courses/10/files/9002', size: 210000, updatedAt: iso(now - 1 * DAY) },
    { id: 'f3', title: 'Aeneid Book I lines 1-200.pdf', name: 'Aeneid Book I lines 1-200.pdf', courseId: '40', kind: 'file', url: 'https://school.instructure.com/courses/40/files/9003', size: 1300000, updatedAt: iso(now - 9 * DAY) }
  ];
  const pages = variant === 'empty' ? [] : [
    { id: 'p1', title: 'Lab safety rules', courseId: '10', body: '<p>Goggles on at all times. No food in the lab.</p>', url: 'https://school.instructure.com/courses/10/pages/lab-safety' },
    { id: 'syllabus:20', title: 'Vector Calculus-Hart syllabus', courseId: '20', body: '<p>Homework is due at 11:59 PM. Late work loses 10% a day.</p>', url: '/courses/20/assignments/syllabus' }
  ];
  const announcements = variant === 'empty' ? [] : [
    { id: 'a1', title: 'Lab moved to Thursday', message: '<p>Our titration lab is moved to Thursday because of the assembly.</p>', courseId: '10', postedAt: iso(now - 0.5 * DAY), unread: true, url: 'https://school.instructure.com/courses/10/discussion_topics/7001' },
    { id: 'a2', title: 'Quiz II covers lines 1-80', message: '<p>Study the vocabulary list and scansion of lines 1-80.</p>', courseId: '40', postedAt: iso(now - 2 * DAY), unread: false, url: 'https://school.instructure.com/courses/40/discussion_topics/7002' }
  ];
  const messages = variant === 'empty' ? [] : [
    { id: 'm1', subject: 'Re: solar car chassis', title: 'Re: solar car chassis', lastMessage: 'Bring your measurements on Monday.', participants: ['Course Teacher'], workflowState: 'unread', at: iso(now - 0.3 * DAY), url: 'https://school.instructure.com/conversations#/m1' }
  ];
  const s = {
    now, timeZone: 'America/New_York', ai: true,
    pet: { name: 'Biscuit', knowledge: 'most', treats: 1, roam: 'page', nudges: 'helpful' },
    companion: { name: 'Biscuit' },
    settings: { showGrades: grades, bedtime: '22:30', timeZone: 'America/New_York' }, showGrades: grades,
    courses: courses.map(c => grades ? c : { ...c, score: undefined }),
    assignments, workItems: assignments, planner: assignments, personalTasks: [], local: {},
    files, pages, modules: [], announcements, messages, unreadAnnouncements: announcements.filter(a => a.unread).length,
    grades: grades ? [...courses.map(c => ({ id: 'course-grade-' + c.id, title: c.name, courseId: c.id, value: c.score, text: String(c.score) })), ...assignments.filter(a => Number.isFinite(a.score)).map(a => ({ id: 'grade-' + a.id, title: a.title, courseId: a.courseId, value: a.score, score: a.score, points: a.points }))] : [],
    reminders: [], notes: [{ id: 'scratchpad', title: 'Your notes', text: 'bring goggles thursday' }], bookmarks: [], links: [],
    features: [], homeModules: [], tabs: ['home', 'assignments', 'planner', 'materials', 'messages', 'grades'],
    pageKind: 'dashboard', pathname: '/', focus: { running: false }, focusHistory: [], studyAids: {}, newWork: [],
    ...extra
  };
  return s;
}
module.exports = { world, wall, DAY };
