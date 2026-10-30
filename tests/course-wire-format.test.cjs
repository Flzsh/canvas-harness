const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizeCourse}=require('../extension/core.js');
test('course API compact student type retains grades and excludes compact teacher data',()=>{
 const course=normalizeCourse({id:'7',enrollments:[{type:'teacher',computed_current_score:1},{type:'student',role:'StudentEnrollment',computed_current_score:91,current_grading_period_id:'2',current_period_computed_current_score:95,current_period_computed_current_grade:'A'}]});
 assert.equal(course.score,95);assert.equal(course.overallScore,91);assert.equal(course.scoreScope,'current-period');
});
