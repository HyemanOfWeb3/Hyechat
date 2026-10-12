# HyeChat Roadmap Status

Last reviewed: 2026-10-12. Baseline: `main` at `23019be` (clean at audit start); audit fixes are currently local and uncommitted. No credential values or local `.env` values are recorded.

## Verified architecture and baseline

- React 19/Vite 8 frontend (`frontend/src/main.jsx`, `frontend/src/App.jsx`); Express 4/Mongoose API (`backend/src/server.js`, `backend/src/app.js`); Vercel adapter at `api/index.js`.
- Stream Chat is the message authority; Stream Video handles calls; Ably delivers notifications; Google Cloud APIs power text/audio translation. No MongoDB message store found.
- Models include users, friend requests, stories, communities, marketplace listings/reports, notifications, and call history.
- Node `22.20.0`, npm `10.9.3`, matching repository engine declarations. Vercel rewrites API and bot profile-preview traffic.
- Existing product areas are implemented to varying degrees: auth/email verification, profiles/social links/sharing, direct/group/community chat, voice notes, translation, stories, calls, notifications, discovery, communities, and HyeMarket. SEO metadata endpoints exist; full crawlability is incomplete. No native app/PWA detected. `/saved` is a placeholder.
- Baseline: `npm run test:stories` 17/17; `npm run test:profiles` 12/12; `npm run test:chat` 5/5; `node --test frontend/src/lib/avatar.test.js` 3/3; backend `node --check` all JS passed; `cd frontend && npm run build` passed with large-chunk warning.
- Baseline `npm run lint` had 7 voice-recording diagnostics; the existing handlers were wired and lint now passes.
- High-confidence secret-pattern scan: no matches in current tracked files or Git history. This is not a comprehensive scan: no dedicated secret scanner is installed, and provider dashboards were not inspected. No credentials were rotated.
- Final `npm audit`: root 0; backend 3 high (dev tooling); frontend 5 high / 2 moderate (build tooling). Production-only backend/frontend audits both 0. No auto-upgrades applied.
- Backend now declares `@stream-io/video-client` 1.53.2 in its own manifest/lockfile; it is already used by the frontend. Server-side membership checks are mocked in tests; live Stream credentials/provider behavior are not verified.

## Prioritized verified findings

1. **Fixed — call-history privacy:** name searches now intersect the authenticated participant filter and hidden-entry filter; regex input is escaped and capped. Regression tests are in `backend/src/controllers/callHistory.controller.test.js`.
2. **Fixed — Stream user-sync integrity:** `/api/chat/users/sync` rejects IDs other than the authenticated user and sources name/image from trusted `req.user`. No in-repository frontend caller exists. Regression tests are in `backend/src/controllers/chat.controller.test.js`.
3. **Fixed — email verification and auth throttling:** changed profile email invalidates verification and clears old OTP state; existing verification flow sends a new code. Signup, login, and password reset now throttle failed attempts using the existing limiter dependency. Its in-memory store is per process and needs shared storage for robust cross-instance production enforcement.
4. **Fixed — friend-request lifecycle:** resubmission ignores historical rejected records; acceptance atomically requires pending state. Regression tests cover declined retry, stale acceptance, and valid acceptance.
5. **Fixed in code — call-history authorization:** start/end verify the user against the Stream Video roster; participants and answered state come from provider data, and history remains open while users are connected. Provider behavior is mocked, not live. Stream Video singleton reset on logout/account change remains open.
6. **Fixed in code — JWT session revocation:** password change rotates the current HTTP-only cookie and increments an internal token version; password reset increments the same version; middleware rejects stale sessions and preserves legacy tokens only for version-zero accounts. Tests cover the transition; external browser session behavior still merits live verification.
7. **Fixed in code — API/UI error readiness:** unknown API paths, malformed JSON, and denied origins return sanitized JSON responses; Vercel `/health` pings MongoDB with a bounded timeout; SPA unknown routes show a responsive not-found screen; expected `/auth/me` 401s are handled without dumping Axios errors. Vercel's final 404 status and complete async-error coverage remain open.
8. **Needs fix — safety/data operations:** account deletion leaves call-history/community references (community ownership/retention needs a product decision); blocking does not revoke existing Stream DMs; story reports lack a moderation review route; rate limits are process-local; upload ownership/metadata are not provider-verified; no explicit CSRF/security-header policy is in the repo.
9. **Fixed — Story duration boundary:** controller, schema, upload path, and preview now use a strict 60-second maximum. Public profile endpoints use allowlists and have tests; social normalization, story privacy/reactions, chat scroll, and base UI flows have unit coverage. Community, provider translation/calls, notification authorization, and full browser behavior lack integration coverage. Vercel/static SEO, indexing policy, cleanup, and native/PWA remain incomplete or unverified.
10. **Fixed — Voice-note interaction:** microphone control now wires hold/release, keyboard activation, swipe-left/cancel, and visible upload errors; release before permission resolves will not start a late recording. Physical-device microphone and gesture checks remain needed.

