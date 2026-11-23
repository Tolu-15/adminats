import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortStudents, normalizeStudentStatus } from '../lib/studentTableFilters.js';

const rows = [
  { student_unique_id: 'ATS-10', surname: 'Zulu', membership_grades: [{ status: 'PASSED' }] },
  { student_unique_id: 'ATS-2', surname: 'ade', membership_grades: [{ status: 'in progress' }] },
  { student_unique_id: 'ATS-3', surname: 'Bola', membership_grades: [{ status: 'FAILED' }] },
  { student_unique_id: 'ATS-4', surname: 'Chidi', membership_grades: [] },
];

test('status filters include ungraded records and treat FAILED as the displayed Drop category', () => {
  assert.equal(normalizeStudentStatus(' in-progress '), 'IN_PROGRESS');
  assert.deepEqual(filterAndSortStudents(rows, { status: 'PASSED' }).map(r => r.surname), ['Zulu']);
  assert.deepEqual(filterAndSortStudents(rows, { status: 'IN_PROGRESS' }).map(r => r.surname), ['ade']);
  assert.deepEqual(filterAndSortStudents(rows, { status: 'DROP' }).map(r => r.surname), ['Bola']);
  assert.deepEqual(filterAndSortStudents(rows, { status: 'PENDING' }).map(r => r.surname), ['Chidi']);
  assert.equal(normalizeStudentStatus('RELEASED'), 'RELEASED');
  assert.equal(normalizeStudentStatus('Registered'), 'PENDING');
});

test('sorting handles numeric IDs, case-insensitive names, both directions, and preserves input order', () => {
  const before = structuredClone(rows);
  assert.deepEqual(filterAndSortStudents(rows, { sort: 'id-asc' }).map(r => r.student_unique_id), ['ATS-2', 'ATS-3', 'ATS-4', 'ATS-10']);
  assert.equal(filterAndSortStudents(rows, { sort: 'id-desc' })[0].student_unique_id, 'ATS-10');
  assert.deepEqual(filterAndSortStudents(rows).map(r => r.surname), ['ade', 'Bola', 'Chidi', 'Zulu']);
  assert.equal(filterAndSortStudents(rows, { sort: 'name-desc' })[0].surname, 'Zulu');
  assert.deepEqual(rows, before);
});

test('nested MIT and Proclaimers registrations use their own grades', () => {
  for (const stage of ['mit', 'proclaimers']) {
    const nested = rows.map(r => ({ membership_student: r, [stage + '_grades']: r.membership_grades }));
    const result = filterAndSortStudents(nested, { status: 'PASSED', studentOf: r => r.membership_student, gradesOf: r => r[stage + '_grades'] });
    assert.equal(result.length, 1);
    assert.equal(result[0].membership_student.surname, 'Zulu');
  }
  assert.deepEqual(filterAndSortStudents([]), []);
});
