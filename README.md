# HITFAT RUN CLUB

**Run together. Train smarter.** A mobile-first running PWA for the Malaysian running community, starting with Kelantan.

Structured training plans on your own weekdays, run logging, progress and personal bests, community runs with RSVP,
and achievements that reward showing up. Bahasa Malaysia first, English, light and dark themes.

- Static site, no build step: vanilla ES modules (`js/`), deployed on Netlify from the repository root.
- Data and sign-in: the HITFAT Supabase project (same HITFAT account as the other HITFAT apps).
- Rules that must hold for every client run in Postgres, guarded by Row Level Security (`db/`).

## Setup

1. Supabase SQL editor: run `db/001_run_club_phase1.sql`, then `db/002_seed_programs.sql`.
2. Supabase → Auth → URL Configuration → Redirect URLs: add this site's address with a trailing slash.
3. Make the first head coach and club captain (SQL in `docs/ARCHITECTURE.md`).
4. Head coach signs in and publishes the training plans under *Latihan → Semak pelan*.

No environment variables are needed for Phase 1.

## Tests

```sh
node tests/i18n.test.mjs                       # every string exists in BM and EN
PGHOST=… db/tests/run.sh                       # permission tests on a local Postgres
POSTGREST=… PLAYWRIGHT=… node tests/e2e.mjs    # full journey in a browser against Postgres + PostgREST
```

Training content is regenerated with `node db/seed/programs.mjs > db/002_seed_programs.sql`.

Audit, architecture, phase plan, privacy model and risks: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
