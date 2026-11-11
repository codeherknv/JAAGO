# Project Progress: Jaago Platform

## Status Overview
- **Core Architecture:** Phases 1 to 5 built, hardened, and verified.
- **Audit & Security Hardening:** Complete implementation of all audit fixes, negative security tests, and role boundaries.
- **Admin Control Center & Notifications:** Full `/admin` dashboard deployed (officer allow-list, triage queue, dispute arbitration, invalidation) and multi-channel notifications system (in-app + Nodemailer) with automated 72h reminders.
- **Verification Summary:** All 18 integration and audit tests (`npm run test:fixes`), spatial tests (`npm run test:spatial`), and end-to-end tests (`npm run test:e2e`) pass cleanly. Next.js production build and linting complete with 0 errors.

---

## Architectural Hardening & Remediation Details

### 1. Cloudinary Asset Size, Format Checks & Transformation Stripping
- **Authoritative Asset HEAD Check:** `verifyCloudinaryAssetSize(url)` strips any transformation parameters from the Cloudinary delivery URL using `getOriginalCloudinaryUrl(url)`:
  - Example: `https://res.cloudinary.com/cloud/image/upload/w_800,c_fill,q_auto/v12345/jaago_complaints/sample.jpg` is stripped to `https://res.cloudinary.com/cloud/image/upload/v12345/jaago_complaints/sample.jpg` so that the HEAD request interrogates the raw uploaded asset rather than an on-the-fly resized derivative.
- **HEAD Rejection Rules:**
  - If the HTTP `HEAD` request fails (non-2xx response or network failure), the upload is rejected.
  - If the `Content-Length` header is missing, the upload is rejected.
  - If `Content-Length` exceeds 5MB (`5 * 1024 * 1024` bytes), the upload is rejected.
- **Upload API Parameter Alignment:** The signing route `app/api/uploads/sign/route.ts` specifies `allowed_formats: 'jpg,jpeg,png,webp'` in snake_case, sorted alphabetically in the signature string (`allowed_formats=...&folder=...&timestamp=...`), and `lib/cloudinaryClient.ts` appends `allowed_formats` to `FormData` when executing the direct upload to `https://api.cloudinary.com/v1_1/<cloud>/image/upload`.
- **Mock HEAD Testing:** Integration test suite mocks the HEAD path verifying 404 failure, missing Content-Length, oversized Content-Length, and proper transformation URL stripping.

### 2. Negative Authorization Tests & Officer Ward Isolation
- **Comprehensive Admin 401 & 403 Enforcement:** Every `/api/admin/*` endpoint was tested and verified:
  - Anonymous callers (no session/credentials) receive HTTP `401 Unauthorized`.
  - Authenticated callers with `citizen` or `officer` role receive HTTP `403 Forbidden`.
  - Covers all 9 admin endpoints:
    1. `GET /api/admin/officers`
    2. `POST /api/admin/officers`
    3. `PATCH /api/admin/officers/[id]`
    4. `GET /api/admin/triage`
    5. `PATCH /api/admin/complaints/[id]/assign`
    6. `GET /api/admin/disputes`
    7. `PATCH /api/admin/complaints/[id]/arbitrate`
    8. `PATCH /api/admin/complaints/[id]/reject`
    9. `GET /api/admin/metadata`
- **Officer Ward Jurisdiction Guard:**
  - In `app/api/complaints/[id]/resolve/route.ts` and `app/api/complaints/[id]/status/route.ts`, if caller is an officer, `officer.assignedWardId` must match `complaint.wardId`.
  - Officers attempting to resolve or change the status of complaints outside their assigned ward jurisdiction are blocked with HTTP `403 Forbidden`.

### 3. Idempotent 72-Hour Verification Reminder
- **Schema Update:** Added `reminderSentAt?: Date` to `models/Complaint.ts` (with an index).
- **Single Dispatch Guarantee:**
  - The cron auto-close handler (`app/api/cron/auto-close/route.ts`) queries complaints in `Pending Verification` with `verificationDeadline` $\le 48\text{h}$ from now and `reminderSentAt: { $in: [null, undefined] }`.
  - When the reminder is dispatched, `complaint.reminderSentAt = now` is committed to the database.
  - Subsequent cron executions detect `reminderSentAt` and skip dispatching duplicate reminders.
  - Reset on Re-resolution: If a ticket is reopened and subsequently re-resolved by an officer, `reminderSentAt` is cleared so that the new resolution audit cycle receives its reminder.

### 4. Unrouted Complaints Isolation (Admin Triage Only)
- **Public & Officer Filtering:**
  - In `app/api/complaints/route.ts` (GET), requests without a specific `wardId` parameter default to `{ wardId: { $ne: null, $exists: true } }`. Unrouted complaints with no ward are never leaked in public lists.
  - In `app/explore/page.tsx` and `components/CivicLeafletMap.tsx`, complaints without a `wardId` are filtered out and never plotted on the public GIS map.
  - In `app/officer/dashboard/page.tsx`, complaints without a `wardId` are filtered out.
  - In `lib/leaderboard.ts`, only complaints with a valid `wardId` are aggregated.
- **Admin Triage Queue:**
  - `GET /api/admin/triage` specifically queries `$or: [{ wardId: null }, { agencyId: null }, ...]` to surface unrouted tickets for manual municipal assignment.

