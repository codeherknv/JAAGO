import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../lib/mongodb';
import { Ward } from '../models/Ward';
import { Agency } from '../models/Agency';
import { OfficerAllowList } from '../models/OfficerAllowList';
import { User } from '../models/User';
import { Complaint } from '../models/Complaint';
import { Vote } from '../models/Vote';
import { reconcileAllVotes } from '../lib/reconcileVotes';

export function loadSeedPhotos(): string[] {
  try {
    const photosPath = path.join(process.cwd(), 'seed', 'photos.json');
    if (fs.existsSync(photosPath)) {
      const data = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not read seed/photos.json, falling back to default photos:', err);
  }
  return [];
}

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
  const admin = userMap.get('admin@demo.jaago.app')!;
  const voter1 = userMap.get('voter1@demo.jaago.app')!;
  const voter2 = userMap.get('voter2@demo.jaago.app')!;
  const voter3 = userMap.get('voter3@demo.jaago.app')!;

  console.log('Seeding Initial Pilot Complaints...');
  const photos = loadSeedPhotos();
  const getPhoto = (idx: number, fallback: string) => photos[idx] || fallback;

  const bwssb = agencyMap.get('BWSSB')!;
  const bescom = agencyMap.get('BESCOM')!;

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
      imageUrl: getPhoto(0, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/pothole.jpg'),
      status: 'Pending' as const,
      reportedBy: rahul._id,
      createdAt: new Date(Date.now() - 36 * 3600 * 1000),
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
      imageUrl: getPhoto(2, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/garbage.jpg'),
      status: 'In Progress' as const,
      reportedBy: priya._id,
      createdAt: new Date(Date.now() - 48 * 3600 * 1000),
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
      agencyId: bwssb._id,
      imageUrl: getPhoto(4, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain.jpg'),
      resolutionImageUrl: getPhoto(5, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain_resolved.jpg'),
      status: 'Pending Verification' as const,
      reportedBy: rahul._id,
      createdAt: new Date(Date.now() - 72 * 3600 * 1000),
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
          imageUrl: getPhoto(5, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain_resolved.jpg'),
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
      agencyId: bescom._id,
      imageUrl: getPhoto(6, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/light.jpg'),
      resolutionImageUrl: getPhoto(7, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/light_resolved.jpg'),
      status: 'Resolved - Citizen Verified' as const,
      reportedBy: priya._id,
      createdAt: new Date(Date.now() - 140 * 3600 * 1000),
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
          imageUrl: getPhoto(7, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/light_resolved.jpg'),
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
    // Complaint 4: Bellandur Roads (In Progress)
    {
      title: 'Sunken Asphalt Patch outside Central Mall',
      description: 'Uneven road settlement after cable laying work on Outer Ring Road causing severe traffic slowdown.',
      category: 'Roads' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6830, 12.9315],
      },
      address: 'Outer Ring Rd, Devarabisanahalli, Bellandur, Bengaluru 560103',
      wardId: bellandurWard._id,
      agencyId: bbmpRoads._id,
      imageUrl: getPhoto(8, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/water_leak_sarjapur_junction.jpg'),
      status: 'In Progress' as const,
      reportedBy: rahul._id,
      createdAt: new Date(Date.now() - 30 * 3600 * 1000),
      upvotesCount: 2,
      reopenCount: 0,
      priorityScore: 11.0,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 30 * 3600 * 1000),
          remarks: 'Severe bump on service road.',
        },
        {
          status: 'In Progress' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 10 * 3600 * 1000),
          remarks: 'Wet-mix and roller scheduled for tonight.',
        },
      ],
    },
    // Complaint 5: Bellandur Water & Drainage (Resolved - Citizen Verified)
    {
      title: 'Sewage Backflow on Kasavanahalli Main Road',
      description: 'Manhole chamber overflowing near Play Arena sports center into pedestrian pathway.',
      category: 'Water Supply & Drainage' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6740, 12.9245],
      },
      address: 'Kasavanahalli Main Rd, Bellandur, Bengaluru 560103',
      wardId: bellandurWard._id,
      agencyId: bwssb._id,
      imageUrl: getPhoto(16, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/sewage_overflow_kasavanahalli.jpg'),
      resolutionImageUrl: getPhoto(17, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/sewage_overflow_kasavanahalli_fixed.jpg'),
      status: 'Resolved - Citizen Verified' as const,
      reportedBy: priya._id,
      createdAt: new Date(Date.now() - 120 * 3600 * 1000),
      upvotesCount: 3,
      reopenCount: 0,
      priorityScore: 15.0,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 120 * 3600 * 1000),
          remarks: 'Overflowing drain spreading into shops.',
        },
        {
          status: 'In Progress' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 90 * 3600 * 1000),
          remarks: 'Suction jetting tanker deployed.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 60 * 3600 * 1000),
          remarks: 'Clog cleared with high-pressure water jet. Chamber lid reset.',
          imageUrl: getPhoto(17, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/sewage_overflow_kasavanahalli_fixed.jpg'),
          locationAccuracy: 12,
          resolutionDistanceMeters: 15,
        },
        {
          status: 'Resolved - Citizen Verified' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 20 * 3600 * 1000),
          remarks: 'Water is flowing freely now. Thank you team.',
        },
      ],
    },
    // Complaint 6: Bellandur Sanitation (Resolved - Auto Closed)
    {
      title: 'Construction Debris Dumping along Lake Bund Road',
      description: 'Unauthorised nocturnal dumping of concrete rubble narrowing the access road to Bellandur lake.',
      category: 'Sanitation' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6650, 12.9380],
      },
      address: 'Bellandur Lake Bund Rd, Yemlur, Bengaluru 560103',
      wardId: bellandurWard._id,
      agencyId: bbmpSwm._id,
      imageUrl: getPhoto(26, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/illegal_dumping_bellandur_lake_bund.jpg'),
      resolutionImageUrl: getPhoto(27, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/illegal_dumping_lake_bund_cleaned.jpg'),
      status: 'Resolved - Auto Closed' as const,
      reportedBy: rahul._id,
      createdAt: new Date(Date.now() - 200 * 3600 * 1000),
      upvotesCount: 1,
      reopenCount: 0,
      priorityScore: 8.5,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 200 * 3600 * 1000),
          remarks: 'Heavy concrete rubble blocking half the road.',
        },
        {
          status: 'In Progress' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 170 * 3600 * 1000),
          remarks: 'Tipper truck and JCB allocated.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 140 * 3600 * 1000),
          remarks: 'All debris removed and disposed at quarry site.',
          imageUrl: getPhoto(27, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/illegal_dumping_lake_bund_cleaned.jpg'),
          locationAccuracy: 9,
          resolutionDistanceMeters: 10,
        },
        {
          status: 'Resolved - Auto Closed' as const,
          actorId: admin._id,
          role: 'system' as const,
          timestamp: new Date(Date.now() - 10 * 3600 * 1000),
          remarks: 'Automatically closed after 120-hour citizen verification window elapsed.',
        },
      ],
    },
    // Complaint 7: Bellandur Roads (Pending)
    {
      title: 'Unpaved Utility Trench outside EcoSpace Tech Park',
      description: 'Open gravel trench left unpaved for 2 weeks after pipeline installation.',
      category: 'Roads' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6880, 12.9340],
      },
      address: 'Bellandur Outer Ring Rd, near EcoSpace, Bengaluru 560103',
      wardId: bellandurWard._id,
      agencyId: bbmpRoads._id,
      imageUrl: getPhoto(20, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/unpaved_trench_bellandur_gate.jpg'),
      status: 'Pending' as const,
      reportedBy: priya._id,
      createdAt: new Date(Date.now() - 18 * 3600 * 1000),
      upvotesCount: 2,
      reopenCount: 0,
      priorityScore: 9.5,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 18 * 3600 * 1000),
          remarks: 'Trench left without caution tape.',
        },
      ],
    },
    // Complaint 8: HSR Layout Water & Drainage (Resolved - Citizen Verified)
    {
      title: 'Water Pipe Leakage at 14th Main Junction',
      description: 'Underground BWSSB mainline ruptured, clean water flooding the street curb.',
      category: 'Water Supply & Drainage' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6385, 12.9090],
      },
      address: '14th Main Rd, Sector 4, HSR Layout, Bengaluru 560102',
      wardId: hsrWard._id,
      agencyId: bwssb._id,
      imageUrl: getPhoto(8, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/water_leak_sarjapur_junction.jpg'),
      resolutionImageUrl: getPhoto(9, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/water_leak_sarjapur_repaired.jpg'),
      status: 'Resolved - Citizen Verified' as const,
      reportedBy: voter1._id,
      createdAt: new Date(Date.now() - 96 * 3600 * 1000),
      upvotesCount: 3,
      reopenCount: 0,
      priorityScore: 13.0,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 96 * 3600 * 1000),
          remarks: 'Huge water loss on road.',
        },
        {
          status: 'In Progress' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 72 * 3600 * 1000),
          remarks: 'Pipe clamp welding team on site.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 48 * 3600 * 1000),
          remarks: 'Cast iron pipe section replaced and pressure tested.',
          imageUrl: getPhoto(9, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/water_leak_sarjapur_repaired.jpg'),
          locationAccuracy: 7,
          resolutionDistanceMeters: 9,
        },
        {
          status: 'Resolved - Citizen Verified' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 24 * 3600 * 1000),
          remarks: 'Road is dry, water supply restored to houses.',
        },
      ],
    },
    // Complaint 9: HSR Layout Streetlights (Resolved - Citizen Verified)
    {
      title: 'Exposed Live Wiring on Feeder Pillar',
      description: 'Open electrical distribution box next to Agara Lake children park.',
      category: 'Streetlights' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6490, 12.9180],
      },
      address: 'Agara Lake Rd, Sector 1, HSR Layout, Bengaluru 560102',
      wardId: hsrWard._id,
      agencyId: bescom._id,
      imageUrl: getPhoto(14, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/open_transformer_hsr_sector2.jpg'),
      resolutionImageUrl: getPhoto(15, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/open_transformer_hsr_fenced.jpg'),
      status: 'Resolved - Citizen Verified' as const,
      reportedBy: priya._id,
      createdAt: new Date(Date.now() - 110 * 3600 * 1000),
      upvotesCount: 4,
      reopenCount: 0,
      priorityScore: 17.5,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 110 * 3600 * 1000),
          remarks: 'Critical hazard next to playground.',
        },
        {
          status: 'In Progress' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 85 * 3600 * 1000),
          remarks: 'Line technician barricaded zone.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 50 * 3600 * 1000),
          remarks: 'Door replaced with lock and mesh cage installed.',
          imageUrl: getPhoto(15, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/open_transformer_hsr_fenced.jpg'),
          locationAccuracy: 11,
          resolutionDistanceMeters: 13,
        },
        {
          status: 'Resolved - Citizen Verified' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 15 * 3600 * 1000),
          remarks: 'Box safely locked. Thank you!',
        },
      ],
    },
    // Complaint 10: HSR Layout Sanitation (Pending Verification)
    {
      title: 'Overflowing Commercial Dumper Bin along 19th Main',
      description: 'Restaurant wet waste spilling onto road with cattle gathering.',
      category: 'Sanitation' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6410, 12.9050],
      },
      address: '19th Main Rd, Sector 2, HSR Layout, Bengaluru 560102',
      wardId: hsrWard._id,
      agencyId: bbmpSwm._id,
      imageUrl: getPhoto(10, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/debris_hsr_19th_main.jpg'),
      resolutionImageUrl: getPhoto(11, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/debris_hsr_19th_cleared.jpg'),
      status: 'Pending Verification' as const,
      reportedBy: voter2._id,
      createdAt: new Date(Date.now() - 40 * 3600 * 1000),
      upvotesCount: 2,
      reopenCount: 0,
      priorityScore: 12.0,
      verificationDeadline: new Date(Date.now() + 70 * 3600 * 1000),
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 40 * 3600 * 1000),
          remarks: 'Spillover blocking sidewalk.',
        },
        {
          status: 'In Progress' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 20 * 3600 * 1000),
          remarks: 'Compactor vehicle en route.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 6 * 3600 * 1000),
          remarks: 'Bin emptied, bleached, and area sanitized.',
          imageUrl: getPhoto(11, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/debris_hsr_19th_cleared.jpg'),
          locationAccuracy: 10,
          resolutionDistanceMeters: 14,
        },
      ],
    },
    // Complaint 11: HSR Layout Water & Drainage (Reopened)
    {
      title: 'Blocked Stormwater Culvert on 5th Main',
      description: 'Inundation during light showers due to mud accumulation in roadside culvert.',
      category: 'Water Supply & Drainage' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6350, 12.9140],
      },
      address: '5th Main Rd, Sector 7, HSR Layout, Bengaluru 560102',
      wardId: hsrWard._id,
      agencyId: bwssb._id,
      imageUrl: getPhoto(22, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/clogged_grate_hsr_sector7.jpg'),
      resolutionImageUrl: getPhoto(23, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/clogged_grate_hsr_desilted.jpg'),
      status: 'Reopened - Escalated' as const,
      reportedBy: priya._id,
      createdAt: new Date(Date.now() - 72 * 3600 * 1000),
      upvotesCount: 3,
      reopenCount: 1,
      priorityScore: 16.5,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 72 * 3600 * 1000),
          remarks: 'Water pooling up to doorstep.',
        },
        {
          status: 'In Progress' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 48 * 3600 * 1000),
          remarks: 'Manual desilting crew assigned.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: sunita._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 30 * 3600 * 1000),
          remarks: 'Culvert opened and silt removed.',
          imageUrl: getPhoto(23, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/clogged_grate_hsr_desilted.jpg'),
          locationAccuracy: 8,
          resolutionDistanceMeters: 11,
        },
        {
          status: 'Reopened - Escalated' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 10 * 3600 * 1000),
          remarks: 'The desilted mud was dumped directly on the curb and got washed right back in with yesterday evening rain!',
        },
      ],
    },
    // Complaint 12: Koramangala Roads (Resolved - Citizen Verified)
    {
      title: 'Cracked Pedestrian Walkway opposite Jyoti Nivas College',
      description: 'Multiple pavers dislodged creating tripping hazard for students and senior citizens.',
      category: 'Roads' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6210, 12.9320],
      },
      address: 'Hosur Rd, 5th Block, Koramangala, Bengaluru 560095',
      wardId: koramangalaWard._id,
      agencyId: bbmpRoads._id,
      imageUrl: getPhoto(12, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/caved_footpath_kora_jnc.jpg'),
      resolutionImageUrl: getPhoto(13, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/caved_footpath_kora_rebuilt.jpg'),
      status: 'Resolved - Citizen Verified' as const,
      reportedBy: voter3._id,
      createdAt: new Date(Date.now() - 90 * 3600 * 1000),
      upvotesCount: 2,
      reopenCount: 0,
      priorityScore: 10.5,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 90 * 3600 * 1000),
          remarks: 'Footpath broken in multiple places.',
        },
        {
          status: 'In Progress' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 60 * 3600 * 1000),
          remarks: 'Interlocking paver blocks ordered.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 36 * 3600 * 1000),
          remarks: 'Entire 20m stretch relaid with interlocking tiles.',
          imageUrl: getPhoto(13, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/caved_footpath_kora_rebuilt.jpg'),
          locationAccuracy: 9,
          resolutionDistanceMeters: 8,
        },
        {
          status: 'Resolved - Citizen Verified' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 12 * 3600 * 1000),
          remarks: 'Clean pavement, very safe now.',
        },
      ],
    },
    // Complaint 13: Koramangala Sanitation (Resolved - Citizen Verified)
    {
      title: 'Fallen Tree Branches Obstructing 3rd Block Lane',
      description: 'Heavy eucalyptus branch snapped following squall, blocking vehicular passage.',
      category: 'Sanitation' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6290, 12.9370],
      },
      address: '12th Main Rd, 3rd Block, Koramangala, Bengaluru 560034',
      wardId: koramangalaWard._id,
      agencyId: bbmpSwm._id,
      imageUrl: getPhoto(18, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/fallen_tree_branch_kora_3rd_block.jpg'),
      resolutionImageUrl: getPhoto(19, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/fallen_tree_branch_cleared.jpg'),
      status: 'Resolved - Citizen Verified' as const,
      reportedBy: priya._id,
      createdAt: new Date(Date.now() - 60 * 3600 * 1000),
      upvotesCount: 3,
      reopenCount: 0,
      priorityScore: 14.0,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 60 * 3600 * 1000),
          remarks: 'Branch blocking ambulance access.',
        },
        {
          status: 'In Progress' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 40 * 3600 * 1000),
          remarks: 'Forest wing team arrived with chainsaw.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 25 * 3600 * 1000),
          remarks: 'Logs cut and shifted. Street cleared and swept.',
          imageUrl: getPhoto(19, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/fallen_tree_branch_cleared.jpg'),
          locationAccuracy: 10,
          resolutionDistanceMeters: 12,
        },
        {
          status: 'Resolved - Citizen Verified' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 8 * 3600 * 1000),
          remarks: 'Prompt action, road fully clear.',
        },
      ],
    },
    // Complaint 14: Koramangala Streetlights (Pending)
    {
      title: 'Damaged Octagonal Streetlight Pole near St. Johns Signal',
      description: 'Pole tilted precariously at 20 degrees after vehicular collision.',
      category: 'Streetlights' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6180, 12.9290],
      },
      address: 'Sarjapur Main Rd, 1st Block, Koramangala, Bengaluru 560034',
      wardId: koramangalaWard._id,
      agencyId: bescom._id,
      imageUrl: getPhoto(24, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/broken_pole_kora_st_johns.jpg'),
      status: 'Pending' as const,
      reportedBy: voter1._id,
      createdAt: new Date(Date.now() - 14 * 3600 * 1000),
      upvotesCount: 1,
      reopenCount: 0,
      priorityScore: 8.0,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: rahul._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 14 * 3600 * 1000),
          remarks: 'Pole could fall in high wind.',
        },
      ],
    },
    // Complaint 15: Koramangala Water & Drainage (Disputed - Admin Review)
    {
      title: 'Potable Water Pipeline Burst on 80 Feet Road',
      description: 'High-pressure water jet eroding foundation of nearby commercial buildings.',
      category: 'Water Supply & Drainage' as const,
      location: {
        type: 'Point' as const,
        coordinates: [77.6320, 12.9410],
      },
      address: '80 Feet Rd, 6th Block, Koramangala, Bengaluru 560095',
      wardId: koramangalaWard._id,
      agencyId: bwssb._id,
      imageUrl: getPhoto(30, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/water_pipeline_burst_kora_5th_block.jpg'),
      resolutionImageUrl: getPhoto(31, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/water_pipeline_burst_repaired.jpg'),
      status: 'Disputed - Admin Review' as const,
      reportedBy: priya._id,
      createdAt: new Date(Date.now() - 80 * 3600 * 1000),
      upvotesCount: 4,
      reopenCount: 1,
      priorityScore: 19.0,
      statusHistory: [
        {
          status: 'Pending' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 80 * 3600 * 1000),
          remarks: 'Heavy flooding from broken valve.',
        },
        {
          status: 'In Progress' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 50 * 3600 * 1000),
          remarks: 'Emergency isolation valve turned off.',
        },
        {
          status: 'Pending Verification' as const,
          actorId: ramesh._id,
          role: 'officer' as const,
          timestamp: new Date(Date.now() - 30 * 3600 * 1000),
          remarks: 'Valve gasket replaced and pipeline repressurized.',
          imageUrl: getPhoto(31, 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/water_pipeline_burst_repaired.jpg'),
          locationAccuracy: 11,
          resolutionDistanceMeters: 13,
        },
        {
          status: 'Disputed - Admin Review' as const,
          actorId: priya._id,
          role: 'citizen' as const,
          timestamp: new Date(Date.now() - 8 * 3600 * 1000),
          remarks: 'Leakage restarted within 2 hours. Pressure gauge was not calibrated.',
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
    // Complaint 4 (upvotes: 2)
    { complaintId: createdComplaints[4]._id, userId: rahul._id },
    { complaintId: createdComplaints[4]._id, userId: voter1._id },
    // Complaint 5 (upvotes: 3)
    { complaintId: createdComplaints[5]._id, userId: priya._id },
    { complaintId: createdComplaints[5]._id, userId: voter1._id },
    { complaintId: createdComplaints[5]._id, userId: voter2._id },
    // Complaint 6 (upvotes: 1)
    { complaintId: createdComplaints[6]._id, userId: rahul._id },
    // Complaint 7 (upvotes: 2)
    { complaintId: createdComplaints[7]._id, userId: priya._id },
    { complaintId: createdComplaints[7]._id, userId: voter2._id },
    // Complaint 8 (upvotes: 3)
    { complaintId: createdComplaints[8]._id, userId: rahul._id },
    { complaintId: createdComplaints[8]._id, userId: voter1._id },
    { complaintId: createdComplaints[8]._id, userId: voter3._id },
    // Complaint 9 (upvotes: 4)
    { complaintId: createdComplaints[9]._id, userId: priya._id },
    { complaintId: createdComplaints[9]._id, userId: rahul._id },
    { complaintId: createdComplaints[9]._id, userId: voter1._id },
    { complaintId: createdComplaints[9]._id, userId: voter2._id },
    // Complaint 10 (upvotes: 2)
    { complaintId: createdComplaints[10]._id, userId: rahul._id },
    { complaintId: createdComplaints[10]._id, userId: voter2._id },
    // Complaint 11 (upvotes: 3)
    { complaintId: createdComplaints[11]._id, userId: priya._id },
    { complaintId: createdComplaints[11]._id, userId: voter1._id },
    { complaintId: createdComplaints[11]._id, userId: voter3._id },
    // Complaint 12 (upvotes: 2)
    { complaintId: createdComplaints[12]._id, userId: rahul._id },
    { complaintId: createdComplaints[12]._id, userId: priya._id },
    // Complaint 13 (upvotes: 3)
    { complaintId: createdComplaints[13]._id, userId: priya._id },
    { complaintId: createdComplaints[13]._id, userId: voter2._id },
    { complaintId: createdComplaints[13]._id, userId: voter3._id },
    // Complaint 14 (upvotes: 1)
    { complaintId: createdComplaints[14]._id, userId: rahul._id },
    // Complaint 15 (upvotes: 4)
    { complaintId: createdComplaints[15]._id, userId: priya._id },
    { complaintId: createdComplaints[15]._id, userId: rahul._id },
    { complaintId: createdComplaints[15]._id, userId: voter1._id },
    { complaintId: createdComplaints[15]._id, userId: voter2._id },
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
