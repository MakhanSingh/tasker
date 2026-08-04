import { z } from "zod";

// Joining from an invite link with no account yet. The name and password are
// the person's own; the email is checked against the invite when that invite
// was addressed to someone specific.
export const acceptInviteSchema = z.object({
  full_name: z.string().trim().min(1, "Your name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  confirm: z.string().min(1, "Type the password again"),
});
