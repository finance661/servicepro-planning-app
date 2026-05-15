// src/app/api/sheets/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateDienst, updateStatus, deleteDienst } from '@/lib/sheets';

// PUT /api/sheets/[id] - update dienst or just status
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  try {
    const rowIndex = parseInt(params.id);
    const body = await req.json();

    if (body.statusOnly) {
      await updateStatus(rowIndex, body.status);
    } else {
      await updateDienst({ ...body, rowIndex });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/sheets]', err);
    return NextResponse.json({ error: 'Fout bij bijwerken dienst' }, { status: 500 });
  }
}

// DELETE /api/sheets/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  try {
    const rowIndex = parseInt(params.id);
    await deleteDienst(rowIndex);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/sheets]', err);
    return NextResponse.json({ error: 'Fout bij verwijderen dienst' }, { status: 500 });
  }
}
