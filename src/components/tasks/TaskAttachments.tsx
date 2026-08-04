"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { FileDropzone } from "@/components/files/FileDropzone";
import { AttachmentList, type Attachment } from "@/components/files/AttachmentList";
import { uploadFiles } from "@/lib/files/uploadClient";
import { FormError } from "@/components/ui/field-error";

// Task-level attachments: thumbnails/chips plus a drop target. Upload is
// immediate on drop — there's nothing else to "save" on an existing task.
export function TaskAttachments({
  projectId,
  taskId,
  attachments,
  canUpload,
}: {
  projectId: string;
  taskId: string;
  attachments: Attachment[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canUpload && attachments.length === 0) return null;

  const handleFiles = (files: File[]) => {
    setError(null);
    startTransition(async () => {
      const err = await uploadFiles({ projectId, taskId, files });
      if (err) setError(err);
      router.refresh();
    });
  };

  const body = (
    <div className="flex flex-col gap-2">
      <AttachmentList attachments={attachments} />
      {canUpload && (
        <div className="flex items-center gap-2 rounded-[8px] border border-dashed border-border px-3 py-2.5 text-[13px] text-ink-muted">
          <ImagePlus className="h-4 w-4 shrink-0 text-ink-faint" />
          {isPending ? "Uploading…" : "Drop a screenshot here, paste one, or click to browse"}
        </div>
      )}
      <FormError error={error} />
    </div>
  );

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Attachments{" "}
        {attachments.length > 0 && <span className="font-normal normal-case text-ink-faint">{attachments.length}</span>}
      </h3>
      {canUpload ? (
        <FileDropzone onFiles={handleFiles} clickToBrowse>
          {body}
        </FileDropzone>
      ) : (
        body
      )}
    </section>
  );
}
