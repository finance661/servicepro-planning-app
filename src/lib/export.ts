// src/lib/export.ts

import * as XLSX from 'xlsx';
import { Dienst } from '@/types/planning';
import { formatDatumDisplay } from './dates';

export function exportToExcel(diensten: Dienst[], filename?: string): Buffer {
  // Build worksheet data
  const headers = [
    'Datum', 'Projectnr.', 'Services', 'Medewerker',
    'Status', 'Starttijd', 'Pauze', 'Eindtijd', 'Uren gewerkt'
  ];

  const rows = diensten.map(d => [
    formatDatumDisplay(d.datum),
    d.projectnr,
    d.services,
    d.medewerker,
    d.status,
    d.startTijd,
    d.pauze,
    d.eindTijd,
    d.urenGewerkt,
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 35 }, { wch: 22 },
    { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
  ];

  // Style header row (bold)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1E3A5F' } },
      alignment: { horizontal: 'center' },
    };
  }

  // Totaalrij
  const totalUren = diensten.reduce((sum, d) => sum + d.urenGewerkt, 0);
  const totalRow = [
    'TOTAAL', '', '', '', '', '', '', '',
    Math.round(totalUren * 100) / 100,
  ];
  XLSX.utils.sheet_add_aoa(ws, [totalRow], { origin: -1 });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planning');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
