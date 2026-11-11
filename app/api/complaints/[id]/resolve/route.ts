import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { User } from '@/models/User';
import { calculateHaversineDistance, calculateAllowedResolutionRadius } from '@/lib/geo';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const complaintId = params.id;
    const body = await req.json();

    const { lat, lng, accuracy, resolutionImageUrl, remarks } = body;

    if (lat === undefined || lng === undefined || !resolutionImageUrl) {
      return NextResponse.json(
        { error: 'Officer GPS coordinates (lat, lng) and resolutionImageUrl are strictly required.' },
        { status: 400 }
      );
    }

    const officerLat = parseFloat(lat);
    const officerLng = parseFloat(lng);
    const deviceAccuracy = Math.max(0, parseFloat(accuracy) || 0);

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Invariant 4: Location-Verified Resolution
    // Allowed Radius = Math.max(50, device_accuracy + 15).
    const allowedRadius = calculateAllowedResolutionRadius(deviceAccuracy);

    // Complaint coordinates in GeoJSON: [longitude, latitude]
    const complaintLng = complaint.location.coordinates[0];
    const complaintLat = complaint.location.coordinates[1];

    const actualDistance = calculateHaversineDistance(
      officerLat,
      officerLng,
      complaintLat,
      complaintLng
    );

    if (actualDistance > allowedRadius) {
      return NextResponse.json(
        {
          error: `Location Verification Failed: You are ${Math.round(
            actualDistance
          )}m away from the incident location. Maximum allowed radius is ${Math.round(
            allowedRadius
          )}m (accuracy: ±${Math.round(deviceAccuracy)}m + 15m threshold). Field officers must be physically on-site to record resolution.`,
          distanceMeters: Math.round(actualDistance),
          allowedRadiusMeters: Math.round(allowedRadius),
          deviceAccuracy: Math.round(deviceAccuracy),
        },
        { status: 403 }
      );
    }

    // Resolve Officer User
    let officerUser;
    if (session?.user?.id) {
      officerUser = await User.findById(session.user.id);
    }
    if (!officerUser) {
      // Demo fallback officer
      officerUser = await User.findOne({ role: 'officer' });
      if (!officerUser) {
        officerUser = await User.create({
          name: 'Demo Field Officer',
          email: 'officer.field@bbmp.gov.in',
          role: 'officer',
        });
      }
    }

    // Invariant 5: Resolving moves ticket to "Pending Verification" (120-hour window)
    const verificationDeadline = new Date(Date.now() + 120 * 60 * 60 * 1000); // 120 hours / 5 days

    complaint.status = 'Pending Verification';
    complaint.resolutionImageUrl = resolutionImageUrl;
    complaint.verificationDeadline = verificationDeadline;

    // Invariant 7: Append-Only Audit
    complaint.statusHistory.push({
      status: 'Pending Verification',
      actorId: officerUser._id,
      role: 'officer',
      timestamp: new Date(),
      remarks:
        remarks ||
        `Resolution proof captured on-site (${Math.round(actualDistance)}m away, GPS accuracy ±${Math.round(
          deviceAccuracy
        )}m). Submitted to 120h citizen audit.`,
      imageUrl: resolutionImageUrl,
      locationAccuracy: Math.round(deviceAccuracy),
      resolutionDistanceMeters: Math.round(actualDistance),
    });

    await complaint.save();

    return NextResponse.json({
      message: 'Resolution verified and accepted. Complaint transitioned to Pending Verification.',
      complaint,
      distanceMeters: Math.round(actualDistance),
      allowedRadiusMeters: Math.round(allowedRadius),
    });
  } catch (error: any) {
    console.error('Resolution error:', error);
    return NextResponse.json(
      { error: 'Failed to record resolution', details: error.message },
      { status: 500 }
    );
  }
}
