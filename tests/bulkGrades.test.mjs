import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGradeChanges } from '../lib/bulkGrades.js';
test('bulk validation accepts only edited fields, explicit clears, and valid programme scores', () => {
  assert.deepEqual(validateGradeChanges('membership', { exam: '0', final_grades: 100, status: 'PASSED', test: '' }), { exam: 0, final_grades: 100, status: 'PASSED', test: null });
  assert.deepEqual(validateGradeChanges('mit', { midterm_test: 12 }), { midterm_test: 12 });
  assert.deepEqual(validateGradeChanges('proclaimers', { cih: 30, status: 'RELEASED' }), { cih: 30, status: 'RELEASED' });
});
test('rejects invalid numbers, negative/fractional grades, unsupported fields and statuses', () => {
  for (const value of [-1, 'bad', Infinity, NaN, true, {}, ' ', 1.5]) assert.throws(() => validateGradeChanges('membership', { exam: value }));
  assert.throws(() => validateGradeChanges('membership', { final_grades: 101 }));
  assert.throws(() => validateGradeChanges('membership', { registration_id: 'other' }));
  assert.throws(() => validateGradeChanges('membership', { status: 'RELEASED' }));
  assert.throws(() => validateGradeChanges('membership', {}));
  assert.throws(() => validateGradeChanges('invalid', { exam: 10 }));
});
