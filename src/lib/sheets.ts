// src/lib/sheets.ts
// VERCEL-SAFE: Leest credentials ALLEEN uit process.env — nooit van schijf.
// Ondersteunt GOOGLE_PRIVATE_KEY of GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
// Ondersteunt GOOGLE_SHEET_ID of GOOGLE_SHEETS_ID

import { google } from 'googleapis';
import { Dienst, DienstStatus, SheetMetadata, CreateDienstInput, UpdateDienstInput } from '@/types/planning';

function getPrivateKey(): string {
  const raw =
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    '';
  if (!raw) throw new Error('GOOGLE_PRIVATE_KEY ontbreekt in Vercel Environment Variables');
  // Vercel slaat \n op als letterlijke \n — converteer naar echte newlines
  return raw.replace(/\\n/g, '\n');
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID || '';
  if (!id) throw new Error('GOOGLE_SHEET_ID ontbreekt in Vercel Environment Variables');
  return id;
}

function getServiceAccountEmail(): string {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  if (!email) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL ontbreekt in Vercel Environment Variables');
  return email;
}

function getSheetName(): string {
  return process.env.GOOGLE_SHEET_NAME || 'Planning ServicePro';
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: getServiceAccountEmail(),
      private_key: getPrivateKey(),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

// ─── Test verbinding ──────────────────────────────────────────────────────────

export async function testSheetsConnection(): Promise<{
  success: boolean;
  message: string;
  sheetTitle?: string;
  rowCount?: number;
}> {
  try {
    const spreadsheetId = getSpreadsheetId();
    const sheetName = getSheetName();
    const sheets = getSheetsClient();

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTitle = meta.data.properties?.title || '(onbekend)';

    const data = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A`,
    });

    const rowCount = Math.max(0, (data.data.values?.length || 0) - 3);

    return {
      success: true,
      message: `Verbinding geslaagd met "${sheetTitle}"`,
      sheetTitle,
      rowCount,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Verbinding mislukt: ${msg}` };
  }
}

// ─── Column mapping ───────────────────────────────────────────────────────────
// A=Datum B=Projectnr C=Services D=Medewerker
// E=Status F=Startijd G=Pauze H=Einddtijd I=Uren gewerkt
// Rij 1-2 = branding, rij 3 = headers, rij 4+ = data

const DATA_START_ROW = 4;

function parseUren(s: string | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function rowToDienst(row: string[], rowIndex: number): Dienst | null {
  if (!row[0] && !row[1]) return null;
  return {
    id: String(rowIndex),
    datum: row[0] || '',
    projectnr: row[1] || '',
    services: row[2] || '',
    medewerker: row[3] || '',
    status: (row[4] || 'Open') as DienstStatus,
    startTijd: row[5] || '',
    pauze: row[6] || '',
    eindTijd: row[7] || '',
    urenGewerkt: parseUren(row[8]),
    rowIndex,
  };
}

function dienstToRow(d: CreateDienstInput): string[] {
  let uren = 0;
  if (d.startTijd && d.eindTijd) {
    const [sh, sm] = d.startTijd.split(':').map(Number);
    const [eh, em] = d.eindTijd.split(':').map(Number);
    const pauzeMin = parseInt(d.pauze || '0') || 0;
    const totalMin = (eh * 60 + em) - (sh * 60 + sm) - pauzeMin;
    uren = Math.round((totalMin / 60) * 100) / 100;
  }
  return [d.datum, d.projectnr, d.services, d.medewerker, d.status, d.startTijd, d.pauze || '', d.eindTijd, String(uren)];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: unknown; expires: number }>();

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlSeconds = 60) {
  cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

export function invalidateCache() { cache.clear(); }

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getAllDiensten(): Promise<Dienst[]> {
  const cached = getCache<Dienst[]>('diensten');
  if (cached) return cached;

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getSheetName();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:J`,
  });

  const rows = res.data.values || [];
  const diensten: Dienst[] = [];

  for (let i = DATA_START_ROW - 1; i < rows.length; i++) {
    const d = rowToDienst(rows[i] || [], i + 1);
    if (d) diensten.push(d);
  }

  setCache('diensten', diensten, 60);
  return diensten;
}

export async function getSheetMetadata(): Promise<SheetMetadata> {
  const cached = getCache<SheetMetadata>('metadata');
  if (cached) return cached;

  const diensten = await getAllDiensten();
  const metadata: SheetMetadata = {
    services: [...new Set(diensten.map(d => d.services).filter(Boolean))].sort(),
    medewerkers: [...new Set(diensten.map(d => d.medewerker).filter(Boolean))].sort(),
    projectnummers: [...new Set(diensten.map(d => d.projectnr).filter(Boolean))].sort(),
  };

  setCache('metadata', metadata, 120);
  return metadata;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createDienst(input: CreateDienstInput): Promise<number> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getSheetName();

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:I`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [dienstToRow(input)] },
  });

  invalidateCache();
  const match = (res.data.updates?.updatedRange || '').match(/:(\d+)$/);
  return match ? parseInt(match[1]) : 0;
}

export async function updateDienst(input: UpdateDienstInput): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getSheetName();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${input.rowIndex}:I${input.rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [dienstToRow(input)] },
  });

  invalidateCache();
}

export async function updateStatus(rowIndex: number, status: DienstStatus): Promise<void> {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${getSheetName()}!E${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });

  invalidateCache();
}

export async function deleteDienst(rowIndex: number): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getSheetName();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
        },
      }],
    },
  });

  invalidateCache();
}
