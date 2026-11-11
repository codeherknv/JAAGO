# Jaago Platform Architecture & Implementation Audit

**Audit Date:** 2026-11-11  
**Scope:** Geo-Intelligent Civic Redressal & Accountability Platform  
**Target Pilot:** Greater Bengaluru Authority (Bellandur W-150, HSR Layout W-174, Koramangala W-151)  
**Rule Compliance:** Code audit only. No code modified.

---

## Executive Summary Matrix

| # | Audit Item | Verdict | Key Evidence Files | Summary Finding |
| :-: | :--- | :---: | :--- | :--- |
| **1** | `mongodb.ts` uses `MONGODB_URI` & dev-only loudly logged in-memory fallback | **PARTIAL** | [`lib/mongodb.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/mongodb.ts#L38-L66) | Uses `MONGODB_URI` and logs loudly, but in-memory fallback lacks `NODE_ENV !== 'production'` guard. |
| **2** | Images uploaded to Cloudinary with server-signed uploads vs saved locally | **PARTIAL** | [`app/api/uploads/sign/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/uploads/sign/route.ts#L4-L25)<br>[`app/report/page.tsx`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/report/page.tsx#L199)<br>[`app/api/uploads/local/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/uploads/local/route.ts#L22) | Server signing route exists with folder/5MB/format constraints, but client UI uploads to local base64 fallback. |
| **3** | `POST /api/complaints` re-runs 40m duplicate check on server | **FAIL** | [`app/api/complaints/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L49-L149) | Server checks `$geoIntersects` for ward boundary, but does NOT re-run `$near` 40m duplicate check before insert. |
| **4** | Cron route requires a secret header | **FAIL** | [`app/api/cron/auto-close/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/cron/auto-close/route.ts#L8-L15) | No `Authorization` header, `CRON_SECRET`, or bearer token check. Unauthenticated. |
| **5** | Credentials/demo login disabled unless `DEMO_AUTH=true` | **FAIL** | [`lib/auth.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/auth.ts#L14-L62)<br>[`app/login/page.tsx`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/login/page.tsx#L55) | `CredentialsProvider` and 1-click test personas are always active; no `process.env.DEMO_AUTH` gate. |
| **6** | Every API input validated (Zod or similar) | **FAIL** | All route handlers in [`app/api/`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/) | Zod is not installed; input validation uses manual imperative `if` checks without type/range/ObjectId schemas. |
| **7** | Every role check enforced server-side | **FAIL** | [`app/api/complaints/[id]/resolve/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/resolve/route.ts#L66)<br>[`app/api/complaints/[id]/status/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/status/route.ts#L32) | Missing server-side 401/403 rejections; missing session falls back to demo/first-available database users. |
| **8** | Resolve route GPS accuracy capped | **FAIL** | [`lib/geo.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/geo.ts#L25)<br>[`app/api/complaints/[id]/resolve/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/resolve/route.ts#L24) | Uses $\max(50, \text{accuracy} + 15)$ without upper ceiling. Degraded GPS accuracy of 5000m yields 5015m radius unchecked. |
| **9** | Reporter vote exists in `Votes` and `upvotesCount` stays consistent | **PARTIAL** | [`app/api/complaints/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L152)<br>[`scripts/seedPilot.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/seedPilot.ts#L182,L301) | Consistent at runtime (`POST /api/complaints`), but seed script complaints have `upvotesCount: 8, 15, 22` with only 1 Vote record each. |
| **10** | Tests assert actual behaviour (list weak tests) | **PARTIAL** | [`scripts/testSpatial.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testSpatial.ts)<br>[`scripts/testFullE2E.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testFullE2E.ts#L140-L268) | `testSpatial.ts` asserts real DB queries; `testFullE2E.ts` Tests 4, 5, 6, 7 use inline helper functions bypassing route handlers. |
| **11** | Missing or only stubbed spec features | **N/A** | Multiple files (detailed below) | Direct Cloudinary client upload, server-side duplicate write rejection, admin dispute resolution, and cron security. |

---

## Detailed Findings with File & Line Evidence

### 1. Does `mongodb.ts` use `MONGODB_URI` when set? Is any in-memory fallback dev-only and loudly logged?
**Verdict:** **PARTIAL**

- **Uses `MONGODB_URI`:** **PASS**
  - [`lib/mongodb.ts#L38`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/mongodb.ts#L38):
    ```typescript
    let uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jaago';
    ```
  - [`lib/mongodb.ts#L43-L46`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/mongodb.ts#L43-L46):
    ```typescript
    const conn = await mongoose.connect(uri, {
      ...opts,
      serverSelectionTimeoutMS: 2500,
    });
    ```
- **Loudly Logged:** **PASS**
  - [`lib/mongodb.ts#L49`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/mongodb.ts#L49):
    ```typescript
    console.warn(`[MongoDB] Primary connection to ${uri} failed. Attempting MongoDB Memory Server fallback for development/test environment...`);
    ```
  - [`lib/mongodb.ts#L59`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/mongodb.ts#L59):
    ```typescript
    console.log(`[MongoDB] Started MongoMemoryServer at ${memUri}`);
    ```
- **Dev-Only Guard:** **FAIL**
  - [`lib/mongodb.ts#L48-L66`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/mongodb.ts#L48-L66): The fallback is executed in the `catch` block unconditionally without checking `if (process.env.NODE_ENV === 'production') throw err;`. In production, a misconfigured URI triggers an in-memory database attempt rather than failing fast.

---

### 2. Are images uploaded to Cloudinary with server-signed uploads (folder, format and 5MB limits), or saved locally?
**Verdict:** **PARTIAL**

- **Server-Signed Upload Generation:** **PASS**
  - [`app/api/uploads/sign/route.ts#L7-L25`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/uploads/sign/route.ts#L7-L25):
    Generates HMAC-SHA1 signature and enforces constraints:
    ```typescript
    const folder = 'jaago_complaints';
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    ...
    return NextResponse.json({
      signature, timestamp, apiKey, cloudName, folder,
      maxFileSizeBytes: 5 * 1024 * 1024,
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    });
    ```
- **Client Implementation:** **FAIL** (Uses local base64 Data URLs)
  - [`app/report/page.tsx#L199-L205`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/report/page.tsx#L199-L205):
    ```typescript
    const uploadRes = await fetch('/api/uploads/local', { method: 'POST', body: formData });
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      uploadedUrl = uploadData.url;
    }
    ```
  - [`app/api/uploads/local/route.ts#L20-L24`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/uploads/local/route.ts#L20-L24):
    Converts image files to Base64 Data URLs (`data:${mimeType};base64,...`).
  - [`app/officer/dashboard/page.tsx#L125-L132`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/officer/dashboard/page.tsx#L125-L132):
    Reads image via `reader.readAsDataURL(file)` and passes base64 directly to `/api/complaints/[id]/resolve`.
  - Client never posts directly to `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`.

---

### 3. Does `POST /api/complaints` re-run the 40m same-category duplicate check on the server?
**Verdict:** **FAIL**

- **Server-Side Validation in `POST /api/complaints`:**
  - [`app/api/complaints/route.ts#L73-L92`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L73-L92): Evaluates `$geoIntersects` with `Ward` polygon boundaries.
  - [`app/api/complaints/route.ts#L95-L97`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L95-L97): Resolves matching `Agency`.
  - [`app/api/complaints/route.ts#L121-L149`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L121-L149): Directly instantiates and saves `new Complaint(...)`.
- **Finding:** The 40m `$near` query is never executed in `POST /api/complaints`. It exists only in `GET /api/complaints/nearby` ([`app/api/complaints/nearby/route.ts#L43-L57`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/nearby/route.ts#L43-L57)) and is triggered exclusively via client-side `useEffect` in [`app/report/page.tsx#L125-L151`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/report/page.tsx#L125-L151). Direct POST requests bypass deduplication completely.

---

### 4. Does the cron route require a secret header?
**Verdict:** **FAIL**

- [`app/api/cron/auto-close/route.ts#L8-L15`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/cron/auto-close/route.ts#L8-L15):
  ```typescript
  export async function GET(req: NextRequest) {
    return handleAutoClose(req);
  }

  export async function POST(req: NextRequest) {
    return handleAutoClose(req);
  }
  ```
- [`app/api/cron/auto-close/route.ts#L16-L66`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/cron/auto-close/route.ts#L16-L66):
  `handleAutoClose(req)` contains no check for `req.headers.get('authorization')`, `x-cron-secret`, or `process.env.CRON_SECRET`. Anyone can trigger auto-close on all overdue complaints without authentication.

---

### 5. Is the credentials/demo login disabled unless `DEMO_AUTH=true`?
**Verdict:** **FAIL**

- [`lib/auth.ts#L13-L21`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/auth.ts#L13-L21):
  ```typescript
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      ...
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider(...)] : []),
  ]
  ```
  `CredentialsProvider` is unconditionally enabled. There is no check for `process.env.DEMO_AUTH === 'true'`.
- [`app/login/page.tsx#L55-L135`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/login/page.tsx#L55-L135):
  1-click demo persona buttons (Ramesh Gowda, Sunita Rao, Rahul Sharma, Civic Commissioner) are hardcoded and permanently accessible to any visitor.

---

### 6. Is every API input validated (Zod or similar)? List routes that are not.
**Verdict:** **FAIL**

- **Schema Validator Check:** `package.json` contains no schema validation library (`zod`, `yup`, `joi`, etc.).
- **Validation Quality:** All routes rely exclusively on ad-hoc manual imperative checks (`if (!field)`, `parseFloat()`), leaving coordinate ranges, text lengths, string formats, and ObjectId values unvalidated.
- **Unvalidated / Weakly Validated Routes:**
  1. `POST /api/complaints` ([`app/api/complaints/route.ts#L56-L68`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L56-L68)): No coordinate boundary validation (`[-90, 90]`, `[-180, 180]`), no title/description length limits, no category enum check against schema.
  2. `GET /api/complaints` ([`app/api/complaints/route.ts#L15-L27`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L15-L27)): Query params `wardId`, `category`, `status` passed directly without validation.
  3. `GET /api/complaints/[id]` ([`app/api/complaints/[id]/route.ts#L15`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/route.ts#L15)): `params.id` not verified as valid 24-character hexadecimal ObjectId.
  4. `PATCH /api/complaints/[id]/resolve` ([`app/api/complaints/[id]/resolve/route.ts#L18-L24`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/resolve/route.ts#L18-L24)): No accuracy upper bounds, no image URL structure validation.
  5. `PATCH /api/complaints/[id]/status` ([`app/api/complaints/[id]/status/route.ts#L22`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/status/route.ts#L22)): Remarks field unvalidated for length/injection.
  6. `POST /api/complaints/[id]/verify` ([`app/api/complaints/[id]/verify/route.ts#L16`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/verify/route.ts#L16)): No schema for contest remarks or image URL.
  7. `POST /api/complaints/[id]/upvote` ([`app/api/complaints/[id]/upvote/route.ts#L28`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/upvote/route.ts#L28)): `userId` from body parsed without ObjectId validation.
  8. `GET /api/complaints/[id]/upvote` ([`app/api/complaints/[id]/upvote/route.ts#L106`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/upvote/route.ts#L106)): `userId` query param unvalidated.
  9. `GET /api/complaints/nearby` ([`app/api/complaints/nearby/route.ts#L17-L29`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/nearby/route.ts#L17-L29)): No coordinate bounding checks.
  10. `POST /api/uploads/local` ([`app/api/uploads/local/route.ts#L8-L15`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/uploads/local/route.ts#L8-L15)): File mime-type not validated against an allowed whitelist.
  11. `POST /api/uploads/sign` ([`app/api/uploads/sign/route.ts#L4`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/uploads/sign/route.ts#L4)): No schema validation.

---

### 7. Is every role check enforced server-side? List unprotected routes.
**Verdict:** **FAIL**

- **Role Verification Mechanism:**
  When `session?.user` is absent or lacks the required role, endpoints do not return `401 Unauthorized` or `403 Forbidden`. Instead, they query the database for a fallback user and proceed.
- **Unprotected Routes:**
  1. `PATCH /api/complaints/[id]/resolve` ([`app/api/complaints/[id]/resolve/route.ts#L66-L80`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/resolve/route.ts#L66-L80)):
     ```typescript
     let officerUser;
     if (session?.user?.id) { officerUser = await User.findById(session.user.id); }
     if (!officerUser) { officerUser = await User.findOne({ role: 'officer' }); ... }
     ```
     Unauthenticated users can call the endpoint; the system resolves the ticket under a fallback officer's identity.
  2. `PATCH /api/complaints/[id]/status` ([`app/api/complaints/[id]/status/route.ts#L32-L38`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/status/route.ts#L32-L38)):
     ```typescript
     if (!actorUser) { actorUser = await User.findOne({ role: 'officer' }) || (await User.findOne()); }
     ```
     No role gate; unauthenticated requests can transition complaint status.
  3. `POST /api/complaints/[id]/verify` ([`app/api/complaints/[id]/verify/route.ts#L38-L46`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/verify/route.ts#L38-L46)):
     Does not verify that caller is the reporter or a citizen; falls back to `complaint.reportedBy`.
  4. `POST /api/complaints` ([`app/api/complaints/route.ts#L100-L115`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L100-L115)):
     Does not require authentication; auto-creates or selects `citizen.reporter@jaago.in`.
  5. `POST /api/complaints/[id]/upvote` ([`app/api/complaints/[id]/upvote/route.ts#L28-L44`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/upvote/route.ts#L28-L44)):
     Unauthenticated users can upvote via fallback user creation.
  6. `GET /api/cron/auto-close` ([`app/api/cron/auto-close/route.ts#L8`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/cron/auto-close/route.ts#L8)):
     No administrative role or secret required.

---

### 8. Is the resolve route's GPS accuracy capped?
**Verdict:** **FAIL**

- **Formula Implementation:**
  - [`lib/geo.ts#L25-L27`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/geo.ts#L25-L27):
    ```typescript
    export function calculateAllowedResolutionRadius(accuracyMeters: number): number {
      return Math.max(50, (accuracyMeters || 0) + 15);
    }
    ```
  - [`app/api/complaints/[id]/resolve/route.ts#L24-L27`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/resolve/route.ts#L24-L27):
    ```typescript
    const deviceAccuracy = Math.max(0, parseFloat(accuracy) || 0);
    const allowedRadius = calculateAllowedResolutionRadius(deviceAccuracy);
    ```
- **Finding:** While $\max(50, \text{accuracy} + 15)$ matches Invariant 4, there is **no upper ceiling** on `deviceAccuracy`. If an officer device reports or spoofs `accuracy: 3000` (3km), `allowedRadius` expands to 3,015 meters. The route lacks a check like `Math.min(accuracy, 100)` or `if (accuracy > 100) return 400;` to reject unreliable GPS signals.

---

### 9. Does the reporter's vote exist in the Votes collection, and does `upvotesCount` stay consistent with it?
**Verdict:** **PARTIAL**

- **Runtime Ingestion (`POST /api/complaints`):** **PASS**
  - [`app/api/complaints/route.ts#L135`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L135): Initializes `upvotesCount: 1`.
  - [`app/api/complaints/route.ts#L152-L159`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/route.ts#L152-L159):
    ```typescript
    await Vote.create({
      complaintId: newComplaint._id,
      userId: reporterUser._id,
    });
    ```
  - Consistent: Complaint starts with 1 upvote and has 1 matching record in `votes`.
- **Subsequent Upvotes (`POST /api/complaints/[id]/upvote`):** **PASS**
  - [`app/api/complaints/[id]/upvote/route.ts#L50-L70`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/upvote/route.ts#L50-L70): Enforces compound unique index `{ complaintId: 1, userId: 1 }` and atomic `$inc: { upvotesCount: 1 }`.
- **Pilot Seeding Script (`scripts/seedPilot.ts`):** **FAIL**
  - [`scripts/seedPilot.ts#L182, L209, L235`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/seedPilot.ts): Complaint 0 is created with `upvotesCount: 8`, Complaint 1 with `upvotesCount: 15`, Complaint 2 with `upvotesCount: 22`.
  - [`scripts/seedPilot.ts#L301-L306`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/seedPilot.ts#L301-L306):
    ```typescript
    const votes = [
      { complaintId: createdComplaints[0]._id, userId: rahul._id },
      { complaintId: createdComplaints[1]._id, userId: priya._id },
      { complaintId: createdComplaints[2]._id, userId: rahul._id },
      { complaintId: createdComplaints[3]._id, userId: priya._id },
    ];
    await Vote.insertMany(votes);
    ```
  - Only **1** vote record exists per complaint in the database despite `upvotesCount` being 8, 15, and 22. In the seeded state, `Vote.countDocuments({ complaintId }) !== Complaint.upvotesCount`.

---

### 10. Do the tests really assert behaviour? List weak tests.
**Verdict:** **PARTIAL**

- **Genuine Behavioural Tests:**
  - [`scripts/testSpatial.ts#L25-L42`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testSpatial.ts#L25-L42) (Test 1): Real 2dsphere `$geoIntersects` polygon query on `Ward`.
  - [`scripts/testSpatial.ts#L48-L132`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testSpatial.ts#L48-L132) (Test 2): Real 2dsphere `$near` 40m proximity query on `Complaint`.
  - [`scripts/testSpatial.ts#L138-L197`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testSpatial.ts#L138-L197) (Test 3): Real concurrent race condition test asserting `E11000` duplicate key on compound unique index and atomic `$inc`.
- **Weak / Simulated Tests in `scripts/testFullE2E.ts`:**
  1. **Weak: Test 4 (Location-Verified Resolution Gate)** ([`scripts/testFullE2E.ts#L140-L154`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testFullE2E.ts#L140-L154)):
     Never calls `PATCH /api/complaints/[id]/resolve`. Calculates distance and threshold in local variables and checks `farDistance > allowedRadius`. Does not test HTTP handler, request validation, or 403 response.
  2. **Weak: Test 5 (Citizen Audit & Circuit Breaker)** ([`scripts/testFullE2E.ts#L169-L206`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testFullE2E.ts#L169-L206)):
     Never calls `POST /api/complaints/[id]/verify`. Defines an inline helper function `async function contestTicket(complaint, remarks)` inside the test file that directly edits Mongoose models. Tests the test file's own code rather than the production endpoint.
  3. **Weak: Test 6 (Auto-Close Cron Daemon)** ([`scripts/testFullE2E.ts#L228-L245`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testFullE2E.ts#L228-L245)):
     Never calls `GET /api/cron/auto-close`. Re-implements query and loop locally inside the test script.
  4. **Weak: Test 7 (CTI Formula)** ([`scripts/testFullE2E.ts#L257-L268`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/scripts/testFullE2E.ts#L257-L268)):
     Tests pure arithmetic: `const expectedCTI = (0.4 * 0.85) + (0.4 * 0.90) + (0.2 * 0.90); ... if (computedScore === 88)`. Completely disconnected from database records or `app/leaderboard/page.tsx`.

---

### 11. Which spec features are missing or only stubbed?
1. **Direct-to-Cloudinary Client Upload (Stubbed):**
   - Signature endpoint [`app/api/uploads/sign/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/uploads/sign/route.ts) is implemented, but the client in [`app/report/page.tsx`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/report/page.tsx#L199) uploads to local base64 storage ([`app/api/uploads/local/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/uploads/local/route.ts)). Direct unsigned or signed uploads to Cloudinary are stubbed/unwired on the frontend.
2. **Server-Side Ingestion Deduplication Gate (Missing):**
   - The 40m `$near` check is advisory in the frontend modal; `POST /api/complaints` does not reject or intercept duplicates when written directly to the database.
3. **Disputed Ticket Municipal Arbitration (Missing):**
   - When a complaint reaches `Disputed - Admin Review` (tripping the 3-strike circuit breaker), there is no admin resolution UI or dedicated API endpoint for a Municipal Commissioner to review evidence, overrule, or formally close the ticket.
4. **Cron Authorization Header (Missing):**
   - [`app/api/cron/auto-close/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/cron/auto-close/route.ts) lacks a bearer token or secret header check.
5. **GPS Accuracy Ceiling (Missing):**
   - [`app/api/complaints/[id]/resolve/route.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/app/api/complaints/[id]/resolve/route.ts) lacks an accuracy cap to prevent artificially inflated resolution radii.
6. **Production Auth Guard (`DEMO_AUTH=true`) (Missing):**
   - [`lib/auth.ts`](file:///C:/Users/91701/OneDrive/Desktop/JAAGO/lib/auth.ts) does not gate credentials login behind `DEMO_AUTH=true`.
7. **SLA Breach Monitoring & Deadlines (Stubbed/Estimated):**
   - `Complaint` schema lacks `slaDeadline` or breach alert hooks; SLA compliance is approximated post-hoc on the leaderboard.
