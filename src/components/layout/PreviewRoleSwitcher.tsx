"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPreviewRole } from "@/app/(dashboard)/preview-actions";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "client", label: "Client" },
] as const;

export function PreviewRoleSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 rounded-md bg-warning-bg px-2 py-1">
      <span className="text-xs font-medium text-warning">Preview as</span>
      <div className="flex gap-1">
        {ROLES.map((role) => (
          <button
            key={role.value}
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setPreviewRole(role.value);
                router.push("/");
                router.refresh();
              })
            }
            className={
              current === role.value
                ? "rounded bg-warning px-2 py-0.5 text-xs font-medium text-white"
                : "rounded px-2 py-0.5 text-xs font-medium text-warning hover:bg-warning-border"
            }
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  );
}
