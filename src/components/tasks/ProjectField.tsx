"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moveTaskToProject } from "@/app/(dashboard)/projects/[projectId]/tasks/[taskId]/actions";
import { SidebarRow } from "./SidebarRow";

// Admins can move the task to another project from here; everyone else gets
// a plain link to the project's board.
export function ProjectField({
  projectId,
  taskId,
  projectName,
  projects,
  editable,
}: {
  projectId: string;
  taskId: string;
  projectName: string;
  projects: Array<{ id: string; name: string }>;
  editable: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(projectId);
  const [isPending, startTransition] = useTransition();

  if (!editable || projects.length <= 1) {
    return (
      <SidebarRow label="Project">
        <Hash className="h-4 w-4 shrink-0 text-project" />
        <Link href={`/projects/${projectId}/tasks`} className="truncate text-[14px] text-ink hover:underline">
          {projectName}
        </Link>
      </SidebarRow>
    );
  }

  return (
    <SidebarRow label="Project">
      <Hash className="h-4 w-4 shrink-0 text-project" />
      <Select
        value={value}
        disabled={isPending}
        onValueChange={(next) => {
          setValue(next);
          startTransition(async () => {
            try {
              await moveTaskToProject(projectId, taskId, next);
              // The task now lives at a different URL — follow it there.
              router.replace(`/projects/${next}/tasks/${taskId}`);
              router.refresh();
            } catch (err) {
              window.alert(err instanceof Error ? err.message : "Failed to move task");
              setValue(projectId);
            }
          });
        }}
      >
        <SelectTrigger className="h-8 flex-1 border-transparent px-1.5 text-[14px] hover:border-border hover:bg-hover-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SidebarRow>
  );
}
