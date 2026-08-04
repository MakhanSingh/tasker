"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { updateOwnProfile, type FormState } from "@/app/(dashboard)/settings/actions";
import { initialsOf } from "@/lib/utils/initials";

const initialState: FormState = { error: null };

export function ProfileForm({
  userId,
  fullName,
  email,
  hasAvatar,
}: {
  userId: string;
  fullName: string;
  email: string;
  hasAvatar: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // Bumped after an upload so the img URL changes: the picture lives at one
  // stable path, and without this the browser would re-serve the old one.
  const [avatarVersion, setAvatarVersion] = useState(hasAvatar ? 1 : 0);
  const [state, setState] = useState<FormState>(initialState);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { formRef, formError, field, errorProps } = useFieldErrors(state);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      setState(await updateOwnProfile(initialState, formData));
      router.refresh();
    });
  };

  const uploadAvatar = (file: File) => {
    startTransition(async () => {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setUploadError(data?.error ?? `Upload failed (${res.status})`);
        return;
      }
      setUploadError(null);
      setAvatarVersion((v) => v + 1);
      router.refresh();
    });
  };

  return (
    <form ref={formRef} action={submit} noValidate className="flex max-w-md flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="relative shrink-0">
          {avatarVersion > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element -- an auth-checked route, not a static asset
            <img
              src={`/api/avatar/${userId}?v=${avatarVersion}`}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-avatar text-[20px] font-semibold text-white">
              {initialsOf(fullName)}
            </span>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile picture"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-ink-secondary shadow-sm hover:text-ink"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[14px] font-medium text-ink">Profile picture</p>
          <p className="text-[12px] text-ink-muted">PNG, JPEG, WebP or GIF, up to 2 MB.</p>
          <FormError error={uploadError} className="text-[12px] text-accent" />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAvatar(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="full_name">
          Name
        </Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          required
          {...field("full_name")}
        />
        <FieldError {...errorProps("full_name")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
        <p className="text-xs text-ink-muted">Contact an admin to change your email address.</p>
      </div>


      <FormError error={formError} />
      {state.success && <p className="text-sm text-success">Saved.</p>}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
