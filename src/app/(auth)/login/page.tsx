"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/field-error";
import { signIn, type SignInState } from "./actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(signIn, { error: null });

  return (
    <div className="flex min-h-screen items-center justify-center bg-hover-soft px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Tasker</CardTitle>
          <CardDescription>Access is by invitation only — ask your admin for an account.</CardDescription>
        </CardHeader>
        <CardContent>
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
            <FormError error={state.error} />
            <Button type="submit" disabled={isPending} className="mt-2">
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
