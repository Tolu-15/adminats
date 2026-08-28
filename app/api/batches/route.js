import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../lib/requireAdmin';

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let { data, error } = await supabaseAdmin
    .from('batches')
    .select('*, students(count), mit_registrations(count), proclaimers_registrations(count)')
    .order('created_at', { ascending: false });

  if (error) {
    // If proclaimers_registrations relation doesn't exist yet in DB, fallback to selecting without it
    const fallback = await supabaseAdmin
      .from('batches')
      .select('*, students(count), mit_registrations(count)')
      .order('created_at', { ascending: false });

    if (fallback.error) {
      const fallbackBasic = await supabaseAdmin
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });
      data = fallbackBasic.data;
      error = fallbackBasic.error;
    } else {
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batches: data || [] });
}

export async function POST(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.batch_name) {
    return NextResponse.json({ error: 'Batch name is required.' }, { status: 400 });
  }

  const batch_name = body.batch_name.trim();
  const batch_code = body.batch_code ? body.batch_code.trim() : batch_name;
  const slug = batch_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
  const reg_token = `${slug}-${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
  const programme_type = ['MEMBERSHIP', 'MIT', 'PROCLAIMERS'].includes(body.programme_type)
    ? body.programme_type
    : 'MEMBERSHIP';

  const { data, error } = await supabaseAdmin
    .from('batches')
    .insert({ batch_code, batch_name, reg_token, programme_type })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: data });
}
