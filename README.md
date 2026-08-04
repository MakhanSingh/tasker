# Tasker

Agency project management: clients, projects, tasks, time tracking, invoicing, and files in one place, with three levels of access.

## Access model

| Role | Scope |
| --- | --- |
| **Admin** | Everything. Manages clients, team, projects, invoices, and per-project access. |
| **Member** | Only projects they're assigned to. Their permission is **per project** — a member can be `editor` on one project and `viewer` on another. Sees no rates, budgets, invoices or payments at all. |
| **Client** | Only the specific projects they've been granted. Read-only: project status, tasks, hours (as a rollup), what they've paid and what's still owed, client-visible files, and their sent invoices. |

Authorization lives in **Postgres Row Level Security**, not in application code. Every table has RLS enabled, and the app queries with the user's own session, so the database enforces the same rules no matter which code path runs. UI-level role checks exist only to avoid showing buttons that would fail — they are never the actual boundary.

A member's role on a project and a client's access both come from the single `project_members` table. A client is never granted access implicitly through the `clients` record, so they can't see a sibling project of their own company unless explicitly added.

Reading *names* works differently, and deliberately so (migration 0011): an internal account — admin or member — can read any profile in its own org, because admins are never listed in `project_members` and their comments and time entries would otherwise render as "Unknown" to the whole team. A client account stays limited to people it shares a project with, so a client still never sees the internal roster or another client's people.

## Client grouping

A client **is** the grouping for projects — `projects.client_id` already establishes it, so no separate "group" concept was added. What the UI does with it:

- The sidebar nests projects under their client's name — but **only when that client has more than one project**, since a heading over a single row says nothing the row doesn't. Single-project clients are listed loose at the top, above the headed groups. For admins the heading links to the client's workspace, and a **+** beside the Projects heading starts a new project.
- **`/clients/[id]`** is a workspace rolling all of that client's projects into one set of numbers: projects, open tasks, hours logged (and how many aren't invoiced yet), outstanding, plus each project's task progress and the client's invoices. When logged time hasn't been invoiced, a banner shows how much it's worth with a link straight to invoice creation.
- The clients list shows those same rollups per row — projects, open tasks, hours, uninvoiced value, outstanding — computed in a single pass (`lib/clients/rollup.ts`) rather than one query per client.

Groups *within* a client (phases, retainers) would need a separate `project_groups` table; nothing here assumes one client = one group beyond the sidebar heading.

## Today

**Today** (`/todo`) is the daily working view for admins and team members, styled after Todoist's Today screen: every open task assigned to you, plus a private personal to-do list (call the client back, chase the SOW…), merged by due date — an **Overdue** section on top (with a one-click **Reschedule** that pulls everything overdue to today), then a "27 Jul ‧ Today ‧ Monday" header with today's items and an inline **+ Add task**, then Upcoming groups below.

Overdue needs no nightly job: buckets are computed from the due date on every read, so an unfinished item simply lands in Overdue the next day with its date shown in red. The sidebar counts overdue + due-today items next to **Today**, and lists each project under **My Projects** with its open-task count.

Each task row can be ticked off (marks the task done) or have its timer started right there. Personal to-dos are strictly private — no one else can read them, **including admins** (enforced by owner-only RLS with no admin bypass). Clients have no Today view; the route redirects them away.

## Requirements

Each project has a **Requirements** tab holding the agreed scope — separate from tasks, because a requirement is what was *agreed* and a task is the work done to deliver it.

Each requirement has a MoSCoW priority (must / should / nice to have) and a status: awaiting sign-off → approved or rejected → delivered. Like files and comments, a requirement can be marked internal so it never reaches the client.

Clients see the client-visible requirements and can **Approve** or **Request changes** on anything still awaiting sign-off; the decision records who made it and when, so a later scope dispute can be settled from the record. That approve/reject decision is the only write a client can make anywhere in the app — RLS lets them update a client-visible requirement row, and the Server Action narrows that permission to the status columns alone.

## Files & Links

