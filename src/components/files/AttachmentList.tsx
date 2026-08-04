import { Paperclip } from "lucide-react";
import { getFileUrlClient } from "@/lib/files/fileUrl";

export type Attachment = {
  id: string;
  file_name: string;
  mime_type: string | null;
};

function isImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}

// Screenshots render inline as thumbnails; everything else is a chip. Both
// open the authenticated download route in a new tab.
export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => isImage(a.mime_type));
  const others = attachments.filter((a) => !isImage(a.mime_type));

  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((file) => (
            <a
              key={file.id}
              href={getFileUrlClient(file.id)}
              target="_blank"
              rel="noreferrer"
              title={file.file_name}
              className="block overflow-hidden rounded-[8px] border border-border hover:border-ink-faint"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated
                  same-origin route; next/image optimization would bypass the
                  cookie-checked download endpoint */}
              <img
                src={getFileUrlClient(file.id)}
                alt={file.file_name}
                className="h-24 w-auto max-w-[200px] object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {others.map((file) => (
            <a
              key={file.id}
              href={getFileUrlClient(file.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-[240px] items-center gap-1.5 rounded-[5px] border border-border px-2 py-1 text-[12px] text-ink-secondary hover:bg-hover-soft hover:text-ink"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-ink-faint" />
              <span className="truncate">{file.file_name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
