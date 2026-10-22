import fs from "fs";
import path from "path";
import { getDb, audit, getCourierIdByCode } from "./db";
import {
  parseOrdersCsv,
  parseSettlementByTemplate,
  detectTemplate,
} from "./parsers";
import { runMatch } from "./match";
import {
  chmodPrivateFile,
  ensurePrivateDir,
  MODE_FILE,
} from "./fs-perms";
import { getDefaultShop } from "./shops";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function ensureUploadDir() {
  ensurePrivateDir(path.join(process.cwd(), "data"));
  ensurePrivateDir(UPLOAD_DIR);
}

/**
 * Server-generated storage path only. Client filename is never used in the
 * filesystem path (display name stays in uploads.filename).
 */
export function resolveSafeUploadPath(
  orgId: string,
  uploadId: string,
  originalFilename: string
): { storageKey: string; fullPath: string } {
  if (/[/\\]|\.\./.test(orgId) || /[/\\]|\.\./.test(uploadId)) {
    throw new Error("Invalid upload identifiers");
  }
  const base = path.basename(originalFilename || "upload.csv");
  if (/[/\\]|\.\./.test(base)) {
    throw new Error("Invalid filename");
  }
  let ext = path.extname(base).toLowerCase();
  if (!/^\.(csv|txt|tsv)$/.test(ext)) ext = ".csv";
  const storageKey = path.join(orgId, `${uploadId}${ext}`);
  const root = path.resolve(UPLOAD_DIR);
  const fullPath = path.resolve(root, storageKey);
  const rel = path.relative(root, fullPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Upload path escapes upload root");
  }
  return { storageKey: storageKey.replace(/\\/g, "/"), fullPath };
}

function writeUploadFile(fullPath: string, text: string) {
  ensurePrivateDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, text, { encoding: "utf8", mode: MODE_FILE });
  chmodPrivateFile(fullPath);
}

function resolveCourierId(
  codeFromRow: string | null | undefined,
  hint?: string
): string | null {
  const code = (codeFromRow || hint || "").toLowerCase().trim();
  if (!code) return null;
  if (code === "tcs" || code === "postex") return getCourierIdByCode(code);
  return getCourierIdByCode(code);
}