**Files & Links** is a **read-only roll-up**: everything attached anywhere across the project's tasks and their comments, gathered in one place. Nothing is added from here — you attach a file or a link inside the task it belongs to, and it surfaces here automatically. Each row links back to the task it came from, so this tab answers "where did that spec go?" without you having to remember which card it was on.

Links became task-scoped for that to work (`project_links.task_id`, migration 0017); the column is nullable so links created before it keep working rather than being dropped. A client may add a link to a task exactly as they may attach a file, and on the same condition — it is always client-visible, since an internal link from the client would be one they couldn't see themselves.

Rows are grouped by the **day they were added** (Today, Yesterday, then the date), because that is how people actually hunt for these — "the spec Aisha sent last Tuesday" — rather than by type. **All / Files / Links** tabs narrow by kind, and the search box matches name, person *and* source, so typing "checkout" finds a file whose filename says nothing but which was attached to the checkout task. Search applies before the tab counts, so those numbers describe what picking that tab would actually show.

Only http(s) URLs are accepted (a `javascript:` URL would be stored XSS), and delete is restricted to the creator or an admin. An author the reader can't resolve — an agency admin, to a client — is simply omitted rather than rendered as "Unknown", which would be noise that tells them nothing.

## Tasks and time

Tasks is the first tab on every project — it's where the daily work happens. Every project's Tasks tab offers three layouts, switched from a segmented control:

- **List** — sorted by due date (not grouped by status, which is what the board already does), showing assignee, logged time, comments, priority and due date at a glance. Done tasks sink to the bottom, struck through.
- **Board** — the Trello-style kanban, grouped by status.
- **Calendar** — a month grid with each task on its due date, coloured by priority, plus a "No due date" strip. Month navigation and a Today button.

The chosen view lives in the URL (`?view=calendar&month=2026-08`), so a particular view or month is linkable and survives a reload with no client-side storage. An unknown value falls back to the board.

The task board works like Trello: clicking a card opens it as a modal over the board, and everything for that task lives inside the card — details, **time**, and comments. Each card shows its logged total, comment count, and a green badge when a timer is running on it.

Cards are **draggable** (dnd-kit) — both **between columns** (a status change) and **up and down within a column** (a priority reorder, persisted to `tasks.position`). A drag lifts the card into an overlay that follows the pointer, the target column highlights, and the card lands optimistically before the server action confirms it; on failure the board snaps back and says why. Because one drop can change both the column and the slot, `moveTaskOnBoard` writes the new status and the destination column's order together — a status-only action would leave the card visibly jumping back to its old position.

A 5px activation threshold keeps a click on a card opening the task instead of being swallowed as a drag, and dnd-kit's keyboard sensor makes the same moves reachable without a mouse. Dragging is enabled for every non-client role; the server still enforces that a plain viewer may only move tasks assigned to them, so an unauthorised drop reverts with the error rather than sticking. Clients see the board read-only with nothing draggable.

Opened, a task is a two-column card: title, description, sub-tasks, attachments, time and comments on the left; a field-by-field sidebar (Project, Status, Assignee, Due date, Priority) on the right, each row saving itself the moment you change it — no Save button, title and description save on blur, selects and the date save on change (clicking anywhere on the date opens the calendar). Fields are editable only for admins/managers/editors; everyone else, clients included, sees the same rows as plain text. A trash icon next to the close button deletes the task, shown only to admins/managers — the one role the underlying delete action actually allows. Admins can also move the task to another project from the Project row — the move rewrites the denormalised `project_id` on the task's time entries and files too, is refused while the task has invoiced time (the invoice references it), and drops any assignees who aren't on the target project's team. The sidebar ends with a quiet created/updated record.

The card also carries:

