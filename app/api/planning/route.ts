import { NextRequest, NextResponse } from "next/server";
import { addPlanningItem, getPlanning, getPlanningDiagnostics } from "@/lib/googleSheets";
import { jsonError } from "@/lib/apiResponse";
import type { PlanningInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const planning = await getPlanning({ forceRefresh: request.nextUrl.searchParams.get("refresh") === "1" });
    if (request.nextUrl.searchParams.get("debug") === "1") {
      return NextResponse.json({ planning, diagnostics: getPlanningDiagnostics() });
    }
    return NextResponse.json(planning);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlanningInput;
    const created = await addPlanningItem(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[ServicePro Sheets] Dienst opslaan mislukt:", error);
    return jsonError(new Error("Opslaan naar Google Sheets mislukt."), 500);
  }
}
