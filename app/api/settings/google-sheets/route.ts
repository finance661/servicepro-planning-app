import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      sheetId: process.env.GOOGLE_SHEET_ID || '',
      sheetName: process.env.GOOGLE_SHEET_NAME || 'Planning ServicePro',
      hasPrivateKey: !!(process.env.GOOGLE_PRIVATE_KEY),
      configured: !!(process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SHEET_ID),
    }
  });
}

export async function POST() {
  return NextResponse.json({
    success: true,
    configured: !!(process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SHEET_ID),
    message: 'Configuratie wordt beheerd via Vercel Environment Variables.',
  });
}
