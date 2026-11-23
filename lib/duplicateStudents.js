export function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (/^0*$/.test(digits)) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^0\d{10}$/.test(digits)) digits = '234' + digits.slice(1);
  return digits;
}
export function duplicateReasons(candidate, record) {
  const reasons = [];
  const email = String(candidate.email || '').trim().toLowerCase();
  const phone = normalizePhone(candidate.phone);
  const id = String(candidate.student_unique_id || '').trim().toUpperCase();
  if (email && email === String(record.email || '').trim().toLowerCase()) reasons.push('email');
  if (phone.length >= 7 && !/^0+$/.test(phone) && phone === normalizePhone(record.phone)) reasons.push('phone');
  if (id && id === String(record.student_unique_id || '').trim().toUpperCase()) reasons.push('student ID');
  return reasons;
}
