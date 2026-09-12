'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import Logo from './Logo';

const NavItem = ({ href, icon, label, active, onClick }) => (
  <Link href={href} className={`${active ? 'active' : ''}`} onClick={(e) => onClick && onClick(e)}>
    <span className="nav-icon">{icon}</span>
    {label}
  </Link>
);

export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut(e) {
    if (onNavigate && onNavigate(e) === false) return;
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  }

  const toggleMobile = () => setMobileOpen((v) => !v);
  const closeMobile = () => setMobileOpen(false);

  const handleNavClick = (e) => {
    closeMobile();
    if (onNavigate) {
      onNavigate(e);
    }
  };

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
            onClick={handleNavClick}
          />
          <NavItem
            href="/admin/search"
            icon={<SearchIcon />}
            label="Search Students"
            active={pathname === '/admin/search'}
            onClick={handleNavClick}
          />
        </nav>

        <div className="sidebar-section-label">Batches</div>
        <nav className="sidebar-nav">
          <NavItem
            href="/admin"
            icon={<BatchIcon />}
            label="All Batches"
            active={false}
            onClick={handleNavClick}
          />
        </nav>

        <div className="sidebar-section-label">System & Security</div>
        <nav className="sidebar-nav">
          <NavItem
            href="/admin/audit"
            icon={<AuditIcon />}
            label="Audit Logs"
            active={pathname === '/admin/audit'}
            onClick={handleNavClick}
          />
          <NavItem
            href="/admin/trash"
            icon={<TrashIcon />}
            label="Trash / Recovery"
            active={pathname === '/admin/trash'}
            onClick={handleNavClick}
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
function AuditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path fillRule="evenodd" d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4a.75.75 0 0 0-1.5 0v4.25c0 .2.08.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V6Z" clipRule="evenodd" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
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
