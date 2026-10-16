---
name: Clerk setup for imported apps
description: Replit-managed Clerk provisioning and verification when an imported app already contains Clerk code.
---

An imported app can have the expected Clerk client, server middleware, and proxy code while its Replit-managed Clerk tenant and development keys are still unprovisioned. A failed `clerk.browser.js` load can therefore be a setup gap rather than code divergence.

**Why:** The development preview failed to load Clerk until managed auth provisioning added the app's keys; the existing wiring did not need to change.

**How to apply:** Check Clerk management status first. If it is `not_configured`, use the Replit Clerk provisioning flow rather than asking for or editing managed keys. Restart both frontend and API workflows, then verify the public landing page, sign-in route, and API health endpoint. The development-key warning is expected.
