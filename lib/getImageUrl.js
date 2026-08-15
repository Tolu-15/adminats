/**
 * Helper to ensure any image URL (whether raw R2 key, broken r2.dev domain, or proxy URL)
 * resolves correctly via the internal /api/images proxy route.
 */
export function getImageUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  // Already a local proxy or data URI
  if (trimmed.startsWith('/api/images/') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Handle R2 dev domains (e.g. https://pub-xxxx.r2.dev/students/abc.png)
  if (trimmed.includes('.r2.dev/')) {
    const key = trimmed.split('.r2.dev/')[1];
    return `/api/images/${key}`;
  }

  // Handle R2 direct storage endpoint URLs
  if (trimmed.includes('r2.cloudflarestorage.com/')) {
    const afterHost = trimmed.split('r2.cloudflarestorage.com/')[1];
    const parts = afterHost.split('/');
    // If bucket name is in URL (e.g. /bucket-name/students/xyz.png), strip bucket name
    const key = parts.length > 1 && parts[0] === 'ats-student-images' ? parts.slice(1).join('/') : parts.join('/');
    return `/api/images/${key}`;
  }

  // If stored as relative key (e.g. students/xyz.png)
  if (trimmed.startsWith('students/')) {
    return `/api/images/${trimmed}`;
  }

  // If it's another absolute external URL (e.g. Google Drive, avatar placeholder), return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `/api/images/${trimmed.replace(/^\/+/, '')}`;
}
