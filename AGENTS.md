
# RULES

- `bun fix` must always pass
- only use arrow functions
- all exports must be at end of file
- if a `.tsx` file only exports a single component, use `export default`
- `bun ts-unused-exports apps/<app-name>/tsconfig.json` to detect and remove unused exports
- `bun why <package>` to check if a package is already installed, no need to install packages that are already dependencies of other packages

## Code Style

- consolidate into fewer files, co-locate small components
- short names in map callbacks: `t`, `m`, `i`
- `export default` for components, named exports for utilities/backend
- `catch (error)` is enforced by oxlint; name state variables descriptively to avoid shadow (e.g. `chatError`, `formError`)

## Linting

| Linter | Ignore comment |
|--------|----------------|
| oxlint | `// oxlint-disable(-next-line) rule-name` |
| eslint | `// eslint-disable(-next-line) rule-name` |
| biomejs| `/** biome-ignore(-all) lint/category/rule: reason */` |

Run `bun fix` to auto-fix and verify all linters pass (zero errors, warnings allowed).

### Safe-to-ignore rules (only when cannot fix)

**oxlint:**

- `no-process-env` - env validation files
- `promise/prefer-await-to-then` - ky/fetch chaining

**eslint:**

- `no-await-in-loop`, `max-statements`, `complexity` - complex handlers
- `@typescript-eslint/no-unnecessary-condition` - type narrowing false positives
- `@typescript-eslint/promise-function-async` - functions returning thenable (not Promise)
- `@next/next/no-img-element` - external images without optimization
- `react-hooks/refs` - custom ref patterns

**biomejs:**

- `style/noProcessEnv` - env validation files
- `performance/noAwaitInLoops` - sequential async operations
- `nursery/noContinue`, `nursery/noForIn` - intentional control flow
- `performance/noImgElement` - external images
- `suspicious/noExplicitAny` - unavoidable generic boundaries

## Minimal DOM rule (React + Tailwind)

### Philosophy

Same UI, fewest DOM nodes.** Every element must *earn its place
If you can delete it and nothing breaks (semantics, layout, behavior, required styling) → it shouldn't exist. Wrappers require justification in code review.

### When a node is allowed (“real reasons”)

A DOM node is allowed only if it provides at least 1 of:

- Semantics / accessibility

  - Correct elements: `ul/li`, `button`, `label`, `form`, `fieldset/legend`, `nav`, `section`, etc.
  - Required relationships / focus behavior / ARIA patterns.

- Layout constraint you cannot apply to an existing node

  - Needs its own containing block / positioning context / clipping / scroll container / stacking context.
  - Examples: `relative`, `overflow-*`, `sticky`, `isolation`, `z-*`, `transform`, `contain-*`, `min-w-0` (truncation), etc.

- Behavior

  - Measurement refs, observers, portals target, event boundary, virtualization/scroll container.

- Component API necessity

  - You truly can't pass props/classes to the real root (and you considered `as` / `asChild` / prop forwarding).

If none apply → **no wrapper**.

### Default moves (before adding wrappers)

Spacing / rhythm

- Between siblings → parent `gap-*` (flex/grid) or `space-x/y-*`.
- Prefer `gap-*` when you already use `flex`/`grid`

Separators

- Between siblings → parent `divide-y / divide-x` (instead of per-item borders).

Alignment

- Centering/alignment → put `flex/grid` on the existing parent that already owns the layout.

Visual ownership

- Padding/background/border/shadow/radius → put it on the element that visually owns the box.

JSX-only grouping

- Wrapper only to return multiple children → `<>...</>` (Fragment), not a `<div>`.

### Styling repeated children: pass props first, selectors second

#### Prefer passing `className` to the mapped item when

- The row is a component (`<Row />`) that can accept `className`.
- You need per-item variation (selected/disabled/first-last rules).
- You want clarity and low coupling (child internals can change).

```tsx
<div className='divide-y'>
  {items.map(i => (
    <Row key={i.id} item={i} className='px-3 py-2' />
  ))}
</div>
```

#### Use selector pushdown when

- Children are simple elements you control (and styling is uniform).
- You want to avoid repeating the same classes on every item.
- You're styling **direct children**, not deep internals.

```tsx
// bad
<div className='divide-y'>
  <p className='px-3 py-2'>Item 1</p>
  <p className='px-3 py-2'>Item 2</p>
  <p className='px-3 py-2'>Item 3</p>
  <button>click</button>
</div>
// good
<div className='divide-y [&>p]:px-3 [&>p]:py-2'>
  <p>Item 1</p>
  <p>Item 2</p>
  <p>Item 3</p>
  <button>click</button>
</div>
```

### Tailwind selector tools (for lists you own)

- `*:` applies to direct children: `*:min-w-0 *:shrink-0`
- Direct child targeting: `[&>li]:py-2 [&>li]:px-3`
- Broad descendant targeting (use sparingly): `[&_a]:underline [&_code]:font-mono`
- Stateful styling without wrappers:
  - `group` / `peer` on existing nodes (`group-hover:*`, `peer-focus:*`)
  - `data-[state=open]:*`, `aria-expanded:*`, `disabled:*`
- Structural variants to avoid wrapper logic: `first:* last:* odd:* even:* only:*`

### Examples

Spacing (column)

```tsx
// bad
<div><div className='mb-2'>A</div><div>B</div></div>
// good
<div className='space-y-2'><A /><B /></div>
```

Spacing (row)

```tsx
// bad
<div><div className='mr-3'>A</div><div>B</div></div>
// good
<div className='flex gap-3'><A /><B /></div>
```

Separators

```tsx
// bad
<div>{items.map(i => <div key={i.id} className='border-b'>{i.name}</div>)}</div>
// good
<div className='divide-y'>{items.map(i => <div key={i.id}>{i.name}</div>)}</div>
```

Pointless wrapper

```tsx
// bad
<div className='text-sm'><span>{name}</span></div>
// good
<span className='text-sm'>{name}</span>
```

Wrapper only for JSX

```tsx
// bad
<div><Label /><Input /></div>
// good
<><Label /><Input /></>
```

List semantics (wrapper is OK)

```tsx
<ul className='space-y-2'>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>
```

### Review checklist (strict)

- **Delete test:** can I remove this node without changing semantics/layout/behavior/required styling? → delete.
- **Parent control:** can `gap/space/divide` replace wrapper/margins/borders? → do it.
- **Props first:** can I pass `className` to the mapped item/component? → do it.
- **Selectors second:** can `[&>...]:` / `*:` remove repetition on direct children I control? → do it.
- **No hidden coupling:** avoid styling deep child internals unless it's a deliberate API.

# PROHIBITIONS

- NEVER write comments at all (lint ignores are allowed)
- NEVER touch files inside `packages/ui` (shared frontend components, read-only)
- NEVER use `Array#reduce()`, use `for` loops instead
- NEVER use `forEach()`, use `for` loops instead
- NEVER use non-null assertion operator (`!`)
- NEVER use `any` type
