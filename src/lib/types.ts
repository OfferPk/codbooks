export type OrgType = "seller" | "firm";
export type Role = "owner" | "ops" | "accountant";
export type UploadKind = "orders" | "cpr";
export type UploadStatus = "pending" | "parsed" | "failed";
export type MatchStatus =
  | "matched"
  | "short"
  | "unpaid"
  | "unmatched"
  | "double_paid";
export type CourierCode = "tcs" | "postex";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  org_id: string;
  org_name: string;
  org_type: OrgType;
  role: Role;
}

export interface HealthSummary {
  owed_paisa: number;
  short_paisa: number;
  aging_over_14_paisa: number;
  unmatched_count: number;
  unpaid_count: number;
  matched_count: number;
  short_count: number;
  double_paid_count: number;
  by_courier: Record<
    string,
    {
      owed_paisa: number;
      short_paisa: number;
      unpaid_count: number;
      unmatched_count: number;
    }
  >;
}

export interface AgingBucket {
  bucket: "<7" | "7-14" | ">14";
  count: number;
  amount_paisa: number;
  courier_code: string;
}

export const TOLERANCE_PAISA = 100; // PKR 1
