import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

/**
 * GET /api/batches/public?token=61-jawslp
 * Public endpoint to fetch batch info by reg_token, batch_code, or ID using supabaseAdmin.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = (searchParams.get('token') || '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  // 1. Primary lookup by reg_token or batch_code (case-insensitive)
  let { data: batch, error } = await supabaseAdmin
    .from('batches')
    .select('id, batch_code, batch_name, reg_token, programme_type, is_active')
    .or(`reg_token.ilike.${token},batch_code.ilike.${token}`)
    .maybeSingle();

  // 2. Fallback if column selection error occurs or if token is a raw UUID
  if (error || !batch) {
    const { data: fallback } = await supabaseAdmin
      .from('batches')
      .select('id, batch_code, batch_name, reg_token, is_active')
      .or(`reg_token.ilike.${token},batch_code.ilike.${token}`)
      .maybeSingle();

    if (fallback) {
      batch = { ...fallback, programme_type: fallback.programme_type || 'MEMBERSHIP' };
      error = null;
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!batch) {
    return NextResponse.json({ error: 'Registration link invalid or batch not found.' }, { status: 404 });
  }

  if (!batch.is_active) {
    return NextResponse.json({ error: 'This registration batch is no longer active.' }, { status: 400 });
  }

  return NextResponse.json({
    batch: {
      ...batch,
      programme_type: batch.programme_type || 'MEMBERSHIP',
    },
  });
}
