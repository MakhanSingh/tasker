// Hand-authored to match supabase/migrations, and deliberately NOT replaced by
// `supabase gen types`: the status, role and priority columns are text with
// check constraints rather than Postgres enums, so the generator can only type
// them as `string` — adopting it would erase ProjectStatus, TaskStatus,
// BillingType and the rest, and let a typo compile. `npm run test:drift` is
// what keeps this file honest about the columns.
//
// `Relationships: []` on every table/view
// and `Functions: {}` on the schema are required by @supabase/postgrest-js's
// GenericSchema/GenericTable constraints — omitting them silently collapses
// query result types to `never` instead of failing loudly.

export type ProfileRole = "admin" | "member" | "client";
export type ProjectRole = "manager" | "editor" | "viewer" | "client";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type RequirementPriority = "must_have" | "should_have" | "nice_to_have";
export type RequirementStatus = "proposed" | "approved" | "rejected" | "delivered";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type InvoiceLineType = "time" | "flat_fee" | "milestone";
export type BillingType = "hourly" | "fixed";
export type MilestoneStatus = "pending" | "in_progress" | "completed";
export type StorageProvider = "local" | "supabase" | "s3";
export type PaymentMethodKind = "bank" | "wise" | "upwork" | "other";
export type NotificationType =
  | "task_assigned"
  | "task_created"
  | "task_completed"
  | "task_comment"
  | "invoice_sent"
  | "requirement_signoff";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string; invoice_memo: string | null; created_at: string };
        Insert: { id?: string; name: string; slug: string; invoice_memo?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          org_id: string;
          kind: PaymentMethodKind;
          label: string;
          details: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          kind: PaymentMethodKind;
          label: string;
          details: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          client_id: string | null;
          id: string;
          org_id: string;
          role: ProfileRole;
          full_name: string;
          email: string;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          org_id: string;
          role: ProfileRole;
          full_name: string;
          email: string;
          /** Which company a portal user belongs to; null for admins and members. */
          client_id?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          is_active: boolean;
          contact_email: string | null;
          contact_phone: string | null;
          billing_address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          billing_address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          client_id: string | null;
          name: string;
          description: string | null;
          status: ProjectStatus;
          start_date: string | null;
          end_date: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          /** Bumped by a trigger whenever anything inside the project changes. */
          last_activity_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          client_id?: string | null;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          start_date?: string | null;
          end_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          last_activity_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      // Money lives apart from `projects` on purpose — RLS is row-level, so a
      // separate table is the only way to keep rates and budgets away from
      // team members. See migration 0012.
      project_billing: {
        Row: {
          project_id: string;
          billing_type: BillingType;
          hourly_rate: number | null;
          fixed_budget: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          billing_type?: BillingType;
          hourly_rate?: number | null;
          fixed_budget?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_billing"]["Row"]>;
        Relationships: [];
      };
      project_milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          amount: number;
          due_date: string | null;
          status: MilestoneStatus;
          position: number;
          invoice_line_item_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          amount?: number;
          due_date?: string | null;
          status?: MilestoneStatus;
          position?: number;
          invoice_line_item_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_milestones"]["Row"]>;
        Relationships: [];
      };
      project_invites: {
        Row: {
          id: string;
          org_id: string;
          project_id: string;
          project_role: ProjectRole;
          token_hash: string;
          email: string | null;
          expires_at: string;
          max_uses: number;
          used_count: number;
          revoked_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          project_id: string;
          project_role: ProjectRole;
          token_hash: string;
          email?: string | null;
          expires_at: string;
          max_uses?: number;
          used_count?: number;
          revoked_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_invites"]["Row"]>;
        Relationships: [];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          project_role: ProjectRole;
          added_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          project_role: ProjectRole;
          added_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_members"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          due_date: string | null;
          position: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_date?: string | null;
          position?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_requirements: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          priority: RequirementPriority;
          status: RequirementStatus;
          is_client_visible: boolean;
          position: number;
          created_by: string | null;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          priority?: RequirementPriority;
          status?: RequirementStatus;
          is_client_visible?: boolean;
          position?: number;
          created_by?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_requirements"]["Row"]>;
        Relationships: [];
      };
      personal_todos: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          title: string;
          due_date: string | null;
          is_done: boolean;
          completed_at: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          title: string;
          due_date?: string | null;
          is_done?: boolean;
          completed_at?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["personal_todos"]["Row"]>;
        Relationships: [];
      };
      task_assignees: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      task_subtasks: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          is_done: boolean;
          position: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          is_done?: boolean;
          position?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_subtasks"]["Row"]>;
        Relationships: [];
      };
      comment_reactions: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      project_links: {
        Row: {
          id: string;
          org_id: string;
          project_id: string;
          task_id: string | null;
          title: string;
          url: string;
          is_client_visible: boolean;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          project_id: string;
          task_id?: string | null;
          title: string;
          url: string;
          is_client_visible?: boolean;
          created_by: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          link: string | null;
          entity_type: string | null;
          entity_id: string | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        // Rows are created by database triggers only.
        Insert: never;
        Update: Partial<Pick<Database["public"]["Tables"]["notifications"]["Row"], "is_read" | "read_at">>;
        Relationships: [];
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          author_id: string;
          body: string;
          is_internal: boolean;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          author_id: string;
          body: string;
          is_internal?: boolean;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_comments"]["Row"]>;
        Relationships: [];
      };
      time_entries: {
        Row: {
          id: string;
          project_id: string;
          task_id: string | null;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          duration_minutes: number | null;
          description: string | null;
          is_billable: boolean;
          invoice_line_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_id?: string | null;
          user_id: string;
          started_at: string;
          ended_at?: string | null;
          duration_minutes?: number | null;
          description?: string | null;
          is_billable?: boolean;
          invoice_line_item_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["time_entries"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          org_id: string;
          client_id: string;
          invoice_number: string;
          status: InvoiceStatus;
          issue_date: string;
          due_date: string;
          currency: string;
          subtotal: number;
          tax_amount: number;
          total: number;
          notes: string | null;
          payment_method_kind: PaymentMethodKind | null;
          payment_details: string | null;
          pdf_path: string | null;
          paid_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          client_id: string;
          invoice_number: string;
          status?: InvoiceStatus;
          issue_date: string;
          due_date: string;
          currency?: string;
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          notes?: string | null;
          payment_method_kind?: PaymentMethodKind | null;
          payment_details?: string | null;
          pdf_path?: string | null;
          paid_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          project_id: string | null;
          line_type: InvoiceLineType;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          project_id?: string | null;
          line_type: InvoiceLineType;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoice_line_items"]["Row"]>;
        Relationships: [];
      };
      files: {
        Row: {
          id: string;
          org_id: string;
          project_id: string | null;
          task_id: string | null;
          comment_id: string | null;
          uploaded_by: string;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          storage_provider: StorageProvider;
          is_client_visible: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          project_id?: string | null;
          task_id?: string | null;
          comment_id?: string | null;
          uploaded_by: string;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_provider?: StorageProvider;
          is_client_visible?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["files"]["Row"]>;
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          org_id: string;
          actor_id: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      project_hours_summary: {
        Row: {
          project_id: string;
          task_id: string | null;
          work_date: string;
          total_minutes: number;
          has_billable: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      // A client starting a project of their own — two writes (the project and
      // their membership of it) done atomically, with the company derived from
      // the caller rather than passed in. See migration 0014.
      create_client_project: {
        Args: {
          p_name: string;
          p_description: string | null;
          p_status: string;
          p_billing_type: string;
          p_hourly_rate: number | null;
          p_fixed_budget: number | null;
          p_start_date: string | null;
          p_end_date: string | null;
        };
        Returns: string;
      };
      // Joining a project from a shareable link. SECURITY DEFINER because the
      // person redeeming is by definition not yet a member, so no RLS policy
      // could authorize the insert for them. See migration 0025.
      redeem_project_invite: {
        Args: { p_token_hash: string };
        Returns: string;
      };
      // What the invite page shows before anyone commits to anything. Returns
      // no row at all for an expired, revoked or spent link.
      peek_project_invite: {
        Args: { p_token_hash: string };
        Returns: Array<{
          project_name: string;
          project_role: ProjectRole;
          client_name: string;
          email: string | null;
        }>;
      };
    };
  };
}
