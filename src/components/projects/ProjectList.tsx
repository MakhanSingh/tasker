"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from "@/lib/projects/status";
import { cn } from "@/lib/utils/cn";
import type { ProjectStatus } from "@/types/database.types";

export type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  clientName: string | null;
};

type TabValue = "live" | "completed" | "archived" | "all";

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: "live", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

const EMPTY: Record<TabValue, string> = {
  live: "Nothing running right now.",
  completed: "No completed projects yet.",
  archived: "Nothing archived.",
  all: "No projects yet.",
};

/**
 * Projects, split by whether they are still being worked on.
 *
 * Defaulting to Active rather than All is the point: work you finished two
 * years ago is not what you came to this page for, and one long list of
 * everything ever run is how it stops being usable. Finished projects are one
 * click away, not gone — the same shape as the invoice tabs.
 *
 * "Active" holds on-hold projects too. A paused project is still live work you
 * mean to come back to, which is exactly the thing you'd panic about if it
 * vanished from the list.
 */
export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  const [tab, setTab] = useState<TabValue>("live");

  const counts = useMemo(
    () => ({
      live: projects.filter((p) => p.status === "active" || p.status === "on_hold").length,
      completed: projects.filter((p) => p.status === "completed").length,
      archived: projects.filter((p) => p.status === "archived").length,
      all: projects.length,
    }),
    [projects]
  );

  const shown = useMemo(() => {
    const filtered = projects.filter((project) => {
      if (tab === "all") return true;
      if (tab === "live") return project.status === "active" || project.status === "on_hold";
      return project.status === tab;
    });
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, tab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            aria-pressed={tab === option.value}
            className={cn(
              "rounded-[6px] px-3 py-1.5 text-[14px] font-medium transition-colors",
              tab === option.value ? "bg-hover text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            {option.label}
            {counts[option.value] > 0 && (
              <span className="ml-1.5 text-[13px] font-normal text-ink-faint">{counts[option.value]}</span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {shown.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">{EMPTY[tab]}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-6 py-3 font-medium">Project</th>
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((project) => (
                  <tr key={project.id} className="border-b border-border-soft last:border-0 hover:bg-hover-soft">
                    <td className="px-6 py-3">
                      <Link
                        href={`/projects/${project.id}`}
                        className={cn(
                          "font-medium hover:underline",
                          project.status === "archived" ? "text-ink-muted" : "text-ink"
                        )}
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-ink-muted">{project.clientName ?? "Internal"}</td>
                    <td className="px-6 py-3">
                      <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>
                        {PROJECT_STATUS_LABEL[project.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
