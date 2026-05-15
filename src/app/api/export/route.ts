// src/app/api/export/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllDiensten } from '@/lib/sheets';
import { exportToExcel } from '@/lib/export';
import { dienstDatumInRange } from '@/lib/dates';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const begin = searchParams.get('begin');
    const eind = searchParams.get('eind');
    const service = searchParams.get('service') || '';
    const medewerker = searchParams.get('medewerker') || '';

    let diensten = await getAllDiensten();

    if (begin && eind) {
      diensten = diensten.filter(d => dienstDatumInRange(d.datum, begin, eind));
    }
    if (service) {
      diensten = diensten.filter(d => d.services.toLowerCase().includes(service.toLowerCase()));
    }
    if (medewerker) {
      diensten = diensten.filter(d => d.medewerker.toLowerCase().includes(medewerker.toLowerCase()));
    }

    const buffer = exportToExcel(diensten);
    const datum = format(new Date(), 'yyyy-MM-dd');
    const filename = `ServicePro_Planning_${datum}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('[GET /api/export]', err);
    return NextResponse.json({ error: 'Fout bij exporteren' }, { status: 500 });
  }
}
