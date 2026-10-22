import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getDashboardTrends } from "@/lib/trends";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const periodParam = req.nextUrl.searchParams.get("period");
    const period = periodParam === "monthly" ? "monthly" : "weekly";
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(24, Math.max(1, parseInt(limitParam, 10) || 8)) : undefined;

    const trends = getDashboardTrends(user.org_id, {
      period,
      limit,
      shopId: user.shop_id,
    });

    return NextResponse.json({ trends });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to load dashboard trends" }, { status: 500 });
  }
}
