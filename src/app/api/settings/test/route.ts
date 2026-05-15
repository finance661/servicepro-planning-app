// src/app/api/settings/test/route.ts
//
// Test de Google Sheets verbinding puur via process.env — geen file reads.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { testSheetsConnection } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const result = await testSheetsConnection();
  return NextResponse.json(result);
}
