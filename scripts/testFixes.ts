import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { connectToDatabase } from '../lib/mongodb';
import { Ward } from '../models/Ward';
import { Agency } from '../models/Agency';
import { Complaint } from '../models/Complaint';
import { Vote } from '../models/Vote';
import { User } from '../models/User';
import { OfficerAllowList } from '../models/OfficerAllowList';
import { Notification } from '../models/Notification';
import { seedPilotDatabase } from './seedPilot';
import { reconcileAllVotes } from '../lib/reconcileVotes';
import { imageProofSchema, verifyCloudinaryAssetSize, getOriginalCloudinaryUrl } from '../lib/validations';
import { calculateSingleWardStats, rankWardStats, getLeaderboardData } from '../lib/leaderboard';
import {
  CATEGORY_SLA_HOURS,
  getCategorySlaHours,
  isComplaintOverdue,
  getOfficerResolveTimestamp,
} from '../lib/slaConfig';
import { getAuthProviders } from '../lib/auth';

// Import real route handlers
import { POST as signUploadPOST } from '../app/api/uploads/sign/route';
import { GET as complaintsGET, POST as complaintsPOST } from '../app/api/complaints/route';
import { GET as myComplaintsGET } from '../app/api/complaints/my/route';
import { POST as autoClosePOST } from '../app/api/cron/auto-close/route';
import { PATCH as resolvePATCH } from '../app/api/complaints/[id]/resolve/route';
import { PATCH as statusPATCH } from '../app/api/complaints/[id]/status/route';
import { POST as verifyPOST } from '../app/api/complaints/[id]/verify/route';

// Admin route handlers
import { GET as adminOfficersGET, POST as adminOfficersPOST } from '../app/api/admin/officers/route';
import { PATCH as adminOfficerUpdatePATCH } from '../app/api/admin/officers/[id]/route';
import { GET as adminTriageGET } from '../app/api/admin/triage/route';
import { PATCH as adminAssignPATCH } from '../app/api/admin/complaints/[id]/assign/route';
import { GET as adminDisputesGET } from '../app/api/admin/disputes/route';
import { PATCH as adminArbitratePATCH } from '../app/api/admin/complaints/[id]/arbitrate/route';
import { PATCH as adminRejectPATCH } from '../app/api/admin/complaints/[id]/reject/route';
import { GET as adminMetadataGET } from '../app/api/admin/metadata/route';

