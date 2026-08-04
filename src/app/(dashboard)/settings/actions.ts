"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null; success?: boolean;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  avatar_url: z.string().trim().optional(),
});

export async function updateOwnProfile(_prevState: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      ...(parsed.data.avatar_url ? { avatar_url: parsed.data.avatar_url } : {}),
    })
    .eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "The two passwords don't match",
    path: ["confirm"],
  });

/**
 * Changes the signed-in user's own password.
 *
 * Supabase's updateUser acts on the caller's session, so there is no user id
 * to pass and therefore no way for this to touch anybody else's account.
 */
export async function changeOwnPassword(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireProfile();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { error: null, success: true };
}

// ---------------------------------------------------------------------------
// Invoice defaults — admin only, matching payment_methods' RLS. The
// requireAdmin() calls give a readable error; the policies are the real gate.
// ---------------------------------------------------------------------------

export async function updateInvoiceMemo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const memo = String(formData.get("invoice_memo") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ invoice_memo: memo || null })
    .eq("id", admin.org_id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null, success: true };
}

const paymentMethodSchema = z.object({
  kind: z.enum(["bank", "wise", "upwork", "other"]),
  label: z.string().trim().min(1, "Give it a name"),
  details: z.string().trim().min(1, "Add the details a client needs to pay"),
  is_default: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export async function addPaymentMethod(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = paymentMethodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();

  // A partial unique index allows only one default per org, so the old one
  // has to step down first rather than the insert failing.
  if (parsed.data.is_default) {
    await supabase.from("payment_methods").update({ is_default: false }).eq("org_id", admin.org_id);
  }

  const { error } = await supabase.from("payment_methods").insert({
    org_id: admin.org_id,
    kind: parsed.data.kind,
    label: parsed.data.label,
    details: parsed.data.details,
    is_default: parsed.data.is_default,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null, success: true };
}

export async function setDefaultPaymentMethod(methodId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  await supabase.from("payment_methods").update({ is_default: false }).eq("org_id", admin.org_id);
  const { error } = await supabase.from("payment_methods").update({ is_default: true }).eq("id", methodId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function deletePaymentMethod(methodId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("payment_methods").delete().eq("id", methodId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}
