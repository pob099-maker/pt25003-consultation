# Running a consultation

For project staff. Nothing here needs a developer.

## Signing in

Go to `/admin` on the consultation site and sign in with the email and password you were given.
Access is controlled by a list of administrators, so signing in is not by itself enough — if the
data does not appear, ask whoever set the project up to add you to `consultation_admins`.

Sign out when you are finished on a shared computer.

## What the numbers mean

| Figure | Definition |
| --- | --- |
| **Responses** | Submitted consultations matching the filters. Test data is excluded unless you tick it |
| **Reached the final section** | The share that answered at least one project-design question. Someone who stopped at step 3 still counts as a response, and their answers still count |
| **Median time taken** | The middle response, not the average. One person who left the tab open overnight cannot drag it |
| **Contact records** | People who asked to be contacted. Not linked to any set of answers |

### Ranked constraints

Question 2 asks for a top three, in order. The score gives **3 points to a first choice, 2 to a
second, 1 to a third**. The table also shows first choices and how many people named the constraint
at all, because those tell different stories: something many people put second is a broad concern,
while something a few people put first is an acute one.

### Priority areas

The mean of the 1–5 ratings, alongside the share who rated it 4 or 5. Areas nobody rated are not
counted as zeros — an unanswered question is not a low score.

## Filtering

Role and region filters apply to everything on the screen, including the exports. That is how you
compare regions, or look at what only contractors said.

**Include test data** brings the seeded demonstration rows back into view. Leave it off when
reporting real numbers.

## Exports

Three CSV files, each reflecting the current filters:

| Button | Contents |
| --- | --- |
| **Export responses** | One row per response, one column per question. Multi-selects are semicolon-separated labels; each rating area and each ranking position gets its own column |
| **Export contacts and EOI** | The optional contact records. Separate file, deliberately |
| **Export comments and themes** | Every free-text answer, one per row, with the themes you tagged |

The files open cleanly in Excel — labels, not codes; UTF-8 with a byte order mark, so the region
names read correctly; and a text answer beginning with `=` is neutralised so a spreadsheet cannot
treat it as a formula.

## Who volunteered for what

The **Contacts** tab opens with a tally of what people offered — how many are willing to join the
project reference group, host a trial, supply a machine for a demonstration, and so on. That is the
list to work from when the reference group is being filled or a demonstration site is needed.

The options people saw depended on their pathway, because helping with a trial means different
things in different parts of the chain: a grower offers a paddock and a harvest to measure, a dealer
offers a machine and a technician, a packhouse offers a line and permission to measure it. Everyone,
whatever their role, was offered the project reference group, so that list is complete in one place.

Treat every tick as an expression of interest rather than a commitment — the wording on the form
says somebody will talk it through first, so make sure that call happens before anyone is counted on.

## Somebody who would rather not use the form

The landing page and the consent page both offer a phone call or a visit instead, with the project
contact details. When somebody takes that up, complete the consultation with them over the phone and
submit it the same way — their answers then sit in the same data as everyone else's, and the analysis
is not quietly biased towards the people comfortable with an online form.

If they also want to be contacted about activities, ask before entering their details, and tick the
interests they agreed to.

## Tagging comments

Open the **Comments** tab. Each free-text answer shows the role, the date and the question. Tap any
theme to apply or remove it; it saves immediately, and appears in the comments export.

The themes are fixed so that tagging stays consistent between people: Labour, Timeliness,
Harvesting, Planting, Logistics, Grading, Packhouse, Quality, Damage, Reliability, Safety,
Irrigation, Data, Training, ROI, Service support.

## Changing question wording

**Question wording** lets you edit any question's text, its guidance line, and the label on any
answer option — then press **Save wording**. New responses use the new words straight away.

What you cannot do from here, by design: delete an option, or change the underlying id shown in grey
above each field. Every response already collected points at those ids. Renaming an option relabels
the same thing and keeps the data comparable; removing one would orphan the answers that chose it.

To add an option, or add or remove a whole question, ask a developer to edit
`src/content/questionnaire.ts`.

## Starting a new consultation round

Press **Start a new round**, adjust the name, and save. Everything already collected keeps its own
round id and is untouched — a new round changes what happens next, never what happened before.
Exports carry a `round` column, so results can be compared across rounds.

Only one round is active at a time; starting a new one closes the previous one automatically.

## Someone asks to be removed

Contact records can be deleted by an administrator in the Supabase table editor
(`consultation_contacts`). Their consultation answers cannot be found or removed — they were never
linked to the person in the first place, which is what the privacy statement promises.

## Before the consultation goes live

- Clear the test data (see `docs/SETUP.md`, step 6).
- Check `VITE_HOME_URL` and the privacy contact address point where you want.
- Walk through the consultation on a phone, as a respondent, once.
