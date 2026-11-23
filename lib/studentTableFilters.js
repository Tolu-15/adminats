/** Read-only table filtering. Stored grades and status values are never changed. */
export function normalizeStudentStatus(status) {
  const value = String(status || '').trim().toUpperCase().replace(/[ -]+/g, '_');
  if (value === 'FAILED' || value === 'DROP') return 'DROP';
  if (value === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (value === 'PASSED') return 'PASSED';
  if (!value || value === 'PENDING' || value === 'REGISTERED') return 'PENDING';
  return value;
}

export function filterAndSortStudents(rows, { status = 'ALL', sort = 'name-asc', studentOf = row => row, gradesOf = row => row.membership_grades } = {}) {
  const gradeOf = row => { const grades = gradesOf(row); return Array.isArray(grades) ? grades[0] : grades; };
  const filtered = rows.filter(row => status === 'ALL' || normalizeStudentStatus(gradeOf(row)?.status) === status);
  const descending = sort.endsWith('-desc');
  const keyOf = row => {
    const student = studentOf(row) || {};
    return sort.startsWith('id-') ? student.student_unique_id || '' : [student.surname, student.first_name, student.middle_name].filter(Boolean).join(' ');
  };
  return filtered.sort((a, b) => keyOf(a).localeCompare(keyOf(b), undefined, { numeric: true, sensitivity: 'base' }) * (descending ? -1 : 1));
}
