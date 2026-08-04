import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectLinks } from "@/components/projects/ProjectLinks";
import { ProjectLifecycleActions } from "@/components/projects/ProjectLifecycleActions";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { ProjectEditForm } from "@/components/projects/ProjectEditForm";
import { ActivityFeed } from "@/components/layout/ActivityFeed";

async function ProjectActivity({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  // RLS on activity_log limits this to entities the current user can see,
  // so clients get nothing here and members only their projects' activity.
  const { data: activities } = await supabase
    .from("activity_log")
    .select("id, entity_type, action, actor_id, created_at, metadata")
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (!activities || activities.length === 0) return null;

  const actorIds = [...new Set(activities.map((a) => a.actor_id).filter((id): id is string => !!id))];
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    (profiles ?? []).forEach((p) => actorNames.set(p.id, p.full_name));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityFeed activities={activities} actorNames={actorNames} />
      </CardContent>
    </Card>
  );
}

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const role = await getProjectRole(projectId);

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!project) return null;

  const profile = await requireProfile();

  // task_id is null: links that belong to the project itself. RLS already
  // hides internal ones from a client, so no extra filter is needed here.
  const { data: projectLinks } = await supabase
    .from("project_links")
    .select("id, title, url, is_client_visible, created_by")
    .eq("project_id", projectId)
    .is("task_id", null)
    .order("created_at", { ascending: false });

  const canAddLinks = role === "admin" || role === "manager" || role === "editor" || role === "client";

  const linksSection = (
    <ProjectLinks
      projectId={projectId}
      links={projectLinks ?? []}
      currentUserId={profile.id}
      canAdd={canAddLinks}
      isAdmin={role === "admin"}
      isClientRole={role === "client"}
    />
  );

  if (role === "admin") {
    const [{ data: clients }, { data: billing }] = await Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("project_billing").select("*").eq("project_id", projectId).maybeSingle(),
    ]);
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectEditForm project={project} billing={billing} clients={clients ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">{linksSection}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Project status</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectLifecycleActions
              projectId={projectId}
              projectName={project.name}
              status={project.status}
            />
          </CardContent>
        </Card>
        <ProjectActivity projectId={projectId} />
      </div>
    );
  }

  const isClient = role === "client";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {project.description && <p className="text-ink-secondary">{project.description}</p>}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {/* Rates and budgets live on the Time tab now, behind
                project_billing's own RLS — a member never sees either. */}
            {project.start_date && (
              <div>
                <p className="text-ink-muted">Start date</p>
                <p className="font-medium text-ink">{project.start_date}</p>
              </div>
            )}
            {project.end_date && (
              <div>
                <p className="text-ink-muted">End date</p>
                <p className="font-medium text-ink">{project.end_date}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">{linksSection}</CardContent>
      </Card>
      {!isClient && <ProjectActivity projectId={projectId} />}
    </div>
  );
}
