export function normalizeDateOfBirth(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function dateOfBirthMatches(storedDateOfBirth, submittedDateOfBirth) {
  return normalizeDateOfBirth(storedDateOfBirth) === normalizeDateOfBirth(submittedDateOfBirth);
}

export function dateOfBirthRequiredResponse() {
  return { error: 'Student ID/card number and date of birth are required.' };
}

export function dateOfBirthMismatchResponse() {
  return { error: 'Student details could not be verified. Please check the ID/card number and date of birth.' };
}
