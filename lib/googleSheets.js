import { google } from 'googleapis';

// SERVER ONLY.
export async function appendStudentToSheet(student, batchName) {
  const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID,
    GOOGLE_SHEET_TAB_NAME,
  } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    console.warn('Google Sheets sync skipped: env vars not configured.');
    return { skipped: true };
  }

  const auth = new google.auth.JWT(
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });
  const tab = GOOGLE_SHEET_TAB_NAME || 'Registrations';

  const row = [
    student.student_unique_id,
    batchName || '',
    student.surname,
    student.first_name,
    student.middle_name || '',
    student.email,
    student.phone,
    student.date_of_birth || '',
    student.gender || '',
    student.home_address || '',
    student.next_of_kin || '',
    student.next_of_kin_relationship || '',
    student.next_of_kin_phone || '',
    student.state_of_origin || '',
    student.local_government || '',
    student.nationality || '',
    student.education || '',
    student.born_again || '',
    student.born_again_details || '',
    student.baptized_water ? 'Yes' : 'No',
    student.baptized_water_details || '',
    student.baptized_holy_spirit ? 'Yes' : 'No',
    student.baptized_holy_spirit_details || '',
    student.church_join_date || '',
    student.challenges || '',
    student.photo_url || '',
    new Date(student.created_at).toISOString(),
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  return { skipped: false };
}

// Call this once (or add a header row manually) to keep column order stable.
export const SHEET_HEADER_ROW = [
  'Student ID', 'Batch', 'Surname', 'First Name', 'Middle Name', 'Email', 'Phone',
  'Date of Birth', 'Gender', 'Home Address', 'Next of Kin', 'Next of Kin Relationship', 'Next of Kin Phone',
  'State of Origin', 'Local Government', 'Nationality', 'Education', 'Born Again', 'Born Again Details',
  'Baptized Water', 'Baptized Water Details', 'Baptized Holy Spirit',
  'Baptized Holy Spirit Details', 'Church Join Date', 'Challenges', 'Photo URL', 'Registered At',
];
