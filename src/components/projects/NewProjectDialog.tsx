"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NewProjectForm } from "@/components/projects/NewProjectForm";

// The sidebar's "+", identical for both roles — `variant` only decides which
// server action the form posts to. Both redirect to the new project on
// success, which unmounts this dialog, so there's no success state to close
// it from.
export function NewProjectDialog({
  clients = [],
  variant = "admin",
}: {
  clients?: Array<{ id: string; name: string }>;
  variant?: "admin" | "client";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="New project"
          title="New project"
          className="flex h-5 w-5 items-center justify-center rounded-[4px] text-ink-secondary hover:bg-border hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add project</DialogTitle>
        </DialogHeader>
        <NewProjectForm clients={clients} variant={variant} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
