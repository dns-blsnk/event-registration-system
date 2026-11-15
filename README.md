# event-registration-system

Admin panel for events, sessions and registrations: four roles, a managed Postgres database, private object storage for event banners and an AI help chat that knows the screen you are on.

## Features

- **Events and sessions.** Organizers create events, add sessions with a capacity, publish, complete or cancel them. Events move only `DRAFT → PUBLISHED → COMPLETED` or to `CANCELLED`. Cancelling an event cancels all its registrations.
- **Booking with a waitlist.** A registration is `CONFIRMED` while seats are left and `WAITLISTED` after that. When a confirmed seat is freed, the first person on the waitlist moves up automatically. Seats are taken with a conditional `UPDATE ... WHERE confirmed_count < capacity` inside a transaction, so two people can never get the last seat.
- **Booking rules.** Customers book only published events and future sessions. They can never hold two confirmed seats in overlapping sessions. A session always lies within its event's dates.
- **Computed fields.** Seats left, fill rate per session and per event, total registrations, and an "almost full" filter (90% or more).
- **Roles.** Every route declares its access, and the server scopes every query to what that role may see. The admin hides what you cannot use, from the same permission matrix in `packages/shared`.

  |                   | Admin                                                           | Organizer                                   | Customer                         |
  | ----------------- | --------------------------------------------------------------- | ------------------------------------------- | -------------------------------- |
  | Users             | manage organizers and customers; admins only as **super admin** | –                                           | –                                |
  | Tags              | manage                                                          | read                                        | –                                |
  | Events / sessions | all                                                             | own events only                             | catalog of published events      |
  | Registrations     | all, bulk actions                                               | on own events, bulk "attended" and "cancel" | "My registrations": book, cancel |
  | Customers         | all                                                             | people booked on own events                 | –                                |
  | Logs              | read                                                            | –                                           | –                                |
  | Help chat         | yes                                                             | yes                                         | yes                              |

  A super admin is an admin who, on top, is the only one who can create, demote or delete admins and super admins; the last super admin can never be removed. So one admin can never lock another out.

