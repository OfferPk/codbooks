import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getAgingBoard } from "@/lib/match";

export async function GET() {
  try {
    const user = await requireUser();
    const buckets = getAgingBoard(user.org_id);
    return NextResponse.json({ buckets });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
