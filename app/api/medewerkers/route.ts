import { NextRequest, NextResponse } from "next/server";
import { getMedewerkers } from "@/lib/googleSheets";
import { jsonError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const medewerkers = await getMedewerkers({ forceRefresh: request.nextUrl.searchParams.get("refresh") === "1" });
    return NextResponse.json(medewerkers);
  } catch (error) {
    return jsonError(error);
  }
}