async function runAuditFixesVerification() {
  (process.env as any).NODE_ENV = 'test';
  console.log('================================================================');
  console.log('   JAAGO FULL INTEGRATION & AUDIT VERIFICATION SUITE');
  console.log('================================================================\n');

  await connectToDatabase();
  console.log('Resetting and seeding database with clean pilot records...');
  await seedPilotDatabase();

  let passed = 0;
  const total = 19;

  const admin = await User.findOne({ email: 'admin@demo.jaago.app' });
  const citizen = await User.findOne({ email: 'citizen.rahul@demo.jaago.app' });
  const officer = await User.findOne({ email: 'officer.bellandur@demo.jaago.app' });
  const bellandurWard = await Ward.findOne({ code: 'W-150' });
  const bbmpRoads = await Agency.findOne({ shortName: 'BBMP-Roads' });

  // Default fetch mock for test environment to validate Cloudinary URLs without network dependence
  const nativeFetch = global.fetch;
  const mockDefaultFetch = async (input: any, init: any) => {
    const urlStr = input?.toString() || '';
    if (init?.method === 'HEAD' && urlStr.includes('res.cloudinary.com/jaago-pilot/')) {
      const headers = new Headers();
      headers.set('content-length', (1024 * 1024).toString()); // 1MB mock
      return new Response(null, { status: 200, headers });
    }
    return nativeFetch(input, init);
  };
  global.fetch = mockDefaultFetch as any;

  // ------------------------------------------------------------------
  // 1. CLOUDINARY SIGNED UPLOADS & ENVIRONMENT-GATED MOCKS
  // ------------------------------------------------------------------
  console.log('--- Test 1: Cloudinary Signed Uploads & Env Gating (Real Route Handler) ---');
  const localUploadPath = path.join(process.cwd(), 'app', 'api', 'uploads', 'local');
  if (fs.existsSync(localUploadPath)) {
    throw new Error('FAIL: app/api/uploads/local still exists on disk');
  }

  // 1a. Test production/dev guard: When NODE_ENV !== 'test', route must return 500 on missing/mock keys
  (process.env as any).NODE_ENV = 'development';
  const prodSignReq = new NextRequest('http://localhost:3000/api/uploads/sign', {
    method: 'POST',
    body: JSON.stringify({ folder: 'jaago_complaints' }),
  });
  const prodSignRes = await signUploadPOST(prodSignReq);
  const prodSignData = await prodSignRes.json();

  if (prodSignRes.status !== 500 || !prodSignData.error) {
    throw new Error(`Expected status 500 when Cloudinary config is invalid in development, got: ${prodSignRes.status}`);
  }

  // 1b. Test test-environment signing: When NODE_ENV === 'test', returns signed payload
  (process.env as any).NODE_ENV = 'test';
  const testSignReq = new NextRequest('http://localhost:3000/api/uploads/sign', {
    method: 'POST',
    body: JSON.stringify({ folder: 'jaago_complaints' }),
  });
  const testSignRes = await signUploadPOST(testSignReq);
  const testSignData = await testSignRes.json();

  if (
    testSignRes.status === 200 &&
    testSignData.signature &&
    testSignData.folder === 'jaago_complaints' &&
    testSignData.allowed_formats === 'jpg,jpeg,png,webp'
  ) {
    // 1c. Verify Cloudinary signature string strictly uses verbatim &timestamp (no corrupted character like &times;)
    const signRouteSource = fs.readFileSync(path.join(__dirname, '../app/api/uploads/sign/route.ts'), 'utf-8');
    if (!signRouteSource.includes('&timestamp=')) {
      throw new Error('Test 1 failed: app/api/uploads/sign/route.ts does not use verbatim &timestamp= in signing string!');
    }
    const testSecret = 'jaago-cloudinary-test-secret-sample-1234';
    const expectedParamsToSign = `allowed_formats=jpg,jpeg,png,webp&folder=jaago_complaints&timestamp=${testSignData.timestamp}${testSecret}`;
    const computedSignature = crypto.createHash('sha1').update(expectedParamsToSign).digest('hex');
    if (testSignData.signature !== computedSignature) {
      throw new Error(`Test 1 failed: Signature mismatch! Computed: ${computedSignature}, Received: ${testSignData.signature}`);
    }

    console.log(`[PASS] Test 1: Real POST /api/uploads/sign verified:`);
    console.log(`       - In dev/prod with missing keys: returned HTTP 500 error.`);
    console.log(`       - In test mode: returned signature '${testSignData.signature.substring(0, 10)}...'`);
    console.log(`       - Signed allowed_formats parameter: '${testSignData.allowed_formats}' in alphabetical order.`);
    console.log(`       - Signature string confirmed using verbatim '&timestamp' without character corruption.`);
    passed++;
  } else {
    throw new Error('Test 1 failed: upload signing route response invalid');
  }

  // ------------------------------------------------------------------
  // 2. IMAGE PROOF SCHEMA: CLOUDINARY HTTPS & TEST-ONLY BASE64
  // ------------------------------------------------------------------
  console.log('\n--- Test 2: imageProofSchema Strict HTTPS Cloudinary & Test-Only Base64 ---');
  // 2a. Valid Cloudinary HTTPS URL
  const validCloudinaryUrl = 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/test.jpg';
  const validParse = imageProofSchema.safeParse(validCloudinaryUrl);
  if (!validParse.success) {
    throw new Error(`Valid Cloudinary URL failed validation: ${JSON.stringify(validParse.error)}`);
  }

  // 2b. Invalid non-Cloudinary URL
  const invalidUrl = 'https://images.unsplash.com/photo-12345';
  const invalidParse = imageProofSchema.safeParse(invalidUrl);
  if (invalidParse.success) {
    throw new Error('Non-Cloudinary URL was incorrectly allowed!');
  }

  // 2c. Base64 in test mode (allowed)
  const sampleBase64 = 'data:image/jpeg;base64,' + Buffer.from('test-image-bytes').toString('base64');
  (process.env as any).NODE_ENV = 'test';
  const base64TestParse = imageProofSchema.safeParse(sampleBase64);
  if (!base64TestParse.success) {
    throw new Error('Base64 should be allowed when NODE_ENV === test');
  }

  // 2d. Base64 in production mode (REJECTED)
  (process.env as any).NODE_ENV = 'production';
  const base64ProdParse = imageProofSchema.safeParse(sampleBase64);
  (process.env as any).NODE_ENV = 'test'; // restore
  if (base64ProdParse.success) {
    throw new Error('Base64 data URI was incorrectly allowed in production mode!');
  }

  console.log(`[PASS] Test 2: imageProofSchema verified:`);
  console.log(`       - Accepts valid HTTPS res.cloudinary.com/<cloud>/jaago_complaints URLs.`);
  console.log(`       - Strictly rejects non-Cloudinary domains.`);
  console.log(`       - Allows base64 data URIs ONLY when NODE_ENV === 'test'.`);
  passed++;

  // ------------------------------------------------------------------
  // 3. SERVER-SIDE 5MB ASSET SIZE & HEAD PATH MOCK VERIFICATION
  // ------------------------------------------------------------------
  console.log('\n--- Test 3: Server-Side 5MB Asset Size & Mock HEAD Path ---');
  const originalFetch = global.fetch;
  let lastFetchedUrl = '';

  // 3a. HEAD fails with HTTP 404 (non-2xx response) -> Must return false
  global.fetch = (async (input: any, init: any) => {
    lastFetchedUrl = input.toString();
    if (init?.method === 'HEAD') {
      return new Response(null, { status: 404, statusText: 'Not Found' });
    }
    return originalFetch(input, init);
  }) as any;

  const failResult = await verifyCloudinaryAssetSize(validCloudinaryUrl);
  if (failResult !== false) {
    global.fetch = mockDefaultFetch as any;
    throw new Error('Expected verifyCloudinaryAssetSize to return false when HEAD request returns HTTP 404');
  }

  // 3b. Missing Content-Length header -> Must return false
  global.fetch = (async (input: any, init: any) => {
    lastFetchedUrl = input.toString();
    if (init?.method === 'HEAD') {
      return new Response(null, { status: 200, headers: new Headers() });
    }
    return nativeFetch(input, init);
  }) as any;

  const missingLengthResult = await verifyCloudinaryAssetSize(validCloudinaryUrl);
  if (missingLengthResult !== false) {
    global.fetch = mockDefaultFetch as any;
    throw new Error('Expected verifyCloudinaryAssetSize to return false when Content-Length header is missing');
  }

  // 3c. Content-Length exceeds 5MB limit (e.g. 6MB) -> Must return false
  global.fetch = (async (input: any, init: any) => {
    lastFetchedUrl = input.toString();
    if (init?.method === 'HEAD') {
      const headers = new Headers();
      headers.set('content-length', (6 * 1024 * 1024).toString());
      return new Response(null, { status: 200, headers });
    }
    return nativeFetch(input, init);
  }) as any;

  const oversizedHeadResult = await verifyCloudinaryAssetSize(validCloudinaryUrl);
  if (oversizedHeadResult !== false) {
    global.fetch = mockDefaultFetch as any;
    throw new Error('Expected verifyCloudinaryAssetSize to return false when Content-Length > 5MB');
  }

  // 3d. Transformed URL: verify that HEAD path strips transformations to target original asset
  global.fetch = (async (input: any, init: any) => {
    lastFetchedUrl = input.toString();
    if (init?.method === 'HEAD') {
      const headers = new Headers();
      headers.set('content-length', (2 * 1024 * 1024).toString()); // 2MB ok
      return new Response(null, { status: 200, headers });
    }
    return nativeFetch(input, init);
  }) as any;

  const transformedCloudinaryUrl =
    'https://res.cloudinary.com/jaago-pilot/image/upload/w_800,c_fill,q_auto/v1700000000/jaago_complaints/sample.jpg';
  const sizeOk = await verifyCloudinaryAssetSize(transformedCloudinaryUrl);
  const expectedAuthoritativeUrl =
    'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/sample.jpg';

  if (!sizeOk || lastFetchedUrl !== expectedAuthoritativeUrl) {
    global.fetch = mockDefaultFetch as any;
    throw new Error(
      `HEAD size check did not target stripped original asset. Expected: ${expectedAuthoritativeUrl}, Got: ${lastFetchedUrl}`
    );
  }

  // Restore fetch to default test mock
  global.fetch = mockDefaultFetch as any;

  // 3e. Base64 payload size enforcement
  const oversizedBase64 = 'data:image/jpeg;base64,' + Buffer.alloc(6 * 1024 * 1024, 'a').toString('base64');
  const sizeOversized = await verifyCloudinaryAssetSize(oversizedBase64);

  if (sizeOk && !sizeOversized) {
    console.log(`[PASS] Test 3: Server-side asset size & HEAD path mocked verification confirmed:`);
    console.log(`       - HEAD 404 failure: rejected.`);
    console.log(`       - Missing Content-Length: rejected.`);
    console.log(`       - Content-Length > 5MB: rejected.`);
    console.log(`       - Transformed URL stripped to authoritative asset: "${expectedAuthoritativeUrl}".`);
    console.log(`       - Valid 2MB original asset: accepted.`);
    console.log(`       - Oversized 6MB base64 payload: rejected.`);
    passed++;
  } else {
    throw new Error('5MB server-side size verification failed');
  }

  // ------------------------------------------------------------------
  // 4. GPS ACCURACY WORSE THAN 50M REJECTED ON RESOLVE
  // ------------------------------------------------------------------
  console.log('\n--- Test 4: GPS Accuracy Quality Gate (Reject Accuracy > 50m) ---');
  const resolveTarget = await Complaint.findOne({ category: 'Roads', status: { $in: ['Pending', 'In Progress'] } });

  // Call with degraded accuracy (60m)
  const badGpsReq = new NextRequest(`http://localhost:3000/api/complaints/${resolveTarget!._id}/resolve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': officer!._id.toString(),
      'x-test-user-role': 'officer',
      'x-test-assigned-ward': resolveTarget!.wardId!.toString(),
    },
    body: JSON.stringify({
      lat: resolveTarget!.location.coordinates[1],
      lng: resolveTarget!.location.coordinates[0],
      accuracy: 65, // Worse than 50m threshold
      resolutionImageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/resolved.jpg',
      remarks: 'Attempt with degraded GPS.',
    }),
  });

  const badGpsRes = await resolvePATCH(badGpsReq, { params: { id: resolveTarget!._id.toString() } });
  const badGpsData = await badGpsRes.json();

  if (badGpsRes.status !== 400 || !badGpsData.error.includes('Please step into an open area with a clear view of the sky and retry')) {
    throw new Error(`Expected HTTP 400 with retry-in-open guidance, got: ${badGpsRes.status}: ${JSON.stringify(badGpsData)}`);
  }

  // Call with good accuracy (15m)
  const goodGpsReq = new NextRequest(`http://localhost:3000/api/complaints/${resolveTarget!._id}/resolve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': officer!._id.toString(),
      'x-test-user-role': 'officer',
      'x-test-assigned-ward': resolveTarget!.wardId!.toString(),
    },
    body: JSON.stringify({
      lat: resolveTarget!.location.coordinates[1],
      lng: resolveTarget!.location.coordinates[0],
      accuracy: 15, // Good accuracy
      resolutionImageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/resolved.jpg',
      remarks: 'Pothole asphalt patch completed with on-site GPS verification.',
    }),
  });

  const goodGpsRes = await resolvePATCH(goodGpsReq, { params: { id: resolveTarget!._id.toString() } });
  const goodGpsData = await goodGpsRes.json();

  if (goodGpsRes.status === 200 && goodGpsData.complaint.status === 'Pending Verification') {
    console.log(`[PASS] Test 4: GPS accuracy gate verified:`);
    console.log(`       - Accuracy > 50m rejected with: "${badGpsData.error}"`);
    console.log(`       - Accuracy <= 50m accepted on-site.`);
    passed++;
  } else {
    throw new Error(`Test 4 failed on good GPS: ${JSON.stringify(goodGpsData)}`);
  }

  // ------------------------------------------------------------------
  // 5. SERVER-SIDE DUPLICATE RE-CHECK (REAL ROUTE HANDLER: POST /api/complaints)
  // ------------------------------------------------------------------
  console.log('\n--- Test 5: Server-Side Duplicate Re-Check (Calling Real Route Handler) ---');
  const duplicatePayload = {
    title: 'Duplicate Overflow Garbage Pile',
    description: 'Testing duplicate interception via real POST /api/complaints route.',
    category: 'Sanitation',
    lat: 12.911635,
    lng: 77.6442,
    address: 'HSR Layout Sector 1',
    imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/sample.jpg',
    confirmDistinct: false,
  };

  const dupeReq = new NextRequest('http://localhost:3000/api/complaints', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': citizen!._id.toString(),
      'x-test-user-role': 'citizen',
    },
    body: JSON.stringify(duplicatePayload),
  });

  const dupeRes = await complaintsPOST(dupeReq);
  const dupeData = await dupeRes.json();

  if (dupeRes.status !== 409 || !dupeData.isDuplicate) {
    throw new Error(`Expected HTTP 409 Conflict with isDuplicate=true, got status ${dupeRes.status}`);
  }

  const overridePayload = { ...duplicatePayload, confirmDistinct: true, title: 'Confirmed Distinct Issue Near Garbage' };
  const overrideReq = new NextRequest('http://localhost:3000/api/complaints', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': citizen!._id.toString(),
      'x-test-user-role': 'citizen',
    },
    body: JSON.stringify(overridePayload),
  });

  const overrideRes = await complaintsPOST(overrideReq);
  const overrideData = await overrideRes.json();

  if (overrideRes.status === 201 && overrideData.complaint) {
    console.log(`[PASS] Test 5: Real POST /api/complaints duplicate re-check verified (409 Conflict vs 201 Created).`);
    passed++;
  } else {
    throw new Error('Test 5 failed');
  }

  // ------------------------------------------------------------------
  // 6. CRON_SECRET HEADER (REAL ROUTE HANDLER: POST /api/cron/auto-close)
  // ------------------------------------------------------------------
  console.log('\n--- Test 6: CRON_SECRET Header (Calling Real Route Handler) ---');
  const cronSecret = process.env.CRON_SECRET || 'jaago-cron-secure-pilot-secret-2025';

  const noHeaderReq = new NextRequest('http://localhost:3000/api/cron/auto-close', { method: 'POST' });
  const noHeaderRes = await autoClosePOST(noHeaderReq);

  const validTokenReq = new NextRequest('http://localhost:3000/api/cron/auto-close', {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const validTokenRes = await autoClosePOST(validTokenReq);
  const validTokenData = await validTokenRes.json();

  if (noHeaderRes.status === 401 && validTokenRes.status === 200 && validTokenData.success) {
    console.log(`[PASS] Test 6: Real POST /api/cron/auto-close protected by CRON_SECRET header.`);
    passed++;
  } else {
    throw new Error('Test 6 failed: Cron security check failed');
  }

  // ------------------------------------------------------------------
  // 7. DEMO_AUTH GATING [Config Assertion]
  // ------------------------------------------------------------------
  console.log('\n--- Test 7: Credentials Login Gated by DEMO_AUTH=true [Config Assertion] ---');
  const { authOptions } = await import('../lib/auth');

  process.env.DEMO_AUTH = 'false';
  const hasCredsWhenDisabled = authOptions.providers.some(
    (p: any) => p.id === 'credentials' || p.name === 'Credentials'
  );

  process.env.DEMO_AUTH = 'true';
  const hasCredsWhenEnabled = authOptions.providers.some(
    (p: any) => p.id === 'credentials' || p.name === 'Credentials'
  );

  if (!hasCredsWhenDisabled && hasCredsWhenEnabled) {
    console.log(`[PASS] Test 7: Credentials provider dynamically enabled ONLY when DEMO_AUTH='true'.`);
    console.log(`       (Mark: Cannot call route handler directly; asserted on NextAuth authOptions providers list).`);
    passed++;
  } else {
    throw new Error('Test 7 failed');
  }

  // ------------------------------------------------------------------
  // 8. DATABASE-BACKED RATE LIMITING (3 COMPLAINTS / HOUR)
  // ------------------------------------------------------------------
  console.log('\n--- Test 8: Database-Backed Rate Limiting (Calling Real Route Handler) ---');
  const spamUser = await User.create({
    name: 'Spam Rate User',
    email: `spam.limit.${Date.now()}@demo.jaago.app`,
    role: 'citizen',
  });

  for (let i = 1; i <= 3; i++) {
    const req = new NextRequest('http://localhost:3000/api/complaints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': spamUser._id.toString(),
        'x-test-user-role': 'citizen',
      },
      body: JSON.stringify({
        title: `Rate limit ticket ${i}`,
        description: 'Testing database-backed countDocuments.',
        category: 'Others',
        lat: 12.9352 + i * 0.001,
        lng: 77.6773,
        imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/spam.jpg',
        confirmDistinct: true,
      }),
    });
    const res = await complaintsPOST(req);
    if (res.status !== 201) throw new Error(`Submission ${i} failed`);
  }

  const spamReq4 = new NextRequest('http://localhost:3000/api/complaints', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': spamUser._id.toString(),
      'x-test-user-role': 'citizen',
    },
    body: JSON.stringify({
      title: 'Spam 4th attempt',
      description: 'Should trigger 429.',
      category: 'Others',
      lat: 12.939,
      lng: 77.6773,
      imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/spam4.jpg',
      confirmDistinct: true,
    }),
  });

  const spamRes4 = await complaintsPOST(spamReq4);
  if (spamRes4.status === 429) {
    console.log(`[PASS] Test 8: Real POST /api/complaints rejected 4th submission with HTTP 429 Too Many Requests.`);
    passed++;
  } else {
    throw new Error(`Expected 429, got ${spamRes4.status}`);
  }

  // ------------------------------------------------------------------
  // 9. ADMIN OFFICER ALLOW-LIST (ADD, DEACTIVATE, ASSIGN)
  // ------------------------------------------------------------------
  console.log('\n--- Test 9: Admin Officer Allow-List (Calling Real Route Handlers) ---');
  // 9a. Add new officer via POST /api/admin/officers
  const newOfficerEmail = `officer.test.${Date.now()}@demo.jaago.app`;
  const addOfficerReq = new NextRequest('http://localhost:3000/api/admin/officers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': admin!._id.toString(),
      'x-test-user-role': 'admin',
    },
    body: JSON.stringify({
      name: 'Assistant Engineer Koramangala',
      email: newOfficerEmail,
      agencyId: bbmpRoads!._id.toString(),
      assignedWardId: bellandurWard!._id.toString(),
      isActive: true,
    }),
  });

  const addOfficerRes = await adminOfficersPOST(addOfficerReq);
  const addOfficerData = await addOfficerRes.json();

  if (addOfficerRes.status !== 201 || !addOfficerData.officer) {
    throw new Error(`Failed to add officer: ${JSON.stringify(addOfficerData)}`);
  }

  // 9b. Deactivate officer via PATCH /api/admin/officers/[id]
  const officerRecordId = addOfficerData.officer._id;
  const deactivateReq = new NextRequest(`http://localhost:3000/api/admin/officers/${officerRecordId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': admin!._id.toString(),
      'x-test-user-role': 'admin',
    },
    body: JSON.stringify({ isActive: false }),
  });

  const deactivateRes = await adminOfficerUpdatePATCH(deactivateReq, { params: { id: officerRecordId } });
  const deactivateData = await deactivateRes.json();

  if (deactivateRes.status === 200 && deactivateData.officer.isActive === false) {
    console.log(`[PASS] Test 9: Admin Officer Allow-List management verified:`);
    console.log(`       - Added officer '${newOfficerEmail}' successfully.`);
    console.log(`       - Updated isActive to false successfully.`);
    passed++;
  } else {
    throw new Error('Test 9 failed to update officer status');
  }

  // ------------------------------------------------------------------
  // 10. ADMIN TRIAGE QUEUE & MANUAL ROUTING (APPENDS TO statusHistory)
  // ------------------------------------------------------------------
  console.log('\n--- Test 10: Admin Triage & Manual Routing (Real Route Handlers) ---');
  // Create an unassigned complaint (simulating border / unrouted case)
  const unroutedComplaint = await Complaint.create({
    title: 'Unassigned Border Pothole',
    description: 'Complaint on peripheral border missing ward polygon assignment.',
    category: 'Roads',
    location: { type: 'Point', coordinates: [77.6784, 12.9304] },
    address: 'Outer Ring Road Border',
    imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/border.jpg',
    status: 'Pending',
    reportedBy: citizen!._id,
    upvotesCount: 1,
    statusHistory: [
      {
        status: 'Pending',
        actorId: citizen!._id,
        role: 'citizen',
        timestamp: new Date(),
        remarks: 'Reported on border.',
      },
    ],
  });

  // Query triage queue
  const triageReq = new NextRequest('http://localhost:3000/api/admin/triage', {
    method: 'GET',
    headers: {
      'x-test-user-id': admin!._id.toString(),
      'x-test-user-role': 'admin',
    },
  });
  const triageRes = await adminTriageGET(triageReq);
  const triageData = await triageRes.json();

  if (triageRes.status !== 200 || triageData.count < 1) {
    throw new Error('Triage queue did not return unassigned complaint');
  }

  // Assign ward and agency via PATCH /api/admin/complaints/[id]/assign
  const assignReq = new NextRequest(`http://localhost:3000/api/admin/complaints/${unroutedComplaint._id}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': admin!._id.toString(),
      'x-test-user-role': 'admin',
    },
    body: JSON.stringify({
      wardId: bellandurWard!._id.toString(),
      agencyId: bbmpRoads!._id.toString(),
      remarks: 'Manually routed to Bellandur Ward and BBMP Roads by Admin.',
    }),
  });

  const assignRes = await adminAssignPATCH(assignReq, { params: { id: unroutedComplaint._id.toString() } });
  const assignData = await assignRes.json();

  const assignedDoc = await Complaint.findById(unroutedComplaint._id);
  const lastHistoryEntry = assignedDoc?.statusHistory[assignedDoc.statusHistory.length - 1];

  if (
    assignRes.status === 200 &&
    assignedDoc?.wardId?.toString() === bellandurWard!._id.toString() &&
    lastHistoryEntry?.role === 'admin'
  ) {
    console.log(`[PASS] Test 10: Admin Triage & Assignment verified:`);
    console.log(`       - Unassigned complaint detected in triage queue.`);
    console.log(`       - Manually assigned to Bellandur Ward and BBMP Roads.`);
    console.log(`       - Audit log updated in statusHistory: "${lastHistoryEntry.remarks}".`);
    passed++;
  } else {
    throw new Error('Test 10 assignment verification failed');
  }

  // ------------------------------------------------------------------
  // 11. DISPUTED - ADMIN REVIEW QUEUE & ARBITRATION (APPENDS TO statusHistory)
  // ------------------------------------------------------------------
  console.log('\n--- Test 11: Disputed Queue & Arbitration (Calling Real Route Handlers) ---');
  // Seed ticket in Disputed - Admin Review
  const disputedTicket = await Complaint.create({
    title: 'Disputed Drainage Cleanliness',
    description: 'Citizen contested 3 times, escalating to admin arbitration.',
    category: 'Water Supply & Drainage',
    location: { type: 'Point', coordinates: [77.6255, 12.9345] },
    address: 'Koramangala 4th Block',
    wardId: bellandurWard!._id,
    agencyId: bbmpRoads!._id,
    imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/disputed.jpg',
    resolutionImageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/disputed_res.jpg',
    status: 'Disputed - Admin Review',
    reportedBy: citizen!._id,
    upvotesCount: 3,
    reopenCount: 3,
    statusHistory: [
      {
        status: 'Disputed - Admin Review',
        actorId: citizen!._id,
        role: 'citizen',
        timestamp: new Date(),
        remarks: '[Circuit Breaker Tripped - Dispute #3] Citizen rejected fix.',
      },
    ],
  });

  // Query disputes queue
  const disputesReq = new NextRequest('http://localhost:3000/api/admin/disputes', {
    method: 'GET',
    headers: {
      'x-test-user-id': admin!._id.toString(),
      'x-test-user-role': 'admin',
    },
  });
  const disputesRes = await adminDisputesGET(disputesReq);
  const disputesData = await disputesRes.json();

  if (disputesRes.status !== 200 || disputesData.count < 1) {
    throw new Error('Disputes queue failed to return disputed complaint');
  }

  // Arbitrate: uphold resolution
  const arbitrateReq = new NextRequest(`http://localhost:3000/api/admin/complaints/${disputedTicket._id}/arbitrate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': admin!._id.toString(),
      'x-test-user-role': 'admin',
    },
    body: JSON.stringify({
      action: 'resolve',
      remarks: 'After reviewing CCTV and contractor manifests, the RCC drain cover was installed properly.',
    }),
  });

  const arbitrateRes = await adminArbitratePATCH(arbitrateReq, { params: { id: disputedTicket._id.toString() } });
  const arbitrateData = await arbitrateRes.json();

  const arbitratedDoc = await Complaint.findById(disputedTicket._id);
  const arbitratedHistory = arbitratedDoc?.statusHistory[arbitratedDoc.statusHistory.length - 1];

  if (
    arbitrateRes.status === 200 &&
    arbitratedDoc?.status === 'Resolved - Citizen Verified' &&
    arbitratedHistory?.remarks?.includes('Admin Arbitration')
  ) {
    console.log(`[PASS] Test 11: Admin Dispute Arbitration verified:`);
    console.log(`       - Ticket fetched from Disputed - Admin Review queue.`);
    console.log(`       - Arbitrated to 'Resolved - Citizen Verified'.`);
    console.log(`       - Appended to statusHistory: "${arbitratedHistory.remarks}".`);
    passed++;
  } else {
    throw new Error('Test 11 arbitration failed');
  }

  // ------------------------------------------------------------------
  // 12. MARK COMPLAINT REJECTED - INVALID WITH REASON (APPENDS TO statusHistory)
  // ------------------------------------------------------------------
  console.log('\n--- Test 12: Invalidate Complaint with Reason (Calling Real Handler) ---');
  const invalidTarget = await Complaint.findOne({ status: 'Pending' });

  const rejectReq = new NextRequest(`http://localhost:3000/api/admin/complaints/${invalidTarget!._id}/reject`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': admin!._id.toString(),
      'x-test-user-role': 'admin',
    },
    body: JSON.stringify({
      reason: 'Incident occurred on private apartment complex property outside Greater Bengaluru municipal jurisdiction.',
    }),
  });

  const rejectRes = await adminRejectPATCH(rejectReq, { params: { id: invalidTarget!._id.toString() } });
  const rejectData = await rejectRes.json();

  const rejectedDoc = await Complaint.findById(invalidTarget!._id);
  const rejectHistory = rejectedDoc?.statusHistory[rejectedDoc.statusHistory.length - 1];

  if (
    rejectRes.status === 200 &&
    rejectedDoc?.status === 'Rejected - Invalid' &&
    rejectHistory?.remarks?.includes('Marked Rejected - Invalid by Admin')
  ) {
    console.log(`[PASS] Test 12: Invalidation verified:`);
    console.log(`       - Complaint transitioned to 'Rejected - Invalid'.`);
    console.log(`       - Reason appended to statusHistory: "${rejectHistory.remarks}".`);
    passed++;
  } else {
    throw new Error('Test 12 invalidation failed');
  }

  // ------------------------------------------------------------------
  // 13. NOTIFICATIONS SUBSYSTEM & CRON 72H REMINDERS
  // ------------------------------------------------------------------
  console.log('\n--- Test 13: Notifications Subsystem (Assignment, Resolution, Reopen, 72h Reminder, Auto-Close) ---');
  // Seed ticket in Pending Verification eligible for 72h reminder (deadline 36h from now, so 84h elapsed)
  const reminderComplaint = await Complaint.create({
    title: 'Reminder Eligible Manhole Cover',
    description: 'Testing 72h reminder notification.',
    category: 'Water Supply & Drainage',
    location: { type: 'Point', coordinates: [77.6255, 12.9345] },
    address: 'Koramangala',
    wardId: bellandurWard!._id,
    agencyId: bbmpRoads!._id,
    imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/rem.jpg',
    status: 'Pending Verification',
    reportedBy: citizen!._id,
    upvotesCount: 1,
    verificationDeadline: new Date(Date.now() + 36 * 3600 * 1000), // 36 hours remaining (<= 48h)
  });

  // Call cron daemon (Run 1: should send 1 reminder and set reminderSentAt)
  const cronDaemonReq1 = new NextRequest('http://localhost:3000/api/cron/auto-close', {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const cronDaemonRes1 = await autoClosePOST(cronDaemonReq1);
  const cronDaemonData1 = await cronDaemonRes1.json();

  // Verify reminderSentAt timestamp recorded on complaint document
  const reloadedReminderComplaint = await Complaint.findById(reminderComplaint._id);
  if (!reloadedReminderComplaint?.reminderSentAt) {
    throw new Error('Test 13 failed: Complaint.reminderSentAt was not recorded on first cron run');
  }

  // Call cron daemon immediately a 2nd time: should find 0 complaints needing reminder (idempotent)
  const cronDaemonReq2 = new NextRequest('http://localhost:3000/api/cron/auto-close', {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const cronDaemonRes2 = await autoClosePOST(cronDaemonReq2);
  const cronDaemonData2 = await cronDaemonRes2.json();

  // Verify exactly 1 reminder notification was generated across both runs
  const reminderNotifs = await Notification.find({
    complaintId: reminderComplaint._id,
    type: 'reminder',
  });

  if (
    cronDaemonRes1.status === 200 &&
    cronDaemonRes2.status === 200 &&
    cronDaemonData1.reminderSentCount >= 1 &&
    cronDaemonData2.reminderSentCount === 0 &&
    reminderNotifs.length === 1
  ) {
    console.log(`[PASS] Test 13: Notifications & 72h reminder idempotence verified:`);
    console.log(`       - Run 1 dispatched reminder and set reminderSentAt: ${reloadedReminderComplaint.reminderSentAt.toISOString()}`);
    console.log(`       - Run 2 dispatched 0 reminders (idempotent duplicate prevention).`);
    console.log(`       - Exactly 1 reminder notification persisted in database.`);
    passed++;
  } else {
    throw new Error('Test 13 72h reminder idempotence verification failed');
  }

  // ------------------------------------------------------------------
  // 14. SOURCE AUDIT & CONFIRM TEST-ONLY SHORTCUT SAFETY
  // [CANNOT CALL ROUTE HANDLER DIRECTLY]: Confirms code safety of apiAuth.ts
  // ------------------------------------------------------------------
  console.log('\n--- Test 14: apiAuth.ts Test-Only Auth Shortcut Safety Audit ---');
  const apiAuthCode = fs.readFileSync(path.join(process.cwd(), 'lib', 'apiAuth.ts'), 'utf-8');
  const hasStrictTestGate = apiAuthCode.includes("process.env.NODE_ENV === 'test'");

  if (hasStrictTestGate) {
    console.log(`[PASS] Test 14: apiAuth.ts strictly gates header auth with process.env.NODE_ENV === 'test'.`);
    console.log(`       (Mark: Cannot call route handler directly; asserted on lib/apiAuth.ts AST/source code).`);
    passed++;
  } else {
    throw new Error('Test 14 failed: Test gate missing in lib/apiAuth.ts');
  }

  // ------------------------------------------------------------------
  // 15. NEGATIVE TESTS: ALL /api/admin/* (401/403) & OFFICER WARD ISOLATION (403)
  // ------------------------------------------------------------------
  console.log('\n--- Test 15: Negative Tests: Admin Routes (401/403) & Officer Ward Isolation ---');
  const testSampleComplaint = await Complaint.findOne({ wardId: bellandurWard!._id });
  const testSampleOfficer = await OfficerAllowList.findOne();

  // Define all 9 admin operations to test
  const adminEndpoints: Array<{ name: string; invoke: (headers: Record<string, string>) => Promise<Response> }> = [
    {
      name: 'GET /api/admin/officers',
      invoke: (h) => adminOfficersGET(new NextRequest('http://localhost:3000/api/admin/officers', { headers: h })),
    },
    {
      name: 'POST /api/admin/officers',
      invoke: (h) =>
        adminOfficersPOST(
          new NextRequest('http://localhost:3000/api/admin/officers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...h },
            body: JSON.stringify({
              name: 'Unauthorized Test',
              email: 'unauth@demo.jaago.app',
              agencyId: bbmpRoads!._id.toString(),
              assignedWardId: bellandurWard!._id.toString(),
            }),
          })
        ),
    },
    {
      name: 'PATCH /api/admin/officers/[id]',
      invoke: (h) =>
        adminOfficerUpdatePATCH(
          new NextRequest(`http://localhost:3000/api/admin/officers/${testSampleOfficer!._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...h },
            body: JSON.stringify({ isActive: false }),
          }),
          { params: { id: testSampleOfficer!._id.toString() } }
        ),
    },
    {
      name: 'GET /api/admin/triage',
      invoke: (h) => adminTriageGET(new NextRequest('http://localhost:3000/api/admin/triage', { headers: h })),
    },
    {
      name: 'PATCH /api/admin/complaints/[id]/assign',
      invoke: (h) =>
        adminAssignPATCH(
          new NextRequest(`http://localhost:3000/api/admin/complaints/${testSampleComplaint!._id}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...h },
            body: JSON.stringify({ wardId: bellandurWard!._id.toString(), agencyId: bbmpRoads!._id.toString() }),
          }),
          { params: { id: testSampleComplaint!._id.toString() } }
        ),
    },
    {
      name: 'GET /api/admin/disputes',
      invoke: (h) => adminDisputesGET(new NextRequest('http://localhost:3000/api/admin/disputes', { headers: h })),
    },
    {
      name: 'PATCH /api/admin/complaints/[id]/arbitrate',
      invoke: (h) =>
        adminArbitratePATCH(
          new NextRequest(`http://localhost:3000/api/admin/complaints/${testSampleComplaint!._id}/arbitrate`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...h },
            body: JSON.stringify({ action: 'resolve', remarks: 'Arbitration remarks by admin' }),
          }),
          { params: { id: testSampleComplaint!._id.toString() } }
        ),
    },
    {
      name: 'PATCH /api/admin/complaints/[id]/reject',
      invoke: (h) =>
        adminRejectPATCH(
          new NextRequest(`http://localhost:3000/api/admin/complaints/${testSampleComplaint!._id}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...h },
            body: JSON.stringify({ reason: 'Invalid non-civic complaint' }),
          }),
          { params: { id: testSampleComplaint!._id.toString() } }
        ),
    },
    {
      name: 'GET /api/admin/metadata',
      invoke: (h) => adminMetadataGET(new NextRequest('http://localhost:3000/api/admin/metadata', { headers: h })),
    },
  ];

  // Run 401 and 403 checks across all admin endpoints
  for (const endpoint of adminEndpoints) {
    // 1. Anonymous (no auth header) -> HTTP 401
    const anonRes = await endpoint.invoke({});
    if (anonRes.status !== 401) {
      throw new Error(`Expected HTTP 401 for anonymous caller on ${endpoint.name}, got ${anonRes.status}`);
    }

    // 2. Citizen role -> HTTP 403
    const citizenRes = await endpoint.invoke({
      'x-test-user-id': citizen!._id.toString(),
      'x-test-user-role': 'citizen',
    });
    if (citizenRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for citizen caller on ${endpoint.name}, got ${citizenRes.status}`);
    }

    // 3. Officer role -> HTTP 403
    const officerRes = await endpoint.invoke({
      'x-test-user-id': officer!._id.toString(),
      'x-test-user-role': 'officer',
    });
    if (officerRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for officer caller on ${endpoint.name}, got ${officerRes.status}`);
    }
  }

  // Officer Ward Jurisdiction Check:
  // Officer assigned to Bellandur attempts to resolve or update a complaint in HSR Layout
  const hsrWard = await Ward.findOne({ code: 'W-174' });
  const hsrComplaint = await Complaint.create({
    title: 'HSR Layout Broken Pavement',
    description: 'Complaint in HSR Layout for ward isolation testing.',
    category: 'Roads',
    location: { type: 'Point', coordinates: [77.6385, 12.912] },
    address: 'HSR Layout Sector 2',
    wardId: hsrWard!._id,
    agencyId: bbmpRoads!._id,
    imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/hsr.jpg',
    status: 'In Progress',
    reportedBy: citizen!._id,
    upvotesCount: 1,
  });

  // Attempt resolve by Bellandur officer on HSR ticket -> 403
  const foreignResolveReq = new NextRequest(
    `http://localhost:3000/api/complaints/${hsrComplaint._id}/resolve`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': officer!._id.toString(),
        'x-test-user-role': 'officer',
        'x-test-assigned-ward': bellandurWard!._id.toString(), // Bellandur ward != HSR ward
      },
      body: JSON.stringify({
        lat: 12.912,
        lng: 77.6385,
        accuracy: 15,
        resolutionImageUrl: 'data:image/jpeg;base64,' + Buffer.from('hsr-proof').toString('base64'),
        remarks: 'Resolving from wrong ward officer',
      }),
    }
  );
  const foreignResolveRes = await resolvePATCH(foreignResolveReq, { params: { id: hsrComplaint._id.toString() } });
  if (foreignResolveRes.status !== 403) {
    throw new Error(`Expected HTTP 403 when officer resolves complaint outside ward, got ${foreignResolveRes.status}`);
  }

  // Attempt status change by Bellandur officer on HSR ticket -> 403
  const foreignStatusReq = new NextRequest(
    `http://localhost:3000/api/complaints/${hsrComplaint._id}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': officer!._id.toString(),
        'x-test-user-role': 'officer',
        'x-test-assigned-ward': bellandurWard!._id.toString(),
      },
      body: JSON.stringify({
        status: 'In Progress',
        remarks: 'Unauthorized status transition',
      }),
    }
  );
  const foreignStatusRes = await statusPATCH(foreignStatusReq, { params: { id: hsrComplaint._id.toString() } });
  if (foreignStatusRes.status !== 403) {
    throw new Error(`Expected HTTP 403 when officer updates status of complaint outside ward, got ${foreignStatusRes.status}`);
  }

  // Deny officer with no assignedWardId
  const unassignedOfficerReq = new NextRequest(
    `http://localhost:3000/api/complaints/${hsrComplaint._id}/resolve`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': officer!._id.toString(),
        'x-test-user-role': 'officer',
        // Note: x-test-assigned-ward omitted
      },
      body: JSON.stringify({
        lat: 12.912,
        lng: 77.6385,
        accuracy: 15,
        resolutionImageUrl: 'data:image/jpeg;base64,' + Buffer.from('hsr-proof').toString('base64'),
        remarks: 'Resolving from officer with no ward assignment',
      }),
    }
  );
  const unassignedOfficerRes = await resolvePATCH(unassignedOfficerReq, { params: { id: hsrComplaint._id.toString() } });
  const unassignedOfficerData = await unassignedOfficerRes.json();
  if (unassignedOfficerRes.status !== 403 || !unassignedOfficerData.error.includes('no assigned ward jurisdiction')) {
    throw new Error(`Expected HTTP 403 when officer has no assignedWardId, got: ${unassignedOfficerRes.status}: ${JSON.stringify(unassignedOfficerData)}`);
  }

  // Deny officer action on complaint with no wardId
  const noWardComplaint = await Complaint.create({
    title: 'Perimeter Drainage Issue',
    description: 'Complaint with no wardId assignment.',
    category: 'Water Supply & Drainage',
    location: { type: 'Point', coordinates: [77.6, 12.9] },
    address: 'Unassigned Perimeter',
    status: 'In Progress',
    reportedBy: citizen!._id,
    imageUrl: 'data:image/jpeg;base64,' + Buffer.from('no-ward-proof').toString('base64'),
    upvotesCount: 1,
    // wardId omitted
  });

  const noWardActionReq = new NextRequest(
    `http://localhost:3000/api/complaints/${noWardComplaint._id}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': officer!._id.toString(),
        'x-test-user-role': 'officer',
        'x-test-assigned-ward': bellandurWard!._id.toString(),
      },
      body: JSON.stringify({
        status: 'In Progress',
        remarks: 'Attempting status change on unrouted ticket',
      }),
    }
  );
  const noWardActionRes = await statusPATCH(noWardActionReq, { params: { id: noWardComplaint._id.toString() } });
  const noWardActionData = await noWardActionRes.json();
  if (noWardActionRes.status !== 403 || !noWardActionData.error.includes('unrouted complaint with no ward assignment')) {
    throw new Error(`Expected HTTP 403 on complaint with no wardId, got: ${noWardActionRes.status}: ${JSON.stringify(noWardActionData)}`);
  }

  console.log(`[PASS] Test 15: Negative authorization & officer ward isolation verified:`);
  console.log(`       - All 9 /api/admin/* routes return 401 for anonymous callers.`);
  console.log(`       - All 9 /api/admin/* routes return 403 for citizen and officer callers.`);
  console.log(`       - Officer outside ward attempting resolve returns HTTP 403.`);
  console.log(`       - Officer outside ward attempting status change returns HTTP 403.`);
  console.log(`       - Officer with no assignedWardId returns HTTP 403.`);
  console.log(`       - Officer acting on complaint with no wardId returns HTTP 403.`);
  passed++;

  // ------------------------------------------------------------------
  // 16. UNROUTED COMPLAINTS ISOLATION
  // ------------------------------------------------------------------
  console.log('\n--- Test 16: Unrouted Complaints Isolation (Admin Triage Only) ---');
  const isolatedUnroutedComplaint = await Complaint.create({
    title: 'Boundary Boundary Edge Case Issue',
    description: 'Outside designated Greater Bengaluru pilot polygons.',
    category: 'Roads',
    location: { type: 'Point', coordinates: [77.5, 12.8] },
    address: 'Bengaluru Peripheral Ring Road',
    imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/unrouted.jpg',
    status: 'Pending',
    reportedBy: citizen!._id,
    upvotesCount: 1,
    // wardId is omitted / undefined
  });

  // Query GET /api/complaints (public/explore/officer default list)
  const listReq = new NextRequest('http://localhost:3000/api/complaints?limit=100');
  const listRes = await complaintsGET(listReq);
  const listData = await listRes.json();
  const foundInPublicList = (listData.complaints || []).some(
    (c: any) => c._id.toString() === isolatedUnroutedComplaint._id.toString()
  );
  if (foundInPublicList) {
    throw new Error('Unrouted complaint without wardId was leaked in public GET /api/complaints list!');
  }

  // Query GET /api/admin/triage (admin triage queue)
  const triageQueueReq = new NextRequest('http://localhost:3000/api/admin/triage', {
    headers: {
      'x-test-user-id': admin!._id.toString(),
      'x-test-user-role': 'admin',
    },
  });
  const triageQueueRes = await adminTriageGET(triageQueueReq);
  const triageQueueData = await triageQueueRes.json();
  const foundInTriage = (triageQueueData.complaints || []).some(
    (c: any) => c._id.toString() === isolatedUnroutedComplaint._id.toString()
  );
  if (!foundInTriage) {
    throw new Error('Unrouted complaint without wardId was not found in admin triage queue!');
  }

  // Verify getLeaderboardData does not include unrouted complaints
  const leaderboardStats = await getLeaderboardData();
  const totalWardsComplaints = leaderboardStats.reduce((sum, w) => sum + w.totalComplaints, 0);
  const dbWardsComplaints = await Complaint.countDocuments({ wardId: { $ne: null, $exists: true } });
  if (totalWardsComplaints !== dbWardsComplaints) {
    throw new Error(
      `Leaderboard counted unrouted complaints! Total in leaderboard: ${totalWardsComplaints}, expected with ward: ${dbWardsComplaints}`
    );
  }

  console.log(`[PASS] Test 16: Unrouted complaints isolation verified:`);
  console.log(`       - Excluded from public GET /api/complaints.`);
  console.log(`       - Present exclusively in GET /api/admin/triage.`);
  console.log(`       - Excluded from Civic Trust Index leaderboard calculations.`);
  passed++;

  // ------------------------------------------------------------------
  // 17. CIVIC TRUST INDEX (CTI): CLOSED DENOMINATORS & SAMPLE THRESHOLD
  // ------------------------------------------------------------------
  console.log('\n--- Test 17: Civic Trust Index (CTI) Refinements & Small-Sample/Zero Edge Cases ---');

  // 17a. Zero-ticket ward
  const zeroWardStats = calculateSingleWardStats(
    { _id: 'ward-zero-id', name: 'Zero Ticket Ward', code: 'W-000', corporation: 'BBMP' },
    []
  );
  if (
    zeroWardStats.hasEnoughData !== false ||
    zeroWardStats.ctiScore !== null ||
    zeroWardStats.rank !== null ||
    zeroWardStats.closedCount !== 0 ||
    zeroWardStats.openCount !== 0 ||
    zeroWardStats.overdueOpenCount !== 0 ||
    zeroWardStats.overdueOpenRate !== null ||
    Number.isNaN(zeroWardStats.ctiScore)
  ) {
    throw new Error('Zero-ticket ward CTI assertion failed: must have hasEnoughData: false, ctiScore: null, overdueOpenRate: null');
  }

  // 17b. Small-sample ward (< 10 closed complaints, e.g. 5 closed: 4 verified, 1 auto-closed)
  const smallSampleComplaints = [
    { status: 'Resolved - Citizen Verified', createdAt: new Date(), statusHistory: [{ timestamp: new Date() }] },
    { status: 'Resolved - Citizen Verified', createdAt: new Date(), statusHistory: [{ timestamp: new Date() }] },
    { status: 'Resolved - Citizen Verified', createdAt: new Date(), statusHistory: [{ timestamp: new Date() }] },
    { status: 'Resolved - Citizen Verified', createdAt: new Date(), statusHistory: [{ timestamp: new Date() }] },
    { status: 'Resolved - Auto Closed', createdAt: new Date(), statusHistory: [{ timestamp: new Date() }] },
    { status: 'Pending', createdAt: new Date() }, // open ticket should not count in closed denominator
  ];
  const smallWardStats = calculateSingleWardStats(
    { _id: 'ward-small-id', name: 'Small Sample Ward', code: 'W-111', corporation: 'BBMP' },
    smallSampleComplaints
  );
  if (
    smallWardStats.hasEnoughData !== false ||
    smallWardStats.ctiScore !== null ||
    smallWardStats.rank !== null ||
    smallWardStats.closedCount !== 5 ||
    smallWardStats.openCount !== 1 ||
    smallWardStats.participationRate !== 80
  ) {
    throw new Error('Small-sample ward (< 10 closed) must have hasEnoughData: false and ctiScore: null');
  }

  // 17c. Large-sample ward (>= 10 closed complaints, e.g. 12 closed: 9 verified, 3 auto closed, 1 reopened)
  const largeSampleComplaints: any[] = [];
  // 9 Citizen Verified (1 with a reopen)
  for (let i = 0; i < 9; i++) {
    largeSampleComplaints.push({
      status: 'Resolved - Citizen Verified',
      category: 'Roads',
      reopenCount: i === 0 ? 1 : 0,
      createdAt: new Date(Date.now() - 24 * 3600 * 1000),
      statusHistory: [{ timestamp: new Date() }], // 24h duration <= 72h SLA
    });
  }
  // 3 Auto Closed
  for (let i = 0; i < 3; i++) {
    largeSampleComplaints.push({
      status: 'Resolved - Auto Closed',
      category: 'Roads',
      reopenCount: 0,
      createdAt: new Date(Date.now() - 48 * 3600 * 1000),
      statusHistory: [{ timestamp: new Date() }], // 48h duration <= 72h SLA
    });
  }
  const largeWardStats = calculateSingleWardStats(
    { _id: 'ward-large-id', name: 'Large Sample Ward', code: 'W-222', corporation: 'BBMP' },
    largeSampleComplaints
  );
  if (
    largeWardStats.hasEnoughData !== true ||
    typeof largeWardStats.ctiScore !== 'number' ||
    largeWardStats.closedCount !== 12 ||
    largeWardStats.citizenVerifiedCount !== 9 ||
    largeWardStats.autoClosedCount !== 3 ||
    largeWardStats.participationRate !== 75 ||
    largeWardStats.citizenVerifiedRate !== 0.75 ||
    largeWardStats.autoClosedRate !== 0.25 ||
    largeWardStats.reopenRate !== 1 / 12 ||
    largeWardStats.slaComplianceRate !== 1.0 ||
    largeWardStats.openCount !== 0 ||
    largeWardStats.overdueOpenRate !== null
  ) {
    throw new Error(`Large-sample ward calculation failed: ${JSON.stringify(largeWardStats)}`);
  }

  // 17d. ParticipationRate: distinct closed complaints where citizen verified OR reopened (never exceeds 100%)
  const reopenedThenVerifiedComplaint = {
    status: 'Resolved - Citizen Verified',
    category: 'Roads',
    reopenCount: 2, // Reopened twice, then verified
    createdAt: new Date(Date.now() - 36 * 3600 * 1000),
    statusHistory: [
      { status: 'Pending Verification', role: 'officer', timestamp: new Date(Date.now() - 30 * 3600 * 1000) },
      { status: 'Reopened - Escalated', role: 'citizen', timestamp: new Date(Date.now() - 25 * 3600 * 1000) },
      { status: 'Pending Verification', role: 'officer', timestamp: new Date(Date.now() - 15 * 3600 * 1000) },
      { status: 'Resolved - Citizen Verified', role: 'citizen', timestamp: new Date(Date.now() - 10 * 3600 * 1000) },
    ],
  };
  const distinctSingleWard = calculateSingleWardStats(
    { _id: 'ward-distinct-1', name: 'Distinct Single Ward', code: 'W-301', corporation: 'BBMP' },
    [reopenedThenVerifiedComplaint]
  );
  if (
    distinctSingleWard.closedCount !== 1 ||
    distinctSingleWard.citizenVerifiedCount !== 1 ||
    distinctSingleWard.reopenedCount !== 1 ||
    distinctSingleWard.participationRate !== 100
  ) {
    throw new Error(
      `Reopened and verified complaint failed distinct rate: ${distinctSingleWard.participationRate}%`
    );
  }

  // Two closed tickets: 1 reopened & verified, 1 auto-closed without reopen -> participationRate must be 50%, never > 100%
  const distinctTwoWard = calculateSingleWardStats(
    { _id: 'ward-distinct-2', name: 'Distinct Two Ward', code: 'W-302', corporation: 'BBMP' },
    [
      reopenedThenVerifiedComplaint,
      {
        status: 'Resolved - Auto Closed',
        category: 'Roads',
        reopenCount: 0,
        createdAt: new Date(Date.now() - 120 * 3600 * 1000),
        statusHistory: [{ timestamp: new Date() }],
      },
    ]
  );
  if (
    distinctTwoWard.closedCount !== 2 ||
    distinctTwoWard.participationRate !== 50 ||
    distinctTwoWard.participationRate > 100
  ) {
    throw new Error(
      `Distinct two-complaint participation rate failed: ${distinctTwoWard.participationRate}%`
    );
  }

  // 17e. OverdueOpenRate per ward: open complaints past category SLA / all open complaints
  // Edge case: Zero open complaints
  const zeroOpenWard = calculateSingleWardStats(
    { _id: 'ward-zero-open', name: 'Zero Open Ward', code: 'W-401', corporation: 'BBMP' },
    [
      {
        status: 'Resolved - Citizen Verified',
        createdAt: new Date(),
        statusHistory: [{ timestamp: new Date() }],
      },
    ]
  );
  if (
    zeroOpenWard.openCount !== 0 ||
    zeroOpenWard.overdueOpenCount !== 0 ||
    zeroOpenWard.overdueOpenRate !== null
  ) {
    throw new Error(
      'Zero open complaints must return openCount: 0, overdueOpenCount: 0, overdueOpenRate: null'
    );
  }

  // Mixed open complaints:
  // 1. Sanitation (SLA = 24h), created 30h ago, status 'Pending' -> Overdue!
  // 2. Roads (SLA = 72h), created 10h ago, status 'In Progress' -> Compliant!
  // 3. Streetlights (SLA = 48h), created 60h ago, resolved at 20h, status 'Pending Verification' -> Compliant (officer resolved at 20h <= 48h)!
  // 4. Streetlights (SLA = 48h), created 60h ago, resolved at 55h, status 'Pending Verification' -> Overdue (officer resolved at 55h > 48h)!
  // 5. Rejected - Invalid -> ignored from openComplaints!
  // 6. Resolved - Citizen Verified -> ignored from openComplaints!
  const mixedOpenComplaints = [
    {
      category: 'Sanitation',
      status: 'Pending',
      createdAt: new Date(Date.now() - 30 * 3600 * 1000), // 30h > 24h SLA
    },
    {
      category: 'Roads',
      status: 'In Progress',
      createdAt: new Date(Date.now() - 10 * 3600 * 1000), // 10h <= 72h SLA
    },
    {
      category: 'Streetlights',
      status: 'Pending Verification',
      createdAt: new Date(Date.now() - 60 * 3600 * 1000),
      statusHistory: [
        {
          status: 'Pending Verification',
          role: 'officer',
          timestamp: new Date(Date.now() - 40 * 3600 * 1000), // resolved 20h after creation <= 48h SLA
        },
      ],
    },
    {
      category: 'Streetlights',
      status: 'Pending Verification',
      createdAt: new Date(Date.now() - 60 * 3600 * 1000),
      statusHistory: [
        {
          status: 'Pending Verification',
          role: 'officer',
          timestamp: new Date(Date.now() - 5 * 3600 * 1000), // resolved 55h after creation > 48h SLA
        },
      ],
    },
    {
      category: 'Roads',
      status: 'Rejected - Invalid',
      createdAt: new Date(Date.now() - 100 * 3600 * 1000),
    },
    {
      category: 'Roads',
      status: 'Resolved - Citizen Verified',
      createdAt: new Date(Date.now() - 20 * 3600 * 1000),
      statusHistory: [{ timestamp: new Date() }],
    },
  ];
  const mixedOpenWard = calculateSingleWardStats(
    { _id: 'ward-mixed-open', name: 'Mixed Open Ward', code: 'W-402', corporation: 'BBMP' },
    mixedOpenComplaints
  );
  if (
    mixedOpenWard.openCount !== 4 ||
    mixedOpenWard.overdueOpenCount !== 2 ||
    mixedOpenWard.overdueOpenRate !== 50
  ) {
    throw new Error(
      `Mixed open ward failed: openCount=${mixedOpenWard.openCount}, overdue=${mixedOpenWard.overdueOpenCount}, rate=${mixedOpenWard.overdueOpenRate}%`
    );
  }

  // 17f. Category-based SLA configuration and clock running to officer's resolve action
  if (
    CATEGORY_SLA_HOURS.Sanitation !== 24 ||
    CATEGORY_SLA_HOURS.Streetlights !== 48 ||
    CATEGORY_SLA_HOURS['Water Supply & Drainage'] !== 48 ||
    CATEGORY_SLA_HOURS.Roads !== 72 ||
    CATEGORY_SLA_HOURS.Others !== 72 ||
    getCategorySlaHours('NonExistent' as any) !== 72
  ) {
    throw new Error('CATEGORY_SLA_HOURS configuration mismatch');
  }

  // Verify that clock stops at officer resolve action:
  // Complaint created 100h ago, officer resolved at 20h, citizen verified at 96h.
  // Category: Sanitation (SLA = 24h).
  // Officer resolution at 20h <= 24h -> Must count as SLA compliant!
  const officerResolvedComplaint = {
    category: 'Sanitation',
    status: 'Resolved - Citizen Verified',
    createdAt: new Date(Date.now() - 100 * 3600 * 1000),
    statusHistory: [
      {
        status: 'Pending Verification',
        role: 'officer',
        timestamp: new Date(Date.now() - 80 * 3600 * 1000), // 20h after creation
      },
      {
        status: 'Resolved - Citizen Verified',
        role: 'citizen',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000), // 96h after creation
      },
    ],
  };
  const officerResolveTimestamp = getOfficerResolveTimestamp(officerResolvedComplaint);
  const officerResolveHours = Math.round(
    (officerResolveTimestamp! - new Date(officerResolvedComplaint.createdAt).getTime()) / (3600 * 1000)
  );
  if (officerResolveHours !== 20) {
    throw new Error(`Expected officer resolve duration 20h, got ${officerResolveHours}h`);
  }

  // 17g. Ranking order: wards with enough data are ranked 1, 2... unranked wards have rank: null
  const rankedResults = rankWardStats([zeroWardStats, smallWardStats, largeWardStats]);
  if (
    rankedResults[0].wardId !== 'ward-large-id' ||
    rankedResults[0].rank !== 1 ||
    rankedResults[1].rank !== null ||
    rankedResults[2].rank !== null
  ) {
    throw new Error('Ranking order failed: Only wards with >= 10 closed complaints should receive numeric ranks');
  }

  console.log(`[PASS] Test 17: Civic Trust Index (CTI) & Operational Refinements verified:`);
  console.log(`       - Zero-ticket ward: closedCount=0, openCount=0, hasEnoughData=false, ctiScore=null, overdueOpenRate=null.`);
  console.log(`       - Small-sample ward: closedCount=5 (< 10), hasEnoughData=false, participationRate=80%.`);
  console.log(`       - Large-sample ward: closedCount=12, hasEnoughData=true, ctiScore=${largeWardStats.ctiScore}, participationRate=75%.`);
  console.log(`       - ParticipationRate strictly counts distinct closed complaints (reopened then verified = 100%, never > 100%).`);
  console.log(`       - OverdueOpenRate handles zero open complaints (null) and computes overdue percentage (50% on mixed queue).`);
  console.log(`       - Per-category SLA configuration verified; duration runs from creation to officer resolve action.`);
  console.log(`       - Only wards meeting statistical threshold receive rank #1.`);
  passed++;

  // ------------------------------------------------------------------
  // 18. FIRST ADMIN INTEGRITY & SIGN-UP PRIVILEGE ESCALATION PREVENTION
  // ------------------------------------------------------------------
  console.log('\n--- Test 18: First Admin Creation Integrity & Public Sign-Up Gate ---');
  // 18a. Verify seeded admin account exists with role 'admin'
  const seededAdmin = await User.findOne({ email: 'admin@demo.jaago.app' });
  if (!seededAdmin || seededAdmin.role !== 'admin') {
    throw new Error('Seeded admin user admin@demo.jaago.app is missing or not role admin');
  }

  // 18b. Verify public credentials sign-up CANNOT create an admin
  const prevDemoAuth = process.env.DEMO_AUTH;
  (process.env as any).DEMO_AUTH = 'true';
  const providers = getAuthProviders();
  const credentialsProvider = providers.find((p) => p.id === 'credentials');
  if (!credentialsProvider) {
    throw new Error('Credentials provider missing when DEMO_AUTH=true');
  }

  const authorizeFn = (credentialsProvider as any).options?.authorize || credentialsProvider.authorize;

  const publicNewUser = await authorizeFn(
    { email: 'public_citizen_attempt@gmail.com', password: 'password123' },
    {} as any
  );
  const createdPublicUser = await User.findOne({ email: 'public_citizen_attempt@gmail.com' });

  if (createdPublicUser?.role !== 'citizen' || publicNewUser?.role !== 'citizen') {
    throw new Error(`Public sign-up incorrectly granted elevated role: ${createdPublicUser?.role}`);
  }

  // 18c. Test ADMIN_EMAIL environment variable configuration
  (process.env as any).ADMIN_EMAIL = 'custom.env.admin@demo.jaago.app';
  const envAdminAuth = await authorizeFn(
    { email: 'custom.env.admin@demo.jaago.app', password: 'password123' },
    {} as any
  );
  const createdEnvAdmin = await User.findOne({ email: 'custom.env.admin@demo.jaago.app' });
  delete (process.env as any).ADMIN_EMAIL;
  (process.env as any).DEMO_AUTH = prevDemoAuth;

  if (createdEnvAdmin?.role !== 'admin' || envAdminAuth?.role !== 'admin') {
    throw new Error('ADMIN_EMAIL environment variable failed to configure admin role');
  }

  console.log(`[PASS] Test 18: First admin integrity verified:`);
  console.log(`       - Seeded admin 'admin@demo.jaago.app' confirmed with role 'admin'.`);
  console.log(`       - Public sign-up strictly defaults to role 'citizen' (cannot elevate to admin).`);
  console.log(`       - Configured ADMIN_EMAIL correctly grants admin role when specified.`);
  passed++;

  // ------------------------------------------------------------------
  // 19. "MY COMPLAINTS" API & UNROUTED "WAITING FOR ROUTING" TRACKING
  // ------------------------------------------------------------------
  console.log('\n--- Test 19: My Complaints API & "Waiting for routing" Label ---');
  // 19a. Anonymous request rejected -> HTTP 401
  const anonMyReq = new NextRequest('http://localhost:3000/api/complaints/my');
  const anonMyRes = await myComplaintsGET(anonMyReq);
  if (anonMyRes.status !== 401) {
    throw new Error(`Expected HTTP 401 for anonymous caller on GET /api/complaints/my, got ${anonMyRes.status}`);
  }

  // 19b. Create an unrouted complaint reported by citizen
  const citizenUnroutedTicket = await Complaint.create({
    title: 'Citizen Unrouted Issue Pending Triage',
    description: 'Testing my-complaints tracking for unrouted ticket with waiting for routing label.',
    category: 'Sanitation',
    location: { type: 'Point', coordinates: [77.58, 12.92] },
    address: 'Bengaluru Border Road',
    imageUrl: 'data:image/jpeg;base64,' + Buffer.from('my-unrouted-img').toString('base64'),
    status: 'Pending',
    reportedBy: citizen!._id,
    upvotesCount: 1,
    // wardId omitted
  });

  // 19c. Authenticated citizen calls GET /api/complaints/my
  const citizenMyReq = new NextRequest('http://localhost:3000/api/complaints/my', {
    headers: {
      'x-test-user-id': citizen!._id.toString(),
      'x-test-user-role': 'citizen',
    },
  });
  const citizenMyRes = await myComplaintsGET(citizenMyReq);
  const citizenMyData = await citizenMyRes.json();

  if (citizenMyRes.status !== 200 || !Array.isArray(citizenMyData.complaints)) {
    throw new Error('GET /api/complaints/my failed to return valid complaints list');
  }

  // Verify that all returned complaints belong strictly to the citizen
  const allOwnedByCitizen = citizenMyData.complaints.every(
    (c: any) =>
      c.reportedBy.toString() === citizen!._id.toString() ||
      c.reportedBy?._id?.toString() === citizen!._id.toString()
  );
  if (!allOwnedByCitizen) {
    throw new Error('GET /api/complaints/my leaked complaints from other users');
  }

  // Verify the unrouted complaint is included and has routingStatus === 'Waiting for routing'
  const foundMyUnrouted = citizenMyData.complaints.find(
    (c: any) => c._id.toString() === citizenUnroutedTicket._id.toString()
  );
  if (!foundMyUnrouted) {
    throw new Error('GET /api/complaints/my did not include citizen\'s unrouted complaint');
  }

  if (foundMyUnrouted.routingStatus !== 'Waiting for routing' || foundMyUnrouted.wardId) {
    throw new Error(
      `Expected routingStatus 'Waiting for routing' and null wardId, got: ${foundMyUnrouted.routingStatus}`
    );
  }

  console.log(`[PASS] Test 19: My Complaints API verified:`);
  console.log(`       - Anonymous request rejected with HTTP 401.`);
  console.log(`       - Returns strictly logged-in citizen's complaints (${citizenMyData.count} tickets).`);
  console.log(`       - Includes unrouted complaint with routingStatus: "${foundMyUnrouted.routingStatus}".`);
  passed++;

  console.log('\n================================================================');
  console.log(`   FULL INTEGRATION SUITE COMPLETE: ${passed} / ${total} TESTS PASSED`);
  console.log('================================================================\n');
}

runAuditFixesVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Audit Verification Error:', err);
    process.exit(1);
  });
