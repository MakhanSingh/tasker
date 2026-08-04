import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewRequirementDialog } from "@/components/requirements/NewRequirementDialog";
import { RequirementRow } from "@/components/requirements/RequirementRow";
import type { RequirementStatus } from "@/types/database.types";

const CAN_EDIT = ["admin", "manager", "editor"];

export default async function ProjectRequirementsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const role = await getProjectRole(projectId);
  const supabase = await createClient();

  // RLS already hides internal-only requirements from clients, so no extra
  // filtering is needed here.
  const { data: requirements } = await supabase
    .from("project_requirements")
    .select("*")
    .eq("project_id", projectId)
    .order("position");

  const deciderIds = [
    ...new Set((requirements ?? []).map((r) => r.decided_by).filter((id): id is string => !!id)),
  ];
  const deciderNames = new Map<string, string>();
  if (deciderIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", deciderIds);
    (profiles ?? []).forEach((p) => deciderNames.set(p.id, p.full_name));
  }

  const isClient = role === "client";
  const canEdit = !!role && CAN_EDIT.includes(role);
  const canDelete = role === "admin" || role === "manager";

  const counts = (requirements ?? []).reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<RequirementStatus, number>
  );

  const stats = [
    { label: "Total", value: (requirements ?? []).length },
    { label: "Awaiting sign-off", value: counts.proposed ?? 0 },
    { label: "Approved", value: counts.approved ?? 0 },
    { label: "Delivered", value: counts.delivered ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-ink-muted">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-ink">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Requirements</CardTitle>
          {canEdit && <NewRequirementDialog projectId={projectId} />}
        </CardHeader>
        <CardContent className="p-0">
          {(requirements ?? []).length === 0 ? (
            <p className="px-6 pb-6 text-sm text-ink-muted">
              {canEdit
                ? "No requirements yet — add the agreed scope so everyone works from the same list."
                : "No requirements have been shared for this project yet."}
            </p>
          ) : (
            (requirements ?? []).map((requirement) => (
              <RequirementRow
                key={requirement.id}
                projectId={projectId}
                requirement={requirement}
                decidedByName={requirement.decided_by ? deciderNames.get(requirement.decided_by) : undefined}
                isClient={isClient}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
