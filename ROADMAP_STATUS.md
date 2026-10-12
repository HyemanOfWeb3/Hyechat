# HyeChat Roadmap Status

Last reviewed: 2026-10-12. Branch: `main` at `759c555` (clean at audit start). No credentials or local `.env` values included.

## Verified architecture and baseline

- React 19/Vite 8 frontend (`frontend/src/main.jsx`, `frontend/src/App.jsx`); Express 4/Mongoose API (`backend/src/server.js`, `backend/src/app.js`); Vercel adapter at `api/index.js`.
- Stream Chat is the message authority; Stream Video handles calls; Ably delivers notifications; Google Cloud APIs power text/audio translation. No MongoDB message store found.
- Models include users, friend requests, stories, communities, marketplace listings/reports, notifications, and call history.
- Node `22.20.0`, npm `10.9.3`, matching repository engine declarations. Vercel rewrites API and bot profile-preview traffic.
- Existing product areas are implemented to varying degrees: auth/email verification, profiles/social links/sharing, direct/group/community chat, voice notes, translation, stories, calls, notifications, discovery, communities, and HyeMarket. SEO metadata endpoints exist; full crawlability is incomplete. No native app/PWA detected. `/saved` is a placeholder.
- Baseline: `npm run test:stories` 17/17; `npm run test:profiles` 12/12; `npm run test:chat` 5/5; `node --test frontend/src/lib/avatar.test.js` 3/3; backend `node --check` all JS passed; `cd frontend && npm run build` passed with large-chunk warning.
- `cd frontend && npm run lint` fails on 7 existing voice-recording diagnostics in `ChatPage.jsx` (unused state/handlers and state update in effect).
- Baseline `npm audit`: root 0; backend 3 high; frontend 5 high / 2 moderate. Production-only audits report 0 advisories in backend/frontend. Full-tree findings are development/build dependencies; no automatic dependency changes made.
- Production-only `npm audit --omit=dev`: backend 0, frontend 0. Full-tree findings are dev/build dependencies; available fixes include major upgrades, so none were applied.

## Prioritized verified findings

1. **Fixed — call-history privacy:** name searches now intersect the authenticated participant filter and hidden-entry filter; regex input is escaped and capped. Regression tests are in `backend/src/controllers/callHistory.controller.test.js`.
2. **Fixed — Stream user-sync integrity:** `/api/chat/users/sync` rejects IDs other than the authenticated user and sources name/image from trusted `req.user`. No in-repository frontend caller exists. Regression tests are in `backend/src/controllers/chat.controller.test.js`.
3. **Fixed — email verification and auth throttling:** changed profile email invalidates verification and clears old OTP state; existing verification flow sends a new code. Signup, login, and password reset now throttle failed attempts using the existing limiter dependency. Its in-memory store is per process and needs shared storage for robust cross-instance production enforcement.
4. **Fixed — friend-request lifecycle:** resubmission ignores historical rejected records; acceptance atomically requires pending state. Regression tests cover declined retry, stale acceptance, and valid acceptance.
5. **Calls:** client-supplied participant IDs can affect history visibility; unanswered call state can be overwritten; Stream Video singleton is not reset on logout/account change. Requires targeted provider/authorization review next.
6. **Safety/operations:** block does not revoke existing Stream DMs; Story reports lack a review API; rate limits use per-process memory; CSRF/response-header policy needs deployment-aware review.
7. **Fixed — Story duration boundary:** controller, schema, upload path, and preview now use a strict 60-second maximum. Public profile endpoints use allowlists and have tests; social normalization, story privacy/reactions, chat scroll, and base UI flows have unit coverage. Community, provider translation/calls, notification authorization, and full browser behavior lack integration coverage. Vercel/static SEO, indexing policy, cleanup, and native/PWA remain incomplete or unverified.
8. **Fixed — Voice-note interaction:** microphone control now wires hold/release, keyboard activation, swipe-left/cancel, and visible upload errors; release before permission resolves will not start a late recording. Physical-device microphone and gesture checks remain needed.

## Current phase

- **Completed in this pass:** call-history search privacy, Stream sync identity, friend-request lifecycle, email re-verification, failed-auth throttling, strict Story duration limit, and voice-note lifecycle/lint fixes; `npm run test:security` and `npm run test:stories` cover targeted regressions.
- **Next:** inspect CSRF/session behavior and call participant authorization. Stream Video reset still requires provider lifecycle review before implementation.
- Verification after current fixes: security 9/9; stories 20/20; profiles 12/12; chat 5/5; avatar 3/3; backend syntax checks passed; frontend lint passed; frontend production build passed with existing Stream Chat vendor chunk size warning. Production-only dependency audits found 0 advisories; full-tree dev/tool advisories remain. Changes are local and uncommitted; no deployment performed.
- Do not publish/deploy, alter credentials, perform destructive data actions, or force dependency upgrades.
