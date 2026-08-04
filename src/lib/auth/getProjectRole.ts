import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import type { ProjectRole } from "@/types/database.types";

/**
 * The current user's role on one project: their project_members.project_role,
 * or "admin" for an org admin (who bypass project_members entirely), or null
 * if they have no access.
 *
 * Cached per request and per project id. This used to cost three round trips
 * every time it was asked — the user, their profile, then the membership — and
 * a project page asks several times over, once in the segment layout and again
 * in the page beneath it. Two of those three now come from getCurrentProfile,
 * which is itself deduped, leaving one query the first time and none after.
 */
export const getProjectRole = cache(
  async (projectId: string): Promise<ProjectRole | "admin" | null> => {
    const profile = await getCurrentProfile();
    if (!profile) return null;
    if (profile.role === "admin") return "admin";

    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("project_members")
      .select("project_role")
      .eq("project_id", projectId)
      .eq("user_id", profile.id)
      .maybeSingle();

    return membership?.project_role ?? null;
  }
);
