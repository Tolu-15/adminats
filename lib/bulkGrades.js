export const GRADE_FIELDS = {
  membership: ['attendance', 'test', 'assignment', 'assessment', 'presentation', 'exam', 'final_grades'],
  mit: ['midterm_test', 'interactions', 'bible_study', 'assignment', 'attendance', 'cth', 'community_service', 'evangelism', 'presentation', 'final_exam', 'final_grades'],
  proclaimers: ['cih', 'attendance', 'assessment', 'presentation', 'project', 'seminar_attendance', 'final_grades'],
};
export function validateGradeChanges(stage, changes) {
  if (!Object.hasOwn(GRADE_FIELDS, stage) || !changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Invalid grade changes.');
  const result = {};
  for (const [field, raw] of Object.entries(changes)) {
    if (![...GRADE_FIELDS[stage], 'status'].includes(field)) throw new Error('Unsupported grade field: ' + field);
    const value = raw === '' || raw === null ? null : raw;
    if (field === 'status') {
      if (value !== null && !['IN_PROGRESS', 'PASSED', 'FAILED', 'DROP', ...(stage === 'proclaimers' ? ['RELEASED'] : [])].includes(value)) throw new Error('Invalid grade status.');
      result[field] = value;
    } else {
      if (value !== null && (typeof value !== 'number' && typeof value !== 'string' || typeof value === 'string' && !value.trim() || !Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 2147483647 || field === 'final_grades' && Number(value) > 100)) throw new Error(field.replace(/_/g, ' ') + ' must be a non-negative whole number' + (field === 'final_grades' ? ' no greater than 100.' : '.'));
      result[field] = value === null ? null : Number(value);
    }
  }
  if (!Object.keys(result).length) throw new Error('No grade changes supplied.');
  return result;
}
