// Sample data for PREVIEW_MODE — lets the whole UI be walked through before
// a Supabase project exists. Not used when PREVIEW_MODE is off.

const ORG_ID = "00000000-0000-4000-8000-000000000001";

export const PREVIEW_USER_IDS = {
  admin: "10000000-0000-4000-8000-000000000001",
  member: "10000000-0000-4000-8000-000000000002",
  member2: "10000000-0000-4000-8000-000000000003",
  client: "10000000-0000-4000-8000-000000000004",
} as const;

const CLIENT_IDS = {
  acme: "20000000-0000-4000-8000-000000000001",
  nova: "20000000-0000-4000-8000-000000000002",
};

const PROJECT_IDS = {
  website: "30000000-0000-4000-8000-000000000001",
  mobile: "30000000-0000-4000-8000-000000000002",
  dashboard: "30000000-0000-4000-8000-000000000003",
};

const TASK_IDS = {
  homepage: "40000000-0000-4000-8000-000000000001",
  checkout: "40000000-0000-4000-8000-000000000002",
  seo: "40000000-0000-4000-8000-000000000003",
  onboarding: "40000000-0000-4000-8000-000000000004",
  charts: "40000000-0000-4000-8000-000000000005",
  review: "40000000-0000-4000-8000-000000000006",
  rates: "40000000-0000-4000-8000-000000000007",
};

const INVOICE_IDS = {
  paid: "50000000-0000-4000-8000-000000000001",
  sent: "50000000-0000-4000-8000-000000000002",
  draft: "50000000-0000-4000-8000-000000000003",
};

const LINE_IDS = {
  a: "60000000-0000-4000-8000-000000000001",
  b: "60000000-0000-4000-8000-000000000002",
  c: "60000000-0000-4000-8000-000000000003",
  d: "60000000-0000-4000-8000-000000000004",
  e: "60000000-0000-4000-8000-000000000005",
  f: "60000000-0000-4000-8000-000000000006",
};

const MILESTONE_IDS = {
  discovery: "a1000000-0000-4000-8000-000000000001",
  onboarding: "a1000000-0000-4000-8000-000000000002",
  screens: "a1000000-0000-4000-8000-000000000003",
  launch: "a1000000-0000-4000-8000-000000000004",
};

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function dateAgo(n: number) {
  return daysAgo(n).slice(0, 10);
}

