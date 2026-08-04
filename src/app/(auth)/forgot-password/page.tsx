"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { error: null };

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);
  const { formRef, formError, field, errorProps } = useFieldErrors(state);

  if (state.sent) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-success" />
            Check your email
          </CardTitle>
          {/* Deliberately not "we sent it to you" — this page doesn't know
              whether that address has an account, and saying so either way
              would answer a question nobody signed in to ask. */}
          <CardDescription>
            If that address belongs to an account, a link to set a new password is on its way. It
            expires in an hour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-[14px] font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Shell>
    );
  }

  return (
    <Shell>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          Type the email you sign in with and we&apos;ll send you a link to set a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label required htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              {...field("email")}
            />
            <FieldError {...errorProps("email")} />
          </div>

          <FormError error={formError} />

          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending ? "Sending…" : "Send the link"}
          </Button>

          <Link href="/login" className="text-center text-[13px] text-ink-muted hover:text-ink">
            Back to sign in
          </Link>
        </form>
      </CardContent>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hover-soft px-4">
      <Card className="w-full max-w-sm">{children}</Card>
    </div>
  );
}
