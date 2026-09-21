const COLORS: Record<string, string> = {
  matched: "bg-emerald-50 text-emerald-800",
  short: "bg-amber-50 text-amber-800",
  unpaid: "bg-red-50 text-red-800",
  unmatched: "bg-purple-50 text-purple-800",
  double_paid: "bg-orange-50 text-orange-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${COLORS[status] || "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}
