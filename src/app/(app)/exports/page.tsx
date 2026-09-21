export default function ExportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accountant exports</h1>
        <p className="text-sm text-slate-500">
          Download CSV ledgers from the latest match run / settlement lines.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-medium">COD receivable register</h2>
          <p className="text-sm text-slate-500">
            Status, courier, order, AWB, expected / remitted / short PKR.
          </p>
          <a className="btn-primary inline-flex" href="/api/export/receivable">
            Download receivable.csv
          </a>
        </div>
        <div className="card space-y-3">
          <h2 className="font-medium">Fee breakdown</h2>
          <p className="text-sm text-slate-500">
            Delivery, return, GST, WHT, cash handling, other — per settlement
            line.
          </p>
          <a className="btn-primary inline-flex" href="/api/export/fees">
            Download fees.csv
          </a>
        </div>
      </div>
    </div>
  );
}
