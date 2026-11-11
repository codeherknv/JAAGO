import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { Ward } from '@/models/Ward';
import { Agency } from '@/models/Agency';
import { User } from '@/models/User';
import { Vote } from '@/models/Vote';
import { calculatePriorityScore } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const wardId = searchParams.get('wardId');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const query: any = {};
    if (wardId) query.wardId = wardId;
    if (category) query.category = category;
    if (status) query.status = status;

    const complaints = await Complaint.find(query)
      .populate('wardId', 'name code corporation')
      .populate('agencyId', 'name shortName')
      .populate('reportedBy', 'name email image')
      .sort({ priorityScore: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      count: complaints.length,
      complaints,
    });
  } catch (error: any) {
    console.error('Error listing complaints:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve complaints', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    const { title, description, category, lat, lng, address, imageUrl } = body;

    if (!title || !description || !category || lat === undefined || lng === undefined || !imageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, category, lat, lng, imageUrl' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({ error: 'Invalid coordinates provided' }, { status: 400 });
    }

    await connectToDatabase();

    // 1. Boundary Auto-Routing via GeoJSON Polygon Intersection ($geoIntersects)
    const matchedWard = await Ward.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude], // GeoJSON order: [lng, lat]
          },
        },
      },
    });

    if (!matchedWard) {
      return NextResponse.json(
        {
          error:
            'Location outside pilot boundaries. Jaago pilot currently covers Bellandur (W-150), HSR Layout (W-174), and Koramangala (W-151).',
        },
        { status: 422 }
      );
    }

    // 2. Resolve matching civic agency
    const matchedAgency = await Agency.findOne({
      jurisdictionCategories: category,
    });

    // 3. Resolve Reporter User (from session or default demo citizen)
    let reporterUser;
    if (session?.user?.id) {
      reporterUser = await User.findById(session.user.id);
    }

    if (!reporterUser) {
      // Fallback to first citizen user or create demo reporter
      reporterUser = await User.findOne({ role: 'citizen' });
      if (!reporterUser) {
        reporterUser = await User.create({
          name: 'Demo Citizen Reporter',
          email: 'citizen.reporter@jaago.in',
          role: 'citizen',
        });
      }
    }

    // 4. Calculate initial Priority Score
    const priorityScore = calculatePriorityScore(category, 1, new Date(), 0);

    // 5. Create Complaint with Invariant 7 (Append-Only Audit: push initial statusHistory)
    const newComplaint = new Complaint({
      title,
      description,
      category,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      address: address || `${matchedWard.name}, Bengaluru`,
      wardId: matchedWard._id,
      agencyId: matchedAgency?._id,
      imageUrl,
      status: 'Pending',
      reportedBy: reporterUser._id,
      upvotesCount: 1,
      reopenCount: 0,
      priorityScore,
      statusHistory: [
        {
          status: 'Pending',
          actorId: reporterUser._id,
          role: reporterUser.role || 'citizen',
          timestamp: new Date(),
          remarks: 'Complaint filed with verified geolocation and photograph.',
        },
      ],
    });

    await newComplaint.save();

    // 6. Record the reporter's initial upvote in the Vote collection
    try {
      await Vote.create({
        complaintId: newComplaint._id,
        userId: reporterUser._id,
      });
    } catch (voteErr) {
      console.warn('Initial vote record warning:', voteErr);
    }

    const populatedComplaint = await Complaint.findById(newComplaint._id)
      .populate('wardId', 'name code corporation')
      .populate('agencyId', 'name shortName')
      .populate('reportedBy', 'name email');

    return NextResponse.json(
      {
        message: 'Complaint created successfully',
        complaint: populatedComplaint,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating complaint:', error);
    return NextResponse.json(
      { error: 'Failed to create complaint', details: error.message },
      { status: 500 }
    );
  }
}
