# Project Progress: Jaago Platform

## Status Overview
- **Core Architecture:** Phases 1 to 5 built and verified.
- **Audit & Security Hardening:** All items from `AUDIT.md` and subsequent hardening requests implemented and verified.
- **Admin Control Center & Notifications:** Full `/admin` dashboard deployed (officer allow-list, triage queue, dispute arbitration, invalidation) and multi-channel notifications system (in-app + Nodemailer) with automated 72h reminders.
- **Verification Summary:** All 14 integration and audit tests (`npm run test:fixes`), spatial tests (`npm run test:spatial`), and end-to-end tests (`npm run test:e2e`) pass cleanly. Next.js production build and linting complete with 0 errors.

---

## Architectural Hardening & Remediation Details

### 1. Cloudinary Uploads & Environment-Gated Mocking
- **Strict HTTPS Cloudinary Enforcement:** `imageProofSchema` accepts only HTTPS URLs on `res.cloudinary.com` containing our configured cloud name and the `jaago_complaints` folder.
- **Base64 Gating:** Base64 data URIs are permitted **strictly when `NODE_ENV === 'test'`**. In development and production, base64 data URIs are rejected.
- **Dev & Prod Configuration Safety:** In development and production (`NODE_ENV !== 'test'`), missing credentials or default placeholder values in `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, or `CLOUDINARY_CLOUD_NAME` immediately return HTTP `500` with an explicit configuration error message.

### 2. GPS Accuracy Quality Gate (Reject Accuracy > 50m)
- In `app/api/complaints/[id]/resolve/route.ts`, reported GPS accuracy worse than 50m (`accuracy > 50`) is rejected with HTTP `400`:
  `"GPS accuracy is too degraded (±Xm). Field resolution requires accuracy within 50m to verify on-site presence. Please step into an open area with a clear view of the sky and retry."`
- Accuracy $\le 50\text{m}$ proceeds to distance verification against original complaint coordinates.

### 3. Server-Side 5MB Limit Enforcement
Enforced through two independent server-side checks:
1. **Cloudinary Upload Gateway:** The signing endpoint `app/api/uploads/sign/route.ts` generates signatures specifying `folder='jaago_complaints'`, `maxFileSizeBytes=5242880`, and `allowedFormats=['jpg', 'jpeg', 'png', 'webp']`.
2. **Server-Side Ingest Verifier (`verifyCloudinaryAssetSize`):**
   - For Cloudinary HTTPS URLs: performs an HTTP `HEAD` request to `res.cloudinary.com` and checks `Content-Length`. If size exceeds 5MB (`5 * 1024 * 1024` bytes), the request is rejected with HTTP `400`.
   - For test base64 data URIs: decodes byte length (`Math.ceil((base64Data.length * 3) / 4)`) and rejects payloads $> 5\text{MB}$.

### 4. Test-Only Auth Shortcut Safety Audit (`lib/apiAuth.ts`)
The header-based test authorization shortcut is protected by an explicit environment check:
```typescript
if (process.env.NODE_ENV === 'test' && req) {
  const testUserId = req.headers.get('x-test-user-id');
  const testUserRole = (req.headers.get('x-test-user-role') || 'citizen') as UserRole;
  if (testUserId) {
    return {
      id: testUserId,
      email: req.headers.get('x-test-user-email') || 'test@demo.jaago.app',
      name: 'Test Runner User',
      role: testUserRole,
    };
  }
}
```
In development or production (`NODE_ENV !== 'test'`), this condition evaluates to `false`. The headers are ignored and execution unconditionally calls NextAuth's `getServerSession(authOptions)`.

### 5. Administrative Control Center (`/admin`)
- **Route:** `app/admin/page.tsx`, protected for `role === 'admin'`.
- **Officer Allow-List Management:**
  - `GET /api/admin/officers`: Lists all officers with assigned ward and agency.
  - `POST /api/admin/officers`: Adds new officers to the allow-list (validates via `addOfficerSchema`).
  - `PATCH /api/admin/officers/[id]`: Toggles `isActive` and re-assigns ward/agency.
- **Triage Queue:**
  - `GET /api/admin/triage`: Displays complaints missing ward or agency routing.
  - `PATCH /api/admin/complaints/[id]/assign`: Assigns ward and agency, appends to `statusHistory`, and dispatches assignment notifications.
- **Disputed - Admin Review Queue:**
  - `GET /api/admin/disputes`: Displays tickets escalated by the dispute circuit breaker (3 contests).
  - `PATCH /api/admin/complaints/[id]/arbitrate`: Upholds resolution or marks as invalid, appends to `statusHistory`, and notifies reporter and officer.
- **Complaint Invalidation Registry:**
  - `PATCH /api/admin/complaints/[id]/reject`: Marks complaint as `Rejected - Invalid` with a required reason (min 5 chars), appends to `statusHistory`, and notifies reporter.

### 6. Notifications Subsystem
- **Model:** `models/Notification.ts` (`userId`, `complaintId`, `type`, `title`, `message`, `read`, `emailSent`, `createdAt`).
- **Nodemailer Transport:** Dispatches email notifications via configured SMTP or local stream/JSON mock transporter during dev/test.
- **Automated Civic Triggers:**
  1. *Assignment:* Sent to officer on ticket creation or manual triage.
  2. *Resolution:* Sent to citizen reporter when officer submits resolution (opening 120h audit).
  3. *Reopen:* Sent to officer when citizen contests resolution.
  4. *72-Hour Reminder:* Dispatched by cron daemon when 72 hours have elapsed ($\le 48$ hours remaining in verification window).
  5. *Auto-Close:* Dispatched by cron daemon when 120-hour window elapses without dispute.

---

## Test & Build Verification Results

- `npm run test:fixes`: **PASS (14 / 14 passed)**
  1. Cloudinary signed uploads & env gating
  2. `imageProofSchema` HTTPS Cloudinary & test-only base64
  3. Server-side 5MB asset size check
  4. GPS accuracy quality gate (reject accuracy > 50m)
  5. Server-side duplicate re-check (409 vs 201)
  6. `CRON_SECRET` header authorization
  7. `DEMO_AUTH=true` credentials provider gating
  8. Database-backed rate limiting (3 complaints / hour)
  9. Admin Officer Allow-List (add & deactivate)
  10. Admin Triage & manual routing (appends to `statusHistory`)
  11. Disputed queue & dispute arbitration (appends to `statusHistory`)
  12. Complaint invalidation with reason (appends to `statusHistory`)
  13. Notifications subsystem & 72h cron reminder
  14. `apiAuth.ts` test-only auth shortcut safety audit
- `npm run test:spatial`: **PASS (3 / 3 passed)**
- `npm run test:e2e`: **PASS (7 / 7 passed)**
- `npm run lint`: **PASS (0 errors, 12 warnings)**
- `npm run build`: **PASS (Compiled successfully, 10 static/dynamic routes generated)**
