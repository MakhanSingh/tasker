"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type ForgotPasswordState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  sent?: boolean;
};

const schema = z.object({ email: z.email("Enter a valid email") });

/**
 * Starts a password reset.
 *
 * The answer is the same whether or not that email has an account: "if it's
 * one of ours, a link is on its way". Saying "no account with that email"
 * would turn this form into a way of asking which of your clients and staff
 * are in the system, from a page that needs no login to reach.
 *
 * Supabase sends the mail and owns the token; nothing here generates or stores
 * one. The link carries a code that /auth/callback exchanges for a short-lived
 * session, which is what lets the person set a new password without knowing
 * the old one.
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a valid email",
      fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email" },
    };
  }

  const supabase = await createClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email.trim().toLowerCase(), {
    redirectTo: `${appUrl.replace(/\/$/, "")}/auth/callback?next=/reset-password`,
  });

  // Rate limits and outages are worth reporting — they mean "try later",
  // not "you got the address wrong". An unknown address isn't an error here
  // and Supabase doesn't treat it as one either.
  if (error && error.status !== 400) {
    return { error: "Couldn't send the email just now. Try again in a minute." };
  }

  return { error: null, sent: true };
}
