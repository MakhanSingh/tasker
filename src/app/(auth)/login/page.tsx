"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/field-error";
import { signIn, type SignInState } from "./actions";

/** What /auth/callback sends back when an emailed link doesn't work out. */
const LINK_ERRORS: Record<string, string> = {
  "link-expired": "That link has expired or was already used. Ask for a new one below.",
  "link-invalid": "That link is missing something. Ask for a new one below.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hover-soft px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Tasker</CardTitle>
          <CardDescription>Access is by invitation only — ask your admin for an account.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* useSearchParams opts a component out of prerendering, so it sits
              behind a boundary rather than dragging the whole page with it.
              The form is what matters; a message about a dead link is a detail
              that can arrive a frame later. */}
          <Suspense fallback={<LoginForm linkError={undefined} />}>
            <LoginFormWithLinkError />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginFormWithLinkError() {
  const error = useSearchParams().get("error") ?? "";
  return <LoginForm linkError={LINK_ERRORS[error]} />;
}

function LoginForm({ linkError }: { linkError: string | undefined }) {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(signIn, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="email">
          Email
        </Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="password">
          Password
        </Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormError error={state.error ?? linkError} />
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
      <Link href="/forgot-password" className="text-center text-[13px] text-ink-muted hover:text-ink">
        Forgot your password?
      </Link>
    </form>
  );
}
