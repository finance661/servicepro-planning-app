import { NextRequest, NextResponse } from "next/server";
import { getPublicGoogleSheetsSettings, saveGoogleSheetsSettings } from "@/lib/googleSheetsSettings";
import { jsonError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getPublicGoogleSheetsSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      clientEmail?: string;
      privateKey?: string;
      sheetId?: string;
    };

    const settings = await saveGoogleSheetsSettings({
      clientEmail: body.clientEmail ?? "",
      privateKey: body.privateKey,
      sheetId: body.sheetId
    });

    return NextResponse.json(settings);
  } catch (error) {
    return jsonError(error, 400);
  }
}
