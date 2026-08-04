import Link from "next/link";
import { notFound } from "next/navigation";
import { Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { Badge } from "@/components/ui/badge";
import { InlineTitleField } from "@/components/tasks/InlineTitleField";
import { InlineDescriptionField } from "@/components/tasks/InlineDescriptionField";
import { TaskStatusSelect } from "@/components/tasks/TaskStatusSelect";
import { AssigneeField } from "@/components/tasks/AssigneeField";
import { DueDateField } from "@/components/tasks/DueDateField";
import { PriorityField } from "@/components/tasks/PriorityField";
import { ProjectField } from "@/components/tasks/ProjectField";
import { SidebarRow } from "@/components/tasks/SidebarRow";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { SubtaskSection } from "@/components/tasks/SubtaskSection";
import { TaskAttachments } from "@/components/tasks/TaskAttachments";
import { TaskLinks } from "@/components/tasks/TaskLinks";
import { TaskComments } from "@/components/tasks/TaskComments";
import { TaskTimeSection } from "@/components/time/TaskTimeSection";
import { ClientTaskTime } from "@/components/time/ClientTaskTime";
import { TASK_STATUS_LABEL } from "@/lib/tasks/labels";
import type { Attachment } from "@/components/files/AttachmentList";

const CAN_MANAGE_TASKS = ["admin", "manager", "editor"];
const CAN_DELETE_TASKS = ["admin", "manager"];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>;
}

