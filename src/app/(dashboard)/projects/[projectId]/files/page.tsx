import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { FilesAndLinks, type LibraryItem } from "@/components/files/FilesAndLinks";

export default async function ProjectFilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const profile = await requireProfile();
  const role = await getProjectRole(projectId);
  const supabase = await createClient();

  // Everything attached anywhere on the project, including files dropped on a
  // task or inside a comment. They stay in their thread too — this tab is the
  // one place to look when you can't remember where something was posted.
  const [{ data: files }, { data: links }, { data: tasks }] = await Promise.all([
    supabase
      .from("files")
      .select("id, file_name, size_bytes, created_at, is_client_visible, uploaded_by, task_id, comment_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_links")
      .select("id, title, url, created_at, is_client_visible, created_by, task_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase.from("tasks").select("id, title").eq("project_id", projectId),
  ]);

  const taskTitles = new Map((tasks ?? []).map((t) => [t.id, t.title]));

  const authorIds = [
    ...new Set([...(files ?? []).map((f) => f.uploaded_by), ...(links ?? []).map((l) => l.created_by)]),
  ].filter(Boolean);

  const authorNames = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
    (profiles ?? []).forEach((p) => authorNames.set(p.id, p.full_name));
  }

  /** Where a file was posted, so a row says more than just its name. */
  const sourceOf = (file: { task_id: string | null; comment_id: string | null }) => {
    if (!file.task_id) return null;
    const title = taskTitles.get(file.task_id) ?? "a task";
    return file.comment_id ? `Comment on ${title}` : title;
  };

  const items: LibraryItem[] = [
    ...(files ?? []).map((file) => ({
      kind: "file" as const,
      id: file.id,
      title: file.file_name,
      href: `/api/files/${file.id}/download`,
      createdAt: file.created_at,
      sizeBytes: file.size_bytes,
      isClientVisible: file.is_client_visible,
      authorId: file.uploaded_by,
      // null, not "Unknown": a client can't resolve an agency admin's profile
      // (deliberately — see migration 0011), and printing a placeholder tells
      // them nothing. The row just omits the name.
      authorName: authorNames.get(file.uploaded_by) ?? null,
      source: sourceOf(file),
      taskId: file.task_id,
    })),
    ...(links ?? []).map((link) => ({
      kind: "link" as const,
      id: link.id,
      title: link.title,
      href: link.url,
      createdAt: link.created_at,
      sizeBytes: null,
      isClientVisible: link.is_client_visible,
      authorId: link.created_by,
      authorName: authorNames.get(link.created_by) ?? null,
      source: link.task_id ? (taskTitles.get(link.task_id) ?? "a task") : null,
      taskId: link.task_id,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <FilesAndLinks
      projectId={projectId}
      items={items}
      currentUserId={profile.id}
      isAdmin={role === "admin"}
      isClientRole={role === "client"}
    />
  );
}
