'use client';

// src/app/planning/page.tsx

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Dienst, FilterOptions, SheetMetadata } from '@/types/planning';
import { AppHeader } from '@/components/ui/AppHeader';
import { PlanningTable } from '@/components/planning/PlanningTable';
import { DienstFormModal } from '@/components/planning/DienstFormModal';
import {
  todayForInput,
  getWeekRange,
  getMonthRange,
  getWeekNumber,
  formatMonthHeader,
} from '@/lib/dates';
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, parse } from 'date-fns';
import { nl } from 'date-fns/locale';

type ViewMode = 'dag' | 'week' | 'maand';

export default function PlanningPage() {
  const { status } = useSession();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<Partial<FilterOptions>>({});
  const [diensten, setDiensten] = useState<Dienst[]>([]);
  const [metadata, setMetadata] = useState<SheetMetadata>({ services: [], medewerkers: [], projectnummers: [] });
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const getDateRange = useCallback(() => {
    if (viewMode === 'dag') {
      const d = format(currentDate, 'yyyy-MM-dd');
      return { begin: d, eind: d };
    }
    if (viewMode === 'week') return getWeekRange(currentDate);
    return getMonthRange(currentDate);
  }, [viewMode, currentDate]);

  const fetchDiensten = useCallback(async () => {
    setLoading(true);
    try {
      const { begin, eind } = getDateRange();
      const params = new URLSearchParams({ begin, eind });
      if (filters.service) params.set('service', filters.service);
      if (filters.medewerker) params.set('medewerker', filters.medewerker);
      if (filters.status) params.set('status', filters.status);

      const res = await fetch(`/api/sheets?${params}`);
      const json = await res.json();
      if (json.success) {
        setDiensten(json.data);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error('Fout bij ophalen diensten:', err);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, filters]);

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/sheets?metadata=1');
      const json = await res.json();
      if (json.success) setMetadata(json.data);
    } catch (err) {
      console.error('Fout bij ophalen metadata:', err);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDiensten();
      fetchMetadata();
    }
  }, [status, fetchDiensten, fetchMetadata]);

  function navigate(dir: 'prev' | 'next') {
    setCurrentDate(d => {
      if (viewMode === 'dag') return dir === 'next' ? addDays(d, 1) : subDays(d, 1);
      if (viewMode === 'week') return dir === 'next' ? addWeeks(d, 1) : subWeeks(d, 1);
      return dir === 'next' ? addMonths(d, 1) : subMonths(d, 1);
    });
  }

  function getDateLabel(): string {
    if (viewMode === 'dag') return format(currentDate, 'EEEE d MMMM yyyy', { locale: nl });
    if (viewMode === 'week') {
      const { begin, eind } = getWeekRange(currentDate);
      const b = parse(begin, 'yyyy-MM-dd', new Date());
      const e = parse(eind, 'yyyy-MM-dd', new Date());
      return `Week ${getWeekNumber(currentDate)} · ${format(b, 'd MMM')} – ${format(e, 'd MMM yyyy', { locale: nl })}`;
    }
    return formatMonthHeader(format(currentDate, 'yyyy-MM-dd'));
  }

  const totalUren = diensten.reduce((s, d) => s + d.urenGewerkt, 0);
  const { begin, eind } = getDateRange();

  function handleExport() {
    const params = new URLSearchParams({ begin, eind });
    if (filters.service) params.set('service', filters.service);
    if (filters.medewerker) params.set('medewerker', filters.medewerker);
    window.open(`/api/export?${params}`, '_blank');
  }

  if (status === 'loading') {
    return (
      <div className="app-shell">
        <div className="loading-spinner" style={{ minHeight: '100vh' }}>
          <div className="spinner" />
          Laden...
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        {/* Page header */}
        <div className="page-header">
          <div>
            <div className="page-title">
              Planning
              <span className="page-title-sub">{getDateLabel()}</span>
            </div>
            {lastRefresh && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Gesynchroniseerd: {format(lastRefresh, 'HH:mm:ss')}
              </div>
            )}
          </div>

          <div className="header-actions">
            {/* View toggle */}
            <div className="view-toggle">
              {(['dag', 'week', 'maand'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  className={viewMode === v ? 'active' : ''}
                  onClick={() => setViewMode(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Date navigation */}
            <div className="date-nav">
              <button onClick={() => navigate('prev')} title="Vorige">‹</button>
              <button onClick={() => setCurrentDate(new Date())} title="Vandaag" style={{ width: 'auto', padding: '0 10px' }}>
                Vandaag
              </button>
              <button onClick={() => navigate('next')} title="Volgende">›</button>
            </div>

            {/* Actions */}
            <button className="btn btn-outline" onClick={handleExport} title="Exporteer naar Excel">
              📥 Excel
            </button>
            <button className="btn btn-primary" onClick={() => setShowNewForm(true)}>
              ➕ Nieuwe dienst
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="filters-row">
            <div className="filter-group">
              <label>Service</label>
              <select
                value={filters.service || ''}
                onChange={e => setFilters(f => ({ ...f, service: e.target.value }))}
              >
                <option value="">Alle services</option>
                {metadata.services.map(s => (
                  <option key={s} value={s}>{s.length > 35 ? s.slice(0, 35) + '…' : s}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Medewerker</label>
              <select
                value={filters.medewerker || ''}
                onChange={e => setFilters(f => ({ ...f, medewerker: e.target.value }))}
              >
                <option value="">Alle medewerkers</option>
                {metadata.medewerkers.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.status || ''}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              >
                <option value="">Alle statussen</option>
                <option value="Open">Open</option>
                <option value="Gesloten">Gesloten</option>
                <option value="Geannuleerd">Geannuleerd</option>
                <option value="Ziek">Ziek</option>
              </select>
            </div>

            {(filters.service || filters.medewerker || filters.status) && (
              <button
                className="btn btn-outline btn-sm"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => setFilters({})}
              >
                ✕ Wis filters
              </button>
            )}

            <button
              className="btn btn-outline btn-sm"
              style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}
              onClick={fetchDiensten}
              title="Data vernieuwen"
            >
              🔄 Vernieuwen
            </button>
          </div>
        </div>

        {/* Data card */}
        <div className="card">
          {/* Stats */}
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-value">{diensten.length}</span>
              <span className="stat-label">diensten</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value">{Math.round(totalUren * 10) / 10}</span>
              <span className="stat-label">totaal uren</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value">
                {[...new Set(diensten.map(d => d.medewerker))].length}
              </span>
              <span className="stat-label">medewerkers</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value" style={{ color: '#15803d' }}>
                {diensten.filter(d => d.status === 'Gesloten').length}
              </span>
              <span className="stat-label">gesloten</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value" style={{ color: '#1d4ed8' }}>
                {diensten.filter(d => d.status === 'Open').length}
              </span>
              <span className="stat-label">open</span>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="loading-spinner">
              <div className="spinner" />
              Data ophalen uit Google Sheets...
            </div>
          ) : (
            <PlanningTable
              diensten={diensten}
              metadata={metadata}
              onRefresh={fetchDiensten}
            />
          )}
        </div>
      </main>

      {showNewForm && (
        <DienstFormModal
          dienst={null}
          metadata={metadata}
          onClose={() => setShowNewForm(false)}
          onSaved={() => { setShowNewForm(false); fetchDiensten(); fetchMetadata(); }}
        />
      )}
    </div>
  );
}
