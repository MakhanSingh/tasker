"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { playNotificationChime } from "@/lib/notifications/sound";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(dashboard)/notification-actions";
import type { NotificationType } from "@/types/database.types";

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const POLL_MS = 20_000;
const MUTE_KEY = "tasker:notifications-muted";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [muted, setMuted] = useState(false);
  const [, startTransition] = useTransition();

  // Tracks the previous unread count purely to detect *new* arrivals — the
  // chime must never replay just because the popover re-fetched the same
  // notifications a user already has open.
  const previousUnread = useRef<number | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    // localStorage doesn't exist on the server, so the mute preference has
    // to be read after mount rather than seeded during render — seeding it
    // there would make server and client markup disagree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(window.localStorage.getItem(MUTE_KEY) === "true");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: { unread: number; notifications: Notification[] } = await res.json();
        if (cancelled) return;

        setNotifications(data.notifications);
        setUnread(data.unread);

        // Skip the chime on the tab's very first load — arriving to a
        // pile of unread notifications should be quiet, not a fanfare.
        if (!isFirstLoad.current && previousUnread.current !== null && data.unread > previousUnread.current) {
          if (!muted && document.visibilityState === "visible") {
            playNotificationChime();
          }
        }
        previousUnread.current = data.unread;
        isFirstLoad.current = false;
      } catch {
        // A missed poll just tries again next tick — nothing to surface.
      }
    }

    void poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [muted]);

  const toggleMuted = () => {
    setMuted((previous) => {
      const next = !previous;
      window.localStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  };

  const handleSelect = (notification: Notification) => {
    setOpen(false);
    if (!notification.is_read) {
      setNotifications((list) => list.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
      setUnread((count) => Math.max(0, count - 1));
      startTransition(() => {
        markNotificationRead(notification.id).catch(() => {});
      });
    }
    if (notification.link) router.push(notification.link);
  };

  const handleMarkAllRead = () => {
    setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    startTransition(() => {
      markAllNotificationsRead().catch(() => {});
    });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-hover hover:text-ink"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-[3px] text-[10px] font-semibold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-[10px] border border-border bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
            <span className="text-[14px] font-semibold text-ink">Notifications</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMuted}
                aria-pressed={muted}
                title={muted ? "Unmute notification sound" : "Mute notification sound"}
                className="flex h-6 w-6 items-center justify-center rounded-[4px] text-ink-faint hover:bg-hover hover:text-ink"
              >
                {muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              </button>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="rounded-[4px] px-1.5 py-0.5 text-[12px] font-medium text-ink-muted hover:bg-hover hover:text-ink"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-ink-muted">You&apos;re all caught up.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleSelect(notification)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border-soft px-4 py-3 text-left last:border-0 hover:bg-hover-soft",
                    !notification.is_read && "bg-selected/40"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {!notification.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className="truncate text-[13px] font-medium text-ink">{notification.title}</span>
                  </span>
                  {notification.body && (
                    <span className="truncate pl-3.5 text-[12px] text-ink-muted">{notification.body}</span>
                  )}
                  <span className="pl-3.5 text-[11px] text-ink-faint">{timeAgo(notification.created_at)}</span>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
