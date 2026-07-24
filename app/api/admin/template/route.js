import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const filePath = path.join(process.cwd(), 'app', 'assets', 'ATS TEMPLATE1.xlsx');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Template file not found on server.' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="ATS_Master_Migration_Template.xlsx"',
      },
    });
  } catch (err) {
    console.error('Template download error:', err);
    return NextResponse.json({ error: 'Failed to download template.' }, { status: 500 });
  }
}
