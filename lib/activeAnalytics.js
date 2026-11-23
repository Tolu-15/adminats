/**
 * Shared inclusion rules for counts shown outside the trash.
 * A registration is only visible when both its batch and the student's home
 * batch are active, and the student has not been soft-deleted.
 */
export function isActiveBatchStudent(student, activeBatchIds) {
  return Boolean(
    student &&
    !student.deleted_at &&
    student.batch_id &&
    activeBatchIds.has(student.batch_id)
  );
}

export function isActiveRegistration(registration, activeBatchIds) {
  return Boolean(
    registration &&
    registration.batch_id &&
    activeBatchIds.has(registration.batch_id) &&
    isActiveBatchStudent(registration.student, activeBatchIds)
  );
}

export function registrationStudentKey(registration) {
  const studentId = registration?.student_id || registration?.student?.id;
  return registration?.batch_id && studentId
    ? `${registration.batch_id}_${studentId}`
    : null;
}

/** Unique people per programme and batch; direct profiles fill missing Membership registrations only. */
export function buildBatchCounts(batches, registrations, students) {
  const activeIds = new Set(batches.filter(batch => !batch.deleted_at).map(batch => batch.id));
  const groups = new Map([...activeIds].map(id => [id, { membership: new Set(), mit: new Set(), proclaimers: new Set(), total: new Set() }]));
  for (const registration of registrations) {
    if (!isActiveRegistration(registration, activeIds)) continue;
    const group = groups.get(registration.batch_id);
    const studentId = registration.student_id || registration.student.id;
    if (!['membership', 'mit', 'proclaimers'].includes(registration.stage) || !studentId) continue;
    group[registration.stage].add(studentId);
    group.total.add(studentId);
  }
  for (const student of students) {
    if (!isActiveBatchStudent(student, activeIds)) continue;
    groups.get(student.batch_id).membership.add(student.id);
    groups.get(student.batch_id).total.add(student.id);
  }
  return new Map([...groups].map(([id, group]) => [id, Object.fromEntries(Object.entries(group).map(([stage, ids]) => [stage, ids.size]))]));
}