- **Event banners** in private S3-compatible storage. The file type is checked by its content (magic bytes) and size before storing, and images are served through short-lived presigned links.
- **AI help chat.** A streamed answer about the field or screen you are on, generated from the same field descriptions the forms use. See [Help chat](#help-chat).
- **Sign-in.** Email and password, or GitHub when it is configured. Self-sign-up always creates a customer; only an admin gives staff roles.
- **Logs page** for admins: every server error and security event with its request id, kept for 7 days.

## Stack

| Part     | Technology                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces: `apps/api`, `apps/admin`, `packages/shared`, Node 24                                             |
| API      | Nest.js 12, Prisma 7 + PostgreSQL, Socket.IO, nestjs-pino                                                         |
| Admin    | Refine 5 + MUI 6, Vite                                                                                            |
| Storage  | S3-compatible: SeaweedFS locally and in CI, Cloudflare R2 in production                                           |
| Redis    | Short-lived shared state with TTLs: Redis locally and in CI, Render Key Value in production                       |
| AI       | Gemini (Google AI Studio free tier) through the OpenAI-compatible API, streamed; any such API works               |
| Tests    | Vitest; API integration tests against a real Postgres, React Testing Library for the admin, Playwright end to end |
| Hosting  | API and Postgres on Render, admin on Vercel (free plans)                                                          |

## Getting started

Requires Node 24 (`.nvmrc`), pnpm 10 (`corepack enable`) and Docker.

```sh
pnpm install                 # also generates the Prisma client and builds packages/shared
cp .env.example .env         # then fill in SESSION_SECRET and SEED_DEMO_PASSWORD
docker compose up -d         # postgres (5442), postgres-test (5443), Redis (6389), redis-test (6390), S3 (8333) and its bucket
pnpm db:reset                # apply migrations and load demo data (asks nothing, wipes the dev database)
pnpm dev                     # API on http://localhost:3000, admin on http://localhost:5173
```

`SESSION_SECRET` needs at least 32 random characters (`openssl rand -hex 32`); `SEED_DEMO_PASSWORD` must be 10 to 128 characters. The seed creates four demo accounts that all use `SEED_DEMO_PASSWORD`: `owner@demo.test` (super admin), `admin@demo.test`, `organizer@demo.test` and `customer@demo.test`, plus events, sessions, registrations and banners.

The chat needs `AI_API_KEY` (a Gemini key from [Google AI Studio](https://aistudio.google.com/api-keys); `AI_BASE_URL` and `AI_MODEL` switch to another OpenAI-compatible provider, with `AI_REASONING_EFFORT=default` for models that have no reasoning); without it the widget says the assistant is unavailable and everything else works. GitHub sign-in needs `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (callback `http://localhost:5173/api/auth/github/callback`); without them the button is hidden.

### Scripts

| Command                             | What it does                                                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | API and admin in watch mode                                                                                                                                                                 |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (strict type-checked rules, size limits)                                                                                                                                             |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                                                                                                                    |
| `pnpm typecheck`                    | TypeScript in every package                                                                                                                                                                 |
| `pnpm test`                         | All tests; API integration tests use `postgres-test`                                                                                                                                        |
| `pnpm test:e2e`                     | Playwright browser tests: seeds a fresh `ers_e2e` database on `postgres-test`, then runs the built API and the admin (first run: `pnpm --filter @ers/e2e exec playwright install chromium`) |
| `pnpm build`                        | Build every package                                                                                                                                                                         |
| `pnpm db:reset` / `pnpm db:seed`    | Recreate the dev database / load demo data                                                                                                                                                  |

## How it works

### Requests, sessions and CSRF

The admin calls the API on its own origin: `/api/*` goes through the Vite proxy locally and a Vercel rewrite in production. The session cookie is therefore first-party, `HttpOnly`, `SameSite=Lax` and, in production, `Secure` with the `__Host-` prefix. Only the SHA-256 of the session token is stored. Sessions last 7 days with a 24-hour idle timeout, and signing in always starts a new one.

Every state-changing request carries the session's CSRF token in `X-CSRF-Token`, compared in constant time. Passwords are hashed with argon2id. Login failures are limited both per client and per account.

### Errors

Expected failures are `DomainError`s with a code from `packages/shared`. A single exception filter turns every error into `{ statusCode, code, message, details?, requestId }` and never sends a stack trace. The admin shows the request id with the error, so a user can pass it on and it can be found on the Logs page.

### Logging

- **stdout** (Render Logs): one JSON line per request from nestjs-pino, plus business events at `info`.
- **`AppLog` table** (Logs page): server errors (5xx, failed or crashed chat answers) and security events (failed logins, forged or unknown session tokens, 403, CSRF failures, 429, rejected uploads, refused chat connections). A missing or expired session is routine and is not journalled. Ordinary 4xx answers stay in stdout only.
- Writes are buffered and flushed in batches, so logging never slows down or breaks a request, and entries survive a short database outage. There is a per-minute cap against floods.
- Passwords, cookies, session ids, CSRF tokens, chat tickets, API keys, request bodies and chat text are never logged.
- Entries older than 7 days are deleted every day and on start (a free instance may sleep through the scheduled run). If volume grows, the next step is daily partitions that are dropped instead of deleted.

### Help chat

The widget connects to the API over Socket.IO with a one-time ticket from `POST /api/chat/ticket` (60 seconds, bound to the user and session, stored as a hash). The API checks the origin, the ticket and a live session. It re-checks the session and the current role before every question, and closes sockets whose session has ended.

The prompt is built from the shared field descriptions of the screen the user is on, and only from what their role may see. The answer streams back and can be stopped. Each user may ask 10 questions a minute.

In production the socket connects to the API host directly (`VITE_CHAT_URL`), because Vercel rewrites do not carry WebSockets.

## Deployment

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, all tests against Postgres, Redis and S3 containers, the build and the Playwright browser tests on pushes to `main` and `dev` and on every pull request. Deploy (`.github/workflows/deploy.yml`) runs only after a green CI run of a push to `main`:

1. It asks Render to deploy that exact commit.
2. It waits until `/api/health` reports that commit with the database and Redis up.
3. It deploys the admin to Vercel.
4. It checks that the admin and its `/api` rewrite answer.

Until the deploy settings exist, the workflow skips itself. If only some settings exist, it fails.

### One-time setup

1. **Render.** Create a Blueprint from `render.yaml`. It creates the `ers-api` Docker service (migrations run on start), the `ers-db` Postgres and the `ers-kv` Key Value (Redis-compatible, reachable only from Render services). Then fill in the values marked `sync: false`:
   - `ADMIN_ORIGIN`: the Vercel URL;
   - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: Cloudflare R2, a private bucket and an API token limited to it;
   - optionally `AI_API_KEY`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

   `SESSION_SECRET` is generated by Render. Copy the deploy hook URL.

2. **Vercel.** Import the repository with Root Directory `apps/admin`. `apps/admin/vercel.json` sets the build, the `/api` rewrite, the CSP and security headers, and `VITE_CHAT_URL`.
3. **API host.** `vercel.json` names the API host once, `ers-api.onrender.com`. If Render gives the service a different URL, change it there; a test checks that the rewrite, CSP and chat URL agree.
4. **GitHub OAuth app** (optional). Callback `https://<admin-domain>/api/auth/github/callback`.
5. **GitHub repository settings.**
   - Secrets: `RENDER_DEPLOY_HOOK_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
   - Variable: `ADMIN_URL`.

## Known limitations and next steps

- **Direct calls to Render.** `TRUST_PROXY_HOPS=2` counts the Vercel and Render proxies. A client calling the `onrender.com` URL directly can forge its IP, which weakens per-IP rate limits. Login lockout also counts per account (20 failures per 15 minutes), which still bounds password guessing, at the cost that anyone can briefly lock out a known email. A shared secret header from the rewrite would close the IP gap.
- **Free Render plan.**
  - The Postgres database expires after about 30 days, so a lasting deployment needs a paid database.
  - An idle instance sleeps; the first request after a pause can time out at the Vercel proxy and needs a retry.
  - The Key Value instance keeps nothing on disk and Render may restart it at any time. Every key there is short-lived, so a restart only costs a new chat ticket, reset login failure counters and rate limits, and an empty chat history.
- **"Almost full" filter.** It runs two queries rather than one. A single query would need a generated column, and the 90% threshold would then live both in a migration and in `packages/shared`.
- **Waitlist after a conflict.** A waitlisted customer skipped because of an overlapping booking is promoted at the next change in that session, not immediately when the conflict disappears.
- **GitHub and existing accounts.** GitHub sign-in never links to an existing account with the same email, because sign-up does not verify emails. An existing user cannot add GitHub to their account.
