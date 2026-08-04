"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ImagePlus, Pencil, Plus, Reply, SmilePlus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  addComment,
  deleteComment,
  toggleReaction,
  updateComment,
  type FormState,
} from "@/app/(dashboard)/projects/[projectId]/tasks/[taskId]/actions";
import { uploadFiles } from "@/lib/files/uploadClient";
import { initialsOf } from "@/lib/utils/initials";
import { cn } from "@/lib/utils/cn";
import { FileDropzone } from "@/components/files/FileDropzone";
import { AttachmentList, type Attachment } from "@/components/files/AttachmentList";

const initialState: FormState = { error: null };
const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👀", "😄"];

// The "+" in the picker opens this larger, curated grid. The database stores
// the emoji itself (`comment_reactions.emoji text`), so extending this list
// never needs a migration.
const EXTENDED_EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "🤩", "😎", "🤔",
  "🤯", "😅", "🥹", "😢", "😭", "😡", "🥳", "😴",
  "🙂", "🙃", "😉", "😇", "🫡", "🤗", "🤫", "🫠",
  "👎", "👏", "🙌", "🙏", "💪", "🤝", "✌️", "🤞",
  "🫶", "👌", "🤌", "☝️", "✋", "🖐️", "🤚", "👋",
  "🧡", "💛", "💚", "💙", "💜", "🖤", "💕", "💔",
  "🔥", "⭐", "✨", "💯", "✅", "❌", "⚠️", "❓",
  "🚀", "🏆", "🎯", "💡", "📌", "📎", "📝", "💬",
  "☕", "🍕", "🎂", "🎁", "🌟", "🌈", "🐛", "🔧",
];

export type CommentRow = {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author_id: string;
  parent_id: string | null;
};

export type ReactionRow = { comment_id: string; user_id: string; emoji: string };

type CommentNode = CommentRow & { replies: CommentNode[] };

