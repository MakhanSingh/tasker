import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { getFileStorage } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024;
const CAN_UPLOAD_PROJECT_FILES = ["admin", "manager", "editor"];

export async function POST(request: Request) {
  const profile = await requireProfile();

  const formData = await request.formData();
  const projectId = String(formData.get("project_id") ?? "");
  const taskId = formData.get("task_id") ? String(formData.get("task_id")) : null;
  const commentId = formData.get("comment_id") ? String(formData.get("comment_id")) : null;
  const isClientVisible = formData.get("is_client_visible") === "true";
  const file = formData.get("file");

  if (!projectId || !(file instanceof File)) {
    return NextResponse.json({ error: "project_id and file are required" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds the 25 MB limit" }, { status: 413 });
  }

  const role = await getProjectRole(projectId);
  if (!role) {
    return NextResponse.json({ error: "You don't have access to this project" }, { status: 403 });
  }

  const supabase = await createClient();
  let visible = isClientVisible;

  if (commentId) {
    // Anyone who can comment can attach to their own comment — including
    // viewers and clients. Visibility follows the comment: attachments on
    // an internal comment stay internal; a client's attachment is always
    // client-visible.
    const { data: comment } = await supabase
      .from("task_comments")
      .select("is_internal, author_id")
      .eq("id", commentId)
      .single();
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (comment.author_id !== profile.id) {
      return NextResponse.json({ error: "You can only attach files to your own comment" }, { status: 403 });
    }
    visible = role === "client" ? true : !comment.is_internal;
  } else if (role === "client") {
    // A client attaching a brief or a screenshot to a task they raised.
    // Always visible — an internal file from the client would be one they
    // couldn't see themselves. files_insert enforces the same rule.
    visible = true;
  } else if (!CAN_UPLOAD_PROJECT_FILES.includes(role)) {
    return NextResponse.json({ error: "You don't have permission to upload to this project" }, { status: 403 });
  }

  const storage = getFileStorage();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { path: storagePath } = await storage.uploadFile({
    orgId: profile.org_id,
    projectId,
    fileName: file.name,
    body: buffer,
  });

  const { data: inserted, error } = await supabase
    .from("files")
    .insert({
      org_id: profile.org_id,
      project_id: projectId,
      task_id: taskId,
      comment_id: commentId,
      uploaded_by: profile.id,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_provider: "local",
      is_client_visible: visible,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // Don't leave an orphaned blob on disk if the metadata insert fails.
    await storage.deleteFile(storagePath);
    return NextResponse.json({ error: error?.message ?? "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileId: inserted.id });
}
