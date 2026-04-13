# Contributing to InstaCrop

This guide is written for both the project owner and the UI developer joining to help build the frontend. Read through this before you start working on the codebase.

---

## Who works on what

| Developer | Focus area |
|---|---|
| **Owner (backend/AI)** | `src/lib/ai/`, `src/app/api/`, `supabase/`, orchestrator, DB queries, storage |
| **UI developer** | `src/components/`, `src/app/page.tsx`, `src/app/generate/`, `src/app/results/`, `src/app/dashboard/`, Tailwind config |

The codebase is structured so that UI work and backend work rarely touch the same files. If you need to cross over into the other person's area, mention it first.

---

## Getting started (UI developer)

### 1. Clone and set up

```bash
git clone https://github.com/YOUR_USERNAME/instacrop.git
cd instacrop
git checkout dev
npm install
```

### 2. Set up your environment

```bash
cp .env.example .env.local
```

Ask the owner to share the values for `.env.local`. Do not commit this file.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Branch workflow

### Branch off `dev` — never work directly on `main`

```bash
# Get the latest code
git checkout dev
git pull origin dev

# Create your feature branch
git checkout -b feature/your-feature-name
```

### Push and open a PR

```bash
git add .
git commit -m "feat: describe what you built"
git push -u origin feature/your-feature-name
```

Then open a Pull Request on GitHub: `feature/your-feature-name` → `dev`.

---

## Branch naming

Use one of these prefixes:

| Prefix | Use for |
|---|---|
| `feature/` | New features or UI improvements |
| `fix/` | Bug fixes |
| `refactor/` | Code cleanup (no new functionality) |
| `docs/` | Documentation only |
| `chore/` | Config changes, dependency updates |

Examples:
- `feature/ui-results-gallery`
- `fix/dropzone-mobile-scroll`
- `refactor/output-card-props`
- `docs/readme-update`

---

## Commit message format

Keep commits focused and descriptive:

```
type: short description of what changed
```

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`

Examples:
```
feat: add hover state to output card
fix: prevent double-submit on generate button
refactor: extract format badge into its own component
style: update brand colour to match new palette
docs: clarify Supabase bucket setup steps
```

Avoid vague commits like `update`, `changes`, `stuff`.

---

## Pulling latest changes

Before starting any work session:

```bash
git checkout dev
git pull origin dev
git checkout your-branch-name
git rebase dev
```

Using `rebase` instead of `merge` keeps the history cleaner.

---

## Avoiding merge conflicts

- **Pull before you start.** Always `git pull origin dev` before creating a new branch.
- **Commit often.** Small, frequent commits are easier to rebase and review.
- **Don't refactor files the other person is actively changing.** Check with each other if you're both touching the same page or component.
- **Don't rename shared types** in `src/types/index.ts` without telling the other dev — both sides depend on them.

---

## For the UI developer — where to find things

### Layout and theme

| File | What to edit |
|---|---|
| `tailwind.config.ts` | Brand colours, font sizes, custom spacing |
| `src/components/layout/navbar.tsx` | Top navigation bar |
| `src/app/layout.tsx` | Root layout, global fonts, body styles |

### Landing page

- `src/app/page.tsx` — All copy, sections, hero, CTA, features grid

### Generation wizard (3-step flow)

- `src/app/generate/page.tsx` — The full wizard: step indicators, step content, buttons
- `src/components/editor/dropzone.tsx` — Drag-and-drop image upload area
- `src/components/editor/product-selector.tsx` — Canvas tool for drawing around the product (rect + lasso)
- `src/components/generation/format-selector.tsx` — Format checkboxes
- `src/components/generation/generation-settings.tsx` — Mode, background style, variant count

### Results page

- `src/app/results/[jobId]/page.tsx` — Results viewer layout, settings summary, output grid
- `src/components/results/output-card.tsx` — Individual output image card

### Dashboard

- `src/app/dashboard/page.tsx` — Job history list

### Base components

- `src/components/ui/button.tsx` — Button (all variants and sizes)
- `src/components/ui/badge.tsx` — Status badges

---

## For the UI developer — what NOT to edit casually

These files contain backend/AI logic. Do not edit them without talking to the owner first:

| File | Why it's sensitive |
|---|---|
| `src/lib/ai/gemini-provider.ts` | All Gemini API calls — changing prompts here affects generation quality |
| `src/lib/ai/orchestrator.ts` | Job execution flow — breaking this breaks all generation |
| `src/lib/ai/prompt-builder.ts` | Prompt logic — directly affects output quality |
| `src/lib/db/jobs.ts` | All DB queries — schema-dependent |
| `src/lib/storage/index.ts` | Supabase storage calls |
| `src/app/api/` | API route handlers |
| `src/middleware.ts` | Auth guard — wrong changes lock everyone out |
| `supabase/schema.sql` | Database schema — do not alter without coordination |
| `src/types/index.ts` | Shared types — changes here affect both sides |

---

## Pull request checklist

Before opening a PR, make sure:

- [ ] You branched off `dev`, not `main`
- [ ] `npm run build` passes without errors
- [ ] `npm run lint` shows no new warnings
- [ ] You didn't accidentally commit `.env.local` or any secrets
- [ ] Your PR description explains what changed and why

---

## Questions?

If something is unclear or you're not sure which file to edit, ask before changing. It's much easier to coordinate up front than to fix a merge conflict or broken API later.
