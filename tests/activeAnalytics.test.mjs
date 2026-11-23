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


test('batch counts deduplicate programme enrolments and count people only once in the batch total', async () => {
  const { buildBatchCounts } = await import('../lib/activeAnalytics.js');
  const batches = [{ id: 'membership-batch' }, { id: 'mit-batch' }];
  const student = { id: 'one', batch_id: 'membership-batch' };
  const regs = ['membership', 'mit', 'mit', 'proclaimers'].map(stage => ({ student_id: 'one', student, batch_id: 'membership-batch', stage }));
  const counts = buildBatchCounts(batches, regs, [student]);
  assert.deepEqual(counts.get('membership-batch'), { membership: 1, mit: 1, proclaimers: 1, total: 1 });
  assert.deepEqual(counts.get('mit-batch'), { membership: 0, mit: 0, proclaimers: 0, total: 0 });
});

test('a direct Membership profile still counts when only its later programme registration exists', async () => {
  const { buildBatchCounts } = await import('../lib/activeAnalytics.js');
  const batches = [{ id: 'membership-batch' }, { id: 'mit-batch' }, { id: 'trash', deleted_at: '2026-01-01' }];
  const student = { id: 'one', batch_id: 'membership-batch' };
  const trashed = { id: 'two', batch_id: 'membership-batch', deleted_at: '2026-01-01' };
  const regs = [{ student_id: 'one', student, batch_id: 'membership-batch', stage: 'mit' }, { student_id: 'two', student: trashed, batch_id: 'mit-batch', stage: 'mit' }];
  const counts = buildBatchCounts(batches, regs, [student, trashed]);
  assert.deepEqual(counts.get('membership-batch'), { membership: 1, mit: 1, proclaimers: 0, total: 1 });
  assert.equal(counts.get('mit-batch').total, 0); assert.equal(counts.has('trash'), false);
});
