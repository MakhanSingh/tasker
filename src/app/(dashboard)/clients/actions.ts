"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { clientSchema } from "@/lib/validations/client";
import { inviteClientUserSchema } from "@/lib/validations/client-user";
import { inviteUser, InviteUserError } from "@/lib/auth/inviteUser";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null; success?: boolean;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

export async function createClientRecord(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clients").insert({ ...parsed.data, org_id: admin.org_id });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  return { error: null, success: true };
}

export async function updateClientRecord(clientId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", clientId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { error: null, success: true };
}

export async function inviteClientUser(clientId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = inviteClientUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  try {
    await inviteUser({
      email: parsed.data.email,
      fullName: parsed.data.full_name,
      role: "client",
      orgId: admin.org_id,
      clientId,
    });
  } catch (err) {
    if (err instanceof InviteUserError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath(`/clients/${clientId}`);
  return { error: null, success: true };
}

// Retiring a client, not erasing it. Archived clients drop out of the pickers
// and the default list but keep every project and invoice attached to them —
// an ex-client's billing history is exactly the thing you get asked about a
// year later.
export async function setClientActive(clientId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clients").update({ is_active: isActive }).eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

// Only for a client nothing points at — a mistyped record created minutes ago.
// A database trigger refuses the rest and says why, so this can't be worked
// around by calling it from somewhere else.
export async function deleteClientRecord(clientId: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
}