function dateAhead(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export const fixtures: Record<string, Record<string, unknown>[]> = {
  organizations: [
    {
      id: ORG_ID,
      name: "Tasker Studio",
      slug: "default",
      invoice_memo: "Thanks for working with us. Payment within 30 days, please.",
      created_at: daysAgo(200),
    },
  ],

  payment_methods: [
    { id: "b1000000-0000-4000-8000-000000000001", org_id: ORG_ID, kind: "bank", label: "HDFC current account", details: "Account name: Tasker Studio\nAccount no: 5010 0123 4567\nIFSC: HDFC0001234", is_default: true, created_at: daysAgo(150), updated_at: daysAgo(150) },
    { id: "b1000000-0000-4000-8000-000000000002", org_id: ORG_ID, kind: "wise", label: "Wise (USD)", details: "Wise account: taskerstudio\nEmail: billing@taskerstudio.com", is_default: false, created_at: daysAgo(120), updated_at: daysAgo(120) },
  ],

  profiles: [
    {
      id: PREVIEW_USER_IDS.admin,
      org_id: ORG_ID,
      role: "admin",
      full_name: "Priya Sharma",
      email: "priya@taskerstudio.com",
      avatar_url: null,
      is_active: true,
      created_at: daysAgo(200),
      updated_at: daysAgo(200),
    },
    {
      id: PREVIEW_USER_IDS.member,
      org_id: ORG_ID,
      role: "member",
      full_name: "Rahul Verma",
      email: "rahul@taskerstudio.com",
      avatar_url: null,
      is_active: true,
      created_at: daysAgo(180),
      updated_at: daysAgo(180),
    },
    {
      id: PREVIEW_USER_IDS.member2,
      org_id: ORG_ID,
      role: "member",
      full_name: "Aisha Khan",
      email: "aisha@taskerstudio.com",
      avatar_url: null,
      is_active: true,
      created_at: daysAgo(120),
      updated_at: daysAgo(120),
    },
    {
      id: PREVIEW_USER_IDS.client,
      org_id: ORG_ID,
      role: "client",
      full_name: "Vikram Mehta",
      email: "vikram@acmeretail.com",
      avatar_url: null,
      is_active: true,
      created_at: daysAgo(90),
      updated_at: daysAgo(90),
    },
  ],

  clients: [
    {
      id: CLIENT_IDS.acme,
      org_id: ORG_ID,
      name: "Acme Retail",
      contact_email: "vikram@acmeretail.com",
      contact_phone: "+91 98200 11223",
      billing_address: "14 MG Road, Bengaluru 560001",
      notes: "Prefers weekly Friday updates.",
      created_at: daysAgo(120),
      updated_at: daysAgo(20),
    },
    {
      id: CLIENT_IDS.nova,
      org_id: ORG_ID,
      name: "Nova Fintech",
      contact_email: "ops@novafintech.io",
      contact_phone: "+91 99100 44556",
      billing_address: "Cyber City, Gurugram 122002",
      notes: null,
      created_at: daysAgo(80),
      updated_at: daysAgo(15),
    },
  ],

  projects: [
    {
      id: PROJECT_IDS.website,
      org_id: ORG_ID,
      client_id: CLIENT_IDS.acme,
      name: "Website Redesign",
      description: "Full rebuild of the storefront with a new design system.",
      status: "active",
      start_date: dateAgo(60),
      end_date: null,
      created_by: PREVIEW_USER_IDS.admin,
      created_at: daysAgo(60),
      updated_at: daysAgo(2),
      last_activity_at: daysAgo(2),
    },
    {
      id: PROJECT_IDS.mobile,
      org_id: ORG_ID,
      client_id: CLIENT_IDS.acme,
      name: "Mobile App",
      description: "iOS and Android companion app.",
      status: "on_hold",
      start_date: dateAgo(40),
      end_date: null,
      created_by: PREVIEW_USER_IDS.admin,
      created_at: daysAgo(40),
      updated_at: daysAgo(10),
      last_activity_at: daysAgo(10),
    },
    {
      id: PROJECT_IDS.dashboard,
      org_id: ORG_ID,
      client_id: CLIENT_IDS.nova,
      name: "Analytics Dashboard",
      description: "Internal reporting dashboard for the ops team.",
      status: "active",
      start_date: dateAgo(30),
      end_date: null,
      created_by: PREVIEW_USER_IDS.admin,
      created_at: daysAgo(30),
      updated_at: daysAgo(1),
      last_activity_at: daysAgo(1),
    },
  ],

  project_members: [
    { id: "70000000-0000-4000-8000-000000000001", project_id: PROJECT_IDS.website, user_id: PREVIEW_USER_IDS.member, project_role: "editor", added_at: daysAgo(55) },
    { id: "70000000-0000-4000-8000-000000000002", project_id: PROJECT_IDS.website, user_id: PREVIEW_USER_IDS.member2, project_role: "manager", added_at: daysAgo(55) },
    { id: "70000000-0000-4000-8000-000000000003", project_id: PROJECT_IDS.website, user_id: PREVIEW_USER_IDS.client, project_role: "client", added_at: daysAgo(50) },
    // Same member, a deliberately different role on a second project.
    { id: "70000000-0000-4000-8000-000000000004", project_id: PROJECT_IDS.mobile, user_id: PREVIEW_USER_IDS.member, project_role: "viewer", added_at: daysAgo(38) },
    { id: "70000000-0000-4000-8000-000000000005", project_id: PROJECT_IDS.dashboard, user_id: PREVIEW_USER_IDS.member2, project_role: "editor", added_at: daysAgo(28) },
    // Same client on a second, fixed-budget project — so both billing models
    // are reachable in the preview.
    { id: "70000000-0000-4000-8000-000000000006", project_id: PROJECT_IDS.mobile, user_id: PREVIEW_USER_IDS.client, project_role: "client", added_at: daysAgo(38) },
  ],

  tasks: [
    // Deliberately past its due date so the overdue carry-forward is visible.
    { id: TASK_IDS.homepage, project_id: PROJECT_IDS.website, title: "Homepage hero section", description: "New hero with seasonal campaign slots.", status: "in_progress", priority: "high", due_date: dateAgo(3), position: 0, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(20), updated_at: daysAgo(1) },
    { id: TASK_IDS.checkout, project_id: PROJECT_IDS.website, title: "Checkout flow rewrite", description: "Reduce steps from five to three.", status: "todo", priority: "urgent", due_date: dateAhead(10), position: 1, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(18), updated_at: daysAgo(3) },
    { id: TASK_IDS.seo, project_id: PROJECT_IDS.website, title: "SEO metadata audit", description: null, status: "done", priority: "medium", due_date: dateAgo(5), position: 2, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(25), updated_at: daysAgo(5) },
    { id: TASK_IDS.onboarding, project_id: PROJECT_IDS.mobile, title: "Onboarding screens", description: "Three-step intro carousel.", status: "in_review", priority: "medium", due_date: dateAhead(7), position: 0, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(30), updated_at: daysAgo(4) },
    { id: TASK_IDS.charts, project_id: PROJECT_IDS.dashboard, title: "Revenue charts", description: "Weekly and monthly breakdowns.", status: "in_progress", priority: "high", due_date: dateAhead(2), position: 0, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(15), updated_at: daysAgo(1) },
    { id: TASK_IDS.review, project_id: PROJECT_IDS.website, title: "Prep the Friday client review", description: null, status: "todo", priority: "medium", due_date: dateAgo(0), position: 3, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(2), updated_at: daysAgo(2) },
    { id: TASK_IDS.rates, project_id: PROJECT_IDS.dashboard, title: "Confirm Q3 rate card with Nova", description: null, status: "todo", priority: "urgent", due_date: dateAgo(0), position: 1, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(3), updated_at: daysAgo(3) },
  ],

  task_assignees: [
    // The homepage task deliberately has TWO assignees to demo multi-assign.
    { id: "e1000000-0000-4000-8000-000000000001", task_id: TASK_IDS.homepage, user_id: PREVIEW_USER_IDS.member, created_at: daysAgo(20) },
    { id: "e1000000-0000-4000-8000-000000000002", task_id: TASK_IDS.homepage, user_id: PREVIEW_USER_IDS.member2, created_at: daysAgo(5) },
    { id: "e1000000-0000-4000-8000-000000000003", task_id: TASK_IDS.checkout, user_id: PREVIEW_USER_IDS.member2, created_at: daysAgo(18) },
    { id: "e1000000-0000-4000-8000-000000000004", task_id: TASK_IDS.seo, user_id: PREVIEW_USER_IDS.member, created_at: daysAgo(25) },
    { id: "e1000000-0000-4000-8000-000000000005", task_id: TASK_IDS.onboarding, user_id: PREVIEW_USER_IDS.member2, created_at: daysAgo(30) },
    { id: "e1000000-0000-4000-8000-000000000006", task_id: TASK_IDS.charts, user_id: PREVIEW_USER_IDS.member2, created_at: daysAgo(15) },
    { id: "e1000000-0000-4000-8000-000000000007", task_id: TASK_IDS.review, user_id: PREVIEW_USER_IDS.member, created_at: daysAgo(2) },
    { id: "e1000000-0000-4000-8000-000000000008", task_id: TASK_IDS.rates, user_id: PREVIEW_USER_IDS.admin, created_at: daysAgo(3) },
  ],

  project_requirements: [
    { id: "c0000000-0000-4000-8000-000000000001", project_id: PROJECT_IDS.website, title: "Responsive storefront on mobile, tablet and desktop", description: "All templates work down to 360px width.", priority: "must_have", status: "approved", is_client_visible: true, position: 0, created_by: PREVIEW_USER_IDS.admin, decided_by: PREVIEW_USER_IDS.client, decided_at: daysAgo(40), created_at: daysAgo(55), updated_at: daysAgo(40) },
    { id: "c0000000-0000-4000-8000-000000000002", project_id: PROJECT_IDS.website, title: "Guest checkout without creating an account", description: "Three steps maximum from cart to confirmation.", priority: "must_have", status: "approved", is_client_visible: true, position: 1, created_by: PREVIEW_USER_IDS.admin, decided_by: PREVIEW_USER_IDS.client, decided_at: daysAgo(40), created_at: daysAgo(55), updated_at: daysAgo(40) },
    { id: "c0000000-0000-4000-8000-000000000003", project_id: PROJECT_IDS.website, title: "Seasonal campaign banner on the homepage", description: "Editable banner slot for festive promotions.", priority: "should_have", status: "proposed", is_client_visible: true, position: 2, created_by: PREVIEW_USER_IDS.member2, decided_by: null, decided_at: null, created_at: daysAgo(6), updated_at: daysAgo(6) },
    { id: "c0000000-0000-4000-8000-000000000004", project_id: PROJECT_IDS.website, title: "Wishlist and saved items", description: "Requested late; likely a phase 2 item.", priority: "nice_to_have", status: "rejected", is_client_visible: true, position: 3, created_by: PREVIEW_USER_IDS.admin, decided_by: PREVIEW_USER_IDS.client, decided_at: daysAgo(10), created_at: daysAgo(20), updated_at: daysAgo(10) },
    { id: "c0000000-0000-4000-8000-000000000005", project_id: PROJECT_IDS.website, title: "Migrate legacy product images to the new CDN", description: "Internal delivery task — not billed separately.", priority: "should_have", status: "delivered", is_client_visible: false, position: 4, created_by: PREVIEW_USER_IDS.member2, decided_by: null, decided_at: null, created_at: daysAgo(30), updated_at: daysAgo(8) },
    { id: "c0000000-0000-4000-8000-000000000006", project_id: PROJECT_IDS.dashboard, title: "Revenue breakdown by week and month", description: null, priority: "must_have", status: "approved", is_client_visible: true, position: 0, created_by: PREVIEW_USER_IDS.admin, decided_by: PREVIEW_USER_IDS.admin, decided_at: daysAgo(25), created_at: daysAgo(28), updated_at: daysAgo(25) },
  ],

  notifications: [
    { id: "e0000000-0000-4000-8000-000000000001", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.member, type: "task_comment", title: "New comment on your task", body: "Client asked to keep the festive banner slot — sizing it at 1440x480.", link: `/projects/${PROJECT_IDS.website}/tasks/${TASK_IDS.homepage}`, entity_type: "task", entity_id: TASK_IDS.homepage, is_read: false, read_at: null, created_at: daysAgo(1) },
    { id: "e0000000-0000-4000-8000-000000000002", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.member, type: "task_assigned", title: "New task assigned to you", body: "Prep the Friday client review", link: `/projects/${PROJECT_IDS.website}/tasks/${TASK_IDS.review}`, entity_type: "task", entity_id: TASK_IDS.review, is_read: false, read_at: null, created_at: daysAgo(2) },
    { id: "e0000000-0000-4000-8000-000000000003", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.member, type: "task_assigned", title: "New task assigned to you", body: "SEO metadata audit", link: `/projects/${PROJECT_IDS.website}/tasks/${TASK_IDS.seo}`, entity_type: "task", entity_id: TASK_IDS.seo, is_read: true, read_at: daysAgo(5), created_at: daysAgo(6) },
    { id: "e0000000-0000-4000-8000-000000000004", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.client, type: "invoice_sent", title: "Invoice INV-0002 is ready", body: "USD 1620.00 · due 2026-07-24", link: `/invoices/${INVOICE_IDS.sent}`, entity_type: "invoice", entity_id: INVOICE_IDS.sent, is_read: false, read_at: null, created_at: daysAgo(20) },
    { id: "e0000000-0000-4000-8000-000000000005", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.client, type: "requirement_signoff", title: "A requirement needs your sign-off", body: "Seasonal campaign banner on the homepage", link: `/projects/${PROJECT_IDS.website}/requirements`, entity_type: "requirement", entity_id: "c0000000-0000-4000-8000-000000000003", is_read: false, read_at: null, created_at: daysAgo(6) },
    { id: "e0000000-0000-4000-8000-000000000006", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.admin, type: "task_comment", title: "New comment on Homepage hero section", body: "Looks great. Can we see a mobile version this week?", link: `/projects/${PROJECT_IDS.website}/tasks/${TASK_IDS.homepage}`, entity_type: "task", entity_id: TASK_IDS.homepage, is_read: true, read_at: daysAgo(1), created_at: daysAgo(1) },
  ],

  personal_todos: [
    { id: "d0000000-0000-4000-8000-000000000001", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.admin, title: "Send Nova Fintech the revised estimate", due_date: dateAgo(2), is_done: false, completed_at: null, position: 0, created_at: daysAgo(4), updated_at: daysAgo(4) },
    { id: "d0000000-0000-4000-8000-000000000002", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.admin, title: "Call Acme about the festive banner sizes", due_date: dateAgo(0), is_done: false, completed_at: null, position: 1, created_at: daysAgo(1), updated_at: daysAgo(1) },
    { id: "d0000000-0000-4000-8000-000000000003", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.admin, title: "Book the team offsite venue", due_date: dateAhead(5), is_done: false, completed_at: null, position: 2, created_at: daysAgo(3), updated_at: daysAgo(3) },
    { id: "d0000000-0000-4000-8000-000000000004", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.admin, title: "Renew the design-tool subscription", due_date: null, is_done: true, completed_at: daysAgo(1), position: 3, created_at: daysAgo(6), updated_at: daysAgo(1) },
    { id: "d0000000-0000-4000-8000-000000000005", org_id: ORG_ID, user_id: PREVIEW_USER_IDS.member, title: "Write up the checkout tech notes", due_date: dateAgo(0), is_done: false, completed_at: null, position: 0, created_at: daysAgo(2), updated_at: daysAgo(2) },
  ],

  project_links: [
    { id: "d2000000-0000-4000-8000-000000000001", org_id: ORG_ID, project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, title: "Figma — homepage mockups", url: "https://figma.com/file/homepage-mockups", is_client_visible: true, created_by: PREVIEW_USER_IDS.member2, created_at: daysAgo(10) },
    { id: "d2000000-0000-4000-8000-000000000002", org_id: ORG_ID, project_id: PROJECT_IDS.website, task_id: TASK_IDS.checkout, title: "Staging site", url: "https://staging.acmeretail.dev", is_client_visible: true, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(6) },
    { id: "d2000000-0000-4000-8000-000000000003", org_id: ORG_ID, project_id: PROJECT_IDS.website, task_id: TASK_IDS.seo, title: "Internal scope sheet", url: "https://docs.google.com/spreadsheets/d/scope", is_client_visible: false, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(4) },
  ],

  task_comments: [
    { id: "80000000-0000-4000-8000-000000000001", task_id: TASK_IDS.homepage, author_id: PREVIEW_USER_IDS.member2, body: "Client asked to keep the festive banner slot — sizing it at 1440x480.", is_internal: false, parent_id: null, created_at: daysAgo(3), updated_at: daysAgo(3) },
    { id: "80000000-0000-4000-8000-000000000002", task_id: TASK_IDS.homepage, author_id: PREVIEW_USER_IDS.admin, body: "Note: their old CMS can't do dynamic slots, so we hardcode for now and revisit in phase 2.", is_internal: true, parent_id: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
    { id: "80000000-0000-4000-8000-000000000003", task_id: TASK_IDS.homepage, author_id: PREVIEW_USER_IDS.client, body: "Looks great. Can we see a mobile version this week?", is_internal: false, parent_id: "80000000-0000-4000-8000-000000000001", created_at: daysAgo(1), updated_at: daysAgo(1) },
    // A reply to the client, and a nested team-side thread under the internal note.
    { id: "80000000-0000-4000-8000-000000000004", task_id: TASK_IDS.homepage, author_id: PREVIEW_USER_IDS.member2, body: "Yes — mobile mock lands Thursday.", is_internal: false, parent_id: "80000000-0000-4000-8000-000000000003", created_at: daysAgo(0), updated_at: daysAgo(0) },
    { id: "80000000-0000-4000-8000-000000000005", task_id: TASK_IDS.homepage, author_id: PREVIEW_USER_IDS.member, body: "Agreed — I'll flag it in the phase 2 scope doc.", is_internal: true, parent_id: "80000000-0000-4000-8000-000000000002", created_at: daysAgo(1), updated_at: daysAgo(1) },
  ],

  comment_reactions: [
    { id: "f0000000-0000-4000-8000-000000000001", comment_id: "80000000-0000-4000-8000-000000000003", user_id: PREVIEW_USER_IDS.admin, emoji: "👍", created_at: daysAgo(1) },
    { id: "f0000000-0000-4000-8000-000000000002", comment_id: "80000000-0000-4000-8000-000000000003", user_id: PREVIEW_USER_IDS.member2, emoji: "👍", created_at: daysAgo(1) },
    { id: "f0000000-0000-4000-8000-000000000003", comment_id: "80000000-0000-4000-8000-000000000001", user_id: PREVIEW_USER_IDS.client, emoji: "❤️", created_at: daysAgo(2) },
  ],

  task_subtasks: [
    { id: "91000000-0000-4000-8000-000000000001", task_id: TASK_IDS.homepage, title: "Desktop layout", is_done: true, position: 0, created_by: PREVIEW_USER_IDS.member2, created_at: daysAgo(6), updated_at: daysAgo(4) },
    { id: "91000000-0000-4000-8000-000000000002", task_id: TASK_IDS.homepage, title: "Mobile layout", is_done: false, position: 1, created_by: PREVIEW_USER_IDS.member2, created_at: daysAgo(6), updated_at: daysAgo(6) },
    { id: "91000000-0000-4000-8000-000000000003", task_id: TASK_IDS.homepage, title: "Festive banner slot QA", is_done: false, position: 2, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(3), updated_at: daysAgo(3) },
  ],

  time_entries: [
    { id: "90000000-0000-4000-8000-000000000001", project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, user_id: PREVIEW_USER_IDS.member, started_at: daysAgo(3), ended_at: daysAgo(3), duration_minutes: 195, description: "Hero layout and responsive pass", is_billable: true, invoice_line_item_id: null, created_at: daysAgo(3) },
    { id: "90000000-0000-4000-8000-000000000002", project_id: PROJECT_IDS.website, task_id: TASK_IDS.seo, user_id: PREVIEW_USER_IDS.member, started_at: daysAgo(6), ended_at: daysAgo(6), duration_minutes: 120, description: "Metadata audit across 40 pages", is_billable: true, invoice_line_item_id: LINE_IDS.a, created_at: daysAgo(6) },
    { id: "90000000-0000-4000-8000-000000000003", project_id: PROJECT_IDS.website, task_id: TASK_IDS.checkout, user_id: PREVIEW_USER_IDS.member2, started_at: daysAgo(2), ended_at: daysAgo(2), duration_minutes: 240, description: "Checkout wireframes", is_billable: true, invoice_line_item_id: null, created_at: daysAgo(2) },
    { id: "90000000-0000-4000-8000-000000000004", project_id: PROJECT_IDS.dashboard, task_id: TASK_IDS.charts, user_id: PREVIEW_USER_IDS.member2, started_at: daysAgo(1), ended_at: daysAgo(1), duration_minutes: 165, description: "Chart component spike", is_billable: true, invoice_line_item_id: null, created_at: daysAgo(1) },
    { id: "90000000-0000-4000-8000-000000000005", project_id: PROJECT_IDS.website, task_id: null, user_id: PREVIEW_USER_IDS.member, started_at: daysAgo(8), ended_at: daysAgo(8), duration_minutes: 45, description: "Weekly sync", is_billable: true, invoice_line_item_id: null, created_at: daysAgo(8) },
    { id: "90000000-0000-4000-8000-000000000006", project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, user_id: PREVIEW_USER_IDS.admin, started_at: daysAgo(5), ended_at: daysAgo(5), duration_minutes: 90, description: "Design review with client", is_billable: true, invoice_line_item_id: null, created_at: daysAgo(5) },
    // One task spread over consecutive days, so the sidebar's work-diary list
    // has something multi-day to render.
    { id: "90000000-0000-4000-8000-000000000009", project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, user_id: PREVIEW_USER_IDS.admin, started_at: daysAgo(4), ended_at: daysAgo(4), duration_minutes: 150, description: "Section spacing pass", is_billable: true, invoice_line_item_id: null, created_at: daysAgo(4) },
    { id: "90000000-0000-4000-8000-000000000010", project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, user_id: PREVIEW_USER_IDS.admin, started_at: daysAgo(2), ended_at: daysAgo(2), duration_minutes: 210, description: "Copy and asset swap", is_billable: true, invoice_line_item_id: null, created_at: daysAgo(2) },
    { id: "90000000-0000-4000-8000-000000000008", project_id: PROJECT_IDS.dashboard, task_id: TASK_IDS.rates, user_id: PREVIEW_USER_IDS.admin, started_at: new Date(Date.now() - 3 * 3600000).toISOString(), ended_at: new Date(Date.now() - 105 * 60000).toISOString(), duration_minutes: 75, description: "Rate card working session", is_billable: true, invoice_line_item_id: null, created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
    // Today, so the diary's default (this week) isn't empty on arrival.
    { id: "90000000-0000-4000-8000-000000000011", project_id: PROJECT_IDS.website, task_id: TASK_IDS.checkout, user_id: PREVIEW_USER_IDS.member2, started_at: new Date(Date.now() - 6 * 3600000).toISOString(), ended_at: new Date(Date.now() - 4 * 3600000).toISOString(), duration_minutes: 120, description: "Step-two form states", is_billable: true, invoice_line_item_id: null, created_at: new Date(Date.now() - 6 * 3600000).toISOString() },
    { id: "90000000-0000-4000-8000-000000000012", project_id: PROJECT_IDS.website, task_id: null, user_id: PREVIEW_USER_IDS.admin, started_at: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(), ended_at: new Date(new Date().setHours(13, 30, 0, 0)).toISOString(), duration_minutes: 90, description: "Sprint planning with Acme", is_billable: true, invoice_line_item_id: null, created_at: daysAgo(0) },
    // A live timer, so the running state is visible in the preview.
    { id: "90000000-0000-4000-8000-000000000007", project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, user_id: PREVIEW_USER_IDS.member, started_at: new Date(Date.now() - 23 * 60000).toISOString(), ended_at: null, duration_minutes: null, description: null, is_billable: true, invoice_line_item_id: null, created_at: new Date(Date.now() - 23 * 60000).toISOString() },
  ],

  invoices: [
    { id: INVOICE_IDS.paid, org_id: ORG_ID, client_id: CLIENT_IDS.acme, invoice_number: "INV-0001", status: "paid", issue_date: dateAgo(45), due_date: dateAgo(15), currency: "USD", subtotal: 4340, tax_amount: 0, total: 4340, notes: "Phase 1 discovery and design.", payment_method_kind: "bank", payment_details: "Account name: Tasker Studio\nAccount no: 5010 0123 4567\nIFSC: HDFC0001234", pdf_path: null, paid_at: daysAgo(12), created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(45), updated_at: daysAgo(12) },
    { id: INVOICE_IDS.sent, org_id: ORG_ID, client_id: CLIENT_IDS.acme, invoice_number: "INV-0002", status: "sent", issue_date: dateAgo(20), due_date: dateAgo(3), currency: "USD", subtotal: 4120, tax_amount: 0, total: 4120, notes: null, payment_method_kind: "bank", payment_details: "Account name: Tasker Studio\nAccount no: 5010 0123 4567\nIFSC: HDFC0001234", pdf_path: null, paid_at: null, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(20), updated_at: daysAgo(20) },
    { id: INVOICE_IDS.draft, org_id: ORG_ID, client_id: CLIENT_IDS.nova, invoice_number: "INV-0003", status: "draft", issue_date: dateAgo(1), due_date: dateAhead(29), currency: "USD", subtotal: 990, tax_amount: 0, total: 990, notes: null, pdf_path: null, paid_at: null, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(1), updated_at: daysAgo(1) },
  ],

  invoice_line_items: [
    { id: LINE_IDS.a, invoice_id: INVOICE_IDS.paid, project_id: PROJECT_IDS.website, line_type: "time", description: "Website Redesign — SEO metadata audit", quantity: 32, unit_price: 45, amount: 1440, created_at: daysAgo(45) },
    { id: LINE_IDS.b, invoice_id: INVOICE_IDS.paid, project_id: null, line_type: "flat_fee", description: "Design system licence", quantity: 1, unit_price: 900, amount: 900, created_at: daysAgo(45) },
    { id: LINE_IDS.c, invoice_id: INVOICE_IDS.sent, project_id: PROJECT_IDS.website, line_type: "time", description: "Website Redesign — Homepage hero section", quantity: 36, unit_price: 45, amount: 1620, created_at: daysAgo(20) },
    { id: LINE_IDS.e, invoice_id: INVOICE_IDS.paid, project_id: PROJECT_IDS.mobile, line_type: "milestone", description: "Mobile App — Discovery & wireframes", quantity: 1, unit_price: 2000, amount: 2000, created_at: daysAgo(45) },
    { id: LINE_IDS.f, invoice_id: INVOICE_IDS.sent, project_id: PROJECT_IDS.mobile, line_type: "milestone", description: "Mobile App — Onboarding flow build", quantity: 1, unit_price: 2500, amount: 2500, created_at: daysAgo(20) },
    { id: LINE_IDS.d, invoice_id: INVOICE_IDS.draft, project_id: PROJECT_IDS.dashboard, line_type: "time", description: "Analytics Dashboard — Revenue charts", quantity: 16.5, unit_price: 60, amount: 990, created_at: daysAgo(1) },
  ],

  files: [
    { id: "a0000000-0000-4000-8000-000000000001", org_id: ORG_ID, project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, uploaded_by: PREVIEW_USER_IDS.member2, file_name: "homepage-mockup-v3.png", storage_path: "preview/homepage.png", mime_type: "image/png", size_bytes: 2411520, storage_provider: "local", is_client_visible: true, comment_id: null, created_at: daysAgo(4) },
    { id: "a0000000-0000-4000-8000-000000000002", org_id: ORG_ID, project_id: PROJECT_IDS.website, task_id: TASK_IDS.seo, uploaded_by: PREVIEW_USER_IDS.admin, file_name: "internal-scope-notes.pdf", storage_path: "preview/scope.pdf", mime_type: "application/pdf", size_bytes: 184320, storage_provider: "local", is_client_visible: false, comment_id: null, created_at: daysAgo(9) },
    { id: "a0000000-0000-4000-8000-000000000003", org_id: ORG_ID, project_id: PROJECT_IDS.dashboard, task_id: TASK_IDS.charts, uploaded_by: PREVIEW_USER_IDS.member2, file_name: "chart-spec.xlsx", storage_path: "preview/spec.xlsx", mime_type: "application/vnd.ms-excel", size_bytes: 51200, storage_provider: "local", is_client_visible: true, comment_id: null, created_at: daysAgo(2) },
    { id: "a0000000-0000-4000-8000-000000000004", org_id: ORG_ID, project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, uploaded_by: PREVIEW_USER_IDS.member2, file_name: "banner-spec.pdf", storage_path: "preview/banner-spec.pdf", mime_type: "application/pdf", size_bytes: 92160, storage_provider: "local", is_client_visible: true, comment_id: "80000000-0000-4000-8000-000000000001", created_at: daysAgo(3) },
    { id: "a0000000-0000-4000-8000-000000000005", org_id: ORG_ID, project_id: PROJECT_IDS.website, task_id: TASK_IDS.checkout, uploaded_by: PREVIEW_USER_IDS.client, file_name: "our-brand-colours.png", storage_path: "preview/brand.png", mime_type: "image/png", size_bytes: 184320, storage_provider: "local", is_client_visible: true, comment_id: "c1000000-0000-4000-8000-000000000002", created_at: daysAgo(0) },
  ],

  activity_log: [
    { id: "b0000000-0000-4000-8000-000000000001", org_id: ORG_ID, actor_id: PREVIEW_USER_IDS.member, entity_type: "project", entity_id: PROJECT_IDS.website, action: "updated", metadata: null, created_at: daysAgo(2) },
    { id: "b0000000-0000-4000-8000-000000000002", org_id: ORG_ID, actor_id: PREVIEW_USER_IDS.admin, entity_type: "project", entity_id: PROJECT_IDS.website, action: "status_changed", metadata: { from: "on_hold", to: "active" }, created_at: daysAgo(7) },
    { id: "b0000000-0000-4000-8000-000000000003", org_id: ORG_ID, actor_id: PREVIEW_USER_IDS.admin, entity_type: "project", entity_id: PROJECT_IDS.website, action: "created", metadata: null, created_at: daysAgo(60) },
    { id: "b0000000-0000-4000-8000-000000000004", org_id: ORG_ID, actor_id: PREVIEW_USER_IDS.member2, entity_type: "project", entity_id: PROJECT_IDS.dashboard, action: "updated", metadata: null, created_at: daysAgo(1) },
  ],

  project_billing: [
    { project_id: PROJECT_IDS.website, billing_type: "hourly", hourly_rate: 45, fixed_budget: null, created_at: daysAgo(60), updated_at: daysAgo(60) },
    { project_id: PROJECT_IDS.mobile, billing_type: "fixed", hourly_rate: null, fixed_budget: 8000, created_at: daysAgo(40), updated_at: daysAgo(40) },
    { project_id: PROJECT_IDS.dashboard, billing_type: "hourly", hourly_rate: 60, fixed_budget: null, created_at: daysAgo(30), updated_at: daysAgo(30) },
  ],

  project_milestones: [
    { id: MILESTONE_IDS.discovery, project_id: PROJECT_IDS.mobile, title: "Discovery & wireframes", description: null, amount: 2000, due_date: dateAgo(30), status: "completed", position: 0, invoice_line_item_id: LINE_IDS.e, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(40), updated_at: daysAgo(30) },
    { id: MILESTONE_IDS.onboarding, project_id: PROJECT_IDS.mobile, title: "Onboarding flow build", description: null, amount: 2500, due_date: dateAgo(10), status: "completed", position: 1, invoice_line_item_id: LINE_IDS.f, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(40), updated_at: daysAgo(10) },
    { id: MILESTONE_IDS.screens, project_id: PROJECT_IDS.mobile, title: "Core app screens", description: "Home, search, profile and settings.", amount: 2500, due_date: dateAhead(14), status: "completed", position: 2, invoice_line_item_id: null, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(40), updated_at: daysAgo(2) },
    { id: MILESTONE_IDS.launch, project_id: PROJECT_IDS.mobile, title: "Store submission", description: null, amount: 1000, due_date: dateAhead(40), status: "pending", position: 3, invoice_line_item_id: null, created_by: PREVIEW_USER_IDS.admin, created_at: daysAgo(40), updated_at: daysAgo(40) },
  ],

  project_hours_summary: [
    { project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, work_date: daysAgo(3), total_minutes: 195, has_billable: true },
    { project_id: PROJECT_IDS.website, task_id: TASK_IDS.seo, work_date: daysAgo(6), total_minutes: 120, has_billable: true },
    { project_id: PROJECT_IDS.website, task_id: TASK_IDS.checkout, work_date: daysAgo(2), total_minutes: 240, has_billable: true },
    { project_id: PROJECT_IDS.dashboard, task_id: TASK_IDS.charts, work_date: daysAgo(1), total_minutes: 165, has_billable: true },
    { project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, work_date: daysAgo(4), total_minutes: 150, has_billable: true },
    { project_id: PROJECT_IDS.website, task_id: TASK_IDS.homepage, work_date: daysAgo(5), total_minutes: 90, has_billable: true },
    { project_id: PROJECT_IDS.website, task_id: TASK_IDS.checkout, work_date: daysAgo(0), total_minutes: 120, has_billable: true },
    { project_id: PROJECT_IDS.website, task_id: null, work_date: daysAgo(0), total_minutes: 90, has_billable: true },
  ],
};

