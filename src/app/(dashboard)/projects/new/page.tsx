import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProjectForm } from "@/components/projects/NewProjectForm";

export default async function NewProjectPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">New project</h1>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewProjectForm clients={clients ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
