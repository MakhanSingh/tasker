import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { getFileStorage } from "@/lib/storage";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Uploads the caller's own avatar.
 *
 * There is no user id in the request: it always writes the signed-in user's
 * profile, so there is no parameter to tamper with to overwrite someone
 * else's picture. Avatars deliberately don't go in the `files` table — that
 * table is project-scoped, and a profile picture belongs to no project.
 */
export async function POST(request: Request) {
  const profile = await requireProfile();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file supplied" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Use a PNG, JPEG, WebP or GIF image" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Keep the image under 2 MB" }, { status: 413 });
  }

  const storage = getFileStorage();
  const { path } = await storage.uploadFile({
    orgId: profile.org_id,
    projectId: "avatars",
    fileName: file.name,
    body: Buffer.from(await file.arrayBuffer()),
  });

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
