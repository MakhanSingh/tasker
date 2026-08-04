"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type FieldErrorMap = Record<string, string>;

/** The shape every action returns: a form-level message, and per-field ones. */
export type ActionResult = { error?: string | null; fieldErrors?: FieldErrorMap };

const NONE: ReadonlySet<string> = new Set();

/**
 * The behaviour a field error needs beyond simply being rendered.
 *
 * Showing `state.fieldErrors[name]` under an input covers the easy case and
 * misses four things a form is expected to do:
 *
 *  - **Keep what was typed.** React resets an uncontrolled `<form action={…}>`
 *    once the action returns, so a rejected submit would hand the user an empty
 *    form and ask them to type it all again. That automatic reset is cancelled;
 *    forms that mean to clear call the returned `resetForm()`.
 *  - **Move to the problem.** A message under a control that has scrolled out
 *    of view is an error the user never finds; they see a submit that appears
 *    to do nothing. The first rejected control is focused and scrolled to.
 *  - **Stop nagging.** Once someone starts fixing a field, its old message
 *    contradicts what they are typing, so it goes on the first edit — per
 *    field, not for the whole form.
 *  - **Come back when still wrong.** A fresh submit is a fresh verdict, so
 *    every message the server still returns is shown again, including on
 *    fields the user edited without actually fixing.
 *
 * It also owns `formError`, the bottom-of-form line, so that a message the
 * server pinned to a field is never also printed loose at the bottom.
 *
 * Pass the action's result object — its identity is what marks a new response,
 * so it must come from state, not be rebuilt on each render. Spread
 * `field(name)` onto the control and `errorProps(name)` onto its
 * `<FieldError>`, and put `formRef` on the form.
 */
export function useFieldErrors<T extends HTMLElement = HTMLFormElement>(result?: ActionResult | null) {
  // Generic in the element type because not every form is a <form>: the
  // invoice builder submits from a toolbar outside its fields, so its ref goes
  // on the surrounding element instead.
  const element = useRef<T | null>(null);
  const serverErrors = result?.fieldErrors;

  // The response that produced the current dismissals is kept beside them, so
  // "a new verdict un-dismisses everything" is one state update rather than an
  // effect. An effect would paint the form as valid for a frame before
  // flipping the messages back on.
  const [seen, setSeen] = useState<{
    response?: ActionResult | null;
    edited: ReadonlySet<string>;
    dismissed: boolean;
  }>({ response: result, edited: NONE, dismissed: false });
  if (seen.response !== result) setSeen({ response: result, edited: NONE, dismissed: false });
  const stale = seen.response !== result;
  const edited = stale ? NONE : seen.edited;
  const dismissed = stale ? false : seen.dismissed;

  const errors = useMemo<FieldErrorMap>(() => {
    if (!serverErrors || dismissed) return {};
    if (edited.size === 0) return serverErrors;
    return Object.fromEntries(Object.entries(serverErrors).filter(([name]) => !edited.has(name)));
  }, [serverErrors, edited, dismissed]);

  // The bottom-of-form line only speaks for failures no field owns. When the
  // server named fields, those messages are the whole story and this stays
  // quiet — otherwise the same sentence appeared twice.
  const formError =
    dismissed || Object.keys(serverErrors ?? {}).length > 0 ? null : (result?.error ?? null);

  // React clears an uncontrolled `<form action={…}>` as soon as the action
  // returns — success or failure alike. On a rejected submit that hands the
  // user an empty form and asks them to type it all again, so the automatic
  // reset is cancelled here. A reset event is cancellable by spec, and doing it
  // this way needs no guess about whether React's reset lands before or after
  // this component's effects. Forms that mean to clear call `resetForm()`.
  const intentional = useRef(false);
  const veto = useRef((event: Event) => {
    if (!intentional.current) event.preventDefault();
  });

  // A callback ref, not a plain one: most of these forms live inside a dialog
  // and only mount when it opens, long after a mount effect would have run and
  // found nothing to listen to.
  const formRef = useCallback((node: T | null) => {
    const previous = element.current;
    if (previous instanceof HTMLFormElement) previous.removeEventListener("reset", veto.current);
    element.current = node;
    if (node instanceof HTMLFormElement) node.addEventListener("reset", veto.current);
  }, []);

  /** Clears the form on purpose — the one reset the veto above lets through. */
  const resetForm = useCallback(() => {
    const form = element.current;
    if (!(form instanceof HTMLFormElement)) return;
    intentional.current = true;
    form.reset();
    intentional.current = false;
  }, []);

  useEffect(() => {
    if (!serverErrors || Object.keys(serverErrors).length === 0) return;
    // Read from the DOM rather than from the map: it answers "which rejected
    // control comes first on screen" without this hook needing to know the
    // field order, and it skips names the form doesn't actually render.
    const first = element.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!first) return;
    first.focus({ preventScroll: true });
    first.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [serverErrors]);

  const clear = (name: string) =>
    setSeen((prev) =>
      prev.edited.has(name) ? prev : { ...prev, edited: new Set(prev.edited).add(name) }
    );

  /**
   * Drops every message without waiting for a new response. Dialogs call this
   * as they close: the action state lives in the component that owns the
   * trigger, so it outlives the form, and reopening otherwise showed the error
   * from last time over freshly blank fields.
   */
  const dismissAll = () => setSeen((prev) => (prev.dismissed ? prev : { ...prev, dismissed: true }));

  /** Spread onto the control: marks it invalid, links its message, clears on edit. */
  const field = (name: string) =>
    ({
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
      onChange: () => clear(name),
    }) as const;

  /**
   * Spread onto <FieldError>. Radix selects aren't native inputs, so they take
   * `aria-invalid` from here and call `clear` from their own onValueChange.
   */
  const errorProps = (name: string) => ({ id: `${name}-error`, message: errors[name] });

  return { formRef, errors, formError, field, errorProps, clear, dismissAll, resetForm };
}
