import { NextResponse } from "next/server";
import type { Readable } from "node:stream";
import { createClient } from "@/lib/supabase/server";
import { getFileStorage } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const supabase = await createClient();

  // RLS decides visibility here: the row simply won't come back if this user
  // isn't allowed to see it (including a client requesting a file that isn't
  // is_client_visible), so no separate permission check is needed.
  const { data: file } = await supabase
    .from("files")
    .select("file_name, storage_path, mime_type")
    .eq("id", fileId)
    .single();

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = (await getFileStorage().getFileStream(file.storage_path)) as Readable;

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": file.mime_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.file_name)}"`,
    },
  });
}
