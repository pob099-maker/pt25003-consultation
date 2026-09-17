# Projects and the question library

The consultation tool started as PT25003's, but nothing in a baseline-and-review
industry consultation is specific to potato mechanisation. It now has a
project layer, and PT25003 is project one.

## What a project is

- **In the database**, a row in `consultation_projects`. Every round, response,
  contact, progress record, group record and workshop carries a `project_id`,
  so two projects on the same database never see each other's data. Anything
  that doesn't say which project it belongs to is PT25003's.
- **In code**, an entry in `src/content/projects.ts`: the name and reference
  shown on the page, and the questionnaire each round starts from.
- **In a deployment**, the `VITE_PROJECT_ID` repository variable. Unset means
  PT25003.

One active round and one baseline are allowed **per project**.

## The question library

`src/content/library.ts` holds every question any project can ask, keyed by
id. A question's id is its identity across projects: `q1_constraints` means the
same thing wherever it's asked, so results can be set side by side. PT25003's
questions are the library's first entries.

A round can change its project's questionnaire without a code change, from
**Question wording** in the admin area:

| Change | How | What happens to earlier answers |
| --- | --- | --- |
| Reword a question or option | Edit the text | Kept; same ids |
| Add an option | (existing) | Kept |
| Retire a question | Tick *Retire from this round* | Kept; the question just isn't asked |
| Add a question from the library | *Added from the question library* at the end of a section | — |

Tracked questions can't be reworded or retired: the change-over-time view
depends on them being asked word for word.

The *Added from the question library* box only appears when the library holds
questions the project doesn't already ask. For PT25003 today it doesn't — the
library and PT25003 are the same list.

## Starting a second project

1. Add the project's questions to the library (new ids for new questions;
   reuse existing ids wherever the meaning is the same).
2. Add an entry to `PROJECTS` in `src/content/projects.ts`, with its own
   questionnaire built from those questions.
3. In the Supabase SQL editor:
   ```sql
   insert into public.consultation_projects (id, name, short_name)
   values ('PT26001', 'Project name', 'Short name');
   ```
4. Deploy a second copy of the site (a second repository or a second Pages
   workflow) with `VITE_PROJECT_ID=PT26001`.
5. Sign in, open **Question wording**, and start its first round.

## Still PT25003-specific

- The landing, about, interview-opening and privacy copy is written for
  PT25003. The project name and reference are filled in from the registry, but
  the body text needs a per-project version before a second project goes live.
- Storage keys and the repository name still say `pt25003`. Renaming the keys
  would throw away drafts people have in progress, so leave them. Rename the
  repository once there's a second project.
- The team list (`consultation_admins`) is shared across projects.
