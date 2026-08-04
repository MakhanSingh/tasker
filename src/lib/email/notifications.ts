import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./sendEmail";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

export async function notifyTaskAssigned(params: { taskId: string; assigneeId: string; taskTitle: string; projectId: string }) {
  // Service-role read: the actor assigning a task may have no RLS visibility
  // into the assignee's profile row, but we still need their address.
  const admin = createAdminClient();
  const { data: assignee } = await admin
    .from("profiles")
    .select("email, full_name, is_active")
    .eq("id", params.assigneeId)
    .single();

  if (!assignee?.is_active) return;

  await sendEmail({
    to: assignee.email,
    subject: `New task assigned: ${params.taskTitle}`,
    body: `Hi ${assignee.full_name},

You've been assigned a task: ${params.taskTitle}

View it here: ${appUrl()}/projects/${params.projectId}/tasks/${params.taskId}`,
  });
}

export async function notifyInvoiceGenerated(params: { invoiceId: string; invoiceNumber: string; clientId: string }) {
  const admin = createAdminClient();

  // Notify every client portal user with access to a project of this client.
  const { data: projects } = await admin.from("projects").select("id").eq("client_id", params.clientId);
  const projectIds = (projects ?? []).map((p) => p.id);
  if (projectIds.length === 0) return;

  const { data: memberships } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_role", "client")
    .in("project_id", projectIds);

  const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];
  if (userIds.length === 0) return;

  const { data: recipients } = await admin
    .from("profiles")
    .select("email, full_name")
    .in("id", userIds)
    .eq("is_active", true);

  await Promise.all(
    (recipients ?? []).map((recipient) =>
      sendEmail({
        to: recipient.email,
        subject: `Invoice ${params.invoiceNumber} is available`,
        body: `Hi ${recipient.full_name},

Invoice ${params.invoiceNumber} is now available in your portal.

View it here: ${appUrl()}/invoices/${params.invoiceId}`,
      })
    )
  );
}
