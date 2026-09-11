# Going live

Everything needed to turn this repository into a link you can put in an email. Two jobs: a database
to collect responses, and a web address to send people to. Allow an hour, most of it waiting.

Nothing here needs a developer, but you will need:

- A Supabase account (the database).
- The `pob099-maker` GitHub account (the hosting). Free, and the same place the Fieldwork app lives.
- Brandon, who manages DNS for `agaims.com.au`, for one record. See [DNS-REQUEST.md](DNS-REQUEST.md).

---

## Part 1 — The database

### 1.1 Create the project

1. Go to <https://supabase.com> and sign in.
2. **New project**. Name it `pt25003-consultation`.
3. Region: **Southeast Asia (Singapore)** or **Australia (Sydney)** if offered. Closest wins; it
   only affects speed.
4. Generate a database password and save it in your password manager. You will rarely need it.
5. Wait about two minutes for the project to finish building.

### 1.2 Create the tables

1. Left sidebar → **SQL Editor** → **New query**.
2. Copy the migration to the clipboard — from the project folder:

   ```bash
   cat supabase/migrations/0001_consultation.sql | clip
   ```

   Then paste it into the editor. (Or open the file and copy it by hand.)
3. **Run**. You should see "Success. No rows returned."

That created four tables and turned on row-level security. From this point:

| Who | Can do |
| --- | --- |
| Anyone with the link, not signed in | Add a consultation response; add a contact record; read the current question wording |
| A signed-in administrator | Read responses, read and delete contact records, tag comments, edit wording |
| Anyone else, including a stranger with the public key | Nothing |

### 1.3 Load the test data (recommended while setting up)

Same SQL editor, new query, `cat supabase/seed/test_data.sql | clip`, paste, **Run**. That gives you eight
realistic responses to check the admin screens against. Every row is flagged as test data, and you
clear them in step 4.2 before going live.

### 1.4 Copy the two keys

Left sidebar → **Project Settings** → **API**. Copy and keep handy:

- **Project URL** — looks like `https://abcdefghijkl.supabase.co`
- **anon public** key — a long string starting `eyJ...`

Both are designed to be public and will sit in the website's code. The **service_role** key on the
same page must never be used here, or in any email, or anywhere else. It ignores every security
policy above.

### 1.5 Create your administrator account

1. **Authentication** → **Users** → **Add user** → **Create new user**. Use your work email and a
   strong password. Repeat for each staff member who needs results.
2. **Authentication** → **Sign In / Providers** → turn **Allow new users to sign up** off. Otherwise
   anybody could create themselves an account.
3. Copy the new user's **UID** from the Users list.
4. **Table Editor** → table `consultation_admins` → **Insert row**: paste the UID into `user_id`,
   put the address into `email`, save.

Step 4 is the one that grants access. Signing in without a row there shows nothing — which is also
how you remove somebody later, without deleting their account.

### 1.6 A note about the free plan

Supabase pauses a free project after about a week with no traffic. A live consultation will normally
get enough to stay awake, but a quiet fortnight mid-way through would pause it, and responses would
then sit unsent on people's phones until it woke up.

For a four-month consultation, the Pro plan (about US$25/month, roughly $150 over the period) removes
that risk. Check their current terms before deciding — this is the one place where saving $150 could
cost you responses.

---

## Part 2 — The web address

The app uses hash routing, so it works on any static host with no server configuration — including
GitHub Pages, which cannot be told to fall back to `index.html`. That means you can start on a free
address and move to your own domain later without touching the code or losing a single response.

### 2.1 Push the code to GitHub

The project is a local git repository with no remote yet. Put it on the same account as the
Fieldwork app:

```bash
gh repo create pob099-maker/pt25003-consultation --public --source . --push
```

**Public, not private.** GitHub Pages only publishes from a private repository on a paid plan, which
is why `potatolink-fieldwork` is public too. Nothing secret lives in this repository: the Supabase
values are Actions variables, `.env.local` is git-ignored, and the anon key is designed to be
readable by every respondent anyway.

### 2.2 Publish on GitHub Pages

The same arrangement as `potatolink-fieldwork`, and the workflow is already in the repository at
`.github/workflows/deploy.yml`. It runs lint, typecheck and tests first, and only publishes if they
pass.

