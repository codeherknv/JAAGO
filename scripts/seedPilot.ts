import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../lib/mongodb';
import { Ward } from '../models/Ward';
import { Agency } from '../models/Agency';
import { OfficerAllowList } from '../models/OfficerAllowList';
import { User } from '../models/User';
import { Complaint } from '../models/Complaint';
import { Vote } from '../models/Vote';
import { reconcileAllVotes } from '../lib/reconcileVotes';

export const BENGALURU_WARDS = [
  {
    name: 'Bellandur',
    code: 'W-150',
    corporation: 'Greater Bengaluru Authority',
    boundary: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [77.6600, 12.9220],
          [77.7000, 12.9220],
          [77.7000, 12.9550],
          [77.6600, 12.9550],
          [77.6600, 12.9220],
        ],
      ],
    },
  },
  {
    name: 'HSR Layout',
    code: 'W-174',
    corporation: 'Greater Bengaluru Authority',
    boundary: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [77.6300, 12.9000],
          [77.6600, 12.9000],
          [77.6600, 12.9220],
          [77.6300, 12.9220],
          [77.6300, 12.9000],
        ],
      ],
    },
  },
  {
    name: 'Koramangala',
    code: 'W-151',
    corporation: 'Greater Bengaluru Authority',
    boundary: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [77.6150, 12.9230],
          [77.6400, 12.9230],
          [77.6400, 12.9450],
          [77.6150, 12.9450],
          [77.6150, 12.9230],
        ],
      ],
    },
  },
];

export const CIVIC_AGENCIES = [
  {
    name: 'Bruhat Bengaluru Mahanagara Palike - Road Infrastructure',
    shortName: 'BBMP-Roads',
    jurisdictionCategories: ['Roads'],
  },
  {
    name: 'Bruhat Bengaluru Mahanagara Palike - Solid Waste Management',
    shortName: 'BBMP-SWM',
    jurisdictionCategories: ['Sanitation'],
  },
  {
    name: 'Bangalore Water Supply and Sewerage Board',
    shortName: 'BWSSB',
    jurisdictionCategories: ['Water Supply & Drainage'],
  },
  {
    name: 'Bangalore Electricity Supply Company Limited',
    shortName: 'BESCOM',
    jurisdictionCategories: ['Streetlights', 'Others'],
  },
];

