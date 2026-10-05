/**
 * Strips characters that are structurally significant to PostgREST's
 * `.or()` filter syntax (`,` separates clauses, `.` separates
 * column/operator/value, `()` group clauses, `"` closes quoted values).
 * Without this, a search term like "Smith, John" or "Jane (MIT)" breaks
 * the generated filter string and PostgREST returns a parse error.
 * @param {string} term
 * @returns {string}
 */
export function sanitizeSearchTerm(term) {
  if (!term || typeof term !== 'string') return '';
  return term.replace(/[,.()"]/g, ' ').trim().slice(0, 100);
}
