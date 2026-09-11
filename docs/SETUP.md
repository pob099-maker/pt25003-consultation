# Setup

About twenty minutes, once. You need a Supabase account and a text editor.

## 1. Create the Supabase project

1. Go to <https://supabase.com>, create a project, and pick a region close to Australia
   (Sydney: `ap-southeast-2`).
2. Save the database password somewhere safe. You will rarely need it.

## 2. Create the tables and security policies

In the Supabase dashboard, open **SQL Editor → New query**, paste the whole of
`supabase/migrations/0001_consultation.sql`, and run it.

That creates four tables plus an administrator list, and turns on row-level security for all of
them. The policies say, in plain terms:

| Who | Can do |
| --- | --- |
| Anyone with the link (not signed in) | Insert one consultation response; insert one contact record; read the active round's wording |
| A signed-in administrator | Read responses, read and delete contact records, edit round wording, tag comments |
| Anyone else | Nothing |

Nobody who is not an administrator can read a single response, including the person who wrote it.

## 3. Add the project's environment variables

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Both come from **Project Settings → API**. Both are safe to publish in the browser bundle: the anon
key grants only what the policies above allow. The service role key must **never** appear in this
file or anywhere in the app.

The other variables are cosmetic and have sensible defaults:

| Variable | Used for |
| --- | --- |
| `VITE_HOME_URL` | Where "Return to the project home page" goes on the thank-you page |
| `VITE_PRIVACY_CONTACT_NAME` | Named on the privacy page |
| `VITE_PRIVACY_CONTACT_EMAIL` | The address for a privacy question, and for anyone who would rather respond by phone |
| `VITE_PROJECT_CONTACTS` | Who to ring if an online form does not suit somebody. `Name\|Phone\|Email`, several separated by a semicolon. Adding a second or third contact is an environment change, not a code change |

## 4. Create administrator accounts

Respondents never have accounts. Administrators do.

1. **Authentication → Users → Add user**, with an email address and password. Repeat for each staff
   member.
2. **Authentication → Providers**: turn off "Enable sign ups" so nobody can create their own
   account.
3. **Table editor → `consultation_admins` → Insert row**: paste the user's `id` from the Users list
   into `user_id`, and their address into `email`.

Being able to sign in is not enough — only a row in `consultation_admins` grants access to the data.
Removing the row removes the access, immediately, without deleting the account.

## 5. Create the first round

Sign in at `/admin`, open **Question wording**, and press **Save wording**. That writes the active
round. Until it exists, the app uses the wording compiled into the bundle, which is the same text —
so this step is optional at launch, and required before anyone edits wording.

## 6. Optional: load the test data

While you are setting things up, run `supabase/seed/test_data.sql` in the SQL editor. It adds one
realistic response per role and two contact records, all flagged `is_test_data`.

The admin area hides them unless **Include test data** is ticked, and the CSV export carries a
`test_data` column. Before the consultation goes live, clear them:

```sql
delete from public.consultation_responses where is_test_data;
delete from public.consultation_contacts  where is_test_data;
```

## 7. Check it

```bash
npm run test && npm run build && npm run dev
```

Then walk the consultation through once on a phone-sized window. What to look for:

- A role you pick changes which section appears at step 4.
- Question 2 offers only the constraints you ticked in question 1.
- "Save and exit" and reopening the link puts you back where you were.
- A submission with no contact details creates a row in `consultation_responses` and **nothing** in
  `consultation_contacts`.

## Running without a backend

With the two Supabase variables blank, the app still works: responses are held in the browser's
outbox, and `/admin` shows the seeded test data with a banner saying so. This is how the tool can be
demonstrated and reviewed before a project exists — and it is what the test run uses, which is why
`vite.config.ts` blanks the credentials for tests. `src/lib/testIsolation.test.ts` fails if that
stops being true. Do not work around it by re-supplying them: a developer with `.env.local` present
would otherwise have `npm test` writing junk rows into the live project.
