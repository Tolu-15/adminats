import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET } from '../../../../lib/r2Client';
import { requireAdmin } from '../../../../lib/requireAdmin';

export async function GET(request, { params }) {
  // 1. Require authentication
  const user = await requireAdmin(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { key: keyArray } = await params;
    if (!keyArray || keyArray.length === 0) {
      return new Response('Not found', { status: 404 });
    }

    const segments = Array.isArray(keyArray) ? keyArray : [keyArray];

    // 2. Path sanitization & traversal prevention
    for (const seg of segments) {
      if (
        !seg ||
        seg === '.' ||
        seg === '..' ||
        seg.includes('..') ||
        seg.includes('/') ||
        seg.includes('\\') ||
        seg.includes('\0')
      ) {
        return new Response('Invalid path segment', { status: 400 });
      }
    }

    // Restrict access strictly to the students directory
    if (segments.length < 2 || segments[0] !== 'students') {
      return new Response('Forbidden: Access restricted to students images', { status: 403 });
    }

    const key = segments.join('/');

    // Validate key starts with students/
    if (!key.startsWith('students/')) {
      return new Response('Forbidden', { status: 403 });
    }

    // Validate allowed character set
    if (!/^[a-zA-Z0-9_\-\.\/]+$/.test(key)) {
      return new Response('Invalid key characters', { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    const response = await r2.send(command);

    const headers = new Headers();
    if (response.ContentType) {
      headers.set('Content-Type', response.ContentType);
    } else {
      headers.set('Content-Type', 'image/jpeg');
    }
    if (response.ContentLength) {
      headers.set('Content-Length', response.ContentLength.toString());
    }

    // 3. Private caching for PII images — do not cache in public shared CDN proxies
    headers.set('Cache-Control', 'private, max-age=3600');

    const byteArray = await response.Body.transformToByteArray();
    return new Response(byteArray, { headers });
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return new Response('Image not found', { status: 404 });
    }
    console.error('[image-proxy-error]', err?.message || err);
    return new Response('Image not found', { status: 404 });
  }
}
