import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSearchTerm } from '../lib/sanitizeSearch.js';

test('sanitizeSearchTerm', async (t) => {
  await t.test('strips characters that break PostgREST or() filters', () => {
    assert.equal(sanitizeSearchTerm('Smith, John'), 'Smith  John');
    assert.equal(sanitizeSearchTerm('Jane (MIT)'), 'Jane  MIT');
    assert.equal(sanitizeSearchTerm('O"Brien'), 'O Brien');
    assert.equal(sanitizeSearchTerm('first.last'), 'first last');
  });

  await t.test('trims whitespace and caps length', () => {
    assert.equal(sanitizeSearchTerm('  Ada  '), 'Ada');
    assert.equal(sanitizeSearchTerm('a'.repeat(200)).length, 100);
  });

  await t.test('returns empty string for non-string or empty input', () => {
    assert.equal(sanitizeSearchTerm(''), '');
    assert.equal(sanitizeSearchTerm(null), '');
    assert.equal(sanitizeSearchTerm(undefined), '');
  });
});
