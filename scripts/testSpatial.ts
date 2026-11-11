import { connectToDatabase } from '../lib/mongodb';
import { Ward } from '../models/Ward';
import { Complaint } from '../models/Complaint';
import { Vote } from '../models/Vote';
import { User } from '../models/User';
import { calculateHaversineDistance } from '../lib/geo';
import { seedPilotDatabase } from './seedPilot';

async function runSpatialAndUpvoteTests() {
  console.log('=====================================================');
  console.log('   JAAGO PHASE 2: SPATIAL ROUTING & DEDUPE TEST SUITE');
  console.log('=====================================================');

  await connectToDatabase();
  console.log('Resetting and seeding baseline pilot data...');
  await seedPilotDatabase();

  let passedTests = 0;
  let totalTests = 3;

  // ------------------------------------------------------------------
  // TEST 1: Boundary Auto-Routing ($geoIntersects)
  // Coordinate inside Bellandur resolves to W-150
  // ------------------------------------------------------------------
  console.log('\n--- Running Test 1: Ward Polygon Auto-Routing ($geoIntersects) ---');
  const bellandurLng = 77.6773;
  const bellandurLat = 12.9352;

  const resolvedWard = await Ward.findOne({
    boundary: {
      $geoIntersects: {
        $geometry: {
          type: 'Point',
          coordinates: [bellandurLng, bellandurLat],
        },
      },
    },
  });

  if (resolvedWard && resolvedWard.code === 'W-150' && resolvedWard.name === 'Bellandur') {
    console.log(`[PASS] Test 1: Coordinates [${bellandurLng}, ${bellandurLat}] correctly resolved to:`);
    console.log(`       Ward: ${resolvedWard.name} (${resolvedWard.code}), Corp: ${resolvedWard.corporation}`);
    passedTests++;
  } else {
    console.error(`[FAIL] Test 1: Expected W-150 Bellandur, received:`, resolvedWard);
    throw new Error('Test 1 Failed');
  }

  // ------------------------------------------------------------------
  // TEST 2: Ingestion Deduplication (40m radius category-aware proximity check)
  // Ingest at Lat 12.9115, Lng 77.6442 (HSR Layout)
  // Query at 15m away with same category vs different category
  // ------------------------------------------------------------------
  console.log('\n--- Running Test 2: Ingestion Deduplication ($near 40m proximity check) ---');
  const baseLat = 12.9115;
  const baseLng = 77.6442;
  const testCategory = 'Sanitation';

  // Ensure ward exists for HSR
  const hsrWard = await Ward.findOne({ code: 'W-174' });
  if (!hsrWard) throw new Error('HSR ward W-174 not found');

  const testCitizen = await User.findOne({ role: 'citizen' });
  if (!testCitizen) throw new Error('Citizen user not found');

  // Ingest complaint
  const complaint = await Complaint.create({
    title: 'Test Overflowing Waste Bin',
    description: 'Black spot waste piled at street corner for spatial testing.',
    category: testCategory,
    location: {
      type: 'Point',
      coordinates: [baseLng, baseLat],
    },
    address: '27th Main Rd, Sector 1, HSR Layout, Bengaluru',
    wardId: hsrWard._id,
    imageUrl: 'https://images.unsplash.com/photo-1611288875685-147054941d42?w=800',
    status: 'Pending',
    reportedBy: testCitizen._id,
    upvotesCount: 1,
    statusHistory: [
      {
        status: 'Pending',
        actorId: testCitizen._id,
        role: 'citizen',
        timestamp: new Date(),
        remarks: 'Test issue for proximity deduplication.',
      },
    ],
  });
  await Vote.create({ complaintId: complaint._id, userId: testCitizen._id });

  // Calculate coordinates 15 meters to the North
  // 1 deg latitude ≈ 111,139 meters
  const offsetLat = baseLat + 15 / 111139;
  const offsetLng = baseLng;
  const actualDistance = calculateHaversineDistance(baseLat, baseLng, offsetLat, offsetLng);
  console.log(`Created test complaint at [${baseLng}, ${baseLat}]`);
  console.log(`Querying from [${offsetLng}, ${offsetLat.toFixed(6)}] (~${actualDistance.toFixed(2)}m away)`);

  // Query 1: Same category ("Sanitation") within 40m
  const sameCategoryMatches = await Complaint.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [offsetLng, offsetLat],
        },
        $maxDistance: 40,
      },
    },
    category: testCategory,
    status: {
      $nin: ['Resolved - Citizen Verified', 'Resolved - Auto Closed', 'Rejected - Invalid'],
    },
  });

  // Query 2: Different category ("Roads") within 40m
  const diffCategoryMatches = await Complaint.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [offsetLng, offsetLat],
        },
        $maxDistance: 40,
      },
    },
    category: 'Roads',
    status: {
      $nin: ['Resolved - Citizen Verified', 'Resolved - Auto Closed', 'Rejected - Invalid'],
    },
  });

  const foundTarget = sameCategoryMatches.some((c) => c._id.equals(complaint._id));
  const diffMatchesTarget = diffCategoryMatches.some((c) => c._id.equals(complaint._id));

  if (foundTarget && !diffMatchesTarget) {
    console.log(`[PASS] Test 2: Ingestion Deduplication succeeded:`);
    console.log(`       - Same category query returned ${sameCategoryMatches.length} match(es) including target issue.`);
    console.log(`       - Different category query correctly returned 0 matching issues.`);
    passedTests++;
  } else {
    console.error(`[FAIL] Test 2: Expected target in sameCategory and none in diffCategory.`);
    console.error(`       foundTarget: ${foundTarget}, diffMatchesTarget: ${diffMatchesTarget}`);
    throw new Error('Test 2 Failed');
  }

  // ------------------------------------------------------------------
  // TEST 3: Scalable Atomic Upvoting (Race-Condition-Free)
  // Two concurrent upvotes by the same user only increment once
  // ------------------------------------------------------------------
  console.log('\n--- Running Test 3: Race-Condition-Free Atomic Upvoting ---');
  // Create a dedicated voter user
  const voterUser = await User.create({
    name: 'Concurrent Voter Tester',
    email: `concurrent.voter.${Date.now()}@example.com`,
    role: 'citizen',
  });

  const complaintBefore = await Complaint.findById(complaint._id);
  const initialUpvotes = complaintBefore!.upvotesCount;
  console.log(`Initial upvotesCount: ${initialUpvotes}`);

  // Helper simulating the atomic upvote transaction logic
  async function performAtomicUpvote(cId: any, uId: any) {
    try {
      await Vote.create({ complaintId: cId, userId: uId });
      const updated = await Complaint.findByIdAndUpdate(
        cId,
        { $inc: { upvotesCount: 1 } },
        { new: true }
      );
      return { success: true, upvotesCount: updated!.upvotesCount };
    } catch (err: any) {
      if (err.code === 11000) {
        return { success: false, reason: 'DUPLICATE_KEY_ALREADY_VOTED' };
      }
      throw err;
    }
  }

  // Fire two concurrent upvote requests simultaneously
  const results = await Promise.all([
    performAtomicUpvote(complaint._id, voterUser._id),
    performAtomicUpvote(complaint._id, voterUser._id),
  ]);

  const successes = results.filter((r) => r.success);
  const duplicates = results.filter((r) => !r.success && r.reason === 'DUPLICATE_KEY_ALREADY_VOTED');

  const complaintAfter = await Complaint.findById(complaint._id);
  const finalUpvotes = complaintAfter!.upvotesCount;

  console.log(`Concurrent results:`, results);
  console.log(`Final upvotesCount in DB: ${finalUpvotes}`);

  if (successes.length === 1 && duplicates.length === 1 && finalUpvotes === initialUpvotes + 1) {
    console.log(`[PASS] Test 3: Atomic upvoting prevented race condition!`);
    console.log(`       Exactly 1 succeeded and 1 was blocked by compound unique index.`);
    console.log(`       Database upvotesCount incremented strictly by 1 (${initialUpvotes} -> ${finalUpvotes}).`);
    passedTests++;
  } else {
    console.error(`[FAIL] Test 3: Concurrent upvote check failed:`, {
      successes: successes.length,
      duplicates: duplicates.length,
      initialUpvotes,
      finalUpvotes,
    });
    throw new Error('Test 3 Failed');
  }

  console.log('\n=====================================================');
  console.log(`   ALL TESTS PASSED: ${passedTests} / ${totalTests}`);
  console.log('=====================================================\n');
}

runSpatialAndUpvoteTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
