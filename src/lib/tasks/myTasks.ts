import type { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

// "Tasks assigned to me" is a join-table lookup now; every caller (Today,
// Overview, the sidebar badge, reschedule) funnels through this one helper.
export async function getMyTaskIds(supabase: ServerSupabase, userId: string): Promise<string[]> {
  const { data } = await supabase.from("task_assignees").select("task_id").eq("user_id", userId);
  return (data ?? []).map((row) => row.task_id);
}
