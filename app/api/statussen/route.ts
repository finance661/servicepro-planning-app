import { NextResponse } from "next/server";
import { getStatussen } from "@/lib/googleSheets";
import { jsonError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const statussen = await getStatussen();
    return NextResponse.json(statussen);
  } catch (error) {
    return jsonError(error);
  }
}