// Fixed locale + explicit fields so server render and client hydration agree.
function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Shared by the full task page and the board's modal, so the two can never
// drift apart. Two columns: title, description, sub-tasks, attachments, time
// and comments on the left; a field-by-field sidebar on the right, ending
// with the quiet created/updated record.
export async function TaskDetailContent({ projectId, taskId }: { projectId: string; taskId: string }) {
  const profile = await requireProfile();
  const role = await getProjectRole(projectId);
  const supabase = await createClient();

  const [{ data: task }, { data: project }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", taskId).single(),
    supabase.from("projects").select("name").eq("id", projectId).single(),
  ]);
  if (!task) notFound();

  const canManage = !!role && CAN_MANAGE_TASKS.includes(role);
  const canDelete = !!role && CAN_DELETE_TASKS.includes(role);
  const isClient = role === "client";
  const canLogTime = !!role && !isClient;
  const isAdmin = profile.role === "admin";

  const [{ data: comments }, { data: subtasks }, { data: files }, { data: assignments }] = await Promise.all([
    supabase
      .from("task_comments")
      .select("id, body, is_internal, created_at, author_id, parent_id")
      .eq("task_id", taskId)
      .order("created_at"),
    supabase.from("task_subtasks").select("id, title, is_done").eq("task_id", taskId).order("position"),
    supabase.from("files").select("id, file_name, mime_type, comment_id").eq("task_id", taskId),
    supabase.from("task_assignees").select("user_id").eq("task_id", taskId),
  ]);

  const { data: links } = await supabase
    .from("project_links")
    .select("id, title, url, is_client_visible, created_by")
    .eq("task_id", taskId)
    .order("created_at");

  const assigneeIds = (assignments ?? []).map((a) => a.user_id);

  const taskAttachments: Attachment[] = (files ?? []).filter((f) => f.comment_id === null);
  const attachmentsByComment = new Map<string, Attachment[]>();
  for (const file of files ?? []) {
    if (!file.comment_id) continue;
    attachmentsByComment.set(file.comment_id, [...(attachmentsByComment.get(file.comment_id) ?? []), file]);
  }

  const commentIds = (comments ?? []).map((c) => c.id);
  const reactionsByComment = new Map<string, Array<{ comment_id: string; user_id: string; emoji: string }>>();
  if (commentIds.length > 0) {
    const { data: reactions } = await supabase
      .from("comment_reactions")
      .select("comment_id, user_id, emoji")
      .in("comment_id", commentIds);
    for (const reaction of reactions ?? []) {
      reactionsByComment.set(reaction.comment_id, [
        ...(reactionsByComment.get(reaction.comment_id) ?? []),
        reaction,
      ]);
    }
  }

  // Team members double as the assignee dropdown's options and the lookup
  // for names on comments.
  const { data: memberships } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .neq("project_role", "client");
  const teamIds = (memberships ?? []).map((m) => m.user_id);

  let teamMembers: Array<{ id: string; full_name: string }> = [];
  if (teamIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", teamIds);
    teamMembers = profiles ?? [];
  }

  const authorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
  const authorNames = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
    (profiles ?? []).forEach((p) => authorNames.set(p.id, p.full_name));
  }

  // Every project is a valid move target for an admin; RLS hands an admin
  // the full list.
  let allProjects: Array<{ id: string; name: string }> = [];
  if (isAdmin) {
    const { data } = await supabase.from("projects").select("id, name").order("name");
    allProjects = data ?? [];
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 pr-8">
        <Link
          href={`/projects/${projectId}/tasks`}
          className="flex min-w-0 items-center gap-1.5 truncate text-[13px] text-ink-muted hover:text-ink"
        >
          <Hash className="h-3.5 w-3.5 shrink-0 text-project" />
          <span className="truncate">{project?.name ?? "Project"}</span>
        </Link>
        {canDelete && <DeleteTaskButton projectId={projectId} taskId={task.id} />}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px] lg:items-start">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <InlineTitleField projectId={projectId} taskId={task.id} title={task.title} editable={canManage} />
            <InlineDescriptionField
              projectId={projectId}
              taskId={task.id}
              description={task.description}
              editable={canManage}
            />
          </div>

          <SubtaskSection
            projectId={projectId}
            taskId={taskId}
            subtasks={subtasks ?? []}
            canToggle={canManage || assigneeIds.includes(profile.id)}
            canManage={canManage}
          />

          <TaskAttachments
            projectId={projectId}
            taskId={taskId}
            attachments={taskAttachments}
            canUpload={canManage || isClient}
          />

          <TaskLinks
            projectId={projectId}
            taskId={taskId}
            links={links ?? []}
            currentUserId={profile.id}
            canAdd={canManage || isClient}
            isAdmin={isAdmin}
            isClientRole={isClient}
          />

          <section className="flex flex-col gap-3">
            <SectionHeading>Comments</SectionHeading>
            <TaskComments
              projectId={projectId}
              taskId={taskId}
              comments={comments ?? []}
              authorNames={authorNames}
              attachmentsByComment={attachmentsByComment}
              reactionsByComment={reactionsByComment}
              currentUserId={profile.id}
              isAdmin={isAdmin}
              isClient={isClient}
            />
          </section>
        </div>

        <aside className="flex flex-col lg:border-l lg:border-border lg:pl-6">
          <ProjectField
            projectId={projectId}
            taskId={task.id}
            projectName={project?.name ?? "Project"}
            projects={allProjects}
            editable={isAdmin}
          />

          <SidebarRow label="Status">
            {isClient ? (
              <Badge>{TASK_STATUS_LABEL[task.status]}</Badge>
            ) : (
              <TaskStatusSelect
                projectId={projectId}
                taskId={task.id}
                status={task.status}
                className="h-8 w-full border-transparent px-1.5 text-[14px] hover:border-border hover:bg-hover-soft"
              />
            )}
          </SidebarRow>

          {!isClient && (
            <AssigneeField
              projectId={projectId}
              taskId={task.id}
              assigneeIds={assigneeIds}
              options={teamMembers}
              editable={canManage}
            />
          )}

          <DueDateField projectId={projectId} taskId={task.id} dueDate={task.due_date} editable={canManage} />

          <PriorityField projectId={projectId} taskId={task.id} priority={task.priority} editable={canManage} />

          {/* Both read-only for a client: theirs comes from the grouped
              rollup, so it carries the hours and nothing else. */}
          {isClient ? (
            <ClientTaskTime projectId={projectId} taskId={taskId} />
          ) : (
            <TaskTimeSection
              projectId={projectId}
              taskId={taskId}
              taskTitle={task.title}
              canLogTime={canLogTime}
            />
          )}

          <div className="flex flex-col gap-0.5 pt-3 text-[11px] text-ink-faint">
            <span>Created {formatTimestamp(task.created_at)}</span>
            <span>Updated {formatTimestamp(task.updated_at)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