### 5. Civic Trust Index (CTI) Refinements & Sample Thresholds
- **Closed Tickets as Authoritative Denominators:**
  - Denominator: `closedCount = complaints.filter(c => ['Resolved - Citizen Verified', 'Resolved - Auto Closed'].includes(c.status)).length`.
  - Participation Rate: `(citizenVerifiedCount / closedCount) * 100`.
  - Reopen Rate: `reopenedClosedTickets / closedCount`.
  - SLA Compliance Rate: `slaCompliantClosedTickets / closedCount`.
- **Minimum Statistical Threshold ($\ge 10$ Closed Tickets):**
  - Wards with fewer than 10 closed complaints are marked `hasEnoughData: false`, with `ctiScore: null` and `rank: null`.
  - In `app/leaderboard/page.tsx`, these wards display a clear **"Not enough data"** badge and sample size notice (e.g. `5 (< 10 min)`), preventing skewed rankings or `NaN` values.
  - Ranked wards ($\ge 10$ closed tickets) receive numeric ranks (`#1`, `#2`, etc.) sorted descending by `ctiScore`.
- **Transparent Metric Breakdown:**
  - Public leaderboard displays sample size (`closedCount`), participation rate, citizen-verified count, and auto-closed count separately.
- **Edge Case Unit & Integration Tests:**
  - Zero-ticket ward: `closedCount=0`, `hasEnoughData=false`, `ctiScore=null`, no `NaN`.
  - Small-sample ward: `closedCount=5`, `hasEnoughData=false`, `participationRate=80%`.
  - Large-sample ward: `closedCount=12`, `hasEnoughData=true`, `ctiScore=87`, ranked `#1`.

### 6. First Admin Creation Integrity
- **Restricted Elevation:** In `lib/auth.ts`, user auto-provisioning via Credentials or OAuth defaults strictly to `role: 'citizen'`. Upgrades to `role: 'officer'` occur only if the email is on the active `OfficerAllowList`.
- **Public Sign-Up Protection:** No public sign-up or registration path can grant or request `role: 'admin'`.
- **Admin Ingress:**
  - Seeded Admin: Created via `scripts/seedPilot.ts` (`admin@demo.jaago.app` with `role: 'admin'`).
  - Environment Variable Ingress: If `process.env.ADMIN_EMAIL` is explicitly set, an account registered with that exact configured email receives `role: 'admin'`.

---

## Test & Build Verification Results

- `npm run test:fixes`: **PASS (18 / 18 passed)**
  1. Real `POST /api/uploads/sign` Cloudinary signature parameters & dev/prod error gating
  2. `imageProofSchema` strict HTTPS Cloudinary URLs & test-only base64 gating
  3. Server-side asset size check with mocked HEAD paths (404 rejection, missing header, oversized asset, transformation stripping)
  4. GPS accuracy quality gate (accuracy $> 50\text{m}$ rejected with retry-in-open guidance; $\le 50\text{m}$ accepted)
  5. Real `POST /api/complaints` duplicate re-check (409 Conflict vs 201 Created with `confirmDistinct`)
  6. `CRON_SECRET` header authorization on `POST /api/cron/auto-close`
  7. Credentials login provider dynamically gated by `DEMO_AUTH=true`
  8. Database-backed rate limiting (3 complaints / hour enforced via MongoDB timestamp query)
  9. Admin Officer Allow-List management (`GET /api/admin/officers`, `POST /api/admin/officers`, `PATCH /api/admin/officers/[id]`)
  10. Admin Triage & manual ward/agency assignment (appends to `statusHistory`)
  11. Admin Dispute arbitration queue & resolution (appends to `statusHistory`)
  12. Admin Complaint invalidation with required reason (appends to `statusHistory`)
  13. Notifications subsystem & 72h reminder idempotence (verified `reminderSentAt` and single dispatch across 2 cron runs)
  14. `lib/apiAuth.ts` test-only auth shortcut safety audit
  15. Negative tests: all 9 admin endpoints return 401 for anonymous and 403 for citizen/officer; officer outside ward returns 403 on resolve and status update
  16. Unrouted complaints isolation: tickets without `wardId` excluded from explore, leaderboard, officer dashboard, and public list; present strictly in admin triage
  17. Civic Trust Index (CTI) refinements: closed ticket denominators, sample size threshold ($\ge 10$), separate verified/auto-closed metrics, and zero/small-sample edge cases
  18. First admin integrity: confirmed admin can only originate from seed or `ADMIN_EMAIL` env variable; public sign-up cannot elevate to admin
- `npm run test:spatial`: **PASS (3 / 3 passed)**
  1. Boundary auto-routing ($geoIntersects)
  2. Ingestion deduplication (40m radius category-aware $near)
  3. Scalable atomic upvoting
- `npm run test:e2e`: **PASS (7 / 7 passed)**
  1. Ward boundary auto-routing
  2. 40m proximity deduplication
  3. Scalable atomic upvoting
  4. Location-verified resolution gate
  5. 5-day citizen audit & dispute circuit breaker
  6. 120h auto-close daemon audit
  7. Civic Trust Index formula verification
- `npm run lint`: **PASS (0 errors, 12 warnings for unoptimized images / react hooks dependencies)**
- `npm run build`: **PASS (Next.js production build compiled successfully, 10 static/dynamic routes generated)**
