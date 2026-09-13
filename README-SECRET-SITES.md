# Secret Sites (`/x/*`)

This document defines the baseline conventions for secret tools and pages under `/x/*`.

These rules are intended to be reused for future secret-site implementations so that fundamental architecture, privacy, and performance decisions do not need to be re-decided for every tool.

## Purpose

`/x/*` is a hidden layer for small, purpose-built tools and pages that are not linked from the public website.

"Secret" means that a page is:

- not publicly linked,
- not intended for indexing,
- privacy-conscious by default,
- lightweight and self-contained where possible.

It does **not** automatically mean authenticated or access-controlled. Authentication is a separate architectural decision and should only be introduced when a specific tool requires it.

## Existing Repository Architecture

The repository already provides:

- Cloudflare static asset delivery,
- a Worker at `src/index.js`,
- D1 bindings and migrations for features that need server-side persistence,
- existing secret-site content under `/x/*`,
- global `/x/*` privacy and indexing headers,
- selective Worker-first routing for paths that actually require server handling.

The default principle is:

> Static tools remain static unless they genuinely need server-side behavior.

## Global Secret-Site Conventions

### Visibility and indexing

- Secret pages must not be linked from the public website.
- Existing `/x/*` noindex/privacy header behavior must remain in place.
- Each secret HTML page should also include a suitable robots meta tag as defense in depth.
- The existing `robots.txt` strategy should remain unchanged unless there is a concrete reason to alter it.

The current `/x/*` header policy includes:

- `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`

### Tracking and external dependencies

Secret pages should not use:

- analytics,
- tracking pixels,
- external fonts,
- external JavaScript libraries,
- external CSS libraries.

Prefer local assets and native browser capabilities.

### Persistence

Secret tools are ephemeral by default.

Do not use the following unless the feature explicitly requires persistence:

- cookies,
- `localStorage`,
- `sessionStorage`.

A reload may clear local tool state.

Server-side persistence is also opt-in rather than a default.

### Mobile First

Mobile First is a fixed convention for new secret pages.

The mobile experience should be designed first rather than treated as a reduced desktop layout.

Relevant implementation patterns may include:

- dynamic viewport units such as `100dvh`,
- safe-area handling where needed,
- touch-friendly controls,
- layouts that remain usable with the mobile keyboard open,
- avoiding interactions that depend on hover,
- avoiding horizontal overflow.

These are implementation patterns, not a shared CSS framework.

## Design

Every new secret page should receive an independent, tool-specific design.

The public website is:

- not a required design reference,
- not a required source of inspiration,
- not a design system for `/x/*`.

Existing secret pages are also not mandatory visual references.

A new tool may reuse an existing visual idea only when it meaningfully improves that specific tool.

There is no requirement to create or maintain a shared `/x/*` design system. Shared button styles, card styles, form styles, color systems, typography systems, and similar abstractions should not be introduced pre-emptively.

## Light and Dark Themes

Light/dark support is optional and tool-dependent.

When both themes are implemented:

- the device/system color scheme should be the default,
- a manual override may be offered,
- that override may remain ephemeral,
- persistence is not required unless there is a separate feature-level reason for it.

Both themes should be intentionally designed rather than produced through simplistic color inversion.

## Animation

Animation may be a core part of the experience of a secret tool.

`prefers-reduced-motion` is **not** a mandatory `/x/*` convention. Individual tools may decide independently how animation should behave.

## Architecture Defaults

The preferred starting point for a new secret tool is:

- static assets,
- Vanilla HTML,
- Vanilla CSS,
- Vanilla JavaScript,
- local assets,
- client-side state only.

Additional infrastructure should only be introduced when a concrete feature requires it.

### Worker

Do not add a new secret page to Worker-first routing merely because a Worker already exists.

Use Worker logic only when the tool genuinely needs server-side behavior.

### APIs

Do not add an API unless the tool requires server communication.

### D1

Do not use D1 merely because the project already has a database.

D1 is appropriate when persistent server-side data provides a real feature-level benefit.

### Shared code

Local implementation is preferred when it is simpler.

Existing code or shared utilities should only be reused when doing so provides a concrete benefit over a small local implementation.

Good reasons for shared code include:

- difficult-to-implement correctness requirements,
- multiple tools genuinely requiring the exact same behavior,
- meaningful reduction in bugs,
- behavior that should intentionally change everywhere at once.

Do not create shared abstractions only because future reuse might happen.

> Observe real duplication first, then extract shared code.

## Randomness

Decorative randomness and decision-relevant randomness should be treated differently.

For purely visual effects, simple randomness can be sufficient.

For fairness-sensitive decisions, use an appropriate secure random source such as the Web Crypto API rather than relying on `Math.random()`.

This is a principle, not a requirement to create a shared random utility.

## Performance and Complexity

Secret tools should remain small, fast, and purpose-built.

> Static, local and self-contained is the default. Every additional dependency, server component, abstraction, or persistence mechanism should have a concrete feature-level justification.

Avoid architecture that increases load time, dependency count, implementation complexity, or coupling between unrelated secret tools without a clear user-facing benefit.

## Adding a New Secret Site

Before implementing a new `/x/*` tool:

1. Confirm that the existing global noindex/privacy behavior applies.
2. Keep the page unlinked from the public site.
3. Design Mobile First.
4. Create a tool-specific visual design.
5. Start with static Vanilla HTML/CSS/JS.
6. Avoid cookies and browser storage by default.
7. Avoid external dependencies.
8. Add Worker/API/D1 only if the feature actually needs them.
9. Reuse existing code only when that is simpler or more robust than a local implementation.
10. Keep the tool self-contained and fast.
