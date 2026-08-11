import "server-only";
import { Readable } from "node:stream";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { FileNotFoundError, type FileStorage, type UploadParams } from "./index";

const BUCKET = process.env.STORAGE_BUCKET ?? "attachments";

/**
 * Attachments in Supabase Storage, which is where they survive a deploy.
 *
 * The service-role key is deliberate and is not a hole: the bucket is private
 * and no client ever gets a path into it. Everything still enters through
 * /api/files/[fileId]/download, which has already asked RLS on the `files` row
 * whether this user may see it. By the time anything here runs, that question
 * is answered — this class only moves bytes.
 */
export class SupabaseFileStorage implements FileStorage {
  private get bucket() {
    return createAdminClient().storage.from(BUCKET);
  }

  async uploadFile({ orgId, projectId, fileName, contentType, body }: UploadParams) {
    // Generated name, same as the local adapter: nothing a user typed decides
    // where the object lands.
    const safeName = `${randomUUID()}${path.extname(fileName).slice(0, 20)}`;
    const relativePath = `${orgId}/${projectId}/${safeName}`;

    const { error } = await this.bucket.upload(relativePath, body, {
      contentType: contentType || "application/octet-stream",
      upsert: false,
    });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    return { path: relativePath };
  }

  async getFileStream(relativePath: string): Promise<Readable> {
    const { data, error } = await this.bucket.download(relativePath);

    if (error || !data) {
      // A missing object and a storage outage both arrive as an error here,
      // and they deserve different answers — 404 for one, a 500 for the other.
      // Supabase words the first as "Object not found".
      if (!error || /not.?found/i.test(error.message)) {
        throw new FileNotFoundError(relativePath);
      }
      throw new Error(`Storage read failed: ${error.message}`);
    }

    // download() resolves a Blob, so the object is in memory before any of it
    // is written out. Bounded by the 25 MB upload limit rather than by
    // anything here; if that limit ever rises, this wants a signed URL and a
    // streamed fetch instead.
    return Readable.fromWeb(data.stream() as Parameters<typeof Readable.fromWeb>[0]);
  }

  async deleteFile(relativePath: string) {
    // Same as the local adapter: a failed delete leaves an orphaned object,
    // which is untidy but never breaks the caller that asked for it.
    await this.bucket.remove([relativePath]).catch(() => {});
  }
}
