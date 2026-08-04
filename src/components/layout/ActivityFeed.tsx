import { formatDistanceToNow } from "date-fns";

type Activity = {
  id: string;
  entity_type: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function describe(activity: Activity) {
  const subject = activity.entity_type.replace("_", " ");
  if (activity.action === "status_changed" && activity.metadata) {
    return `changed ${subject} status from ${activity.metadata.from} to ${activity.metadata.to}`;
  }
  if (activity.action === "completed" && activity.entity_type === "time_entry") {
    return `logged ${activity.metadata?.duration_minutes ?? 0} minutes`;
  }
  return `${activity.action} a ${subject}`;
}

export function ActivityFeed({
  activities,
  actorNames,
}: {
  activities: Activity[];
  actorNames: Map<string, string>;
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-ink-muted">No activity yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {activities.map((activity) => (
        <div key={activity.id} className="flex justify-between gap-4 text-sm">
          <p className="text-ink-secondary">
            <span className="font-medium text-ink">
              {activity.actor_id ? actorNames.get(activity.actor_id) ?? "Someone" : "System"}
            </span>{" "}
            {describe(activity)}
          </p>
          <span className="shrink-0 text-xs text-ink-faint">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  );
}
