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
