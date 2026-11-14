# Event Registration System

Take-home project: admin panel for events, sessions and registrations with roles, managed DB, object storage and an AI help chat.

## Stack

- pnpm workspaces: `apps/api` (Nest.js), `apps/admin` (Refine + MUI + Vite), `packages/shared`
- Prisma 7 + PostgreSQL, S3-compatible storage (SeaweedFS locally and in CI, Cloudflare R2 in prod)
- Auth: server-side sessions in an HttpOnly cookie + CSRF token header; REST goes through Vercel rewrites, Socket.IO connects to the API directly with a one-time ticket
- Logs: nestjs-pino to stdout + `AppLog` table (7 days) shown in the admin

## Commands

```
pnpm install
docker compose up -d        # postgres (5442), postgres-test (5443), s3 (8333)
pnpm db:reset               # migrate + seed
pnpm dev                    # api + admin
pnpm lint | lint:fix | format | typecheck | test | build
```

## Git

- Conventional Commits in English: `feat(api): ...`, `fix(admin): ...`, `test(api): ...`, `refactor: ...`, `chore: ...`, `ci: ...`, `docs: ...`
- One logical change per commit, small commits. No `Co-Authored-By`, no mention of AI or co-authors
- Before every commit: lint, typecheck and tests are green

## Coding standards

Rules marked **[lint]** are enforced by ESLint or the TypeScript compiler; the build fails on them. The rest are reviewed by hand.

### General principles

- **DRY by knowledge, not by look.** Two pieces of code that must always change together share knowledge: extract them. Code that only looks alike but changes for different reasons stays separate. Extract on the third repetition, not the second
- **KISS and YAGNI.** Build what the task needs now. No speculative options, base classes or config for cases nobody asked for
- **Single responsibility.** A function does one thing; a module owns one domain. If a name needs "and", split it
- **No magic values [lint].** Numbers and strings with meaning become named constants: limits, timeouts, sizes, status codes, retention days, regexes. Allowed inline: `0`, `1`, `-1`, array indexes in obvious places, test data. Constants that the admin and the API both use live in `packages/shared`
- **Single source of truth.** Enums, roles, the permission matrix, error codes and field descriptions are defined once in `packages/shared` and imported everywhere
- **Fail fast at the edges, trust inside.** Validate input at the boundary (DTOs, env schema, socket payloads). Inside the domain, work with typed, already valid data
- **No dead code [lint]:** no unused variables, imports, parameters or commented-out code. No `TODO` without a reason in the report

### Size and complexity [lint]

| Rule                      | Limit                                                         |
| ------------------------- | ------------------------------------------------------------- |
| `complexity` (cyclomatic) | 10                                                            |
| `max-depth`               | 3                                                             |
| `max-params`              | 4 (otherwise one options object)                              |
| `max-lines-per-function`  | 60 (TSX components 120), blank lines and comments not counted |
| `max-lines` per file      | 300                                                           |
| `no-nested-ternary`       | on                                                            |

Tests, migrations and seed are exempt from size limits and `no-magic-numbers`.

### TypeScript [lint]

- `strict: true`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
- typescript-eslint `strict-type-checked` + `stylistic-type-checked`
- No `any`: use `unknown` and narrow. No non-null assertion `!`. No `@ts-ignore` (use `@ts-expect-error` with a reason, only in tests)
- `import type` for type-only imports; no default exports except where a framework requires them (Vite config, Refine pages loaded lazily)
- Exhaustive `switch` over unions and enums (`switch-exhaustiveness-check`)
- No floating promises: every promise is awaited, returned or explicitly `void`-ed with a reason
- `===` only; `const` by default; no `var`; no `console` (use the logger on the API, nothing in committed admin code)
- Import order and no import cycles (`import-x/order`, `import-x/no-cycle`)

### Naming

