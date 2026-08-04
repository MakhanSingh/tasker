import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { InvoiceDefaults, type PaymentMethodRow } from "@/components/settings/InvoiceDefaults";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  // Only fetched for admins; payment_methods has no policy for anyone else,
  // so a member's query would come back empty anyway.
  let memo = "";
  let methods: PaymentMethodRow[] = [];
  if (isAdmin) {
    const supabase = await createClient();
    const [{ data: org }, { data: rows }] = await Promise.all([
      supabase.from("organizations").select("invoice_memo").eq("id", profile.org_id).maybeSingle(),
      supabase
        .from("payment_methods")
        .select("id, kind, label, details, is_default")
        .eq("org_id", profile.org_id)
        .order("created_at"),
    ]);
    memo = org?.invoice_memo ?? "";
    methods = (rows ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      details: row.details,
      isDefault: row.is_default,
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            userId={profile.id}
            fullName={profile.full_name}
            email={profile.email}
            hasAvatar={!!profile.avatar_url}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice defaults</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceDefaults memo={memo} methods={methods} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
