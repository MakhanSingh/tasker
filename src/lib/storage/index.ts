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
