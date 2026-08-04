"use client";

import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

// Trello-style: the board stays mounted behind the card. Dismissing pops the
// history entry the card push created, so Esc, the backdrop and the browser
// back button all behave the same way.
export function TaskModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && router.back()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 sm:p-8">
          <DialogPrimitive.Content className="relative mx-auto w-full max-w-3xl rounded-lg border border-border bg-white p-6 shadow-xl focus:outline-none">
            <DialogPrimitive.Title className="sr-only">Task details</DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="absolute right-4 top-4 rounded-sm text-ink-faint hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
