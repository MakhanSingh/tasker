// Browser-side helper: posts files one at a time to the upload route.
// Returns the first error message, or null when everything landed.
export async function uploadFiles(params: {
  projectId: string;
  taskId?: string | null;
  commentId?: string | null;
  files: File[];
  isClientVisible?: boolean;
}): Promise<string | null> {
  for (const file of params.files) {
    const body = new FormData();
    body.set("project_id", params.projectId);
    if (params.taskId) body.set("task_id", params.taskId);
    if (params.commentId) body.set("comment_id", params.commentId);
    body.set("is_client_visible", String(params.isClientVisible ?? true));
    body.set("file", file);

    const res = await fetch("/api/files/upload", { method: "POST", body });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return data?.error ?? `Upload failed (${res.status})`;
    }
  }
  return null;
}
