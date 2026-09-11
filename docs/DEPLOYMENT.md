# Deployment

The build is a folder of static files. Supabase does the rest, so hosting costs little or nothing.

```bash
npm install
npm run build      # produces dist/
```

## Single-page routing

The app uses real URLs (`/about`, `/consultation`, `/admin`). Any host must rewrite unknown paths to
`index.html`, or a refresh on `/privacy` returns a 404.

### Netlify

Build command `npm run build`, publish directory `dist`. Add `public/_redirects` containing:

```
/*  /index.html  200
```

### Vercel

Framework preset "Vite". Add `vercel.json`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Cloudflare Pages

Build command `npm run build`, output directory `dist`. SPA rewriting is the default.

### A plain web server

Copy `dist/` anywhere and add the usual fallback. For nginx:

```
location / { try_files $uri $uri/ /index.html; }
```

## Environment variables

Set these in the host's dashboard, not in a committed file. They are read at **build** time, so a
change needs a redeploy.

| Variable | Required |
| --- | --- |
| `VITE_SUPABASE_URL` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Yes |
| `VITE_HOME_URL` | No |
| `VITE_PRIVACY_CONTACT_NAME` | No |
| `VITE_PRIVACY_CONTACT_EMAIL` | No |
| `VITE_PROJECT_CONTACTS` | No |

Never add the Supabase **service role** key. It bypasses every row-level security policy, and
anything in the bundle is public.

## Before sharing the link

- Run the migration and confirm `/admin` shows a sign-in form rather than data.
- Clear the seeded test data.
- Open the link on a phone, on mobile data, and complete the consultation once.
- Check that a submission appears in `consultation_responses`, and that one made without contact
  details leaves `consultation_contacts` empty.

## Rate limiting

Anyone with the link can submit, which is the point. Supabase applies its own request limits, and
the admin area can filter test data, but if the link is shared publicly and attracts junk, turn on
Cloudflare Turnstile or a host-level rate limit in front of the site rather than adding a login the
consultation is designed not to need.

## Size

The consultation bundle is about 530 kB (≈155 kB gzipped), most of it React and the Supabase
client. The admin area is a separate chunk loaded only at `/admin`, so a respondent on a paddock
connection never downloads it. Check the figure after adding a dependency: this tool is opened on
phones with poor signal, and every kilobyte is paid for by the person answering.
