# Running a consultation

For project staff. Nothing here needs a developer.

## Signing in

Use **Project team sign in** at the bottom of any page. You choose your own password from the
invitation email; nobody sends you one. Signing in is not by itself enough to see results — an
administrator also has to add you on the **Team** tab. See [TEAM-LOGINS.md](TEAM-LOGINS.md).

**Forgot your password?** is on the sign-in page.

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

## Baseline and review rounds

The consultation is designed to be run three times: a **baseline** at launch, a **review** about
half-way through the project, and a final **review** before reporting. The **Change over time** tab
compares them.

On the **Question wording** tab:

- **Start the baseline** when the pilot is finished and the link is about to go out. There is only
  one baseline.
- **Start a review round** when it is time to measure again. A review round also asks what people
  have seen from the project and whether it changed anything they do — questions that make no sense
  at baseline.

Questions marked **Tracked · locked** are asked word for word in every round. They cannot be edited,
because changing one — even adding an option — would make the baseline and the review measure
different things. Everything else can be reworded freely between rounds.

Reading the **Change over time** tab:

- Each round is a separate picture of the industry. Responses are anonymous, so this compares
  pictures, not the same people over time.
- Check **Who answered** first. If the baseline was mostly growers and the review mostly packhouses,
  the numbers will move for that reason alone.
- Greyed figures come from fewer than ten people. Report them with that caveat, or not at all.
- Pilot rounds never appear here.

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

**It is opt-out.** Anyone can switch it off with one checkbox on the consent page or the privacy
page, and it is off automatically for anyone whose browser sends a do-not-track privacy signal.
Opt-in was considered and rejected: the people who would tick "yes, record me" are the engaged ones,
the least likely to give up — so an opt-in record would measure drop-off only among people who do
not drop off. The funnel therefore slightly under-counts sessions; treat its numbers as a guide to
where people stop, not an exact count of how many started.

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

### Letting the conversation run

**Start an interview** (top of the admin area) is built for a conversation, not a read-out survey.

- **Jump to any section.** The row of sections at the top goes anywhere, in any order — when a
  grower starts on labour while you are asking about harvest, tap that section and record it there.
  ✓ marks a finished section, ◐ a part-finished one. On a phone, swipe the row sideways.
- **Notes and quotes.** Every section has a notes box for the good quote or the side story that fits
  no question. Notes are filed under the section they were taken in, appear in the **Comments** tab,
  and are exported in one `interview_notes` column. Leave names out.
- **Came up earlier.** If they have already answered a question in passing, tap **Came up earlier**:
  the prompt changes to a quick check ("earlier you mentioned … — have I got that right?") and you
  record the answer as usual. The export lists these in `covered_earlier`, so an analyst can tell a
  confirmed answer from one asked outright.
- **Short call.** When setting up, choose *Short call* (about five minutes) to ask only the tracked
  questions — the ones repeated at baseline, mid-project and end — so a busy grower still counts
  towards the comparison. In a full interview those questions carry a *Must ask* badge. The link at
  the top switches length mid-call without losing anything; the export records it in
  `short_or_full`.
- Skip anything that did not come up — an empty answer is recorded as not asked, never as a zero.
  Ratings are still read as written.

## Short and full versions

The landing page offers two ways in:

- **Short version, about five minutes** — only the tracked questions, the ones repeated at baseline,
  mid-project and end. It still counts in every comparison.
- **Full version, about ten minutes** — everything, including the free-text questions and the
  project-design section.

At the end of the short version, people are asked — once, politely — whether they would like to
answer the rest. Saying yes keeps every answer already given and skips straight to the first thing
not yet answered. Saying no goes to the optional contact step and submits.

Which one somebody used is in the `short_or_full` column of the export, for both online responses
and interviews, so a thin answer set is never mistaken for somebody dropping out.

## Group discussions and live workshops

There are two ways to capture a room, and they are counted differently.

**A group discussion** (admin area → Groups → *Record a group discussion*) is
written up afterwards by the facilitator: how many people were there, and how
many hands went up for each option. Leave a box empty for anything the group
wasn't asked — empty means "not asked", 0 means "asked, and nobody". A group is
one record of a room. It is reported beside individual responses and never
added to them.

**A live workshop** (admin area → *Run a workshop*) is for a room with phones.

1. Name the workshop and tick the questions, in order. Each kind of question
   gets its own picture: choices as bars, ratings as an average out of 5 with
   the spread of scores, and open questions as a **word cloud** (each phone
   can send up to three words or short phrases).
2. Put the presenter screen on the projector. It shows a QR code and a
   six-character code; people can also go to the site's `#/w` page and type it.
3. People choose a role if they want to (it's optional) and answer each
   question as it comes up. They can change an answer until you close voting.
4. **Close voting and show results** puts the totals on the screen and on every
   phone — but only once at least five people have answered that question.
   Below five, the result stays hidden, so nobody's choice can be picked out.
   On a word cloud, **click any word to hide it** from the screen and every
   phone — for a name, or something rude. Hidden words are listed underneath;
   click one to show it again. The person's own response still keeps it.
5. **Full screen** (top right) fills the projector; Esc leaves it.
6. **Next question** moves everyone on. **End workshop** tells every open phone
   to save its answers.

Each phone's answers become one anonymous response, marked *Workshop* in the
**Collected** filter and tied to that workshop. Someone who leaves early can tap
*Save my answers and finish*. A phone closed before the end without doing that
still counts in the live totals, but not in the responses.

## Charts and pictures for reports

- **Priority areas** are drawn split at the middle score: low ratings run left
  of the centre line, high ratings right. A row that leans right is a priority;
  a long middle block means people are unsure.
- **Change over time** draws a line per option from the baseline to each
  review. The biggest risers are gold-brown, the biggest fallers slate, and the
  three highest are in dark ink; the rest are faint. The table is still there
  under **The numbers**.
- **Download chart** (beside each chart, and on the workshop screen once
  results are showing) saves a PNG on a white background, titled, with how many
  people answered — ready for Word or PowerPoint.

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
