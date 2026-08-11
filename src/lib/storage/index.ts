import "server-only";
import type { Readable } from "node:stream";
import { LocalFileStorage } from "./local";

export interface UploadParams {
  orgId: string;
  projectId: string;
  fileName: string;
  body: Buffer;
}

export interface FileStorage {
  uploadFile(params: UploadParams): Promise<{ path: string }>;
  getFileStream(path: string): Promise<Readable>;
  deleteFile(path: string): Promise<void>;
}

/**
 * The metadata row survived but the bytes did not.
 *
 * Its own type because the download route has to answer it with a 404 before
 * the response opens. Left to surface mid-stream it reaches the browser as a
 * dropped connection — a 503 from whatever proxy is in front, which reads as
 * "the site is down" rather than "that one file is gone".
 */
export class FileNotFoundError extends Error {
  constructor(readonly storagePath: string) {
    super(`No file at ${storagePath}`);
    this.name = "FileNotFoundError";
  }
}

let cached: FileStorage | null = null;

// Provider is chosen once from STORAGE_PROVIDER. Adding Supabase Storage or
// S3 later means implementing FileStorage and adding a case here — no
// calling code changes anywhere else in the app.
export function getFileStorage(): FileStorage {
  if (cached) return cached;

  const provider = process.env.STORAGE_PROVIDER ?? "local";
  switch (provider) {
    case "local":
      cached = new LocalFileStorage();
      return cached;
    default:
      throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }
}

// Downloads always go through an authenticated app route rather than a
// direct filesystem or bucket path, so RLS decides who can read a file.
export function getFileUrl(fileId: string) {
  return `/api/files/${fileId}/download`;
}
