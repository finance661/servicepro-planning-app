import { NextResponse } from "next/server";
import { getLogboek } from "@/lib/googleSheets";
import { jsonError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const logboek = await getLogboek(100);
    return NextResponse.json(logboek);
  } catch (error) {
    return jsonError(error);
  }
}
