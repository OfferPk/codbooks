import fs from "fs";
import path from "path";
import { getDb, audit, getCourierIdByCode } from "./db";
import {
  parseOrdersCsv,
  parseSettlementByTemplate,
  detectTemplate,
} from "./parsers";
import { runMatch } from "./match";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function ingestOrders(
  orgId: string,
  userId: string,
  filename: string,
  text: string
): { uploadId: string; rowCount: number; errors: string[] } {
  ensureUploadDir();
  const db = getDb();
  const uploadId = crypto.randomUUID();
  const storageKey = `${orgId}/${uploadId}-${filename}`;
  const fullPath = path.join(UPLOAD_DIR, storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text, "utf8");

  const { rows, errors } = parseOrdersCsv(text);
  const now = new Date().toISOString();

  const insertUpload = db.prepare(
    `INSERT INTO uploads
      (id, org_id, kind, courier_id, storage_key, filename, uploaded_by, created_at, row_count, status, error_summary, template_hint)
     VALUES (?, ?, 'orders', NULL, ?, ?, ?, ?, ?, ?, ?, 'orders')`
  );
  const insertOrder = db.prepare(
    `INSERT INTO orders
      (id, org_id, upload_id, external_order_id, awb, cn, customer_name,
       order_amount_paisa, currency, ordered_at, source, status, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    insertUpload.run(
      uploadId,
      orgId,
      storageKey,
      filename,
      userId,
      now,
      rows.length,
      errors.length && !rows.length ? "failed" : "parsed",
      errors.length ? errors.slice(0, 20).join("; ") : null
    );
    for (const r of rows) {
      insertOrder.run(
        crypto.randomUUID(),
        orgId,
        uploadId,
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
    filename,
    row_count: rows.length,
    errors: errors.length,
  });

  return { uploadId, rowCount: rows.length, errors };
}

export function ingestCpr(
  orgId: string,
  userId: string,
  filename: string,
  text: string,
  courierHint?: string
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
  const storageKey = `${orgId}/${uploadId}-${filename}`;
  const fullPath = path.join(UPLOAD_DIR, storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text, "utf8");

  const parsed = parseSettlementByTemplate(text, courierHint);
  const courierId = parsed.courierCode
    ? getCourierIdByCode(parsed.courierCode)
    : null;
  const now = new Date().toISOString();

  if (!courierId) {
    db.prepare(
      `INSERT INTO uploads
        (id, org_id, kind, courier_id, storage_key, filename, uploaded_by, created_at, row_count, status, error_summary, template_hint)
       VALUES (?, ?, 'cpr', NULL, ?, ?, ?, ?, 0, 'failed', ?, ?)`
    ).run(
      uploadId,
      orgId,
      storageKey,
      filename,
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
      (id, org_id, kind, courier_id, storage_key, filename, uploaded_by, created_at, row_count, status, error_summary, template_hint)
     VALUES (?, ?, 'cpr', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertLine = db.prepare(
    `INSERT INTO settlement_lines
      (id, org_id, upload_id, courier_id, awb, cn, order_ref,
       remitted_paisa, fee_delivery_paisa, fee_return_paisa, fee_gst_paisa,
       fee_wht_paisa, fee_cash_handling_paisa, fee_other_paisa, cod_booked_paisa,
       settled_at, settlement_id, delivery_status, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    insertUpload.run(
      uploadId,
      orgId,
      courierId,
      storageKey,
      filename,
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
    filename,
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
