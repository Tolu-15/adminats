'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import Logo from './Logo';

const NavItem = ({ href, icon, label, active, onClick }) => (
  <Link href={href} className={`${active ? 'active' : ''}`} onClick={onClick}>
    <span className="nav-icon">{icon}</span>
    {label}
  </Link>
);

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  }

  const toggleMobile = () => setMobileOpen((v) => !v);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile Top Header */}
      <div className="mobile-admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="mobile-menu-btn" onClick={toggleMobile} aria-label="Toggle Navigation">
            {mobileOpen ? '✕' : '☰ Menu'}
          </button>
          <Logo size={36} style={{ borderRadius: '8px' }} />
          <strong style={{ color: '#fff', fontSize: '0.92rem' }}>ATS Admin</strong>
        </div>
      </div>

      {/* Backdrop overlay when drawer is open */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={closeMobile} />
      )}

      {/* Sidebar drawer */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo size={56} style={{ borderRadius: '10px', flexShrink: 0 }} />
          <div className="sidebar-brand-text">
            <strong>ATS Admin</strong>
            <span>ATS Records Portal</span>
          </div>
          <button className="mobile-close-btn" onClick={closeMobile}>✕</button>
        </div>

        <div className="sidebar-section-label">Main</div>
        <nav className="sidebar-nav">
          <NavItem
            href="/admin"
            icon={<DashboardIcon />}
            label="Dashboard"
            active={pathname === '/admin'}
            onClick={closeMobile}
          />
          <NavItem
            href="/admin/search"
            icon={<SearchIcon />}
            label="Search Students"
            active={pathname === '/admin/search'}
            onClick={closeMobile}
          />
        </nav>

        <div className="sidebar-section-label">Batches</div>
        <nav className="sidebar-nav">
          <NavItem
            href="/admin"
            icon={<BatchIcon />}
            label="All Batches"
            active={false}
            onClick={closeMobile}
          />
        </nav>

        <div style={{ flex: 1 }} />

        <div className="sidebar-signout">
          <nav className="sidebar-nav">
            <button onClick={signOut}>
              <span className="nav-icon"><SignOutIcon /></span>
              Sign Out
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
}

/* ── Inline SVG icons ── */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path d="M2 10a8 8 0 1 1 16 0A8 8 0 0 1 2 10Zm8-5a1 1 0 0 1 1 1v3.586l2.207 2.207a1 1 0 0 1-1.414 1.414l-2.5-2.5A1 1 0 0 1 9 10V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  );
}
function BatchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4ZM3 10a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2ZM4 15a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H4Z" />
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-.943a.75.75 0 1 1 1.004-1.114l2.5 2.25a.75.75 0 0 1 0 1.114l-2.5 2.25a.75.75 0 1 1-1.004-1.114l1.048-.943H6.75A.75.75 0 0 1 6 10Z" clipRule="evenodd" />
    </svg>
  );
}
