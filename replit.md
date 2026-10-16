# SMS Compliance Assistant

A guided onboarding app that helps businesses prepare truthful SMS campaign registrations, publish consent materials, and check readiness before submitting to Twilio. The product goal is to help users catch preventable gaps and prepare complete, consistent details; never promise or imply first-pass approval.

## Run & Operate

- `pnpm --filter @workspace/sms-compliance-assistant run dev` — run the web app
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required setup: Replit-managed Clerk authentication and `DATABASE_URL` for PostgreSQL. `OPENAI_API_KEY` enables campaign assistant responses and is not needed for the rest of the app.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sms-compliance-assistant` — React web app and customer workflows
- `artifacts/api-server` — shared Express API, Clerk middleware, and business endpoints
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema` — Drizzle database schema
- `lib/api-client-react/src/generated` and `lib/api-zod/src/generated` — generated from the OpenAPI contract

## Architecture decisions

- Start with the managed-ISV onboarding path; customer-owned Twilio accounts are a later milestone.
- Mock submissions only create local registration records. They never contact Twilio or imply approval.
- Campaign assistant requests send saved campaign fields and any generated public policy text to OpenAI from the API server; never expose `OPENAI_API_KEY` to the browser.
- Business records are scoped to the authenticated Clerk user. Public policy pages expose only the generated policy content.
- Generated privacy and SMS terms are editable starting points and must be reviewed against the business's actual practices.

## Product

- Guided business and campaign intake
- User-reviewable campaign and sample-message drafts for the SMS registration
- Copyable website opt-in HTML with an optional, unchecked SMS consent checkbox; businesses must connect their own form handler to capture consent
- SMS consent and policy material generation with a public page
- Readiness checks for campaign descriptions, sample messages, affirmative consent, and public disclosures
- Dashboard and saved mock registration status

## User preferences

-

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.
- Keep the mock-vs-live distinction visible in all registration status UI; no live Twilio submission is implemented yet.
- The public compliance page is intentionally unauthenticated and keyed by a random slug; all business and registration API routes require a signed-in user.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
