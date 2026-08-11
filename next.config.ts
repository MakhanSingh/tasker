import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything the app itself answers. Hashed build output is excluded
        // below and keeps its own long cache — that is the only thing here
        // safe for a shared cache to hold.
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          {
            key: "Cache-Control",
            // Aimed at the CDN in front of this app, not at the browser.
            //
            // Next answers one URL two ways: HTML for a document request, and
            // an RSC flight payload for its own router. It keeps them apart
            // with `Vary: RSC`, which works right up until a cache drops the
            // header — Hostinger's rewrites Vary down to `Accept-Encoding`, so
            // both bodies share a key and whichever arrives first is served to
            // everyone. A browser handed flight data as a document renders it
            // as raw text; a router handed HTML where it expects flight fails
            // the navigation outright ("This page couldn't load"). Both were
            // happening on /login, which prerenders with s-maxage of a year and
            // was still serving a copy nearly four days old.
            //
            // Nothing here is cacheable by a shared cache in the first place.
            // Every page is rendered against the caller's own session, so the
            // year-long s-maxage was a hazard well beyond the broken renders:
            // a CDN keyed on URL alone has no way to tell two signed-in people
            // apart.
            value: "private, no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
