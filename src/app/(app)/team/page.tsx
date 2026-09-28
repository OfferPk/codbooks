import { redirect } from "next/navigation";
import { AuthError, requireRoles } from "@/lib/auth";
import { TeamClient } from "@/components/TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  try {
    await requireRoles("owner");
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.status === 401) redirect("/login");
      redirect("/health");
    }
    throw e;
  }
  return <TeamClient />;
}
