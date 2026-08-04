import Link from "next/link";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/projects/ProjectList";

export default async function ProjectsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Every status is fetched and the split happens in the list component: the
  // count on each tab has to be right before you click it.
  //
  // RLS already scopes this to whatever the current role can see — admins get
  // everything, members and clients only their assigned projects.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, clients(name)")
    .order("name");

  const rows = (projects ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    clientName: project.clients?.name ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Projects</h1>
        {profile.role === "admin" && (
          <Button asChild>
            <Link href="/projects/new">New project</Link>
          </Button>
        )}
      </div>

      <ProjectList projects={rows} />
    </div>
  );
}