## Current phase

- **Completed in this pass:** call-history search/write privacy, Stream user-sync integrity, friend-request lifecycle, email re-verification, failed-auth throttling, JWT session revocation, strict Story duration, voice-note lifecycle, sanitized API 404/parser/CORS errors, and Vercel database readiness check.
- **20-point launch checklist:**
- **1 Secrets — BLOCKED:** limited high-confidence pattern scan clean; comprehensive scanner/history review and provider access-policy verification remain.
- **2 Rotation — NOT APPLICABLE:** no exposure confirmed by the limited scan; no rotation without evidence/authorization.
- **3 Rate limits — NEEDS FIX:** auth/translation limits exist but use process-local stores; proxy/IP semantics are unverified.
- **4 Auth/authz — NEEDS FIX:** core routes protected and webhook signatures verified; full resource-by-resource audit remains.
- **5 Data ownership — NEEDS FIX:** call-history writes verify Stream membership; uploaded media ownership and account-deletion cleanup remain.
- **6 Input validation — NEEDS FIX:** many bounds exist; search/pagination and media ownership/metadata enforcement need more work.
- **7 Provider spend — BLOCKED:** app caps exist; hard budgets/quotas require Google/Stream/Ably/email dashboards.
- **8 Errors — NEEDS FIX:** API 404, parser, and CORS errors are sanitized/tested; async route failure and logging policy need a full review.
- **9 Monitoring — NOT IMPLEMENTED** in repository; deployment/provider alerting requires external setup.
- **10 Backup/restore — BLOCKED:** no repo evidence or isolated restore proof; requires database-provider access.
- **11 Failure/404 UX — NEEDS FIX:** API JSON 404 and Vercel Mongo readiness ping are implemented/tested; SPA not-found/status handling and broader network/provider failure UX remain incomplete.
- **12 Modest mobile — BLOCKED:** responsive UI exists; no low-end Android or physical-device check.
- **13 Performance — NEEDS FIX:** build succeeds; Stream Chat vendor chunk is ~1.38 MB and field Core Web Vitals/API latency were not measured.
- **14 SEO/share — NEEDS FIX:** profile OG exists; sitemap/robots and route-specific static metadata are absent/unverified.
- **15 Privacy/terms — NOT IMPLEMENTED/VERIFIED:** linked policies and legal review are outstanding.
- **16 Analytics — NOT IMPLEMENTED:** consent/privacy decision required before instrumentation.
- **17 E2E — NEEDS FIX:** 67 unit/controller test executions pass; no browser E2E suite or live provider journeys are verified.
- **18 Email/DNS — BLOCKED:** SMTP code exists; SPF/DKIM/DMARC, sender setup, bounce handling, and inbox placement need external checks.
- **19 Support — NOT IMPLEMENTED/VERIFIED:** no confirmed contact/support workflow found.
- **20 Rollback/incident — BLOCKED:** no checked-in runbook or Vercel rollback verification.
- **Verification:** security 26/26; stories 20/20; profiles 13/13; chat 5/5; avatar 3/3; backend syntax passed; frontend lint/build passed (existing Stream bundle-size warning). Playwright smoke checks covered login/signup/reset/unknown routes at 320/375/430 px: no horizontal overflow, no uncaught JS errors, unknown routes show 404 UI. `/auth/me` 401 was expected because backend was intentionally not started. Full audits: root 0, backend 3 high dev-only, frontend 5 high/2 moderate build tooling; production-only audits 0. No production/provider dashboard, live call, email, backup, restore, or deploy was performed.
- **Next:** implement shared/proxy-aware throttling and decide account-deletion retention; then verify provider budgets, backup/restore, deployment headers/monitoring, and browser/provider E2E. Never deploy, rotate credentials, or alter production data without authorization.
- Do not publish/deploy, alter credentials, perform destructive data actions, or force dependency upgrades.
