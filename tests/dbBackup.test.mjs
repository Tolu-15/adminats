import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { exportDatabase, packBackup, backupFileName } from '../lib/dbBackup.js';

function fakeSupabase(tables) {
  return {
    from(table) {
      const rows = tables[table];
      const builder = {
        select: () => builder,
        order: () => builder,
        range: async (from, to) => (rows
          ? { data: rows.slice(from, to + 1), error: null }
          : { data: null, error: { message: `relation "${table}" does not exist` } }),
      };
      return builder;
    },
  };
}

test('DB backup export', async (t) => {
  await t.test('exports all rows across pages and records missing tables without failing', async () => {
    const students = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const result = await exportDatabase(fakeSupabase({ students }), ['students', 'legacy_table']);
    assert.equal(result.manifest.counts.students, 2500);
    assert.equal(result.data.students.length, 2500);
    assert.match(result.manifest.errors.legacy_table, /does not exist/);
  });

  await t.test('packBackup round-trips through gzip', () => {
    const payload = { manifest: {}, data: { batches: [{ id: 1 }] } };
    assert.deepEqual(JSON.parse(gunzipSync(packBackup(payload)).toString()), payload);
  });

  await t.test('backupFileName is dated', () => {
    assert.equal(backupFileName(new Date('2026-10-25T03:00:00Z')), 'backup-2026-10-25.json.gz');
  });
});