export function ingestOrders(
  orgId: string,
  userId: string,
  filename: string,
  text: string,
  courierHint?: string,
  shopId?: string | null
): { uploadId: string; rowCount: number; errors: string[] } {
  ensureUploadDir();
  const db = getDb();
  const uploadId = crypto.randomUUID();
  const { storageKey, fullPath } = resolveSafeUploadPath(
    orgId,
    uploadId,
    filename
  );
  writeUploadFile(fullPath, text);

  const resolvedShopId =
    shopId !== undefined && shopId !== null
      ? shopId
      : (getDefaultShop(orgId)?.id || null);

  const { rows, errors } = parseOrdersCsv(text);
  const hintCourierId = resolveCourierId(null, courierHint);
  const now = new Date().toISOString();
  const displayName = path.basename(filename || "upload.csv");

  const insertUpload = db.prepare(
    `INSERT INTO uploads
      (id, org_id, shop_id, kind, courier_id, storage_key, filename, uploaded_by, created_at, row_count, status, error_summary, template_hint)
     VALUES (?, ?, ?, 'orders', ?, ?, ?, ?, ?, ?, ?, ?, 'orders')`
  );
  const insertOrder = db.prepare(
    `INSERT INTO orders
      (id, org_id, shop_id, upload_id, courier_id, external_order_id, awb, cn, customer_name,
       order_amount_paisa, currency, ordered_at, source, status, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    insertUpload.run(
      uploadId,
      orgId,
      resolvedShopId,
      hintCourierId,
      storageKey,
      displayName,
      userId,
      now,
      rows.length,
      errors.length && !rows.length ? "failed" : "parsed",
      errors.length ? errors.slice(0, 20).join("; ") : null
    );
    for (const r of rows) {
      const rowCourier =
        resolveCourierId(r.courier_code, undefined) || hintCourierId;
      insertOrder.run(
        crypto.randomUUID(),
        orgId,
        resolvedShopId,
        uploadId,
        rowCourier,
        r.external_order_id || null,
        r.awb || null,
        r.cn || null,
        r.customer_name || null,
        r.order_amount_paisa,
        r.currency,
        r.ordered_at,
        r.source,
        r.status,
        JSON.stringify(r.raw),
        now
      );
    }
  });
  tx();

  audit(orgId, userId, "upload_orders", {
    upload_id: uploadId,
    shop_id: resolvedShopId,
    filename: displayName,
    row_count: rows.length,
    errors: errors.length,
    courier_hint: courierHint || null,
  });

  return { uploadId, rowCount: rows.length, errors };
}

export function ingestCpr(
  orgId: string,
  userId: string,
  filename: string,
  text: string,
  courierHint?: string,
  shopId?: string | null
): {
  uploadId: string;
  rowCount: number;
  errors: string[];
  template: string;
  courierCode: string | null;
} {
  ensureUploadDir();
  const db = getDb();
  const uploadId = crypto.randomUUID();
  const { storageKey, fullPath } = resolveSafeUploadPath(
    orgId,
    uploadId,
    filename
  );
  writeUploadFile(fullPath, text);

  const resolvedShopId =
    shopId !== undefined && shopId !== null
      ? shopId
      : (getDefaultShop(orgId)?.id || null);

  const parsed = parseSettlementByTemplate(text, courierHint);
  const courierId = parsed.courierCode
    ? getCourierIdByCode(parsed.courierCode)
    : null;
  const now = new Date().toISOString();
  const displayName = path.basename(filename || "upload.csv");

  if (!courierId) {
    db.prepare(
      `INSERT INTO uploads
        (id, org_id, shop_id, kind, courier_id, storage_key, filename, uploaded_by, created_at, row_count, status, error_summary, template_hint)
       VALUES (?, ?, ?, 'cpr', NULL, ?, ?, ?, ?, 0, 'failed', ?, ?)`
    ).run(
      uploadId,
      orgId,
      resolvedShopId,
      storageKey,
      displayName,
      userId,
      now,
      parsed.errors.join("; ") || "Unknown courier template",
      parsed.template
    );
    return {
      uploadId,
      rowCount: 0,
      errors: parsed.errors.length
        ? parsed.errors
        : ["Unknown courier template"],
      template: parsed.template,
      courierCode: null,
    };
  }

  const insertUpload = db.prepare(
    `INSERT INTO uploads
      (id, org_id, shop_id, kind, courier_id, storage_key, filename, uploaded_by, created_at, row_count, status, error_summary, template_hint)
     VALUES (?, ?, ?, 'cpr', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertLine = db.prepare(
    `INSERT INTO settlement_lines
      (id, org_id, shop_id, upload_id, courier_id, awb, cn, order_ref,
       remitted_paisa, fee_delivery_paisa, fee_return_paisa, fee_gst_paisa,
       fee_wht_paisa, fee_cash_handling_paisa, fee_other_paisa, cod_booked_paisa,
       settled_at, settlement_id, delivery_status, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    insertUpload.run(
      uploadId,
      orgId,
      resolvedShopId,
      courierId,
      storageKey,
      displayName,
      userId,
      now,
      parsed.rows.length,
      parsed.rows.length ? "parsed" : "failed",
      parsed.errors.length ? parsed.errors.slice(0, 20).join("; ") : null,
      parsed.template
    );
    for (const r of parsed.rows) {
      insertLine.run(
        crypto.randomUUID(),
        orgId,
        resolvedShopId,
        uploadId,
        courierId,
        r.awb || null,
        r.cn || null,
        r.order_ref || null,
        r.remitted_paisa,
        r.fee_delivery_paisa,
        r.fee_return_paisa,
        r.fee_gst_paisa,
        r.fee_wht_paisa,
        r.fee_cash_handling_paisa,
        r.fee_other_paisa,
        r.cod_booked_paisa,
        r.settled_at,
        r.settlement_id || null,
        r.delivery_status || null,
        JSON.stringify(r.raw),
        now
      );
    }
  });
  tx();

  audit(orgId, userId, "upload_cpr", {
    upload_id: uploadId,
    shop_id: resolvedShopId,
    filename: displayName,
    row_count: parsed.rows.length,
    template: parsed.template,
    courier: parsed.courierCode,
  });

  return {
    uploadId,
    rowCount: parsed.rows.length,
    errors: parsed.errors,
    template: parsed.template,
    courierCode: parsed.courierCode,
  };
}

export function ingestAndMatch(
  orgId: string,
  userId: string
): ReturnType<typeof runMatch> {
  return runMatch(orgId, userId);
}

export { detectTemplate };
