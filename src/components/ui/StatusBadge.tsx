'use client';

// src/components/ui/StatusBadge.tsx

import { DienstStatus } from '@/types/planning';

const MAP: Record<DienstStatus, string> = {
  Open: 'status-open',
  Gesloten: 'status-gesloten',
  Geannuleerd: 'status-geannuleerd',
  Ziek: 'status-ziek',
};

export function StatusBadge({ status }: { status: DienstStatus }) {
  return (
    <span className={`status-badge ${MAP[status] || 'status-open'}`}>
      {status}
    </span>
  );
}
