import { Suspense } from "react";
import { LossReportClient } from "./LossReportClient";

export default function LossReportPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-slate-500">
          Loading loss report…
        </div>
      }
    >
      <LossReportClient />
    </Suspense>
  );
}
