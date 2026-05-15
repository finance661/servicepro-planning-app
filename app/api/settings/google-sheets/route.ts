import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Configuratie wordt beheerd via Vercel Environment Variables.'
  });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      sheetId: process.env.GOOGLE_SHEET_ID || '',
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
    }
  });
}
