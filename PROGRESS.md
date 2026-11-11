# Project Progress: Jaago Platform

## Status Overview
- **Core Architecture:** Phases 1 to 5 built, hardened, and verified.
- **Audit & Security Hardening:** Complete implementation of all audit fixes, negative security tests, and role boundaries.
- **Officer Jurisdiction & Ward Isolation:** String-compared ward isolation with strict rejection of officers without assigned wards and complaints without ward routing.
- **Citizen Dashboard ("My Complaints"):** Dedicated `/my-complaints` page and `GET /api/complaints/my` endpoint surfacing all user-reported tickets, with explicit "Waiting for routing" badges for unrouted issues.
- **Admin Control Center & Notifications:** Full `/admin` dashboard deployed (officer allow-list, triage queue, dispute arbitration, invalidation) and multi-channel notifications system (in-app + Nodemailer) with automated 72h reminders.
- **Verification Summary:** All 19 integration and audit tests (`npm run test:fixes`), spatial tests (`npm run test:spatial`), and end-to-end tests (`npm run test:e2e`) pass cleanly. Next.js production build and linting complete with 0 errors.

---

## Architectural Hardening & Implementation Details

### 1. Enforcement of the 5MB Asset Limit
The 5MB image proof limit is strictly enforced in two distinct layers:

1. **Client-Side File Upload Guard (`lib/cloudinaryClient.ts` L11-L14):**
   - Before any network request or upload signature is requested, `uploadToCloudinary(file)` checks the native browser `File.size`:
     ```typescript
     const maxBytes = 5 * 1024 * 1024; // 5MB limit
     if (file.size > maxBytes) {
       throw new Error('File exceeds the strict 5MB limit. Please upload an image under 5MB.');
     }
     ```
   - Any oversized file is rejected instantly on the client without consuming server or Cloudinary bandwidth.

2. **Server-Side Ingest Verifier (`lib/validations.ts` L58-L98 via `verifyCloudinaryAssetSize`):**
   - For Cloudinary delivery URLs: strips on-the-fly transformations using `getOriginalCloudinaryUrl(url)` and issues an authoritative HTTP `HEAD` request to `res.cloudinary.com`.
   - Inspects the `Content-Length` header returned directly by Cloudinary's storage:
     - If the `HEAD` request fails (non-2xx response or network failure), the upload is rejected.
     - If the `Content-Length` header is missing, the upload is rejected.
     - If `Content-Length` exceeds 5MB (`5 * 1024 * 1024` bytes) or is $\le 0$, the upload is rejected.
   - Enforced across all image submission entry points:
     - `POST /api/complaints` (Complaint creation image)
     - `PATCH /api/complaints/[id]/resolve` (Field officer resolution proof photo)
     - `POST /api/complaints/[id]/verify` (Citizen contest proof photo)
   - For base64 data URIs (permitted strictly when `NODE_ENV === 'test'`), decoded byte length (`Math.ceil((base64Data.length * 3) / 4)`) is calculated and verified to be $\le 5\text{MB}$.

3. **Cloudinary Upload API Parameter Compliance (`app/api/uploads/sign/route.ts` & `lib/cloudinaryClient.ts`):**
   - Parameters not supported by Cloudinary's upload API (such as `maxFileSizeBytes`) were removed from signature computation and `FormData`.
   - The signed string contains strictly supported parameters in alphabetical order: `allowed_formats=jpg,jpeg,png,webp&folder=jaago_complaints&timestamp=<unix_time>`.

---

### 2. Officer Jurisdiction & Ward Boundary Guards
Field officer privileges are strictly restricted by ward assignment in [`app/api/complaints/[id]/resolve/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/resolve/route.ts) and [`app/api/complaints/[id]/status/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/status/route.ts):

- **Deny Officers with No Assigned Ward:**
  If `officer.role === 'officer'` and `!officer.assignedWardId`, the request is rejected with HTTP `403 Forbidden`:
  `"Forbidden: Officer has no assigned ward jurisdiction."`
- **Deny Action on Complaints with No Ward:**
  If `officer.role === 'officer'` and `!complaint.wardId`, the request is rejected with HTTP `403 Forbidden`:
  `"Forbidden: Officer action not permitted on unrouted complaint with no ward assignment."`
- **String ID Comparison:**
  Ward IDs are compared as primitive strings:
  `if (String(officer.assignedWardId) !== String(complaint.wardId))` &rarr; returns HTTP `403 Forbidden`:
  `"Forbidden: Officers are restricted to complaints within their assigned ward jurisdiction."`

---

