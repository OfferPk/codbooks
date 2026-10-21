export type DetectedTemplate =
  | "orders"
  | "tcs_invoice"
  | "tcs_detail"
  | "postex"
  | "postex_portal"
  | "leopards"
  | "mnp"
  | "trax"
  | "callcourier"
  | "unknown";

export type CourierCode =
  | "tcs"
  | "postex"
  | "leopards"
  | "mnp"
  | "trax"
  | "callcourier";

export function headerSet(headers: string[]): Set<string> {
  return new Set(headers.map((h) => h.toLowerCase().trim()));
}

export function detectTemplate(headers: string[]): DetectedTemplate {
  const h = headerSet(headers);

  // Generic Orders
  if (
    h.has("external_order_id") ||
    (h.has("cod_amount_pkr") && (h.has("awb") || h.has("cn")))
  ) {
    return "orders";
  }

  // Trax (check early so amount paid doesn't collide with TCS)
  if (
    h.has("trax cn") ||
    h.has("disbursement id") ||
    h.has("disbursement date") ||
    h.has("cash handling fee") ||
    (h.has("tracking number") && h.has("product amount"))
  ) {
    return "trax";
  }

  // TCS Invoice & Detail
  if (h.has("cnsg_no") && h.has("codamount")) return "tcs_invoice";
  if (
    h.has("cn by courier") ||
    (h.has("amount paid") && (h.has("order no") || h.has("payment status") || h.has("cn status")))
  ) {
    return "tcs_detail";
  }

  // PostEx
  if (
    h.has("trackingnumber") &&
    h.has("orderrefnumber") &&
    (h.has("amount_paid") || h.has("cod_amount") || h.has("fee_delivery"))
  ) {
    return "postex_portal";
  }
  if (h.has("trackingnumber") && h.has("settle")) return "postex";

  // Leopards
  if (
    (h.has("track number") || h.has("sheet number")) &&
    (h.has("cod amount") || h.has("net amount") || h.has("delivery charges"))
  ) {
    return "leopards";
  }

  // M&P Express
  if (
    (h.has("voucher no") || h.has("voucher_no") || h.has("net cod") || h.has("cod value") || h.has("fed")) &&
    (h.has("cn number") || h.has("consignment no") || h.has("order ref"))
  ) {
    return "mnp";
  }

  // Call Courier
  if (
    (h.has("bank charges") || h.has("sheet no") || h.has("sheet_no") || h.has("consignmentnumber")) &&
    (h.has("cn number") || h.has("cn") || h.has("ref no") || h.has("balance"))
  ) {
    return "callcourier";
  }

  return "unknown";
}

export function detectCourierCode(template: DetectedTemplate): CourierCode | null {
  switch (template) {
    case "tcs_invoice":
    case "tcs_detail":
      return "tcs";
    case "postex":
    case "postex_portal":
      return "postex";
    case "leopards":
      return "leopards";
    case "mnp":
      return "mnp";
    case "trax":
      return "trax";
    case "callcourier":
      return "callcourier";
    default:
      return null;
  }
}
