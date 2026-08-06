# Benchmark Engineering Consultant Platform

A custom-built replacement for the Base44 prototype — full control over data, auth, and
the resume-parsing/keyword-search feature that a no-code builder can't do well.

## Stack

- **Next.js 14** (React + TypeScript) — frontend + API routes in one app
- **PostgreSQL + Prisma** — data model for consultants, keywords, tickets, users
- **NextAuth (Auth.js)** — self-hosted credentials-based auth with roles (ADMIN / RECRUITER / VIEWER, plus CLIENT reserved for later)
- **Claude API** — resume parsing: extracts name, title, years of experience, and tags
  formations / rig types / skills / certifications / software as structured keywords
- **S3-compatible storage** — resume file storage (AWS S3 or Cloudflare R2)
- **Tailwind CSS** — styling

## What's built

- Auth (login, session, role-based route protection) with 5 roles: Admin, Recruiter,
  Viewer, Consultant (self-service), and Client (reserved for later)
- **Public "Apply" page** (`/apply`, no login) — candidates submit their info, pick a
  discipline (Drilling / Completions / Both), and upload a resume
- **Admin application review** (`/admin/applications`) — see submitted applications
  with AI-extracted keywords, Accept or Reject
- **Auto-invite on acceptance** — accepting an application creates their Consultant
  record and emails them a signup link (using the email they applied with) to set
  their own password
- **Consultant self-service portal** (`/my-tickets`) — once logged in, a consultant
  sees only their own required certifications (based on their discipline) and can
  add/renew their own tickets, optionally uploading proof documents
- **Ticket Types admin page** (`/admin/ticket-types`) — you control the master list of
  required certifications per discipline (H2S Alive, Fall Protection, etc.) — nothing
  is hardcoded
- **Daily expiry email alerts** — a scheduled job checks for tickets expiring within
  60 days and emails the consultant (via Resend)
- **Bulk CSV import** (`/admin/import`) — import your existing consultants and their
  tickets at once. Ticket expiry dates auto-calculate from the ticket type's default
  validity period if left blank, and keyword columns (formations, rig types, skills,
  certs, software) get matched/created and tagged on each consultant automatically
- **Client evaluations** (`/admin/evaluations`) — generate a shareable link per
  consultant (no login required for the client), collect a 1-5 rating and comments,
  and see results both on the Evaluations dashboard and on the consultant's own profile
- **Brand-matched visual design** — navy/gold color palette, hardhat logo mark, and
  bold rounded headings matching your reference design, applied across the login
  page, the public Apply page hero, and navigation throughout the app
- Dashboard with live stats
- Consultant advanced search with **toggleable keyword filters** (Canadian formations,
  rig types, skills, certs, software) and Any/All match modes
- Consultant detail page: profile, tagged keywords, tickets, resume upload
- Resume upload → text extraction (PDF/DOCX) → Claude structured extraction →
  auto-tagging with confidence scores
- Admin: create internal users, assign roles
- Activity log data model (logging is wired into key actions)
- Evaluation data model (ready for an admin evaluations UI)

## What's left to build (next iteration)

- Activity log viewer page (data is already being recorded)
- Consultant edit form (currently only editable via API — quick to add)
- Client-facing portal (the `CLIENT` role and route-permission structure already anticipate this)
- "Resend invite" button for an application whose invite email needs to go out again
- Downloadable CSV templates for the bulk import (currently the expected columns are
  documented on the Import page itself)
- Extending the new navy/gold visual style more deeply into the internal admin pages
  (currently applied to login, the public apply page, and navigation — the rest of
  the app already inherits the new color tokens automatically but hasn't been
  individually polished)

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — a Postgres connection string. Easiest options: [Neon](https://neon.tech) or [Supabase](https://supabase.com), both have free tiers.
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `ANTHROPIC_API_KEY` — your Claude API key from [console.anthropic.com](https://console.anthropic.com)
   - `S3_*` — an S3 bucket (AWS) or R2 bucket (Cloudflare, cheaper egress) for resume storage
   - `RESEND_API_KEY` — sign up free at [resend.com](https://resend.com), create an API key. Their
     test domain (`onboarding@resend.dev`) works immediately for testing; for production you'll want
     to verify your own domain in their dashboard so emails come from your own address.
   - `CRON_SECRET` — generate with `openssl rand -base64 32`. When deployed on Vercel, this is
     automatically sent as a Bearer token to your cron endpoint — you don't need to configure
     anything else, Vercel reads the `vercel.json` in this project and calls
     `/api/cron/ticket-expiry` once a day automatically.

3. Push the schema and seed starter data:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npx prisma db seed
   ```
   This creates a first admin login: `admin@benchmarkeng.com` / `ChangeMe123!` —
   **change this password immediately after first login** (via the admin users page,
   or directly in the database until a "change password" UI is added).

4. Run it:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`.

## Migrating your existing consultant data

Once you export your current consultants/tickets from Base44 (usually CSV or JSON),
the fastest path is a one-off script using the same Prisma client — I can write this
once I see the shape of your export file. It'll map your existing fields into the
`Consultant`, `Keyword`, and `Ticket` tables and can even run each consultant's
existing resume through the same Claude parsing pipeline in bulk.

## Deploying

- **App**: push this repo to GitHub, then import it into [Vercel](https://vercel.com) — zero config needed beyond the env vars above.
- **Database**: Neon or Supabase both work well with Vercel and have generous free tiers to start.
- **File storage**: AWS S3 or Cloudflare R2 (R2 has no egress fees, worth it if resumes get downloaded often).

## Notes on the keyword/search design

Keywords are stored as a typed taxonomy (`FORMATION`, `RIG_TYPE`, `SKILL`,
`CERTIFICATION`, `SOFTWARE`) rather than free-text tags. This is what powers the
toggle-style filter UI on the Consultants page — each keyword becomes a clickable
chip, and you can require **any** selected keyword to match or **all** of them.
New keywords are created automatically the first time Claude extracts them from a
resume (or you can add them manually from the search page/admin), so the taxonomy
grows on its own as you upload more resumes without needing a fixed master list up front.

