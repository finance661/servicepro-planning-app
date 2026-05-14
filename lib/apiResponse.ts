import { NextResponse } from "next/server";

export function jsonError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Er ging iets mis.";
  return NextResponse.json({ error: message }, { status });
}
