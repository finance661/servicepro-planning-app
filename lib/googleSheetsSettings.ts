export type GoogleSheetsSettings = {
  privateKey: string;
  clientEmail: string;
  serviceAccountEmail: string;
  sheetId: string;
  sheetName: string;
};

export const DEFAULT_GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '';

export function getGoogleSheetsConfig(): GoogleSheetsSettings {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return {
    privateKey,
    clientEmail: email,
    serviceAccountEmail: email,
    sheetId: process.env.GOOGLE_SHEET_ID || '',
    sheetName: process.env.GOOGLE_SHEET_NAME || 'Planning ServicePro',
  };
}

export function getGoogleSheetsSettings(): GoogleSheetsSettings {
  return getGoogleSheetsConfig();
}

export function requireGoogleSheetsSettings(): GoogleSheetsSettings {
  return getGoogleSheetsConfig();
}

export function saveGoogleSheetsConfig() {
  return { success: false, message: 'Gebruik Vercel Environment Variables' };
}
