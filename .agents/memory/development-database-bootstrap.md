---
name: Development database bootstrap
description: Distinguishes a live API from an initialized development schema.
---

A newly provisioned development database may accept connections while containing none of the application's tables. The API health endpoint only reports that the server is running; it does not verify database schema readiness.

**Why:** A signed-in overview failed with a missing application table until the project's non-forced development schema push ran.

**How to apply:** After provisioning a development database, use the documented development schema-push command and verify an application query. Do not apply development commands to production; follow the project's publish workflow for managed production schema changes.
