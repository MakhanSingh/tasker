import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/getCurrentProfile";

// Polled by the bell. Realtime would push instead, but polling works
// identically against the preview mock and needs no extra connection —
// swapping in a Supabase Realtime subscription later only changes the
// client, not this shape.
export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ unread: 0, notifications: [] }, { status: 401 });
  }

  // RLS restricts this to the caller's own rows regardless of the filter.
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const notifications = data ?? [];
  return NextResponse.json({
    unread: notifications.filter((n) => !n.is_read).length,
    notifications,
  });
}
