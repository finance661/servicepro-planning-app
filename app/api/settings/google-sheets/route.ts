import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      sheetId: process.env.GOOGLE_SHEET_ID || '',
      sheetName: process.env.GOOGLE_SHEET_NAME || 'Planning ServicePro',
      hasPrivateKey: !!(process.env.GOOGLE_PRIVATE_KEY),
      configured: true,
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
