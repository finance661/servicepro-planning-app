import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Gebruik Vercel Environment Variables voor configuratie.'
  });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    connected: !!(process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SHEET_ID),
    message: 'Configuratie via Vercel Environment Variables.'
  });
}
