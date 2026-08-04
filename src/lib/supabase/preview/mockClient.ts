import { fixtures, PREVIEW_USER_IDS } from "./fixtures";

export type PreviewRole = "admin" | "member" | "client";

const READ_ONLY_ERROR = {
  message: "Preview mode is read-only. Connect a Supabase project to save changes.",
  code: "PREVIEW_READ_ONLY",
};

type Row = Record<string, unknown>;

// Stands in for RLS: preview data is filtered the same way the database
// policies would filter it, so each role sees a realistic slice.
function scopeRows(table: string, role: PreviewRole): Row[] {
  let all = fixtures[table] ?? [];

  // Personal todos and notifications are owner-only for everyone, admins
  // included — so this has to be decided before the admin sees-everything
  // shortcut below.
  if (table === "personal_todos" || table === "notifications") {
    return all.filter((r) => r.user_id === PREVIEW_USER_IDS[role]);
  }

  if (role === "admin") return all;

  const userId = PREVIEW_USER_IDS[role];
  const memberships = (fixtures.project_members ?? []).filter((m) => m.user_id === userId);
  const projectIds = new Set(memberships.map((m) => m.project_id as string));

  switch (table) {
    case "projects":
      return all.filter((r) => projectIds.has(r.id as string));
    case "project_members":
      return role === "client"
        ? all.filter((r) => r.user_id === userId)
        : all.filter((r) => projectIds.has(r.project_id as string));
    case "tasks":
    case "project_hours_summary":
      return all.filter((r) => projectIds.has(r.project_id as string));
    case "files":
    case "project_links":
    case "project_requirements":
      // Clients only ever see rows explicitly marked client-visible.
      return all.filter(
        (r) =>
          projectIds.has(r.project_id as string) && (role !== "client" || r.is_client_visible === true)
      );
    case "time_entries":
      // Clients get no direct access to raw time entries at all.
      return role === "client" ? [] : all.filter((r) => projectIds.has(r.project_id as string));
    case "payment_methods":
      // Migration 0018: the agency's own banking details are admin-only, and
      // the admin shortcut above already returned. Nobody else reads a row.
      return [];
    case "project_billing":
    case "project_milestones":
      // Matches migration 0012: money is for admins and the project's own
      // client. A member has no policy here at all, so they read nothing —
      // which is what makes the payments panel disappear for them.
      return role === "member" ? [] : all.filter((r) => projectIds.has(r.project_id as string));
    case "task_comments": {
      const visibleTaskIds = new Set(
        (fixtures.tasks ?? []).filter((t) => projectIds.has(t.project_id as string)).map((t) => t.id as string)
      );
      return all.filter(
        (r) => visibleTaskIds.has(r.task_id as string) && (role !== "client" || r.is_internal === false)
      );
    }
    case "task_assignees": {
      const visibleTaskIds = new Set(
        (fixtures.tasks ?? []).filter((t) => projectIds.has(t.project_id as string)).map((t) => t.id as string)
      );
      return all.filter((r) => visibleTaskIds.has(r.task_id as string));
    }
    case "task_subtasks": {
      const visibleTaskIds = new Set(
        (fixtures.tasks ?? []).filter((t) => projectIds.has(t.project_id as string)).map((t) => t.id as string)
      );
      return all.filter((r) => visibleTaskIds.has(r.task_id as string));
    }
    case "comment_reactions": {
      // A reaction is visible exactly when its comment is.
      const visibleCommentIds = new Set(scopeRows("task_comments", role).map((c) => c.id as string));
      return all.filter((r) => visibleCommentIds.has(r.comment_id as string));
    }
    case "clients": {
      const clientIds = new Set(
        (fixtures.projects ?? [])
          .filter((p) => projectIds.has(p.id as string))
          .map((p) => p.client_id as string)
      );
      return all.filter((r) => clientIds.has(r.id as string));
    }
    case "invoices": {
      if (role === "member") return [];
      // A draft hasn't been sent, so it isn't a claim on the client yet —
      // migration 0012 narrowed the policy to match.
      if (role === "client") all = all.filter((r) => r.status !== "draft");
      const clientIds = new Set(
        (fixtures.projects ?? [])
          .filter((p) => projectIds.has(p.id as string))
          .map((p) => p.client_id as string)
      );
      return all.filter((r) => clientIds.has(r.client_id as string));
    }
    case "invoice_line_items": {
      if (role === "member") return [];
      const invoiceIds = new Set(scopeRows("invoices", role).map((i) => i.id as string));
      return all.filter((r) => invoiceIds.has(r.invoice_id as string));
    }
    case "activity_log":
      return role === "client" ? [] : all.filter((r) => projectIds.has(r.entity_id as string));
    case "profiles": {
      // Matches migration 0011: an internal account reads everyone in the
      // org, because admins are never in project_members and their comments
      // and time entries would otherwise show as "Unknown". A client is
      // still limited to people they share a project with, so they never see
      // the internal roster — and never another client's people, since two
      // clients' projects never share a project_id.
      if (role !== "client") return all;

      const peerIds = new Set(
        (fixtures.project_members ?? [])
          .filter((m) => projectIds.has(m.project_id as string))
          .map((m) => m.user_id as string)
      );
      peerIds.add(userId);
      return all.filter((r) => peerIds.has(r.id as string));
    }
    default:
      return all;
  }
}

