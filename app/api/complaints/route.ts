import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { Ward } from '@/models/Ward';
import { Agency } from '@/models/Agency';
import { Vote } from '@/models/Vote';
import { calculatePriorityScore, calculateHaversineDistance } from '@/lib/geo';
import { requireAuth, formatApiError } from '@/lib/apiAuth';
import { createComplaintSchema, listComplaintsQuerySchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);

    const queryObj = {
      wardId: searchParams.get('wardId') || undefined,
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || '50',
    };

    const validatedQuery = listComplaintsQuerySchema.parse(queryObj);
    const { wardId, category, status, limit } = validatedQuery;

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
    return formatApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce authentication server-side
    const user = await requireAuth(req);

    // 2. Validate input body using Zod
    const body = await req.json();
    const validatedData = createComplaintSchema.parse(body);

    const { title, description, category, lat, lng, address, imageUrl, confirmDistinct } =
      validatedData;

    await connectToDatabase();

    // 3. Rate limit complaint creation (3 per hour per user)
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const recentSubmissionsCount = await Complaint.countDocuments({
      reportedBy: user.id,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentSubmissionsCount >= 3) {
      return NextResponse.json(
        {
          error:
            'Rate limit exceeded: You may file a maximum of 3 complaints per hour to prevent spam. Please try again later.',
          hourlyLimit: 3,
          recentCount: recentSubmissionsCount,
        },
        { status: 429 }
      );
    }

    // 4. Server-side duplicate re-check (409 Conflict unless client sends confirmDistinct=true)
    if (!confirmDistinct) {
      const duplicateComplaints = await Complaint.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat], // GeoJSON [longitude, latitude]
            },
            $maxDistance: 40, // 40-meter radius
          },
        },
        category,
        status: {
          $nin: ['Resolved - Citizen Verified', 'Resolved - Auto Closed', 'Rejected - Invalid'],
        },
      })
        .limit(5)
        .lean();

      if (duplicateComplaints.length > 0) {
        const duplicates = duplicateComplaints.map((d: any) => ({
          _id: d._id,
          title: d.title,
          description: d.description,
          imageUrl: d.imageUrl,
          upvotesCount: d.upvotesCount,
          status: d.status,
          distanceMeters: Math.round(
            calculateHaversineDistance(lat, lng, d.location.coordinates[1], d.location.coordinates[0])
          ),
        }));

        return NextResponse.json(
          {
            error: `Duplicate issue detected within 40m radius with matching category '${category}'. You can upvote the existing ticket or submit with confirmDistinct=true to override.`,
            isDuplicate: true,
            duplicates,
          },
          { status: 409 }
        );
      }
    }

    // 5. Boundary Auto-Routing via GeoJSON Polygon Intersection ($geoIntersects)
    const matchedWard = await Ward.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
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

    // 6. Resolve matching civic agency
    const matchedAgency = await Agency.findOne({
      jurisdictionCategories: category,
    });

    // 7. Calculate initial Priority Score
    const priorityScore = calculatePriorityScore(category, 1, new Date(), 0);

    // 8. Create Complaint and reporter's Vote atomically in one MongoDB transaction
    const db = await connectToDatabase();
    const session = await db.startSession();
    let createdComplaintId: any;

    try {
      await session.withTransaction(async () => {
        const [complaint] = await Complaint.create(
          [
            {
              title,
              description,
              category,
              location: {
                type: 'Point',
                coordinates: [lng, lat],
              },
              address: address || `${matchedWard.name}, Bengaluru`,
              wardId: matchedWard._id,
              agencyId: matchedAgency?._id,
              imageUrl,
              status: 'Pending',
              reportedBy: user.id,
              upvotesCount: 1,
              reopenCount: 0,
              priorityScore,
              statusHistory: [
                {
                  status: 'Pending',
                  actorId: user.id as any,
                  role: user.role || 'citizen',
                  timestamp: new Date(),
                  remarks: 'Complaint filed with verified geolocation and photograph.',
                },
              ],
            },
          ],
          { session }
        );

        createdComplaintId = complaint._id;

        await Vote.create(
          [
            {
              complaintId: complaint._id,
              userId: user.id,
            },
          ],
          { session }
        );
      });
    } catch (txErr: any) {
      if (txErr?.message?.includes('replica set member')) {
        // Fallback for non-replica set environments that lack transactions
        const fallbackComplaint = new Complaint({
          title,
          description,
          category,
          location: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          address: address || `${matchedWard.name}, Bengaluru`,
          wardId: matchedWard._id,
          agencyId: matchedAgency?._id,
          imageUrl,
          status: 'Pending',
          reportedBy: user.id,
          upvotesCount: 1,
          reopenCount: 0,
          priorityScore,
          statusHistory: [
            {
              status: 'Pending',
              actorId: user.id as any,
              role: user.role || 'citizen',
              timestamp: new Date(),
              remarks: 'Complaint filed with verified geolocation and photograph.',
            },
          ],
        });
        await fallbackComplaint.save();
        createdComplaintId = fallbackComplaint._id;
        await Vote.create({
          complaintId: fallbackComplaint._id,
          userId: user.id,
        });
      } else {
        throw txErr;
      }
    } finally {
      await session.endSession();
    }

    const populatedComplaint = await Complaint.findById(createdComplaintId)
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
    return formatApiError(error);
  }
}
