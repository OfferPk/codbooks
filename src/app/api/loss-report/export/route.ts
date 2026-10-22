import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/db";
import {
  exportLossReportCsv,
  getLossReport,
  type LossCategory,
} from "@/lib/loss-report";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const asOfParam = searchParams.get("asOf");
  const asOf = asOfParam ? new Date(asOfParam) : new Date();
  const courierFilter = searchParams.get("courier")?.toLowerCase();
  const categoryFilter = searchParams.get("category") as LossCategory | "all" | null;

  // Multi-shop scoping: staff is strictly bound to session shop_id; owners/admins can filter by query or use active shop
  let targetShopId: string | null = null;
  if (user.role === "staff") {
    targetShopId = user.shop_id || null;
  } else {
    targetShopId = searchParams.get("shopId") || user.shop_id || null;
  }

  const report = getLossReport(user.org_id, asOf, targetShopId);

  let items = report.items;
  if (courierFilter) {
    items = items.filter(
      (i) =>
        i.courier_code.toLowerCase() === courierFilter ||
        i.courier_name.toLowerCase() === courierFilter
    );
  }
  if (categoryFilter && categoryFilter !== "all") {
    items = items.filter((i) => i.category === categoryFilter);
  }

  const csv = exportLossReportCsv(items);
  const ymd = asOf.toISOString().slice(0, 10);
  const filename = `codbooks-loss-report-${ymd}.csv`;

  audit(user.org_id, user.id, "export_loss_report", {
    as_of: asOf.toISOString(),
    courier: courierFilter || null,
    category: categoryFilter || null,
    shop_id: targetShopId,
    item_count: items.length,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
