# Tasker Style Guide

A Todoist-inspired design system: warm off-white surfaces, near-black ink, one
brand red, and colour used sparingly so it always means something.

Every token lives in **`src/app/globals.css`** under `@theme`. Components use the
named utilities below — **never** raw hex values (`text-[#202020]`) and **never**
Tailwind's default palettes (`text-slate-500`, `bg-emerald-50`). Change a token
once and the whole app follows.

---

## 1. Colour

### Brand

| Token | Hex | Utility | Used for |
| --- | --- | --- | --- |
| `primary` | `#dc4c3e` | `bg-primary`, `text-primary` | Primary buttons, "Add task", nav count badge |
| `primary-hover` | `#c53727` | `hover:bg-primary-hover` | Primary button hover |
| `accent` | `#d1453b` | `text-accent` | Active nav label, overdue dates, red links, inline errors |
| `selected` | `#ffefe5` | `bg-selected` | Peach background of the active sidebar item |

Two reds on purpose: `primary` is for **things you click**, `accent` is for
**text that needs attention**. The darker `accent` keeps small red text legible
where the lighter `primary` would smudge.

### Ink (text)

| Token | Hex | Utility | Used for |
| --- | --- | --- | --- |
| `ink` | `#202020` | `text-ink` | Headings, task titles, body copy |
| `ink-secondary` | `#666666` | `text-ink-secondary` | Form labels, "My Projects" header, nav icons |
| `ink-muted` | `#808080` | `text-ink-muted` | Descriptions, meta, project name on a row |
| `ink-faint` | `#9c9c9c` | `text-ink-faint` | Placeholders, counts, completed text |
| `checkbox` | `#b3b3b3` | `border-checkbox` | Circle-checkbox border |

Four greys is the whole scale. If something needs a fifth, it probably wants an
existing one.

### Surfaces & borders

| Token | Hex | Utility | Used for |
| --- | --- | --- | --- |
| `sidebar` | `#fcfaf8` | `bg-sidebar` | Sidebar, board columns |
| `hover` | `#f2efed` | `hover:bg-hover` | Nav / ghost-button hover, default badge |
| `hover-soft` | `#faf8f6` | `hover:bg-hover-soft` | Row hover on white, outline-button hover |
| `border` | `#e6e6e6` | `border-border` | Cards, inputs, dialogs, section rules |
| `border-soft` | `#f0f0f0` | `border-border-soft` | List-row separators |
| `focus` | `#d9d9d9` | `ring-focus` | Focus rings |

Page background is plain white; the sidebar's warm tint is what separates them —
no border needed between the two.

### Semantic states

| Token | Utility | Used for |
| --- | --- | --- |
| `success` / `success-bg` / `success-border` | `text-success`, `bg-success-bg` | Running timer, success messages, approved badge |
| `warning` / `warning-bg` / `warning-border` | `text-warning`, `bg-warning-bg` | "Timer running elsewhere", preview banner, should-have badge |
| `danger` / `danger-bg` | `text-danger`, `bg-danger-bg` | Rejected / overdue / urgent badges |
| `info` / `info-bg` | `text-info`, `bg-info-bg` | Delivered, medium-priority badges |

### Fixed accents

| Token | Hex | Used for |
| --- | --- | --- |
| `project` | `#2e7d8c` | The `#` before every project name |
| `avatar` | `#0f766e` | User-initials circle |

---

## 2. Typography

### Font family

The same system stack Todoist ships — set once on `body`, inherited everywhere.
Deliberately **not** a webfont, so text renders natively on every platform and
there is no font file to download.

```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
"Helvetica Neue", Arial, "Noto Sans", sans-serif
```

`font-mono` is used in exactly one place: the running-timer clock, so the digits
don't jitter as they tick.

### Scale

| Size | Utility | Weight | Used for |
| --- | --- | --- | --- |
| 26px | `text-[26px]` | `font-bold` | Page title ("Today") |
| 24px | `text-2xl` | `font-semibold` | Project name, big stat numbers |
| 16px | `text-base` | `font-bold` | Card titles |
| 14px | `text-sm` / `text-[14px]` | regular / `font-semibold` | **Body default.** Task titles, nav items, buttons; semibold for section headers ("Overdue") |
| 13px | `text-[13px]` | `font-medium` | Form labels, "My Projects", helper text |
| 12px | `text-[12px]` / `text-xs` | regular / `font-medium` | Badges, meta, dates, counts |

