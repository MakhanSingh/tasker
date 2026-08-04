"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { revokeInviteLink } from "@/app/(dashboard)/projects/[projectId]/members/invite-actions";

export type InviteLinkRow = {
  id: string;
  projectRole: string;
  email: string | null;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
};

const ROLE_LABEL: Record<string, string> = {
  manager: "Manager",
  editor: "Editor",
  viewer: "Viewer",
  client: "Client",
};

function expiryLabel(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "expires tomorrow" : `expires in ${days} days`;
}

/**
 * Links that are still live on this project.
 *
 * The URL isn't here and can't be — only its hash was stored. What this gives
 * you is the ability to see that a link exists and kill it, which is the part
 * that matters once one has been shared.
 */
export function InviteLinkList({ projectId, invites }: { projectId: string; invites: InviteLinkRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (invites.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">Active invite links</p>
      <ul className="flex flex-col gap-1">
        {invites.map((invite) => {
          const remaining = invite.maxUses - invite.usedCount;
          return (
            <li
              key={invite.id}
              className="group flex flex-wrap items-center gap-2 rounded-[6px] border border-border px-3 py-2 text-[13px]"
            >
              <Link2 className="h-4 w-4 shrink-0 text-ink-faint" />
              <Badge>{ROLE_LABEL[invite.projectRole] ?? invite.projectRole}</Badge>
              <span className="text-ink-muted">
                {invite.email ? `for ${invite.email}` : "anyone with the link"}
              </span>
              <span className="text-ink-faint">
                · {expiryLabel(invite.expiresAt)} · {remaining} use{remaining === 1 ? "" : "s"} left
              </span>
              <button
                type="button"
                disabled={isPending}
                aria-label="Revoke this invite link"
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await revokeInviteLink(invite.id, projectId);
                      router.refresh();
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : "Failed to revoke");
                    }
                  })
                }
                className="ml-auto rounded p-1 text-ink-faint hover:text-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
