import "server-only";
import { headers } from "next/headers";

/**
 * The origin to build links people receive: invites, password resets, invoice
 * links, notification emails.
 *
 * This used to be `process.env.APP_URL ?? "http://localhost:3000"`, repeated in
 * four places. On a server where APP_URL wasn't set, every one of them quietly
 * produced a localhost link — and nothing looked wrong until somebody's client
 * received an invitation pointing at their own machine. A fallback that is
 * silently wrong in production is worse than no fallback.
 *
 * So the order is:
 *
 *   1. APP_URL, when set. Explicit wins, and it is the only option that works
 *      from somewhere with no request to read — a cron job, a queue worker.
 *   2. The origin of the request being handled. On this host that is the domain
 *      the person is actually using, which is almost always what a link should
 *      say, and it is right without anybody having to remember to configure it.
 *   3. localhost, and only in development.
 *
 * Deriving from the Host header would matter if these URLs were security
 * boundaries; they aren't. They go into a link in an email to the account
 * holder, APP_URL overrides them wherever it's set, and Supabase independently
 * refuses any redirect target not on its allow list.
 */
export async function getAppUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Can't build an absolute URL: APP_URL is unset and there is no request to read a host from."
    );
  }
  return "http://localhost:3000";
}
