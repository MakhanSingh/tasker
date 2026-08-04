"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom } from "@/components/ui/field-error";
import { z } from "zod";

export type ResetPasswordState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const schema = z.object({
  password: z.string().min(8, "Use at least 8 characters"),
  confirm: z.string().min(1, "Type the password again"),
});

/**
 * Sets the new password.
 *
 * No "current password" field, and that is the point of the whole flow —
 * whoever is here has forgotten it. What stands in for it is the recovery
 * session created by /auth/callback from a code that was emailed to the
 * address on the account. updateUser acts on that session, so the link is the
 * proof, and a stale or forwarded one has no session behind it and reaches
 * nothing.
 */
export async function setNewPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  if (parsed.data.password !== parsed.data.confirm) {
    return {
      error: "The two passwords don't match",
      fieldErrors: { confirm: "The two passwords don't match" },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "This link has expired. Ask for a new one and try again." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  redirect("/?password-changed=1");
}
