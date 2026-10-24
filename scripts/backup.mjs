// Exports every table to backups/backup-YYYY-MM-DD.json.gz.
// Run by .github/workflows/db-backup.yml; also usable locally:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { backupFileName, exportDatabase, packBackup } from '../lib/dbBackup.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const payload = await exportDatabase(supabase);
const { counts, errors } = payload.manifest;

// A backup with no students or batches means something is wrong (wrong project, paused DB).
if (!counts.students && !counts.batches) {
  console.error('Export returned no students or batches; refusing to save an empty backup.', errors);
  process.exit(1);
}

mkdirSync('backups', { recursive: true });
const file = `backups/${backupFileName()}`;
writeFileSync(file, packBackup(payload));

console.log(`Wrote ${file}`);
console.log('Row counts:', counts);
if (Object.keys(errors).length) console.warn('Skipped tables:', errors);
