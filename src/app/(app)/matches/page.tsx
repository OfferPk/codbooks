import { Suspense } from "react";
import { MatchesClient } from "@/components/MatchesClient";

export default function MatchesPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-slate-500">Loading matches…</div>
      }
    >
      <MatchesClient />
    </Suspense>
  );
}
