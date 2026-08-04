"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Hash,
  LayoutDashboard,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import type { ProfileRole, ProjectStatus } from "@/types/database.types";
import { cn } from "@/lib/utils/cn";
import { ProjectRowMenu } from "@/components/projects/ProjectRowMenu";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { NewTaskDialog, SidebarAddTaskTrigger } from "@/components/tasks/NewTaskDialog";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ProfileRole[];
}> = [
  { href: "/", label: "Overview", icon: LayoutDashboard, roles: ["admin", "member", "client"] },
  { href: "/todo", label: "Today", icon: CalendarDays, roles: ["admin", "member"] },
  { href: "/time", label: "My Time", icon: Clock, roles: ["admin", "member"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["admin"] },
  { href: "/team", label: "Team", icon: Users, roles: ["admin"] },
  { href: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "client"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "member", "client"] },
];

const COLLAPSE_KEY = "tasker:projects-collapsed";

export type SidebarProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  /** Newest first; the list arrives already in this order. */
  lastActivityAt: string;
  openCount: number;
  clientId: string | null;
  clientName: string | null;
};

export function Sidebar({
  role,
  dueCount = 0,
  projects,
  clients,
}: {
  role: ProfileRole;
  dueCount?: number;
  projects: SidebarProject[];
  /** For the Add-project dialog; only fetched for admins. */
  clients: Array<{ id: string; name: string }>;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // Collapse state is remembered across reloads. It has to be read after
  // mount rather than during render — localStorage doesn't exist on the
  // server, and seeding state from it would make the markup mismatch.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      window.localStorage.setItem(COLLAPSE_KEY, String(!previous));
      return !previous;
    });
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // A client is the natural grouping for projects, so the list nests under
  // client headings. A client-role user only ever has one, so grouping would
  // be pure noise for them — they get the flat list.
  const groupByClient = role !== "client";
  const byClient = new Map<string, { clientId: string | null; clientName: string; projects: SidebarProject[] }>();
  for (const project of projects) {
    const key = groupByClient ? (project.clientId ?? "none") : "all";
    const existing = byClient.get(key);
    if (existing) {
      existing.projects.push(project);
    } else {
      byClient.set(key, {
        clientId: project.clientId,
        // "Internal", not "Other" — a project with no client is the agency's
        // own work, which is a category, not a leftover.
        clientName: project.clientName ?? "Internal",
        projects: [project],
      });
    }
  }

  // A group is as recent as its most recent project. Without this a busy
  // project could only ever rise within its own heading, and the heading it
  // sits under would stay wherever the alphabet left it — which is most of
  // the point of ordering by activity at all.
  //
  // Insertion order already follows the query, so the first project in each
  // group is its newest.
  const groupRecency = (g: { projects: SidebarProject[] }) =>
    g.projects[0]?.lastActivityAt ?? "";

  // A heading over a single project says nothing the row doesn't already
  // say, so only clients with more than one project get one. The loose
  // projects are listed first — sitting them between headed groups would
  // make them look like they belong to the group above.
  const grouped = groupByClient
    ? [...byClient.values()]
        .filter((g) => g.projects.length > 1)
        .sort((a, b) => groupRecency(b).localeCompare(groupRecency(a)))
    : [];
  const ungrouped = groupByClient
    ? [...byClient.values()].filter((g) => g.projects.length === 1).flatMap((g) => g.projects)
    : projects;

  const renderProject = (project: SidebarProject) => {
    const active = pathname.startsWith(`/projects/${project.id}`);
    return (
      // The row is a link with a menu button beside it rather than a link
      // wrapping one: a button inside an anchor is invalid HTML, and clicking
      // it would navigate as well as open the menu.
      <div
        key={project.id}
        className={cn(
          "group flex items-center gap-1 rounded-[5px] pr-1",
          active ? "bg-selected" : "hover:bg-hover"
        )}
      >
        <Link
          href={`/projects/${project.id}`}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5",
            active ? "text-accent" : "text-ink"
          )}
        >
          <Hash className="h-4 w-4 shrink-0 text-project" />
          <span className="flex-1 truncate">{project.name}</span>
        </Link>
        {project.openCount > 0 && (
          <span className="text-xs text-ink-faint group-hover:hidden">{project.openCount}</span>
        )}
        <ProjectRowMenu
          projectId={project.id}
          projectName={project.name}
          status={project.status}
          isAdmin={role === "admin"}
        />
      </div>
    );
  };

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col overflow-y-auto bg-sidebar px-3 py-4 text-[14px]">
      {/* The account control lives in the top bar now — see UserMenu. */}
      {role !== "client" ? (
        <Link
          href="/todo"
          className="mb-3 flex items-center gap-2 rounded-[5px] px-1 py-1.5 font-medium text-primary hover:bg-hover"
        >
          <span className="flex h-[21px] w-[21px] items-center justify-center rounded-full bg-primary">
            <Plus className="h-3.5 w-3.5 text-white" />
          </span>
          Add task
        </Link>
      ) : (
        // A client gets the same shortcut, but there's no Today page for them
        // to land on — so it opens the dialog with a project picker instead.
        projects.length > 0 && (
          <NewTaskDialog
            variant="client"
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            trigger={<SidebarAddTaskTrigger />}
          />
        )
      )}

      <div className="flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-[5px] px-2 py-1.5",
                active ? "bg-selected text-accent" : "text-ink hover:bg-hover"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-ink-secondary")} />
              <span className="flex-1">{label}</span>
              {href === "/todo" && dueCount > 0 && (
                <span className="text-xs font-medium text-primary">{dueCount}</span>
              )}
            </Link>
          );
        })}
      </div>

      {(projects.length > 0 || role === "admin" || role === "client") && (
        <>
          {/* Always "Projects" — the rows are projects, the client names are
              just the grouping. Calling it "Clients" collides with the nav
              item of that name directly above. */}
          <div className="group mb-1 mt-6 flex items-center justify-between gap-1 rounded-[5px] px-2 py-0.5 hover:bg-hover">
            <span className="text-[13px] font-medium text-ink-secondary">Projects</span>
            <span className="flex items-center gap-0.5">
              {/* Same "+" for both; the form inside is what differs. */}
              {role === "admin" && <NewProjectDialog clients={clients} />}
              {role === "client" && <NewProjectDialog clients={clients} variant="client" />}
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Show projects" : "Hide projects"}
                title={collapsed ? "Show projects" : "Hide projects"}
                className="flex h-5 w-5 items-center justify-center rounded-[4px] text-ink-secondary hover:bg-border hover:text-ink"
              >
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")}
                  strokeWidth={2.25}
                />
              </button>
            </span>
          </div>

          <div className={cn("flex flex-col gap-3", collapsed && "hidden")}>
            {ungrouped.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {ungrouped.map((project) => renderProject(project))}
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.clientId ?? group.clientName} className="flex flex-col gap-0.5">
                {role === "admin" && group.clientId ? (
                  <Link
                    href={`/clients/${group.clientId}`}
                    className="truncate rounded-[5px] px-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-ink-faint hover:bg-hover hover:text-ink-secondary"
                  >
                    {group.clientName}
                  </Link>
                ) : (
                  <span className="truncate px-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                    {group.clientName}
                  </span>
                )}
                {group.projects.map((project) => renderProject(project))}
              </div>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
