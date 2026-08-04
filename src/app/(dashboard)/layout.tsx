import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { needsAttention, todayKey } from "@/lib/todo/buckets";
import { getMyTaskIds } from "@/lib/tasks/myTasks";

async function getDueCount(userId: string) {
  const supabase = await createClient();
  const today = todayKey();

  const myTaskIds = await getMyTaskIds(supabase, userId);
  const [{ data: tasks }, { data: todos }] = await Promise.all([
    myTaskIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase.from("tasks").select("due_date").in("id", myTaskIds).neq("status", "done"),
    supabase.from("personal_todos").select("due_date").eq("user_id", userId).eq("is_done", false),
  ]);

  return [...(tasks ?? []), ...(todos ?? [])].filter((row) => needsAttention(row.due_date, today)).length;
}

// Sidebar project list with open-task counts. RLS scopes both queries, so a
// member/client only ever gets the projects they can actually open.
async function getSidebarProjects() {
  const supabase = await createClient();
  const [{ data: projects }, { data: openTasks }] = await Promise.all([
    // Live work only. A finished project has nothing you need one click away,
    // and after a year of them the sidebar is the reason you can't find the
    // project you are actually on. They stay reachable from Projects.
    supabase
      .from("projects")
      .select("id, name, status, client_id, last_activity_at, clients(name)")
      .in("status", ["active", "on_hold"])
      // Newest activity first, the way Slack orders channels: the sidebar
      // reorders itself around the work rather than staying an alphabetical
      // filing cabinet. Sorting here means the ordering is the database's
      // answer, not something recomputed in the browser on every render.
      .order("last_activity_at", { ascending: false }),
    supabase.from("tasks").select("project_id").neq("status", "done"),
  ]);

  const counts = new Map<string, number>();
  for (const task of openTasks ?? []) {
    counts.set(task.project_id, (counts.get(task.project_id) ?? 0) + 1);
  }

  const withClients = (projects ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    openCount: counts.get(project.id) ?? 0,
    clientId: project.client_id,
    clientName: project.clients?.name ?? null,
    lastActivityAt: project.last_activity_at,
  }));

  // Already ordered by the query; the grouping in the sidebar preserves it.
  return withClients;
}

async function getClientOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, name").order("name");
  return data ?? [];
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const [dueCount, projects, clients] = await Promise.all([
    profile.role === "client" ? Promise.resolve(0) : getDueCount(profile.id),
    getSidebarProjects(),
    // Only admins can create projects, so only they need the client list.
    // Both the admin and the client need this for the Add-project form. RLS
    // scopes it: an admin gets every company, a client gets only their own.
    profile.role === "member" ? Promise.resolve([]) : getClientOptions(),
  ]);

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        role={profile.role}
        dueCount={dueCount}
        projects={projects}
        clients={clients}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          userId={profile.id}
          fullName={profile.full_name}
          role={profile.role}
          hasAvatar={!!profile.avatar_url}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
