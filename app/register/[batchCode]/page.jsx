'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import Logo from '../../../components/Logo';
import RegistrationForm from '../../../components/RegistrationForm';

const initialForm = {
  surname: '', first_name: '', middle_name: '', email: '', phone: '',
  date_of_birth: '', gender: '', home_address: '', next_of_kin: '',
  next_of_kin_address: '', state_of_origin: '', nationality: '', education: '',
  born_again: '', born_again_details: '', baptized_water: '', baptized_water_details: '',
  baptized_holy_spirit: '', baptized_holy_spirit_details: '', church_join_date: '', challenges: '',
};

export default function RegisterPage() {
  const { batchCode } = useParams();
  const [batch, setBatch] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | notfound
  const [form, setForm] = useState(initialForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function loadBatch() {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('reg_token', batchCode)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setLoadState('notfound');
      } else {
        setBatch(data);
        setLoadState('ready');
      }
    }
    loadBatch();
  }, [batchCode]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const required = ['surname', 'first_name', 'email', 'phone', 'gender'];
    for (const key of required) {
      if (!form[key]) {
        setError('Please fill in all required fields (Surname, First Name, Email, Phone, Gender).');
        return;
      }
    }

    setSubmitting(true);
    try {
      let photo_url = null;

      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const path = `${batch.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('student-photos')
          .upload(path, photoFile, { upsert: false });

        if (uploadError) throw new Error('Photo upload failed: ' + uploadError.message);

        const { data: pub } = supabase.storage.from('student-photos').getPublicUrl(path);
        photo_url = pub.publicUrl;
      }

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, batch_id: batch.id, photo_url }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed.');

      setResult(json.student);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="reg-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#fff' }}>Loading registration form…</p>
      </div>
    );
  }

  if (loadState === 'notfound') {
    return (
      <div className="reg-bg">
        <div className="reg-card" style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16, color: 'var(--gold)' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--navy)', marginBottom: 8 }}>Link Not Found</h1>
          <p className="muted">
            This registration link is invalid or the batch is no longer accepting registrations.
            Please check the link with the Membership Unit.
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="reg-bg">
        <div className="reg-card" style={{ textAlign: 'center', maxWidth: 540 }}>
          <Logo size={160} style={{ margin: '0 auto 20px', borderRadius: '24px', display: 'block', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))' }} />
          <div style={{ fontSize: '3.5rem', color: '#16a34a', marginBottom: 12 }}>
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <h1 style={{ fontSize: '1.8rem', color: 'var(--navy)', marginBottom: 12 }}>Registration Successful!</h1>
          <div className="success-box" style={{ marginTop: 16, textAlign: 'left' }}>
            Welcome, <strong>{result.first_name} {result.surname}</strong>! Your profile has been successfully created.
          </div>
          <div style={{
            background: 'var(--paper)', border: '1.5px solid var(--gold)',
            borderRadius: 12, padding: 20, margin: '20px 0', textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: uppercase, letterSpacing: '0.08em' }}>
              Your Unique Student ID
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--font-display)', margin: '6px 0' }}>
              {result.student_unique_id}
            </div>
            <div className="muted text-sm">
              Please save this ID — you will need it for MIT and Proclaimers registrations.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reg-bg">
      <div className="reg-card wide">
        <div className="reg-header">
          <Logo size={160} style={{ marginBottom: 20, borderRadius: '24px', display: 'block', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))' }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(59,130,246,0.15)', borderRadius: 20,
            padding: '6px 16px', marginBottom: 14, border: '1px solid rgba(59,130,246,0.3)'
          }}>
            <i className="fa-solid fa-graduation-cap" style={{ color: '#3b82f6', fontSize: '0.85rem' }}></i>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3b82f6', letterSpacing: 1 }}>MEMBERSHIP</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', color: 'var(--navy)', margin: '0 0 6px' }}>Membership Registration</h1>
          <p className="muted" style={{ maxWidth: 640, margin: '0 auto', lineHeight: 1.5, fontSize: '0.92rem' }}>
            Welcome to the Membership Unit of the Apostolic Training School (ATS).
            Kindly provide accurate information below to complete your registration.
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <RegistrationForm
            form={form}
            update={update}
            photoPreview={photoPreview}
            onPhotoChange={onPhotoChange}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