function buildTree(comments: CommentRow[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const c of comments) byId.set(c.id, { ...c, replies: [] });
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    // A reply whose parent the viewer can't see (e.g. a client-visible
    // reply under an internal comment) surfaces as a root rather than
    // silently disappearing.
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

// One form serves the composer, replies, and edits.
function CommentForm({
  projectId,
  taskId,
  parentId,
  isClient,
  autoFocus,
  onDone,
}: {
  projectId: string;
  taskId: string;
  parentId?: string;
  isClient: boolean;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const addWithIds = addComment.bind(null, projectId, taskId);
  const [state, formAction, isPending] = useActionState(addWithIds, initialState);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledComment = useRef<string | null>(null);

  useEffect(() => {
    // After the comment lands, push its attachments, then refresh so the
    // new row (and its files) come back from the server.
    if (!state.commentId || handledComment.current === state.commentId) return;
    handledComment.current = state.commentId;

    const finish = () => {
      formRef.current?.reset();
      setPendingFiles([]);
      onDone?.();
      router.refresh();
    };

    if (pendingFiles.length === 0) {
      finish();
      return;
    }
    void uploadFiles({ projectId, commentId: state.commentId, taskId, files: pendingFiles }).then((err) => {
      if (err) setUploadError(err);
      finish();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only when a new commentId arrives
  }, [state.commentId]);

  return (
    <FileDropzone onFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}>
      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        {parentId && <input type="hidden" name="parent_id" value={parentId} />}
        <textarea
          name="body"
          required
          autoFocus={autoFocus}
          rows={parentId ? 2 : 3}
          placeholder={parentId ? "Write a reply… (drop a screenshot here)" : "Add a comment… (drop a screenshot here)"}
          className="rounded-[8px] border border-border p-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus"
        />

        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-[5px] bg-hover px-2 py-1 text-[12px] text-ink-secondary"
              >
                {file.name}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="text-ink-faint hover:text-danger"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach a screenshot or file"
              className="flex items-center gap-1.5 text-[12px] text-ink-muted hover:text-ink"
            >
              <ImagePlus className="h-4 w-4" />
              Attach
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                setPendingFiles((prev) => [...prev, ...(e.target.files ? [...e.target.files] : [])]);
                e.target.value = "";
              }}
            />
            {!isClient && (
              <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                <input type="checkbox" name="is_internal" value="true" defaultChecked className="h-3.5 w-3.5" />
                Internal only
              </label>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onDone && (
              <Button type="button" size="sm" variant="ghost" onClick={onDone}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Posting…" : parentId ? "Reply" : "Comment"}
            </Button>
          </div>
        </div>
        {(state.error || uploadError) && <p className="text-sm text-accent">{state.error ?? uploadError}</p>}
      </form>
    </FileDropzone>
  );
}

function ReactionBar({
  projectId,
  taskId,
  commentId,
  reactions,
  currentUserId,
}: {
  projectId: string;
  taskId: string;
  commentId: string;
  reactions: ReactionRow[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Clicking anywhere outside closes the picker — without this, an open
  // picker lingers over the thread until its smiley is clicked again.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pickerOpen]);

  const grouped = new Map<string, ReactionRow[]>();
  for (const r of reactions) grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r]);

  const toggle = (emoji: string) => {
    setPickerOpen(false);
    setExpanded(false);
    startTransition(async () => {
      try {
        await toggleReaction(projectId, taskId, commentId, emoji);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed to react");
      }
    });
  };

  return (
    <div ref={pickerRef} className="relative flex flex-wrap items-center gap-1">
      {[...grouped.entries()].map(([emoji, rows]) => {
        const mine = rows.some((r) => r.user_id === currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            disabled={isPending}
            onClick={() => toggle(emoji)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[12px]",
              mine ? "border-primary bg-selected" : "border-border bg-white hover:bg-hover-soft"
            )}
          >
            <span>{emoji}</span>
            <span className="text-ink-secondary">{rows.length}</span>
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Add reaction"
        onClick={() => {
          setPickerOpen((v) => !v);
          setExpanded(false);
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint hover:bg-hover hover:text-ink"
      >
        <SmilePlus className="h-3.5 w-3.5" />
      </button>

      {pickerOpen && (
        <div className="absolute bottom-full left-0 z-10 mb-1 rounded-[8px] border border-border bg-white p-1.5 shadow-md">
          <div className="flex items-center gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => toggle(emoji)}
                className="rounded-[5px] px-1.5 py-0.5 text-[16px] hover:bg-hover"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              aria-label={expanded ? "Fewer emojis" : "More emojis"}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-[5px] text-ink-muted hover:bg-hover hover:text-ink",
                expanded && "bg-hover text-ink"
              )}
            >
              <Plus className={cn("h-4 w-4 transition-transform", expanded && "rotate-45")} />
            </button>
          </div>

          {expanded && (
            <div className="mt-1.5 grid max-h-40 w-64 grid-cols-8 gap-0.5 overflow-y-auto border-t border-border-soft pt-1.5">
              {EXTENDED_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggle(emoji)}
                  className="rounded-[5px] px-1 py-0.5 text-[16px] hover:bg-hover"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  node,
  depth,
  ctx,
}: {
  node: CommentNode;
  depth: number;
  ctx: {
    projectId: string;
    taskId: string;
    authorNames: Map<string, string>;
    attachmentsByComment: Map<string, Attachment[]>;
    reactionsByComment: Map<string, ReactionRow[]>;
    currentUserId: string;
    isAdmin: boolean;
    isClient: boolean;
  };
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.body);
  const [isPending, startTransition] = useTransition();

  const authorName = ctx.authorNames.get(node.author_id) ?? "Unknown";
  const canEdit = node.author_id === ctx.currentUserId;
  const canDelete = canEdit || ctx.isAdmin;

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  return (
    <div className={cn(depth > 0 && "border-l-2 border-border-soft pl-4")}>
      <div className="group/comment rounded-[8px] py-2">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-avatar text-[10px] font-semibold text-white">
            {initialsOf(authorName)}
          </span>
          <span className="text-sm font-medium text-ink">{authorName}</span>
          <span className="text-xs text-ink-faint">
            {formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}
          </span>
          {node.is_internal && <Badge variant="warning">internal</Badge>}

          <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/comment:opacity-100">
            <button
              type="button"
              title="Reply"
              onClick={() => setReplying((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-[5px] text-ink-faint hover:bg-hover hover:text-ink"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            {canEdit && (
              <button
                type="button"
                title="Edit"
                onClick={() => {
                  setDraft(node.body);
                  setEditing(true);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-[5px] text-ink-faint hover:bg-hover hover:text-ink"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                title="Delete"
                disabled={isPending}
                onClick={() => run(() => deleteComment(ctx.projectId, ctx.taskId, node.id))}
                className="flex h-6 w-6 items-center justify-center rounded-[5px] text-ink-faint hover:bg-danger-bg hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        </div>

        <div className="pl-8">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                autoFocus
                className="rounded-[8px] border border-border p-2 text-sm text-ink focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(async () => {
                      await updateComment(ctx.projectId, ctx.taskId, node.id, draft);
                      setEditing(false);
                    })
                  }
                >
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-ink-secondary">{node.body}</p>
          )}

          <div className="mt-2 flex flex-col gap-2">
            <AttachmentList attachments={ctx.attachmentsByComment.get(node.id) ?? []} />
            <ReactionBar
              projectId={ctx.projectId}
              taskId={ctx.taskId}
              commentId={node.id}
              reactions={ctx.reactionsByComment.get(node.id) ?? []}
              currentUserId={ctx.currentUserId}
            />
          </div>

          {replying && (
            <div className="mt-2">
              <CommentForm
                projectId={ctx.projectId}
                taskId={ctx.taskId}
                parentId={node.id}
                isClient={ctx.isClient}
                autoFocus
                onDone={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>

      {node.replies.length > 0 && (
        <div className={cn("flex flex-col", depth >= 3 ? "" : "ml-3")}>
          {node.replies.map((reply) => (
            <CommentItem key={reply.id} node={reply} depth={depth + 1} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskComments({
  projectId,
  taskId,
  comments,
  authorNames,
  attachmentsByComment,
  reactionsByComment,
  currentUserId,
  isAdmin,
  isClient,
}: {
  projectId: string;
  taskId: string;
  comments: CommentRow[];
  authorNames: Map<string, string>;
  attachmentsByComment: Map<string, Attachment[]>;
  reactionsByComment: Map<string, ReactionRow[]>;
  currentUserId: string;
  isAdmin: boolean;
  isClient: boolean;
}) {
  const tree = buildTree(comments);
  const ctx = {
    projectId,
    taskId,
    authorNames,
    attachmentsByComment,
    reactionsByComment,
    currentUserId,
    isAdmin,
    isClient,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        {tree.length === 0 && <p className="text-sm text-ink-muted">No comments yet.</p>}
        {tree.map((node) => (
          <CommentItem key={node.id} node={node} depth={0} ctx={ctx} />
        ))}
      </div>
      <CommentForm projectId={projectId} taskId={taskId} isClient={isClient} />
    </div>
  );
}
