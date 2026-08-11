import "server-only";
import { randomInt } from "node:crypto";

// No 0/O, 1/l/I. The whole point of this password is that someone reads it
// down a phone line or retypes it from a WhatsApp message, and those are the
// characters that turn into a failed login and a second phone call.
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A one-off password for an account an admin creates by hand.
 *
 * Grouped into blocks of four because that is how people read a string aloud
 * and how they check they have typed it correctly. 16 characters from a
 * 56-character alphabet is ~93 bits; the hyphens are decoration and are part
 * of the password.
 *
 * `randomInt` rather than `Math.random()`: this is a credential, and it is
 * rejection-sampled so no character is likelier than another.
 */
export function generatePassword(): string {
  const chars = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12), chars.slice(12)]
    .map((block) => block.join(""))
    .join("-");
}
