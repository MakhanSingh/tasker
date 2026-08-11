import { z } from "zod";

export const inviteMemberSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  role: z.enum(["admin", "member"]),
});

// Same three fields as an invite. The difference is not what you type, it's
// that the account comes out usable rather than waiting on an email.
export const createMemberSchema = inviteMemberSchema;

export const updateMemberSchema = z.object({
  profile_id: z.uuid(),
  full_name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  role: z.enum(["admin", "member"]),
});

export const projectRoleSchema = z.enum(["manager", "editor", "viewer", "client"]);

export const projectMemberSchema = z.object({
  project_id: z.uuid(),
  user_id: z.uuid(),
  project_role: projectRoleSchema,
});

