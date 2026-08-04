import Link from "next/link";

// The app had no not-found boundary at all, so every notFound() rendered as a
// blank white page — indistinguishable from a crash.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-hover-soft px-4 text-center">
      <p className="text-[15px] font-semibold text-ink">Nothing here</p>
      <p className="max-w-sm text-[13px] text-ink-muted">
        That page doesn&apos;t exist, or it belongs to something you don&apos;t have access to.
      </p>
      <Link href="/" className="text-[14px] font-medium text-accent hover:underline">
        Go to your overview
      </Link>
    </div>
  );
}
