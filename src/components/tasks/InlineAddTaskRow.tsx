"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CalendarDays, Flag, Hash, Paperclip, Plus, X } from "lucide-react";
import { FieldError, FormError } from "@/components/ui/field-error";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDropzone } from "@/components/files/FileDropzone";
import { uploadFiles } from "@/lib/files/uploadClient";
import { TASK_PRIORITY_FLAG_COLOR, TASK_PRIORITY_LABEL } from "@/lib/tasks/labels";
import { cn } from "@/lib/utils/cn";
import {
  createClientTask,
  createTask,
  type FormState,
} from "@/app/(dashboard)/projects/[projectId]/tasks/actions";
import type { TaskPriority, TaskStatus } from "@/types/database.types";

const PRIORITIES = Object.keys(TASK_PRIORITY_LABEL) as TaskPriority[];

/** "30 Jul" — locale pinned, since an implicit one renders differently on the server. */
function shortDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The quick composer behind "+ Add task": a card you type a title into and
 * send, with the extras — a date, a priority, an attachment — one icon away
 * instead of behind the full dialog. Files can be dropped or pasted straight
 * onto it.
 *
 * Only what a task here actually has. Todoist's version of this card also
 * offers reminders and labels; putting either on screen would be offering
 * something that doesn't exist. The project and status aren't pickers either —
 * they're fixed by the column this sits under, so they're shown as context.
 *
 * `variant` picks the action, not the fields, exactly as NewTaskDialog does. A
 * client's request always starts in To do, which is why the board only offers
 * them this on that column.
 */
export function InlineAddTaskRow({
  projectId,
  projectName,
  status,
  statusLabel,
  variant = "team",
}: {
  projectId: string;
  /** Context in the footer; falls back to a generic label where unknown. */
  projectName?: string;
  status: TaskStatus;
  statusLabel?: string;
  variant?: "team" | "client";
}) {
  const isClient = variant === "client";
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [result, setResult] = useState<FormState | null>(null);
  const [isPending, startTransition] = useTransition();

  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setPendingFiles([]);
    setResult(null);
  };

  const close = () => {
    reset();
    setOpen(false);
  };

  // Awaited inside a transition rather than driven by useActionState, because
  // the files can only be uploaded once the task they hang off exists.
  const submit = () => {
    if (!title.trim()) {
      setResult({ error: "A task needs a name", fieldErrors: { title: "A task needs a name" } });
      return;
    }

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("priority", priority);
    formData.set("status", status);
    if (dueDate) formData.set("due_date", dueDate);

    startTransition(async () => {
      const outcome = isClient
        ? await createClientTask(projectId, { error: null }, formData)
        : await createTask(projectId, { error: null }, formData);

      if (outcome.error || !outcome.taskId) {
        setResult({ ...outcome, error: outcome.error ?? "Failed to add the task" });
        return;
      }

      // Attachments ride behind the task rather than blocking it, so a failed
      // upload leaves the task standing and says so.
      if (pendingFiles.length > 0) {
        const uploadError = await uploadFiles({
          projectId,
          taskId: outcome.taskId,
          files: pendingFiles,
        });
        if (uploadError) window.alert(`Task added, but an attachment failed: ${uploadError}`);
      }

      // Stays open so several can be typed in a row, matching the Today view.
      reset();
      titleRef.current?.focus();
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 py-2.5 text-[14px] text-ink-muted hover:text-primary"
      >
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full group-hover:bg-primary">
          <Plus className="h-4 w-4 text-primary group-hover:text-white" />
        </span>
        {isClient ? "Request a task" : "Add task"}
      </button>
    );
  }

  const fieldErrors = result?.fieldErrors ?? {};

  return (
    <FileDropzone
      onFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
      className="my-2 border border-border bg-white"
    >
      <div className="flex flex-col">
        <div className="flex flex-col gap-1 p-3">
          <input
            ref={titleRef}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (fieldErrors.title) setResult(null);
            }}
            onKeyDown={(event) => {
              // Enter sends, Escape backs out — what you'd expect from
              // something shaped like a message box.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") close();
            }}
            autoFocus
            placeholder={isClient ? "What do you need?" : "Task name"}
            aria-label={isClient ? "What do you need?" : "Task name"}
            aria-invalid={!!fieldErrors.title || undefined}
            aria-describedby="inline-title-error"
            className="w-full text-[15px] font-medium text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
          />
          <FieldError id="inline-title-error" message={fieldErrors.title} />

          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={isClient ? "Anything that helps us get it right first time" : "Description"}
            aria-label="Description"
            className="w-full text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
          />

          {pendingFiles.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1">
              {pendingFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-[6px] bg-hover-soft px-2 py-1.5"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                    className="rounded p-0.5 text-ink-faint hover:text-accent"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IconButton
              label={dueDate ? shortDate(dueDate) : "Due date"}
              active={!!dueDate}
              onClick={() => {
                // showPicker is the only way to open the native calendar from a
                // button; where it isn't supported, focusing still lets the
                // field be typed into.
                dateRef.current?.focus();
                dateRef.current?.showPicker?.();
              }}
            >
              <CalendarDays className="h-4 w-4" />
            </IconButton>
            {/* Kept mounted rather than rendered on demand, so showPicker has
                something to open. */}
            <input
              ref={dateRef}
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              aria-label={isClient ? "Needed by" : "Due date"}
              className="sr-only"
            />

            <IconButton
              label={pendingFiles.length > 0 ? String(pendingFiles.length) : "Attach"}
              active={pendingFiles.length > 0}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </IconButton>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                const picked = [...(event.target.files ?? [])];
                if (picked.length > 0) setPendingFiles((prev) => [...prev, ...picked]);
                event.target.value = "";
              }}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Priority: ${TASK_PRIORITY_LABEL[priority]}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[6px] border border-border px-2 py-1 text-[13px] hover:bg-hover-soft",
                    priority === "medium" ? "text-ink-muted" : "text-ink"
                  )}
                >
                  <Flag className={cn("h-4 w-4", TASK_PRIORITY_FLAG_COLOR[priority])} />
                  {priority !== "medium" && TASK_PRIORITY_LABEL[priority]}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {PRIORITIES.map((option) => (
                  <DropdownMenuItem key={option} onSelect={() => setPriority(option)}>
                    <Flag className={cn("h-4 w-4", TASK_PRIORITY_FLAG_COLOR[option])} />
                    {TASK_PRIORITY_LABEL[option]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border-soft px-3 py-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-muted">
            <Hash className="h-3.5 w-3.5 shrink-0 text-project" />
            <span className="truncate">{projectName ?? "This project"}</span>
            {statusLabel && (
              <>
                <span className="text-ink-faint">/</span>
                <span className="truncate">{statusLabel}</span>
              </>
            )}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              aria-label="Cancel"
              className="rounded-[6px] border border-border p-1.5 text-ink-muted hover:bg-hover-soft hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isPending || !title.trim()}
              aria-label={isClient ? "Send request" : "Add task"}
              className="rounded-[6px] bg-primary p-1.5 text-white hover:bg-primary-hover disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>

        {result?.error && !fieldErrors.title && (
          <div className="px-3 pb-2">
            <FormError error={result.error} className="text-[12px] text-accent" />
          </div>
        )}
      </div>
    </FileDropzone>
  );
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex items-center gap-1.5 rounded-[6px] border border-border px-2 py-1 text-[13px] hover:bg-hover-soft",
        active ? "border-primary/40 text-ink" : "text-ink-muted"
      )}
    >
      {children}
      {active && label}
    </button>
  );
}
