import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, duplicateReasons } from '../lib/duplicateStudents.js';
test('duplicate checks normalize email, Nigerian phone formats, and student IDs', () => {
  assert.equal(normalizePhone('0803 123 4567'), '2348031234567');
  assert.equal(normalizePhone('+234-803-123-4567'), '2348031234567');
  assert.equal(normalizePhone('00234 803 123 4567'), '2348031234567');
  assert.deepEqual(duplicateReasons({ email: ' A@Example.com ', phone: '08031234567', student_unique_id: ' ats-001 ' }, { email: 'a@example.com', phone: '+2348031234567', student_unique_id: 'ATS-001' }), ['email','phone','student ID']);
});
test('empty and placeholder phones do not match; shared contact details are only warnings', () => {
  assert.deepEqual(duplicateReasons({ email: '', phone: '00000000000' }, { email: '', phone: '00000000000' }), []);
  assert.deepEqual(duplicateReasons({ email: 'shared@example.com' }, { email: 'shared@example.com' }), ['email']);
  assert.deepEqual(duplicateReasons({ phone: '08031234567' }, { phone: '08031234568' }), []);
});
