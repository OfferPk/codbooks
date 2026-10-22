export type DetectedTemplate =
  | "orders"
  | "shopify_orders"
  | "woocommerce_orders"
  | "tcs_invoice"
  | "tcs_detail"
  | "postex"
  | "postex_portal"
  | "leopards"
  | "mnp"
  | "trax"
  | "callcourier"
  | "rider"
  | "swyft"
  | "unknown";

export type CourierCode =
  | "tcs"
  | "postex"
  | "leopards"
  | "mnp"
  | "trax"
  | "callcourier"
  | "rider"
  | "swyft";

export function headerSet(headers: string[]): Set<string> {
  return new Set(headers.map((h) => h.toLowerCase().trim()));
}

export function detectTemplate(headers: string[]): DetectedTemplate {
  const h = headerSet(headers);

  // Shopify Orders Export
  if (
    h.has("fulfillments tracking number") ||
    (h.has("financial status") && h.has("fulfillment status")) ||
    (h.has("name") && h.has("shipping name") && h.has("total"))
  ) {
    return "shopify_orders";
  }

  // WooCommerce Orders Export
  if (
    (h.has("order number") || h.has("order_number")) &&
    (h.has("order total") || h.has("order status"))
  ) {
    return "woocommerce_orders";
  }

  // Generic Orders
  if (
    h.has("external_order_id") ||
    (h.has("cod_amount_pkr") && (h.has("awb") || h.has("cn")))
  ) {
    return "orders";
  }

  // Rider Pakistan
  if (
    h.has("rider cn") ||
    (h.has("tracking number") && (h.has("net remittance") || h.has("cash collection") || h.has("rider fee")))
  ) {
    return "rider";
  }

  // Swyft Logistics
  if (
    h.has("swyft tracking id") ||
    (h.has("tracking number") && (h.has("fuel surcharge") || h.has("net payable") || h.has("consignment status")))
  ) {
    return "swyft";
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
    case "rider":
      return "rider";
    case "swyft":
      return "swyft";
    default:
      return null;
  }
}
