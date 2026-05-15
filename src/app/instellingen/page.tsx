'use client';

// src/app/instellingen/page.tsx
// In productie: Opslaan is UITGESCHAKELD — configuratie via Vercel Environment Variables.
// Test verbinding werkt altijd. Kruisje/sluiten werkt altijd.

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/ui/AppHeader';

interface ConfigStatus {
  sheetId: string;
  sheetName: string;
  serviceAccountEmail: string;
  hasPrivateKey: boolean;
  isVercelManaged: boolean;
}

interface TestResult {
  success: boolean;
  message: string;
  sheetTitle?: string;
  rowCount?: number;
}

export default function InstellingenPage() {
  const { status } = useSession();
  const router = useRouter();

  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [showPanel, setShowPanel] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(j => { if (j.success) setConfig(j.data); })
      .catch(() => {});
  }, []);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test');
      const json = await res.json();
      setTestResult(json);
    } catch {
      setTestResult({ success: false, message: 'Netwerkfout bij testen verbinding' });
    } finally {
      setTesting(false);
    }
  }

  function handleClose() {
    router.push('/planning');
  }

  if (!showPanel) return null;

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main" style={{ maxWidth: 680 }}>

        {/* Header with close button */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}>
          <div className="page-title">⚙️ Instellingen</div>
          <button
            onClick={handleClose}
            aria-label="Sluiten"
            style={{
              width: 36, height: 36, borderRadius: 8,
              border: '1px solid var(--sp-border)',
              background: 'var(--sp-surface)',
              cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--sp-text-muted)',
            }}
          >
            ×
          </button>
        </div>

        {/* Vercel managed banner */}
        {config?.isVercelManaged && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: '1.25rem',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 20 }}>☁️</span>
            <div>
              <div style={{ fontWeight: 600, color: '#1d4ed8', marginBottom: 4 }}>
                Geconfigureerd via Vercel Environment Variables
              </div>
              <div style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
                De Google Sheets koppeling wordt beheerd via de Vercel omgevingsvariabelen.
                Wijzigingen maak je in het <strong>Vercel Dashboard → Settings → Environment Variables</strong>.
                Na een wijziging opnieuw deployen om de nieuwe waarden te activeren.
              </div>
            </div>
          </div>
        )}

        {/* Config overview card */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <span style={{ fontWeight: 600 }}>📋 Huidige configuratie</span>
          </div>
          <div className="card-body">
            {config ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {[
                    { label: 'GOOGLE_SHEET_ID', value: config.sheetId || '—', ok: !!config.sheetId },
                    { label: 'GOOGLE_SHEET_NAME', value: config.sheetName || '—', ok: !!config.sheetName },
                    { label: 'GOOGLE_SERVICE_ACCOUNT_EMAIL', value: config.serviceAccountEmail || '—', ok: !!config.serviceAccountEmail },
                    { label: 'GOOGLE_PRIVATE_KEY', value: config.hasPrivateKey ? '✓ Aanwezig' : '✗ Ontbreekt', ok: config.hasPrivateKey },
                  ].map(row => (
                    <tr key={row.label} style={{ borderBottom: '1px solid var(--sp-border)' }}>
                      <td style={{ padding: '10px 0', color: 'var(--sp-text-muted)', width: '50%', fontFamily: 'monospace', fontSize: 12 }}>
                        {row.label}
                      </td>
                      <td style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                          background: row.ok ? '#16a34a' : '#dc2626', flexShrink: 0,
                        }} />
                        <span style={{ color: row.ok ? 'var(--sp-text)' : '#dc2626' }}>{row.value}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--sp-text-muted)', fontSize: 13 }}>Laden...</div>
            )}
          </div>
        </div>

        {/* Test connection card */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <span style={{ fontWeight: 600 }}>🔌 Verbinding testen</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--sp-text-muted)', marginBottom: '1rem' }}>
              Controleer of de Google Sheets koppeling werkt met de huidige configuratie.
            </p>

            <button
              className="btn btn-primary"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? '⏳ Testen...' : '🔌 Test verbinding'}
            </button>

            {testResult && (
              <div style={{
                marginTop: '1rem',
                padding: '12px 16px',
                borderRadius: 8,
                background: testResult.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${testResult.success ? '#bbf7d0' : '#fca5a5'}`,
                color: testResult.success ? '#15803d' : '#b91c1c',
                fontSize: 13,
              }}>
                <div style={{ fontWeight: 600, marginBottom: testResult.sheetTitle ? 6 : 0 }}>
                  {testResult.success ? '✅' : '❌'} {testResult.message}
                </div>
                {testResult.success && testResult.rowCount !== undefined && (
                  <div style={{ opacity: 0.8 }}>
                    {testResult.rowCount} diensten geladen uit sheet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save button - disabled in production */}
        {config?.isVercelManaged && (
          <div className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-outline"
                disabled
                title="Configuratie wordt beheerd via Vercel Environment Variables"
                style={{ opacity: 0.4, cursor: 'not-allowed' }}
              >
                💾 Opslaan
              </button>
              <span style={{ fontSize: 12, color: 'var(--sp-text-muted)' }}>
                Niet beschikbaar — configuratie wordt beheerd via Vercel Environment Variables.
              </span>
            </div>
          </div>
        )}

        {/* Back button */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button className="btn btn-outline" onClick={handleClose}>
            ← Terug naar planning
          </button>
        </div>

      </main>
    </div>
  );
}