### 3. "My Complaints" Citizen Dashboard & API
- **API (`GET /api/complaints/my`):**
  - Authenticated via `requireAuth(req)`.
  - Queries `{ reportedBy: user.id }` without ward filtering, ensuring the logged-in citizen always sees all their filed complaints, including unrouted issues.
  - Adds `routingStatus: c.wardId ? 'Routed' : 'Waiting for routing'` to each complaint record.
  - Returns HTTP `401` for anonymous callers.
- **User Interface (`app/my-complaints/page.tsx`):**
  - Displays summary metrics: Total Filed, In Verification, Resolved, and Waiting for Routing.
  - Tickets with no `wardId` feature an amber **"Waiting for routing"** badge (`<Clock /> Waiting for routing`).
  - Routed tickets display ward code (`W-150`, etc.) and assigned agency.
  - Integrated into [`components/Navbar.tsx`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/components/Navbar.tsx) navigation when logged in.

---

### 4. Civic Trust Index (CTI): Precise Mathematical Specification

The Civic Trust Index (CTI) is a 0 to 100 municipal accountability score computed per ward:
$$\text{CTI} = \text{round}\Big(100 \times \big[0.4 \times \text{CitizenVerifiedRate} + 0.4 \times \max(0, 1 - \text{ReopenRate}) + 0.2 \times \text{SLAComplianceRate}\big]\Big)$$

#### Universal Denominator: Closed Complaints (`closedCount`)
- **Definition:** The denominator for all rates is the total number of closed complaints in the ward:
  $$\text{closedCount} = \sum [\text{status} \in \{\text{'Resolved - Citizen Verified'}, \text{'Resolved - Auto Closed'}\}]$$
- **Statistical Significance Threshold ($\ge 10$):**
  - Wards with $\text{closedCount} < 10$ (including zero-ticket wards) are assigned `hasEnoughData: false`, `ctiScore: null`, and `rank: null`.
  - In the leaderboard UI, these wards display a clear **"Not enough data"** badge with sample size (e.g. `5 (< 10 min)`), preventing division-by-zero or skewed rankings.
- **Excluded Tickets:**
  - Active open tickets (`Pending`, `In Progress`, `Pending Verification`) and rejected invalid tickets (`Rejected - Invalid`) are excluded from the closed denominator.
  - Unrouted tickets with no `wardId` are excluded from all ward calculations and handled strictly in admin triage.

#### Numerators & Components
1. **Citizen Verified Rate (`CitizenVerifiedRate`):**
   - **Numerator:** Count of closed complaints where the citizen actively reviewed and confirmed resolution:
     $$\text{citizenVerifiedCount} = \sum [\text{status} = \text{'Resolved - Citizen Verified'}]$$
   - **Denominator:** $\text{closedCount}$
   - $\text{CitizenVerifiedRate} = \frac{\text{citizenVerifiedCount}}{\text{closedCount}}$

2. **Reopen Rate (`ReopenRate`) & How Reopened Complaints Count:**
   - **How Reopened Complaints Count:** A complaint counts in the reopen numerator if a citizen contested the resolution at least once during its lifecycle ($\text{reopenCount} > 0$), and the complaint subsequently reached a closed resolution (`Resolved - Citizen Verified` or `Resolved - Auto Closed`).
   - **Numerator:** Count of closed complaints in the ward with $\text{reopenCount} > 0$:
     $$\text{reopenedClosedCount} = \sum_{\text{closed}} [(\text{c.reopenCount} || 0) > 0]$$
   - **Denominator:** $\text{closedCount}$
   - $\text{ReopenRate} = \frac{\text{reopenedClosedCount}}{\text{closedCount}}$
   - **Penalty Effect:** Enters the formula as $0.4 \times (1 - \text{ReopenRate})$. Higher reopen rates directly penalize the ward's trust score. Complaints currently in dispute (`Reopened - Escalated`, `Disputed - Admin Review`) do not count until closed; once resolved and audited, they enter the closed denominator and contribute to the reopen penalty.

3. **SLA Compliance Rate (`SLAComplianceRate`) & Category SLAs:**
   - **Configuration (`lib/slaConfig.ts`):** Category-specific SLA limits:
     - `Sanitation`: 24 hours
     - `Streetlights`: 48 hours
     - `Water Supply & Drainage`: 48 hours
     - `Roads`: 72 hours
     - `Others`: 72 hours (default fallback)
   - **SLA Clock Specification:** The SLA clock runs from the moment of complaint creation (`createdAt`) to the officer's resolution action (when the officer submits on-site GPS verification and resolution proof, transitioning the ticket to `Pending Verification`).
   - **Numerator:** Count of closed complaints whose resolution duration was within their category SLA limit:
     $$\text{durationHours} = \frac{\text{officerResolveTimestamp} - \text{createdAt}}{3600 \times 1000} \le \text{categorySlaHours}$$
     $$\text{slaCompliantCount} = \sum_{\text{closed}} [\text{durationHours} \le \text{categorySlaHours}]$$
   - **Denominator:** $\text{closedCount}$
   - $\text{SLAComplianceRate} = \frac{\text{slaCompliantCount}}{\text{closedCount}}$