1. Repository → **Settings** → **Pages** → **Source: GitHub Actions**.
2. Repository → **Settings** → **Secrets and variables** → **Actions** → **Variables** tab → **New
   repository variable**, once for each:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Project URL from step 1.4 |
   | `VITE_SUPABASE_ANON_KEY` | anon public key from step 1.4 |
   | `VITE_HOME_URL` | `https://potatolink.com.au` |
   | `VITE_PROJECT_CONTACTS` | `Peter O'Brien\|0409 773 111\|` |
   | `VITE_PRIVACY_CONTACT_NAME` | whoever answers privacy questions |
   | `VITE_PRIVACY_CONTACT_EMAIL` | their address |

   Variables, not Secrets: these end up in the published bundle by design, and a Secret would only
   hide them from you. The Supabase **service_role** key is the one that must never go in either.

   Leave `VITE_BASE` unset. It is only needed if you publish at the GitHub address rather than the
   custom domain, in which case set it to `/pt25003-consultation/` — leading and trailing slashes
   included.
3. Push to `main`, or **Actions** → **Deploy** → **Run workflow**.

The site is live at `https://pob099-maker.github.io/pt25003-consultation/` while the domain is being
sorted out.

### 2.3 Point `consultation.agaims.com.au` at it

**Until the DNS record exists, the site is published at the GitHub address** and the repository
variable `VITE_BASE` is set to `/pt25003-consultation/`. A `public/CNAME` file would claim the
custom domain the moment it was published, and GitHub would then send every visitor to a name that
does not yet resolve — so the file is added at cutover, not before.

At cutover, three things change together:

```bash
printf 'consultation.agaims.com.au
' > public/CNAME
git add public/CNAME && git commit -m "Claim the custom domain" && git push
gh variable delete VITE_BASE --repo pob099-maker/pt25003-consultation
```

Then enter the domain under **Settings → Pages**, wait for the DNS check, tick **Enforce HTTPS**,
and re-run the deploy. Leaving `VITE_BASE` set is the classic mistake: the page loads with no
styling at all, because it is looking for its assets under `/pt25003-consultation/`.


One CNAME record, which Brandon adds. The request is written out ready to send in
[DNS-REQUEST.md](DNS-REQUEST.md), along with what it does and does not touch — the Wix site on the
apex, the `www` record and the mail records all stay exactly as they are.

Once he confirms, follow the checklist at the end of that document: enter the domain under
**Settings → Pages**, wait for the DNS check, tick **Enforce HTTPS**, and redeploy.

Your link is then:

**`https://consultation.agaims.com.au`**

## Part 3 — Check it before anybody sees it

1. Open the link on your own phone, on mobile data rather than wi-fi.
2. Complete the consultation as a grower. Tick a couple of interests and put your own details in.
3. Sign in at `<your link>#/admin`. Your response should be there within seconds.
4. Check the **Contacts** tab shows your details, and that nothing on the screen connects them to
   your answers — that separation is what the privacy statement promises.
5. Press **Export responses (CSV)** and open it in Excel. Labels should read as words, not codes.
6. Try `#/admin` in a private window without signing in. You should see a sign-in form and no data.

---

## Part 4 — The day you send the link

1. **Clear the test data.** SQL Editor:

   ```sql
   delete from public.consultation_responses where is_test_data;
   delete from public.consultation_contacts  where is_test_data;
   ```

2. Confirm the admin screen now reads zero responses.
3. Check the contact name and number on the landing page are the ones you want people ringing.

### Wording for the comms

> **Potato Mechanisation Project — have your say**
>
> We are asking people across the Australian potato industry where mechanisation, automation and
> better digital tools would make the most practical difference. It takes about 8–10 minutes, on a
> phone or a computer, and you can answer anonymously — no sign-up, no account.
>
> https://consultation.agaims.com.au
>
> The questions adapt to your part of the industry, so you will only be asked about work you
> actually do. If you would rather talk it through than fill in a form, ring Peter O'Brien on
> 0409 773 111.

A QR code for the same link is worth putting on a field day flyer — any free QR generator will do,
and the link is short enough to scan reliably.

---

## Part 5 — While it is running

- Check the admin screen weekly. Responses, and who has volunteered for the reference group or a
  trial, are both on it.
- Follow up expressions of interest while the person still remembers answering.
- Export a CSV before any reporting deadline rather than at it.
- Keep an eye on the response mix by role. If contractors or packhouses are thin, that is a
  targeting problem to fix with a phone call, not something the tool can fix for you.
