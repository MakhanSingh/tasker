import Link from "next/link";
import { Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from "@/lib/projects/status";

export function ProjectProgressRow({
  project,
}: {
  project: {
    id: string;
    name: string;
    status: keyof typeof PROJECT_STATUS_VARIANT;
    clientName?: string;
    doneTasks: number;
    totalTasks: number;
  };
}) {
  const pct = project.totalTasks > 0 ? Math.round((project.doneTasks / project.totalTasks) * 100) : 0;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex flex-col gap-2 border-b border-border-soft px-5 py-3.5 last:border-0 hover:bg-hover-soft"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <Hash className="h-4 w-4 shrink-0 text-project" />
          <span className="truncate text-[14px] font-medium text-ink">{project.name}</span>
          {project.clientName && (
            <span className="hidden truncate text-[12px] text-ink-faint sm:inline">· {project.clientName}</span>
          )}
        </span>
        <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
      </div>

      <div className="flex items-center gap-3">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover">
          <span
            className="block h-full rounded-full bg-success transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="shrink-0 text-[12px] text-ink-faint">
          {project.totalTasks === 0 ? "No tasks" : `${project.doneTasks}/${project.totalTasks} done`}
        </span>
      </div>
    </Link>
  );
}
