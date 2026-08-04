"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Download, ExternalLink, FileText, Link2, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toDateKey } from "@/lib/todo/buckets";
import { cn } from "@/lib/utils/cn";
import { deleteFile, deleteProjectLink } from "@/app/(dashboard)/projects/[projectId]/files/actions";

export type LibraryItem = {
  kind: "file" | "link";
  id: string;
  title: string;
  /** Download route for a file, the URL itself for a link. */
  href: string;
  createdAt: string;
  sizeBytes: number | null;
  isClientVisible: boolean;
  authorId: string;
  /** null when the reader can't resolve that profile. */
  authorName: string | null;
  /** The task or comment a file came from, when it came from one. */
  source: string | null;
  taskId: string | null;
};

type Tab = "all" | "file" | "link";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "all", label: "All" },
  { value: "file", label: "Files" },
  { value: "link", label: "Links" },
];

function formatBytes(bytes: number | null) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Fixed locale and explicit fields so the server render and the client's
// first paint agree.
function dateHeading(key: string, today: string, yesterday: string) {
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function LibraryRow({
  item,
  projectId,
  canDelete,
  showVisibility,
}: {
  item: LibraryItem;
  projectId: string;
  canDelete: boolean;
  showVisibility: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isLink = item.kind === "link";

  const remove = () =>
    startTransition(async () => {
      try {
        if (isLink) await deleteProjectLink(item.id, projectId);
        else await deleteFile(item.id, projectId);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed to delete");
      }
    });

  const meta = [isLink ? domainOf(item.href) : formatBytes(item.sizeBytes), item.authorName]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group flex items-center gap-3 rounded-[6px] px-2 py-2 hover:bg-hover-soft">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
          isLink ? "bg-info-bg text-info" : "bg-hover text-ink-secondary"
        )}
      >
        {isLink ? <Link2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <a
          href={item.href}
          {...(isLink ? { target: "_blank", rel: "noreferrer" } : {})}
          className="flex items-center gap-1.5 truncate text-[14px] font-medium text-ink hover:underline"
        >
          {item.title}
          {isLink && <ExternalLink className="h-3 w-3 shrink-0 text-ink-faint" />}
        </a>
        <span className="flex flex-wrap items-center gap-x-1.5 truncate text-[12px] text-ink-muted">
          {meta}
          {item.source && item.taskId && (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/projects/${projectId}/tasks/${item.taskId}`}
                className="truncate text-ink-muted hover:text-accent hover:underline"
              >
                {item.source}
              </Link>
            </>
          )}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1">
        {showVisibility && !item.isClientVisible && <Badge variant="warning">internal</Badge>}
        {!isLink && (
          <Button asChild variant="ghost" size="sm" aria-label={`Download ${item.title}`}>
            <a href={item.href}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={isPending}
            aria-label={`Delete ${item.title}`}
            onClick={remove}
            className="flex h-7 w-7 items-center justify-center rounded-[5px] text-ink-faint opacity-0 hover:bg-danger-bg hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * Every file and link on the project, newest first, grouped by the day it was
 * added — which is how people actually look for these things ("the spec Aisha
 * sent last Tuesday") rather than by type.
 *
 * Search and the type tabs both filter client-side: everything is already
 * loaded, so a round-trip would only add latency.
 */
export function FilesAndLinks({
  projectId,
  items,
  currentUserId,
  isAdmin,
  isClientRole,
}: {
  projectId: string;
  items: LibraryItem[];
  currentUserId: string;
  isAdmin: boolean;
  isClientRole: boolean;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  // Calendar arithmetic, not millisecond subtraction: the day before a DST
  // change isn't 24 hours earlier.
  const now = new Date();
  const today = toDateKey(now);
  const previous = new Date(now);
  previous.setDate(now.getDate() - 1);
  const yesterday = toDateKey(previous);

  // Search first, then the tab — so the counts on the tabs describe what
  // picking that tab would actually show, rather than a total the search has
  // already ruled out.
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    // The source is searchable too, so "checkout" finds what was attached to
    // the checkout task even when the filename says nothing.
    return items.filter((item) =>
      [item.title, item.href, item.authorName ?? "", item.source ?? ""].some((field) =>
        field.toLowerCase().includes(q)
      )
    );
  }, [items, query]);

  const counts = useMemo(
    () => ({
      all: matching.length,
      file: matching.filter((i) => i.kind === "file").length,
      link: matching.filter((i) => i.kind === "link").length,
    }),
    [matching]
  );

  const shown = useMemo(
    () => (tab === "all" ? matching : matching.filter((item) => item.kind === tab)),
    [matching, tab]
  );

  const groups = useMemo(() => {
    const byDay = new Map<string, LibraryItem[]>();
    for (const item of shown) {
      const key = toDateKey(new Date(item.createdAt));
      byDay.set(key, [...(byDay.get(key) ?? []), item]);
    }
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [shown]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-[7px] bg-sidebar p-0.5">
          {TABS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTab(option.value)}
              aria-pressed={tab === option.value}
              className={cn(
                "flex items-center gap-1.5 rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors",
                tab === option.value ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              )}
            >
              {option.label}
              <span className="text-ink-faint">{counts[option.value]}</span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, person or task…"
            aria-label="Search files and links"
            className="pl-9"
          />
        </div>

      </div>


      {groups.length === 0 ? (
        <p className="rounded-[10px] border border-border bg-white px-6 py-8 text-center text-[13px] text-ink-muted">
          {query
            ? "Nothing matches your search."
            : "Nothing yet — files and links attached to this project's tasks collect here."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([day, dayItems]) => (
            <section key={day} className="flex flex-col gap-1">
              <h2 className="px-2 text-[13px] font-bold text-ink">
                {dateHeading(day, today, yesterday)}
              </h2>
              <div className="flex flex-col divide-y divide-border-soft rounded-[10px] border border-border bg-white p-1.5">
                {dayItems.map((item) => (
                  <LibraryRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    projectId={projectId}
                    canDelete={isAdmin || item.authorId === currentUserId}
                    showVisibility={!isClientRole}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
