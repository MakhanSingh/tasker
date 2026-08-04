import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  contact_email: z.union([z.literal(""), z.email()]).optional(),
  contact_phone: z.string().trim().optional(),
  billing_address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

