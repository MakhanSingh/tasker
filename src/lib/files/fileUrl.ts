// Client-safe twin of lib/storage's getFileUrl — that module is server-only
// (it pulls in node:stream), but components rendering attachment links run
// in the browser too.
export function getFileUrlClient(fileId: string) {
  return `/api/files/${fileId}/download`;
}
