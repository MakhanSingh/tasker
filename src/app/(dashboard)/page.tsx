import Link from "next/link";
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileText,
  ListChecks,
  Receipt,
} from "lucide-react";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/dashboard/StatTile";
import { SectionCard, EmptyRow } from "@/components/dashboard/SectionCard";
import { ProjectProgressRow } from "@/components/dashboard/ProjectProgressRow";
import { displayStatus, STATUS_VARIANT } from "@/lib/invoices/status";
import { formatMinutes } from "@/lib/utils/time";
import { formatMoney } from "@/lib/utils/money";
import { bucketFor, formatDueDate, todayKey } from "@/lib/todo/buckets";
import { getMyTaskIds } from "@/lib/tasks/myTasks";
import type { ProjectStatus } from "@/types/database.types";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Monday 00:00 local — the start of "this week" for the hours tile.
function weekStart() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
  return monday;
}

export default async function OverviewPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const today = todayKey();
  const isClient = profile.role === "client";
  const isMember = profile.role === "member";

  // Every query is scoped by RLS, so an admin gets org-wide numbers while a
  // member or client only ever sees their own slice.
  const [{ data: projects }, { data: tasks }, { data: invoices }] = await Promise.all([
    supabase.from("projects").select("id, name, status, updated_at, clients(name)"),
    supabase.from("tasks").select("id, title, status, due_date, project_id"),
    isMember
      ? Promise.resolve({ data: null })
      : supabase.from("invoices").select("id, invoice_number, status, due_date, total, currency, issue_date"),
  ]);

  const allProjects = projects ?? [];
  const allTasks = tasks ?? [];
  const allInvoices = invoices ?? [];

  const openTasks = allTasks.filter((t) => t.status !== "done");
  const myTaskIds = new Set(await getMyTaskIds(supabase, profile.id));
  const myOpenTasks = openTasks.filter((t) => myTaskIds.has(t.id));
  const myOverdue = myOpenTasks.filter((t) => bucketFor(t.due_date, today) === "overdue");
  const myToday = myOpenTasks.filter((t) => bucketFor(t.due_date, today) === "today");

  const outstanding = allInvoices
    .filter((i) => i.status === "sent")
    .reduce((sum, i) => sum + Number(i.total), 0);
  const overdueInvoices = allInvoices.filter((i) => displayStatus(i) === "overdue");
  const currency = allInvoices[0]?.currency ?? "USD";

  // Hours logged this week — personal for team members, whole-project for
  // clients (who never get raw time entries, only the rollup view).
  let weekMinutes = 0;
  if (!isClient) {
    const { data: entries } = await supabase
      .from("time_entries")
      .select("duration_minutes")
      .eq("user_id", profile.id)
      .not("ended_at", "is", null)
      .gte("started_at", weekStart().toISOString());
    weekMinutes = (entries ?? []).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  } else {
    const { data: summary } = await supabase.from("project_hours_summary").select("total_minutes");
    weekMinutes = (summary ?? []).reduce((sum, r) => sum + Number(r.total_minutes), 0);
  }

  const { count: awaitingSignOff } = await supabase
    .from("project_requirements")
    .select("*", { count: "exact", head: true })
    .eq("status", "proposed");

  const doneByProject = new Map<string, number>();
  const totalByProject = new Map<string, number>();
  for (const task of allTasks) {
    totalByProject.set(task.project_id, (totalByProject.get(task.project_id) ?? 0) + 1);
    if (task.status === "done") doneByProject.set(task.project_id, (doneByProject.get(task.project_id) ?? 0) + 1);
  }

  const activeProjects = [...allProjects]
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 5);

  const recentInvoices = [...allInvoices]
    .sort((a, b) => String(b.issue_date).localeCompare(String(a.issue_date)))
    .slice(0, 5);

  const attention: Array<{ label: string; href: string; icon: React.ComponentType<{ className?: string }> }> = [];
  if (!isClient && myOverdue.length > 0) {
    attention.push({
      label: myOverdue.length === 1 ? "1 task of yours is overdue" : `${myOverdue.length} tasks of yours are overdue`,
      href: "/todo",
      icon: AlertTriangle,
    });
  }
  if (!isMember && overdueInvoices.length > 0) {
    attention.push({
      label: `${overdueInvoices.length} ${overdueInvoices.length === 1 ? "invoice is" : "invoices are"} past due`,
      href: "/invoices",
      icon: Receipt,
    });
  }
  if (isClient && (awaitingSignOff ?? 0) > 0) {
    attention.push({
      label: `${awaitingSignOff} ${awaitingSignOff === 1 ? "requirement needs" : "requirements need"} your sign-off`,
      href: "/projects",
      icon: ListChecks,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-2">
      <header>
        <h1 className="text-[26px] font-bold text-ink">
          {greeting()}, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </header>


      {attention.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[10px] border border-warning-border bg-warning-bg p-3">
          {attention.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="flex items-center gap-2 text-[14px] font-medium text-warning hover:underline"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={isClient ? "Your projects" : "Active projects"}
          value={allProjects.filter((p) => p.status === "active").length}
          hint={`${allProjects.length} total`}
          icon={Briefcase}
          tone="primary"
          href="/projects"
        />
        {isClient ? (
          <StatTile label="Open tasks" value={openTasks.length} icon={CheckCircle2} tone="info" />
        ) : (
          <StatTile
            label="Due today"
            value={myToday.length}
            hint={myOverdue.length > 0 ? `${myOverdue.length} overdue` : "Nothing overdue"}
            icon={CalendarClock}
            tone={myOverdue.length > 0 ? "danger" : "info"}
            href="/todo"
          />
        )}
        <StatTile
          label={isClient ? "Hours logged" : "Your hours this week"}
          value={formatMinutes(weekMinutes)}
          icon={Clock}
          tone="success"
          href={isClient ? undefined : "/time"}
        />
        {isMember ? (
          <StatTile label="Your open tasks" value={myOpenTasks.length} icon={CheckCircle2} tone="neutral" href="/todo" />
        ) : (
          <StatTile
            label="Outstanding"
            value={formatMoney(outstanding, currency)}
            hint={overdueInvoices.length > 0 ? `${overdueInvoices.length} past due` : "All on schedule"}
            icon={CircleDollarSign}
            tone={overdueInvoices.length > 0 ? "danger" : "neutral"}
            href="/invoices"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Projects" action={{ label: "View all", href: "/projects" }}>
          {activeProjects.length === 0 ? (
            <EmptyRow>No projects yet.</EmptyRow>
          ) : (
            activeProjects.map((project) => (
              <ProjectProgressRow
                key={project.id}
                project={{
                  id: project.id,
                  name: project.name,
                  status: project.status as ProjectStatus,
                  clientName: isClient ? undefined : project.clients?.name,
                  doneTasks: doneByProject.get(project.id) ?? 0,
                  totalTasks: totalByProject.get(project.id) ?? 0,
                }}
              />
            ))
          )}
        </SectionCard>

        {isMember ? (
          <SectionCard title="Your next tasks" action={{ label: "View all", href: "/todo" }}>
            {[...myOverdue, ...myToday].length === 0 ? (
              <EmptyRow>Nothing due today. Enjoy the clear run.</EmptyRow>
            ) : (
              [...myOverdue, ...myToday].slice(0, 5).map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.project_id}/tasks/${task.id}`}
                  className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-3.5 last:border-0 hover:bg-hover-soft"
                >
                  <span className="truncate text-[14px] text-ink">{task.title}</span>
                  {task.due_date && (
                    <span
                      className={
                        bucketFor(task.due_date, today) === "overdue"
                          ? "shrink-0 text-[12px] font-medium text-accent"
                          : "shrink-0 text-[12px] text-ink-muted"
                      }
                    >
                      {formatDueDate(task.due_date)}
                    </span>
                  )}
                </Link>
              ))
            )}
          </SectionCard>
        ) : (
          <SectionCard title="Invoices" action={{ label: "View all", href: "/invoices" }}>
            {recentInvoices.length === 0 ? (
              <EmptyRow>No invoices yet.</EmptyRow>
            ) : (
              recentInvoices.map((invoice) => {
                const status = displayStatus(invoice);
                return (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-3.5 last:border-0 hover:bg-hover-soft"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[14px] font-medium text-ink">{invoice.invoice_number}</span>
                        <span className="text-[12px] text-ink-faint">Due {formatDueDate(invoice.due_date)}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                      <span className="text-[14px] font-medium text-ink">
                        {formatMoney(invoice.total, invoice.currency)}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
