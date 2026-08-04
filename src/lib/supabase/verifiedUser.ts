/**
 * The header the middleware uses to pass the id it has already verified to
 * whatever renders next.
 *
 * Its own file because both the middleware and the server-side profile lookup
 * need the name, and the middleware runs in a context that must not pull in
 * anything React-flavoured.
 *
 * Trustworthy only because the middleware sets it on every request it handles,
 * overwriting whatever arrived. A route the middleware does not cover will not
 * have it, and the lookup falls back to asking properly.
 */
export const VERIFIED_USER_HEADER = "x-verified-user-id";