4. **Citizen Participation Rate (`ParticipationRate`):**
   - **Distinct Participation Guarantee:** Count of **distinct** closed complaints where the citizen actively participated (either verified the resolution OR contested/reopened it), divided by `closedCount`:
     $$\text{participatedClosedCount} = \sum_{\text{closed}} [\text{c.status} = \text{'Resolved - Citizen Verified'} \lor (\text{c.reopenCount} || 0) > 0]$$
     $$\text{ParticipationRate} = \min\left(100, \text{round}\left(\frac{\text{participatedClosedCount}}{\text{closedCount}} \times 100\right)\right)$$
   - **Never Exceeds 100%:** Because `participatedClosedCount` is filtered from the finite set of closed complaints (`closedComplaints`), a complaint that was both reopened by the citizen and later verified is counted exactly once. Thus $\text{participatedClosedCount} \le \text{closedCount}$ strictly holds at all times.

5. **Overdue Open Rate (`OverdueOpenRate`):**
   - **Definition:** Real-time operational metric tracking open complaints that have exceeded their category SLA:
     - *Open Complaints:* Tickets that are active in the redressal workflow: `!['Resolved - Citizen Verified', 'Resolved - Auto Closed', 'Rejected - Invalid'].includes(c.status)`.
     - *Clock Behavior:* For tickets awaiting officer resolution (`Pending`, `In Progress`, `Reopened - Escalated`, `Disputed - Admin Review`), the clock runs continuously from `createdAt` to `now` (`Date.now()`). For tickets in `Pending Verification`, the clock evaluates whether the officer's resolve action was completed within SLA.
     - *Formula:*
       $$\text{OverdueOpenRate} = \text{round}\left(\frac{\text{overdueOpenCount}}{\text{openCount}} \times 100\right)$$
   - **Handling Zero Open Complaints:** If $\text{openCount} = 0$, `overdueOpenRate` evaluates to `null` and displays gracefully in the UI as `0% (0 open)` without division-by-zero or `NaN`.
   - **Leaderboard Placement:** Displayed directly adjacent to the CTI in both the top ward leaderboard highlight cards and the comprehensive municipal ranking audit table.

6. **Cloudinary Signature String Verification:**
   - The signing query string strictly uses verbatim `&timestamp` without character corruption (avoiding entity translation such as `&times;`):
     ```typescript
     const paramsToSign = `allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}${effectiveApiSecret}`;
     const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');
     ```

---

## Test & Build Verification Results

- `npm run test:fixes`: **PASS (19 / 19 passed)**
  1. Real `POST /api/uploads/sign` Cloudinary signature parameters & dev/prod error gating
  2. `imageProofSchema` strict HTTPS Cloudinary URLs & test-only base64 gating
  3. Server-side asset size check with mocked HEAD paths (404 rejection, missing header, oversized asset, transformation stripping)
  4. GPS accuracy quality gate (accuracy $> 50\text{m}$ rejected; $\le 50\text{m}$ accepted)
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
  15. Negative tests: all 9 admin endpoints return 401 for anonymous and 403 for citizen/officer; officer outside ward returns 403; officer with no `assignedWardId` returns 403; officer acting on complaint with no `wardId` returns 403
  16. Unrouted complaints isolation: tickets without `wardId` excluded from explore, leaderboard, officer dashboard, and public list; present strictly in admin triage
  17. Civic Trust Index (CTI) refinements: closed ticket denominators, sample size threshold ($\ge 10$), separate verified/auto-closed metrics, and zero/small-sample edge cases
  18. First admin integrity: confirmed admin can only originate from seed or `ADMIN_EMAIL` env variable; public sign-up cannot elevate to admin
  19. "My Complaints" API & UI: verified `GET /api/complaints/my` returns logged-in citizen's complaints including unrouted tickets with `routingStatus: "Waiting for routing"` and rejects anonymous calls with 401
- `npm run test:spatial`: **PASS (3 / 3 passed)**
- `npm run test:e2e`: **PASS (7 / 7 passed)**
- `npm run lint`: **PASS (0 errors, 12 warnings for unoptimized images / react hooks dependencies)**
- `npm run build`: **PASS (Next.js production build compiled successfully, 11 static/dynamic routes generated)**
