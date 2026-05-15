// src/app/api/settings/route.ts
//
// VERCEL-SAFE: Schrijft NOOIT naar het file system.
// GET: geeft configuratiestatus terug (geen secrets)
// POST: altijd uitgeschakeld — meldt dat Vercel env vars gebruikt worden

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { testSheetsConnection } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const config = {
    sheetId: process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID || '',
    sheetName: process.env.GOOGLE_SHEET_NAME || 'Planning ServicePro',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    hasPrivateKey: !!(process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
    // Altijd true — app draait op Vercel of production
    isVercelManaged: true,
  };

  return NextResponse.json({ success: true, data: config });
}

// POST is volledig uitgeschakeld — geen fs operaties, nooit
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  return NextResponse.json({
    success: false,
    managed: true,
    message:
      'Configuratie wordt beheerd via Vercel Environment Variables. ' +
      'Wijzig de waarden in Vercel Dashboard → Settings → Environment Variables.',
  });
}
