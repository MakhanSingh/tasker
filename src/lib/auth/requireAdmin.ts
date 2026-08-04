import { redirect } from "next/navigation";
import { requireProfile } from "./getCurrentProfile";

// UX-layer guard for admin-only pages/Server Actions. This is defense in
// depth, not the authorization boundary — Postgres RLS still enforces the
// same restriction at the database level even if this check were removed.
export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/");
  }
  return profile;
}
