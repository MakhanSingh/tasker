import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/invites/token";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInvite } from "@/components/invites/AcceptInvite";

const ROLE_BLURB: Record<string, string> = {
  manager: "manage this project — its tasks, its members and its time.",
  editor: "work on this project: create and edit tasks, and log your hours.",
  viewer: "follow this project and log time on tasks assigned to you.",
  client: "follow this project: its progress, the hours on it, and your invoices.",
};

/**
 * Where a shared invite link lands.
 *
 * Public on purpose — the whole point is that it works for someone who has no
 * account yet. It shows only what the link is for; the token is checked
 * server-side and an expired, revoked or spent one yields nothing at all,
 * rather than a page that hints at a project someone can't reach.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Read with the service role: the reader is, by design, not yet allowed to
  // see this project. peek_project_invite returns only the project name, the
  // role and the company — nothing that isn't already on the invitation.
  const admin = createAdminClient();
  const { data } = await admin.rpc("peek_project_invite", { p_token_hash: hashInviteToken(token) });
  const invite = Array.isArray(data) ? data[0] : null;

  if (!invite) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>This link isn&apos;t valid</CardTitle>
          <CardDescription>
            It may have expired, already been used, or been revoked. Ask whoever sent it for a fresh one.
          </CardDescription>
        </CardHeader>
      </Shell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let signedInAs: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    signedInAs = profile?.full_name ?? user.email ?? null;
  }

  return (
    <Shell>
      <CardHeader>
        <CardTitle>You&apos;ve been invited to {invite.project_name}</CardTitle>
        <CardDescription>
          {invite.client_name} · you&apos;ll be able to{" "}
          {ROLE_BLURB[invite.project_role] ?? "access this project."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInvite
          token={token}
          projectName={invite.project_name}
          lockedEmail={invite.email}
          signedInAs={signedInAs}
        />
      </CardContent>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hover-soft px-4">
      <Card className="w-full max-w-sm">{children}</Card>
    </div>
  );
}
