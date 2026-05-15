// Vercel-safe: leest alleen uit environment variables, schrijft nooit naar schijf

export function getGoogleSheetsConfig() {
  return {
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    sheetId: process.env.GOOGLE_SHEET_ID || '',
    sheetName: process.env.GOOGLE_SHEET_NAME || 'Planning ServicePro',
  };
}

export function saveGoogleSheetsConfig() {
  // Uitgeschakeld op Vercel - gebruik Environment Variables
  return { success: false, message: 'Gebruik Vercel Environment Variables' };
}

export function getGoogleSheetsSettings() {
  return getGoogleSheetsConfig();
}
