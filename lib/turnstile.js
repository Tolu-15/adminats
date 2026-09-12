export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function verifyTurnstileToken(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const shouldVerifyTurnstile = process.env.NODE_ENV === 'production'
    || process.env.NEXT_PUBLIC_ENABLE_TURNSTILE_LOCAL === 'true';

  if (!shouldVerifyTurnstile && !token) {
    return { success: true };
  }

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'Turnstile is not configured.' };
    }

    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Please complete the security check.' };
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip && ip !== 'unknown') formData.append('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    return { success: false, error: 'Security check failed. Please try again.' };
  }

  const result = await response.json();
  return {
    success: Boolean(result.success),
    error: result.success ? null : 'Security check failed. Please try again.',
  };
}
