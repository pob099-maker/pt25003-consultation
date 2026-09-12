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

## Piloting before the link goes out

Let the team use the real thing, on a **pilot round**, rather than testing and then deleting.

1. **Question wording** tab → set the round to something obvious like `2026-pilot`, name it
   *Pilot — internal review*, **Save wording**. Everything submitted from now carries that round.
2. Send the team the real link. They respond as real respondents, on their own phones.
3. When you are ready to go wide: **Start a new round**, name it for the real consultation, save.

Nothing has to be deleted. The pilot answers keep their own round for ever, the admin **Round**
filter defaults to whichever round is collecting now, and the CSV carries a `round` column. If you
would rather clear the pilot afterwards anyway:

```sql
delete from public.consultation_responses where round_id = '2026-pilot';
delete from public.consultation_contacts  where round_id = '2026-pilot';
delete from public.consultation_progress  where round_id = '2026-pilot';
```

Ask each person to take a **different role**, so all six branches get walked, and to do it on a
phone rather than a laptop — that is what respondents will use, and it is where length hurts.

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

## Where people stop

The **Priorities** tab shows how many sessions started, how many finished, which step people got to
before giving up, and how each role's branch compares.

That comes from a separate record of how far each session got. It holds the step number, the role
and the branch, and nothing else — no answers, no free text. Keeping the partial *answers* of
somebody who chose not to submit them was the obvious alternative and is deliberately not done: we
tell people they may stop at any time, and taking their views anyway would make that a lie.

Use it while the consultation is running, not after. If one branch finishes at half the rate of the
others, that is a section to shorten — and you can shorten it from the **Question wording** tab
without waiting for the round to end.

Clear the records when the consultation closes:

```sql
delete from public.consultation_progress;
```

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

The **Phone script** tab is the whole consultation laid out to be read down the phone: an opening to
say in your own words, the role question that tells you which branch to use, every question with its
options, and prompts for the caller — *read the list, tick everything they say, do not read it
twice*, and on the ratings *"no view" is a fine answer, leave it blank rather than guessing*. A
guessed 3 is indistinguishable from a considered 3 once it is stored, and it drags every mean
towards the middle.

Type a role into **Show one branch only** to cut it to the branch you need; the shared questions
always stay. **Print** gives you something for the desk, **Download a copy** gives you the file.

It is built from the wording that is live right now, so it changes when you change a question — the
call and the form ask the same things by construction rather than by anybody remembering.


The landing page and the consent page both offer a phone call or a visit instead, naming whoever is
listed in `VITE_PROJECT_CONTACTS` — currently Peter O'Brien on 0409 773 111. Adding a second name is
a change to that one setting, not to the code.

 When somebody takes that up, complete the consultation with them over the phone and
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

Sign in at `/#/admin`, open the **Question wording** tab, and edit away. Every question in the
consultation is listed, section by section, in the order respondents see them. For each one you can
change:

- the question itself
- the grey guidance line underneath it
- the label on any answer option — open **Answer options** beneath the question

Press **Save wording** when you are done. New responses use the new words straight away; nobody has
to redeploy anything and no developer is involved.

Then press **Download phone script** and use that copy on calls. The script is built from the
wording you just set, so the person on the phone asks exactly what the form asks — otherwise the
phone answers and the online answers slowly stop being the same question, and the analysis splits
into two datasets that disagree.

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
