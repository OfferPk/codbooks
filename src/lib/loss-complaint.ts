import { formatPkr } from "./money";
import type { LossCategory, LossReportSummary } from "./loss-report";

export interface ComplaintDraftOptions {
  courier_code: string;
  category?: LossCategory | "all";
  merchant_name?: string;
  contact_person?: string;
  contact_phone?: string;
  bank_account_info?: string;
}

export interface ComplaintDraft {
  courier_code: string;
  courier_name: string;
  category: string;
  subject: string;
  body: string;
  whatsapp_text: string;
  total_claims_pkr: number;
  total_claims_formatted: string;
  affected_order_count: number;
  awb_list: string[];
}

const CATEGORY_NAMES: Record<LossCategory, string> = {
  short_payment: "Short COD Remittance",
  double_charged_fee: "Double-Charged / Duplicate Fees",
  return_marked_delivered: "Return / Delivered Status Discrepancies",
  held_payment: "Overdue Unpaid COD Held Over SLA",
};

export function buildCourierComplaint(
  report: LossReportSummary,
  options: ComplaintDraftOptions
): ComplaintDraft {
  const courierCode = options.courier_code.toLowerCase();
  const targetCategory = options.category || "all";

  // Filter items matching courier and category
  const matchingItems = report.items.filter((item) => {
    const courierMatches =
      item.courier_code.toLowerCase() === courierCode ||
      item.courier_name.toLowerCase() === courierCode;

    if (!courierMatches) return false;
    if (targetCategory !== "all" && item.category !== targetCategory) return false;
    return true;
  });

  const courierName =
    matchingItems[0]?.courier_name ||
    report.by_courier[courierCode]?.courier_name ||
    courierCode.toUpperCase();

  const totalLossPaisa = matchingItems.reduce(
    (sum, item) => sum + item.loss_paisa,
    0
  );
  const totalClaimsPkr = totalLossPaisa / 100;
  const totalClaimsFormatted = formatPkr(totalLossPaisa);
  const affectedCount = matchingItems.length;

  const awbList = Array.from(
    new Set(
      matchingItems
        .map((i) => i.awb || i.cn || i.external_order_id || "")
        .filter(Boolean)
    )
  );

  const merchantName = options.merchant_name || "Merchant";
  const contactPerson = options.contact_person || merchantName;
  const contactPhone = options.contact_phone || "";
  const bankInfo = options.bank_account_info || "";

  const categoryTitle =
    targetCategory === "all"
      ? "Settlement Discrepancies & Underpayments"
      : CATEGORY_NAMES[targetCategory as LossCategory] || targetCategory;

  // 1) Subject line
  const subject = `[DISPUTE CLAIM] ${categoryTitle} — ${courierName} — ${affectedCount} Shipment(s) — ${totalClaimsFormatted}`;

  // 2) Formal Email / Letter Body
  const nowStr = new Date().toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Category breakdown for this courier
  const catCounts: Record<string, { count: number; loss_paisa: number }> = {};
  for (const item of matchingItems) {
    const cat = item.category;
    if (!catCounts[cat]) catCounts[cat] = { count: 0, loss_paisa: 0 };
    catCounts[cat].count++;
    catCounts[cat].loss_paisa += item.loss_paisa;
  }

  const breakdownLines = Object.entries(catCounts)
    .map(
      ([cat, data]) =>
        `  • ${CATEGORY_NAMES[cat as LossCategory] || cat}: ${data.count} shipment(s) — ${formatPkr(data.loss_paisa)}`
    )
    .join("\n");

  // Itemized table of shipments
  const itemizedHeader = `Order ID        | Tracking / AWB  | Expected (PKR) | Received (PKR) | Disputed (PKR) | Reason`;
  const itemizedDivider = `----------------|-----------------|----------------|----------------|----------------|------------------------------------`;
  const itemizedRows = matchingItems.map((item) => {
    const orderId = (item.external_order_id || "—").padEnd(15).substring(0, 15);
    const tracking = (item.awb || item.cn || "—").padEnd(16).substring(0, 16);
    const exp = (item.expected_paisa / 100).toFixed(2).padStart(14);
    const rem = (item.remitted_paisa / 100).toFixed(2).padStart(14);
    const claim = item.loss_pkr.toFixed(2).padStart(14);
    return `${orderId} | ${tracking} | ${exp} | ${rem} | ${claim} | ${item.reason}`;
  });

  const body = `To: ${courierName} Finance, Billing & COD Reconciliation Desk
From: ${merchantName}
Date: ${nowStr}
Subject: ${subject}

Dear ${courierName} Accounts & Billing Team,

During our regular COD ledger audit via CodBooks, we identified financial discrepancies on ${affectedCount} shipment(s) handled by ${courierName}. The total disputed claim amount is ${totalClaimsFormatted}.

SUMMARY OF DISCREPANCIES:
${breakdownLines}
Total Claim Amount: ${totalClaimsFormatted} across ${affectedCount} shipment(s).

ITEMIZED SHIPMENTS:
${itemizedHeader}
${itemizedDivider}
${itemizedRows.join("\n")}

REQUIRED ACTION:
1. Please review the itemized list against your billing and CPR records.
2. For short remittances and duplicate charges, issue a credit note / adjustment in our next settlement cycle or remit the balance directly.
3. For shipments held beyond standard SLA, please provide proof of delivery (POD) or expedite the pending payout immediately.

${bankInfo ? `Settlement / Refund Account Details:\n${bankInfo}\n` : ""}
Kindly acknowledge receipt of this dispute claim and confirm the rectification timeline within 3 to 5 business days.

Sincerely,
${contactPerson}
${merchantName}
${contactPhone ? `Phone / WhatsApp: ${contactPhone}` : ""}`;

  // 3) WhatsApp Draft (clean, concise, mobile-friendly)
  const topAwbs = awbList.slice(0, 5).join(", ");
  const moreAwbsNote =
    awbList.length > 5 ? ` (+ ${awbList.length - 5} more)` : "";

  const whatsappText = `*COD Dispute Claim — ${merchantName} vs ${courierName}*
📅 Date: ${nowStr}
💰 *Total Disputed Amount: ${totalClaimsFormatted}*
📦 *Affected Shipments: ${affectedCount}*

*Dispute Breakdown:*
${Object.entries(catCounts)
  .map(
    ([cat, data]) =>
      `• ${CATEGORY_NAMES[cat as LossCategory] || cat}: ${data.count} pcs (${formatPkr(data.loss_paisa)})`
  )
  .join("\n")}

*Sample Tracking / AWBs:*
${topAwbs}${moreAwbsNote}

Please review attached reconciliation report and credit our pending balance of *${totalClaimsFormatted}* in the next payment cycle.

Regards,
${contactPerson} (${merchantName})
${contactPhone ? `📞 ${contactPhone}` : ""}`;

  return {
    courier_code: courierCode,
    courier_name: courierName,
    category: targetCategory,
    subject,
    body,
    whatsapp_text: whatsappText,
    total_claims_pkr: totalClaimsPkr,
    total_claims_formatted: totalClaimsFormatted,
    affected_order_count: affectedCount,
    awb_list: awbList,
  };
}
