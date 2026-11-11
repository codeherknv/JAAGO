import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { calculateHaversineDistance } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const category = searchParams.get('category');
    const maxDistance = parseFloat(searchParams.get('maxDistance') || '40'); // Default 40 meters

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { error: 'Query parameters lat and lng are required.' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'lat and lng must be valid floating point numbers.' },
        { status: 400 }
      );
    }

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

    if (category) {
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
    console.error('Error fetching nearby complaints:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nearby complaints', details: error.message },
      { status: 500 }
    );
  }
}
