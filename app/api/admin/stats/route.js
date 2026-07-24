import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Total students
  const { count: totalStudents } = await supabaseAdmin
    .from('students')
    .select('*', { count: 'exact', head: true });

  // Total batches
  const { count: totalBatches } = await supabaseAdmin
    .from('batches')
    .select('*', { count: 'exact', head: true });

  // Active batches
  const { count: activeBatches } = await supabaseAdmin
    .from('batches')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // Most recent registration
  const { data: recent } = await supabaseAdmin
    .from('students')
    .select('surname, first_name, created_at, batches(batch_name)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    totalStudents: totalStudents ?? 0,
    totalBatches: totalBatches ?? 0,
    activeBatches: activeBatches ?? 0,
    recentStudent: recent ?? null,
  });
}