14px is the workhorse — most of the app is 14px regular in `ink`. Anything
smaller is supporting information and should be `ink-muted` or lighter.

**Weights**: only three — regular (400), `font-medium` (500) for labels and
badges, `font-semibold`/`font-bold` for headings. No light or black weights.

---

## 3. Shape & spacing

- **Radius**: `rounded-[5px]` for controls (buttons, inputs, badges, nav items),
  `rounded-[10px]` for containers (cards, the inline add-task form),
  `rounded-full` for circle checkboxes and avatars.
- **Borders over shadows**: cards use a 1px `border` and no shadow. Shadow is
  reserved for things that float — dialogs and dropdowns.
- **Row rhythm**: list rows are `py-2.5` separated by `border-border-soft`, with
  the last row's border removed (`last:border-0`).
- **Page width**: focused reading views (Today) cap at `max-w-3xl`; dashboards
  and boards run full width.

---

## 4. Components

### Button (`components/ui/button.tsx`)

| Variant | Look | Use for |
| --- | --- | --- |
| `default` | Solid red | The one primary action per view |
| `outline` | White, `border`, ink text | Secondary actions (Void, Cancel) |
| `ghost` | Transparent, `hover:bg-hover` | Tertiary / icon actions |
| `destructive` | Solid dark red | Irreversible deletes |
| `link` | `accent` text, underline on hover | Inline text actions |

Sizes: `sm` (h-8) for inline/row actions, `default` (h-9) for forms, `lg` (h-10)
rarely. `icon` for square icon-only buttons.

### Badge (`components/ui/badge.tsx`)

Low-chrome chips: tinted background, matching text, `text-[12px] font-medium`.
Kept deliberately quiet — Todoist reserves saturated colour for dates and the
brand red, so status pills never compete with the task title.

### Card (`components/ui/card.tsx`)

`rounded-[10px]`, 1px `border`, white, `p-5`. Title is `text-base font-bold`.
For list content, pass `className="p-0"` to `CardContent` so rows can own their
own padding and run edge-to-edge.

### Rows (task, todo, requirement, file, time entry)

Circle checkbox (18px) → title + optional description → right-aligned meta.
Hover-only affordances (delete, start-timer) use
`opacity-0 group-hover:opacity-100` on a `group` parent, keeping rows calm at
rest.

### Inputs

`h-9`, `rounded-[5px]`, 1px `border`, `placeholder:text-ink-faint`. Focus
darkens the border and adds a 1px `focus` ring — no heavy glow. `aria-invalid`
turns the border `accent`; `Input` and `SelectTrigger` carry that themselves, so
nothing needs to pass a red class.

### Validation

Every form uses the same three pieces:

- `<Label required>` — appends a red `*`. It's `aria-hidden`; the input's own
  `required` is what a screen reader announces.
- `useFieldErrors(state)` (`hooks/useFieldErrors.ts`) — pass the whole action
  result, since its identity is what marks a new response. Spread `field(name)`
  onto the control and `errorProps(name)` onto its `<FieldError>`. It focuses
  the first rejected control, drops a message when its own field is edited, and
  cancels React's automatic form reset so a failed submit doesn't wipe what was
  typed.
- `<FormError error={formError} />` — the bottom line, for failures no field
  owns. Feed it the hook's `formError`, never the action's raw `error`, or a
  field message prints twice.

Actions return `fieldErrors` from `fieldErrorsFrom(parsed.error.issues)`, keyed
by input name. Forms carry `noValidate` so our messages, not the browser's
tooltips, are what people see.

---

## 5. Rules of thumb

1. **Use tokens, never raw colours.** If you're typing a `#`, add a token instead.
2. **Colour means something.** Red = act or attend. Green = running/approved.
   Amber = caution. Everything else is grey.
3. **One primary button per view.** Everything else is outline or ghost.
4. **Default to 14px regular `ink`.** Reach for a different size or weight only
   when hierarchy genuinely demands it.
5. **Borders, not shadows**, except for floating layers.
6. **Locale-fixed dates.** Always pass an explicit locale (`en-GB`) to
   `toLocaleDateString` — an implicit locale renders differently on server and
   client and breaks hydration. Use `formatDueDate()` from `lib/todo/buckets.ts`
   for Todoist-style short dates.
