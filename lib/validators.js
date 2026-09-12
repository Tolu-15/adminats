/**
 * Validation utilities for student registration, profile updates, and email/phone inputs.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const PHONE_REGEX = /^[+]?[\d\s\-().]{7,30}$/;

/**
 * Validates whether an email string is well-formed and within RFC length bounds.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 255 || trimmed.length < 5) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Validates whether a phone number contains valid characters and reasonable length.
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (trimmed.length < 7 || trimmed.length > 30) return false;
  return PHONE_REGEX.test(trimmed);
}

/**
 * Field length limits applied to incoming student and registration inputs.
 */
export const FIELD_LIMITS = {
  first_name: 100,
  surname: 100,
  middle_name: 100,
  email: 255,
  phone: 30,
  card_number: 50,
  gender: 20,
  home_address: 500,
  local_government: 100,
  state_of_origin: 100,
  nationality: 100,
  country_of_residence: 100,
  education: 100,
  church_join_date: 50,
  challenges: 1000,
  next_of_kin: 100,
  next_of_kin_relationship: 50,
  next_of_kin_phone: 30,
  next_of_kin_address: 500,
  born_again_details: 1000,
  baptized_water_details: 1000,
  baptized_holy_spirit_details: 1000,
};

/**
 * Validates student data payload against format and length restrictions.
 * @param {object} data
 * @param {boolean} isPartial - Set to true for partial updates (PATCH)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStudentData(data, isPartial = false) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid request payload.'] };
  }

  // Required fields for full registration
  if (!isPartial) {
    if (!data.batch_id) errors.push('Batch ID is required.');
    if (!data.first_name || !data.first_name.trim()) errors.push('First name is required.');
    if (!data.surname || !data.surname.trim()) errors.push('Surname is required.');
    if (!data.email || !data.email.trim()) errors.push('Email is required.');
    if (!data.phone || !data.phone.trim()) errors.push('Phone number is required.');
    if (!data.gender) errors.push('Gender is required.');
  }

  // Format checks
  if (data.email && !isValidEmail(data.email)) {
    errors.push(`Invalid email address format: "${data.email.slice(0, 50)}".`);
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push('Phone number must contain only numbers and standard separators (7-30 characters).');
  }

  if (data.next_of_kin_phone && !isValidPhone(data.next_of_kin_phone)) {
    errors.push('Next of kin phone number format is invalid.');
  }

  // Length limits check
  for (const [field, maxLen] of Object.entries(FIELD_LIMITS)) {
    const val = data[field];
    if (typeof val === 'string' && val.length > maxLen) {
      errors.push(`"${field.replace(/_/g, ' ')}" exceeds maximum allowed length of ${maxLen} characters.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes and normalizes a date input into a YYYY-MM-DD string or null.
 * Prevents PostgreSQL 'column is of type date but expression is of type text'
 * and 'invalid input syntax for type date: ""' errors.
 * @param {any} val
 * @returns {string | null}
 */
export function sanitizeDate(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;

  // 1. Standard YYYY-MM-DD format
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [_, y, m, d] = ymdMatch;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return str;
    }
    return null;
  }

  // 2. ISO timestamp format e.g. 2024-03-15T00:00:00.000Z
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) {
    return sanitizeDate(isoMatch[1]);
  }

  // 3. Fallback: Parse with Date constructor
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    try {
      const year = parsed.getUTCFullYear();
      if (year >= 1900 && year <= 2100) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      return null;
    }
  }

  return null;
}

