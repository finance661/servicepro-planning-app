'use client';

// src/app/login/page.tsx

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/planning');
  }, [status, router]);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div style={{ 
            width: 60, height: 60, background: '#1e3a5f', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M18 4L30 10v16L18 32 6 26V10L18 4z" fill="white" opacity="0.2"/>
              <path d="M18 4L30 10v16L18 32 6 26V10L18 4z" stroke="white" strokeWidth="1.5" fill="none"/>
              <path d="M18 4v28M6 10l24 0M6 26l24 0" stroke="white" strokeWidth="1" opacity="0.4"/>
            </svg>
          </div>
          <h1>ServicePro</h1>
          <p>Planning &amp; Diensten Beheer</p>
        </div>

        <p style={{ fontSize: 13, color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Log in met je Google Workspace account om toegang te krijgen tot de planning.
        </p>

        <button
          className="btn-google"
          onClick={() => signIn('google', { callbackUrl: '/planning' })}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Inloggen met Google
        </button>

        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: '1.5rem' }}>
          Alleen toegankelijk voor geautoriseerde medewerkers van ServicePro B.V.
        </p>
      </div>
    </div>
  );
}
