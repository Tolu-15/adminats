import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail, isValidPhone, validateStudentData, sanitizeDate, FIELD_LIMITS } from '../lib/validators.js';

test('Email Validator', async (t) => {
  await t.test('accepts valid standard email addresses', () => {
    assert.equal(isValidEmail('student@example.com'), true);
    assert.equal(isValidEmail('first.last@ats.edu.ng'), true);
    assert.equal(isValidEmail('user+tag@domain.co'), true);
  });

  await t.test('rejects malformed email addresses', () => {
    assert.equal(isValidEmail('plainaddress'), false);
    assert.equal(isValidEmail('missing@domain'), false);
    assert.equal(isValidEmail('@missinguser.com'), false);
    assert.equal(isValidEmail('spaces in@mail.com'), false);
    assert.equal(isValidEmail(''), false);
    assert.equal(isValidEmail(null), false);
    assert.equal(isValidEmail(undefined), false);
  });

  await t.test('rejects email exceeding RFC length limit (255 characters)', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    assert.equal(isValidEmail(longEmail), false);
  });
});

test('Phone Validator', async (t) => {
  await t.test('accepts valid phone formats', () => {
    assert.equal(isValidPhone('+2348012345678'), true);
    assert.equal(isValidPhone('08031234567'), true);
    assert.equal(isValidPhone('+1 (555) 019-2834'), true);
    assert.equal(isValidPhone('080-123-4567'), true);
  });

  await t.test('rejects invalid or unsafe phone values', () => {
    assert.equal(isValidPhone('12345'), false); // Too short (< 7 chars)
    assert.equal(isValidPhone('abc1234567'), false); // Contains alphabetic characters
    assert.equal(isValidPhone('08012345678<script>'), false);
    assert.equal(isValidPhone(''), false);
    assert.equal(isValidPhone(null), false);
    assert.equal(isValidPhone('0'.repeat(35)), false); // Exceeds 30 chars
  });
});

test('Student Data Validator', async (t) => {
  const validStudent = {
    batch_id: '123e4567-e89b-12d3-a456-426614174000',
    first_name: 'David',
    surname: 'Oladipo',
    email: 'david.oladipo@example.com',
    phone: '+2348012345678',
    gender: 'Male',
    home_address: '12 Church Street, Lagos',
  };

  await t.test('validates complete and correct student registration', () => {
    const result = validateStudentData(validStudent);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  await t.test('flags missing required fields on full registration', () => {
    const incomplete = { first_name: 'David' };
    const result = validateStudentData(incomplete);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('Batch ID')));
    assert.ok(result.errors.some((e) => e.includes('Surname')));
    assert.ok(result.errors.some((e) => e.includes('Email')));
    assert.ok(result.errors.some((e) => e.includes('Phone')));
    assert.ok(result.errors.some((e) => e.includes('Gender')));
  });

  await t.test('allows partial updates without mandatory registration fields', () => {
    const partial = { home_address: 'New address update' };
    const result = validateStudentData(partial, true);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  await t.test('enforces field length limits', () => {
    const overLimit = {
      ...validStudent,
      challenges: 'x'.repeat(1001), // FIELD_LIMITS.challenges is 1000
    };
    const result = validateStudentData(overLimit);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('challenges') && e.includes('1000')));
  });

  await t.test('validates next of kin phone when provided', () => {
    const withInvalidNokPhone = {
      ...validStudent,
      next_of_kin_phone: 'badphone',
    };
    const result = validateStudentData(withInvalidNokPhone);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('Next of kin phone')));
  });
});

test('Date Sanitizer (church_join_date & date_of_birth)', async (t) => {
  await t.test('returns null for empty or nullish values', () => {
    assert.equal(sanitizeDate(''), null);
    assert.equal(sanitizeDate('   '), null);
    assert.equal(sanitizeDate(null), null);
    assert.equal(sanitizeDate(undefined), null);
  });

  await t.test('accepts valid YYYY-MM-DD format', () => {
    assert.equal(sanitizeDate('2023-04-12'), '2023-04-12');
    assert.equal(sanitizeDate('1995-12-31'), '1995-12-31');
  });

  await t.test('converts ISO timestamp string to YYYY-MM-DD', () => {
    assert.equal(sanitizeDate('2024-01-15T14:30:00.000Z'), '2024-01-15');
    assert.equal(sanitizeDate('2022-09-08T00:00:00'), '2022-09-08');
  });

  await t.test('handles text dates gracefully or converts safely', () => {
    // "January 2020" or parseable strings
    const res = sanitizeDate('2020-01-01');
    assert.equal(res, '2020-01-01');
    assert.equal(sanitizeDate('not-a-valid-date'), null);
  });
});

