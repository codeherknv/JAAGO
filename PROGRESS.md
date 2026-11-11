# Project Progress: Jaago Platform

## Status Overview
- **Core Architecture:** Phases 1 to 5 built and verified.
- **Audit & Security Hardening:** All items from `AUDIT.md` and subsequent hardening requests have been implemented, tested, and verified with dedicated test suites.
- **Verification Summary:** All tests, linting, and Next.js production builds pass cleanly with 0 errors.

---

## Architectural Hardening & Remediation Details

### 1. Cloudinary Uploads & Environment-Gated Mocking
- **Test Mode Gating:** Any mock/test Cloudinary signature behavior runs strictly when `NODE_ENV === 'test'`.
- **Dev & Prod Safety:** In development and production environments (`NODE_ENV !== 'test'`), missing credentials or default placeholder values in `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, or `CLOUDINARY_CLOUD_NAME` immediately return HTTP `500` with an explicit configuration error message.
- **Client Fallback:** `lib/cloudinaryClient.ts` throws a descriptive upload rejection or network error in development and production if the remote upload fails, refusing mock fallbacks unless in test mode.

### 2. Database-Backed Rate Limiter
- Replaced any in-memory rate limiting with a database-backed query:
  `Complaint.countDocuments({ reportedBy: user.id, createdAt: { $gte: oneHourAgo } })`.
- Fixed threshold of **3 complaints per hour per user**. Exceeding requests are rejected with HTTP `429 Too Many Requests`.
- Indexed for scale via compound index on `Complaint`: `{ reportedBy: 1, createdAt: -1 }`.

### 3. Single-Transaction Complaint & Vote Creation
- Complaint creation and the reporter's initial vote are created atomically in a single MongoDB transaction via `session.withTransaction(...)` in `app/api/complaints/route.ts`.
- The delete-on-failure workaround (`Complaint.findByIdAndDelete`) has been completely removed.
- `lib/reconcileVotes.ts` (`reconcileAllVotes`) remains intact as a scheduled/background safety net.

### 4. Technical Note: 5MB Limit and Image Format Enforcement
Image limits and formats are enforced in a defense-in-depth model across three distinct layers:
1. **Client-Side Pre-Flight Check (`lib/cloudinaryClient.ts`):**
   - Validates `file.size <= 5 * 1024 * 1024` (5MB).
   - Validates `file.type` against `['image/jpeg', 'image/png', 'image/webp', 'image/jpg']` prior to dispatching upload requests.
2. **Cloudinary Signature & Upload Gateway (`app/api/uploads/sign/route.ts`):**
   - Signature parameters include `folder='jaago_complaints'` and `allowed_formats=['jpg', 'jpeg', 'png', 'webp']`.
   - The Cloudinary upload API verifies the HMAC-SHA1 signature and enforces format restrictions directly at the ingest boundary.
3. **Server-Side Ingestion Validation (`lib/validations.ts` & API Routes):**
   - All complaint and resolution routes (`POST /api/complaints`, `PATCH /api/complaints/[id]/resolve`, `POST /api/complaints/[id]/verify`) enforce `imageProofSchema` on `imageUrl` and `resolutionImageUrl`.
   - For base64 data URIs: parses the header to enforce MIME types (`image/jpeg`, `image/png`, `image/webp`) and decodes base64 buffer length to ensure byte size does not exceed 5MB (`5 * 1024 * 1024` bytes).
   - For HTTP/HTTPS URLs: parses and validates the URL protocol and ensures the path points to Cloudinary (`cloudinary.com`) or has an allowed extension (`.jpg`, `.jpeg`, `.png`, `.webp`).

### 5. API Route Zod Validation Audit
Every API route in the application has been audited and validated:
- `app/api/complaints/route.ts` (GET): Validated with `listComplaintsQuerySchema`.
- `app/api/complaints/route.ts` (POST): Validated with `createComplaintSchema`.
- `app/api/complaints/nearby/route.ts` (GET): Validated with `nearbyQuerySchema`.
- `app/api/complaints/[id]/route.ts` (GET): Validated with `ObjectIdSchema`.
- `app/api/complaints/[id]/resolve/route.ts` (PATCH): Validated with `ObjectIdSchema` & `resolveComplaintSchema`.
- `app/api/complaints/[id]/status/route.ts` (PATCH): Validated with `ObjectIdSchema` & `updateStatusSchema`.
- `app/api/complaints/[id]/upvote/route.ts` (POST): Validated with `ObjectIdSchema`.
- `app/api/complaints/[id]/upvote/route.ts` (GET): Validated with `ObjectIdSchema` and query validated with `getUpvoteQuerySchema`.
- `app/api/complaints/[id]/verify/route.ts` (POST): Validated with `ObjectIdSchema` & `verifyComplaintSchema`.
- `app/api/cron/auto-close/route.ts` (GET & POST): Validated with `cronQuerySchema`.
- `app/api/uploads/sign/route.ts` (POST): Validated with `signUploadSchema`.

**Routes Left Unvalidated by Custom Zod:**
- `app/api/auth/[...nextauth]/route.ts`: Left unvalidated by custom Zod schemas because NextAuth manages its own internal protocol routes (CSRF token verification, OAuth callbacks, session state).

### 6. Test Suite Architecture (`scripts/testFixes.ts`)
The test runner invokes real Next.js route handlers directly via `NextRequest`:
- **Real Route Handlers Called:**
  - Test 1: Real `POST /api/uploads/sign` (tests both dev 500 rejection and test-mode signing).
  - Test 2: Real `POST /api/complaints` (tests 409 duplicate rejection and `confirmDistinct: true` override).
  - Test 3: Real `POST /api/cron/auto-close` (tests 401 unauthenticated and 200 with `CRON_SECRET`).
  - Test 5: Real `POST /api/complaints` (tests 400 Zod failure) & real `PATCH /api/complaints/[id]/resolve` (tests 403 role block).
  - Test 6: Real `PATCH /api/complaints/[id]/resolve` (tests 100m GPS accuracy clamping and radius bounding).
  - Test 7: Real `POST /api/complaints` (tests atomic MongoDB transaction creating complaint + vote).
  - Test 8: Real `POST /api/complaints` (tests database-backed rate limit triggering 429 on 4th submission).
- **Tests Marked as Unable to Call Route Handlers Directly:**
  - **Test 4 (Credentials Gating):** NextAuth's `authOptions` is an initialization config object in `lib/auth.ts`, not an exported route handler. Evaluated via dynamic provider assertion under `DEMO_AUTH=false` vs `DEMO_AUTH=true`.
  - **Test 9 (Domain Audit):** Database collection-wide query asserting zero `.gov.in`/`.nic.in` domains exist in `User` and `OfficerAllowList`.
  - **Test 10 (Production Fallback Guard):** Source inspection verifying `lib/mongodb.ts` refuses in-memory server instantiation when `NODE_ENV === 'production'`.

---

## Test & Build Verification Results

- `npm run test:fixes`: **PASS (10 / 10 passed)**
- `npm run test:spatial`: **PASS (3 / 3 passed)**
- `npm run test:e2e`: **PASS (7 / 7 passed)**
- `npm run lint`: **PASS (0 errors, 10 warnings)**
- `npm run build`: **PASS (Compiled successfully, 9 static/dynamic routes generated)**
