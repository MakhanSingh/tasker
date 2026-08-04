"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isPreviewMode, normalizeRole, PREVIEW_ROLE_COOKIE } from "@/lib/supabase/preview/config";

export async function setPreviewRole(role: string) {
  if (!isPreviewMode()) return;

  const cookieStore = await cookies();
  cookieStore.set(PREVIEW_ROLE_COOKIE, normalizeRole(role), { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
}
