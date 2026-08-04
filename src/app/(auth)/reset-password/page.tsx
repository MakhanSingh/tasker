"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { setNewPassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { error: null };

/**
 * Reached only by following the emailed link, which /auth/callback has already
 * turned into a session. Nothing here checks the token — by the time this
 * renders, that has happened, and a visitor without a valid one has no session
 * and is bounced to /login by the middleware.
 */
export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(setNewPassword, initialState);
  const { formRef, formError, field, errorProps } = useFieldErrors(state);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hover-soft px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            You&apos;ll be signed in straight afterwards — no need to type it again on the sign-in page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label required htmlFor="password">
                New password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoFocus
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

            <Button type="submit" disabled={isPending} className="mt-2">
              {isPending ? "Saving…" : "Save and sign in"}
            </Button>

            <Link href="/login" className="text-center text-[13px] text-ink-muted hover:text-ink">
              Back to sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
