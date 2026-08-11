import "server-only";
import { createReadStream, constants } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { FileNotFoundError, type FileStorage, type UploadParams } from "./index";

// Only safe because the deployment target is a persistent VPS (Hostinger).
// On a serverless/ephemeral host, uploads would vanish on redeploy or
// scale-out. Note also that Supabase's managed backups cover Postgres only —
// files stored here need their own backup strategy on the VPS.
export class LocalFileStorage implements FileStorage {
  // Resolved lazily rather than as a class field: a filesystem call at
  // module scope makes Turbopack trace the entire project into the bundle.
  private get root() {
    return path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_ROOT ?? "./storage");
  }

  private absolute(relativePath: string) {
    const resolved = path.resolve(this.root, relativePath);
    // Guards against a stored path escaping the storage root via traversal.
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new Error("Resolved storage path escapes the storage root");
    }
    return resolved;
  }

  async uploadFile({ orgId, projectId, fileName, body }: UploadParams) {
    // The stored name is generated, never taken from user input, so a
    // malicious filename can't influence where the file lands on disk.
    const safeName = `${randomUUID()}${path.extname(fileName).slice(0, 20)}`;
    const relativePath = path.join(orgId, projectId, safeName);
    const absolutePath = this.absolute(relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);

    return { path: relativePath };
  }

  async getFileStream(relativePath: string): Promise<Readable> {
    const absolutePath = this.absolute(relativePath);

    // createReadStream does not throw for a missing path — it hands back a
    // stream and emits ENOENT afterwards, by which point the route has already
    // opened a 200 and the only thing left to do is drop the connection. Ask
    // first, so a missing file can still be answered with a status code.
    try {
      await access(absolutePath, constants.R_OK);
    } catch {
      throw new FileNotFoundError(relativePath);
    }

    return createReadStream(absolutePath);
  }

  async deleteFile(relativePath: string) {
    await unlink(this.absolute(relativePath)).catch(() => {});
  }
}
