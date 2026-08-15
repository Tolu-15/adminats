'use client';

import PhotoUploader from './PhotoUploader';

export default function RegistrationForm({
  form, update, onSubmit, submitting, error, onPhotoSelected, onPhotoUploaded, photoUrl,
}) {
  return (
    <form onSubmit={onSubmit}>
      {error && <div className="error-box">{error}</div>}

      {/* ── PHOTO ── */}
      <div className="section-title">Profile Photo</div>
      <PhotoUploader
        currentUrl={photoUrl || null}
        onPhotoSelected={onPhotoSelected}
        onUploaded={onPhotoUploaded}
        hint="JPG, JPEG, PNG, WebP · Max 5 MB · Photo will upload when you submit registration."
      />

      <div className="section-title">Personal Details</div>
      <div className="field">
        <label>Surname *</label>
        <input type="text" value={form.surname} onChange={(e) => update('surname', e.target.value)} required />
      </div>
      <div className="field">
        <label>First Name *</label>
        <input type="text" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} required />
      </div>
      <div className="field">
        <label>Middle Name</label>
        <input type="text" value={form.middle_name} onChange={(e) => update('middle_name', e.target.value)} />
      </div>
      <div className="field">
        <label>Email address *</label>
        <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
      </div>
      <div className="field">
        <label>Phone Number (WhatsApp) *</label>
        <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
      </div>
      <div className="field">
        <label>Date of Birth *</label>
        <input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} required />
      </div>
      <div className="field">
        <label>Gender *</label>
        <div className="radio-row">
          {['Male', 'Female'].map((g) => (
            <label key={g}>
              <input type="radio" name="gender" checked={form.gender === g} onChange={() => update('gender', g)} required />
              {g}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label style={{ fontWeight: 700, color: 'var(--navy)' }}>Are you a First Timer? *</label>
        <div className="radio-row">
          {['Yes', 'No'].map((v) => (
            <label key={v}>
              <input
                type="radio"
                name="is_first_timer"
                checked={form.is_first_timer === v}
                onChange={() => update('is_first_timer', v)}
                required
              />
              {v === 'Yes' ? 'Yes — I am a First Timer' : 'No — Regular Member'}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Home Address</label>
        <textarea value={form.home_address} onChange={(e) => update('home_address', e.target.value)} />
      </div>
      <div className="field">
        <label>Next of Kin Name</label>
        <input type="text" value={form.next_of_kin} onChange={(e) => update('next_of_kin', e.target.value)} />
      </div>
      <div className="field">
        <label>Next of Kin Relationship</label>
        <input type="text" placeholder="e.g. Spouse, Parent, Sibling, Relative" value={form.next_of_kin_relationship} onChange={(e) => update('next_of_kin_relationship', e.target.value)} />
      </div>
      <div className="field">
        <label>Next of Kin Phone Number</label>
        <input type="tel" value={form.next_of_kin_phone} onChange={(e) => update('next_of_kin_phone', e.target.value)} />
      </div>
      <div className="field">
        <label>State of Origin</label>
        <input type="text" value={form.state_of_origin} onChange={(e) => update('state_of_origin', e.target.value)} />
      </div>
      <div className="field">
        <label>Local Government of Home Town (LGA)</label>
        <input type="text" placeholder="e.g. Ikeja, Abeokuta South, etc." value={form.local_government} onChange={(e) => update('local_government', e.target.value)} />
      </div>
      <div className="field">
        <label>Nationality</label>
        <input type="text" value={form.nationality} onChange={(e) => update('nationality', e.target.value)} />
      </div>
      <div className="field">
        <label>Educational Background</label>
        <select value={form.education} onChange={(e) => update('education', e.target.value)}>
          <option value="">Select…</option>
          <option>Basic School Leaving Certificate</option>
          <option>Secondary School Leaving Certificate</option>
          <option>Tertiary Education Degree and above</option>
        </select>
      </div>

      <div className="section-title">Spiritual Background</div>
      <div className="field">
        <label>Are you born again?</label>
        <div className="radio-row">
          {['Yes', 'No', 'Maybe'].map((v) => (
            <label key={v}>
              <input type="radio" name="born_again" checked={form.born_again === v} onChange={() => update('born_again', v)} />
              {v}
            </label>
          ))}
        </div>
      </div>
      {form.born_again === 'Yes' && (
        <div className="field">
          <label>If Yes, When and Where?</label>
          <input type="text" value={form.born_again_details} onChange={(e) => update('born_again_details', e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>Have you been baptized by immersion (water)?</label>
        <div className="radio-row">
          {['Yes', 'No'].map((v) => (
            <label key={v}>
              <input type="radio" name="baptized_water" checked={form.baptized_water === v} onChange={() => update('baptized_water', v)} />
              {v}
            </label>
          ))}
        </div>
      </div>
      {form.baptized_water === 'Yes' && (
        <div className="field">
          <label>If Yes, When and Where?</label>
          <input type="text" value={form.baptized_water_details} onChange={(e) => update('baptized_water_details', e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>Have you been baptized in the Holy Spirit?</label>
        <div className="radio-row">
          {['Yes', 'No'].map((v) => (
            <label key={v}>
              <input type="radio" name="baptized_holy_spirit" checked={form.baptized_holy_spirit === v} onChange={() => update('baptized_holy_spirit', v)} />
              {v}
            </label>
          ))}
        </div>
      </div>
      {form.baptized_holy_spirit === 'Yes' && (
        <div className="field">
          <label>If Yes, When and Where?</label>
          <input type="text" value={form.baptized_holy_spirit_details} onChange={(e) => update('baptized_holy_spirit_details', e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>When did you join/come to the Citadel Global Community Church for the first time?</label>
        <input type="text" placeholder="State year and month" value={form.church_join_date} onChange={(e) => update('church_join_date', e.target.value)} />
      </div>
      <div className="field">
        <label>Is/are there any challenge(s) that might hinder your full participation in the programme?</label>
        <textarea value={form.challenges} onChange={(e) => update('challenges', e.target.value)} />
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit Registration'}
      </button>
    </form>
  );
}
