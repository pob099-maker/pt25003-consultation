# DNS request for `consultation.agaims.com.au`

One record to add. Copy the message below and send it to Brandon.

## What is being asked for, and why it is safe

The consultation is a static site hosted on GitHub Pages, published from
`https://pob099-maker.github.io/pt25003-consultation/`. Pointing a subdomain at it needs a single
CNAME record. Nothing else on the domain changes.

What already exists on `agaims.com.au`, checked before writing this:

| Record | Current value | Touched? |
| --- | --- | --- |
| `agaims.com.au` (apex) | A → 23.236.62.147 — the Wix site | **No** |
| `www.agaims.com.au` | CNAME → `www50.wixdns.net` — the Wix site | **No** |
| `agaims.com.au` MX | `mail.agaims.com.au` — email | **No** |
| `*.agaims.com.au` | No wildcard record exists | n/a — nothing to shadow |
| `consultation.agaims.com.au` | Does not exist | **This is the one being added** |

Because there is no wildcard, adding `consultation` cannot capture traffic meant for anything else,
and nothing else can capture it. The website and the email are untouched either way, and the record
can be deleted at the end of the project with no side effects.

---

## Message to send

> Hi Brandon,
>
> Could you please add one DNS record to **agaims.com.au** for me?
>
> **Type:** CNAME
> **Name / Host:** `consultation` (so it resolves as `consultation.agaims.com.au`)
> **Value / Target:** `pob099-maker.github.io.`
> **TTL:** 3600 (or whatever the panel's default is)
> **Proxy / CDN:** off, if the panel offers it — GitHub needs to see the request directly to issue
> the HTTPS certificate
>
> That is the only change. Please leave the apex A record (the Wix site), the `www` CNAME and the MX
> records exactly as they are — the website and email should be unaffected. There is no wildcard
> record on the domain, and `consultation` is not currently in use, so there should be nothing to
> conflict with.
>
> It is for a four-month industry consultation running on GitHub Pages. The certificate is issued
> automatically by GitHub once the record resolves, so there is nothing else needed at your end.
> When the project finishes the record can simply be removed.
>
> Could you let me know once it is in, and I will check it from this end?
>
> Thanks,
> Peter

---

## Once Brandon confirms

1. Check it has propagated:

   ```bash
   nslookup consultation.agaims.com.au 8.8.8.8
   ```

   You are looking for it to resolve via `pob099-maker.github.io`. Usually minutes, occasionally a
   few hours.

2. GitHub → repository **Settings** → **Pages** → **Custom domain** → enter
   `consultation.agaims.com.au` → **Save**. The repository already carries `public/CNAME` with the
   same value, so this should tick straight through.

3. Wait for **"DNS check successful"**, then tick **Enforce HTTPS**. The certificate can take up to
   fifteen minutes to issue; the box is greyed out until it exists.

4. Leave the `VITE_BASE` repository variable **unset**, or set to `/`. A custom domain serves from
   the root, not from `/pt25003-consultation/`. If it is set to the repository path the page will
   load with no styling — that is the symptom to recognise.

5. Redeploy: **Actions** → **Deploy** → **Run workflow**.

Your link is then:

**`https://consultation.agaims.com.au`**

The GitHub address keeps working as well, so nothing breaks in the meantime.

## Optional, later: verify the domain with GitHub

GitHub can verify that you control `agaims.com.au`, which stops anybody else pointing a GitHub Pages
site at one of your subdomains if this repository is ever deleted. It needs a second TXT record, and
the token comes from GitHub, so it is a separate request to Brandon:

GitHub → your account **Settings** → **Pages** → **Add a domain** → follow the instructions, then
send Brandon the TXT record it gives you.

Worth doing if the link is going out widely. Not needed for the site to work.
