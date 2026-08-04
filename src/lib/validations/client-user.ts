import { z } from "zod";

// A client-role portal login, distinct from the `clients` company record.
// Created from a client's detail page, then granted access to specific
// projects via project_members (project_role = 'client').
export const inviteClientUserSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
});

