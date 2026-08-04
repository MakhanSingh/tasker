"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { signOut } from "@/app/(dashboard)/actions";
import { initialsOf } from "@/lib/utils/initials";
import { cn } from "@/lib/utils/cn";

// The account menu, top right. Built on a native details-free popover rather
// than Radix because it has to contain a form that posts to a server action —
// closing on outside click and on Escape is the whole behaviour.
export function UserMenu({
  userId,
  fullName,
  role,
  hasAvatar,
  canSignOut,
}: {
  userId: string;
  fullName: string;
  role: string;
  hasAvatar: boolean;
  /** Sign-out is hidden in preview mode, where there is no real session. */
  canSignOut: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-[5px] px-1.5 py-1 hover:bg-hover"
      >
        <Avatar userId={userId} fullName={fullName} hasAvatar={hasAvatar} />
        <span className="hidden text-[14px] font-medium text-ink sm:inline">
          {fullName.split(" ")[0]}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-ink-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-[8px] border border-border bg-white py-1 shadow-lg"
        >
          <div className="flex items-center gap-2.5 border-b border-border-soft px-3 py-2.5">
            <Avatar userId={userId} fullName={fullName} hasAvatar={hasAvatar} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-medium text-ink">{fullName}</span>
              <span className="text-[12px] capitalize text-ink-muted">{role}</span>
            </span>
          </div>

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-[14px] text-ink hover:bg-hover"
          >
            <User className="h-4 w-4 text-ink-muted" />
            Your profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-[14px] text-ink hover:bg-hover"
          >
            <Settings className="h-4 w-4 text-ink-muted" />
            Settings
          </Link>

          {canSignOut && (
            <form action={signOut} className="border-t border-border-soft">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] text-ink hover:bg-hover"
              >
                <LogOut className="h-4 w-4 text-ink-muted" />
                Sign out
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function Avatar({
  userId,
  fullName,
  hasAvatar,
}: {
  userId: string;
  fullName: string;
  hasAvatar: boolean;
}) {
  if (hasAvatar) {
    // eslint-disable-next-line @next/next/no-img-element -- an auth-checked route, not a static asset
    return <img src={`/api/avatar/${userId}`} alt="" className="h-7 w-7 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-avatar text-[11px] font-semibold text-white">
      {initialsOf(fullName)}
    </span>
  );
}