- **Multiple assignees** — assignment lives in a `task_assignees` join table (migration 0009; `tasks.assignee_id` is gone). The sidebar's Assignees row is a checkbox picker with stacked avatars; every "am I the assignee?" rule (status change, sub-task ticks, Today page, the sidebar badge, reschedule) now means "am I *an* assignee", and each newly added person is notified.
- **Sub-tasks** — a checklist (`task_subtasks`, migration 0008) with a progress bar; managers/editors add and delete, the task's assignee can tick items (the same rule as changing status). A separate table rather than self-referencing `tasks`, so boards, calendars and reports never need a "top-level only" filter.
- **Attachments** — drag a screenshot onto the card (or paste, or click to browse) and it uploads immediately; images render as thumbnails, other files as chips, all through the authenticated download route. The New-task dialog stages files the same way and uploads them right after the task is created.
- **Threaded comments** — replies nest under their parent (`parent_id`, migration 0007), with emoji reactions (`comment_reactions`), edit and delete on your own comments (admins can delete anyone's), and screenshots attached per-comment via the same drop/paste/browse trio. Anyone who can comment can attach to their own comment — including clients, whose uploads are always client-visible; attachments on an internal comment stay internal. A client-visible reply under an internal parent surfaces at top level for the client rather than disappearing.

Time lives in the card's right sidebar, next to status and priority: the running total, a start/stop timer for work happening now, and **Add time** for work already done — pick the day, type the hours. A task that took a week is recorded as one row per day, and the entries read back as a work diary. Only one timer can run per person at a time, enforced by a partial unique index in the database rather than by app logic, so a second start is refused rather than silently stopping the first.

Manual entries are anchored at noon UTC on the chosen date. The entry only claims *which day* the work happened on, and noon keeps that day the same in every timezone it's later read from.

There is no billable/non-billable switch. Everything logged is billable — a project that isn't billed simply doesn't get hours logged against it.

A task's URL is real, so a card can be linked or bookmarked — opening it directly (or refreshing) renders the full page instead of the modal, via a Next.js intercepting route.

## The timesheet

The project's **Time** tab is a work diary, in the shape Upwork's timesheet made familiar: four running totals (this week, last week, since start, not yet invoiced), then a month calendar beside the selected week, that week broken down a day per row with a bar in proportion to the busiest day, and the week's value at the project's hourly rate.

The selected week lives in the URL (`?week=2026-07-20&month=2026-07`), so a particular week is linkable and survives a reload with no client-side storage. Picking any date in the calendar selects the week containing it — the week is the unit the diary reports on, so selecting a lone day would promise a view that doesn't exist. Paging the calendar's month keeps the selected week.

Hours are hours: whether they came off the timer or were typed in for a past date is not a distinction anyone reading the diary needs, so there is one bar colour and no legend. Any day with hours expands to the entries behind it: task, note, who, and how long. **Add time** logs a day's work without opening a task, and the task is optional, since general project work (a client call, a planning hour) is a real category `time_entries.task_id` already allows.

Clients get the same diary from the grouped `project_hours_summary` view — hours to look at, never to edit, and never the raw entries or who logged them. On an **hourly** project each task card also shows the client its **Time spent**, day by day, from that same view; on a fixed-budget project it doesn't, because hours aren't what the client is paying for and showing them would invite the reading that the bill moves with the clock.

That view was declared `security_invoker = true`, which made it run under the caller's own permissions — and `time_entries_select` grants a client nothing, so it returned zero rows to precisely the people it exists for. Client hours only ever appeared in the preview mock. Migration 0013 gives it the standard security-definer-view shape: it runs as its owner and does the scoping itself, with `is_admin() or has_project_access(project_id)` in the view body. Below the diary, **By task** and **By person** cover the whole project rather than the selected week, and say so.

## My Time

**My Time** (`/time`) is your own week as a timesheet: a row per project, a column per day, hours in the cells, totals down the side and along the bottom. Today's column is tinted and days that haven't happened yet are greyed, so the shape of the week reads at a glance.

Above it: this week, the week before, and a **daily average** taken over the days actually worked rather than over seven — a four-day week shouldn't read as a slow one. Below it, "What you worked on" lists that week's entries day by day with their task and note, because the grid gives you the totals but not the story.

The week lives in the URL (`?week=2026-07-20`), so a particular week is linkable and survives a reload.

**Rate and Amount columns appear only for admins**, and not because this page checks a role: the rates come from `project_billing`, which team members have no policy on at all, so their query returns nothing, every row's rate is null and the columns aren't rendered. Same for the "Value this week" tile. The confidentiality rule is the database's.

## Billing, and who can see it

A project is billed one of two ways, chosen when it's created:

- **Hourly** — a rate, applied to the hours logged.
- **Fixed budget** — a total, billed against **milestones**. Each milestone has an amount, a due date and a status (not started / in progress / completed).

Both appear on the Time tab as a **Payments** panel: Paid, Pending payment (with the overdue part called out), Not yet invoiced, and either the value of hours or the budget remaining. A fixed project also lists every milestone with its own payment state.

None of those figures are stored. Paid and pending are derived from invoice status on every read, so an admin marking an invoice paid moves the money from Pending to Paid with nothing to keep in sync — and a milestone's payment state comes from the invoice behind its `invoice_line_item_id`, exactly as time entries already work.

The panel also lists **which invoices** the project appears on, each linking through, and the invoice page labels every line with the project it bills for, linking back. One invoice can carry lines for several projects, so the figure shown against each is that project's **share** rather than the invoice total — labelled as such, because a number that looks like the invoice total but isn't would be worse than no number.

**Team members see none of it.** Not the rate, not the budget, not an invoice, not a payment — they log hours and read hours. That is enforced by the database, not by page code: RLS is row-level, so a policy on `projects` could never hide one column from members while showing the row, and a member querying the API with their own token would have read the rate anyway. So the money lives in its own tables — `project_billing` and `project_milestones` (migration 0012) — whose policies name only admins and the project's own client. `getProjectBilling()` returns null for a member because their query comes back empty, and the panel simply isn't there.

The same migration also stops a client reading a **draft** invoice. A draft is a working document, not yet a claim on anyone; the original policy let one show up in the client's list before it had ever been sent.

## One component per surface

Projects, tasks and the task card are the **same components** for every role — never a parallel copy. `NewProjectForm` and `NewTaskDialog` each serve admin and client; `TaskDetailContent` serves all three; the board, list and calendar are shared outright.

The **project form is identical** for an admin and a client, fields included: both are describing the same thing. `variant` picks the server action, not the fields. An admin inserts directly; a client goes through a `SECURITY DEFINER` function, for two reasons — the company is derived from their account rather than trusted from the form (their Client dropdown holds exactly one option, their own, but the posted value is ignored anyway), and the function can write the `project_billing` row without `project_billing_insert` being widened to clients, which would have let them change the rate on an existing project rather than just set one at creation.

The one place two components legitimately remain is the task card's time panel — the team reads `time_entries`, a client reads the grouped `project_hours_summary` view, because RLS gives them no access to the raw entries at all. Only the queries differ; both render through a shared `TaskTimePanel` so the panel itself can't drift.

## What a client can create

A client isn't only a spectator (migration 0014):

- **A project of their own** — a name and a brief, from the same **+** beside Projects that admins use. Which company it belongs to is *derived* from their account, never posted from the form, or a client could file a project under someone else's name. Creating one takes two writes — the project and their membership of it — and a client left holding the first without the second would immediately lose sight of what they just made, so the pair is one `SECURITY DEFINER` function rather than two loosened policies. It creates no `project_billing` row: rates and budgets stay the agency's to agree.
- **A task on a project they're on** — a title, a brief, a priority and a date they need it by, plus attachments: drop a file on the dialog, paste a screenshot, or browse. Never a status (a request starts in To do) and never an assignee, which a client can't see anyway. `tasks_insert` gained `client`; `tasks_update` and `tasks_delete` did not, so moving work across the board stays with the team delivering it.

Both roles use the **same** `NewTaskDialog`, switched by a `variant` prop, reachable from the project board and from the sidebar's **+ Add task** (which carries a project picker, since there's no project in context there — and no Today page for a client to land on). A separate client dialog existed briefly and the first thing it lost was the ability to paste a screenshot, which is the argument for one component rather than two.

