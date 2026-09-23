# The model, and the words for it

Agreed 24 Sep 2026, before the baseline starts. Nothing in the code has been renamed yet; this is
the shape to move towards, and the wording to use in anything written from here.

## The idea

**Everything is a consultation. Some questions repeat.**

From the outside there is one thing: somebody is asked what they think, once. Whether it is the
first time or the third is the project's business, not theirs — and today the tool already keeps it
that way, because the round's name appears only in the admin area.

Two facts are structural, because the software has to reason about them:

1. **Which consultation is the starting point.** One is; the rest compare back to it.
2. **Which questions repeat**, word for word, every time.

Everything else — names, dates, how many you run — belongs to whoever is reporting, and can change
whenever they like.

## Three levels, and what belongs to each

One tool, several projects, several consultations inside each project. PT25003 is a project on the
tool, and PotatoLink phase 2 will be another one beside it rather than a version of this one.

```
The tool            the consultation tool itself, one codebase, one database
  Project           PT25003 · PotatoLink phase 2 · a regional program
    Consultation    Baseline · Mid-term review · Final review
      Response      one person, once, however they answered
```

| Level | Owns | Shared with the level above |
| --- | --- | --- |
| **Tool** | The question library, the measurement wording, how anything is collected and analysed | — |
| **Project** | Its own questions, team, contacts, respondents and reporting. Its own name for "consultation" | The tool's machinery, and nothing else. No project can see another's data |
| **Consultation** | Its dates, its name, whether it is the starting point | The project's questions, minus whatever this one adds or retires |
| **Response** | One person's answers | The consultation's wording |

Two practical consequences:

- **A project is the privacy boundary.** Every table carries `project_id`, and a query that forgets
  it is a bug, not a wider view. Team logins are per project too.
- **A respondent never chooses a level.** The link they were sent belongs to one project and one
  live consultation. Today that means the deployment's own project, with `/#/p/<project>` as a
  short link for a second one; a project with a life of its own gets its own address, and the short
  link keeps working when it does.

Where the words go wrong: calling PT25003 "the consultation" makes phase 2 sound like a *later
consultation of the same project*, which would put both under one set of repeat questions and one
starting point. It is a project of its own, with its own starting point.

## Four concepts, one name each

| Use | Don't use | What it is |
| --- | --- | --- |
| **Consultation** | round, wave, stage | One period of asking. Has the project's own name for it and its dates |
| **Repeat questions** | tracked, must-ask, locked, word-for-word | The handful asked identically every time. The only reason two consultations compare |
| **Starting point** | baseline (as a system word) | The consultation everything else is measured against. "Baseline" is a *name* a project may give it |
| **Short version / full version** | quick form, long form, short call (online) | How much is asked. The short version is the repeat questions alone |

Two more, already settled and unchanged: **ways of answering** (online, interview, field day,
group) and **practice** (a consultation never counted in any comparison — today's "pilot").

Note that "tracked" and "must-ask" are both flagged by our own plain-language check. That is the
argument for "repeat questions" in one line.

## Naming is the project's, structure is the tool's

The same machinery serves whoever is asking:

- A three-year funded project: *Baseline* → *Mid-term review* → *Final review*
- A regional program: *Baseline 2027* → *Annual survey 2028* → *Annual survey 2029*
- A short piece of work: *Before* → *After*
- A one-off: *Industry consultation* — nothing repeats, so nothing locks

Renaming never changes what something **is**: the starting point stays the starting point, so charts
and exports keep lining up. The stable code (`2028-mid`) stays in exports beside the display name.

## What this means when we build it

- Charts and filters show the consultation's name, not "Review 1".
- Starting one asks for a name (with presets) and whether it is the starting point.
- The word "consultation" itself becomes a project setting, for projects where "survey" or
  "feedback round" fits better.
- The wizard's first step is one question: *will you run this again later?*
- Repeat questions get a screen of their own. They are the spine, not a flag buried in an editor.
- Nothing changes for respondents.

## Why the vocabulary matters more than it looks

Four names for one concept is what made the earlier design read as jumbled. The same discipline the
tool asks of a project — say it the way a grower would — applies to the tool's own words.

See also: the wizard mock-up (Artifact "Project setup wizard"), and docs/PROJECTS.md for how
projects and rounds are stored today.
