import { z } from "zod";

// Commercials are validated together with the rest of the form but stored in
// project_billing, which team members cannot read (migration 0012).
export const projectStatusSchema = z.enum(["active", "on_hold", "completed", "archived"]);

/** Treats an empty form field as absent rather than as a value to coerce. */
function blankToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === "" || value === null ? undefined : value), schema.optional());
}

export const projectSchema = z
  .object({
    // Optional: an agency's own work — its site, its marketing — belongs to
    // nobody, and filing it under a fictional client was the alternative. A
    // project without one simply can't be invoiced, which is honest: an
    // invoice is addressed to somebody.
    client_id: blankToUndefined(z.uuid("Select a client")),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim().optional(),
    status: projectStatusSchema.default("active"),
    billing_type: z.enum(["hourly", "fixed"]).default("hourly"),
    // An empty number input posts "", and z.coerce.number() turns that into 0
    // — so leaving the rate blank quietly meant "this project bills at zero",
    // and every hour on it would have been invoiced at 0.00. Blank has to mean
    // "not set yet", which is null.
    hourly_rate: blankToUndefined(z.coerce.number().nonnegative("A rate can't be negative")),
    fixed_budget: blankToUndefined(z.coerce.number().nonnegative("A budget can't be negative")),
    start_date: z.string().trim().optional(),
    end_date: z.string().trim().optional(),
  })
  // Keeping only the figure that matches the chosen model means switching an
  // hourly project to fixed can't leave a stale rate behind to be billed by
  // accident later.
  .transform((data) => ({
    ...data,
    hourly_rate: data.billing_type === "hourly" ? data.hourly_rate : undefined,
    fixed_budget: data.billing_type === "fixed" ? data.fixed_budget : undefined,
  }));


export const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  amount: z.coerce.number().nonnegative("Amount can't be negative").default(0),
  due_date: z.string().trim().optional(),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
});

