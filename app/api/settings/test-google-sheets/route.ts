import { NextRequest, NextResponse } from "next/server";
import { getGoogleSheetsErrorMessage, testGoogleSheetsConnection } from "@/lib/googleSheets";
import {
  DEFAULT_GOOGLE_SHEET_ID,
  getGoogleSheetsSettings,
  type GoogleSheetsSettings
} from "@/lib/googleSheetsSettings";
import { jsonError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizePrivateKey(value: string): string {
  return value.trim().replace(/\\n/g, "\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      clientEmail?: string;
      privateKey?: string;
      sheetId?: string;
    };
    const saved = await getGoogleSheetsSettings();
    const clientEmail = body.clientEmail?.trim() || saved?.serviceAccountEmail || "";
    const privateKey = body.privateKey?.trim() ? normalizePrivateKey(body.privateKey) : saved?.privateKey || "";
    const sheetId = body.sheetId?.trim() || saved?.sheetId || DEFAULT_GOOGLE_SHEET_ID;

    if (!clientEmail || !sheetId) {
      return NextResponse.json(
        { error: "Vul de Google Service Account Email en Google Sheet ID in." },
        { status: 400 }
      );
    }

    if (!privateKey) {
      return NextResponse.json(
        { error: "Plak opnieuw de private key uit je JSON-bestand." },
        { status: 400 }
      );
    }

    const settings: GoogleSheetsSettings = {
      serviceAccountEmail: clientEmail,
      privateKey,
      sheetId
    };

    await testGoogleSheetsConnection(settings);

    return NextResponse.json({
      ok: true,
      message: "Google Sheets succesvol gekoppeld"
    });
  } catch (error) {
    return jsonError(new Error(getGoogleSheetsErrorMessage(error)), 400);
  }
}
