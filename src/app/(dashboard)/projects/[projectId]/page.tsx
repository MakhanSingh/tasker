import { redirect } from "next/navigation";

// Opening a project lands on its Tasks board — that's where the work
// happens. Redirecting at the canonical URL (rather than rewriting every
// link) means the sidebar, dashboards, client workspace and any old
// bookmark all arrive at Tasks automatically. The overview lives at
// /overview and is reached from the tab bar.
export default async function ProjectIndexPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/tasks`);
}
