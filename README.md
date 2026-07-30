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

- Auth (login, session, role-based route protection)
- Dashboard with live stats
- Consultant advanced search with **toggleable keyword filters** (by formation, rig
  type, skill, cert, software) and Any/All match modes
- Consultant detail page: profile, tagged keywords, resume upload
- Resume upload → text extraction (PDF/DOCX) → Claude structured extraction →
  auto-tagging with confidence scores
- Tickets: create and list
- Admin: create users, assign roles
- Activity log data model (logging is wired into consultant/ticket/resume actions)
- Evaluation data model (ready for an admin evaluations UI)

## What's left to build (next iteration)

- Evaluations UI (the data model and API pattern already exist — same shape as Tickets)
- Ticket detail page + comments thread (schema already supports `TicketComment`)
- Activity log viewer page (data is already being recorded)
- Bulk consultant import (CSV/Excel) for migrating your current consultant data
- Consultant edit form (currently only creatable via API — quick to add)
- Client-facing portal (the `CLIENT` role and route-permission structure already anticipate this)

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