- `PascalCase`: classes, types, interfaces, enums, React components. `camelCase`: variables, functions, methods. `UPPER_SNAKE_CASE`: module-level constants with fixed values. Enum members `UPPER_SNAKE_CASE` (matches Prisma)
- Booleans read as questions: `isFull`, `hasSeats`, `canCancel`
- Functions are verbs (`promoteFromWaitlist`), values are nouns. No abbreviations except well-known ones (`id`, `url`, `dto`)
- Files: `kebab-case.ts`; Nest suffixes `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.guard.ts`; tests next to the code as `*.spec.ts`, integration tests in `test/integration/*.int-spec.ts`

### Comments

- Code says what; comments say why: a non-obvious business rule, a security reason, a workaround with a link. No comments that repeat the code
- Public functions of `domain/` and `packages/shared` get a short TSDoc line when the name alone does not explain the rule

### Errors

- Throw `DomainError(code, message, details?)` with a code from `packages/shared`; never throw strings or bare `Error` for expected cases
- The global exception filter is the only place that turns errors into HTTP responses: `{ statusCode, code, message, details?, requestId }`. No stack traces to the client
- Never swallow errors: an empty `catch` is forbidden **[lint]**. Catch only to add context, translate (e.g. Prisma error to `DomainError`) or recover on purpose
- Log once, at the boundary (filter or job runner), not at every layer

### Logging

- Use the injected pino logger, structured fields, never string concatenation: `logger.info({ eventId, count }, 'bulk status change')`
- Never log passwords, cookies, session ids, CSRF tokens, chat tickets, API keys, full request bodies or chat message text
- What goes to `AppLog`, what stays in stdout and how retention works: see the logging section of the README

### Backend (Nest.js)

- Feature modules under `src/modules/<feature>/` with controller, service, DTOs and specs together; cross-cutting code in `src/common/`
- Controllers are thin: validate the DTO, read the current user, call one service method, return. No Prisma and no business rules in controllers
- Business rules live in `src/domain/` as pure functions (no Nest, no Prisma) and in services that orchestrate them in transactions
- Only services use Prisma. Multi-step writes run in `prisma.$transaction`. Capacity checks use a conditional `UPDATE`, never read-then-write
- Every endpoint declares its access: `@Public()` or `@Roles(...)`; data is scoped in the service query (organizer sees own events only), not filtered after loading
- DTOs use class-validator with `whitelist` and `forbidNonWhitelisted`. Lists are paginated on the server with a maximum page size
- Config only through the typed config service validated with zod at startup; no `process.env` elsewhere **[lint]**

### Frontend (Refine + React)

- Follow the Refine docs: resources, `useTable`/`useDataGrid`, `useForm`, providers. Do not reimplement what Refine already provides
- Server state comes from Refine data hooks (TanStack Query underneath); no `useEffect` + `fetch`
- `useEffect` only to sync with something outside React (socket, DOM). Derived values are computed during render, not stored in state
- Keep state where it is used; lift it only when two components need it. Context only for truly global things (identity, chat)
- Components are small and do one thing; extract a custom hook when logic is reused or a component mixes data loading and rendering
- Typed props, no `any`; no `dangerouslySetInnerHTML` **[lint]**
- Access control through `accessControlProvider` and `<CanAccess>`, using the same permission matrix as the API
- Field labels and helper texts come from `packages/shared` field descriptions
- Accessibility basics **[lint]** (jsx-a11y): labels on inputs, alt text, buttons are buttons

### Tests

- Every behaviour gets a test: happy path, each validation failure, each role, each error code
- Unit tests for pure domain functions; integration tests against a real Postgres for endpoints, roles and transactions; no mocking of Prisma in integration tests
- One behaviour per test; the name says the rule: `rejects registration when the session is full`
- Tests are independent: each one creates its own data with factories; no shared mutable state, no order dependence
- A bug fix starts with a failing test

### Security checklist (every change)

- Input validated at the boundary; output never includes secrets or internal errors
- Authorization checked on the server for the specific record, not only the route
- No real secrets in code, tests or fixtures. `.env.example` keeps real secrets empty; it may contain the local-only docker-compose credentials, which never work outside a developer machine
- File uploads: type by content (magic bytes) and size limit before storing
