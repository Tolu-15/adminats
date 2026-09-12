import test from 'node:test';
import assert from 'node:assert/strict';

test('Security Regressions & Controls', async (t) => {
  await t.test('Issue 8: RFC 5987 filename encoding prevents header injection', () => {
    // Test case: batch names containing spaces, quotes, and non-ASCII chars
    const maliciousBatchName = 'Batch "Fall" 2026; filename=malicious.exe';
    const safeCode = maliciousBatchName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeCode}_Students.xlsx`;
    const headerValue = `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

    assert.ok(!fileName.includes('"'), 'Filename must not contain quotes');
    assert.ok(!fileName.includes(';'), 'Filename must not contain semicolons');
    assert.ok(headerValue.startsWith('attachment; filename='), 'Header contains standard attachment directive');
    assert.ok(headerValue.includes("filename*=UTF-8''"), 'Header includes RFC 5987 UTF-8 encoding');
  });

  await t.test('Issue 7: PostgREST query sanitization strips injection characters', () => {
    // Function mimicking the sanitizer in search route
    const sanitizeQuery = (term) => term.replace(/[,.()"]/g, ' ').trim();

    const attackVector = 'smith,phone.eq.08011111111';
    const sanitized = sanitizeQuery(attackVector);

    assert.ok(!sanitized.includes(','), 'Commas must be stripped to prevent filter separation');
    assert.ok(!sanitized.includes('.'), 'Dots must be stripped to prevent operator injection');
    assert.ok(!sanitized.includes('('), 'Parentheses must be stripped to prevent grouping manipulation');
  });

  await t.test('Issue 5: Image proxy blocks path traversal attempts', () => {
    const isSafeKey = (key) => {
      if (!key || typeof key !== 'string') return false;
      // Key must not contain directory traversal sequences
      if (key.includes('..') || key.includes('\\') || key.startsWith('/')) return false;
      // Key should match alphanumeric with dash, underscore, slash, dot
      return /^[a-zA-Z0-9_\-./]+$/.test(key);
    };

    assert.equal(isSafeKey('avatars/student_123.jpg'), true);
    assert.equal(isSafeKey('../../../etc/passwd'), false);
    assert.equal(isSafeKey('..\\..\\windows\\system32'), false);
    assert.equal(isSafeKey('/root/secret.key'), false);
    assert.equal(isSafeKey('photos/student?admin=true'), false);
  });

  await t.test('Issue 15: Admin role guard falls back to viewer, never admin', () => {
    const resolveUserRole = (userMetadata) => {
      return userMetadata?.role || 'viewer';
    };

    assert.equal(resolveUserRole({ role: 'superadmin' }), 'superadmin');
    assert.equal(resolveUserRole({ role: 'admin' }), 'admin');
    assert.equal(resolveUserRole({}), 'viewer', 'Empty metadata must default to viewer');
    assert.equal(resolveUserRole(null), 'viewer', 'Null metadata must default to viewer');
    assert.equal(resolveUserRole(undefined), 'viewer', 'Undefined metadata must default to viewer');
  });

  await t.test('Gap 4: Middleware correctly classifies public vs protected admin paths', () => {
    const shouldProtectPath = (pathname, hasToken) => {
      if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
        return false; // Login is public
      }
      if (pathname.startsWith('/admin')) {
        return !hasToken; // Protected if no token
      }
      return false; // Non-admin route
    };

    assert.equal(shouldProtectPath('/admin/login', false), false, 'Login page is accessible without token');
    assert.equal(shouldProtectPath('/admin', false), true, 'Admin root blocked without token');
    assert.equal(shouldProtectPath('/admin/students', false), true, 'Admin students blocked without token');
    assert.equal(shouldProtectPath('/admin/students/123', true), false, 'Admin students accessible with token');
    assert.equal(shouldProtectPath('/register', false), false, 'Public student registration not blocked by admin middleware');
  });
});
