# PT25003 consultation

An adaptive online consultation for the **Potato Mechanisation Project (PT25003)**. It collects
structured input from across the Australian potato value chain — growers, farm managers,
contractors, processors and packhouses, machinery suppliers, technology providers, advisers and
industry bodies — without a face-to-face meeting, an app download or an account.

- Respondents open a link, pick a perspective, and answer about 8–10 minutes of questions. No
  sign-in, no email verification, anonymous by default.
- Questions adapt to the role, so nobody is asked about packhouse grading lines when they run a
  harvester.
- Optional contact and expression-of-interest details are collected **separately** from the
  anonymous answers, in a table with no key back to them. What somebody can offer — hosting a trial,
  supplying a machine, joining the project reference group — is asked in the terms of their own part
  of the chain.
- Anyone who would rather not use an online form is told, before they start, that they can give the
  same input by phone or in person.
- Project staff get a small protected admin area: response counts, ranked priorities, filters, CSV
  exports, and thematic tagging of free-text comments.

## Quick start

```bash
npm install
npm run dev
```

The app runs with no backend configured. In that state it is fully usable: submissions are held in
the browser's outbox and sent as soon as credentials are present, and `/admin` shows the seeded test
data so the whole tool can be reviewed before a Supabase project exists.

To connect a backend, copy `.env.example` to `.env.local` and fill in the two Supabase values. Then
follow [docs/SETUP.md](docs/SETUP.md).

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Production build into `dist/` |
| `npm run test` | Vitest suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, strict mode |

## Routes

Hash routing, so the app works on any static host — GitHub Pages included — with no server
rewrites and no link that can 404.

| Path | Who it is for |
| --- | --- |
| `#/` | Landing page, introduction and confidentiality statement |
| `#/about` | Information and consent, before any question |
| `#/consultation` | The six-step consultation |
| `#/thank-you` | What happens next |
| `#/privacy` | Privacy statement |
| `#/admin` | Project staff only. Supabase sign-in |

## How it is put together

```
src/
├── content/questionnaire.ts   every question, option and region — the one place wording lives
├── pages/                     landing, consent, consultation, thank you, privacy, admin
├── components/                question renderers, layout, progress, the stay-involved form
├── hooks/useConsultation.ts   step machine and the auto-saved draft
├── services/                  submission and outbox, analysis, CSV export, rounds, tags, seed data
├── schemas/                   Zod validation, applied before anything is written
└── lib/                       Supabase client, config, CSV, guarded localStorage
supabase/
├── migrations/0001_consultation.sql   tables, indexes and row-level security
└── seed/test_data.sql                 realistic test rows, all flagged is_test_data
```

### Things worth knowing before changing it

- **The two data areas are not joinable.** `consultation_responses` and `consultation_contacts`
  share no key, in either direction. That is the mechanism behind the promise on the landing page,
  not a convention — so do not add a foreign key between them "for reporting".
- **Question ids and option ids are identifiers, not labels.** Every stored answer points at them.
  Wording can be changed freely, through the admin area or in `questionnaire.ts`; renaming an id
  orphans historic answers.
- **A submission is never dropped.** If the backend is unreachable, `services/submit.ts` keeps the
  row in a local outbox and `flushOutbox()` sends it on the next visit. The thank-you page says so
  plainly rather than claiming a response was received.
- **Nothing is coerced.** There is no `z.coerce.number()` anywhere: an untouched rating must stay
  absent, because "nobody answered" and "rated 1, not a priority" are different findings.
- **Colours come from the tokens in `src/index.css`**, never from raw hex or an opacity over an
  unknown ground.
- **The focus ring is restored once, globally.** Never add `focus:outline-none` — it beats
  `:focus-visible` on specificity and silently removes the ring for keyboard users.

## Documentation

- [docs/GO_LIVE.md](docs/GO_LIVE.md) — step by step from empty repository to a link you can email
- [docs/SETUP.md](docs/SETUP.md) — Supabase project, migrations, admin accounts, environment
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — building and hosting, cheaply
- [docs/ADMIN.md](docs/ADMIN.md) — running a consultation round, exports, tagging, new rounds
