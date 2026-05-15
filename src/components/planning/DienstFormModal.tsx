'use client';

// src/components/planning/DienstFormModal.tsx

import { useState, useEffect } from 'react';
import { Dienst, CreateDienstInput, DienstStatus, SheetMetadata } from '@/types/planning';
import { todayForInput, inputDateToSheet, formatDatumInput } from '@/lib/dates';

interface Props {
  dienst?: Dienst | null;
  metadata: SheetMetadata;
  onClose: () => void;
  onSaved: () => void;
}

const STATUSSEN: DienstStatus[] = ['Open', 'Gesloten', 'Geannuleerd', 'Ziek'];

export function DienstFormModal({ dienst, metadata, onClose, onSaved }: Props) {
  const isEdit = !!dienst;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<CreateDienstInput>({
    datum: todayForInput(),
    projectnr: '',
    services: '',
    medewerker: '',
    status: 'Open',
    startTijd: '',
    pauze: '',
    eindTijd: '',
  });

  useEffect(() => {
    if (dienst) {
      setForm({
        datum: formatDatumInput(dienst.datum) || todayForInput(),
        projectnr: dienst.projectnr,
        services: dienst.services,
        medewerker: dienst.medewerker,
        status: dienst.status,
        startTijd: dienst.startTijd,
        pauze: dienst.pauze,
        eindTijd: dienst.eindTijd,
      });
    }
  }, [dienst]);

  function set(field: keyof CreateDienstInput, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Convert HTML date (YYYY-MM-DD) to sheet format (DD-MM-YY)
    const payload = {
      ...form,
      datum: inputDateToSheet(form.datum),
    };

    try {
      if (isEdit && dienst) {
        const res = await fetch(`/api/sheets/${dienst.rowIndex}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Fout bij bijwerken');
      } else {
        const res = await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Fout bij aanmaken');
      }
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isEdit ? '✏️ Dienst bewerken' : '➕ Nieuwe dienst'}</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Datum *</label>
                <input
                  type="date"
                  required
                  value={form.datum}
                  onChange={e => set('datum', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Projectnr. *</label>
                <select
                  required
                  value={form.projectnr}
                  onChange={e => set('projectnr', e.target.value)}
                >
                  <option value="">— Selecteer —</option>
                  {metadata.projectnummers.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Service *</label>
                <select
                  required
                  value={form.services}
                  onChange={e => set('services', e.target.value)}
                >
                  <option value="">— Selecteer service —</option>
                  {metadata.services.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Medewerker *</label>
                <select
                  required
                  value={form.medewerker}
                  onChange={e => set('medewerker', e.target.value)}
                >
                  <option value="">— Selecteer medewerker —</option>
                  {metadata.medewerkers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value as DienstStatus)}>
                  {STATUSSEN.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Starttijd *</label>
                <input
                  type="time"
                  required
                  value={form.startTijd}
                  onChange={e => set('startTijd', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Eindtijd *</label>
                <input
                  type="time"
                  required
                  value={form.eindTijd}
                  onChange={e => set('eindTijd', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Pauze (minuten)</label>
                <input
                  type="number"
                  min="0"
                  step="15"
                  placeholder="0"
                  value={form.pauze}
                  onChange={e => set('pauze', e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div style={{
                marginTop: '1rem',
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 8,
                color: '#b91c1c',
                fontSize: 13,
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Annuleren
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Opslaan...' : isEdit ? '💾 Bijwerken' : '➕ Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
