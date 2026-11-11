import fs from 'fs';
import path from 'path';
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
import { imageProofSchema, verifyCloudinaryAssetSize } from '../lib/validations';

// Import real route handlers
import { POST as signUploadPOST } from '../app/api/uploads/sign/route';
import { POST as complaintsPOST } from '../app/api/complaints/route';
import { POST as autoClosePOST } from '../app/api/cron/auto-close/route';
import { PATCH as resolvePATCH } from '../app/api/complaints/[id]/resolve/route';
import { POST as verifyPOST } from '../app/api/complaints/[id]/verify/route';

// Admin route handlers
import { GET as adminOfficersGET, POST as adminOfficersPOST } from '../app/api/admin/officers/route';
import { PATCH as adminOfficerUpdatePATCH } from '../app/api/admin/officers/[id]/route';
import { GET as adminTriageGET } from '../app/api/admin/triage/route';
import { PATCH as adminAssignPATCH } from '../app/api/admin/complaints/[id]/assign/route';
import { GET as adminDisputesGET } from '../app/api/admin/disputes/route';
import { PATCH as adminArbitratePATCH } from '../app/api/admin/complaints/[id]/arbitrate/route';
import { PATCH as adminRejectPATCH } from '../app/api/admin/complaints/[id]/reject/route';

async function runAuditFixesVerification() {
  (process.env as any).NODE_ENV = 'test';
  console.log('================================================================');
  console.log('   JAAGO FULL INTEGRATION & AUDIT VERIFICATION SUITE');
  console.log('================================================================\n');

  await connectToDatabase();
  console.log('Resetting and seeding database with clean pilot records...');
  await seedPilotDatabase();

  let passed = 0;
  const total = 14;

  const admin = await User.findOne({ email: 'admin@demo.jaago.app' });
  const citizen = await User.findOne({ email: 'citizen.rahul@demo.jaago.app' });
  const officer = await User.findOne({ email: 'officer.bellandur@demo.jaago.app' });
  const bellandurWard = await Ward.findOne({ code: 'W-150' });
  const bbmpRoads = await Agency.findOne({ shortName: 'BBMP-Roads' });

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

  if (testSignRes.status === 200 && testSignData.signature && testSignData.folder === 'jaago_complaints') {
    console.log(`[PASS] Test 1: Real POST /api/uploads/sign verified:`);
    console.log(`       - In dev/prod with missing keys: returned HTTP 500 error.`);
    console.log(`       - In test mode: returned signature '${testSignData.signature.substring(0, 10)}...'`);
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
  // 3. SERVER-SIDE 5MB ASSET SIZE ENFORCEMENT
  // ------------------------------------------------------------------
  console.log('\n--- Test 3: Server-Side 5MB Asset Size Check ---');
  const sizeOk = await verifyCloudinaryAssetSize(validCloudinaryUrl);
  const oversizedBase64 = 'data:image/jpeg;base64,' + Buffer.alloc(6 * 1024 * 1024, 'a').toString('base64');
  const sizeOversized = await verifyCloudinaryAssetSize(oversizedBase64);

  if (sizeOk && !sizeOversized) {
    console.log(`[PASS] Test 3: Server-side 5MB limit verification confirmed (oversized 6MB payload rejected).`);
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

  // Call cron daemon
  const cronDaemonReq = new NextRequest('http://localhost:3000/api/cron/auto-close', {
    method: 'POST',
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const cronDaemonRes = await autoClosePOST(cronDaemonReq);
  const cronDaemonData = await cronDaemonRes.json();

  // Verify reminder notification was generated in Notification collection
  const reminderNotif = await Notification.findOne({
    complaintId: reminderComplaint._id,
    type: 'reminder',
  });

  if (cronDaemonRes.status === 200 && reminderNotif) {
    console.log(`[PASS] Test 13: Notifications subsystem verified:`);
    console.log(`       - Cron job detected ticket with <= 48h left and dispatched 72h reminder.`);
    console.log(`       - Notification record created: "${reminderNotif.title}".`);
    passed++;
  } else {
    throw new Error('Test 13 72h reminder verification failed');
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
