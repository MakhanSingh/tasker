import { NextResponse } from "next/server";
import type { Readable } from "node:stream";
import { createClient } from "@/lib/supabase/server";
import { FileNotFoundError, getFileStorage } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const supabase = await createClient();

  // RLS decides visibility here: the row simply won't come back if this user
  // isn't allowed to see it (including a client requesting a file that isn't
  // is_client_visible), so no separate permission check is needed.
  const { data: file } = await supabase
    .from("files")
    .select("file_name, storage_path, mime_type, storage_provider")
    .eq("id", fileId)
    .single();

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let stream: Readable;
  try {
    // The row's own provider, not the environment's: a file written to disk
    // before the move to Supabase Storage still has to be readable after it.
    const storage = getFileStorage(file.storage_provider);
    stream = (await storage.getFileStream(file.storage_path)) as Readable;
  } catch (err) {
    if (err instanceof FileNotFoundError) {
      // Reaching here means the row is readable but its bytes are not on
      // disk — uploads written somewhere a deploy later replaced, most often.
      // Worth a log line, because nothing else in the app will notice.
      console.error(`[files] ${fileId} has no file at ${file.storage_path}`);
      return NextResponse.json({ error: "That file is no longer on the server." }, { status: 404 });
    }
    throw err;
  }

  // The status is already spent by the time a read fails this far in, so the
  // most that can be done is close cleanly and leave a trace.
  stream.on("error", (err) => {
    console.error(`[files] read failed partway through ${fileId}:`, err);
    stream.destroy();
  });

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": file.mime_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.file_name)}"`,
    },
  });
}
