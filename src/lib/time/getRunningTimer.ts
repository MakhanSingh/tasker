import { createClient } from "@/lib/supabase/server";

export async function getRunningTimer(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select("id, project_id, task_id, started_at, projects(name)")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();

  return data;
}
