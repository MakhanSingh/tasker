"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { acceptInvite, acceptInviteAsNewUser, type AcceptState } from "@/app/invite/[token]/actions";

const initialState: AcceptState = { error: null };

/**
 * Two ways in, decided by whether there's already a session.
 *
 * Someone signed in just confirms. Someone new sets a name and a password
 * here, because access is invite-only and there is no public signup for them
 * to have used — a valid link is the only thing that can create an account.
 */
export function AcceptInvite({
  token,
  projectName,
  lockedEmail,
  signedInAs,
}: {
  token: string;
  projectName: string;
  /** Set when the link was addressed to one person; the field is then fixed. */
  lockedEmail: string | null;
  signedInAs: string | null;
}) {
  const router = useRouter();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, startJoin] = useTransition();

  const acceptWithToken = acceptInviteAsNewUser.bind(null, token);
  const [state, formAction, isPending] = useActionState(acceptWithToken, initialState);
  const { formRef, formError, field, errorProps } = useFieldErrors(state);

  if (state.projectId) {
    router.replace(`/projects/${state.projectId}`);
  }

  if (signedInAs) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-ink-secondary">
          Signed in as <span className="font-medium text-ink">{signedInAs}</span>.
        </p>
        <Button
          type="button"
          disabled={isJoining}
          onClick={() =>
            startJoin(async () => {
              const result = await acceptInvite(token);
              if (result.error) {
                setJoinError(result.error);
                return;
              }
              router.replace(`/projects/${result.projectId}`);
            })
          }
        >
          {isJoining ? "Joining…" : `Join ${projectName}`}
        </Button>
        <FormError error={joinError} />
        <p className="text-[12px] text-ink-muted">
          Wrong account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in as someone else
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="full_name">
          Your name
        </Label>
        <Input id="full_name" name="full_name" required autoFocus {...field("full_name")} />
        <FieldError {...errorProps("full_name")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="email">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={lockedEmail ?? ""}
          readOnly={!!lockedEmail}
          className={lockedEmail ? "bg-hover-soft text-ink-muted" : undefined}
          {...field("email")}
        />
        <FieldError {...errorProps("email")} />
        {lockedEmail && (
          <p className="text-[12px] text-ink-muted">This invite was issued to this address.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="password">
          Choose a password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          {...field("password")}
        />
        <FieldError {...errorProps("password")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="confirm">
          Type it again
        </Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          {...field("confirm")}
        />
        <FieldError {...errorProps("confirm")} />
      </div>

      <FormError error={formError} />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Joining…" : `Join ${projectName}`}
      </Button>

      <p className="text-[12px] text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>{" "}
        first, then open this link again.
      </p>
    </form>
  );
}
