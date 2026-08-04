"use client";

import { useState, useTransition } from "react";
import { AlignLeft } from "lucide-react";
import { updateTaskField } from "@/app/(dashboard)/projects/[projectId]/tasks/actions";

export function InlineDescriptionField({
  projectId,
  taskId,
  description,
  editable,
}: {
  projectId: string;
  taskId: string;
  description: string | null;
  editable: boolean;
}) {
  const [value, setValue] = useState(description ?? "");
  const [, startTransition] = useTransition();

  if (!editable) {
    return description ? <p className="whitespace-pre-wrap text-[14px] text-ink-secondary">{description}</p> : null;
  }

  return (
    <div className="flex items-start gap-2">
      <AlignLeft className="mt-1.5 h-4 w-4 shrink-0 text-ink-faint" />
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() === (description ?? "").trim()) return;
          startTransition(() => {
            updateTaskField(projectId, taskId, "description", value).catch((err) => {
              window.alert(err instanceof Error ? err.message : "Failed to update description");
              setValue(description ?? "");
            });
          });
        }}
        rows={1}
        placeholder="Description"
        className="min-h-8 w-full resize-none rounded-[5px] border border-transparent bg-transparent px-1.5 py-1 text-[14px] text-ink-secondary placeholder:text-ink-faint hover:border-border focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus"
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
      />
    </div>
  );
}
