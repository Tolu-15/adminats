import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { sanitizeSearchTerm } from '../../../../lib/sanitizeSearch';

/**
 * Server-side student search. The admin UI previously queried `students`
 * directly from the browser with the anon key, which RLS silently filters
 * down to zero rows for non-owner sessions — so every search looked like
 * "no results" regardless of what was typed. Routing through supabaseAdmin
 * (service role), same as every other admin data fetch in this app, fixes
 * that for good instead of only patching the filter-syntax symptom.
 */
export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = sanitizeSearchTerm(searchParams.get('q') || '');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit'), 10) || 10, 1), 50);

  if (!q) return NextResponse.json({ students: [] });

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id, student_unique_id, surname, first_name, middle_name, card_number, photo_url, created_at, batches(batch_name, batch_code)')
    .is('deleted_at', null)
    .or(`surname.ilike.%${q}%,first_name.ilike.%${q}%,student_unique_id.ilike.%${q}%,card_number.ilike.%${q}%,email.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data || [] });
}
