'use client';

// src/components/planning/PlanningTable.tsx

import { useState } from 'react';
import { Dienst, DienstStatus, SheetMetadata } from '@/types/planning';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DienstFormModal } from './DienstFormModal';
import { formatDatumDisplay, formatWeekdayShort } from '@/lib/dates';

interface Props {
  diensten: Dienst[];
  metadata: SheetMetadata;
  onRefresh: () => void;
}

const STATUSSEN: DienstStatus[] = ['Open', 'Gesloten', 'Geannuleerd', 'Ziek'];

export function PlanningTable({ diensten, metadata, onRefresh }: Props) {
  const [editDienst, setEditDienst] = useState<Dienst | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  async function handleStatusChange(d: Dienst, status: DienstStatus) {
    setUpdatingStatus(d.rowIndex);
    try {
      await fetch(`/api/sheets/${d.rowIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusOnly: true, status }),
      });
      onRefresh();
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function handleDelete(d: Dienst) {
    if (!confirm(`Dienst van ${d.medewerker} op ${formatDatumDisplay(d.datum)} verwijderen?`)) return;
    setDeletingId(d.rowIndex);
    try {
      await fetch(`/api/sheets/${d.rowIndex}`, { method: 'DELETE' });
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(d: Dienst) {
    setEditDienst(d);
    setShowForm(true);
  }

  function handleNewDienst() {
    setEditDienst(null);
    setShowForm(true);
  }

  function handleSaved() {
    setShowForm(false);
    setEditDienst(null);
    onRefresh();
  }

  if (diensten.length === 0) {
    return (
      <>
        <div className="empty-state">
          <div style={{ fontSize: 36 }}>📋</div>
          <p>Geen diensten gevonden voor deze filters.</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={handleNewDienst}>
            ➕ Nieuwe dienst
          </button>
        </div>

        {showForm && (
          <DienstFormModal
            dienst={editDienst}
            metadata={metadata}
            onClose={() => setShowForm(false)}
            onSaved={handleSaved}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Projectnr.</th>
              <th>Service</th>
              <th>Medewerker</th>
              <th>Status</th>
              <th>Start</th>
              <th>Einde</th>
              <th className="col-uren">Uren</th>
              <th style={{ width: 100 }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {diensten.map(d => (
              <tr key={d.id}>
                <td className="col-datum">
                  <div style={{ fontWeight: 500 }}>{formatDatumDisplay(d.datum)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
                    {formatWeekdayShort(d.datum)}
                  </div>
                </td>
                <td>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {d.projectnr}
                  </span>
                </td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.services}
                </td>
                <td style={{ fontWeight: 500 }}>{d.medewerker}</td>
                <td>
                  {updatingStatus === d.rowIndex ? (
                    <span style={{ color: '#64748b', fontSize: 12 }}>Opslaan...</span>
                  ) : (
                    <select
                      value={d.status}
                      onChange={e => handleStatusChange(d, e.target.value as DienstStatus)}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {STATUSSEN.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{d.startTijd}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{d.eindTijd}</td>
                <td className="col-uren" style={{ fontWeight: 600 }}>
                  {d.urenGewerkt > 0 ? `${d.urenGewerkt}u` : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => handleEdit(d)}
                      title="Bewerken"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.rowIndex}
                      title="Verwijderen"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <DienstFormModal
          dienst={editDienst}
          metadata={metadata}
          onClose={() => { setShowForm(false); setEditDienst(null); }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
