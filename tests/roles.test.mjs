import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserRole, canWrite } from '../lib/roles.js';

test('Server-side role resolution', async (t) => {
  await t.test('unassigned or missing users are viewers', () => {
    assert.equal(getUserRole(null), 'viewer');
    assert.equal(getUserRole({ email: 'a@b.com' }), 'viewer');
    assert.equal(canWrite({ email: 'a@b.com' }), false);
  });

  await t.test('admin and superadmin may write', () => {
    assert.equal(canWrite({ user_metadata: { role: 'admin' } }), true);
    assert.equal(canWrite({ app_metadata: { role: 'superadmin' } }), true);
  });

  await t.test('viewer role and viewer@ats.com cannot write', () => {
    assert.equal(canWrite({ user_metadata: { role: 'viewer' } }), false);
    assert.equal(canWrite({ email: 'viewer@ats.com', user_metadata: { role: 'admin' } }), false);
  });

  await t.test('app_metadata overrides user-editable user_metadata', () => {
    assert.equal(canWrite({ app_metadata: { role: 'viewer' }, user_metadata: { role: 'admin' } }), false);
  });

  await t.test('unknown roles cannot write', () => {
    assert.equal(canWrite({ user_metadata: { role: 'editor' } }), false);
  });
});
