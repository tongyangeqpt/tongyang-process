# TONGYANG PROCESS — company website

This starter kit is for `tongyangprocess.com` and requires **no paid hosting and no npm dependencies**.

- Website: static HTML generated from editable JSON content.
- Visual CMS: [Pages CMS](https://app.pagescms.org/), using `.pages.yml`.
- Publishing: GitHub → Cloudflare Pages.
- SEO: server-rendered HTML, individual page titles, canonical URLs, sitemap and robots.txt.
- RFQs: email link (not a server-backed submission form). Configure a form service separately when needed.

## Before making the site public

1. Replace the placeholder industrial graphics with real company and factory photos.
2. Verify company information, public email, phone, services and certificate statements.
3. Add actual client-approved project references. No invented projects are included.
4. Review and approve every technical article and capability statement.
5. Verify that `tongyangprocess.com` is the intended main domain.

## Local build

Requires Node.js 20+.

```bash
npm run build
```

The output is the `dist/` folder. No `npm install` is necessary.

## Cloudflare Pages setup

- Connect to this GitHub repository.
- Production branch: `main`
- Framework preset: `None`
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `/` (default)

Preview the `pages.dev` URL before attaching your `.com` domain.

## Edit content without code

1. Open https://app.pagescms.org/ and sign in with GitHub.
2. Authorize the Pages CMS GitHub app for the `tongyang-process` repository only.
3. Choose `tongyang-process` and edit the **Homepage & company settings**, **Process solutions**, **Process equipment**, or **Technical articles**.
4. Saving changes commits JSON content to GitHub, and Cloudflare Pages rebuilds the site automatically.

To add new equipment or articles, use the CMS's **New** entry action. File names become the URL slugs.

You can upload media in Pages CMS; files are stored under `public/media/` and published at `/media/...`.

## Important: email DNS

This repository does not manage DNS. Do not delete or modify the MX, verification CNAME, SPF, DKIM or DMARC records for `typrocess.com` when connecting the website's domain.

## Ownership and security

Keep GitHub and Cloudflare under company accounts with 2FA. Never commit passwords, SSL private keys, internal quotations, unpublished technical drawings or confidential customer data to a **public** repository.
