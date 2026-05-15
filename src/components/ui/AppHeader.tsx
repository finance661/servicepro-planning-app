'use client';

// src/components/ui/AppHeader.tsx

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

export function AppHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const initials = session?.user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <header className="app-header">
      <Link href="/planning" className="logo">
        <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
          <path d="M18 4L30 10v16L18 32 6 26V10L18 4z" fill="white" opacity="0.25"/>
          <path d="M18 4L30 10v16L18 32 6 26V10L18 4z" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M12 18h12M18 12v12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        ServicePro <span>Planning</span>
      </Link>

      <nav className="header-nav">
        <Link href="/planning" className={pathname.startsWith('/planning') ? 'active' : ''}>
          📅 Planning
        </Link>
        <Link href="/instellingen" className={pathname.startsWith('/instellingen') ? 'active' : ''}>
          ⚙️ Instellingen
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="user-badge">
          <div className="user-avatar">{initials}</div>
          <span className="hide-mobile">{session?.user?.name?.split(' ')[0]}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          Uitloggen
        </button>
      </div>
    </header>
  );
}
