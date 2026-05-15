import { NextResponse } from 'next/server';

export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const sheetId = process.env.GOOGLE_SHEET_ID || '';
  const privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Planning ServicePro';

  return NextResponse.json({
    success: true,
    data: {
      serviceAccountEmail: email,
      sheetId: sheetId,
      sheetName: sheetName,
      hasPrivateKey: !!(privateKey),
      configured: !!(email && sheetId && privateKey),
    }
  });
}

export async function POST() {
  return NextResponse.json({
    success: true,
    configured: true,
    message: 'Configuratie wordt beheerd via Vercel Environment Variables.',
  });
}
