"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setMemberActive } from "@/app/(dashboard)/team/actions";

export function MemberActiveToggle({ profileId, isActive }: { profileId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => setMemberActive(profileId, !isActive))}
    >
      {isActive ? "Disable" : "Enable"}
    </Button>
  );
}
