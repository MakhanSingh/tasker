"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function ProjectTabs({ projectId, showMembers }: { projectId: string; showMembers: boolean }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  // Tasks lead — they're where the daily work happens; the project's base
  // URL redirects there, and the overview lives on its own segment.
  const tabs = [
    { href: `${base}/tasks`, label: "Tasks" },
    { href: `${base}/overview`, label: "Overview" },
    { href: `${base}/requirements`, label: "Requirements" },
    { href: `${base}/time`, label: "Time" },
    { href: `${base}/files`, label: "Files & Links" },
    ...(showMembers ? [{ href: `${base}/members`, label: "Members" }] : []),
  ];

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium",
              active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink-secondary"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
