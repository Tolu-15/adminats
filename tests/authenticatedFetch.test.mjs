import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedFetch } from '../lib/authenticatedFetch.js';

function session(token) { return { data: { session: token ? { access_token: token } : null } }; }

test('uses the current session token instead of a caller supplied stale header', async () => {
  const request = createAuthenticatedFetch({ auth: { getSession: async () => session('current') }, fetchImpl: async (url, options) => {
    assert.equal(options.headers.get('Authorization'), 'Bearer current');
    assert.equal(options.cache, 'no-store');
    return new Response('{}');
  } });
  assert.equal((await request('/api/batches', { headers: { Authorization: 'Bearer stale' } })).status, 200);
});

test('concurrent 401 responses share one refresh and retry with the renewed session', async () => {
  let refreshes = 0, calls = 0;
  const request = createAuthenticatedFetch({ auth: { getSession: async () => session('old'), refreshSession: async () => {
    refreshes++; await new Promise(resolve => setTimeout(resolve, 10)); return session('new');
  } }, fetchImpl: async (url, options) => { calls++; return new Response('{}', { status: options.headers.get('Authorization') === 'Bearer new' ? 200 : 401 }); } });
  const responses = await Promise.all(['/batches', '/stats', '/audit'].map(url => request(url)));
  assert.equal(refreshes, 1); assert.equal(calls, 6); assert.ok(responses.every(response => response.ok));
});

test('missing or rejected sessions prompt sign in and never retry indefinitely', async () => {
  let expired = 0, calls = 0;
  const request = createAuthenticatedFetch({ auth: { getSession: async () => session('old'), refreshSession: async () => session('new') }, onSessionExpired: () => expired++, fetchImpl: async () => { calls++; return new Response('{}', { status: 401 }); } });
  await assert.rejects(request('/stats'), /session was rejected/); assert.equal(calls, 2); assert.equal(expired, 1);
  const missing = createAuthenticatedFetch({ auth: { getSession: async () => session(null) }, onSessionExpired: () => expired++, fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(missing('/stats'), /session has expired/); assert.equal(expired, 2);
});

test('403 permissions and server errors are not mistaken for expired sessions', async () => {
  for (const status of [403, 500]) {
    const request = createAuthenticatedFetch({ auth: { getSession: async () => session('valid'), refreshSession: async () => { throw new Error('must not refresh'); } }, fetchImpl: async () => new Response('{}', { status }) });
    assert.equal((await request('/stats')).status, status);
  }
});
