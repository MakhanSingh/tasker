import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AddTeamMemberDialog } from "@/components/team/AddTeamMemberDialog";
import { InviteTeamMemberDialog } from "@/components/team/InviteTeamMemberDialog";
import { MemberActions } from "@/components/team/MemberActions";

export default async function TeamPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["admin", "member"])
    .order("full_name");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Team</h1>
        {/* Invite stays the solid button: letting someone set their own
            password is the better habit. Add user is the outline one beside
            it, for when the mail won't arrive or won't arrive in time. */}
        <div className="flex items-center gap-2">
          <AddTeamMemberDialog />
          <InviteTeamMemberDialog />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {!members || members.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">No team members yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Account type</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-border-soft last:border-0">
                    <td className="px-6 py-3 font-medium text-ink">{member.full_name}</td>
                    <td className="px-6 py-3 text-ink-muted">{member.email}</td>
                    <td className="px-6 py-3 capitalize text-ink-muted">{member.role}</td>
                    <td className="px-6 py-3">
                      <Badge variant={member.is_active ? "success" : "warning"}>
                        {member.is_active ? "active" : "disabled"}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <MemberActions
                        profileId={member.id}
                        fullName={member.full_name}
                        email={member.email}
                        role={member.role === "admin" ? "admin" : "member"}
                        isActive={member.is_active}
                        isSelf={member.id === admin.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
