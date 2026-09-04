# Kingdom — Life in the UK test prep app

Full specification: docs/SPEC.md — read it before any task.
Security policy: docs/SECURITY.md — follow it for all dependency, secrets,
and data-handling decisions.
Build it phase by phase, in order. Do not skip ahead.

## Standing rules

1. TypeScript strict mode. No `any`. No `@ts-ignore`.
2. packages/core must never import React, Tailwind, or any browser API
   (window, document, localStorage, Date.now). Time comes from an injected
   Clock, randomness from an injected Random, persistence from the Storage
   interface. Enforced by an ESLint import boundary rule.
3. No placeholder code. No `// TODO: implement`. If you cannot finish
   something, say so rather than shipping a stub.
4. No file over 300 lines. Split it.
5. Every function in packages/core has a Vitest unit test. Tests must pass
   before you report a phase complete.
6. Never paste text from the Life in the UK handbook or any commercial
   question bank. All content written from scratch. Every Fact carries a
   sourceRef and `verified: false` until a human checks it.
7. Never use "official", "Home Office" or "GOV.UK" in UI copy. Never imitate
   the GOV.UK Design System.
8. Follow the design tokens and typography in docs/SPEC.md exactly. Do not
   substitute a cream-and-terracotta palette or a serif display face.
9. Accessibility floor on every screen: keyboard operable, visible focus,
   AA contrast, feedback never colour-only, prefers-reduced-motion respected.
10. At the end of each phase report: what you built, what you deliberately
    did not build, and anything in the spec you think is wrong.
11. Follow docs/SECURITY.md for all dependency, secrets, and data-handling
    decisions. Flag any new dependency added and why, in the phase report.

## Commands
pnpm dev | pnpm test | pnpm lint | pnpm validate:content
