"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

// Wraps any content in a drop target: drag a file over it and drop. Pasted
// screenshots (Cmd/Ctrl-V) land too, since "drag and drop a screenshot"
// usually means both in practice. With `clickToBrowse`, clicking the empty
// area opens the file picker — clicks on real controls inside are left alone.
export function FileDropzone({
  onFiles,
  children,
  className,
  accept,
  clickToBrowse = false,
}: {
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
  accept?: string;
  clickToBrowse?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // dragenter/leave fire for every child crossed; counting them is the only
  // reliable way to know when the pointer has actually left the zone.
  const depth = useRef(0);

  const emit = (list: FileList | File[] | null) => {
    const files = [...(list ?? [])].filter((f) => f.size > 0);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      className={cn(
        "relative rounded-[8px] transition-colors",
        dragging && "bg-selected outline-dashed outline-1 outline-primary",
        className
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        emit(e.dataTransfer.files);
      }}
      onPaste={(e) => {
        const files = [...e.clipboardData.files];
        if (files.length > 0) {
          e.preventDefault();
          emit(files);
        }
      }}
      onClick={(e) => {
        if (!clickToBrowse) return;
        // Don't hijack clicks meant for real controls inside the zone.
        if ((e.target as HTMLElement).closest("button, a, input, textarea, select, label")) return;
        inputRef.current?.click();
      }}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
