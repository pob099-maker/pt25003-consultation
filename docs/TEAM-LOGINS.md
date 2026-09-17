# Team logins by invitation

How project staff get an account, choose their own password, and get access to the results.
Nobody ever sends anybody a password.

## Once only: Supabase settings

These are dashboard settings, done once for the project.

### 1. Where login links go

**Authentication → URL Configuration**
<https://supabase.com/dashboard/project/ihwwrtfuyhakcjkuaucz/auth/url-configuration>

| Setting | Value |
| --- | --- |
| Site URL | `https://consultation.agaims.com.au` |
| Redirect URLs → Add URL | `https://consultation.agaims.com.au/**` |

Until this is set, Supabase sends people to `http://localhost:3000`, which is a dead link.

### 2. The email templates

**Authentication → Emails → Templates**
<https://supabase.com/dashboard/project/ihwwrtfuyhakcjkuaucz/auth/templates>

The standard templates put the login token after a `#` in the link, which is where this app keeps
its page routes. The app copes with that, but these versions avoid the problem entirely by putting
the token before the `#`.

**Invite user** — subject: `You're invited to the PT25003 consultation team`

```html
<h2>You're invited to the PT25003 consultation team</h2>
<p>You've been added to the project team for the Potato Mechanisation Project consultation.</p>
<p>Choose your password here — the link works once:</p>
<p><a href="{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=invite#/set-password">Set my password</a></p>
<p>If you weren't expecting this, you can ignore it.</p>
```

**Reset password** — subject: `Reset your PT25003 consultation password`

```html
<h2>Reset your password</h2>
<p>Someone asked to reset the password for this address on the PT25003 consultation.</p>
<p><a href="{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=recovery#/set-password">Choose a new password</a></p>
<p>If that wasn't you, ignore this email — nothing has changed.</p>
```

## Every time: adding a person

1. **Invite them** — <https://supabase.com/dashboard/project/ihwwrtfuyhakcjkuaucz/auth/users> →
   **Add user → Send invitation** → their email.
2. **They set their own password** from the email.
3. **Give them access** — in the tool, **Admin → Team → Add to the team**, with their email.

Step 3 is what lets them see results. Signing in alone shows nothing, which is deliberate: an
account and access to other people's answers are two separate decisions.

## Removing a person

**Admin → Team → Remove.** They can still sign in, but see nothing. To remove the account itself,
delete the user in Supabase as well.

Two guards: nobody can remove themselves, and the last administrator cannot be removed — so the
project is never locked out of its own results.

## Forgotten passwords

**Forgot your password?** on the sign-in page. The message afterwards is the same whether or not
the address has an account, so the form cannot be used to find out who is on the team.
