"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import {
  addProjectLink,
  deleteProjectLink,
  type LinkFormState,
} from "@/app/(dashboard)/projects/[projectId]/files/actions";

const initialState: LinkFormState = { error: null };

export type ProjectLink = {
  id: string;
  title: string;
  url: string;
  is_client_visible: boolean;
  created_by: string;
};

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The links that belong to the project as a whole — its Drive folder, the
 * staging site — rather than to a task.
 *
 * Deliberately here on Overview and not on Files & Links: that tab is a
 * read-only roll-up of what was attached inside tasks, and it stays that way.
 * A project's Drive folder isn't "from" any task, so filing it under one would
 * have meant inventing a task to hold it.
 */
export function ProjectLinks({
  projectId,
  links,
  currentUserId,
  canAdd,
  isAdmin,
  isClientRole,
}: {
  projectId: string;
  links: ProjectLink[];
  currentUserId: string;
  canAdd: boolean;
  isAdmin: boolean;
  isClientRole: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const addWithId = addProjectLink.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(addWithId, initialState);
  const { formRef, formError, field, errorProps, resetForm, dismissAll } = useFieldErrors(state);

  useEffect(() => {
    if (state.success) {
      resetForm();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the server action's result
      setOpen(false);
    }
  }, [state.success, resetForm]);

  if (!canAdd && links.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Project links{" "}
          {links.length > 0 && <span className="font-normal normal-case text-ink-faint">{links.length}</span>}
        </h3>
      </div>

      {links.length === 0 && (
        <p className="text-[13px] text-ink-muted">
          Nothing yet — the shared Drive folder or the staging URL belong here.
        </p>
      )}

      {links.length > 0 && (
        <ul className="flex flex-col gap-1">
          {links.map((link) => (
            <li
              key={link.id}
              className="group flex items-center gap-2 rounded-[6px] px-1.5 py-1.5 hover:bg-hover-soft"
            >
              <Link2 className="h-4 w-4 shrink-0 text-ink-faint" />
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-baseline gap-1.5"
              >
                <span className="truncate text-[14px] text-ink hover:underline">{link.title}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-ink-faint" />
                <span className="truncate text-[12px] text-ink-faint">{domainOf(link.url)}</span>
              </a>
              {!isClientRole && !link.is_client_visible && <Badge variant="warning">internal</Badge>}
              {(isAdmin || link.created_by === currentUserId) && (
                <button
                  type="button"
                  aria-label={`Delete link "${link.title}"`}
                  onClick={() =>
                    void deleteProjectLink(link.id, projectId)
                      .then(() => router.refresh())
                      .catch((err: unknown) =>
                        window.alert(err instanceof Error ? err.message : "Failed to delete link")
                      )
                  }
                  className="rounded p-0.5 text-ink-faint opacity-0 hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd &&
        (open ? (
          <form
            ref={formRef}
            action={formAction}
            noValidate
            className="flex flex-col gap-2 rounded-[8px] bg-hover-soft p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Input
                  name="title"
                  required
                  autoFocus
                  placeholder="Google Drive — project folder"
                  aria-label="Link name"
                  {...field("title")}
                />
                <FieldError {...errorProps("title")} />
              </div>
              <div className="flex flex-col gap-1">
                <Input name="url" type="url" required placeholder="https://…" aria-label="URL" {...field("url")} />
                <FieldError {...errorProps("url")} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {!isClientRole ? (
                <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                  <input type="checkbox" name="is_client_visible" value="true" defaultChecked className="h-3.5 w-3.5" />
                  Visible to client
                </label>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    dismissAll();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Adding…" : "Add link"}
                </Button>
              </div>
            </div>
            <FormError error={formError} className="text-[12px] text-accent" />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 py-1 text-[13px] text-ink-muted hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Add link
          </button>
        ))}
    </section>
  );
}
