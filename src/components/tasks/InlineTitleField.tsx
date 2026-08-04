"use client";

import { useState, useTransition } from "react";
import { updateTaskField } from "@/app/(dashboard)/projects/[projectId]/tasks/actions";

// Saves on blur — click into the title, edit it, click away, it's saved.
// No visible border until it's focused or hovered, so a title reads as
// plain text until the moment you mean to change it.
export function InlineTitleField({
  projectId,
  taskId,
  title,
  editable,
}: {
  projectId: string;
  taskId: string;
  title: string;
  editable: boolean;
}) {
  const [value, setValue] = useState(title);
  const [, startTransition] = useTransition();

  if (!editable) {
    return <h2 className="text-xl font-semibold text-ink">{title}</h2>;
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const trimmed = value.trim();
        if (!trimmed) {
          setValue(title);
          return;
        }
        if (trimmed === title) return;
        startTransition(() => {
          updateTaskField(projectId, taskId, "title", trimmed).catch((err) => {
            window.alert(err instanceof Error ? err.message : "Failed to update title");
            setValue(title);
          });
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValue(title);
          e.currentTarget.blur();
        }
      }}
      aria-label="Task title"
      className="-mx-1.5 -my-0.5 w-full rounded-[5px] border border-transparent bg-transparent px-1.5 py-0.5 text-xl font-semibold text-ink hover:border-border focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus"
    />
  );
}
