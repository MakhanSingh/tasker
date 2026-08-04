"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { changeOwnPassword, type FormState } from "@/app/(dashboard)/settings/actions";

const initialState: FormState = { error: null };

// No "current password" field: Supabase's updateUser works on the caller's
// own live session, so possession of the session is the proof. Asking again
// would look like security without adding any.
export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(changeOwnPassword, initialState);
  const { formRef, formError, field, errorProps } = useFieldErrors(state);

  return (
    <form ref={formRef} action={formAction} noValidate className="flex max-w-md flex-col gap-4">
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
          autoComplete="new-password"
          {...field("password")}
        />
        <FieldError {...errorProps("password")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="confirm">
          Confirm new password
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
      {state.success && <p className="text-sm text-success">Password updated.</p>}

      <div>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Updating…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