Clients can attach files at all only because `files_insert` was widened (migration 0015) — it previously named admins, managers and editors only, which silently broke the documented behaviour of a client replying with a screenshot on a comment. Their uploads are always client-visible: an internal file from the client would be one they couldn't see themselves.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS**
- **Supabase** — Postgres, Auth, and RLS
- **@react-pdf/renderer** for invoice PDFs (no headless browser needed — much lighter on a small VPS than Puppeteer)
- Local filesystem for file storage, behind a `FileStorage` interface so Supabase Storage or S3 can be swapped in later without touching calling code

## Notifications

A bell in the top bar shows unread in-app notifications: a task assigned to you, a comment on your task (or, for clients, any client-visible comment), an invoice sent to your client, or a requirement waiting on your sign-off. Rows are created only by **database triggers** (`supabase/migrations/0006_notifications.sql`) — never by application code — so, like the activity log, a notification can't be silently skipped by a code path that forgot to send one.

The bell polls `/api/notifications` every 20 seconds and plays a short chime **only when the unread count goes up** since the last poll — never on the tab's first load (arriving to unread notifications should be quiet), never from re-fetching what's already showing. The sound itself is synthesised in `lib/notifications/sound.ts` rather than an audio file: two pure sine tones a fifth apart, soft attack, long fade — no harsh harmonics, no click at the edges. A mute toggle in the popover header remembers its state in `localStorage`.

