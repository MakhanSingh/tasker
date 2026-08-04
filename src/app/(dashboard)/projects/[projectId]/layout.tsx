import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from "@/lib/projects/status";
import { ProjectTabs } from "@/components/projects/ProjectTabs";

export default async function ProjectLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, clients(name)")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const role = await getProjectRole(projectId);
  const showMembers = role === "admin" || role === "manager";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">{project.clients?.name}</p>
          <h1 className="text-2xl font-semibold text-ink">{project.name}</h1>
        </div>
        <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>
          {PROJECT_STATUS_LABEL[project.status]}
        </Badge>
      </div>
      <ProjectTabs projectId={projectId} showMembers={showMembers} />
      {children}
      {modal}
    </div>
  );
}
