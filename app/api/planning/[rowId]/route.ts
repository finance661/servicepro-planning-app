import { NextRequest, NextResponse } from "next/server";
import { deletePlanningItem, updatePlanningItem } from "@/lib/googleSheets";
import { jsonError } from "@/lib/apiResponse";
import type { PlanningInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    rowId: string;
  };
};

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const rowId = Number(params.rowId);
    const body = (await request.json()) as PlanningInput;
    const updated = await updatePlanningItem(rowId, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[ServicePro Sheets] Dienst wijzigen mislukt:", error);
    return jsonError(
      error instanceof Error && error.message.includes("Ongeldige") ? error : new Error("Opslaan naar Google Sheets mislukt."),
      error instanceof Error && error.message.includes("Ongeldige") ? 400 : 500
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const rowId = Number(params.rowId);
    const deleted = await deletePlanningItem(rowId);
    return NextResponse.json(deleted);
  } catch (error) {
    console.error("[ServicePro Sheets] Dienst verwijderen mislukt:", error);
    return jsonError(
      error instanceof Error && error.message.includes("Ongeldige") ? error : new Error("Opslaan naar Google Sheets mislukt."),
      error instanceof Error && error.message.includes("Ongeldige") ? 400 : 500
    );
  }
}
