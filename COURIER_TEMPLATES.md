# Courier templates (MVP)

CSV-only. Column maps derived from public TCS ENVIO / PostEx payment-status shapes (`/workspace/factory/research/cpr-schemas/`). Portal Excel headers may differ — design-partner exports welcome.

## Orders (generic)

Required-ish: `external_order_id` (or order id), `awb` and/or `cn`, `cod_amount_pkr` (or `cod_amount` / `amount`).

See `fixtures/orders-tcs.example.csv`, `fixtures/orders-postex.example.csv`.

## TCS — Payment Invoice

Headers: `cnsg_no`, `cust_ref`, `codamount`, `courier_charges`, `gst`, `status`, `invoiceno`, …

Net remittance ≈ `codamount − courier_charges − gst` for Delivered; RTO → remitted 0.

Fixture: `fixtures/tcs-payment-invoice.example.csv`

## TCS — Payment Detail

Headers include spaces: `cn by courier`, `order no`, `amount paid`, `delivery charges`, `payment status`, `payment date`, …

Fixture: `fixtures/tcs-payment-detail.example.csv`

## PostEx — payment-status (API-shaped)

Headers: `orderRefNumber`, `trackingNumber`, `settle`, `settlementDate`, `cprNumber_1`, …

When `settle=true` and no amount columns, remitted is treated as expected COD (matched).

Fixture: `fixtures/postex-payment-status.example.csv`

## PostEx — portal-shaped (fees)

Optional fee columns: `cod_amount`, `fee_delivery`, `fee_gst`, `fee_wht`, `amount_paid`, …

Fixture: `fixtures/postex-settlement-portal.example.csv`

## Match rules

1. Exact AWB, else CN, else external order id  
2. `remitted < expected − 100 paisa` → `short`  
3. Order with no settlement → `unpaid`  
4. Settlement with no order → `unmatched`  
5. Two settlement lines same AWB → `double_paid`

## Deferred

Leopards remittance CSV (headers unverified), PDF CPR parse, Trax / M&P / BlueEx.
