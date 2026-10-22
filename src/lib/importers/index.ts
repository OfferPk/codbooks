import { parseCsv } from "../csv";
import type { ParsedSettlement } from "../parsers";
import { parseTcsInvoice, parseTcsDetail, parsePostex } from "../parsers";
import { parseLeopards } from "./leopards";
import { parseMnp } from "./mnp";
import { parseTrax } from "./trax";
import { parseCallCourier } from "./callcourier";
import { parseRider } from "./rider";
import { parseSwyft } from "./swyft";
import { parseShopifyOrders, parseWooCommerceOrders } from "./ecommerce";
import {
  detectTemplate,
  detectCourierCode,
  type DetectedTemplate,
  type CourierCode,
} from "./detect";

export {
  parseLeopards,
  parseMnp,
  parseTrax,
  parseCallCourier,
  parseRider,
  parseSwyft,
  parseShopifyOrders,
  parseWooCommerceOrders,
  detectTemplate,
  detectCourierCode,
  type DetectedTemplate,
  type CourierCode,
};

export function parseSettlement(
  text: string,
  hint?: string
): {
  template: DetectedTemplate;
  courierCode: CourierCode | null;
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { headers } = parseCsv(text);
  let template = detectTemplate(headers);

  // Apply courier hint if template detection is ambiguous
  if (template === "unknown" && hint) {
    const cleanHint = hint.toLowerCase().trim();
    if (cleanHint === "tcs") template = "tcs_invoice";
    else if (cleanHint === "postex") template = "postex";
    else if (cleanHint === "leopards") template = "leopards";
    else if (cleanHint === "mnp") template = "mnp";
    else if (cleanHint === "trax") template = "trax";
    else if (cleanHint === "callcourier") template = "callcourier";
    else if (cleanHint === "rider") template = "rider";
    else if (cleanHint === "swyft") template = "swyft";
  }

  const courierCode = detectCourierCode(template);

  switch (template) {
    case "tcs_invoice":
      return { template, courierCode, ...parseTcsInvoice(text) };
    case "tcs_detail":
      return { template, courierCode, ...parseTcsDetail(text) };
    case "postex":
    case "postex_portal":
      return { template, courierCode, ...parsePostex(text) };
    case "leopards":
      return { template, courierCode, ...parseLeopards(text) };
    case "mnp":
      return { template, courierCode, ...parseMnp(text) };
    case "trax":
      return { template, courierCode, ...parseTrax(text) };
    case "callcourier":
      return { template, courierCode, ...parseCallCourier(text) };
    case "rider":
      return { template, courierCode, ...parseRider(text) };
    case "swyft":
      return { template, courierCode, ...parseSwyft(text) };
    default:
      return {
        template: "unknown",
        courierCode: null,
        rows: [],
        errors: [
          "Unrecognized CPR/settlement CSV headers. Supported couriers: TCS, PostEx, Leopards, M&P, Trax, Call Courier, Rider, Swyft.",
        ],
      };
  }
}
