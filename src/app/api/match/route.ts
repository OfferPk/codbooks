import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRoles } from "@/lib/auth";
import { runMatch } from "@/lib/match";

export async function POST(req: NextRequest): Promise<NextResponse>;
export async function POST(): Promise<NextResponse>;
export async function POST(req?: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireRoles("owner", "ops");
    let targetShopId: string | null = null;
    if (user.role === "staff") {
      targetShopId = user.shop_id || null;
    } else if (req) {
      if (req.url) {
        try {
          const url = new URL(req.url);
          targetShopId = url.searchParams.get("shopId") || user.shop_id || null;
        } catch {
          // ignore url parse error
        }
      }
      if (!targetShopId && typeof req.json === "function") {
        try {
          const body = await req.json();
          targetShopId = body?.shopId || null;
        } catch {
          // body is optional
        }
      }
    } else {
      targetShopId = user.shop_id || null;
    }
    const result = runMatch(user.org_id, user.id, targetShopId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Match failed" }, { status: 500 });
  }
}
