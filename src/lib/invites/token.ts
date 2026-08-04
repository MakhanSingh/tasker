import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getAppUrl } from "@/lib/appUrl";

/**
 * Invite tokens.
 *
 * The raw token is generated here, handed back once so it can be put in a
 * link, and then forgotten. Only its SHA-256 hash is written to the database,
 * for the same reason passwords are hashed: whoever can read the row — a
 * backup, a support query, an over-broad policy added later — must not thereby
 * hold a working invite.
 *
 * A plain hash with no salt is right here and would be wrong for a password.
 * A password is short and guessable, so an attacker with the hashes can grind
 * through candidates; 256 bits of randomness cannot be guessed, so the slow,
 * salted hashing that protects passwords would only make lookup slower without
 * making the token any harder to find.
 */

/** 32 random bytes, URL-safe. Never stored. */
export function generateInviteToken() {
  return randomBytes(32).toString("base64url");
}

/** What actually goes in the database, and what a redemption is looked up by. */
export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function inviteUrl(token: string) {
  return `${await getAppUrl()}/invite/${token}`;
}
