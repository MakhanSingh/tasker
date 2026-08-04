"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { InlineAddTaskRow } from "@/components/tasks/InlineAddTaskRow";
import { cn } from "@/lib/utils/cn";
import type { TaskStatus } from "@/types/database.types";

// Collapsible status section. The rows are rendered on the server and passed
// in as children, so only the collapse toggle and the add form ship as
// client code.
export function TaskListSection({
  label,
  count,
  projectId,
  status,
  projectName,
  statusLabel,
  addVariant,
  children,
}: {
  label: string;
  count: number;
  projectId: string;
  status: TaskStatus;
  projectName?: string;
  statusLabel?: string;
  /** null when this person can't add work to this section. */
  addVariant: "team" | "client" | null;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="mb-6">
      <div className="flex items-center gap-1 border-b border-border-soft pb-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
          className="-ml-6 flex h-5 w-5 items-center justify-center rounded-[4px] text-ink-secondary hover:bg-hover hover:text-ink"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
        </button>
        <h2 className="text-[14px] font-semibold text-ink">{label}</h2>
        <span className="text-[13px] text-ink-faint">{count}</span>
      </div>

      {!collapsed && (
        <>
          {children}
          {addVariant && <InlineAddTaskRow
              projectId={projectId}
              projectName={projectName}
              status={status}
              statusLabel={statusLabel}
              variant={addVariant}
            />}
        </>
      )}
    </section>
  );
}