Notifications are strictly personal — RLS has no admin bypass here, same as personal to-dos — and a client only ever gets the two event types meant for them (invoices, requirement sign-off), never internal task chatter.

## Design system

The UI follows a Todoist-inspired system — see **[STYLEGUIDE.md](STYLEGUIDE.md)** for the full palette, type scale and component rules. All tokens are defined once in `src/app/globals.css` under `@theme`; components use named utilities (`text-ink`, `bg-primary`, `border-border`) and never raw hex values or Tailwind's default palettes.

## Preview mode (no database needed)

To walk through the UI before setting up Supabase:

```bash
npm run dev
```

With `PREVIEW_MODE=true` in `.env.local`, the app serves realistic sample data and skips login. An amber **Preview as** switcher in the header flips between the admin, member, and client views — the sample data is scoped per role the same way the RLS policies scope real data, so you can see exactly what each role does and doesn't get.

Writes are disabled in preview mode; saving anything returns a "connect a Supabase project" message. Turn it off by setting `PREVIEW_MODE=false` once your database is set up.

## Setup

### 1. Create a Supabase project

Create one at [supabase.com](https://supabase.com), then copy the API URL and keys from **Project Settings → API**.

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Leave `PREVIEW_MODE=true` for now — flip it last, once the database answers.

`SUPABASE_SERVICE_ROLE_KEY` bypasses every RLS policy. It must never gain a `NEXT_PUBLIC_` prefix; that would ship it to the browser and hand every visitor the whole database.

```bash
npm run check:env
```

Confirms the file is filled in and the keys are the right way round — the publishable key in the public variable, the secret one in the server-only variable. It reports what is wrong with a variable and never what is in it, so its output is safe to paste anywhere.

### 3. Apply the schema

Run every file in `supabase/migrations/` **in filename order**, 0001 through 0019, then `supabase/seed.sql`. Either paste them into the Supabase SQL editor one at a time, or use the CLI, which does the ordering for you:

```bash
npx supabase link --project-ref <your-project-ref> && npx supabase db push
```

The migrations are rehearsed against a real Postgres before they ever reach your project — see [Verifying the schema](#verifying-the-schema) — so this step should be uneventful.

### 4. Create the first admin

```bash
npm run create-admin "Your Name" you@example.com
```

It prompts for the password with echo off. Passing it as an argument is refused: a password on the command line is written verbatim into your shell history and is readable by any other process via `ps`.

Everyone else is invited from inside the app (**Team** for staff, a client's detail page for portal users). There is no public signup: `enable_signup = false` in `supabase/config.toml`, and the invite flows go through the Admin API.

### 5. Check the types still match

```bash
npm run test:drift
```

Do **not** replace `src/types/database.types.ts` with `supabase gen types` output. The status, role and priority columns are `text` with check constraints rather than Postgres enums, so the generator can only type them as `string` — adopting it would erase `ProjectStatus`, `TaskStatus`, `BillingType`, `MilestoneStatus` and `PaymentMethodKind`, turning `Record<ProjectStatus, string>` into `Record<string, string>` and letting a typo compile.

The hand-written file keeps those unions; `test:drift` is what keeps it honest about the columns.

### 6. Turn preview mode off

Set `PREVIEW_MODE=false` in `.env.local` and restart. The **Preview as** switcher disappears on its own, `/login` starts gating, and every query begins going through RLS for real.

```bash
npm run dev
```

### 7. Re-verify access control for real

Preview mode's mock mirrors each RLS policy by hand, which means it can only ever confirm what it was told. Four genuine policy bugs have already been found this way — notifications, the hours view, client file inserts, profile names — each of which looked perfect in the UI while Postgres silently refused the write. Work through [Verifying access control](#verifying-access-control) with real accounts before trusting any of it.

## Verifying the schema

The migrations run against a real Postgres — [PGlite](https://pglite.dev), Postgres compiled to WASM — so no Docker and no local install:

```bash
npm run test:migrations
```

It applies 0001 through 0019 in order plus `seed.sql` to an empty database and fails on the first file that won't run, then checks that every table, view and helper function the app expects exists, that RLS is enabled everywhere, and that no table is left with RLS on and no policy (which denies everyone and reads in the UI as a broken feature). It also catches two migration files sharing a version number, which Supabase records by numeric prefix.

```bash
npm run test:drift
```

`src/types/database.types.ts` is hand-written, and every query in the app is typed by it. A column renamed in SQL but not in the types type-checks perfectly and then returns `undefined` against the real database — the one class of bug a mock-backed dev loop cannot show you. This diffs the types against the schema the migrations actually build.

Both run as part of `npm test`, and neither needs a server.

## Verifying the pages

```bash
npm run test:ui
```

Walks every page as each role and checks that nothing a role shouldn't see
appears in the HTML. It needs a dev server running with **`PREVIEW_MODE=true`**,
because it drives the role with a cookie the mock client reads and addresses
fixture ids.

It refuses to run against anything else, and that guard is the point: with a
real database and no session, every path redirects to `/login` — which is a
legitimate outcome for some routes, so the suite counted them all as passes and
went green having loaded the login page 69 times. A test that cannot fail is
worse than no test, so it now exits loudly instead.

## Verifying access control

RLS is the security boundary, so test it directly rather than trusting the UI. Create one test user per role, then confirm:

- A **client** sees only their own project(s) — no other clients, no internal comments, no raw time entries, no team roster, no admin pages.
- A **member** who is `viewer` on a project can't create or edit its tasks, but can still update the status of a task assigned to them.
- Time entries attached to an invoice can't be edited or deleted until that invoice is voided.

## Phase 1 scope

**Included:** client/project/task CRUD, per-project roles, comments with an internal/client-visible flag, manual + timer time tracking, invoice generation from logged time with PDF export and manual status, file upload/download, activity log, email notifications for task-assigned and invoice-generated, role-based dashboards.

**Deferred:** payment gateway, recurring invoices, multi-tenant signup/billing, Gantt views, custom role builder, multi-currency, real-time in-app notifications.

## Deployment notes

The app is built for a **persistent VPS** (Hostinger). Local file storage assumes the filesystem survives restarts — it would silently lose uploads on a serverless host like Vercel. Note also that Supabase's managed backups cover Postgres only; uploaded files need their own backup strategy on the VPS.

The schema carries an `org_id` on every table even though only one organization exists today, so moving to a multi-tenant SaaS later means adding signup and billing, not reshaping the data.
