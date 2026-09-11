# Going live

Everything needed to turn this repository into a link you can put in an email. Two jobs: a database
to collect responses, and a web address to send people to. Allow an hour, most of it waiting.

Nothing here needs a developer, but you will need:

- A Supabase account (the database).
- A Cloudflare, Netlify or Vercel account (the hosting). Free.
- Whoever controls DNS for `potatolink.com.au`, if you want the link on that domain.

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
2. Open `supabase/migrations/0001_consultation.sql` from this repository, copy the whole file, paste
   it into the editor.
3. **Run**. You should see "Success. No rows returned."

That created four tables and turned on row-level security. From this point:

| Who | Can do |
| --- | --- |
| Anyone with the link, not signed in | Add a consultation response; add a contact record; read the current question wording |
| A signed-in administrator | Read responses, read and delete contact records, tag comments, edit wording |
| Anyone else, including a stranger with the public key | Nothing |

### 1.3 Load the test data (recommended while setting up)

Same SQL editor, new query, paste `supabase/seed/test_data.sql`, **Run**. That gives you eight
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

### 2.1 Decide the address

| Option | Link | Notes |
| --- | --- | --- |
| **A subdomain of the project site** | `https://consultation.potatolink.com.au` | Recommended. Looks like it belongs to the project, which matters when you are asking people to give you commercially sensitive opinions |
| A free host subdomain | `https://pt25003-consultation.pages.dev` | Works immediately, no DNS needed. Fine for testing, weaker in a cold email |

You can start on the second and move to the first later without losing any data.

### 2.2 Put the code somewhere the host can see it

The project is a local git repository with no remote. Push it to GitHub (private is fine) so the
host can build from it:

```bash
gh repo create potatolink/pt25003-consultation --private --source . --push
```

Or create an empty repository on github.com and follow the two lines it gives you.

### 2.3 Connect the host — Cloudflare Pages

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the repository.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Environment variables** — add these before the first deploy:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | the Project URL from step 1.4 |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key from step 1.4 |
   | `VITE_HOME_URL` | `https://potatolink.com.au` |
   | `VITE_PROJECT_CONTACTS` | `Peter O'Brien\|0409 773 111\|` |
   | `VITE_PRIVACY_CONTACT_NAME` | whoever answers privacy questions |
   | `VITE_PRIVACY_CONTACT_EMAIL` | their address |

5. **Save and Deploy**. Two minutes later you have a working link on `*.pages.dev`.

These are read when the site is built, so changing one later needs a redeploy — one button in the
same dashboard.

### 2.4 Point the subdomain at it

In the Pages project → **Custom domains** → **Set up a custom domain** → enter
`consultation.potatolink.com.au`.

Cloudflare will show you a DNS record. Send this to whoever manages the domain:

> Please add a CNAME record:
> **Name:** `consultation`
> **Target:** `pt25003-consultation.pages.dev`
> **Proxy/CDN:** on, if the option is offered

It usually works within minutes, sometimes a few hours. The certificate is issued automatically, so
the link is `https://` with no further work.

---

## Part 3 — Check it before anybody sees it

1. Open the link on your own phone, on mobile data rather than wi-fi.
2. Complete the consultation as a grower. Tick a couple of interests and put your own details in.
3. Sign in at `<your link>/admin`. Your response should be there within seconds.
4. Check the **Contacts** tab shows your details, and that nothing on the screen connects them to
   your answers — that separation is what the privacy statement promises.
5. Press **Export responses (CSV)** and open it in Excel. Labels should read as words, not codes.
6. Try `/admin` in a private window without signing in. You should see a sign-in form and no data.

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
> https://consultation.potatolink.com.au
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
