import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { calculateHaversineDistance } from '@/lib/geo';
import { nearbyQuerySchema } from '@/lib/validations';
import { formatApiError } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryObj = {
      lat: searchParams.get('lat'),
      lng: searchParams.get('lng'),
      category: searchParams.get('category') || undefined,
      maxDistance: searchParams.get('maxDistance') || '40',
    };

    const validated = nearbyQuerySchema.parse(queryObj);
    const { lat, lng, category, maxDistance } = validated;

    await connectToDatabase();

    const query: any = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat], // GeoJSON order: [longitude, latitude]
          },
          $maxDistance: maxDistance,
        },
      },
      // Check active, non-closed issues
      status: {
        $nin: ['Resolved - Citizen Verified', 'Resolved - Auto Closed', 'Rejected - Invalid'],
      },
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    const nearbyComplaints = await Complaint.find(query)
      .populate('wardId', 'name code')
      .limit(10)
      .lean();

    const results = nearbyComplaints.map((c: any) => {
      const cLng = c.location.coordinates[0];
      const cLat = c.location.coordinates[1];
      const distanceMeters = Math.round(calculateHaversineDistance(lat, lng, cLat, cLng));

      return {
        _id: c._id,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        imageUrl: c.imageUrl,
        upvotesCount: c.upvotesCount,
        address: c.address,
        ward: c.wardId,
        location: c.location,
        createdAt: c.createdAt,
        distanceMeters,
      };
    });

    return NextResponse.json({
      count: results.length,
      complaints: results,
      searchRadiusMeters: maxDistance,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
