"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditMemberDialog } from "@/components/team/EditMemberDialog";
import { deleteTeamMember, setMemberActive } from "@/app/(dashboard)/team/actions";

/**
 * Edit, disable, and — for an account nobody ever worked as — remove.
 *
 * Disable stays the wide button because it is nearly always the right one: it
 * revokes access at once and leaves their hours on the invoices they were
 * billed on. Remove is the quiet one, for the invite sent to a mistyped
 * address, and the database refuses it for anyone who has actually done
 * something, saying what they have. Editing is offered on your own row too —
 * correcting your own name or address is not the kind of self-change that can
 * lock you out, unlike disabling or demoting yourself.
 */
export function MemberActions({
  profileId,
  fullName,
  email,
  role,
  isActive,
  isSelf,
}: {
  profileId: string;
  fullName: string;
  email: string;
  role: "admin" | "member";
  isActive: boolean;
  /** You can neither disable nor delete your own account. */
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
        setConfirming(false);
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  const edit = (
    <EditMemberDialog
      profileId={profileId}
      fullName={fullName}
      email={email}
      role={role}
      isSelf={isSelf}
    />
  );

  if (isSelf) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-[12px] text-ink-faint">That&apos;s you</span>
        {edit}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-[13px] text-ink">Remove {fullName}?</span>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => run(() => deleteTeamMember(profileId))}
        >
          {isPending ? "Removing…" : "Remove"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {edit}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => run(() => setMemberActive(profileId, !isActive))}
      >
        {isActive ? "Disable" : "Enable"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Remove
      </Button>
    </div>
  );
}
