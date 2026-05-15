// src/types/planning.ts

export type DienstStatus = 'Open' | 'Gesloten' | 'Geannuleerd' | 'Ziek';

export interface Dienst {
  id: string;           // row index as string
  datum: string;        // "15-01-25" or "DD-MM-YY"
  projectnr: string;
  services: string;
  medewerker: string;
  status: DienstStatus;
  startTijd: string;    // "HH:MM"
  pauze: string;        // minutes or empty
  eindTijd: string;     // "HH:MM"
  urenGewerkt: number;
  rowIndex: number;     // 1-based row in Google Sheets
}

export interface FilterOptions {
  beginDatum: string;
  eindDatum: string;
  service: string;
  medewerker: string;
  status: string;
}

export interface SheetMetadata {
  services: string[];
  medewerkers: string[];
  projectnummers: string[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface CreateDienstInput {
  datum: string;
  projectnr: string;
  services: string;
  medewerker: string;
  status: DienstStatus;
  startTijd: string;
  pauze?: string;
  eindTijd: string;
}

export interface UpdateDienstInput extends CreateDienstInput {
  rowIndex: number;
}
