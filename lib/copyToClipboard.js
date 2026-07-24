export async function copyToClipboard(text) {
  if (!text) return false;

  // 1. Try modern navigator.clipboard (works on HTTPS & localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Async clipboard API failed, trying fallback:', err);
    }
  }

  // 2. Legacy execCommand fallback for HTTP / Mobile browsers (iOS Safari, Android Chrome over HTTP)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, 99999); // Mobile iOS compatibility
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('Clipboard fallback failed:', err);
    return false;
  }
}
