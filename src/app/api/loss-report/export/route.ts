import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
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

  const report = getLossReport(user.org_id, asOf);

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

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
