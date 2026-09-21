import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearSessionCookie,
  destroySession,
  getSessionCookieName,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(getSessionCookieName())?.value;
  if (sid) destroySession(sid);
  await clearSessionCookie(req.headers);
  return NextResponse.json({ ok: true });
}
