import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isActiveBatchStudent,
  isActiveRegistration,
  registrationStudentKey,
} from '../lib/activeAnalytics.js';

const activeBatchIds = new Set(['membership-batch', 'mit-batch']);

test('analytics filtering excludes trashed students and students whose home batch is trashed', () => {
  const activeStudent = { id: 'student-1', batch_id: 'membership-batch', deleted_at: null };
  const trashedStudent = { id: 'student-2', batch_id: 'membership-batch', deleted_at: '2026-01-01T00:00:00Z' };
  const studentFromTrashedHomeBatch = { id: 'student-3', batch_id: 'trashed-batch', deleted_at: null };

  assert.equal(isActiveBatchStudent(activeStudent, activeBatchIds), true);
  assert.equal(isActiveBatchStudent(trashedStudent, activeBatchIds), false);
  assert.equal(isActiveBatchStudent(studentFromTrashedHomeBatch, activeBatchIds), false);

  assert.equal(isActiveRegistration({ batch_id: 'mit-batch', student: activeStudent }, activeBatchIds), true);
  assert.equal(isActiveRegistration({ batch_id: 'mit-batch', student: trashedStudent }, activeBatchIds), false);
  assert.equal(isActiveRegistration({ batch_id: 'mit-batch', student: studentFromTrashedHomeBatch }, activeBatchIds), false);
  assert.equal(isActiveRegistration({ batch_id: 'trashed-batch', student: activeStudent }, activeBatchIds), false);
});

test('registration keys are scoped to the registration batch', () => {
  const studentId = 'student-1';
  assert.equal(registrationStudentKey({ batch_id: 'membership-batch', student_id: studentId }), 'membership-batch_student-1');
  assert.equal(registrationStudentKey({ batch_id: 'mit-batch', student: { id: studentId } }), 'mit-batch_student-1');
  assert.notEqual(
    registrationStudentKey({ batch_id: 'membership-batch', student_id: studentId }),
    registrationStudentKey({ batch_id: 'mit-batch', student_id: studentId })
  );
});
