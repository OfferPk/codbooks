import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getHealthSummary } from "@/lib/match";

export async function GET() {
  try {
    const user = await requireUser();
    const health = getHealthSummary(user.org_id);
    return NextResponse.json({ health });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
