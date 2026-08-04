import { z } from "zod";
import { isSupportedCurrency } from "@/lib/invoices/currencies";

export const generateInvoiceSchema = z.object({
  client_id: z.uuid("Select a client"),
  project_ids: z.array(z.uuid()).min(1, "Select at least one project"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().min(1, "Due date is required"),
  notes: z.string().trim().optional(),
});

export const flatFeeLineSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit_price: z.coerce.number().nonnegative("Unit price can't be negative"),
});

// The invoice builder posts its whole form as one JSON payload rather than
// flat FormData: line items are a repeating group, and Object.fromEntries
// collapses repeats.
export const invoiceDraftSchema = z.object({
  client_id: z.uuid("Pick a client"),
  invoice_number: z.string().trim().min(1, "The invoice needs a number").max(40),
  payment_method_kind: z.enum(["bank", "wise", "upwork", "other"]).optional(),
  payment_details: z.string().trim().max(2000).optional(),
  project_id: z.union([z.literal(""), z.uuid()]).optional(),
  currency: z.string().refine(isSupportedCurrency, "Unsupported currency"),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an issue date"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date"),
  notes: z.string().trim().max(2000).optional(),
  send: z.boolean().default(false),
  line_items: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Every line needs a description"),
        quantity: z.coerce.number().positive("Quantity must be above zero"),
        unit_price: z.coerce.number().nonnegative("Rate can't be negative"),
        // Present only on lines pulled from logged time. Saving stamps these
        // entries so the same hours can never be billed twice.
        project_id: z.union([z.literal(""), z.uuid()]).optional(),
        entry_ids: z.array(z.uuid()).optional(),
      })
    )
    .min(1, "Add at least one line"),
});

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>;