export async function seedPilotDatabase() {
  console.log('--- Connecting to database for pilot seeding ---');
  await connectToDatabase();

  console.log('Clearing existing collections...');
  await Promise.all([
    Ward.deleteMany({}),
    Agency.deleteMany({}),
    OfficerAllowList.deleteMany({}),
    User.deleteMany({}),
    Complaint.deleteMany({}),
    Vote.deleteMany({}),
  ]);

  console.log('Ensuring 2dsphere indexes on Ward and Complaint...');
  await Ward.syncIndexes();
  await Complaint.syncIndexes();
  await Vote.syncIndexes();

  console.log('Seeding Wards...');
  const createdWards = await Ward.insertMany(BENGALURU_WARDS);
  const wardMap = new Map(createdWards.map((w) => [w.code, w]));
  console.log(`Created ${createdWards.length} wards:`, createdWards.map(w => `${w.name} (${w.code})`).join(', '));

  console.log('Seeding Agencies...');
  const createdAgencies = await Agency.insertMany(CIVIC_AGENCIES);
  const agencyMap = new Map(createdAgencies.map((a) => [a.shortName, a]));
  console.log(`Created ${createdAgencies.length} agencies:`, createdAgencies.map(a => a.shortName).join(', '));

  console.log('Seeding Officer AllowList with @demo.jaago.app domains...');
  const bellandurWard = wardMap.get('W-150')!;
  const hsrWard = wardMap.get('W-174')!;
  const koramangalaWard = wardMap.get('W-151')!;
  const bbmpRoads = agencyMap.get('BBMP-Roads')!;
  const bbmpSwm = agencyMap.get('BBMP-SWM')!;

  const allowListOfficers = [
    {
      email: 'officer.bellandur@demo.jaago.app',
      name: 'Ramesh Gowda (AEE Bellandur)',
      agencyId: bbmpRoads._id,
      assignedWardId: bellandurWard._id,
      isActive: true,
    },
    {
      email: 'officer.hsr@demo.jaago.app',
      name: 'Sunita Rao (Health Inspector HSR)',
      agencyId: bbmpSwm._id,
      assignedWardId: hsrWard._id,
      isActive: true,
    },
  ];
  await OfficerAllowList.insertMany(allowListOfficers);
  console.log(`Created ${allowListOfficers.length} OfficerAllowList entries.`);

  console.log('Seeding Users (Admin, Officers, Citizens)...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const usersToCreate = [
    {
      name: 'Civic Commissioner Admin',
      email: 'admin@demo.jaago.app',
      password: passwordHash,
      role: 'admin',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&fit=crop&crop=faces',
    },
    {
      name: 'Ramesh Gowda (Officer)',
      email: 'officer.bellandur@demo.jaago.app',
      password: passwordHash,
      role: 'officer',
      assignedWardId: bellandurWard._id,
      agencyId: bbmpRoads._id,
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&fit=crop&crop=faces',
    },
    {
      name: 'Sunita Rao (Officer)',
      email: 'officer.hsr@demo.jaago.app',
      password: passwordHash,
      role: 'officer',
      assignedWardId: hsrWard._id,
      agencyId: bbmpSwm._id,
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=128&fit=crop&crop=faces',
    },
    {
      name: 'Rahul Sharma',
      email: 'citizen.rahul@demo.jaago.app',
      password: passwordHash,
      role: 'citizen',
      image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&fit=crop&crop=faces',
    },
    {
      name: 'Priya Venkatesh',
      email: 'citizen.priya@demo.jaago.app',
      password: passwordHash,
      role: 'citizen',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&fit=crop&crop=faces',
    },
    // Seed auxiliary voters for consistent vote counts
    {
      name: 'Ananya Deshmukh',
      email: 'voter1@demo.jaago.app',
      password: passwordHash,
      role: 'citizen',
    },
    {
      name: 'Vikram Seth',
      email: 'voter2@demo.jaago.app',
      password: passwordHash,
      role: 'citizen',
    },
    {
      name: 'Kavita Nair',
      email: 'voter3@demo.jaago.app',
      password: passwordHash,
      role: 'citizen',
    },
  ];

  const createdUsers = await User.insertMany(usersToCreate);
  const userMap = new Map(createdUsers.map((u) => [u.email, u]));
  console.log(`Created ${createdUsers.length} initial users.`);

  const rahul = userMap.get('citizen.rahul@demo.jaago.app')!;
  const priya = userMap.get('citizen.priya@demo.jaago.app')!;
  const ramesh = userMap.get('officer.bellandur@demo.jaago.app')!;
  const sunita = userMap.get('officer.hsr@demo.jaago.app')!;
  const voter1 = userMap.get('voter1@demo.jaago.app')!;
  const voter2 = userMap.get('voter2@demo.jaago.app')!;
  const voter3 = userMap.get('voter3@demo.jaago.app')!;

  console.log('Seeding Initial Pilot Complaints...');
  const complaintsToCreate = [
    {
      title: 'Large Pothole near Green Glen Layout junction',
      description: 'Dangerous crater on Bellandur Main Road near Sobha Jasmine causing waterlogging and vehicle damage.',
      category: 'Roads' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6784, 12.9304], // [lng, lat] Bellandur
      },
      address: 'Outer Ring Rd, Bellandur, Bengaluru, Karnataka 560103',
      wardId: bellandurWard._id,
      agencyId: bbmpRoads._id,
      imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/pothole.jpg',
      status: 'Pending' as const,
      reportedBy: rahul._id,
      upvotesCount: 3, // 3 matching votes: rahul, voter1, voter2
      reopenCount: 0,
      priorityScore: 14.5,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 36 * 3600 * 1000),
          remarks: 'Initial complaint filed with geo-tagged photograph.',
        },
      ],
    },
    {
      title: 'Overflowing Black Spot Garbage along 27th Main',
      description: 'Bulk unsegregated waste piled up next to HSR BDA complex footway causing severe stench and stray menace.',
      category: 'Sanitation' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6442, 12.9115], // [lng, lat] HSR Layout
      },
      address: '27th Main Rd, Sector 1, HSR Layout, Bengaluru, Karnataka 560102',
      wardId: hsrWard._id,
      agencyId: bbmpSwm._id,
      imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/garbage.jpg',
      status: 'In Progress' as const,
      reportedBy: priya._id,
      upvotesCount: 4, // 4 matching votes: priya, voter1, voter2, voter3
      reopenCount: 0,
      priorityScore: 16.0,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 48 * 3600 * 1000),
          remarks: 'Reported commercial waste dumping.',
        },
        {
          status: 'In Progress' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 12 * 3600 * 1000),
          remarks: 'Marshall team dispatched with Bobcat loader.',
        },
      ],
    },
    {
      title: 'Broken Stormwater Drain Cover on 80 Feet Road',
      description: 'Deep slab collapse on footpath opposite 4th Block park. Immediate hazard to pedestrians.',
      category: 'Water Supply & Drainage' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6255, 12.9345], // [lng, lat] Koramangala
      },
      address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru, Karnataka 560034',
      wardId: koramangalaWard._id,
      agencyId: agencyMap.get('BWSSB')!._id,
      imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain.jpg',
      resolutionImageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain_resolved.jpg',
      status: 'Pending Verification' as const,
      reportedBy: rahul._id,
      upvotesCount: 3, // 3 matching votes: rahul, voter2, voter3
      reopenCount: 0,
      priorityScore: 18.0,
      verificationDeadline: new Date(Date.now() + 84 * 3600 * 1000), // ~3.5 days left in 120h window
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 72 * 3600 * 1000),
          remarks: 'Dangerous uncovered manhole.',
        },
        {
          status: 'In Progress' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 40 * 3600 * 1000),
          remarks: 'Precast slab ordered from depot.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 36 * 3600 * 1000),
          remarks: 'New RCC reinforced slab placed and cemented. Photo uploaded.',
          imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain_resolved.jpg',
          locationAccuracy: 8,
          resolutionDistanceMeters: 12,
        },
      ],
    },
    {
      title: 'Streetlights non-functional along Haralur Link Road',
      description: 'Entire stretch of 12 LED poles completely dark for 3 consecutive nights.',
      category: 'Streetlights' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6685, 12.9280], // [lng, lat] Bellandur
      },
      address: 'Haralur Main Rd, Bellandur, Bengaluru, Karnataka 560103',
      wardId: bellandurWard._id,
      agencyId: agencyMap.get('BESCOM')!._id,
      imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/light.jpg',
      resolutionImageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/light_resolved.jpg',
      status: 'Resolved - Citizen Verified' as const,
      reportedBy: priya._id,
      upvotesCount: 2, // 2 matching votes: priya, rahul
      reopenCount: 0,
      priorityScore: 10.0,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 140 * 3600 * 1000),
          remarks: 'Dark road safety issue.',
        },
        {
          status: 'In Progress' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 100 * 3600 * 1000),
          remarks: 'Phase wire replaced.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 80 * 3600 * 1000),
          remarks: 'All 12 luminaires lit and verified.',
          imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&fit=crop',
          locationAccuracy: 10,
          resolutionDistanceMeters: 14,
        },
        {
          status: 'Resolved - Citizen Verified' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 50 * 3600 * 1000),
          remarks: 'Inspected yesterday night. Excellent job, all lights working!',
        },
      ],
    },
  ];

  const createdComplaints = await Complaint.insertMany(complaintsToCreate);
  console.log(`Created ${createdComplaints.length} seed complaints.`);

  // Seed exact matching vote records for 100% database consistency
  const votes = [
    // Complaint 0 (upvotes: 3)
    { complaintId: createdComplaints[0]._id, userId: rahul._id },
    { complaintId: createdComplaints[0]._id, userId: voter1._id },
    { complaintId: createdComplaints[0]._id, userId: voter2._id },
    // Complaint 1 (upvotes: 4)
    { complaintId: createdComplaints[1]._id, userId: priya._id },
    { complaintId: createdComplaints[1]._id, userId: voter1._id },
    { complaintId: createdComplaints[1]._id, userId: voter2._id },
    { complaintId: createdComplaints[1]._id, userId: voter3._id },
    // Complaint 2 (upvotes: 3)
    { complaintId: createdComplaints[2]._id, userId: rahul._id },
    { complaintId: createdComplaints[2]._id, userId: voter2._id },
    { complaintId: createdComplaints[2]._id, userId: voter3._id },
    // Complaint 3 (upvotes: 2)
    { complaintId: createdComplaints[3]._id, userId: priya._id },
    { complaintId: createdComplaints[3]._id, userId: rahul._id },
  ];
  await Vote.insertMany(votes);
  console.log(`Created ${votes.length} matching Vote records.`);

  // Run reconciliation check to ensure 100% vote consistency
  await reconcileAllVotes();

  console.log('--- Bengaluru Pilot Seeding Completed Successfully! ---');
}

// When executed directly via `tsx scripts/seedPilot.ts`
if (require.main === module || process.argv[1]?.includes('seedPilot')) {
  seedPilotDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
