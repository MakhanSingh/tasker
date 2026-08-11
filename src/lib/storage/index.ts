import "server-only";
import type { Readable } from "node:stream";
import type { StorageProvider } from "@/types/database.types";
import { LocalFileStorage } from "./local";
import { SupabaseFileStorage } from "./supabase";

export interface UploadParams {
  orgId: string;
  projectId: string;
  fileName: string;
  /** Recorded by providers that store it alongside the object. */
  contentType?: string;
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

const cache = new Map<StorageProvider, FileStorage>();

/**
 * Where new uploads go. Everything already stored keeps its own provider —
 * see getFileStorage.
 */
export function defaultStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider !== "local" && provider !== "supabase") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }
  return provider;
}

/**
 * Reads take the provider from the row being read, not from the environment.
 *
 * Switching STORAGE_PROVIDER decides where the *next* upload lands; it says
 * nothing about the thousand files already on disk. Keying off the row means
 * old and new can coexist indefinitely and nothing has to be migrated in one
 * go — files.storage_provider has recorded this since the first migration.
 */
export function getFileStorage(provider: StorageProvider = defaultStorageProvider()): FileStorage {
  const existing = cache.get(provider);
  if (existing) return existing;

  const storage =
    provider === "supabase"
      ? new SupabaseFileStorage()
      : provider === "local"
        ? new LocalFileStorage()
        : null;

  if (!storage) throw new Error(`Unsupported storage provider: ${provider}`);

  cache.set(provider, storage);
  return storage;
}

// Downloads always go through an authenticated app route rather than a
// direct filesystem or bucket path, so RLS decides who can read a file.
export function getFileUrl(fileId: string) {
  return `/api/files/${fileId}/download`;
}
