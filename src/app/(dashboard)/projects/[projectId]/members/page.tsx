import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMemberForm } from "@/components/projects/AddMemberForm";
import { MemberRow } from "@/components/projects/MemberRow";
import { InviteLinkDialog } from "@/components/projects/InviteLinkDialog";
import { InviteLinkList } from "@/components/projects/InviteLinkList";

export default async function ProjectMembersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const role = await getProjectRole(projectId);
  const isAdmin = role === "admin";
  const supabase = await createClient();

  // Which company this project belongs to. The Members tab showed nothing at
  // all on a new project — an admin picks the client when creating it, and
  // that choice lives on projects.client_id, not in project_members. The page
  // looked broken when the honest answer was "nobody has been given access
  // yet, and here is who could be".
  const { data: project } = await supabase
    .from("projects")
    .select("name, client_id, clients(name)")
    .eq("id", projectId)
    .single();

  const projectName = project?.name ?? null;

  const clientName = (project?.clients as { name: string } | null)?.name ?? null;

  const { data: memberships } = await supabase
    .from("project_members")
    .select("id, project_role, user_id")
    .eq("project_id", projectId);

  const memberUserIds = (memberships ?? []).map((m) => m.user_id);
  const { data: memberProfiles } = memberUserIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", memberUserIds)
    : { data: [] as Array<{ id: string; full_name: string; email: string }> };

  const profileById = new Map((memberProfiles ?? []).map((p) => [p.id, p]));
  const roster = (memberships ?? []).map((m) => ({ ...m, profile: profileById.get(m.user_id) }));

  // Only live links. RLS already limits this table to admins, so a member
  // opening this page simply gets nothing.
  const { data: inviteRows } = await supabase
    .from("project_invites")
    .select("id, project_role, email, expires_at, max_uses, used_count")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const invites = (inviteRows ?? [])
    .filter((row) => row.used_count < row.max_uses)
    .map((row) => ({
      id: row.id,
      projectRole: row.project_role,
      email: row.email,
      expiresAt: row.expires_at,
      maxUses: row.max_uses,
      usedCount: row.used_count,
    }));

  let teamCandidates: Array<{ id: string; full_name: string; email: string }> = [];
  let clientCandidates: Array<{ id: string; full_name: string; email: string }> = [];

  if (isAdmin) {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, client_id")
      .eq("is_active", true);

    teamCandidates = (allProfiles ?? []).filter((p) => p.role !== "client" && !memberUserIds.includes(p.id));
    // Only this project's own company. Offering every portal user in the org
    // put another client's people one click from access to these projects.
    clientCandidates = (allProfiles ?? []).filter(
      (p) => p.role === "client" && p.client_id === project?.client_id && !memberUserIds.includes(p.id)
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Invite by link</CardTitle>
            <InviteLinkDialog projectId={projectId} projectName={projectName ?? "this project"} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-muted">
              A link is scoped to this project and one role, expires, and can be revoked. Someone
              without an account can use it to create one — the link is what lets them in, so treat it
              like a key.
            </p>
            <InviteLinkList projectId={projectId} invites={invites} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team on this project</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {roster
            .filter((m) => m.project_role !== "client")
            .map((m) =>
              m.profile ? (
                <MemberRow
                  key={m.id}
                  projectId={projectId}
                  memberRowId={m.id}
                  fullName={m.profile.full_name}
                  email={m.profile.email}
                  projectRole={m.project_role}
                  canEdit={isAdmin}
                />
              ) : null
            )}
          {isAdmin && <AddMemberForm projectId={projectId} candidates={teamCandidates} kind="team" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client access</CardTitle>
          {clientName && (
            <p className="text-[13px] text-ink-muted">
              This project belongs to{" "}
              {isAdmin && project?.client_id ? (
                <Link href={`/clients/${project.client_id}`} className="text-ink hover:underline">
                  {clientName}
                </Link>
              ) : (
                <span className="text-ink">{clientName}</span>
              )}
              . Choosing them as the client doesn&apos;t by itself let anyone in — add the
              people below who should see it.
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {roster
            .filter((m) => m.project_role === "client")
            .map((m) =>
              m.profile ? (
                <MemberRow
                  key={m.id}
                  projectId={projectId}
                  memberRowId={m.id}
                  fullName={m.profile.full_name}
                  email={m.profile.email}
                  projectRole={m.project_role}
                  canEdit={isAdmin}
                />
              ) : null
            )}
          {isAdmin && clientCandidates.length > 0 && (
            <AddMemberForm projectId={projectId} candidates={clientCandidates} kind="client" />
          )}
          {isAdmin && clientCandidates.length === 0 && roster.every((m) => m.project_role !== "client") && (
            <p className="text-[13px] text-ink-muted">
              {clientName ? (
                <>
                  No portal users for {clientName} yet.{" "}
                  <Link href={`/clients/${project?.client_id}`} className="text-accent hover:underline">
                    Invite one
                  </Link>{" "}
                  and they&apos;ll be selectable here.
                </>
              ) : (
                "No client portal users available to add."
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
