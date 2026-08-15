import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET } from '../../../../lib/r2Client';

export async function GET(request, { params }) {
  try {
    const keyArray = params.key;
    if (!keyArray || keyArray.length === 0) {
      return new Response('Not found', { status: 404 });
    }

    const key = Array.isArray(keyArray) ? keyArray.join('/') : keyArray;

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
    // Cache in browser for performance
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    const byteArray = await response.Body.transformToByteArray();
    return new Response(byteArray, { headers });
  } catch (err) {
    console.error('[image-proxy-error]', err?.message || err);
    return new Response('Image not found', { status: 404 });
  }
}