// Resolves embedded selects like "clients(name)" or "projects(name)" by
// following the obvious foreign key on each row.
const EMBED_FK: Record<string, string> = { clients: "client_id", projects: "project_id" };

function applyEmbeds(rows: Row[], selectString: string): Row[] {
  const embeds = [...selectString.matchAll(/(\w+)\s*\(/g)]
    .map((m) => m[1])
    .filter((name) => name in EMBED_FK);
  if (embeds.length === 0) return rows;

  return rows.map((row) => {
    const enriched = { ...row };
    for (const embed of embeds) {
      const fk = row[EMBED_FK[embed]];
      enriched[embed] = fk ? scopeRows(embed, "admin").find((r) => r.id === fk) ?? null : null;
    }
    return enriched;
  });
}

class MockQuery implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private rows: Row[];
  private selectString = "*";
  private headOnly = false;
  private wantsCount = false;
  private singleMode: "single" | "maybeSingle" | null = null;
  private failure: unknown = null;

  constructor(private table: string, private role: PreviewRole) {
    this.rows = scopeRows(table, role);
  }

  select(selectString = "*", options?: { count?: string; head?: boolean }) {
    this.selectString = selectString;
    if (options?.head) this.headOnly = true;
    if (options?.count) this.wantsCount = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.rows = this.rows.filter((r) => r[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.rows = this.rows.filter((r) => r[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.rows = this.rows.filter((r) => values.includes(r[column]));
    return this;
  }

  is(column: string, value: unknown) {
    this.rows = this.rows.filter((r) => r[column] === value);
    return this;
  }

  not(column: string, _operator: string, value: unknown) {
    this.rows = this.rows.filter((r) => r[column] !== value);
    return this;
  }

  lt(column: string, value: string) {
    this.rows = this.rows.filter((r) => String(r[column]) < value);
    return this;
  }

  gt(column: string, value: string) {
    this.rows = this.rows.filter((r) => String(r[column]) > value);
    return this;
  }

  gte(column: string, value: string) {
    this.rows = this.rows.filter((r) => String(r[column]) >= value);
    return this;
  }

  lte(column: string, value: string) {
    this.rows = this.rows.filter((r) => String(r[column]) <= value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    const ascending = options?.ascending !== false;
    this.rows = [...this.rows].sort((a, b) => {
      const left = String(a[column] ?? "");
      const right = String(b[column] ?? "");
      return ascending ? left.localeCompare(right) : right.localeCompare(left);
    });
    return this;
  }

  limit(count: number) {
    this.rows = this.rows.slice(0, count);
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  // Mutations are rejected wholesale in preview mode; the values passed by
  // callers are irrelevant, so they are simply not read.
  insert() {
    this.failure = READ_ONLY_ERROR;
    return this;
  }

  update() {
    this.failure = READ_ONLY_ERROR;
    return this;
  }

  delete() {
    this.failure = READ_ONLY_ERROR;
    return this;
  }

  then<TResult1 = { data: unknown; error: unknown; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolve() {
    if (this.failure) {
      return { data: null, error: this.failure, count: 0 };
    }

    const count = this.rows.length;
    if (this.headOnly) {
      return { data: null, error: null, count };
    }

    const rows = applyEmbeds(this.rows, this.selectString);

    if (this.singleMode) {
      const row = rows[0] ?? null;
      if (!row && this.singleMode === "single") {
        return { data: null, error: { message: "No rows found", code: "PGRST116" }, count: 0 };
      }
      return { data: row, error: null, count };
    }

    return { data: rows, error: null, count: this.wantsCount ? count : undefined };
  }
}

export function createMockClient(role: PreviewRole) {
  const userId = PREVIEW_USER_IDS[role];

  return {
    from(table: string) {
      return new MockQuery(table, role);
    },
    // Every RPC in this app writes, and preview writes are refused — so it
    // fails the same way an insert does rather than pretending to succeed.
    async rpc() {
      return { data: null, error: READ_ONLY_ERROR };
    },
    auth: {
      async getUser() {
        return { data: { user: { id: userId, email: "" } }, error: null };
      },
      // Changing a password is a write like any other — refused in preview
      // rather than silently appearing to work.
      async updateUser() {
        return { data: { user: null }, error: READ_ONLY_ERROR };
      },
      async signInWithPassword() {
        return { data: null, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
  };
}
