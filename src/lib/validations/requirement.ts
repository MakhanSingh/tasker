import { z } from "zod";

// An unchecked checkbox submits nothing at all, so absence means false.
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "true");

export const requirementSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  priority: z.enum(["must_have", "should_have", "nice_to_have"]).default("must_have"),
  is_client_visible: checkbox,
});

export const requirementStatusSchema = z.enum(["proposed", "approved", "rejected", "delivered"]);
