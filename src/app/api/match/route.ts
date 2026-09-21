import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { runMatch } from "@/lib/match";

export async function POST() {
  try {
    const user = await requireUser();
    const result = runMatch(user.org_id, user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Match failed" }, { status: 500 });
  }
}
