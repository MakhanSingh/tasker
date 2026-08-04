/**
 * A validation message for one field, rendered directly beneath it.
 *
 * `role="alert"` so a screen reader announces it when it appears, and the `id`
 * is meant to be referenced by the input's `aria-describedby` — otherwise the
 * message is visible but never reaches anyone not looking at that spot.
 */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[12px] text-accent">
      {message}
    </p>
  );
}

/**
 * The form-level error line, for failures that belong to no single field —
 * a rejected permission, a duplicate invoice number, a database error.
 *
 * Feed it `formError` from useFieldErrors, not the action's raw `error`: an
 * action returns both the summary and the per-field map, and printing both put
 * the same sentence under the offending input *and* again at the bottom of the
 * form, where it read as a second, unrelated problem. The hook decides when
 * this line has something of its own to say.
 */
export function FormError({
  error,
  className = "text-sm text-accent",
}: {
  error?: string | null;
  className?: string;
}) {
  if (!error) return null;
  return (
    <p role="alert" className={className}>
      {error}
    </p>
  );
}

/** Zod's issues, flattened to one message per field for the form to read. */
export function fieldErrorsFrom(
  issues: Array<{ path: Array<string | number | symbol>; message: string }>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    // The first message per field wins — a stack of messages on one input is
    // noise, and the first is the one the reader needs to act on.
    const key = issue.path.map(String).join(".");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
