// src/app/api/sheets/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllDiensten, createDienst, getSheetMetadata } from '@/lib/sheets';
import { dienstDatumInRange } from '@/lib/dates';

// GET /api/sheets?begin=YYYY-MM-DD&eind=YYYY-MM-DD&service=...&medewerker=...&status=...
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const begin = searchParams.get('begin');
    const eind = searchParams.get('eind');
    const service = searchParams.get('service') || '';
    const medewerker = searchParams.get('medewerker') || '';
    const status = searchParams.get('status') || '';
    const metadataOnly = searchParams.get('metadata') === '1';

    if (metadataOnly) {
      const metadata = await getSheetMetadata();
      return NextResponse.json({ success: true, data: metadata });
    }

    let diensten = await getAllDiensten();

    // Filter by date range
    if (begin && eind) {
      diensten = diensten.filter(d => dienstDatumInRange(d.datum, begin, eind));
    }

    // Filter by service
    if (service) {
      diensten = diensten.filter(d =>
        d.services.toLowerCase().includes(service.toLowerCase())
      );
    }

    // Filter by medewerker
    if (medewerker) {
      diensten = diensten.filter(d =>
        d.medewerker.toLowerCase().includes(medewerker.toLowerCase())
      );
    }

    // Filter by status
    if (status) {
      diensten = diensten.filter(d => d.status === status);
    }

    return NextResponse.json({ success: true, data: diensten });
  } catch (err) {
    console.error('[GET /api/sheets]', err);
    return NextResponse.json({ error: 'Fout bij ophalen data' }, { status: 500 });
  }
}

// POST /api/sheets - create new dienst
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  try {
    const body = await req.json();
    const newRowIndex = await createDienst(body);
    return NextResponse.json({ success: true, data: { rowIndex: newRowIndex } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/sheets]', err);
    return NextResponse.json({ error: 'Fout bij aanmaken dienst' }, { status: 500 });
  }
}
