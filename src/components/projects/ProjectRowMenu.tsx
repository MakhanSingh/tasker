"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  CheckCircle2,
  Link as LinkIcon,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
  Trash2,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteLinkDialog } from "@/components/projects/InviteLinkDialog";
import { deleteProject, setProjectStatus } from "@/app/(dashboard)/projects/actions";
import type { ProjectStatus } from "@/types/database.types";

/**
 * The "…" menu on a sidebar project.
 *
 * Only the things this app actually does — Todoist's menu has favourites,
 * templates, CSV import and a calendar feed, and offering any of them here
 * would be offering something that doesn't exist. What's left maps one to one
 * onto real behaviour, and the destructive half only appears for an admin.
 *
 * Status changes and delete both live here as well as on the project's own
 * Overview: the sidebar is where you notice a finished project still sitting
 * in your way, so it should be where you can deal with it.
 */
export function ProjectRowMenu({
  projectId,
  projectName,
  status,
  isAdmin,
}: {
  projectId: string;
  projectName: string;
  status: ProjectStatus;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const run = (fn: () => Promise<void>, after?: () => void) =>
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  const move = (next: ProjectStatus) => run(() => setProjectStatus(projectId, next));

  const copyLink = () => {
    const url = `${window.location.origin}/projects/${projectId}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Options for ${projectName}`}
            onClick={(event) => event.stopPropagation()}
            // Hidden until the row is hovered or this button is focused, so the
            // sidebar stays quiet — but never hidden from the keyboard.
            className="rounded p-0.5 text-ink-faint opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem onSelect={copyLink}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <LinkIcon className="h-4 w-4 text-ink-faint" />}
            {copied ? "Copied" : "Copy link to project"}
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuItem onSelect={() => router.push(`/projects/${projectId}/members`)}>
                <Users className="h-4 w-4 text-ink-faint" />
                Members
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  // Radix closes the menu on select; opening the dialog in the
                  // same tick would have the two fighting over focus.
                  event.preventDefault();
                  setShareOpen(true);
                }}
              >
                <LinkIcon className="h-4 w-4 text-ink-faint" />
                Share — invite link
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={() => router.push(`/projects/${projectId}/overview`)}>
                <Pencil className="h-4 w-4 text-ink-faint" />
                Edit
              </DropdownMenuItem>

              {status === "active" && (
                <DropdownMenuItem disabled={isPending} onSelect={() => move("on_hold")}>
                  <PauseCircle className="h-4 w-4 text-ink-faint" />
                  Put on hold
                </DropdownMenuItem>
              )}
              {status === "on_hold" && (
                <DropdownMenuItem disabled={isPending} onSelect={() => move("active")}>
                  <PlayCircle className="h-4 w-4 text-ink-faint" />
                  Resume
                </DropdownMenuItem>
              )}
              {status !== "completed" && status !== "archived" && (
                <DropdownMenuItem disabled={isPending} onSelect={() => move("completed")}>
                  <CheckCircle2 className="h-4 w-4 text-ink-faint" />
                  Mark complete
                </DropdownMenuItem>
              )}
              {status !== "archived" && (
                <DropdownMenuItem disabled={isPending} onSelect={() => move("archived")}>
                  <Archive className="h-4 w-4 text-ink-faint" />
                  Archive
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                destructive
                disabled={isPending}
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirmingDelete(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {shareOpen && (
        <InviteLinkDialog
          projectId={projectId}
          projectName={projectName}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}

      {confirmingDelete && (
        <ConfirmDelete
          projectName={projectName}
          isPending={isPending}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() =>
            run(
              () => deleteProject(projectId),
              () => {
                setConfirmingDelete(false);
                router.push("/projects");
              }
            )
          }
        />
      )}
    </>
  );
}

function ConfirmDelete({
  projectName,
  isPending,
  onCancel,
  onConfirm,
}: {
  projectName: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-3 rounded-[10px] bg-white p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[15px] font-semibold text-ink">Delete {projectName}?</p>
        <p className="text-[13px] text-ink-muted">
          Only possible while nothing has been logged, invoiced or attached — the database refuses it
          otherwise, and will say so. Archive keeps the history and gets it out of the way.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[6px] px-3 py-1.5 text-[14px] text-ink hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="rounded-[6px] bg-[#b8352a] px-3 py-1.5 text-[14px] text-white hover:bg-[#a02c22] disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
