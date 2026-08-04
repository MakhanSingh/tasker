import { NextResponse } from "next/server";
import type { Readable } from "node:stream";
import { createClient } from "@/lib/supabase/server";
import { getFileStorage } from "@/lib/storage";

/**
 * Streams a profile picture.
 *
 * Who may see it is decided entirely by `profiles_select` (migration 0011):
 * if the caller can't read that profile the query returns nothing and this
 * 404s. No role check here would add anything the policy doesn't already do.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.avatar_url) {
    return NextResponse.json({ error: "No avatar" }, { status: 404 });
  }

  try {
    const stream = (await getFileStorage().getFileStream(profile.avatar_url)) as Readable;
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "image/*",
        // Private: the URL is per-user and the response depends on who asked.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }
}
