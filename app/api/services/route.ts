import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/googleSheets";
import { jsonError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const services = await getServices({ forceRefresh: request.nextUrl.searchParams.get("refresh") === "1" });
    return NextResponse.json(services);
  } catch (error) {
    return jsonError(error);
  }
}
