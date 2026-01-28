# BA6 Support Docs

This is the public docs site for BA6, built with Next.js + Nextra.

## Deploy on Vercel

1) Create a new Vercel project for this repo.
2) Set **Root Directory** to `support`.
3) Build command: `npm run build` (default).
4) Output directory: leave blank (Next.js handles it).
5) Add a domain like `support.ba6-bsky-suite.com` in Vercel.
6) Update DNS with a CNAME:

```
support -> cname.vercel-dns.com
```

No environment variables are required.

## Local dev

```
npm --prefix support install
npm --prefix support run dev
```

## Support contact

Email: archie@ba6-bsky-suite.com
