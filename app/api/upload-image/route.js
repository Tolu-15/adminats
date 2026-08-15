import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET } from '../../../lib/r2Client';

function randomId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * POST /api/upload-image
 * Body: FormData with field "file" (the image file)
 * Returns: { publicUrl: string }
 *
 * The server uploads directly to R2 — no CORS issues,
 * no presigned URLs, API keys stay server-side.
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed.' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo must be smaller than 5 MB.' }, { status: 400 });
    }

    // Unique key: students/<uuid>.<ext>
    const ext = (file.name || 'photo').split('.').pop().toLowerCase() || 'jpg';
    const key = `students/${randomId()}.${ext}`;

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload directly to R2 from the server — no CORS needed
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }));

    const publicUrl = `/api/images/${key}`;

    return NextResponse.json({ publicUrl });
  } catch (err) {
    console.error('[upload-image]', err);
    return NextResponse.json({ error: err.message || 'Upload failed.' }, { status: 500 });
  }
}
