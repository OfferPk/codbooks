import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getLossReport, type LossCategory } from "@/lib/loss-report";
import { buildCourierComplaint } from "@/lib/loss-complaint";

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
  const wantComplaint = searchParams.get("complaint") === "true";

  const report = getLossReport(user.org_id, asOf);

  if (wantComplaint && courierFilter) {
    const complaint = buildCourierComplaint(report, {
      courier_code: courierFilter,
      category: categoryFilter || "all",
      merchant_name: user.org_name,
      contact_person: user.name,
    });
    return NextResponse.json({ complaint });
  }

  // Filter items if courier or category specified
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

  return NextResponse.json({
    as_of: report.as_of,
    total_loss_paisa: report.total_loss_paisa,
    total_loss_pkr: report.total_loss_pkr,
    total_issues: report.total_issues,
    by_category: report.by_category,
    by_courier: report.by_courier,
    items,
  });
}
